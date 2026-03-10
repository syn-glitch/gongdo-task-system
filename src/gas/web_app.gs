/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        web_app.gs
 * @version     v3.1.2
 * @updated     2026-03-10 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 주디 워크스페이스 통합 백엔드 — 메모 저장, AI 추출, 업무 CRUD, 인증, 참고사항, DM 알림
 *
 * @change-summary
 *   AS-IS: v3.1.1 — 진단용 팝업 및 임시 코드 포함
 *   TO-BE: v3.1.2 — 슬랙 알림 내 워크스페이스 바로가기 링크 추가 및 클린업 완료
 *
 * @features
 *   - [추가] 슬랙 알림 메시지 내 '워크스페이스 바로가기' 링크 삽입 (UX 개선)
 *   - [추가] createProjectFromWeb() — 프로젝트 직접 생성 (자동 코드, LockService, 중복 방지)
 *   - [추가] acceptTaskFromWeb() — 수락대기 → 대기 + 신청자 DM 발송
 *   - [추가] triggerStartDateReminders() — D-3, D-1, 당일 슬랙 DM 트리거
 *   - [추가] addTaskReference/updateTaskReference/deleteTaskReference — 참고사항 CRUD + 로그
 *   - [추가] getTaskReferences() — 업무별 참고사항 조회
 *   - [추가] sendTaskDM() — Slack DM 발송 (conversations.open 패턴)
 *   - [수정] registerTaskFromWeb() — 담당자 지정(수락대기) + 시작예정일(S열) 지원
 *   - [수정] getAllTasksForWeb() — requester, startDate 필드 추가
 *   - [수정] VALID_STATUSES — "수락대기" 추가
 *
 * ── 변경 이력 ──────────────────────────
 * v3.1.0 | 2026-03-09 | 에이다 BE | 업무 관리 v3.1 고도화 (JARVIS-2026-03-09-001)
 * v3.0.1 | 2026-03-09 | 에이다 BE | 매직링크 validateToken cache 변수 수정 + 출근 브리핑
 * v3.0.0 | 2026-03-02 18:28 | 강철 (AX팀) | 세션 스토어 PropertiesService 전환, 30일 TTL
 * v2.2.0 | 2026-03-02 16:40 | 자비스 PO | 인증 회복탄력성 강화
 * v2.0.0 | 2026-03-02 15:00 | 강철 (AX팀) | 리팩토링 + 에러 핸들링 보강
 * v1.0.0 | 2026-03-01 | 클로이 (자비스팀) | 최초 작성
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
  "U02S3EURC21": "kwansu",
  "U0AJ57GFXM0": "minseok"
};

/** 세션 TTL (30일, 밀리초) — PropertiesService는 TTL 없으므로 자체 만료 로직 사용 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

/** CacheService TTL (하위 호환용, 성능 캐시 레이어) */
const SESSION_CACHE_TTL = 21600; // 6시간

/** 매직 토큰 TTL (24시간, 밀리초) */
const MAGIC_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 태스크 캐시 TTL (5분) */
const TASKS_CACHE_TTL = 300;

/** 입력값 최대 길이 */
const MAX_TITLE_LENGTH = 200;
const MAX_DESC_LENGTH = 5000;
const MAX_MEMO_LENGTH = 10000;

/** 유효 상태값 화이트리스트 (v3.1: 수락대기 추가) */
const VALID_STATUSES = ["대기", "진행중", "완료", "보류", "삭제됨", "수락대기"];

/** 참고사항 입력 최대 길이 */
const MAX_REF_LENGTH = 3000;

/** 사용자명 → Slack User ID 역매핑 (fetchUserName 기준 통일) */
const USER_NAME_TO_SLACK_ID = {
  "송용남": "U02S3CN9E6R",
  "이지은": "U08SJ3SJQ9W",
  "정혜림": "U02SK29UVRP",
  "문유나": "U0749G2SNBE",
  "이상호": "U04JL09C6DV",
  "김관수": "U02S3EURC21",
  "김민석": "U0AJ57GFXM0"
};

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
    .setTitle('Judy Workspace')
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
 * 매직 링크 토큰 검증 → 세션 토큰 발급
 * [v3.0.0] PropertiesService 기반 영구 세션 스토어로 전환
 */
