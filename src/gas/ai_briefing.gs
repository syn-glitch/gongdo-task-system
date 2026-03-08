/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        ai_briefing.gs
 * @version     v1.0.0
 * @updated     2026-03-08 09:55 (KST)
 * @agent       에이다 (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 주디 대변인 (웹 대시보드 브리핑) 및 공통 업무 데이터 수집 API
 *
 * @change-summary
 *   AS-IS: 데이터 수집 로직이 ai_report.gs에 분산되어 있고 API 키가 하드코딩됨.
 *   TO-BE: 데이터 수집 로직(Data Center) 공통화 및 웹 대시보드용 getDailyBriefing() API 구현. 
 *          API 키는 PropertiesService로 통합 관리.
 *
 * @features
 *   - [추가] getTodayTasksContext() — 오늘 진행/대기 중인 업무 데이터 추출 (속도 최적화 적용)
 *   - [추가] getDailyBriefing() — 웹 대시보드용 '주디 대변인' 브리핑 API (Claude 호출 및 캐싱)
 *   - [추가] getClaudeApiKey() — PropertiesService 기반 안전한 API 키 획득 헬퍼
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-08 09:55 | 에이다 | 최초 작성 (Data Center 공통화 및 브리핑 API)
 * ============================================
 */

// ═══════════════════════════════════════════
// 공통 보안 유틸리티
// ═══════════════════════════════════════════

/**
 * PropertiesService에서 Claude API 키를 가져옵니다. 
 * (코드 내 하드코딩 방지 - QA 요구사항)
 */
function getClaudeApiKey() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("CLAUDE_API_KEY");
  
  if (!key) {
    // 하위 호환: 만약 전역 변수가 정의되어 있고 진짜 키 형태라면 그것을 반환 (과도기용)
    if (typeof CLAUDE_API_KEY !== 'undefined' && CLAUDE_API_KEY && !CLAUDE_API_KEY.includes("여기에")) {
      return CLAUDE_API_KEY;
    }
    throw new Error("CLAUDE_API_KEY가 Script Properties에 설정되지 않았습니다.");
  }
  return key;
}

// ═══════════════════════════════════════════
// 주디 데이터 센터 (통합 데이터 수집)
// ═══════════════════════════════════════════

/**
 * 웹 대시보드 및 슬랙 모닝 브리핑에서 공통으로 사용할 "오늘의 업무 현황" 데이터를 수집합니다.
 * @returns {string} 마크다운 형식의 업무 목록 텍스트
 */
function getTodayTasksContext() {
  const ss = getTargetSpreadsheet(); // web_app.gs의 공통 함수 사용
  const taskSheet = ss.getSheetByName("Tasks");
  if (!taskSheet) return "데이터베이스(Tasks 시트)를 찾을 수 없습니다.";

  // 성능 최적화: 전체 데이터 읽기 (캐시가 이미 있다면 그것을 활용하는 것이 더 좋지만, 실시간성이 중요함)
  const data = taskSheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  let tasksContext = "📋 [현재 대기 및 진행중인 주요 업무]\n";
  let hasTasks = false;
  
  // 오늘 날짜 문자열 계산 (기한 비교용)
  const today = new Date();
  today.setHours(0,0,0,0);
  
  rows.forEach(row => {
    const status = row[2];
    const project = row[3];
    const title = row[4];
    const assignee = row[6];
    const dueDate = row[8];
    
    // '대기' 또는 '진행중'인 활성 업무만 필터링
    if (status === "진행중" || status === "대기") {
      let dateStr = "미지정";
      if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
        dateStr = Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "MM/dd");
      } else if (dueDate) {
        dateStr = dueDate;
      }
      tasksContext += `- [${status}] ${project}: ${title} (담당: ${assignee}, 마감: ${dateStr})\n`;
      hasTasks = true;
    }
  });

  if (!hasTasks) {
    tasksContext += "현재 대기 중이거나 진행 중인 업무가 없습니다! 모든 업무가 완료되었거나 비어있습니다. 🎉";
  }

  return tasksContext;
}

// ═══════════════════════════════════════════
// 웹 프론트엔드 API (주디 대변인)
// ═══════════════════════════════════════════

/**
 * 프론트엔드 대시보드에서 호출하는 일일 브리핑 API
 * 반복 호출로 인한 크레딧 낭비를 막기 위해 30분 캐싱을 적용합니다.
 * @param {string} userName 사용자 이름 (개인화된 인사를 위해)
 */
function getDailyBriefingForWeb(userName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "DAILY_BRIEFING_" + (userName || "ALL");
  
  // 1. 캐시 확인 (30분 이내에 생성된 브리핑이 있다면 그대로 반환)
  const cachedBriefing = cache.get(cacheKey);
  if (cachedBriefing) {
    return { success: true, briefing: cachedBriefing, cached: true };
  }

  try {
    // 2. 공통 데이터 수집기 활용
    const tasksContext = getTodayTasksContext();
    const apiKey = getClaudeApiKey();
    
    // 3. AI 프롬프트 구성 (모바일 환경에 맞춰 극도로 간결하고 다정하게)
    const systemPrompt = `당신은 주디 워크스페이스의 다정하고 유능한 대변인 '주디(🐰)'입니다.
사용자(\${userName || '대표님'})가 웹 대시보드에 접속했을 때 보여줄 짧은 아침 인사 겸 브리핑을 작성해주세요.

[데이터]
\${tasksContext}

[작성 규칙]
1. 분량은 딱 2~3문장으로 아주 짧게 작성하세요. 모바일 화면에서 한눈에 보여야 합니다.
2. 현재 팀이 가장 집중해야 할 핵심 프로젝트나 임박한 마감일을 하나 콕 집어 친근하게 언급하세요.
3. 딱딱한 보고서 말투가 아닌 대화체("~해요!", "~할까요?")를 사용하고, 이모지(✨,🔥,🚀 등)를 1~2개 섞어주세요.
4. 시작은 "안녕하세요 \${userName || '대표님'}! 주디예요 🐰" 처럼 밝게 시작하세요.`;

    const payload = {
      model: "claude-sonnet-4-20250514", // 빠르고 안정적인 모델
      max_tokens: 300,
      temperature: 0.7, // 약간의 다채로운 인사를 위해 온도 조절
      system: systemPrompt,
      messages: [{ role: "user", content: "오늘의 업무 현황을 짧게 브리핑해줘!" }]
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
    
    // 4. API 호출
    const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    const result = JSON.parse(response.getContentText());
    
    if (result.error) {
      console.error("Briefing API Error:", result.error);
      return { success: false, message: "AI 서버 응답 지연: " + result.error.message };
    }
    
    const briefingText = result.content[0].text;
    
    // 5. 성공 시 30분(1800초) 동안 캐싱
    cache.put(cacheKey, briefingText, 1800);
    
    return { success: true, briefing: briefingText, cached: false };

  } catch (e) {
    console.error("getDailyBriefingForWeb Error:", e);
    return { success: false, message: "브리핑 생성 중 오류가 발생했습니다. (" + sanitizeErrorMessage(e) + ")" };
  }
}
