/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        ai_task_parser.gs
 * @version     v1.2.0
 * @updated     2026-03-10 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 비정형 텍스트를 Claude API로 분석하여 정형화된 업무 배열을 추출하고 시트에 자동 등록합니다.
 *
 * @change-summary
 *   AS-IS: v1.1.0 — API 호출 시 토큰 사용량 추적 없음
 *   TO-BE: v1.2.0 — callClaudeAPI() 래퍼 적용으로 토큰 사용량 자동 기록 (5곳)
 *
 * @features
 *   - [수정] extractTasksWithClaude() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *   - [수정] parseTaskFromMemoWeb() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *   - [수정] summarizeMemoContent() — UrlFetchApp.fetch → callClaudeAPI() 래퍼 적용
 *   - [수정] summarizeLongText() — 청크 요약 + 최종 통합 요약 래퍼 적용 (3곳)
 *
 * ── 변경 이력 ──────────────────────────
 * v1.2.0 | 2026-03-10 | 에이다 BE | callClaudeAPI() 래퍼 적용 5곳 (BNK-2026-03-10-001)
 * v1.1.0 | 2026-03-09 | 에이다 BE | API 키 로딩을 getClaudeApiKey()로 통일 (김감사 QA CRITICAL 해소)
 * v1.0.0 | 2026-03-01 | 에이다 BE | 최초 작성 — AI 업무 추출 및 메모 요약
 * ============================================
 */

function parseAndCreateTasks(text, userName) {
  // 1. Claude API로 텍스트 내 업무 추출 요청
  const tasksJson = extractTasksWithClaude(text, userName);
  
  if (!tasksJson || tasksJson.length === 0) {
    return "✅ 아카이브 저장 완료!\n(AI 분석 결과: 시트에 등록할 만한 새로운 구체적 업무가 없습니다.)";
  }

  // 2. 추출된 업무별로 엑셀 (Tasks 시트) 최하단에 등록
  let successCount = 0;
  let summaryLines = [];
  
  for (let i = 0; i < tasksJson.length; i++) {
    const task = tasksJson[i];
    // task: { title: "...", dueDate: "YYYY-MM-DD", project: "...", assignee: "..." }
    if (!task.title) continue;
    
    // 모달 등록 시 사용하는 공통 함수(slack_command.gs) 재사용
    // appendTaskToSheet(project, taskTitle, description, dueDate, assigneeId, triggerId)
    // * assigneeId 해결:
    const assigneeName = task.assignee || userName;
    let assigneeId = "U02S3CN9E6R"; // 기본 송용남
    
    if (assigneeName.includes("이지은")) assigneeId = "U02SK29UVRP";
    else if (assigneeName.includes("김개발")) assigneeId = "U03QJP45NKH";
    else if (assigneeName.includes(userName)) {
       // 본인이름이면
       if (userName === "송용남") assigneeId = "U02S3CN9E6R";
       if (userName === "이지은") assigneeId = "U02SK29UVRP";
       if (userName === "김개발") assigneeId = "U03QJP45NKH";
    }

    // 프로젝트 파싱: (기본값 설정 시트나 로직에 따라 매핑. 일단 텍스트 그대로 삽입)
    const project = task.project || "공동 업무";
    const desc = "[🤖 주디 AI 자동 추출 업무]\n원본 메모 발췌본입니다.";
    const dueDate = task.dueDate || "";

    try {
      // 이 함수 내부에서 슬랙 DM 알림까지 자동으로 전송됨!
      appendTaskToSheet(project, task.title, desc, dueDate, assigneeId, "AI_EXTRACTOR");
      successCount++;
      summaryLines.push(`- [${project}] ${task.title} (담당: ${assigneeName})`);
    } catch (e) {
      console.error("업무 행 추가 실패", e);
    }
  }

  if (successCount === 0) {
    return "✅ 아카이브 저장 완료!\n(AI 분석 결과: 추출 중 에러가 발생하여 업무가 등록되지 않았습니다.)";
  }

  return `✨ 저장 및 AI 업무 추출 완료!\n총 ${successCount}건의 업무가 엑셀 시트(Tasks)에 자동 등록되었습니다:\n` + summaryLines.join("\n");
}

