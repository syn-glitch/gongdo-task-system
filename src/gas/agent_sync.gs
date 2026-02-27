/**
 * ============================================================================
 * [파일명]: agent_sync.gs
 * [설명]: 구글 시트 기반 에이전트(자비스 ↔ 김감사) 워크플로우 자동화 관제탑
 * [배포]: 시간 기반 트리거 1분 단위로 2개 함수 (jarvis_AutoDevelopmentTrigger, kimQA_AutoReviewTrigger) 등록 요망
 * ============================================================================
 */

// 팀장님이 제공해주신 구글 스프레드시트 URL ID (Agent_Tasks 탭 스캔용)
const AGENT_SHEET_ID = "1gluWChHpmWWVRxgPpteOwcebE54mH1XK7a15NRc1-kU";

/**
 * [자비스 에이전트] 상태 감지 및 개발 시작 트리거
 * - 1분마다 실행 (GAS 시간 기반 트리거 연동 필요)
 * - "대기중" → "개발중(자비스)", "디버깅_필요" → "개발중(자비스)"
 */
function jarvis_AutoDevelopmentTrigger() {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    const sheet = ss.getSheetByName("Agent_Tasks");
    if (!sheet) {
      Logger.log("[WARN] Agent_Tasks 탭을 찾을 수 없습니다.");
      return;
    }

    const data = sheet.getDataRange().getValues();

    // 1행은 헤더이므로 인덱스 1부터 시작
    for (let i = 1; i < data.length; i++) {
      const rowNum = i + 1;
      const taskId = data[i][0];   // A: Task_ID
      const status = data[i][2];   // C: 상태
      const agent  = data[i][3];   // D: 담당_에이전트
      
      // Case 1: 팀장님이 새 작업을 등록한 상태 ("대기중")
      if (status === "대기중") {
        const reqContent = data[i][1];
        Logger.log(`[자비스] 신규 Task 감지: ${taskId} - 개발 시작`);
        
        // 락(Lock) 걸기: 다른 트리거가 중복으로 물어가지 않게 상태를 즉시 "개발중"으로 변경
        sheet.getRange(rowNum, 3).setValue("개발중");
        sheet.getRange(rowNum, 4).setValue("자비스");
        
        // 실시간 중계 알림
        sendSlackMessage(`🚀 *[자비스]* \`${taskId}\` 업무 확인했습니다! 지금 바로 기획 및 개발을 시작합니다.\n(요청: ${reqContent})`);
        
        // Phase 2: OpenAI (GPT) 기반 요구사항 분석 및 로컬(구글 드라이브) 문서 생성 처리 로직
        try {
          // [RAG 연동 - Phase 1] 문맥 파악을 위한 깃허브 원본 로드 (10분 캐시)
          const coreCode = fetchGitHubRaw("src/frontend/judy_workspace.html");
          const teamRules = fetchGitHubRaw("qa/qa_team_rules.md");
          
          const sysPrompt = "당신은 구글 앱스 스크립트 특급 개발자 에이전트 자비스(Jarvis)입니다. 사용자의 요구사항을 받은 후, RAG로 주입된 기존 소스 코드와 완벽하게 호환되도록 개발하고 마크다운 문서로 보고서를 제출합니다.";
          const usrPrompt = `요청 사항:\n${reqContent}\n\n` + 
                            `=== [RAG 1] 기존 핵심 소스 코드 (judy_workspace.html) ===\n${coreCode}\n\n` +
                            `=== [RAG 2] 팀 운영 규칙 ===\n${teamRules}\n\n` +
                            `위의 기존 코드 컨텍스트와 룰북을 철저히 분석하여, 기존 아키텍처 및 CSS 구조와 100% 호환되는 최적의 기획서 및 수정 코드를 마크다운으로 산출하세요.`;
          
          const devDocContent = callOpenAIAPI(usrPrompt, sysPrompt);
          const fileUrl = createDriveFile(taskId + "_Jarvis_Dev_Doc", devDocContent);
          
          sheet.getRange(rowNum, 5).setValue(fileUrl);  // 개발_문서_링크 (E)
          sheet.getRange(rowNum, 10).setValue(new Date());// 등록_시간 (J)
          sheet.getRange(rowNum, 3).setValue("QA_대기"); // 다음 파이프라인으로 토스
          
          Logger.log(`[자비스] ${taskId} 문서 생성 및 QA_대기 토스 성공 (${fileUrl})`);
          
          // 중계 알림
          sendSlackMessage(`📝 *[자비스]* \`${taskId}\` 1차 개발 완료했습니다. 김감사 팀장님 QA 부탁드립니다.\n🔗 기획서/코드: ${fileUrl}`, "LOW");
        } catch (e) {
          sheet.getRange(rowNum, 12).setValue("자비스 생성 에러: " + e.message);
          sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
          sendSlackMessage(`🚨 *[자비스]* \`${taskId}\` 개발 중 에러가 발생했습니다. 수동 개입이 필요합니다. (${e.message})`, "CRITICAL");
        }
      }
      
      // Case 2: QA가 디버깅을 지시한 상태 ("디버깅_필요" && 담당자 "자비스")
      else if (status === "디버깅_필요" && agent === "자비스") {
        Logger.log(`[자비스] 반려 Task 감지: ${taskId} - 디버깅 시작`);
        
        // 락(Lock) 걸기
        sheet.getRange(rowNum, 3).setValue("개발중");
        
        sendSlackMessage(`🛠️ *[자비스]* \`${taskId}\` 김감사 팀장님의 QA 지적사항을 확인했습니다. 즉시 버그 수정에 돌입합니다!`);
        
        // Phase 2 연동: F열(QA 문서 링크)의 불합격 사유(.md)를 읽어와서 코드 수정
        try {
          const qaUrl = data[i][5]; // F: QA 문서 링크
          const qaContent = getDriveFileContent(qaUrl);
          
          let pingPongNum = parseInt(data[i][11], 10); // L: 핑퐁_횟수
          if (isNaN(pingPongNum)) pingPongNum = 0;
          const newPingPong = pingPongNum + 1;
          
          if (newPingPong > 5) {
             sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
             sheet.getRange(rowNum, 12).setValue("무한루프 강제 중단"); // L열 기록
             sendSlackMessage(`🚨 *[시스템]* \`${taskId}\` 핑퐁이 5회를 초과하여 무한루프 방지를 위해 작업을 강제 중단합니다. 팀장님의 확인이 필요합니다.`, "CRITICAL");
             continue; // 핑퐁 5회 초과시 무한루프 방지
          }

          const sysPrompt = "당신은 구글 앱스 스크립트 특급 개발자 자비스(Jarvis)입니다. QA 피드백을 반영하여 디버깅된 최종 코드로 기획서를 보완하세요.";
          const usrPrompt = "이전 QA 피드백 내용:\n" + qaContent + "\n\n결과를 바탕으로 버그를 고치고 수정된 문서를 산출하세요.";
          
          const devDocContent = callOpenAIAPI(usrPrompt, sysPrompt);
          const fileUrl = createDriveFile(taskId + `_Jarvis_Dev_Fix_v${newPingPong}`, devDocContent);
          
          sheet.getRange(rowNum, 5).setValue(fileUrl);
          sheet.getRange(rowNum, 12).setValue(newPingPong); // L열 (핑퐁_횟수) 기록 업데이트
          sheet.getRange(rowNum, 3).setValue("QA_대기");
          
          sendSlackMessage(`📝 *[자비스]* \`${taskId}\` ${newPingPong}번째 수정 완료했습니다. 김감사 팀장님, 다시 깐깐한 검토 바랍니다!\n🔗 수정안: ${fileUrl}`, "LOW");
        } catch (e) {
          sheet.getRange(rowNum, 12).setValue("자비스 수정 에러: " + e.message);
          sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
          sendSlackMessage(`🚨 *[자비스]* \`${taskId}\` 수정 중 에러가 발생했습니다. 수동 개입이 필요합니다. (${e.message})`, "CRITICAL");
        }
      }
    }
  } catch (err) {
    console.error("[FATAL] jarvis_AutoDevelopmentTrigger 런타임 에러:", err);
  }
}

