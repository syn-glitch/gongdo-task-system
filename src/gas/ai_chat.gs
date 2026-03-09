/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        ai_chat.gs
 * @version     v1.2.0
 * @updated     2026-03-10 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 슬랙 및 웹 대시보드(주디 사이드바) 채팅 요청 처리.
 *              사용자의 시트 데이터를 바탕으로 Claude AI와 질의응답을 수행한다.
 *
 * @change-summary
 *   AS-IS: v1.1.0 — API 호출 시 토큰 사용량 추적 없음
 *   TO-BE: v1.2.0 — callClaudeAPI() 래퍼 적용으로 토큰 사용량 자동 기록
 *
 * @features
 *   - [수정] processJudyWebChat() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *
 * ── 변경 이력 ──────────────────────────
 * v1.2.0 | 2026-03-10 | 에이다 BE | callClaudeAPI() 래퍼 적용 (BNK-2026-03-10-001)
 * v1.1.0 | 2026-03-08 | 에이다 BE | Notes_v2 RAG 연동 + 배포 헤더 추가 (QA F-2)
 * v1.0.0 | 2026-03-01 | 클로이 FE | 최초 작성 — 웹 챗봇 + 슬랙 챗봇
 * ============================================
 */

// ==========================================
// 1. 웹 앱 실시간 채팅 (주디 사이드바 전용)
// ==========================================

/**
 * 프론트엔드(`judy_workspace.html`)에서 호출하는 실시간 채팅 핸들러
 * @param {string} userQuery 사용자가 입력한 질문
 * @param {string} userName 사용자 이름 (로깅 및 캐시 키 용도)
 */
