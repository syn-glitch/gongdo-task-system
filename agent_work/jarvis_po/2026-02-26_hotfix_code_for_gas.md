# [핫픽스 복사/붙여넣기 전용 코드] 주디 드래그 & AI 업무 추출

팀장님, 구글 앱스 스크립트(GAS) 편집기 화면에서 바로 복사하여 붙여넣으실 수 있도록 이 문서에 최종 코드를 정리했습니다.

아래 **1번**, **2번** 가이드라인에 따라 코드를 복사해서 덮어씌워 주신 후, 우측 상단의 **[배포] -> [새 배포]**를 눌러주시면 모든 에러가 완벽히 해결됩니다.

---

## 1. 백엔드 코드 추가 (`ai_task_parser.gs` 파일)

GAS 편집기에서 좌측 메뉴 중 `ai_task_parser.gs` 파일을 클릭하세요.
파일 내용의 **가장 맨 아래쪽 바닥(빈 공간)**에 커서를 두고, 아래의 코드를 **모두 복사해서 그대로 붙여넣기** 하세요.

```javascript
/**
 * 프론트엔드에서 플로팅 버튼(주디 에이전트 분석)을 눌렀을 때 호출되는 함수
 * 텍스트를 Claude API로 추출/분석하여 새 업무 등록 폼 모달에 Pre-fill 할 JSON 객체 반환
 */
function parseTaskFromMemoWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "분석할 내용이 없습니다." };
    
    // API Key 보안 로드
    let apiKey = "";
    try { apiKey = CLAUDE_API_KEY; } catch(e) {}
    if (!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다." };

    // 기준 날짜 주입을 위한 오늘 스트링 (상대 기한 추론용)
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd (E)");

    // 프롬프트 작성 체계 고도화
    const systemPrompt = `당신은 업무 내용을 분석하고 추출하는 일급 비서입니다. 사용자(${userName})의 회의록이나 메모를 바탕으로 새로운 업무 카드 내용을 구성하세요.

⚠️ 핵심 규칙:
- 선택한 메모에 여러 가지 작업이 있더라도, 가장 중요한 업무 1건으로 통합 요약하여 반드시 **오직 단 하나의 JSON 객체**만 응답하세요.
- 절대로 JSON 배열(Array)이나 2개 이상의 객체를 출력하지 마세요.
- 인사말, 마크다운 백틱(\`\`\`)을 일절 제외한 순수 JSON 문자열만 출력해야 합니다.
- 오늘 날짜는 ${todayStr} 입니다. '내일', '다음주' 같은 기한은 이 날짜를 기준으로 YYYY-MM-DD 포맷을 계산하세요.

출력 JSON 포맷 예시:
{
  "title": "업무 제목 (20자 이내 명확하게)",
  "desc": "업무 상세 내용을 3~4줄로 명확하게 요약 (마크다운 지원)",
  "due": "메모상 기한 명시된 경우 YYYY-MM-DD (불확실하면 빈 문자열 '')"
}`;

    const payload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
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
      const resultText = json.content[0].text.trim();
      let parsedData = {};
      
      try {
        // AI가 마크다운 코드 블록(```json 등)으로 감싸 응답한 경우를 100% 제거
        let cleaned = resultText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        let depth = 0, start = -1, end = -1;
        // JSON 객체의 가장 바깥쪽 브라켓 추출
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
          else if (cleaned[i] === '}') { depth--; if (depth === 0 && start >= 0) { end = i; break; } }
        }
        if (start >= 0 && end > start) {
          parsedData = JSON.parse(cleaned.substring(start, end + 1));
        } else {
          return { success: false, message: "AI 응답에서 JSON 구조를 식별할 수 없습니다." };
        }
      } catch (parseErr) {
        return { success: false, message: "JSON 파싱 실패: " + parseErr.message };
      }
      return { success: true, data: parsedData, message: "업무 정보 디코드 완료" };
    } else {
      let errMsg = json.error ? json.error.message : "알 수 없는 API 에러 발생";
      return { success: false, message: "API 통신 오류: " + errMsg };
    }

  } catch (err) {
    console.error("AI 파싱 프리필 오류 (parseTaskFromMemoWeb):", err);
    return { success: false, message: err.message };
  }
}

/**
 * 프론트엔드에서 '✨ AI 내용 요약' 버튼 클릭 시 호출
 * 특정 메모 텍스트를 요약해 반환합니다.
 */
function summarizeMemoContent(text, userName) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "요약할 내용이 없습니다." };
    
    let apiKey = "";
    try { apiKey = CLAUDE_API_KEY; } catch(e) {}
    if (!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다." };
    
    const systemPrompt = `당신은 핵심을 짚어내는 요약 비서입니다. 작성자(${userName})의 업무일지 내용을 읽고, 1~3줄 이내의 간결하고 명확한 요약본을 작성하세요. 불필요한 인사말 없이 요약 결과만 마크다운 단락 형식으로 예쁘게 출력하세요.`;
    
    const payload = {
      model: "claude-sonnet-4-20250514",
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
      let errMsg = json.error ? json.error.message : "알 수 없는 응답";
      return { success: false, message: errMsg };
    }
  } catch (err) {
    console.error("AI 노트 요약 에러 (summarizeMemoContent):", err);
    return { success: false, message: err.message };
  }
}
```

---

## 2. 프론트엔드 코드 수정 (`judy_workspace.html` 파일)

GAS 편집기 측면 메뉴에서 `judy_workspace.html` 파일을 클릭하세요.
코드 안쪽에서 단축키 (Ctrl+F 혹은 Cmd+F)로 `btnAddTask.addEventListener`를 검색합니다.
기존 내용 부분(약 2876 번 줄 언저리)을 **아래 코드로 통째로 변경(덮어쓰기)**해 주시면 드래그 텍스트 유실 현상이 해결됩니다.

```javascript
            // --- 👇 여기서부터 드래그 및 복사하여 기존 부분과 교체 ---
            btnAddTask.addEventListener('mousedown', (e) => {
                // 클릭 시 포커스 이동으로 인한 텍스트 선택(Selection) 해제 방지
                e.preventDefault();
            });

            btnAddTask.addEventListener('click', () => {
                const selection = window.getSelection();
                let selectedText = selection.toString().trim();
                
                // 에디터(textarea) 내부의 텍스트가 선택된 경우 보정
                if (!selectedText && document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
                    const ta = document.activeElement;
                    if (ta.selectionStart !== ta.selectionEnd) {
                        selectedText = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim();
                    }
                }

                if (selectedText.length >= 2) {
                    // 선택된 텍스트가 있다면 해당 텍스트를 제목으로 채움
                    openRegModal({ title: selectedText });
                    return;
                }

                // 선택된 텍스트가 없다면 전체 메모 내용을 기본 제목으로 사용
                let cleanContent = currentContent;
                if (cleanContent.startsWith('~~') && cleanContent.endsWith('~~')) {
                    cleanContent = cleanContent.substring(2, cleanContent.length - 2);
                }
                openRegModal({ title: cleanContent });
            });
            // --- 👆 여기까지만 교체 ---
```
