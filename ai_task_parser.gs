/**
 * [파일명]: ai_task_parser.gs
 * [기능 설명]: 비정형 텍스트를 Claude API로 분석하여 정형화된 업무 배열을 추출하고 시트에 자동 등록합니다.
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
    apiKey = CLAUDE_API_KEY; // ai_report.gs에 정의된 전역 상수 사용
  } catch (e) {
    console.error("CLAUDE_API_KEY를 찾을 수 없습니다.");
    return [];
  }

  if (!apiKey || apiKey === "여기에_CLAUDE_API_KEY_입력") {
    console.error("CLAUDE_API_KEY가 올바르지 않습니다.");
    return [];
  }

  const payload = {
    // 가장 똑똑한 모델 사용하여 구문 분석 정확도 극대화
    model: "claude-3-5-sonnet-20241022",
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
    const res = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(res.getContentText());
    
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
