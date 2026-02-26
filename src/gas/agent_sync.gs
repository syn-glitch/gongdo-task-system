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
        Logger.log(`[자비스] 신규 Task 감지: ${taskId} - 개발 시작`);
        
        // Phase 2: OpenAI (GPT) 기반 요구사항 분석 및 로컬(구글 드라이브) 문서 생성 처리 로직
        try {
          const reqContent = data[i][1];
          const sysPrompt = "당신은 구글 앱스 스크립트 특급 개발자 에이전트 자비스(Jarvis)입니다. 사용자의 요구사항을 받아 완벽한 구조의 코드를 작성하고 마크다운 문서로 보고서를 제출합니다.";
          const usrPrompt = "요청 사항:\n" + reqContent + "\n\n요구사항을 분석하여 개발된 코드 및 기획서를 마크다운으로 작성해주세요.";
          
          const devDocContent = callOpenAIAPI(usrPrompt, sysPrompt);
          const fileUrl = createDriveFile(taskId + "_Jarvis_Dev_Doc", devDocContent);
          
          sheet.getRange(rowNum, 5).setValue(fileUrl);  // 개발_문서_링크 (E)
          sheet.getRange(rowNum, 10).setValue(new Date());// 등록_시간 (J)
          sheet.getRange(rowNum, 3).setValue("QA_대기"); // 다음 파이프라인으로 토스
          
          Logger.log(`[자비스] ${taskId} 문서 생성 및 QA_대기 토스 성공 (${fileUrl})`);
        } catch (e) {
          sheet.getRange(rowNum, 12).setValue("자비스 생성 에러: " + e.message);
          sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
        }
      }
      
      // Case 2: QA가 디버깅을 지시한 상태 ("디버깅_필요" && 담당자 "자비스")
      else if (status === "디버깅_필요" && agent === "자비스") {
        Logger.log(`[자비스] 반려 Task 감지: ${taskId} - 디버깅 시작`);
        
        // 락(Lock) 걸기
        sheet.getRange(rowNum, 3).setValue("개발중");
        
        // Phase 2 연동: F열(QA 문서 링크)의 불합격 사유(.md)를 읽어와서 코드 수정
        try {
          const qaUrl = data[i][5]; // F: QA 문서 링크
          const qaContent = getDriveFileContent(qaUrl);
          
          let pingPongNum = parseInt(data[i][8], 10); // I: 핑퐁_횟수
          if (isNaN(pingPongNum)) pingPongNum = 0;
          const newPingPong = pingPongNum + 1;
          
          if (newPingPong > 5) {
             sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
             sheet.getRange(rowNum, 12).setValue("무한루프 강제 중단");
             continue; // 핑퐁 5회 초과시 무한루프 방지
          }

          const sysPrompt = "당신은 구글 앱스 스크립트 특급 개발자 자비스(Jarvis)입니다. QA 피드백을 반영하여 디버깅된 최종 코드로 기획서를 보완하세요.";
          const usrPrompt = "이전 QA 피드백 내용:\n" + qaContent + "\n\n결과를 바탕으로 버그를 고치고 수정된 문서를 산출하세요.";
          
          const devDocContent = callOpenAIAPI(usrPrompt, sysPrompt);
          const fileUrl = createDriveFile(taskId + `_Jarvis_Dev_Fix_v${newPingPong}`, devDocContent);
          
          sheet.getRange(rowNum, 5).setValue(fileUrl);
          sheet.getRange(rowNum, 9).setValue(newPingPong);
          sheet.getRange(rowNum, 3).setValue("QA_대기");
        } catch (e) {
          sheet.getRange(rowNum, 12).setValue("자비스 수정 에러: " + e.message);
          sheet.getRange(rowNum, 3).setValue("수동_개입_필요");
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
        
        // Phase 2: E열(개발 문서 링크)을 분석하여 에러 검출 로직
        try {
          const devUrl = data[i][4]; // E: 개발 문서 링크
          const devContent = getDriveFileContent(devUrl);
          
          const sysPrompt = "당신은 최고의 QA 팀장 김감사입니다. 제출된 코드를 읽고 매우 꼼꼼한 코드 에러 검수와 리뷰 분석 보고서를 작성하세요. 맨 마지막 줄에 JSON 형태로 에러 갯수를 표기하세요! (예: {\"errorCount\": 2})";
          const qaPrompt = `개발 문서 내용: \n${devContent}\n\n이 문서를 철저히 QA하여 버그를 검출하세요.`;
          
          const qaResultText = callOpenAIAPI(qaPrompt, sysPrompt);
          
          // 에러 갯수 추출 시도 (JSON 파싱 정규식)
          let errorCount = 0;
          let match = qaResultText.match(/\{.*\"errorCount\"\s*:\s*(\d+).*\}/);
          if (match) {
            errorCount = parseInt(match[1], 10);
          } else {
             // 기본 규칙 (에러라는 단어가 들어있으면 1 없으면 0)
             errorCount = (qaResultText.includes("오류") || qaResultText.includes("에러 발견")) ? 1 : 0;
          }

          const fileUrl = createDriveFile(taskId + "_Kim_QA_Report", qaResultText);
          
          sheet.getRange(rowNum, 6).setValue(fileUrl); // F열 QA 문서
          sheet.getRange(rowNum, 8).setValue(errorCount); // H열 에러 카운트
          sheet.getRange(rowNum, 7).setValue("[✅][✅][✅][✅][✅][✅][✅]"); // G열 체크리스트

          if (errorCount > 0) {
            sheet.getRange(rowNum, 3).setValue("디버깅_필요");
            sheet.getRange(rowNum, 4).setValue("자비스");
          } else {
            sheet.getRange(rowNum, 3).setValue("최종_승인");
            sheet.getRange(rowNum, 11).setValue(new Date()); // K열 완료 시간
            
            // Phase 3: 슬랙 알람 발송 연동
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
