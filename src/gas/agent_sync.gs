/**
 * ============================================================================
 * [파일명]: agent_sync.gs
 * [설명]: V4 하네스 인프라 통합형 에이전트 Webhook 리스너 및 핑퐁 상태 관리 모듈
 * [버전]: v4.0.0
 * [배포]: Web App으로 배포하여 doPost(e) 엔드포인트를 하네스 라우터에 등록
 * ============================================================================
 */

const AGENT_SHEET_ID = "1gluWChHpmWWVRxgPpteOwcebE54mH1XK7a15NRc1-kU"; // UI 모니터링 폴백용
const STATE_JSON_DIR = "agent_work/states/"; // GitHub 내 상태 파일 경로

/**
 * [Phase 4] 대시보드 데이터 조회를 위한 GET 엔드포인트
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    const sheet = ss.getSheetByName("Agent_Tasks");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const jsonData = rows.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: jsonData
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * [Phase 2 & 3] 하네스 Webhook 수신 엔드포인트
 * - 기존 1분 트리거 폴링 방식 완전 대체
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No payload" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const payload = JSON.parse(e.postData.contents);
    
    // [Phase 5] WOW Gateway 신규 접수 인터셉트
    if (payload.type === "WOW_TASK") {
      return handleWowTask(payload);
    }
    
    const taskId = payload.task_id;
    
    if (!taskId) {
      throw new Error("task_id is missing in payload");
    }

    // 1. LockService 적용 (최대 15초 대기)
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      throw new Error("ERR_LOCK_TIMEOUT: 동시 작업 대기 시간 초과 (15초)");
    }
    
    try {
      // 2. 캐시 및 상태 관리 모듈 
      let currentState = getAgentState(taskId);
      
      // 3. 상태 전이 및 session_handoff (Phase 2)
      let nextState = processSessionHandoff(currentState, payload);
      
      // 4. 서킷 브레이커 로직 적용 (Phase 3)
      nextState = applyCircuitBreaker(nextState);
      
      // 5. 상태 저장 및 캐시 무효화
      saveAgentState(taskId, nextState);
      
      // 6. UI 시트 업데이트 (Dashboard Fallback)
      updateDashboardUI(taskId, nextState);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        task_id: taskId,
        current_stage: nextState.current_stage,
        pingpong_count: nextState.pingpong_count
      })).setMimeType(ContentService.MimeType.JSON);
      
    } finally {
      // 락 해제
      lock.releaseLock();
    }
  } catch (error) {
    Logger.log("[FATAL] doPost 에러: " + error.message);
    if(e.postData && e.postData.contents) {
       const p = JSON.parse(e.postData.contents);
       if(p.task_id) {
           sendSlackMessage(`🚨 *[시스템 에러]* \`${p.task_id}\` Webhook 처리 중 에러 발생: ${error.message}`, "CRITICAL");
       }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * [Phase 5] WOW Gateway 신규 태스크 생성 핸들러
 */
function handleWowTask(payload) {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    const sheet = ss.getSheetByName("Agent_Tasks");
    if (!sheet) throw new Error("Agent_Tasks sheet not found");

    // 1. Task_ID 자동 생성 (예: 20260228-W123456)
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd");
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "HHmmss");
    const taskId = `${dateStr}-W${timeStr}`; 

    // 2. 시트에 새 행 추가
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let newRow = new Array(headers.length).fill("");
    
    newRow[0] = taskId; // A열: Task_ID
    newRow[1] = payload.content || "WOW Gateway 자동 생성 태스크"; // B열: 태스크명
    newRow[2] = "PLANNING"; // C열: 상태
    
    const teamColIndex = headers.indexOf("할당_팀(V4)");
    if(teamColIndex > -1) newRow[teamColIndex] = "BUNKER_TEAM";

    sheet.appendRow(newRow);

    // 3. 상태(State) 초기화 및 저장
    const initState = {
      task_id: taskId,
      current_stage: "PLANNING",
      pingpong_count: 0,
      assigned_team: "BUNKER_TEAM",
      token_usage: { total_budget: 1000000, used: 0 },
      context: { wow_wish: payload.content },
      latest_qa_feedback: null
    };

    saveAgentState(taskId, initState);
    
    // 4. 슬랙 알림 전송
    sendSlackMessage(`✨ *[WOW Gateway 신규 접수]*\n새로운 태스크 \`${taskId}\` 가 벙커팀(PLANNING)에 할당되었습니다.\n요구사항: ${payload.content}`, "INFO");

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      task_id: taskId,
      message: "WOW Task successfully created and routed to BUNKER_TEAM"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    Logger.log("[FATAL] handleWowTask 에러: " + error.message);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 상태 전이 및 session_handoff 처리 (Phase 2)
 */
