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
  const template = HtmlService.createTemplateFromFile('judy_workspace');
  
  // 파라미터로 넘어온 값들을 모두 템플릿에 전달
  template.initialPage = e.parameter.page || 'tasks'; // 기본 탭: 업무(tasks) 또는 노트(note)
  template.userId = e.parameter.user || '';
  template.userName = e.parameter.name || '';
  template.token = e.parameter.token || '';
  
  return template.evaluate()
    .setTitle('Judy Workspace (통합 업무관리)')
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
 * [Phase 4] 노트 모듈에서 '✨ AI 업무 추출' 버튼 클릭 시 호출 (개편)
 * 텍스트를 Claude API로 요약/분석하여 새 업무 등록 모달에 Pre-fill 할 JSON 객체 반환
 */
function parseTaskFromMemoWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "분석할 내용이 없습니다." };
    
    // 1. 구글 드라이브 아카이브에 영구 저장 (백업은 기존처럼 실시)
    appendMemoToArchive(userName, text, null);
    
    let apiKey = "";
    try {
      apiKey = CLAUDE_API_KEY; // 전역 설정된 키 스코프에서 사용
    } catch(e) {}
    
    if(!apiKey) return { success: false, message: "CLAUDE API키 설정이 없습니다."};

    // 오늘 날짜 주입 (상대적 기한 추론용)
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd (E)");

    const systemPrompt = `당신은 업무 내용을 분석하고 추출하는 일급 비서입니다. 사용자(${userName})의 회의록이나 메모를 바탕으로 새로운 업무 카드 내용을 구성하세요.

⚠️ 핵심 규칙:
- 메모에 여러 가지 업무가 있더라도, 가장 중요한 업무 1건으로 통합 요약하여 반드시 **JSON 1개만** 응답하세요.
- 절대로 JSON을 2개 이상 출력하지 마세요.
- 인사말, 설명, 마크다운 백틱 없이 오직 순수 JSON만 출력하세요.
- 오늘 날짜: ${todayStr}

출력 포맷:
{
  "title": "업무 제목 (20자 이내 명확하게)",
  "desc": "업무 상세 내용을 3~4줄로 명확하게 요약 (마크다운 사용 가능)",
  "due": "메모상에 기한이 명시되어 있다면 YYYY-MM-DD (오늘 날짜 기준으로 추론. 불확실하면 빈 문자열 '')"
}`;

    // Messages API v1 스펙: system은 top-level 파라미터로 필수 배치 (messages 배열 밖)
    const payload = {
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 600,
      "temperature": 0,
      "system": systemPrompt,
      "messages": [
        {"role": "user", "content": text}
      ]
    };
    
    const options = {
      "method": "post",
      "headers": {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    const json = JSON.parse(res.getContentText());
    
    if (json.content && json.content.length > 0) {
      const resultText = json.content[0].text.trim();
      let parsedData = {};
      
      // 견고한 JSON 추출: 첫 번째 { ... } 완전한 블록만 안전하게 꺼냄
      try {
        // 첫 번째 JSON 객체만 찾아 추출 (멀티 JSON 응답 안전 처리)
        let cleaned = resultText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        let depth = 0, start = -1, end = -1;
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
          else if (cleaned[i] === '}') { depth--; if (depth === 0 && start >= 0) { end = i; break; } }
        }
        if (start >= 0 && end > start) {
          parsedData = JSON.parse(cleaned.substring(start, end + 1));
        } else {
          return { success: false, message: "AI 응답에서 JSON을 찾을 수 없습니다." };
        }
      } catch (parseErr) {
        return { success: false, message: "JSON 파싱 실패: " + parseErr.message };
      }
      return { success: true, data: parsedData, message: "업무 추출 성공" };
    } else {
      let errMsg = json.error ? json.error.message : JSON.stringify(json);
      return { success: false, message: "API 오류: " + errMsg };
    }

  } catch (err) {
    console.error("AI 파싱 프리필 오류:", err);
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
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 500,
      "temperature": 0,
      "system": systemPrompt,
      "messages": [
        {"role": "user", "content": text}
      ]
    };
    
    const options = {
      "method": "post",
      "headers": {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    const json = JSON.parse(res.getContentText());
    
    if (json.content && json.content.length > 0) {
      return { success: true, summary: json.content[0].text.trim() };
    } else {
      let errMsg = json.error ? json.error.message : JSON.stringify(json);
      return { success: false, message: "API 오류: " + errMsg };
    }
  } catch(e) {
    console.error("AI 요약 웹 오류:", e);
    return { success: false, message: e.message };
  }
}

