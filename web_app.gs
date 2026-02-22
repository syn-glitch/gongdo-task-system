/**
 * [파일명]: web_app.gs
 * [기능 설명]: 데스크탑 웹 브라우저용 '주디 노트(메모장)' 인터페이스를 제공하는 백엔드 처리기.
 */

/**
 * 웹 앱 URL로 접속 시 HTML 화면을 렌더링합니다.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('judy_note');
  return template.evaluate()
    .setTitle('Judy Note (공도 주디 메모장)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 프론트엔드(judy_note.html)에서 호출하는 저장 함수
 * 기존의 drive_archive.gs 와 완벽하게 호환됩니다.
 * 
 * @param {string} userName - 작성자 이름
 * @param {string} text - 작성된 메모 텍스트
 */
function saveFromWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "내용이 없습니다." };
    
    // 이전에 만들어둔 drive_archive.gs의 appendMemoToArchive 재사용!
    // 세 번째 파라미터(userId)를 null로 주어 슬랙 DM 알림을 생략합니다 (웹앱 자체 토스트로 알림).
    const resultMsg = appendMemoToArchive(userName, text, null);
    
    return { success: true, message: resultMsg || "성공적으로 저장되었습니다." };
  } catch (err) {
    console.error("웹 오류:", err);
    return { success: false, message: err.message };
  }
}
