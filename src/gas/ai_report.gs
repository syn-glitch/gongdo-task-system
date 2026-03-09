/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        ai_report.gs
 * @version     v1.2.0
 * @updated     2026-03-10 (KST)
 * @agent       에이다 (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 슬랙 채널에 일간/주간 요약 리포트 전송 (Claude 연동)
 *
 * @change-summary
 *   AS-IS: v1.1.0 — API 호출 시 토큰 사용량 추적 없음
 *   TO-BE: v1.2.0 — callClaudeAPI() 래퍼 적용으로 토큰 사용량 자동 기록
 *
 * @features
 *   - [수정] askClaude() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *   - [수정] generateMorningBriefing() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *
 * ── 변경 이력 ──────────────────────────
 * v1.2.0 | 2026-03-10 | 에이다 BE | callClaudeAPI() 래퍼 적용 (BNK-2026-03-10-001)
 * v1.1.0 | 2026-03-08 09:56 | 에이다 | [QA-2026-03-08] API키 하드코딩 제거 및 로직 통합
 * v1.0.0 | 2026-02-21 22:28 | 자비스팀 | 최초 작성
 * ============================================
 */

// 🛑 [보안 조치 완료] API 키는 Properties 서비스에서 관리합니다.
// 기존 타 파일(ai_chat.gs 등) 하위 호환을 위해 변수명만 유지합니다. (향후 완전 제거 예정)
var CLAUDE_API_KEY = ""; 

// 🛑 [필수 세팅] AI 리포트를 보낼 슬랙 채널 ID를 입력하세요. (예: C0123456789)
const REPORT_CHANNEL_ID = "여기에_채널_ID_입력";

/**
 * 1. 일간/주간 완료 업무 데이터를 가져와 AI에게 전달하고 슬랙으로 보냅니다.
 * (편집기 상단에서 이 함수를 선택하고 실행해보세요)
 */
function generateDailyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName("Tasks");
  const data = taskSheet.getDataRange().getValues();
  
  const rows = data.slice(1); // 헤더 제외
  
  let tasksContext = "📋 [오늘의 업무 현황 데이터]\n";
  let hasTasks = false;
  
  rows.forEach(row => {
    // A:1(ID), B:2(유형), C:3(상태), D:4(프로젝트), E:5(제목), F:6(내용), G:7(담당자)
    const status = row[2];
    const project = row[3];
    const title = row[4];
    const assignee = row[6];
    
    if (status === "진행중" || status === "완료") {
      tasksContext += `- [${status}] ${project}: ${title} (담당: ${assignee})\n`;
      hasTasks = true;
    }
  });

  if (!hasTasks) {
    tasksContext += "보고할 내용(진행중이거나 완료된 업무)이 없습니다.";
  }

  Logger.log("✅ 시트 데이터 추출 완료. AI에게 리포트 작성을 요청합니다...");
  
  // 2. Claude AI를 통한 요약 리포트 생성
  const aiReportText = askClaude(tasksContext);

  if (aiReportText) {
    Logger.log("✅ AI 리포트 생성 완료. 슬랙으로 전송합니다.");
    // 3. 슬랙 전송 (slack_notification.gs 내부의 sendSlackMessage 재사용)
    if (typeof sendSlackMessage === 'function') {
      const finalMessage = `🤖 *주디의 데일리 업무 요약 리포트*\n\n${aiReportText}`;
      sendSlackMessage(REPORT_CHANNEL_ID, finalMessage);
    } else {
       Logger.log("❌ 에러: sendSlackMessage 함수를 찾을 수 없습니다.");
    }
  }
}

/**
 * Claude 3.5 Sonnet (또는 Haiku) 모델을 호출하여 리포팅 텍스트를 반환합니다.
 */
function askClaude(promptText) {
  let apiKey;
  try {
    apiKey = typeof getClaudeApiKey === 'function' ? getClaudeApiKey() : PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  } catch (e) {
    const errorMsg = "⚠️ " + e.message;
    Logger.log(errorMsg);
    return errorMsg;
  }

  if (!apiKey) {
     return "⚠️ Claude API 키가 설정되지 않았습니다. PropertiesService에 CLAUDE_API_KEY를 추가하세요.";
  }

  const url = "https://api.anthropic.com/v1/messages";
  
  const systemPrompt = "당신은 팀의 유능하고 친절한 프로젝트 관리 비서 '주디'입니다. 제공된 업무 현황 데이터를 바탕으로, 오늘 팀이 어떤 일들을 진행했고 완료했는지 명쾌하고 읽기 좋게 요약해주세요. 슬랙(Slack)에서 보기 좋도록 약간의 이모지와 마크다운 형식을 적극 활용하여 요점만 간결하게 작성해주세요.";
  
  const payload = {
    model: "claude-sonnet-4-20250514", // 응답 속도가 빠르고 저렴한 모델 추천
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      { role: "user", content: promptText }
    ]
  };
  
  const options = {
    method: "post",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const result = callClaudeAPI(url, options, "askClaude", "system");

    if (result.error) {
      console.error("Claude API 에러:", result.error);
      return `❌ AI 리포트 생성 실패 (API 에러): ${result.error.message}`;
    }

    return result.content[0].text;
  } catch (e) {
    console.error("API 호출 중 예외 발생:", e);
    return `❌ API 호출 중 오류 발생: ${e.message}`;
  }
}

/**
 * [Phase 6] ☀️ 모닝 브리핑: 매일 아침 지정된 시간에 트리거(Trigger)로 작동합니다.
 */
function generateMorningBriefing() {
  
  // [v1.1.0] 데이터 수집 로직(Data Center) 공통화 — ai_briefing.gs 사용
  let tasksContext = "";
  if (typeof getTodayTasksContext === 'function') {
     tasksContext = getTodayTasksContext();
  } else {
     tasksContext = "데이터 수집 함수(getTodayTasksContext)를 찾을 수 없습니다.";
  }

  const systemPrompt = "당신은 활기차고 긍정적인 팀의 프로젝트 비서 '주디'입니다. 아침 업무 시각에 맞춰 팀원들이 오늘 하루 집중해야 할 '진행중' 및 '대기' 상태의 업무들을 브리핑해주세요. 마감일이 가까운 항목은 특별히 강조해주시고, 하루를 힘차게 시작할 수 있는 따뜻하고 동기부여되는 인사말을 덧붙여주세요. 마크다운과 이모지를 활용하세요.";
  
  const payload = {
    model: "claude-sonnet-4-20250514", 
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      { role: "user", content: tasksContext }
    ]
  };
  
  const options = {
    method: "post",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const result = callClaudeAPI("https://api.anthropic.com/v1/messages", options, "generateMorningBriefing", "system");

    if (result.content && result.content[0].text) {
      if (typeof sendSlackMessage === 'function') {
        const finalMessage = `🌅 *주디의 아침 업무 브리핑*\n\n${result.content[0].text}`;
        sendSlackMessage(REPORT_CHANNEL_ID, finalMessage);
      }
    }
  } catch (e) {
    console.error("모닝 브리핑 중 오류: ", e);
  }
}

