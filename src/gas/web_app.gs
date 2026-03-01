/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        web_app.gs
 * @version     v2.0.0
 * @updated     2026-03-02 15:00 (KST)
 * @agent       강철 (강철 AX팀)
 * @ordered-by  용남 대표
 * @description 주디 워크스페이스 통합 백엔드 — 메모 저장, AI 추출, 업무 CRUD, 인증
 *
 * @change-summary
 *   AS-IS: 중복 코드 4건(syncCalendar·타임스탬프·입력검증·사용자맵), 에러 메시지 내부 정보 노출, 입력값 검증 미흡
 *   TO-BE: 공통 헬퍼 추출(finalizeTaskRow), 에러 sanitize, 입력값 검증 함수 추가, QA M-2/M-7/M-9/M-10 해소
 *
 * @features
 *   - [추가] sanitizeErrorMessage() — 에러 메시지에서 내부 정보 제거 (QA M-2)
 *   - [추가] validateTaskInput() — 입력값 길이·형식·상태 검증 (QA M-9, M-10)
 *   - [추가] validateMemoInput() — 메모 입력 공통 검증
 *   - [추가] finalizeTaskRow() — 타임스탬프 갱신 + 캘린더 동기화 통합 헬퍼
 *   - [수정] withTaskLock — options 객체 지원, rowNum 전달 시 자동 후처리
 *   - [수정] validateSession — 만료 시 재인증 안내 보강 (QA M-7)
 *   - [수정] updateTaskFromWeb — 필드 화이트리스트 + 길이 제한 적용 (QA M-10)
 *   - [수정] SLACK_USER_MAP 상수 분리, SESSION_TTL·TASKS_CACHE_TTL 상수화
 *   - [수정] saveFromWeb/extractFromWeb — 내부 에러 메시지 비노출
 *   - [수정] validateToken — logActionV2 직접 호출로 통일
 *
 * ── 변경 이력 ──────────────────────────
 * v2.0.0 | 2026-03-02 15:00 | 강철 (AX팀) | 리팩토링 + 에러 핸들링 보강 + QA M-2/M-7/M-9/M-10 해소
 * v1.0.0 | 2026-03-01 | 클로이 (자비스팀) | 최초 작성 — 주디 워크스페이스 통합 백엔드
 * ============================================
 */

// ═══════════════════════════════════════════
// 상수 정의
// ═══════════════════════════════════════════

/** Slack User ID → 사용자명 매핑 */
const SLACK_USER_MAP = {
  "U02S3CN9E6R": "syn",
  "U08SJ3SJQ9W": "jieun",
  "U02SK29URP": "hyerim",
  "U0749G2SNBE": "yuna",
  "U04JL09C6DV": "sangho",
  "U02S3EURC21": "kwansu"
};

/** 세션 TTL (6시간) */
const SESSION_TTL = 21600;

/** 태스크 캐시 TTL (5분) */
const TASKS_CACHE_TTL = 300;

/** 입력값 최대 길이 */
const MAX_TITLE_LENGTH = 200;
const MAX_DESC_LENGTH = 5000;
const MAX_MEMO_LENGTH = 10000;

/** 유효 상태값 화이트리스트 */
const VALID_STATUSES = ["대기", "진행중", "완료", "보류", "삭제됨"];

// ═══════════════════════════════════════════
// 유틸리티 — 검증 · 보안
// ═══════════════════════════════════════════

/**
 * 에러 메시지에서 내부 정보(시트 ID, 파일 경로)를 제거합니다. (QA M-2)
 * @param {Error|string} err
 * @returns {string} 사용자에게 안전한 에러 메시지
 */
function sanitizeErrorMessage(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/[A-Za-z0-9_-]{25,}/g, "[ID]")
    .replace(/\/[^\s]+\.(gs|html|json)/g, "[경로]");
}