/**
 * [김감사 에이전트] 상태 감지 및 QA 리뷰 시작 트리거
 * - 1분마다 실행 (GAS 시간 기반 트리거 연동 필요)
 * - "QA_대기" → "QA_진행중(김감사)" 
 */
function kimQA_AutoReviewTrigger() {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    const sheet = ss.getSheetByName("Agent_Tasks");
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const rowNum = i + 1;
      const taskId = data[i][0];   // A: Task_ID
      const status = data[i][2];   // C: 상태
      
      // Case: 자비스가 개발을 마치고 QA를 넘긴 상태 ("QA_대기")
      if (status === "QA_대기") {
        Logger.log(`[김감사] QA 리뷰 감지: ${taskId} - 리뷰 시작`);
        
        // 락(Lock) 걸기
        sheet.getRange(rowNum, 3).setValue("QA_진행중");
        sheet.getRange(rowNum, 4).setValue("김감사");
        
        sendSlackMessage(`🔍 *[김감사]* \`${taskId}\` 자비스가 올린 코드를 샅샅이 검수하겠습니다. (QA 진행 중...)`);
        
        // Phase 2: E열(개발 문서 링크)을 분석하여 에러 검출 로직
        try {
          const devUrl = data[i][4]; // E: 개발 문서 링크
          const devContent = getDriveFileContent(devUrl);
          
          // [RAG 연동 - Phase 1] 깃허브에서 최신 룰북 자동 로드
          const qaRules = fetchGitHubRaw("qa/QA_PROCESS_V2.md");
          const teamRules = fetchGitHubRaw("qa/qa_team_rules.md");
          
          // [Phase 2] Json 포맷 강제 프롬프트
          const sysPrompt = "당신은 최고의 QA 팀장 김감사입니다. 제출된 코드를 읽고 엄격하게 검수하세요.\n" +
                            "응답은 반드시 아래 JSON 구조로만 출력해야 하며, 다른 텍스트는 절대 포함하지 마세요:\n" +
                            "{\n" +
                            "  \"qa_result\": \"PASS\" | \"FAIL\",\n" +
                            "  \"total_errors\": 숫자,\n" +
                            "  \"errors\": []\n" +
                            "}";
          
          const qaPrompt = `=== 자비스가 개발한 코드 산출물 ===\n${devContent}\n\n` +
                           `=== [RAG 1] 공식 QA 프로세스 룰북 ===\n${qaRules}\n\n` +
                           `=== [RAG 2] 팀 운영 규칙 ===\n${teamRules}\n\n` +
                           `위 RAG 룰북(QA Phase 조건 등) 규칙을 엄격하게 적용하여 제출된 코드를 1:1로 검수하고, 치명적 결함 및 보안 위협을 철저히 찾아내세요. 오직 JSON만 반환하세요.`;
          
          const qaResultText = callOpenAIAPI(qaPrompt, sysPrompt);
          
          // [Phase 2] 에러 갯수 추출 로직 (Robust Parsing)
          const parsedQA = parseErrorCount(qaResultText);
          
          if (parsedQA.errorCount === -1) {
             sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
             sheet.getRange(rowNum, 12).setValue("QA JSON 파싱 에러");
             sendSlackMessage(`🚨 *[김감사]* \`${taskId}\` QA 결과 JSON 파싱에 실패했습니다. 형식 오류를 점검해주세요.`, "HIGH");
             continue; // 파싱 실패 시 진행 불가
          }
          
          const errorCount = parsedQA.errorCount;

          const fileUrl = createDriveFile(taskId + "_Kim_QA_Report", qaResultText);
          
          sheet.getRange(rowNum, 6).setValue(fileUrl); // F열 QA 문서
          sheet.getRange(rowNum, 8).setValue(errorCount); // H열 에러 카운트
          sheet.getRange(rowNum, 7).setValue("[✅][✅][✅][✅][✅][✅][✅]"); // G열 체크리스트

          if (errorCount > 0) {
            sheet.getRange(rowNum, 3).setValue("디버깅_필요");
            sheet.getRange(rowNum, 4).setValue("자비스");
            sendSlackMessage(`💥 *[김감사]* \`${taskId}\` 맙소사, 에러를 ${errorCount}개나 발견했습니다! 자비스, 당장 꼼꼼하게 다시 수정해오세요.\n🔗 QA 리포트: ${fileUrl}`, "HIGH");
          } else {
            sheet.getRange(rowNum, 3).setValue("최종_승인");
            sheet.getRange(rowNum, 11).setValue(new Date()); // K열 완료 시간
            
            sendSlackMessage(`✅ *[김감사]* \`${taskId}\` 훌륭합니다. 에러 0개! 깐깐한 제 QA 기준을 완벽하게 통과했습니다.\n🔗 최종 QA 리포트: ${fileUrl}`, "HIGH");
            
            // Phase 3: 슬랙 알람 발송 연동 (최종 결재)
            try {
              sendSlackNotification(taskId, rowNum, sheet);
              Logger.log(`[김감사] ${taskId} QA 완료 → 최종 결재 슬랙 알림 전송`);
            } catch(e) {
              Logger.log(`[WARN] 슬랙 알림 전송 실패: ${e.message}`);
            }
          }
        } catch(e) {
          sheet.getRange(rowNum, 12).setValue("김감사 QA 에러: " + e.message);
          sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
          sendSlackMessage(`🚨 *[김감사]* \`${taskId}\` QA 검수 중 시스템 에러가 발생했습니다. (${e.message})`, "CRITICAL");
        }
      }
    }
  } catch (err) {
    console.error("[FATAL] kimQA_AutoReviewTrigger 런타임 에러:", err);
  }
}

