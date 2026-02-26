/**
 * [파일명]: web_app.gs
 * [마지막 업데이트]: 2026-02-26 18:20 (KST)
 * [기능 설명]: 주디 워크스페이스 통합 백엔드 (데이터 불일치 및 동기화 문제 해결 버전)
 */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('judy_workspace');
  template.initialPage = e.parameter.page || 'tasks';
  template.userId = e.parameter.user || '';
  template.userName = e.parameter.name || '';
  template.token = e.parameter.token || '';
  
  return template.evaluate()
    .setTitle('Judy Workspace (통합 업무관리)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 전역 설정된 시트 ID를 사용하여 일관된 Spreadsheet 객체를 반환합니다.
 */
function getTargetSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty("STORED_SS_ID");
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      console.error("STORED_SS_ID로 열기 실패, 기본 시트 사용:", e);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * [Phase 10] 매직 링크 토큰 검증 시스템
 */
function validateToken(token) {
  if (!token) return { valid: false, reason: "토큰이 없습니다. 슬랙에서 다시 접속해주세요." };
  const cache = CacheService.getScriptCache();
  const userName = cache.get("MAGIC_" + token);
  if (userName) {
    cache.remove("MAGIC_" + token);
    return { valid: true, name: userName };
  } else {
    return { valid: false, reason: "권한이 없거나 이미 만료된 링크입니다." };
  }
}

/**
 * 모든 업무 데이터 반환 (캐싱 적용)
 */
function getAllTasksForWeb(userId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "ALL_TASKS_CACHE";
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    try { return JSON.parse(cachedData); } catch (e) {}
  }

  const ss = getTargetSpreadsheet();
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
      row: i + 1, id: rowId, title, project, status, dueDate, rawDueStr, desc, dDays, assignee,
      startTime: startTime instanceof Date ? startTime.getTime() : null,
      durationMin: !isNaN(parseFloat(durationMin)) ? parseFloat(durationMin) : null
    });
  }
  
  allTasks.sort((a, b) => (a.dDays ?? 9999) - (b.dDays ?? 9999));
  cache.put(cacheKey, JSON.stringify(allTasks), 300);
  return allTasks;
}

/**
 * 내 업무 필터링
 */
function getMyTasksForWeb(userId) {
  const userName = fetchUserName ? fetchUserName(userId) : userId;
  const allTasks = getAllTasksForWeb(userId);
  const dict = {
    "U02S3CN9E6R": "syn", "U08SJ3SJQ9W": "jieun",
    "U02SK29URP": "hyerim", "U0749G2SNBE": "yuna",
    "U04JL09C6DV": "sangho", "U02S3EURC21": "kwansu"
  };
  const slackUsername = dict[userId] || "";
  return allTasks.filter(t => t.assignee === userName || t.assignee === slackUsername);
}

/**
 * 상태 변경 (Lock + 캐시 파기)
 */
function changeTaskStatusFromWeb(rowNum, newStatus, userName) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    const ss = getTargetSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    const oldStatus = sheet.getRange(rowNum, 3).getValue();
    const now = new Date();
    
    sheet.getRange(rowNum, 3).setValue(newStatus);
    sheet.getRange(rowNum, 14).setValue(now);
    
    if (newStatus === "진행중") sheet.getRange(rowNum, 15).setValue(now);
    else if (newStatus === "완료") {
      sheet.getRange(rowNum, 16).setValue(now);
      const start = sheet.getRange(rowNum, 15).getValue();
      if (start instanceof Date) {
        sheet.getRange(rowNum, 17).setValue(Math.floor((now - start) / 60000));
      }
    }
    
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    if (typeof syncCalendarEvent === "function") syncCalendarEvent(sheet, rowNum);
    logAction(userName, "Status Change", sheet.getRange(rowNum, 1).getValue(), oldStatus, newStatus);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 업무 수정
 */
function updateTaskFromWeb(rowNum, title, desc, dueDate, status, userName) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    const ss = getTargetSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    const oldValues = sheet.getRange(rowNum, 1, 1, 9).getValues()[0];
    const now = new Date();

    sheet.getRange(rowNum, 5).setValue(title);
    sheet.getRange(rowNum, 6).setValue(desc);
    sheet.getRange(rowNum, 9).setValue(dueDate ? new Date(dueDate) : "");
    sheet.getRange(rowNum, 3).setValue(status);
    sheet.getRange(rowNum, 14).setValue(now);

    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    if (typeof syncCalendarEvent === "function") syncCalendarEvent(sheet, rowNum);
    logAction(userName, "Update", sheet.getRange(rowNum, 1).getValue(), oldValues[4], title);
    return { success: true, message: "수정 완료" };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 프로젝트 목록 반환
 */
function getProjectOptionsForWeb() {
  try {
    const ss = getTargetSpreadsheet();
    const sheet = ss.getSheetByName("Projects");
    if (!sheet) return [{text: "기본 프로젝트", value: "DEFAULT"}];
    const data = sheet.getDataRange().getValues();
    const options = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][2] !== "미사용") {
        options.push({ text: data[i][0], value: data[i][1] });
      }
    }
    return options.length > 0 ? options : [{text: "기본 프로젝트", value: "DEFAULT"}];
  } catch(e) {
    return [{text: "기본 프로젝트", value: "DEFAULT"}];
  }
}

/**
 * 새 업무 등록 (동기화 핵심)
 */
function registerTaskFromWeb(userId, projectCode, projectName, title, desc, dueDate, status) {
  const lock = LockService.getUserLock();
  try {
    lock.waitLock(15000);
    const ss = getTargetSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    const userName = fetchUserName ? fetchUserName(userId) : userId;
    const newId = generateNewId(sheet, projectCode || "DEFAULT");
    const today = new Date();
    
    const rowData = [
      newId, "일반", status || "대기", projectName || "DEFAULT", title,
      desc || "", userName, userName, dueDate ? new Date(dueDate) : "",
      "", "", "", "", today, today
    ];
    
    sheet.appendRow(rowData);
    CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    
    const newRow = sheet.getLastRow();
    if (typeof syncCalendarEvent === "function") syncCalendarEvent(sheet, newRow);
    logAction(userName, "Register", newId, null, title);

    try {
      if (typeof sendTaskNotification === "function") sendTaskNotification(rowData);
    } catch(e) {}

    return { success: true, message: "업무가 등록되었습니다!" };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function logAction(user, action, taskId, oldValue, newValue) {
  try {
    const ss = getTargetSpreadsheet();
    let logSheet = ss.getSheetByName("ActionLog");
    if (!logSheet) {
      logSheet = ss.insertSheet("ActionLog");
      logSheet.appendRow(["Timestamp", "User", "Action", "TaskID", "Old", "New"]);
    }
    logSheet.appendRow([new Date(), user, action, taskId, oldValue, newValue]);
  } catch(e) {}
}