/**
 * 업무 입력값 검증 — 제목·설명·날짜·상태 (QA M-9, M-10)
 * @param {Object} fields - { title?, desc?, dueDate?, status? }
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateTaskInput(fields) {
  if (fields.title !== undefined) {
    if (!fields.title || String(fields.title).trim() === "") {
      return { valid: false, reason: "제목을 입력해주세요." };
    }
    if (String(fields.title).length > MAX_TITLE_LENGTH) {
      return { valid: false, reason: "제목은 " + MAX_TITLE_LENGTH + "자 이내로 입력해주세요." };
    }
  }
  if (fields.desc !== undefined && String(fields.desc).length > MAX_DESC_LENGTH) {
    return { valid: false, reason: "설명은 " + MAX_DESC_LENGTH + "자 이내로 입력해주세요." };
  }
  if (fields.dueDate !== undefined && fields.dueDate) {
    if (isNaN(new Date(fields.dueDate).getTime())) {
      return { valid: false, reason: "올바른 날짜 형식이 아닙니다." };
    }
  }
  if (fields.status !== undefined && !VALID_STATUSES.includes(fields.status)) {
    return { valid: false, reason: "유효하지 않은 상태값입니다." };
  }
  return { valid: true };
}

/**
 * 메모 입력값 검증 — 빈 값·길이 제한
 * @param {string} text
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMemoInput(text) {
  if (!text || String(text).trim() === "") {
    return { valid: false, reason: "내용이 없습니다." };
  }
  if (String(text).length > MAX_MEMO_LENGTH) {
    return { valid: false, reason: "내용은 " + MAX_MEMO_LENGTH + "자 이내로 입력해주세요." };
  }
  return { valid: true };
}

/**
 * 태스크 행 후처리 — 타임스탬프 갱신(14열) + 캘린더 동기화
 * @param {Sheet} sheet
 * @param {number} rowNum
 * @param {{ syncCalendar?: boolean }} opts
 */
function finalizeTaskRow(sheet, rowNum, opts) {
  sheet.getRange(rowNum, 14).setValue(new Date());
  if ((!opts || opts.syncCalendar !== false) && typeof syncCalendarEvent === "function") {
    syncCalendarEvent(sheet, rowNum);
  }
}

