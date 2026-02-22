/**
 * [파일명]: web_app.gs
 * [마지막 업데이트]: 2026-02-22 13:21 (KST)
 * [기능 설명]: 데스크탑 웹 브라우저용 '주디 노트(메모장)' 인터페이스를 제공하는 백엔드 처리기.
 * [최근 개편]: 저장 기능(saveFromWeb, extractFromWeb) 외에 과거 데이터 AI 요약(summarizeMemoContent) 액션이 추가되었습니다.
 */

/**
 * 웹 앱 URL로 접속 시 HTML 화면을 렌더링합니다.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('judy_note');
  
  // GAS 샌드박스 특성상 프론트엔드에서 window.location.search를 읽을 수 없으므로,
  // 백엔드에서 받은 파라미터를 HTML 템플릿 변수로 주입해줍니다.
  template.token = e.parameter.token || '';

  return template.evaluate()
    .setTitle('Judy Note (공도 주디 메모장)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * [Phase 10] 매직 링크 토큰 검증 시스템
 * 프론트엔드에서 페이지 로드 시 호출하여 토큰의 유효성을 검사하고 
 * 일회용 토큰을 즉시 파기한 후 사용자 이름을 반환합니다.
 */
function validateToken(token) {
  if (!token) {
    return { valid: false, reason: "토큰이 없습니다. 슬랙에서 다시 접속해주세요." };
  }
  
  const cache = CacheService.getScriptCache();
  const userName = cache.get("MAGIC_" + token);
  
  if (userName) {
    // 보안을 위해 일회용 토큰 즉시 파기!
    cache.remove("MAGIC_" + token);
    return { valid: true, name: userName };
  } else {
    // 캐시에 없거나, 만료되었거나, 이미 사용됨
    return { valid: false, reason: "접근 권한이 없거나 이미 만료/사용된 링크입니다.<br>슬랙에서 '/주디 노트' 명령어로 다시 발급받아주세요." };
  }
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

/**
 * 프론트엔드에서 '✨ AI 업무 추출 및 저장' 버튼을 눌렀을 때 호출되는 함수
 */
function extractFromWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "내용이 없습니다." };
    
    // 1. 구글 드라이브 아카이브에 영구 저장 (백업)
    appendMemoToArchive(userName, text, null);
    
    // 2. AI 분석기를 돌려서 Tasks 시트에 스마트하게 꽂아버림
    const summaryMsg = parseAndCreateTasks(text, userName);
    
    return { success: true, message: summaryMsg };
  } catch (err) {
    console.error("AI 파싱 웹 오류:", err);
    return { success: false, message: err.message };
  }
}

/**
 * 프론트엔드에서 '✨ AI 내용 요약' 버튼 클릭 시 호출
 * 특정 메모 텍스트를 대상 모델(Claude)로 요약하여 반환
 */
function summarizeMemoContent(text, userName) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "요약할 내용이 없습니다." };
    
    let apiKey = "";
    try {
      // ai_report.gs 등에 글로벌 선언된 키 재사용
      apiKey = CLAUDE_API_KEY; 
    } catch(e) {}
    
    if(!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다."};
    
    const systemPrompt = `당신은 핵심을 짚어내는 요약 비서입니다. 작성자(${userName})의 업무일지 내용을 읽고, 1~3줄 이내의 간결하고 명확한 요약본을 작성하세요. 불필요한 인사말 없이 요약 결과만 마크다운을 곁들여 예쁘게 출력하세요.`;
    
    const payload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: text }]
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
    
    const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    const json = JSON.parse(res.getContentText());
    
    if (json.content && json.content.length > 0) {
      return { success: true, summary: json.content[0].text.trim() };
    } else {
      return { success: false, message: "AI가 알 수 없는 응답을 반환했습니다." };
    }
  } catch(e) {
    console.error("AI 요약 웹 오류:", e);
    return { success: false, message: e.message };
  }
}