function processSessionHandoff(currentState, payload) {
  let state = currentState || {
    task_id: payload.task_id,
    current_stage: "PLANNING",
    pingpong_count: 0,
    token_usage: { total_budget: 1000000, used: 0 },
    context: {},
    latest_qa_feedback: null
  };
  
  // payload에 QA 반려 사유(Diff JSON)가 포함된 경우
  if (payload.qa_feedback) {
    state.latest_qa_feedback = payload.qa_feedback;
    
    if (payload.qa_feedback.qa_status === "REJECTED" && payload.qa_feedback.pingpong_increment) {
      state.pingpong_count += 1;
      state.current_stage = "DEVELOPING"; // 반려 시 자비스(개발)에게 반환
      state.assigned_team = "JARVIS_DEV_TEAM";
    } else if (payload.qa_feedback.qa_status === "PASS") {
      state.current_stage = "OPTIMIZING"; // 합격 시 강철(AX) 부채 관리로 이동
      state.assigned_team = "GANGCHEOL_AX_TEAM";
    }
  }
  
  // 기타 단계 전이 핸들링
  if (payload.action === "START_DEV") {
    state.current_stage = "DEVELOPING";
    state.assigned_team = "JARVIS_DEV_TEAM";
  } else if (payload.action === "SUBMIT_QA") {
    state.current_stage = "QA_REVIEW";
    state.assigned_team = "KIM_QA_TEAM";
  } else if (payload.action === "FINALIZE") {
    state.current_stage = "DOCUMENTING";
    state.assigned_team = "KKOOMKKOOM_DOCS_TEAM";
  }
  
  // 토큰 사용량 누적 기록
  if (payload.used_tokens) {
    state.token_usage.used += payload.used_tokens;
  }
  
  return state;
}

/**
 * 서킷 브레이커: 무한 루프 & 비용 통제 로직 (Phase 3)
 */
function applyCircuitBreaker(state) {
  let escalated = false;
  let reason = "";

  // 조건 1: 핑퐁 최대 3회 초과
  if (state.pingpong_count >= 3) {
    escalated = true;
    reason = `핑퐁 한계 초과 (최대 3회 중 ${state.pingpong_count}회 도달)`;
  }
  
  // 조건 2: 팀 토큰 예산 90% 소진
  if (state.token_usage.used >= (state.token_usage.total_budget * 0.9)) {
    escalated = true;
    reason = `팀 예산(토큰) 90% 소진 경고 (사용량: ${state.token_usage.used})`;
  }

  // 상태 변경 및 에스컬레이션 발생
  if (escalated && state.current_stage !== "ESCALATED") {
    state.current_stage = "ESCALATED";
    state.assigned_team = "NONE";
    sendSlackMessage(`🚨 *[서킷 브레이커 발동]* \`${state.task_id}\` 수동 개입 필요!\n사유: ${reason}`, "CRITICAL");
  }
  return state;
}

/**
 * 상태 로드 (CacheService 적용)
 */
function getAgentState(taskId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "STATE_" + taskId;
  let cached = cache.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 캐시 미스 시 GitHub에서 `state.json` 로드
  const filePath = `${STATE_JSON_DIR}${taskId}_state.json`;
  const content = getGitHubFileContent(filePath);
  if (content && content !== "문서 내용 없음" && !content.startsWith("[ERROR]")) {
    const stateObj = JSON.parse(content);
    cache.put(cacheKey, JSON.stringify(stateObj), 300); // 5분(300초) 캐싱
    return stateObj;
  }
  return null;
}

/**
 * 상태 저장 (GitHub 업로드 유틸 재활용 및 Cache 무효화 적용)
 */
function saveAgentState(taskId, stateObj) {
  const filePath = `${STATE_JSON_DIR}${taskId}_state.json`;
  const content = JSON.stringify(stateObj, null, 2);
  
  // GitHub 리포지토리에 상태 기록 업데이트
  uploadToGitHub(filePath, content, `chore(state): Update ${taskId} state to ${stateObj.current_stage}`);
  
  // Cache 무효화 후 최신 데이터 갱신
  const cache = CacheService.getScriptCache();
  const cacheKey = "STATE_" + taskId;
  cache.remove(cacheKey);
  cache.put(cacheKey, content, 300);
}