/**
 * [Phase 23] 모든 업무 데이터 반환 (팀 단위 레이아웃용)
 * CacheService를 사용하여 5분간 데이터를 캐싱합니다.
 */
function getAllTasksForWeb(userId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "ALL_TASKS_CACHE";
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      console.error("캐시 파싱 오류:", e);
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Tasks");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allTasks = [];
  
  for (let i = 1; i < data.length; i++) {
    const rowId    = data[i][0];
    const status   = String(data[i][2]).trim();
    const project  = String(data[i][3]).trim();
    const title    = String(data[i][4]).trim();
    const desc     = String(data[i][5] || "").trim();
    const assignee = String(data[i][6]).trim();
    const requester= String(data[i][7] || "").trim();
    const rawDue   = data[i][8];
    const startTime   = data[i][14];
    const durationMin = data[i][16];
    
    if (!title) continue;
    
    let dueDate = "";
    let rawDueStr = ""; 
    let dDays = null;
    if (rawDue) {
      const d = new Date(rawDue);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        dDays = Math.round((d - today) / 86400000);
        dueDate = (d.getMonth() + 1) + "/" + d.getDate();
        
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        rawDueStr = `${yyyy}-${mm}-${dd}`;
      }
    }
    
    allTasks.push({ 
      row: i + 1, id: rowId, title, project, status, dueDate, rawDueStr, desc, dDays, assignee, requester,
      startTime: startTime instanceof Date ? startTime.getTime() : null,
      durationMin: !isNaN(parseFloat(durationMin)) ? parseFloat(durationMin) : null
    });
  }
  
  // 마감일순 정렬 (미지정은 뒤로)
  allTasks.sort((a, b) => {
    const aPri = a.dDays !== null ? a.dDays : 9999;
    const bPri = b.dDays !== null ? b.dDays : 9999;
    return aPri - bPri;
  });
  
  // 5분(300초) 캐싱
  cache.put(cacheKey, JSON.stringify(allTasks), 300);
  
  return allTasks;
}

/**
 * [20단계] 업무 대시보드 웹 페이지용 — 내 업무 데이터 반환 (필터링 버전)
 */
function getMyTasksForWeb(userId) {
  const userName = fetchUserName(userId);
  const allTasks = getAllTasksForWeb(userId);
  
  // userId에서 슬랙 username 추출 (dict에서 역매핑)
  const dict = {
    "U02S3CN9E6R": "syn", "U08SJ3SJQ9W": "jieun",
    "U02SK29URP": "hyerim", "U0749G2SNBE": "yuna",
    "U04JL09C6DV": "sangho", "U02S3EURC21": "kwansu"
  };
  const slackUsername = dict[userId] || "";
  
  return allTasks.filter(t => t.assignee === userName || t.assignee === slackUsername);
}

/**
 * [Phase 23] 웹 페이지에서 상태 변경 (LockService 적용)
 */
