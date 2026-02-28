/**
 * [공도 업무 관리 - AI 에이전트 3팀 통합 Webhook]
 * 지원 팀: 자비스(PO/Dev), 김감사(QA), 강철(AX)
 * 기능: 메인 업무 등록 및 타임라인 로그(History) 기록 자동화
 */

const SPREADSHEET_ID = '1gluWChHpmWWVRxgPpteOwcebE54mH1XK7a15NRc1-kU';
const TASKS_SHEET_NAME = 'Agent_Tasks'; // 업무 메인 대시보드
const LOGS_SHEET_NAME = 'Agent_Logs';   // 로그 기록용 새 시트

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const now = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
    
    // 들어오는 JSON 파싱
    const taskId = postData.taskId || "TASK-" + Utilities.formatDate(new Date(), "GMT+9", "MMddHHmm");
    const taskName = postData.taskName || "빈 업무";
    const status = postData.status || "기획/개발 (자비스)"; // 기본 상태
    const author = postData.author || "자비스 (PO)"; // 발송 주체 (자비스, 김감사, 강철)
    const action = postData.action || "업무 등록"; // 로그용 액션 (진행, 반려, 완료 등)
    const githubUrl = postData.githubUrl || "";
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tasksSheet = spreadsheet.getSheetByName(TASKS_SHEET_NAME) || spreadsheet.getSheets()[0];
    const logsSheet = spreadsheet.getSheetByName(LOGS_SHEET_NAME);

    // 1. [업무 대시보드 갱신] 
    // 임시 로직: 기본적으로 밑에 행을 추가합니다. (나중에는 Task_ID 검사해서 있으면 상태만 업데이트(진행/완료) 하도록 고도화 가능)
    // A: Task_ID, B: 요청_내용, C: 상태, D: 담당_팀, E: 문서_링크
    tasksSheet.appendRow([taskId, taskName, status, author, githubUrl]);
    
    // 2. [로그 아카이브 갱신] (Agent_Logs 시트가 있을 경우에만)
    if (logsSheet) {
      // A: Timestamp, B: Task_ID, C: 담당_팀, D: 액션, E: 상세_메시지
      const logMessage = `문서 링크: ${githubUrl}`;
      logsSheet.appendRow([now, taskId, author, action, logMessage]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "recorded": taskName,
      "log_written": logsSheet ? true : false
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("AI 에이전트 3팀 통합 웹훅 켜짐 완료.");
}
