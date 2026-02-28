/**
 * [자비스 팀 ↔ 김감사 팀 협업 자동화]
 * GitHub에 새 기획서(md) 파싱 후 Google Sheet에 자동 등록하는 Webhook 엔드포인트
 */

const SPREADSHEET_ID = '1gluWChHpmWWVRxgPpteOwcebE54mH1XK7a15NRc1-kU';
const SHEET_NAME = 'Agent_Tasks'; // 팀장님 스크린샷 하단 시트 탭 이름 (매우 중요)

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // 들어오는 JSON 데이터 파싱 (값이 없으면 기본값 세팅)
    const taskId = postData.taskId || Utilities.formatDate(new Date(), "GMT+9", "yyyyMMdd-HHmmss");
    const taskName = postData.taskName || "빈 업무";
    const status = postData.status || "요청됨";
    const author = postData.author || "자비스 (PO)";
    const githubUrl = postData.githubUrl || "";

    // 1. 구글 시트 및 특정 탭(Agent_Tasks) 열기
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME) 
                  || SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

    // 2. 팀장님의 실제 시트 열(Column) 순서에 맞게 데이터 배열 생성 및 1줄 추가
    // A열: Task_ID, B열: 요청_내용, C열: 상태, D열: 담당_에이전트, E열: 개발_문서_링크
    sheet.appendRow([taskId, taskName, status, author, githubUrl]);
    
    // 3. 성공 응답
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "record": taskName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 에러 발생 시 리턴
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 브라우저에서 무심코 접속했을 때 에러를 막기 위한 라우팅
function doGet(e) {
  return ContentService.createTextOutput("웹훅이 정상적으로 켜져 있습니다.");
}