function changeTaskStatusFromWeb(rowNum, newStatus, userName) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000); // 10초 대기
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    if (!sheet || isNaN(rowNum)) return { success: false, message: "시트를 찾을 수 없습니다." };
    
    const oldStatus = sheet.getRange(rowNum, 3).getValue();
    const now = new Date();
    sheet.getRange(rowNum, 3).setValue(newStatus);   // C: 상태
    sheet.getRange(rowNum, 14).setValue(now);        // N: 최근 수정일
    
    // 타임 트래킹 로직
    if (newStatus === "진행중") {
      sheet.getRange(rowNum, 15).setValue(now);
    } else if (newStatus === "완료") {
      sheet.getRange(rowNum, 16).setValue(now);
      const startTime = sheet.getRange(rowNum, 15).getValue();
      if (startTime && startTime instanceof Date) {
        const diffMs = now - startTime;
        const diffMin = Math.floor(diffMs / (1000 * 60));
        sheet.getRange(rowNum, 17).setValue(diffMin);
      }
    }
    
    // 캐시 파기
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    
    // 캘린더 동기화 트리거
    if (typeof syncCalendarEvent === "function") {
      syncCalendarEvent(sheet, rowNum);
    }
    
    // 액션 로그 기록
    logAction(userName || "Unknown", "Status Change", sheet.getRange(rowNum, 1).getValue(), oldStatus, newStatus);
    
    return { success: true };
  } catch (err) {
    console.error("상태 변경 오류:", err);
    return { success: false, message: err.message === "주어진 기간 내에 Lock을 획득하지 못했습니다." ? "ERR_LOCK_TIMEOUT" : err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * [Phase 23] 웹 페이지에서 마감일 변경 (캘린더 드래그 앤 드롭용)
 */
function changeTaskDueDateFromWeb(rowNum, newDueDate, userName) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    if (!sheet || isNaN(rowNum)) return { success: false, message: "시트를 찾을 수 없습니다." };
    
    const oldDueDate = sheet.getRange(rowNum, 9).getValue();
    const now = new Date();
    
    sheet.getRange(rowNum, 9).setValue(newDueDate ? new Date(newDueDate) : ""); // I: 마감일
    sheet.getRange(rowNum, 14).setValue(now); // N: 최근 수정일
    
    // 캐시 파기
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    
    // 캘린더 동기화 트리거
    if (typeof syncCalendarEvent === "function") {
      syncCalendarEvent(sheet, rowNum);
    }
    
    // 액션 로그 기록
    logAction(userName || "Unknown", "DueDate Change", sheet.getRange(rowNum, 1).getValue(), oldDueDate, newDueDate);
    
    return { success: true };
  } catch (err) {
    console.error("마감일 변경 오류:", err);
    return { success: false, message: err.message === "주어진 기간 내에 Lock을 획득하지 못했습니다." ? "ERR_LOCK_TIMEOUT" : err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * [추가] 웹 대시보드에서 업무 수정 (LockService 적용)
 */
function updateTaskFromWeb(rowNum, title, desc, dueDate, status, userName) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    
    const props = PropertiesService.getScriptProperties();
    const ssId = props.getProperty("STORED_SS_ID");
    if (!ssId) return { success: false, message: "시트 ID가 저장되지 않았습니다." };
    
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName("Tasks");
    if (!sheet || isNaN(rowNum)) return { success: false, message: "Tasks 시트를 찾을 수 없거나 데이터 위치 오류입니다." };

    const oldValues = sheet.getRange(rowNum, 1, 1, 9).getValues()[0];
    const now = new Date();

    sheet.getRange(rowNum, 5).setValue(title);        // E: 제목
    sheet.getRange(rowNum, 6).setValue(desc);         // F: 상세내용
    if(dueDate) {
      sheet.getRange(rowNum, 9).setValue(new Date(dueDate)); // I: 마감일
    } else {
      sheet.getRange(rowNum, 9).setValue("");
    }
    sheet.getRange(rowNum, 3).setValue(status);       // C: 상태
    sheet.getRange(rowNum, 14).setValue(now);         // N: 수정일

    // 캐시 파기
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    
    // 캘린더 동기화 트리거
    if (typeof syncCalendarEvent === "function") {
      syncCalendarEvent(sheet, rowNum);
    }
    
    // 액션 로그 기록
    logAction(userName || "Unknown", "Update", sheet.getRange(rowNum, 1).getValue(), 
              `T:${oldValues[4]}, S:${oldValues[2]}`, `T:${title}, S:${status}`);

    return { success: true, message: "업무가 성공적으로 수정되었습니다." };
  } catch (err) {
    console.error("웹 업무수정 에러:", err);
    return { success: false, message: err.message === "주어진 기간 내에 Lock을 획득하지 못했습니다." ? "ERR_LOCK_TIMEOUT" : err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * [20단계/추가] 웹 대시보드 업무 등록용 - 프로젝트 목록 반환
 */
function getProjectOptionsForWeb() {
  try {
    const props = PropertiesService.getScriptProperties();
    const ssId = props.getProperty("STORED_SS_ID");
    if (!ssId) return [{text: "기본 프로젝트", value: "DEFAULT"}];

    const cache = CacheService.getScriptCache();
    const CACHE_KEY = "PROJECT_OPTIONS_CACHE";
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) return parsed;
    }

    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName("Projects");
    if (!sheet || sheet.getLastRow() < 2) return [{text: "기본 프로젝트", value: "DEFAULT"}];

    const data = sheet.getDataRange().getValues();
    const options = [];
    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0]).trim();
      const code = String(data[i][1]).trim();
      const active = String(data[i][2]).trim();
      if (name && code && active !== "미사용") {
        options.push({ text: name, value: code });
      }
    }

    const result = options.length > 0 ? options : [{text: "기본 프로젝트", value: "DEFAULT"}];
    cache.put(CACHE_KEY, JSON.stringify(result), 3600);
    return result;
  } catch(e) {
    console.error("웹 프로젝트 목록 에러:", e);
    return [{text: "기본 프로젝트", value: "DEFAULT"}];
  }
}