// ═══════════════════════════════════════════
// 웹 앱 진입점
// ═══════════════════════════════════════════

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('judy_workspace');
  template.initialPage = e.parameter.page || 'tasks';
  template.userId = e.parameter.user || '';
  template.userName = e.parameter.name || '';
  template.token = e.parameter.token || '';
  template.session = e.parameter.session || '';

  return template.evaluate()
    .setTitle('Judy Workspace (통합 업무관리)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ═══════════════════════════════════════════
// 스프레드시트 접근
// ═══════════════════════════════════════════

/**
 * 전역 설정된 시트 ID를 사용하여 일관된 Spreadsheet 객체를 반환합니다.
 */
function getTargetSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("STORED_SS_ID");
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      console.error("STORED_SS_ID로 열기 실패, 기본 시트 사용:", e);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ═══════════════════════════════════════════
// 인증
// ═══════════════════════════════════════════

/**
 * 매직 링크 토큰 검증 → 세션 토큰 발급 (1회용 소멸)
 */
function validateToken(token) {
  if (!token) return { valid: false, reason: "토큰이 없습니다. 슬랙에서 다시 접속해주세요." };

  var cache = CacheService.getScriptCache();
  var userName = cache.get("MAGIC_" + token);
  if (!userName) {
    return { valid: false, reason: "권한이 없거나 이미 만료된 링크입니다." };
  }

  cache.remove("MAGIC_" + token);
  var sessionToken = Utilities.getUuid().replace(/-/g, '');
  cache.put("SESSION_" + sessionToken, userName, SESSION_TTL);

  logActionV2({
    userId: userName, action: "SESSION_CREATE", targetId: sessionToken,
    details: "매직 링크 인증 → 세션 발급"
  });

  return { valid: true, name: userName, sessionToken: sessionToken };
}

/**
 * 세션 토큰 검증 (새로고침 시 사용) — QA M-7: 만료 시 재인증 안내 보강
 */
function validateSession(sessionToken) {
  if (!sessionToken) {
    return { valid: false, reason: "세션 정보가 없습니다. 슬랙에서 매직 링크를 다시 발급받아주세요." };
  }
  var cache = CacheService.getScriptCache();
  var userName = cache.get("SESSION_" + sessionToken);
  if (!userName) {
    return {
      valid: false,
      expired: true,
      reason: "세션이 만료되었습니다. 슬랙에서 /주디 명령어로 새 매직 링크를 발급받아주세요."
    };
  }
  cache.put("SESSION_" + sessionToken, userName, SESSION_TTL);
  return { valid: true, name: userName, sessionToken: sessionToken };
}

// ═══════════════════════════════════════════
// 태스크 Lock 래퍼
// ═══════════════════════════════════════════

/**
 * 공통 태스크 작업 래퍼 (Lock → Sheet → Callback → Finalize → Cache Clear)
 * @param {Function} callback - (sheet, ss) => { ... }
 * @param {boolean|Object} options - true/false(하위호환) 또는 { clearCache, rowNum, syncCalendar }
 */
function withTaskLock(callback, options) {
  if (typeof options === "boolean") {
    options = { clearCache: options };
  }
  options = options || {};
  var clearCache = options.clearCache !== undefined ? options.clearCache : true;
  var rowNum = options.rowNum;
  var syncCalendar = options.syncCalendar;

  var lock = LockService.getUserLock();
  try {
    lock.waitLock(10000);
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName("Tasks");
    if (!sheet) throw new Error("Tasks 시트를 찾을 수 없습니다.");

    var result = callback(sheet, ss);

    if (rowNum) {
      finalizeTaskRow(sheet, rowNum, { syncCalendar: syncCalendar });
    }

    if (clearCache) {
      CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
    }
    return { success: true, ...result };
  } catch (err) {
    console.error("Task Lock Error:", err);
    return { success: false, message: sanitizeErrorMessage(err) };
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════
// 태스크 CRUD
// ═══════════════════════════════════════════

/**
 * 모든 업무 데이터 반환 (캐시 5분 TTL)
 */
function getAllTasksForWeb(userId) {
  var cache = CacheService.getScriptCache();
  var cachedData = cache.get("ALL_TASKS_CACHE");

  if (cachedData) {
    try { return JSON.parse(cachedData); } catch (e) {}
  }

  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Tasks");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var allTasks = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var status = String(row[2] || "").trim();
    if (!row[4] || status === "삭제됨") continue;

    var rawDue = row[8];
    var startTime = row[14];
    var durationMin = row[16];

    var dueDate = "";
    var rawDueStr = "";
    var dDays = null;

    if (rawDue instanceof Date && !isNaN(rawDue.getTime())) {
      var d = new Date(rawDue);
      d.setHours(0, 0, 0, 0);
      dDays = Math.round((d - today) / 86400000);
      dueDate = (d.getMonth() + 1) + "/" + d.getDate();
      rawDueStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }

    allTasks.push({
      row: i + 1, id: row[0],
      title: String(row[4]).trim(), project: String(row[3] || "").trim(),
      status: status, dueDate: dueDate, rawDueStr: rawDueStr,
      desc: String(row[5] || "").trim(), dDays: dDays,
      assignee: String(row[6] || "").trim(),
      startTime: startTime instanceof Date ? startTime.getTime() : null,
      durationMin: !isNaN(parseFloat(durationMin)) ? parseFloat(durationMin) : null
    });
  }

  allTasks.sort(function(a, b) { return (a.dDays != null ? a.dDays : 9999) - (b.dDays != null ? b.dDays : 9999); });
  cache.put("ALL_TASKS_CACHE", JSON.stringify(allTasks), TASKS_CACHE_TTL);
  return allTasks;
}

/**
 * 내 업무 필터링
 */
function getMyTasksForWeb(userId) {
  var userName = typeof fetchUserName === "function" ? fetchUserName(userId) : userId;
  var allTasks = getAllTasksForWeb(userId);
  var slackUsername = SLACK_USER_MAP[userId] || "";
  return allTasks.filter(function(t) { return t.assignee === userName || t.assignee === slackUsername; });
}

/**
 * 상태 변경
 */
function changeTaskStatusFromWeb(rowNum, newStatus, userName) {
  var validation = validateTaskInput({ status: newStatus });
  if (!validation.valid) return { success: false, message: validation.reason };

  return withTaskLock(function(sheet) {
    var taskId = sheet.getRange(rowNum, 1).getValue();
    var oldStatus = sheet.getRange(rowNum, 3).getValue();
    var now = new Date();

    sheet.getRange(rowNum, 3).setValue(newStatus);

    if (newStatus === "진행중") {
      sheet.getRange(rowNum, 15).setValue(now);
    } else if (newStatus === "완료") {
      sheet.getRange(rowNum, 16).setValue(now);
      var start = sheet.getRange(rowNum, 15).getValue();
      if (start instanceof Date) {
        sheet.getRange(rowNum, 17).setValue(Math.floor((now - start) / 60000));
      }
    }

    logActionV2({
      userId: userName, action: "STATUS_CHANGE", targetId: taskId,
      oldValue: oldStatus, newValue: newStatus, details: "웹 대시보드에서 상태 변경"
    });
    return { message: "상태 변경 완료" };
  }, { rowNum: rowNum, syncCalendar: true });
}

/**
 * 업무 수정 — QA M-10: 화이트리스트 필드만 수용 + 길이 제한
 */
function updateTaskFromWeb(rowNum, title, desc, dueDate, status, userName) {
  var validation = validateTaskInput({ title: title, desc: desc, dueDate: dueDate, status: status });
  if (!validation.valid) return { success: false, message: validation.reason };

  return withTaskLock(function(sheet) {
    var taskId = sheet.getRange(rowNum, 1).getValue();
    var oldTitle = sheet.getRange(rowNum, 5).getValue();

    sheet.getRange(rowNum, 5).setValue(String(title).substring(0, MAX_TITLE_LENGTH));
    sheet.getRange(rowNum, 6).setValue(String(desc || "").substring(0, MAX_DESC_LENGTH));
    sheet.getRange(rowNum, 9).setValue(dueDate ? new Date(dueDate) : "");
    sheet.getRange(rowNum, 3).setValue(status);

    logActionV2({
      userId: userName, action: "UPDATE", targetId: taskId,
      oldValue: oldTitle, newValue: title, details: "웹 대시보드에서 업무 수정"
    });
    return { message: "수정 완료" };
  }, { rowNum: rowNum, syncCalendar: true });
}

/**
 * 마감일 변경 (캘린더 드래그 앤 드롭)
 */
function changeTaskDueDateFromWeb(rowNum, newDate, userName) {
  var validation = validateTaskInput({ dueDate: newDate });
  if (!validation.valid) return { success: false, message: validation.reason };

  return withTaskLock(function(sheet) {
    var taskId = sheet.getRange(rowNum, 1).getValue();
    var oldDate = sheet.getRange(rowNum, 9).getValue();

    sheet.getRange(rowNum, 9).setValue(new Date(newDate));

    logActionV2({
      userId: userName, action: "DUEDATE_CHANGE", targetId: taskId,
      oldValue: oldDate, newValue: newDate, source: "CALENDAR_DRAG"
    });
    return { message: "마감일 변경 완료" };
  }, { rowNum: rowNum, syncCalendar: true });
}

/**
 * 업무 삭제
 */
function deleteTaskFromWeb(rowNum, userName) {
  return withTaskLock(function(sheet) {
    var rowData = sheet.getRange(rowNum, 1, 1, 5).getValues()[0];
    var taskId = rowData[0];
    var title = rowData[4];
    var oldStatus = rowData[2];

    var statusCell = sheet.getRange(rowNum, 3);
    statusCell.setDataValidation(null);
    statusCell.setValue("삭제됨");

    logActionV2({
      userId: userName, action: "DELETE", targetId: taskId,
      oldValue: oldStatus, newValue: "삭제됨", details: "업무 삭제: " + title
    });
    return { message: "삭제 완료", taskId: taskId, title: title };
  }, { rowNum: rowNum, syncCalendar: false });
}

/**
 * 새 업무 등록
 */
function registerTaskFromWeb(userId, projectCode, projectName, title, desc, dueDate, status) {
  var validation = validateTaskInput({ title: title, desc: desc, dueDate: dueDate, status: status || "대기" });
  if (!validation.valid) return { success: false, message: validation.reason };

  return withTaskLock(function(sheet) {
    var userName = typeof fetchUserName === "function" ? fetchUserName(userId) : userId;
    var newId = generateNewId(sheet, projectCode || "DEFAULT");
    var today = new Date();

    var rowData = [
      newId, "일반", status || "대기", projectName || "DEFAULT",
      String(title).substring(0, MAX_TITLE_LENGTH),
      String(desc || "").substring(0, MAX_DESC_LENGTH),
      userName, userName, dueDate ? new Date(dueDate) : "",
      "", "", "", "", today, today
    ];

    sheet.appendRow(rowData);
    var newRow = sheet.getLastRow();

    if (typeof syncCalendarEvent === "function") syncCalendarEvent(sheet, newRow);

    logActionV2({
      userId: userName, action: "REGISTER", targetId: newId,
      newValue: title, details: "웹 대시보드에서 신규 등록"
    });

    try {
      if (typeof sendTaskNotification === "function") sendTaskNotification(rowData);
    } catch (e) { /* 알림 실패 무시 */ }

    return { message: "업무가 등록되었습니다!" };
  }, true);
}

// ═══════════════════════════════════════════
// 로그
// ═══════════════════════════════════════════

/**
 * 통합 액션 로그 기록 (V2)
 * @param {Object} logData - { userId, action, targetId, details, source, oldValue, newValue }
 */
function logActionV2(logData) {
  try {
    var ss = getTargetSpreadsheet();
    var logSheet = ss.getSheetByName("ActionLog");
    if (!logSheet) {
      logSheet = ss.insertSheet("ActionLog");
      logSheet.appendRow(["Timestamp", "User", "Action", "TaskID", "Old", "New", "Source", "Details"]);
    }
    logSheet.appendRow([
      new Date(),
      logData.userId || "", logData.action || "", logData.targetId || "",
      String(logData.oldValue || ""), String(logData.newValue || ""),
      logData.source || "WEB", logData.details || ""
    ]);
    return { success: true };
  } catch (e) {
    console.error("ActionLog Error:", e);
    return { success: false, message: sanitizeErrorMessage(e) };
  }
}

/** 구버전 호환 래퍼 (외부 파일에서 호출 가능하므로 유지) */
function logAction(user, action, taskId, oldValue, newValue) {
  return logActionV2({ userId: user, action: action, targetId: taskId, oldValue: oldValue, newValue: newValue });
}

// ═══════════════════════════════════════════
// 프로젝트 · 메모
// ═══════════════════════════════════════════

/**
 * 프로젝트 목록 반환
 */
function getProjectOptionsForWeb() {
  var DEFAULT_OPTION = [{ text: "기본 프로젝트", value: "DEFAULT" }];
  try {
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName("Projects");
    if (!sheet) return DEFAULT_OPTION;
    var data = sheet.getDataRange().getValues();
    var options = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][2] !== "미사용") {
        options.push({ text: data[i][0], value: data[i][1] });
      }
    }
    return options.length > 0 ? options : DEFAULT_OPTION;
  } catch (e) {
    return DEFAULT_OPTION;
  }
}

/**
 * 메모 저장
 */
function saveFromWeb(userName, text) {
  var check = validateMemoInput(text);
  if (!check.valid) return { success: false, message: check.reason };
  try {
    var result = appendMemoToArchive(userName, text, null);
    return {
      success: !!result,
      message: result ? "성공적으로 저장되었습니다." : "저장 중 오류가 발생했습니다."
    };
  } catch (err) {
    console.error("saveFromWeb Error:", err);
    return { success: false, message: "저장 중 오류가 발생했습니다. 다시 시도해주세요." };
  }
}

/**
 * 메모 저장 + AI 업무 추출
 */
function extractFromWeb(userName, text) {
  var check = validateMemoInput(text);
  if (!check.valid) return { success: false, message: check.reason };
  try {
    appendMemoToArchive(userName, text, null);
    var summaryMsg = parseAndCreateTasks(text, userName);
    return { success: true, message: summaryMsg };
  } catch (err) {
    console.error("extractFromWeb Error:", err);
    return { success: false, message: "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요." };
  }
}
