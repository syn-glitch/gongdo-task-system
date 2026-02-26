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
        
        // 락(Lock) 걸기: 다른 트리거가 중복으로 물어가지 않게 상태를 즉시 "개발중"으로 변경
        sheet.getRange(rowNum, 3).setValue("개발중");
        sheet.getRange(rowNum, 4).setValue("자비스");
        
        // TODO: (Phase 2 연동) 로컬에서 API/프롬프트 핑퐁 후 코드(.md/.gs) 생성 파이프라인 호출
        // 개발이 끝난 후 상태를 "QA_대기"로 넘기는 로직은 다음 Phase에서 완성됩니다.
        
      }
      
      // Case 2: QA가 디버깅을 지시한 상태 ("디버깅_필요" && 담당자 "자비스")
      else if (status === "디버깅_필요" && agent === "자비스") {
        Logger.log(`[자비스] 반려 Task 감지: ${taskId} - 디버깅 시작`);
        
        // 락(Lock) 걸기
        sheet.getRange(rowNum, 3).setValue("개발중");
        
        // TODO: (Phase 2 연동) F열(QA 문서 링크)의 불합격 사유(.md)를 읽어와서 코드 수정 후 다시 "QA_대기"로 토스
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
        
        // TODO: (Phase 2 연동) E열(개발 문서 링크)을 분석하여 버그 발견 시 "디버깅_필요", 완벽하면 "최종_승인"으로 토스
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