/**
 * [1회용 헬퍼] 구글 시트 탭이 없을 경우 최초 세팅 (수동 실행용)
 */
function initAgentTasksSheet() {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    let sheet = ss.getSheetByName("Agent_Tasks");
    
    if (!sheet) {
      sheet = ss.insertSheet("Agent_Tasks");
      const headers = [
        "Task_ID", "요청_내용", "상태", "담당_에이전트", "개발_문서_링크", 
        "QA_문서_링크", "QA_체크리스트", "에러_카운트", "핑퐁_횟수", 
        "등록_시간", "완료_시간", "비고"
      ];
      
      // 헤더 서식 입히기
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight("bold")
        .setBackground("#F3F3F3")
        .setHorizontalAlignment("center");
        
      // C열 데이터 유효성 검증(드롭다운)
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["대기중", "개발중", "QA_대기", "QA_진행중", "디버깅_필요", "최종_승인"], true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange("C2:C1000").setDataValidation(rule);
      
      Logger.log("✅ Agent_Tasks 탭이 완벽하게 생성되었습니다.");
    } else {
      Logger.log("ℹ️ Agent_Tasks 탭이 이미 존재합니다.");
    }
  } catch (e) {
    Logger.log("❌ 탭 생성 실패: " + e.message);
  }
}