function extractTasksWithClaude(text, userName) {
  const url = "https://api.anthropic.com/v1/messages";
  
  const systemPrompt = `당신은 업무 일정 및 메모를 분석하는 꼼꼼하고 완벽한 비서입니다.
사용자(작성자: ${userName})가 입력한 비정형 텍스트에서 '수행해야 할 구체적인 업무(Task)'를 추출하세요.

[출력 규칙]
1. 반드시 순수 JSON 배열 포맷으로만 응답해야 합니다. 다른 사족이나 마크다운 백틱(\`\`\`)을 일절 포함하지 마세요.
2. 각 업무 객체의 key는 다음과 같습니다:
   - "title": 업무의 제목 (간결하게 요약할 것)
   - "dueDate": 마감일 (YYYY-MM-DD 형식. 텍스트에 내일, 수요일 등으로 언급되어 있으면 추론할 것. 언급이 없으면 빈 문자열 "")
   - "project": 연관된 프로젝트명 (언급이 없으면 빈 문자열 "")
   - "assignee": 담당자 이름 (텍스트에서 담당자를 유추할 것. 모호하거나 자신인 것 같으면 작성자인 "${userName}"으로 간주)
3. 만약 텍스트에 뚜렷한 '업무/할일' 뉘앙스가 1도 없고 단순 일상 기록이나 정보성 메모라면, 반드시 빈 배열 [] 를 응답하세요.

[예시 응답]
[
  {
    "title": "넷마블 월요일 제출자료 확인",
    "dueDate": "2026-02-23",
    "project": "넷마블",
    "assignee": "송용남"
  },
  {
    "title": "서버 연장 결제 처리",
    "dueDate": "",
    "project": "내부 시스템",
    "assignee": "김개발"
  }
]
`;

  let apiKey = "";
  try {
    apiKey = getClaudeApiKey(); // ai_briefing.gs의 공통 헬퍼 사용 (PropertiesService 기반)
  } catch (e) {
    console.error("CLAUDE_API_KEY를 찾을 수 없습니다:", e.message);
    return [];
  }

  if (!apiKey) {
    console.error("CLAUDE_API_KEY가 올바르지 않습니다.");
    return [];
  }

  const payload = {
    // 가장 똑똑한 모델 사용하여 구문 분석 정확도 극대화
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: systemPrompt,
    messages: [
      { role: "user", content: text }
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
    const json = callClaudeAPI(url, options, "extractTasksWithClaude", userName);

    if (json.content && json.content.length > 0) {
      const rawText = json.content[0].text.trim();
      // 혹시라도 AI가 ```json 을 붙여서 응답할 경우를 대비하여 방어 코드
      const cleanText = rawText.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
      return JSON.parse(cleanText);
    }
  } catch (e) {
    console.error("Claude API JSON 파싱 실패:", e);
  }
  return [];
}

/**
 * 프론트엔드에서 플로팅 버튼(주디 에이전트 분석)을 눌렀을 때 호출되는 함수
 * 텍스트를 Claude API로 추출/분석하여 새 업무 등록 폼 모달에 Pre-fill 할 JSON 객체 반환
 */
function parseTaskFromMemoWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "분석할 내용이 없습니다." };
    
    // API Key 보안 로드 (ai_briefing.gs의 공통 헬퍼 사용)
    let apiKey = "";
    try { apiKey = getClaudeApiKey(); } catch(e) {}
    if (!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다." };

    // 기준 날짜 주입을 위한 오늘 스트링 (상대 기한 추론용)
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd (E)");

    // 프롬프트 작성 체계 고도화
    const systemPrompt = `당신은 업무 내용을 분석하고 추출하는 일급 비서입니다. 사용자(\${userName})의 회의록이나 메모를 바탕으로 새로운 업무 카드 내용을 구성하세요.

⚠️ 핵심 규칙:
- 선택한 메모에 여러 가지 작업이 있더라도, 가장 중요한 업무 1건으로 통합 요약하여 반드시 **오직 단 하나의 JSON 객체**만 응답하세요.
- 절대로 JSON 배열(Array)이나 2개 이상의 객체를 출력하지 마세요.
- 인사말, 마크다운 백틱(\`\`\`)을 일절 제외한 순수 JSON 문자열만 출력해야 합니다.
- 오늘 날짜는 \${todayStr} 입니다. '내일', '다음주' 같은 기한은 이 날짜를 기준으로 YYYY-MM-DD 포맷을 계산하세요.

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
    
    const json = callClaudeAPI("https://api.anthropic.com/v1/messages", options, "parseTaskFromMemoWeb", userName);

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
 * [Phase 24 Refactoring] 장문 텍스트 청크 분할 처리 추가
 */
function summarizeMemoContent(text, userName) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "요약할 내용이 없습니다." };

    let apiKey = "";
    try { apiKey = getClaudeApiKey(); } catch(e) {}
    if (!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다." };

    // [Phase 24 Refactoring] 장문 텍스트 처리
    const CHUNK_SIZE = 4000; // 4000자 기준 청크 분할

    if (text.length > CHUNK_SIZE) {
      // 장문인 경우: 청크 분할 → 각각 요약 → 통합 요약
      return summarizeLongText(text, userName, apiKey);
    }

    // 단문인 경우: 기존 로직
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

    const json = callClaudeAPI("https://api.anthropic.com/v1/messages", options, "summarizeMemoContent", userName);

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

/**
 * [Phase 24 Refactoring] 장문 텍스트 청크 분할 요약
 * 1. 4000자씩 청크 분할
 * 2. 각 청크 개별 요약
 * 3. 최종 통합 요약
 */
function summarizeLongText(text, userName, apiKey) {
  const CHUNK_SIZE = 4000;
  const chunks = [];

  // 1. 문장 단위로 청크 분할 (문장 중간에 끊기지 않도록)
  let currentChunk = "";
  const sentences = text.split(/([.!?]\s+)/); // 문장 구분자 포함하여 분할

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if ((currentChunk + sentence).length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // 2. 각 청크 개별 요약
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const systemPrompt = `당신은 핵심을 짚어내는 요약 비서입니다. 작성자(${userName})의 업무일지 일부를 읽고, 2~3줄로 간결하게 요약하세요. (Part ${i+1}/${chunks.length})`;

    const payload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: chunks[i] }]
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
      const json = callClaudeAPI("https://api.anthropic.com/v1/messages", options, "summarizeLongText_chunk", userName);
      if (json.content && json.content.length > 0) {
        chunkSummaries.push(json.content[0].text.trim());
      }
    } catch (e) {
      Logger.log("청크 요약 실패 (Part " + (i+1) + "): " + e.message);
    }

    // API Rate Limit 방지를 위한 짧은 딜레이
    if (i < chunks.length - 1) Utilities.sleep(500);
  }

  // 3. 최종 통합 요약
  if (chunkSummaries.length === 0) {
    return { success: false, message: "청크 요약 실패" };
  }

  const combinedSummary = chunkSummaries.join("\n\n");
  const finalSystemPrompt = `다음은 긴 문서를 여러 부분으로 나누어 요약한 결과입니다. 이 요약들을 종합하여 전체 문서의 핵심을 3~4줄로 통합 요약하세요.`;

  const finalPayload = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    temperature: 0,
    system: finalSystemPrompt,
    messages: [{ role: "user", content: combinedSummary }]
  };

  const finalOptions = {
    method: "post",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    payload: JSON.stringify(finalPayload),
    muteHttpExceptions: true
  };

  try {
    const json = callClaudeAPI("https://api.anthropic.com/v1/messages", finalOptions, "summarizeLongText_merge", userName);
    if (json.content && json.content.length > 0) {
      return {
        success: true,
        summary: "📊 **장문 요약 (총 " + chunks.length + "개 청크 분석)**\n\n" + json.content[0].text.trim()
      };
    }
  } catch (e) {
    Logger.log("최종 통합 요약 실패: " + e.message);
  }

  return { success: false, message: "최종 요약 생성 실패" };
}