function validateToken(token) {
  if (!token) return { valid: false, reason: "토큰이 없습니다. 슬랙에서 다시 접속해주세요." };

  // [v3.1.0] PropertiesService 기반 매직 토큰 (24시간 유효, 다회 사용)
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("MAGIC_" + token);
  if (!raw) {
    return { valid: false, reason: "권한이 없거나 이미 만료된 링크입니다." };
  }

  var magicData;
  try {
    magicData = JSON.parse(raw);
  } catch (e) {
    props.deleteProperty("MAGIC_" + token);
    return { valid: false, reason: "링크 데이터 오류. 슬랙에서 새 링크를 받아주세요." };
  }

  // 24시간 만료 검사
  if (new Date().getTime() - magicData.createdAt > MAGIC_TOKEN_TTL_MS) {
    props.deleteProperty("MAGIC_" + token);
    return { valid: false, reason: "링크가 만료되었습니다 (24시간 초과). 슬랙에서 새 링크를 받아주세요." };
  }

  var userName = magicData.userName;

  // [v3.0.0] 세션 토큰을 PropertiesService에 영구 저장
  var sessionToken = Utilities.getUuid().replace(/-/g, '');
  var sessionData = JSON.stringify({
    userName: userName,
    createdAt: new Date().getTime(),
    lastActiveAt: new Date().getTime()
  });
  PropertiesService.getScriptProperties().setProperty("SESSION_" + sessionToken, sessionData);

  // 성능 캐시 레이어 (CacheService를 읽기 캐시로 활용)
  var cache = CacheService.getScriptCache();
  cache.put("SESS_CACHE_" + sessionToken, userName, SESSION_CACHE_TTL);

  logActionV2({
    userId: userName, action: "SESSION_CREATE", targetId: sessionToken,
    details: "매직 링크 인증 → 세션 발급 (v3.0 PropertiesService)"
  });

  // [v3.0.1] 실제 배포 URL 제공 (PWA 홈 화면 추가용)
  var deployUrl = ScriptApp.getService().getUrl();
  var sessionUrl = deployUrl + '?session=' + sessionToken;

  return { valid: true, name: userName, sessionToken: sessionToken, sessionUrl: sessionUrl };
}

/**
 * 세션 토큰 검증 (새로고침/PWA 재접속 시 사용)
 * [v3.0.0] PropertiesService 기반 — 30일 만료, 활동 시 TTL 갱신
 */
function validateSession(sessionToken) {
  if (!sessionToken) {
    return { valid: false, reason: "세션 정보가 없습니다. 슬랙에서 매직 링크를 다시 발급받아주세요." };
  }

  // 1차: 캐시에서 빠르게 조회 (성능 최적화)
  var cache = CacheService.getScriptCache();
  var cachedName = cache.get("SESS_CACHE_" + sessionToken);
  if (cachedName) {
    // 캐시 히트 — PropertiesService 읽기 생략
    cache.put("SESS_CACHE_" + sessionToken, cachedName, SESSION_CACHE_TTL);
    return { valid: true, name: cachedName, sessionToken: sessionToken };
  }

  // 2차: PropertiesService에서 조회 (캐시 미스 또는 6시간+ 경과)
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("SESSION_" + sessionToken);
  if (!raw) {
    return {
      valid: false,
      expired: true,
      reason: "세션이 만료되었습니다. 슬랙에서 /주디 명령어로 새 매직 링크를 발급받아주세요."
    };
  }

  try {
    var data = JSON.parse(raw);
    var now = new Date().getTime();

    // 30일 만료 검사
    if (now - data.createdAt > SESSION_TTL_MS) {
      props.deleteProperty("SESSION_" + sessionToken);
      return {
        valid: false,
        expired: true,
        reason: "세션이 만료되었습니다. 슬랙에서 다시 접속해주세요."
      };
    }

    // 활동 시간 갱신
    data.lastActiveAt = now;
    props.setProperty("SESSION_" + sessionToken, JSON.stringify(data));

    // 캐시 백필
    cache.put("SESS_CACHE_" + sessionToken, data.userName, SESSION_CACHE_TTL);

    return { valid: true, name: data.userName, sessionToken: sessionToken };
  } catch (e) {
    props.deleteProperty("SESSION_" + sessionToken);
    return { valid: false, reason: "세션 데이터 오류. 슬랙에서 다시 접속해주세요." };
  }
}