function processJudyWebChat(userQuery, userName) {
  try {
    // 1. 보안 검증: 현재 실행중인 사용자가 유효한지 확인 (앱스 스크립트 특성상 이메일 조회 가능)
    const currentUser = Session.getActiveUser().getEmail() || userName || 'Unknown';
    if (!currentUser) throw new Error("유효한 사용자 세션이 없습니다.");

    // 2. 캐시 기반의 컨텍스트 생성 (타임아웃 방지 핵심)
    const dbContext = buildUserContextForChat(currentUser, userName);

    // 3. API 키 획득 (PropertiesService 활용 - QA 보안 권고)
    let apiKey;
    try {
      apiKey = getClaudeApiKey(); // ai_briefing.gs 에 공통 선언됨
    } catch (e) {
      if (typeof CLAUDE_API_KEY !== 'undefined') apiKey = CLAUDE_API_KEY;
      else throw new Error("API 키를 찾을 수 없습니다.");
    }

    // 4. Claude API 요청 구성 (웹 사이드바용 튜닝)
    const systemPrompt = `당신은 '공도 업무 관리' 시스템의 유능한 AI 비서 '주디(🐰)'입니다.
사용자 이름: ${userName} (또는 ${currentUser})

아래 제공된 [현재 시스템 데이터 컨텍스트]를 바탕으로 사용자의 질문에 한국어로 친절하고 명쾌하게 답변하세요.
사이드바처럼 좁은 화면에서 가독성이 좋도록 Markdown(볼드, 목록형 등)을 적극 사용하고, 말풍선 대신 블록형으로 깔끔하게 작성하세요.
**가장 중요한 점**: 사용자가 특정 키워드(예: 넷마블 등)를 검색하거나 찾아달라고 할 경우, 컨텍스트에 있는 **모든 텍스트 내용**을 꼼꼼히 확인하여 단어의 일부라도 일치하는 메모나 업무가 있는지 철저히 검사해야 합니다.
사용자가 직접 작성한 **마크다운 노트**(Notes_v2)도 검색 대상에 포함됩니다. 노트 내용이 있다면 적극 활용하세요.
데이터에 정밀히 찾아본 후에도 없는 내용이라면 "현재 확인 가능한 데이터에는 없습니다"라고 거짓 없이 답변하세요.

[현재 시스템 데이터 컨텍스트]
${dbContext}`;

    const payload = {
      model: "claude-sonnet-4-20250514", 
      max_tokens: 1500, // 상세한 답변을 위해 넉넉히
      temperature: 0.3, // 정확도를 높이기 위해 약간 낮춤
      system: systemPrompt,
      messages: [{ role: "user", content: userQuery }]
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
    
    // 5. 호출 및 응답 반환 (토큰 사용량 자동 기록)
    const result = callClaudeAPI("https://api.anthropic.com/v1/messages", options, "processJudyWebChat", userName);
    
    if (result.error) {
      console.error("AI Chat Error:", result.error);
      return { success: false, response: "❌ 답변 생성 실패 (API 에러): " + result.error.message };
    }
    
    const aiResponse = result.content[0].text;
    
    // Action Log 기록 (옵션)
    try {
      if (typeof logActionV2 === 'function') {
        logActionV2({
          userId: userName,
          action: 'JUDY_CHAT_ASK',
          targetId: 'chat',
          details: "Q: " + userQuery.substring(0, 50) + "..."
        });
      }
    } catch(e) { }

    return { success: true, response: aiResponse };

  } catch (err) {
    console.error("processJudyWebChat 오류:", err);
    return { success: false, response: "⚠️ 처리 중 오류가 발생했습니다: " + err.message };
  }
}

/**
 * 활성 메모, 진행중/대기중인 업무, 오늘의 일정 데이터를 모두 모아서 하나의 텍스트 컨텍스트로 구성합니다.
 * 매번 전체를 조회하면 느리므로 CacheService를 활용하여 5분단위로 캐싱합니다.
 * @param {string} userKey 사용자 식별자 (이메일 등)
 * @param {string} userName 사용자 표시 이름 (구글 드라이브 폴더명 식별용)
 */
function buildUserContextForChat(userKey, userName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "CHAT_CONTEXT_" + userKey;
  
  // 사용자가 "찾아줘", "검색" 등의 키워드를 사용할 때를 대비해 캐시 보관 주기를 1분으로 단축하여 가급적 최신 데이터를 보도록 함
  const cachedContext = cache.get(cacheKey);
  if (cachedContext) return cachedContext;

  const ss = getTargetSpreadsheet(); // web_app.gs
  let context = "";

  // 1. 업무 데이터 수집 (Tasks)
  context += "■ [업무 데이터 (Tasks)]\n";
  try {
    const taskSheet = ss.getSheetByName("Tasks");
    const tData = taskSheet.getDataRange().getValues();
    let tCount = 0;
    for(let i=1; i<tData.length; i++) {
      const status = tData[i][2];
      if (status !== '완료' && status !== '삭제') { // 완료되지 않은 활성 업무만 
        const id=tData[i][0], proj=tData[i][3], title=tData[i][4], desc=tData[i][5], assign=tData[i][6], due=tData[i][8];
        let dStr = due;
        if(due instanceof Date) dStr = Utilities.formatDate(due, Session.getScriptTimeZone(), "yyyy-MM-dd");
        context += "- [" + status + "] " + title + " (프로젝트:" + proj + ", ID:" + id + ", 담당:" + assign + ", 마감:" + dStr + ")\n  상세: " + (desc ? String(desc).substring(0, 100).replace(/\n/g, ' ') : '없음') + "\n";
        tCount++;
      }
    }
    if (tCount === 0) context += "현재 진행/대기 중인 업무가 없습니다.\n";
  } catch(e) { context += "업무 데이터를 불러올 수 없습니다.\n"; }

  // 2. 메모 데이터 수집 (Notes)
  context += "\n■ [메모 데이터 (Notes) - 검색을 위한 최신 문서 메타데이터]\n";
  try {
    const noteSheet = ss.getSheetByName("Notes");
    const nData = noteSheet.getDataRange().getValues();
    // 헤더 제외, 최신순 정렬 (ID 기준 내림차순이라 가정)
    // AI가 더 많은 컨텍스트를 파악하도록 상위 100개까지 확보 (가급적 많은 정보 넘김)
    let notes = nData.slice(1).filter(r => r[0] && r[0].indexOf('NOTE') > -1).reverse().slice(0, 100);
    if(notes.length > 0) {
      notes.forEach(r => {
        const title=r[3], content=r[4], folder=r[2], updated=r[6];
        let uStr = updated;
        if(updated instanceof Date) uStr = Utilities.formatDate(updated, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
        // 본문 내용이 길 경우 약간 더 넉넉하게 자름
        context += "- [" + folder + "] " + title + " (수정:" + uStr + ")\n  내용: " + (content ? String(content).substring(0, 250).replace(/\n/g, ' ') : '') + "...\n";
      });
    } else {
      context += "등록된 메모가 없습니다.\n";
    }
  } catch(e) { context += "메모 데이터를 불러올 수 없습니다.\n"; }

  // 2.5 마크다운 노트 수집 (Notes_v2 - markdown_notes.gs 의 searchNotesForRAG 활용)
  context += "\n■ [마크다운 노트 (Notes_v2) - 사용자 작성 마크다운 메모]\n";
  try {
    if (typeof searchNotesForRAG === 'function' && userName) {
      var mdNotes = searchNotesForRAG(userName, "");  // 빈 쿼리 = 전체 최신 노트
      context += mdNotes + "\n";
    } else {
      context += "마크다운 노트 기능을 사용할 수 없습니다.\n";
    }
  } catch(e) { context += "마크다운 노트 데이터를 불러올 수 없습니다.\n"; }

  // 2.6 아카이브 메모 수집 (Google Drive - drive_archive.gs 의 getArchivedMemos 활용)
  context += "\n■ [과거 단위 업무 메모 및 일지 (Google Drive Archive)]\n";
  try {
    if (typeof getArchivedMemos === 'function' && userName) {
      // userName(예: "송용남")을 기반으로 구글 문서/마크다운 파싱 데이터 습득
      // 너무 길게 가져오면 타임아웃 및 토큰 한계가 있으니, 내부에서 가져온 전체 데이터를 문자열로 조합
      const archives = getArchivedMemos(userName);
      let archiveStr = "";
      if (archives && archives.length > 0) {
        let memoCount = 0;
        // 최신 월부터 순회
        for (let mIdx = 0; mIdx < archives.length; mIdx++) {
            const monthData = archives[mIdx];
            for (let dIdx = 0; dIdx < monthData.days.length; dIdx++) {
                const day = monthData.days[dIdx];
                archiveStr += `[일자: ${day.date}]\n`;
                for (let i = 0; i < day.memos.length; i++) {
                    const m = day.memos[i];
                    // 내용 텍스트 길이 약간 방어 (매우 길 경우를 대비해 300자로 컷)
                    const cleanTxt = m.content ? String(m.content).substring(0, 300).replace(/\n/g, ' ') : '';
                    archiveStr += `- [${m.time}] ${cleanTxt}...\n`;
                    memoCount++;
                    if (memoCount >= 100) break; // 최대 100개까지만 (너무 커지는 것 방지)
                }
                if (memoCount >= 100) break;
            }
            if (memoCount >= 100) break;
        }
        context += archiveStr;
      } else {
        context += "아카이브된 과거 메모가 없습니다.\n";
      }
    }
  } catch(e) { 
    context += "아카이브 데이터를 불러올 수 없습니다.\n"; 
  }

  // 3. 캘린더 일정 수집 (Calendar_Events)
  context += "\n■ [일정 데이터 (Calendar) - 현재 및 향후 일정]\n";
  try {
    const calSheet = ss.getSheetByName("Calendar_Events");
    if(calSheet) {
        const cData = calSheet.getDataRange().getValues();
        const now = new Date();
        now.setHours(0,0,0,0);
        let cCount = 0;
        
        for(let i=1; i<cData.length; i++) {
            const startD = cData[i][4]; // Start Date
            if(startD instanceof Date && startD >= now) {
                const title=cData[i][3], endD=cData[i][5], type=cData[i][2];
                let sStr = Utilities.formatDate(startD, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
                let eStr = endD instanceof Date ? Utilities.formatDate(endD, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : endD;
                context += "- [" + type + "] " + title + " (" + sStr + " ~ " + eStr + ")\n";
                cCount++;
            }
        }
        if(cCount === 0) context += "향후 등록된 일정이 없습니다.\n";
    }
  } catch(e) { context += "일정 데이터를 불러오지 않았거나 시트가 없습니다.\n"; }

  // 캐싱 (1분 = 60초 보관 - 사용자가 빠르게 연속 질문 시 방어 목적, 기존 5분은 실시간성 부족)
  cache.put(cacheKey, context, 60);

  return context;
}

// ==========================================
// 2. 슬랙 연동 챗봇 (기존)
// ==========================================

/**
 * ⚡ 동기(Sync) 처리 함수: 슬랙 사용자의 채팅(질문)을 즉시 처리합니다.
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
    model: "claude-sonnet-4-20250514", 
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