/**
 * [20단계/추가] 웹 대시보드 - 새 업무 등록 (LockService 적용)
 */
function registerTaskFromWeb(userId, projectCode, projectName, title, desc, dueDate, status) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    
    const props = PropertiesService.getScriptProperties();
    const ssId = props.getProperty("STORED_SS_ID");
    if (!ssId) {
      return { success: false, message: "시트 ID가 저장되지 않았습니다. 슬랙 메뉴를 한 번 열어주세요." };
    }
    
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName("Tasks");
    if (!sheet) return { success: false, message: "Tasks 시트를 찾을 수 없습니다." };

    const userName = fetchUserName(userId);
    const newId = generateNewId(sheet, projectCode || "DEFAULT");
    const today = new Date();
    
    const dict = {
      "U02S3CN9E6R": "syn", "U08SJ3SJQ9W": "jieun",
      "U02SK29URP": "hyerim", "U0749G2SNBE": "yuna",
      "U04JL09C6DV": "sangho", "U02S3EURC21": "kwansu"
    };
    const slackUsername = dict[userId] || "";
    const assigneeField = userName; 
    let formattedDue = "";
    if (dueDate) {
      formattedDue = new Date(dueDate);
    }

    const rowData = [
      newId,                   // A: ID
      "일반",                   // B: 업무 유형
      status || "대기",        // C: 상태
      projectName || "DEFAULT",// D: 프로젝트명
      title,                   // E: 제목
      desc || "",              // F: 상세내용
      assigneeField,           // G: 담당자
      userName,                // H: 요청자
      formattedDue || "",      // I: 마감일
      "",                      // J: 선행 업무
      "",                      // K: 우선순위
      slackUsername ? "@" + slackUsername : "",  // L: 슬랙 멘션
      "",                      // M: 캘린더 ID
      today,                   // N: 최근 수정일
      today                    // O: 등록시간
    ];
    sheet.appendRow(rowData);

    // 캐시 파기
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    
    // 캘린더 동기화 트리거
    const newRow = sheet.getLastRow();
    if (typeof syncCalendarEvent === "function") {
      syncCalendarEvent(sheet, newRow);
    }
    
    // 액션 로그 기록
    logAction(userName || "Unknown", "Register", newId, null, title);

    // 슬랙 알림
    try {
      if (typeof sendTaskNotification === "function") {
         sendTaskNotification(rowData);
      }
    } catch(err) {
      console.log("슬랙 알림 발송 에러(웹등록):", err);
    }

    return { success: true, message: "업무가 등록되었습니다!" };

  } catch (err) {
    console.error("웹업무등록 에러:", err);
    return { success: false, message: err.message === "주어진 기간 내에 Lock을 획득하지 못했습니다." ? "ERR_LOCK_TIMEOUT" : err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * [Phase 23] ActionLog 시트에 로그를 남깁니다. 시트가 없으면 생성합니다.
 */
function logAction(user, action, taskId, oldValue, newValue, errorCode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("ActionLog");
    
    if (!sheet) {
      sheet = ss.insertSheet("ActionLog");
      sheet.appendRow(["Timestamp", "User", "Action", "TaskID", "OldValue", "NewValue", "ErrorCode"]);
      sheet.getRange(1, 1, 1, 7).setBackground("#f3f3f3").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([new Date(), user, action, taskId, oldValue, newValue, errorCode || "OK"]);
  } catch (e) {
    console.error("로그 기록 실패:", e);
  }
}