/**
 * [v3.0.0] 세션 가비지 콜렉션 — 30일 초과 세션 정리
 * 주기적 트리거(1일 1회)로 호출 권장
 */
function cleanupExpiredSessions() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();
  var now = new Date().getTime();
  var cleaned = 0;

  for (var key in allProps) {
    if (key.indexOf("SESSION_") === 0) {
      try {
        var data = JSON.parse(allProps[key]);
        if (now - data.createdAt > SESSION_TTL_MS) {
          props.deleteProperty(key);
          cleaned++;
        }
      } catch (e) {
        props.deleteProperty(key);
        cleaned++;
      }
    }
    // [v3.1.0] 만료된 매직 토큰도 정리
    if (key.indexOf("MAGIC_") === 0) {
      try {
        var mData = JSON.parse(allProps[key]);
        if (now - mData.createdAt > MAGIC_TOKEN_TTL_MS) {
          props.deleteProperty(key);
          cleaned++;
        }
      } catch (e) {
        props.deleteProperty(key);
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    console.log("Session GC: " + cleaned + "건 만료 세션 정리 완료");
  }
  return { cleaned: cleaned };
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

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName(
     "Tasks");
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

    var plannedStart = row[18]; // S열 = 시작예정일
    var plannedStartStr = "";
    if (plannedStart instanceof Date && !isNaN(plannedStart.getTime())) {
      plannedStartStr = Utilities.formatDate(plannedStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }

    allTasks.push({
      row: i + 1, id: row[0],
      title: String(row[4]).trim(), project: String(row[3] || "").trim(),
      status: status, dueDate: dueDate, rawDueStr: rawDueStr,
      desc: String(row[5] || "").trim(), dDays: dDays,
      assignee: String(row[6] || "").trim(),
      requester: String(row[7] || "").trim(),
      startTime: startTime instanceof Date ? startTime.getTime() : null,
      durationMin: !isNaN(parseFloat(durationMin)) ? parseFloat(durationMin) : null,
      startDate: plannedStartStr
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
  return allTasks.filter(function(t) {
    var isAssignee = t.assignee === userName || t.assignee === slackUsername;
    var isRequester = (t.requester === userName || t.requester === slackUsername) && t.assignee !== userName && t.assignee !== slackUsername;
    return isAssignee || isRequester;
  }).map(function(t) {
    var isMyAssignment = t.assignee === userName || t.assignee === slackUsername;
    t.isRequester = !isMyAssignment;
    return t;
  });
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

    // 수락대기/삭제됨 등 비표준 상태 → 데이터 유효성 검사 제거 후 설정
    var statusCell = sheet.getRange(rowNum, 3);
    statusCell.setDataValidation(null);
    statusCell.setValue(newStatus);

    if (newStatus === "진행중") {
      sheet.getRange(rowNum, 15).setValue(now);
    } else if (newStatus === "완료") {
      sheet.getRange(rowNum, 16).setValue(now);
      var start = sheet.getRange(rowNum, 15).getValue();
      if (start instanceof Date) {
        sheet.getRange(rowNum, 17).setValue(Math.floor((now - start) / 60000));
      }

      // v3.1.3: 신청자에게 완료 알림 DM 발송
      var requester = String(sheet.getRange(rowNum, 8).getValue()).trim();
      var title = sheet.getRange(rowNum, 5).getValue();
      var taskId = sheet.getRange(rowNum, 1).getValue();
      if (requester && requester !== userName) {
        try {
          var webAppUrl = ScriptApp.getService().getUrl();
          sendTaskDM(requester, "✅ *업무가 완료되었습니다*\n" +
            "🆔 " + taskId + " | 📝 " + title + "\n" +
            "👤 담당자: " + userName + "님이 업무를 완료했습니다.\n\n" +
            "🔗 <" + webAppUrl + "|내 주디 워크스페이스 열기>");
        } catch (e) { console.error("완료 DM 발송 실패:", e); }
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
/**
 * 새 업무 등록 (v3.1: 시작일, 담당자 지정, 수락대기 지원)
 * @param {string} userId - 등록자 슬랙 ID
 * @param {string} projectCode - 프로젝트 코드
 * @param {string} projectName - 프로젝트 이름
 * @param {string} title - 업무 제목
 * @param {string} desc - 업무 설명
 * @param {string} dueDate - 마감일
 * @param {string} status - 상태 (기본: "대기")
 * @param {Object} [opts] - v3.1 옵션 { startDate, assigneeName }
 */
function registerTaskFromWeb(userId, projectCode, projectName, title, desc, dueDate, status, opts) {
  opts = opts || {};
  var validation = validateTaskInput({ title: title, desc: desc, dueDate: dueDate, status: status || "대기" });
  if (!validation.valid) return { success: false, message: validation.reason };

  return withTaskLock(function(sheet) {
    var userName = typeof fetchUserName === "function" ? fetchUserName(userId) : userId;
    var assigneeName = opts.assigneeName || userName;
    var startDate = opts.startDate ? new Date(opts.startDate) : "";
    var newId = generateNewId(sheet, projectCode || "DEFAULT");
    var today = new Date();

    // 담당자가 본인이 아니면 "수락대기" 상태로 시작
    var initialStatus = status || "대기";
    if (assigneeName !== userName && assigneeName) {
      initialStatus = "수락대기";
    }

    var rowData = [
      newId, "일반", initialStatus, projectName || "DEFAULT",
      String(title).substring(0, MAX_TITLE_LENGTH),
      String(desc || "").substring(0, MAX_DESC_LENGTH),
      assigneeName, userName, dueDate ? new Date(dueDate) : "",
      "", "", "", "", today, today,
      "", "", "", startDate  // P(15)=시작시간, Q(16)=종료, R(17)=소요시간, S(18)=시작예정일
    ];

    sheet.appendRow(rowData);
    var newRow = sheet.getLastRow();

    if (typeof syncCalendarEvent === "function") syncCalendarEvent(sheet, newRow);

    logActionV2({
      userId: userName, action: "REGISTER", targetId: newId,
      newValue: title, details: "웹 대시보드 신규 등록 (담당: " + assigneeName + ")"
    });

    // 슬랙 알림: 담당자가 본인이 아니면 담당자에게 DM
    if (assigneeName !== userName) {
      try {
        var webAppUrl = ScriptApp.getService().getUrl();
        sendTaskDM(assigneeName, "📋 *새 업무가 배정되었습니다*\n" +
          "📂 " + (projectName || "DEFAULT") + " | " + newId + "\n" +
          "📝 " + title + "\n" +
          "👤 요청자: " + userName + "\n" +
          "📅 마감일: " + (dueDate || "미지정") + "\n" +
          "⏳ 상태: *수락대기* — 대시보드에서 수락해주세요!\n\n" +
          "🔗 <" + webAppUrl + "|내 주디 워크스페이스 열기>");
      } catch (e) { console.error("DM 발송 실패:", e); }
    }

    try {
      if (typeof sendTaskNotification === "function") sendTaskNotification(newRow);
    } catch (e) { /* 알림 실패 무시 */ }

    return { message: "업무가 등록되었습니다!", taskId: newId };
  }, true);
}

// ═══════════════════════════════════════════
// v3.1: 업무 수락 · 프로젝트 생성 · 참고사항 · DM
// ═══════════════════════════════════════════

/**
 * 업무 수락 — 수락대기 → 대기로 변경 + 신청자에게 DM
 */
function acceptTaskFromWeb(rowNum, userName) {
  return withTaskLock(function(sheet) {
    var currentStatus = String(sheet.getRange(rowNum, 3).getValue()).trim();
    if (currentStatus !== "수락대기") {
      return { success: false, message: "수락대기 상태가 아닙니다. 현재: " + currentStatus };
    }

    var assignee = String(sheet.getRange(rowNum, 7).getValue()).trim();
    if (assignee !== userName) {
      throw new Error("본인에게 배정된 업무만 수락할 수 있습니다.");
    }

    var now = new Date();

    // v3.1.1: 수락 시 "진행중"으로 전환 + 시작시간 기록
    var statusCell = sheet.getRange(rowNum, 3);
    statusCell.setDataValidation(null);
    statusCell.setValue("진행중");
    sheet.getRange(rowNum, 15).setValue(now); // 시작시간 기록 (김감사 M-3 반영)

    var taskId = sheet.getRange(rowNum, 1).getValue();
    var title = sheet.getRange(rowNum, 5).getValue();
    var requester = String(sheet.getRange(rowNum, 8).getValue()).trim();

    logActionV2({
      userId: userName, action: "ACCEPT", targetId: taskId,
      oldValue: "수락대기", newValue: "진행중", details: userName + "님이 업무 수락 → 시작"
    });

    // 신청자에게 수락+시작 알림 DM
    if (requester && requester !== userName) {
      try {
        var webAppUrl = ScriptApp.getService().getUrl();
        sendTaskDM(requester, "✅ *업무가 수락되었습니다*\n" +
          "🆔 " + taskId + " | 📝 " + title + "\n" +
          "👤 담당자: " + userName + "님이 수락하여 업무를 시작합니다.\n\n" +
          "🔗 <" + webAppUrl + "|내 주디 워크스페이스 열기>");
      } catch (e) { console.error("수락 DM 발송 실패:", e); }
    }

    return { success: true, message: userName + "님이 업무를 수락하고 시작했습니다." };
  }, { rowNum: rowNum, syncCalendar: true });
}

/**
 * 프로젝트 직접 등록 (자동 코드 생성)
 */
function createProjectFromWeb(projectName, userName) {
  if (!projectName || String(projectName).trim().length < 2) {
    return { success: false, message: "프로젝트 이름은 2자 이상 입력해주세요." };
  }
  projectName = String(projectName).trim();

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName("Projects");
    if (!sheet) throw new Error("Projects 시트를 찾을 수 없습니다.");

    // 중복 체크
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === projectName) {
        return { success: false, message: "이미 존재하는 프로젝트입니다: " + projectName };
      }
    }

    // 코드 자동 생성: 프로젝트명 앞 3글자 + 랜덤 2자리
    var code = projectName.replace(/[^a-zA-Z가-힣0-9]/g, "").substring(0, 3).toUpperCase();
    if (code.length < 2) code = "PRJ";
    code = code + String(Math.floor(Math.random() * 90) + 10);

    // 중복 코드 재생성
    var codeExists = data.some(function(r) { return String(r[1]).trim() === code; });
    if (codeExists) code = code + String(Math.floor(Math.random() * 9));

    sheet.appendRow([projectName, code, "활성", "", new Date(), userName]);

    logActionV2({
      userId: userName, action: "CREATE_PROJECT", targetId: code,
      newValue: projectName, details: "웹 대시보드에서 프로젝트 생성"
    });

    return { success: true, message: "프로젝트가 생성되었습니다!", projectName: projectName, projectCode: code };
  } catch (err) {
    console.error("createProject Error:", err);
    return { success: false, message: sanitizeErrorMessage(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 참고사항(Task_References) 추가
 */
function addTaskReference(taskId, content, userName) {
  if (!content || String(content).trim().length === 0) {
    return { success: false, message: "내용을 입력해주세요." };
  }
  if (String(content).length > MAX_REF_LENGTH) {
    return { success: false, message: "참고사항은 " + MAX_REF_LENGTH + "자 이내로 입력해주세요." };
  }
  // 수식 인젝션 방지
  content = String(content).trim();
  if (content.charAt(0) === "=" || content.indexOf("<script") !== -1) {
    return { success: false, message: "허용되지 않는 입력입니다." };
  }

  try {
    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateRefSheet(ss);
    var refId = "REF-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    var now = new Date();

    sheet.appendRow([refId, taskId, content, userName, now, now, "INSERT"]);

    logActionV2({
      userId: userName, action: "ADD_REFERENCE", targetId: taskId,
      newValue: content.substring(0, 50), details: "참고사항 추가"
    });

    return { success: true, message: "참고사항이 추가되었습니다.", refId: refId };
  } catch (err) {
    return { success: false, message: sanitizeErrorMessage(err) };
  }
}

/**
 * 참고사항 수정
 */
function updateTaskReference(refId, newContent, userName) {
  if (!newContent || String(newContent).trim().length === 0) {
    return { success: false, message: "내용을 입력해주세요." };
  }
  if (String(newContent).length > MAX_REF_LENGTH) {
    return { success: false, message: "참고사항은 " + MAX_REF_LENGTH + "자 이내로 입력해주세요." };
  }
  newContent = String(newContent).trim();
  if (newContent.charAt(0) === "=" || newContent.indexOf("<script") !== -1) {
    return { success: false, message: "허용되지 않는 입력입니다." };
  }

  try {
    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateRefSheet(ss);
    var data = sheet.getDataRange().getValues();
    var now = new Date();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === refId && String(data[i][6]) !== "DELETE") {
        var oldContent = data[i][2];
        // 수정 로그 행 추가 (원본 보존)
        sheet.appendRow([refId + "-EDIT-" + Date.now(), data[i][1], oldContent, userName, data[i][4], now, "UPDATE"]);
        // 원본 행 업데이트
        sheet.getRange(i + 1, 3).setValue(newContent);
        sheet.getRange(i + 1, 6).setValue(now);

        logActionV2({
          userId: userName, action: "UPDATE_REFERENCE", targetId: refId,
          oldValue: oldContent.substring(0, 50), newValue: newContent.substring(0, 50)
        });
        return { success: true, message: "참고사항이 수정되었습니다." };
      }
    }
    return { success: false, message: "참고사항을 찾을 수 없습니다." };
  } catch (err) {
    return { success: false, message: sanitizeErrorMessage(err) };
  }
}

/**
 * 참고사항 삭제 (소프트 삭제 — 로그 보존)
 */
function deleteTaskReference(refId, userName) {
  try {
    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateRefSheet(ss);
    var data = sheet.getDataRange().getValues();
    var now = new Date();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === refId && String(data[i][6]) !== "DELETE") {
        var oldContent = data[i][2];
        // 삭제 로그 행
        sheet.appendRow([refId + "-DEL-" + Date.now(), data[i][1], oldContent, userName, data[i][4], now, "DELETE"]);
        // 원본 행에 DELETE 마킹
        sheet.getRange(i + 1, 7).setValue("DELETE");
        sheet.getRange(i + 1, 6).setValue(now);

        logActionV2({
          userId: userName, action: "DELETE_REFERENCE", targetId: refId,
          oldValue: oldContent.substring(0, 50), details: "참고사항 삭제"
        });
        return { success: true, message: "참고사항이 삭제되었습니다." };
      }
    }
    return { success: false, message: "참고사항을 찾을 수 없습니다." };
  } catch (err) {
    return { success: false, message: sanitizeErrorMessage(err) };
  }
}

/**
 * 업무별 참고사항 목록 조회
 */
function getTaskReferences(taskId) {
  try {
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName("Task_References");
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var refs = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === taskId && String(data[i][6]) !== "DELETE" && String(data[i][6]) !== "UPDATE") {
        refs.push({
          refId: String(data[i][0]),
          content: String(data[i][2]),
          author: String(data[i][3]),
          createdAt: data[i][4] instanceof Date ? data[i][4].getTime() : null,
          updatedAt: data[i][5] instanceof Date ? data[i][5].getTime() : null
        });
      }
    }
    // 최신순 정렬
    refs.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    return refs;
  } catch (err) {
    return [];
  }
}

/** Task_References 시트 가져오기 (없으면 생성) */
function getOrCreateRefSheet(ss) {
  var sheet = ss.getSheetByName("Task_References");
  if (!sheet) {
    sheet = ss.insertSheet("Task_References");
    sheet.appendRow(["RefID", "TaskID", "Content", "Author", "CreatedAt", "UpdatedAt", "Action_Type"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 슬랙 DM 발송 (사용자명 기반)
 * @returns {Object} { ok, error, detail }
 */
function sendTaskDM(targetUserName, message) {
  var slackUserId = USER_NAME_TO_SLACK_ID[targetUserName];
  if (!slackUserId) {
    return { ok: false, error: "USER_NOT_MAPPED", detail: "사용자 '" + targetUserName + "'가 Slack ID 매핑 테이블에 없습니다." };
  }
  
  try {
    var token = getSlackToken();
    if (!token) return { ok: false, error: "TOKEN_EMPTY", detail: "SLACK_TOKEN이 설정되지 않았습니다." };

    // direct chat.postMessage (User ID를 channel로 사용)
    // conversations.open 스코프가 부족할 수 있으므로, 이미 유효성이 검증된 직접 발송 방식을 사용합니다.
    var postRes = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({ channel: slackUserId, text: message }),
      muteHttpExceptions: true
    });
    var postData = JSON.parse(postRes.getContentText());
    if (!postData.ok) return { ok: false, error: "POST_FAIL", detail: "chat.postMessage 실패: " + (postData.error || "unknown") };

    return { ok: true, detail: "발송 성공 (기기: " + (postData.channel || "DM") + ")" };


  } catch (e) {
    return { ok: false, error: "EXCEPTION", detail: e.toString() };
  }
}



/**
 * 시작예정일 기반 D-3, D-1, 당일 슬랙 DM 알림 트리거
 * (매일 오전 9시에 실행되도록 트리거 설정 필요)
 */
function triggerStartDateReminders() {
  try {
    var ss = getTargetSpreadsheet();
    var sheet = ss.getSheetByName("Tasks");
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayMs = today.getTime();

    for (var i = 1; i < data.length; i++) {
      var status = String(data[i][2] || "").trim();
      if (status === "완료" || status === "삭제됨") continue;

      var startDate = data[i][18]; // S열(index 18) = 시작예정일
      if (!(startDate instanceof Date)) continue;

      var sd = new Date(startDate);
      sd.setHours(0, 0, 0, 0);
      var diffDays = Math.round((sd.getTime() - todayMs) / 86400000);

      var assignee = String(data[i][6] || "").trim();
      var title = String(data[i][4] || "").trim();
      var taskId = String(data[i][0] || "");

      if (diffDays === 3) {
        sendTaskDM(assignee, "⏰ *D-3 알림*\n📝 " + title + " (" + taskId + ")\n📅 시작예정일: 3일 후");
      } else if (diffDays === 1) {
        sendTaskDM(assignee, "⏰ *D-1 알림*\n📝 " + title + " (" + taskId + ")\n📅 시작예정일: 내일!");
      } else if (diffDays === 0) {
        sendTaskDM(assignee, "🔔 *오늘 시작!*\n📝 " + title + " (" + taskId + ")\n📅 시작예정일이 오늘입니다. 화이팅! 💪");
      }
    }
  } catch (err) {
    console.error("triggerStartDateReminders Error:", err);
  }
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

// ═══════════════════════════════════════════
// 출근 브리핑
// ═══════════════════════════════════════════

/** 출근 브리핑 전체 업무를 볼 수 있는 관리자 목록 */
var CHECKIN_ADMIN_USERS = ["송용남", "정혜림", "김관수"];

/**
 * 출근 브리핑 — "출근" 키워드 입력 시 당일 업무 + 일정 요약 반환
 * AI API 미사용, 시트 직접 조회로 1~2초 내 응답
 * @param {string} userName 사용자 이름
 * @returns {{ success: boolean, response: string }}
 */
function handleCheckIn(userName) {
  try {
    var ss = getTargetSpreadsheet();
    var today = new Date();
    var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    var dayName = dayNames[today.getDay()];
    var isAdmin = CHECKIN_ADMIN_USERS.indexOf(userName) !== -1;

    // ── 1. 업무 수집 ──
    var todayDue = [];    // 오늘 마감
    var inProgress = [];  // 진행중
    var waiting = [];     // 대기

    var taskSheet = ss.getSheetByName("Tasks");
    if (taskSheet) {
      var tData = taskSheet.getDataRange().getValues();
      for (var i = 1; i < tData.length; i++) {
        var row = tData[i];
        var status = String(row[2] || "").trim();
        var title = String(row[4] || "").trim();
        var assignee = String(row[6] || "").trim();
        var project = String(row[3] || "").trim();
        var rawDue = row[8];
        var taskId = String(row[0] || "");

        if (!title || status === "삭제됨" || status === "완료") continue;

        // 권한 필터: 일반 사용자는 본인 업무만
        if (!isAdmin && assignee !== userName) continue;

        var dueStr = "";
        var isToday = false;
        if (rawDue instanceof Date && !isNaN(rawDue.getTime())) {
          dueStr = Utilities.formatDate(rawDue, Session.getScriptTimeZone(), "M/d");
          var dueYmd = Utilities.formatDate(rawDue, Session.getScriptTimeZone(), "yyyy-MM-dd");
          isToday = (dueYmd === todayStr);
        }

        var taskInfo = { id: taskId, title: title, project: project, assignee: assignee, dueStr: dueStr };

        if (isToday) {
          todayDue.push(taskInfo);
        } else if (status === "진행중") {
          inProgress.push(taskInfo);
        } else if (status === "대기") {
          waiting.push(taskInfo);
        }
      }
    }

    // ── 2. 오늘 일정 수집 ──
    var todayEvents = [];
    var calSheet = ss.getSheetByName("Calendar_Events");
    if (calSheet) {
      var cData = calSheet.getDataRange().getValues();
      for (var j = 1; j < cData.length; j++) {
        var startD = cData[j][4];
        if (startD instanceof Date) {
          var startYmd = Utilities.formatDate(startD, Session.getScriptTimeZone(), "yyyy-MM-dd");
          if (startYmd === todayStr) {
            var evTitle = String(cData[j][3] || "").trim();
            var startTime = Utilities.formatDate(startD, Session.getScriptTimeZone(), "HH:mm");
            var endD = cData[j][5];
            var endTime = endD instanceof Date
              ? Utilities.formatDate(endD, Session.getScriptTimeZone(), "HH:mm")
              : "";
            todayEvents.push({ title: evTitle, start: startTime, end: endTime });
          }
        }
      }
      todayEvents.sort(function(a, b) { return a.start < b.start ? -1 : 1; });
    }

    // ── 3. 브리핑 메시지 조립 ──
    var greetings = [
      "좋은 아침이에요! 오늘도 화이팅!",
      "오늘도 좋은 하루 보내세요!",
      "활기찬 하루 시작해볼까요?",
      "오늘 하루도 응원합니다!"
    ];
    var greeting = greetings[Math.floor(Math.random() * greetings.length)];

    var msg = "🌅 **" + userName + "**님, " + greeting + " 🐰\n\n";
    msg += "📋 **오늘의 업무 브리핑** (" + todayStr + " " + dayName + "요일)\n";
    msg += "━━━━━━━━━━━━━━━━━━\n\n";

    // 오늘 마감
    if (todayDue.length > 0) {
      msg += "🔴 **오늘 마감** (" + todayDue.length + "건)\n";
      for (var a = 0; a < todayDue.length; a++) {
        var t = todayDue[a];
        msg += "- " + t.title;
        if (isAdmin && t.assignee !== userName) msg += " _(담당: " + t.assignee + ")_";
        if (t.project) msg += " `" + t.project + "`";
        msg += "\n";
      }
      msg += "\n";
    }

    // 진행중
    if (inProgress.length > 0) {
      msg += "🟡 **진행중** (" + inProgress.length + "건)\n";
      for (var b = 0; b < inProgress.length; b++) {
        var p = inProgress[b];
        msg += "- " + p.title;
        if (p.dueStr) msg += " (마감: " + p.dueStr + ")";
        if (isAdmin && p.assignee !== userName) msg += " _(담당: " + p.assignee + ")_";
        msg += "\n";
      }
      msg += "\n";
    }

    // 대기
    if (waiting.length > 0) {
      msg += "⚪ **대기** (" + waiting.length + "건)\n";
      for (var c = 0; c < waiting.length; c++) {
        var w = waiting[c];
        msg += "- " + w.title;
        if (w.dueStr) msg += " (마감: " + w.dueStr + ")";
        if (isAdmin && w.assignee !== userName) msg += " _(담당: " + w.assignee + ")_";
        msg += "\n";
      }
      msg += "\n";
    }

    // 업무 없는 경우
    if (todayDue.length === 0 && inProgress.length === 0 && waiting.length === 0) {
      msg += "✨ 등록된 업무가 없어요. 여유로운 하루 되세요!\n\n";
    }

    // 오늘 일정
    if (todayEvents.length > 0) {
      msg += "📅 **오늘 일정** (" + todayEvents.length + "건)\n";
      for (var d = 0; d < todayEvents.length; d++) {
        var ev = todayEvents[d];
        msg += "- " + ev.start;
        if (ev.end) msg += "~" + ev.end;
        msg += " " + ev.title + "\n";
      }
      msg += "\n";
    }

    // 마무리
    var totalCount = todayDue.length + inProgress.length + waiting.length;
    if (totalCount > 0) {
      msg += "💪 오늘 할 일이 **" + totalCount + "건**이에요. 하나씩 해결해봐요!";
    }

    return { success: true, response: msg };

  } catch (err) {
    console.error("handleCheckIn Error:", err);
    return { success: true, response: "🌅 **" + userName + "**님, 좋은 아침이에요! 🐰\n\n⚠️ 업무 데이터를 불러오는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." };
  }
}