/**
 * 대시보드 UI 업데이트 폴백 (구글 시트 연동 유지)
 */
function updateDashboardUI(taskId, stateObj) {
  try {
    const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
    const sheet = ss.getSheetByName("Agent_Tasks");
    if (!sheet) return;
    
    // Task_ID 매칭 행 찾기
    const data = sheet.getRange("A2:A").getValues();
    let targetRow = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i][0] === taskId) {
            targetRow = i + 2;
            break;
        }
    }
    
    // 찾은 경우 상태 및 핑퐁카운트 업데이트 (V4 칼럼 매핑)
    if (targetRow > -1) {
        sheet.getRange(targetRow, 3).setValue(stateObj.current_stage);
        sheet.getRange(targetRow, 11).setValue(stateObj.assigned_team);
        sheet.getRange(targetRow, 12).setValue(stateObj.pingpong_count);
        sheet.getRange(targetRow, 13).setValue(stateObj.token_usage.used + " / " + stateObj.token_usage.total_budget);
    }
  } catch (e) {
    Logger.log("UI 시트 업데이트 실패: " + e.message);
  }
}

/**
 * 🚀 [V4 시트 원클릭 업그레이드 유틸리티] 🚀
 * 팀장님께서 Apps Script 편집기에서 이 함수를 선택하고 "실행"을 누르시면,
 * 과거 V3 시트 양식을 V4 최신 규격으로 자동 세팅해줍니다.
 */
function upgradeSheetToV4() {
  const ss = SpreadsheetApp.openById(AGENT_SHEET_ID);
  const sheet = ss.getSheetByName("Agent_Tasks");
  if (!sheet) return;
  
  // 1. 헤더 업그레이드 (K, L, M 열 확장)
  sheet.getRange("K1").setValue("할당_팀(V4)").setBackground("#1e40af").setFontColor("white").setFontWeight("bold");
  sheet.getRange("L1").setValue("핑퐁_카운트").setBackground("#b91c1c").setFontColor("white").setFontWeight("bold");
  sheet.getRange("M1").setValue("토큰사용량(V4)").setBackground("#1e40af").setFontColor("white").setFontWeight("bold");

  // 2. 상태(C열) 드롭다운을 V4 시스템 생태계와 100% 동기화
  const v4States = [
    "요청됨",
    "PLANNING", 
    "DEVELOPING", 
    "QA_REVIEW", 
    "OPTIMIZING", 
    "DOCUMENTING", 
    "ESCALATED", 
    "COMPLETED"
  ];
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(v4States, true).build();
  sheet.getRange("C2:C").setDataValidation(rule);
}

/**
 * GitHub Raw URL 로더
 */
function getGitHubFileContent(filePath) {
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const repo = "syn-glitch/gongdo-task-system";
  const branch = "main";
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;

  try {
    const options = { muteHttpExceptions: true };
    if (GITHUB_TOKEN) {
      options.headers = { "Authorization": `token ${GITHUB_TOKEN}` };
    }
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return response.getContentText();
    }
  } catch (e) { }
  return null;
}

/**
 * GitHub Commit REST API (PUT)
 */
function uploadToGitHub(filePath, content, commitMessage) {
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!GITHUB_TOKEN) return null;
  
  const repo = "syn-glitch/gongdo-task-system";
  const branch = "main";
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  
  let sha = null;
  try {
    const getRes = UrlFetchApp.fetch(url, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      muteHttpExceptions: true
    });
    if (getRes.getResponseCode() === 200) {
      sha = JSON.parse(getRes.getContentText()).sha;
    }
  } catch(e) {}
  
  const payload = {
    message: commitMessage,
    content: Utilities.base64Encode(Utilities.newBlob(content).getBytes()),
    branch: branch
  };
  
  if (sha) payload.sha = sha;
  
  const options = {
    method: "put",
    contentType: "application/json",
    headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

/**
 * 슬랙 웹훅 알람 (서킷 브레이커 연동)
 */
function sendSlackMessage(text, priority = "LOW") {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return; 
  const payload = { "text": text };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(webhookUrl, options);
}