/**
 * ============================================================================
 * [헬퍼 함수] Phase 2 AI 문서 처리 공통 Utils
 * ============================================================================
 */

/**
 * OpenAI API 연결 (Properties의 OPENAI_API_KEY 적용 완료)
 */
function callOpenAIAPI(userPrompt, systemPrompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY") || "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";
  
  const payload = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
  const json = JSON.parse(response.getContentText());
  
  if (json.error) {
    throw new Error("AI 호출 실패: " + json.error.message);
  }
  return json.choices[0].message.content;
}

/**
 * 구글 드라이브 파일 읽기 (DriveApp)
 */
function getDriveFileContent(driveLink) {
  if (!driveLink) return "내용 없음";
  const fileIdMatch = driveLink.match(/[-\w]{25,}/);
  if (!fileIdMatch) return "올바르지 않은 구글 드라이브 링크";
  
  try {
    const file = DriveApp.getFileById(fileIdMatch[0]);
    return file.getBlob().getDataAsString();
  } catch(e) {
    return "문서를 읽어올 수 없습니다: " + e.message;
  }
}

/**
 * 구글 드라이브에 마크다운 문서 생성 및 링크 반환
 */
function createDriveFile(fileName, content) {
  const file = DriveApp.createFile(fileName + ".md", content, MimeType.PLAIN_TEXT);
  // 외부 열람이 가능하도록 권한 수정
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * ============================================================================
 * [헬퍼 함수] Phase 3 슬랙 웹훅 알람
 * ============================================================================
 */
function sendSlackNotification(taskId, rowNum, sheet) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL");
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL 스크립트 속성이 설정되지 않았습니다.");
  }
  
  const reqContent = sheet.getRange(rowNum, 2).getValue();
  const pingPong = sheet.getRange(rowNum, 9).getValue() || 0;
  const devDoc = sheet.getRange(rowNum, 5).getValue();
  const qaDoc = sheet.getRange(rowNum, 6).getValue();
  
  const message = `🚀 *[Agent Sync] 자동화 검수 완료:* 승인 대기 중 🚀\n\n` +
                  `*▪️ Task ID:* ${taskId}\n` +
                  `*▪️ 요청 내용:* ${reqContent}\n` +
                  `*▪️ 에이전트 간 핑퐁 횟수:* ${pingPong}회\n\n` +
                  `📄 *산출물 링크:*\n` +
                  `- [자비스 개발 기획서](${devDoc})\n` +
                  `- [김감사 QA 리포트](${qaDoc})\n\n` +
                  `👉 <https://docs.google.com/spreadsheets/d/${AGENT_SHEET_ID}/edit|시트 열어서 확인 후 최종 배포하기>`;
                  
  const payload = {
    "text": message
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(webhookUrl, options);
}

