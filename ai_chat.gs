/**
 * [파일명]: ai_chat.gs
 * [기능 설명]: 슬랙 이벤트(DM, 멘션) 수신 시 백그라운드에서 실행되어 
 *             시트 데이터를 바탕으로 Claude AI에게 질의하고 슬랙으로 응답합니다.
 */

/**
 * ⚡ 동기(Sync) 처리 함수: 사용자의 채팅(질문)을 즉시 처리합니다.
 * slack_command.gs 의 doPost() 에서 캐시 검문소를 통과한 뒤 바로 호출됩니다.
 */
function processAiChatSync(event, ssId) {
  try {
    // AI 답변을 위해 시트 데이터 수집
    const ss = SpreadsheetApp.openById(ssId);
    const taskSheet = ss.getSheetByName("Tasks");
    const sheetData = taskSheet.getDataRange().getValues();
    
    let dbContext = "📋 [현재 공도 업무 관리 데이터베이스 요약]\n";
    // 헤더(1행) 제외하고 순회
    for(let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const id = row[0];
        const type = row[1];
        const status = row[2];
        const project = row[3];
        const title = row[4];
        const assignee = row[6];
        const dueDate = row[8];
        
        if(!id || !title) continue; // 빈 줄 건너뛰기
        
        let dateStr = "미지정";
        if (dueDate instanceof Date) {
        const yyyy = dueDate.getFullYear();
        const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dueDate.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
        } else if (dueDate) {
        dateStr = dueDate;
        }
        
        dbContext += `- ID:${id} | 상태:${status} | 프로젝트:${project} | 제목:${title} | 담당:${assignee} | 마감일:${dateStr}\n`;
    }
    
    // 데이터가 너무 커지는 것을 방지하기 위해 일정 길이 이상이면 자르기 (옵션)
    if (dbContext.length > 5000) {
        dbContext = dbContext.substring(0, 5000) + "\n... (데이터가 길어 생략됨)";
    }
    
    // 3. Claude API 호출
    const rawText = event.text || (event.message && event.message.text) || "";
    const userQuery = rawText.replace(/<@[A-Z0-9]+>/g, "").trim(); // 멘션 태그 제거
    const aiResponse = askClaudeForChat(dbContext, userQuery);
    
    // 4. 슬랙으로 답변 전송 (slack_notification.gs 의 sendSlackMessage 사용)
    if (typeof sendSlackMessage === 'function') {
        // 채널 ID(혹은 DM ID)로 응답 전송
        sendSlackMessage(event.channel, `🤖 *주디의 답변:*\n\n${aiResponse}`);
    } else {
        console.error("sendSlackMessage 함수를 찾을 수 없습니다.");
    }
    
  } catch (err) {
    console.error("AI 채팅 처리 중 에러 발생: ", err);
    if (event.channel && typeof sendSlackMessage === 'function') {
        sendSlackMessage(event.channel, `⚠️ 죄송합니다. 데이터 분석 중 에러가 발생했습니다: ${err.message}`);
    }
  }
}

/**
 * 사용자 질의응답용 Claude 호출 함수
 */
function askClaudeForChat(dbContext, userQuery) {
  // ai_report.gs 에 선언된 변수를 가져옵니다. (동일 프로젝트 내 전역변수로 공유됨)
  let apiKey = "";
  try {
    apiKey = CLAUDE_API_KEY; 
  } catch (e) {
    return "⚠️ Claude API 키가 ai_report.gs 파일에 올바르게 설정되어 있는지 확인해주세요.";
  }

  const url = "https://api.anthropic.com/v1/messages";
  
  const systemPrompt = `당신은 팀의 유능한 프로젝트 관리 비서 '주디'입니다.
주어진 구글 시트 데이터베이스 정보를 바탕으로 사용자의 질문에 한국어로 친절하고 명쾌하게 답변하세요.
슬랙 마크다운 기호를 적극 활용하여 가독성을 높여주세요. 데이터에 없는 내용은 '데이터에 없습니다'라고 솔직히 말해야 합니다.

${dbContext}
`;
  
  const payload = {
    model: "claude-3-haiku-20240307", 
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      { role: "user", content: userQuery }
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
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.error) {
       return `❌ 답변 생성 실패 (API 에러): ${result.error.message}`;
    }
    return result.content[0].text;
  } catch (e) {
    return `❌ API 호출 오류: ${e.message}`;
  }
}