/**
 * [헬퍼 함수] 실시간 핑퐁 중계 알림용 슬랙 전송기
 */
function sendSlackMessage(text, priority = "LOW") {
  const NOTIFY_PRIORITIES = ["CRITICAL", "HIGH"];
  
  if (!NOTIFY_PRIORITIES.includes(priority)) {
    Logger.log(`[SKIP] 슬랙 알림 스킵 (우선순위: ${priority}): ${text}`);
    return;
  }

  const webhookUrl = PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return; // 웹훅 미설정 시 패스
  
  const payload = { "text": text };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(webhookUrl, options);
}

/**
 * ============================================================================
 * [헬퍼 함수] GitHub RAG 연동 기능 (Phase 1)
 * ============================================================================
 */
function fetchGitHubRaw(filePath) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "GITHUB_RAW_" + filePath.replace(/\//g, "_");

  // 1. 캐시 히트 체크 (10분 보관)
  const cached = cache.get(cacheKey);
  if (cached) {
    Logger.log(`[CACHE HIT] 깃허브 RAG 연동 캐싱 로드: ${filePath}`);
    return cached;
  }

  Logger.log(`[CACHE MISS] 깃허브 RAG API 호출: ${filePath}`);

  // 2. GitHub Raw API 호출
  // 스크립트 속성에 GITHUB_TOKEN(선택 사항)을 등록해 두면 Rate Limit가 크게 늘어납니다.
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const repo = "syn-glitch/gongdo-task-system";
  const branch = "main";
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;

  try {
    const options = { muteHttpExceptions: true };
    if (GITHUB_TOKEN) {
      options.headers = { "Authorization": `token ${GITHUB_TOKEN}` };
    }
    
    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() === 200) {
      const content = response.getContentText();
      cache.put(cacheKey, content, 600); // 10분(600초) 캐시 보관
      return content;
    } else {
      throw new Error(`HTTP ${response.getResponseCode()}`);
    }
  } catch (e) {
    Logger.log(`[ERROR] 깃허브 RAG API 통신 실패 (${filePath}): ${e.message}`);
    return `[ERROR] RAG 컨텍스트 로딩 실패: 문서를 찾을 수 없습니다. (${filePath})`;
  }
}

/**
 * ============================================================================
 * [헬퍼 함수] QA JSON 에러 카운터 파서 (Phase 2)
 * ============================================================================
 */
function parseErrorCount(claudeResponse) {
  // 1. JSON 코드 블록 정규식 파싱
  try {
    const jsonMatch = claudeResponse.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : claudeResponse;
    const result = JSON.parse(jsonStr);

    if (result.total_errors !== undefined) {
      Logger.log(`[SUCCESS] JSON 완전 파싱 성공: ${result.total_errors}개 에러`);
      return { errorCount: parseInt(result.total_errors, 10), fullResult: result };
    }
  } catch (e) {
    Logger.log(`[WARNING] JSON.parse 실패: ${e.message}`);
  }

  // 2. 정규식 백업 (Fallback)
  try {
    const patterns = [
      /total_errors["']?\s*:\s*(\d+)/,
      /에러.*?(\d+)개/,
      /(\d+)\s*errors?\s*found/i
    ];

    for (const pattern of patterns) {
      const match = claudeResponse.match(pattern);
      if (match) {
        Logger.log(`[WARNING] 정규식 백업 사용: ${match[1]}개`);
        return { errorCount: parseInt(match[1], 10), fullResult: null };
      }
    }
  } catch (e) {
    Logger.log(`[ERROR] 정규식 파싱도 실패: ${e.message}`);
  }

  // 3. 파싱 완전 실패
  Logger.log("[CRITICAL] 에러 카운트 파싱 실패 - 수동 검토 필요");
  return { errorCount: -1, fullResult: null };
}

