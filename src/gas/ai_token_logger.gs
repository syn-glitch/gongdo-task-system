/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        ai_token_logger.gs
 * @version     v1.0.0
 * @updated     2026-03-10 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description Claude API 토큰 사용량 수집·기록·조회 모듈.
 *              공통 래퍼(callClaudeAPI)로 모든 AI 호출의 토큰 사용량을 자동 기록하고,
 *              프론트엔드 대시보드용 통계 조회 API를 제공한다.
 *
 * @change-summary
 *   AS-IS: 토큰 사용량 추적 없음 (API 응답의 usage 필드를 버림)
 *   TO-BE: 모든 Claude API 호출의 토큰 사용량을 TokenUsage 시트에 자동 기록 + 조회 API
 *
 * @features
 *   - [추가] callClaudeAPI() — Claude API 공통 래퍼 (usage 자동 추출 + fail-safe 로깅)
 *   - [추가] logTokenUsage() — TokenUsage 시트에 사용량 행 추가
 *   - [추가] getTokenUsageStats() — 기간별/사용자별/기능별 통계 조회 API
 *   - [추가] ensureTokenUsageSheet() — TokenUsage 시트 자동 생성
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-10 | 에이다 BE | 최초 작성 (BNK-2026-03-10-001)
 * ============================================
 */

// ═══════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════

/** 토큰 사용량 시트명 */
var TOKEN_USAGE_SHEET_NAME = "TokenUsage";

/** 토큰 대시보드 접근 허용 사용자 */
var ALLOWED_TOKEN_VIEWERS = ["송용남", "정혜림"];

/** 토큰 단가 기본값 ($/1M tokens) — PropertiesService에서 오버라이드 가능 */
var DEFAULT_TOKEN_PRICE_INPUT = 3;    // Sonnet input
var DEFAULT_TOKEN_PRICE_OUTPUT = 15;  // Sonnet output

// ═══════════════════════════════════════════
// 1. Claude API 공통 래퍼
// ═══════════════════════════════════════════

/**
 * Claude API 호출 공통 래퍼.
 * 기존 UrlFetchApp.fetch() 호출을 대체하여 토큰 사용량을 자동 기록한다.
 *
 * @param {string} url API 엔드포인트 URL
 * @param {Object} options UrlFetchApp.fetch()에 전달할 옵션 (method, headers, payload 등)
 * @param {string} functionName 호출 함수명 (로깅용, 예: "processJudyWebChat")
 * @param {string} userName 사용자명 (로깅용)
 * @returns {Object} JSON 파싱된 API 응답 결과
 */
function callClaudeAPI(url, options, functionName, userName) {
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  // fail-safe: 로깅 실패해도 AI 응답은 반드시 반환
  try {
    if (result && result.usage) {
      var inputTokens = result.usage.input_tokens || 0;
      var outputTokens = result.usage.output_tokens || 0;
      // payload에서 모델명 추출
      var model = "";
      try {
        var payloadObj = JSON.parse(options.payload);
        model = payloadObj.model || "";
      } catch (e) { /* ignore */ }
      logTokenUsage(functionName, userName, inputTokens, outputTokens, model);
    }
  } catch (logErr) {
    console.error("[TokenLogger] 로깅 실패 (AI 응답은 정상 반환):", logErr.message);
  }

  return result;
}

// ═══════════════════════════════════════════
// 2. 토큰 사용량 기록
// ═══════════════════════════════════════════

/**
 * TokenUsage 시트에 사용량 1행을 추가한다.
 * 시트가 없으면 자동 생성한다.
 *
 * @param {string} functionName 호출 함수명
 * @param {string} userName 사용자명
 * @param {number} inputTokens 입력 토큰 수
 * @param {number} outputTokens 출력 토큰 수
 * @param {string} model 모델명
 */
function logTokenUsage(functionName, userName, inputTokens, outputTokens, model) {
  var sheet = ensureTokenUsageSheet();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    timestampStr,                    // A: timestamp
    dateStr,                         // B: date
    functionName || "",              // C: functionName
    userName || "",                  // D: userName
    inputTokens || 0,               // E: inputTokens
    outputTokens || 0,              // F: outputTokens
    (inputTokens || 0) + (outputTokens || 0), // G: totalTokens
    model || ""                      // H: model
  ]);
}

/**
 * TokenUsage 시트가 없으면 헤더와 함께 자동 생성한다.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureTokenUsageSheet() {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName(TOKEN_USAGE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(TOKEN_USAGE_SHEET_NAME);
    sheet.appendRow([
      "timestamp", "date", "functionName", "userName",
      "inputTokens", "outputTokens", "totalTokens", "model"
    ]);
    // 헤더 서식
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    // 열 너비 조정
    sheet.setColumnWidth(1, 160); // timestamp
    sheet.setColumnWidth(2, 100); // date
    sheet.setColumnWidth(3, 200); // functionName
    sheet.setColumnWidth(4, 80);  // userName
    sheet.setColumnWidth(5, 100); // inputTokens
    sheet.setColumnWidth(6, 100); // outputTokens
    sheet.setColumnWidth(7, 100); // totalTokens
    sheet.setColumnWidth(8, 220); // model
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ═══════════════════════════════════════════
// 3. 토큰 사용량 통계 조회 API
// ═══════════════════════════════════════════

/**
 * 프론트엔드 📈 토큰 탭에서 호출하는 통계 조회 API.
 * 백엔드에서 권한 검증 후 기간별 집계 데이터를 반환한다.
 *
 * @param {number} period 조회 기간 (일수: 1, 7, 15, 30)
 * @param {string} userName 호출자 이름 (권한 검증)
 * @returns {Object} { daily, byFunction, byUser, summary } 또는 { error }
 */
function getTokenUsageStats(period, userName) {
  // 권한 검증
  if (!ALLOWED_TOKEN_VIEWERS.includes(userName)) {
    return { error: "접근 권한이 없습니다." };
  }

  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName(TOKEN_USAGE_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      daily: [],
      byFunction: [],
      byUser: [],
      summary: { totalTokens: 0, totalCalls: 0, estimatedCostUSD: 0, dailyAvgTokens: 0 },
      recentLogs: []
    };
  }

  // 전체 데이터 읽기 (헤더 제외)
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  // 기간 필터
  var now = new Date();
  now.setHours(23, 59, 59, 999);
  var cutoff = new Date(now.getTime() - (period * 24 * 60 * 60 * 1000));
  cutoff.setHours(0, 0, 0, 0);

  var filtered = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowDate;
    if (row[1] instanceof Date) {
      rowDate = row[1];
    } else {
      rowDate = new Date(row[1]);
    }
    if (rowDate >= cutoff) {
      // timestamp를 문자열로 변환 (google.script.run 직렬화 안전)
      var tsStr = row[0];
      if (row[0] instanceof Date) {
        tsStr = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      }
      filtered.push({
        timestamp: tsStr,
        date: Utilities.formatDate(
          rowDate instanceof Date && !isNaN(rowDate) ? rowDate : new Date(),
          Session.getScriptTimeZone(), "yyyy-MM-dd"
        ),
        functionName: row[2] || "",
        userName: row[3] || "",
        inputTokens: Number(row[4]) || 0,
        outputTokens: Number(row[5]) || 0,
        totalTokens: Number(row[6]) || 0,
        model: row[7] || ""
      });
    }
  }

  // ── 일별 집계 ──
  var dailyMap = {};
  for (var j = 0; j < filtered.length; j++) {
    var r = filtered[j];
    if (!dailyMap[r.date]) {
      dailyMap[r.date] = { date: r.date, inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0 };
    }
    dailyMap[r.date].inputTokens += r.inputTokens;
    dailyMap[r.date].outputTokens += r.outputTokens;
    dailyMap[r.date].totalTokens += r.totalTokens;
    dailyMap[r.date].calls += 1;
  }
  var daily = Object.keys(dailyMap).sort().map(function(k) { return dailyMap[k]; });

  // ── 기능별 집계 ──
  var funcMap = {};
  for (var k = 0; k < filtered.length; k++) {
    var fr = filtered[k];
    var fn = fr.functionName || "unknown";
    if (!funcMap[fn]) {
      funcMap[fn] = { name: fn, totalTokens: 0, calls: 0 };
    }
    funcMap[fn].totalTokens += fr.totalTokens;
    funcMap[fn].calls += 1;
  }
  var byFunction = Object.keys(funcMap).map(function(fk) { return funcMap[fk]; });
  byFunction.sort(function(a, b) { return b.totalTokens - a.totalTokens; });

  // ── 사용자별 집계 ──
  var userMap = {};
  for (var m = 0; m < filtered.length; m++) {
    var ur = filtered[m];
    var un = ur.userName || "unknown";
    if (!userMap[un]) {
      userMap[un] = { name: un, totalTokens: 0, calls: 0 };
    }
    userMap[un].totalTokens += ur.totalTokens;
    userMap[un].calls += 1;
  }
  var byUser = Object.keys(userMap).map(function(uk) { return userMap[uk]; });
  byUser.sort(function(a, b) { return b.totalTokens - a.totalTokens; });

  // ── 비율(pct) 계산 ──
  var grandTotal = 0;
  for (var n = 0; n < filtered.length; n++) { grandTotal += filtered[n].totalTokens; }

  for (var p = 0; p < byFunction.length; p++) {
    byFunction[p].pct = grandTotal > 0 ? Math.round(byFunction[p].totalTokens / grandTotal * 100) : 0;
  }
  for (var q = 0; q < byUser.length; q++) {
    byUser[q].pct = grandTotal > 0 ? Math.round(byUser[q].totalTokens / grandTotal * 100) : 0;
  }

  // ── 비용 환산 ──
  var totalInput = 0, totalOutput = 0;
  for (var s = 0; s < filtered.length; s++) {
    totalInput += filtered[s].inputTokens;
    totalOutput += filtered[s].outputTokens;
  }

  var priceInput = DEFAULT_TOKEN_PRICE_INPUT;
  var priceOutput = DEFAULT_TOKEN_PRICE_OUTPUT;
  try {
    var props = PropertiesService.getScriptProperties();
    var pi = props.getProperty("TOKEN_PRICE_INPUT");
    var po = props.getProperty("TOKEN_PRICE_OUTPUT");
    if (pi) priceInput = Number(pi);
    if (po) priceOutput = Number(po);
  } catch (e) { /* 기본값 사용 */ }

  var costUSD = (totalInput / 1000000 * priceInput) + (totalOutput / 1000000 * priceOutput);

  // ── 최근 로그 (최신 50건) ──
  var recentLogs = filtered.slice(-50).reverse().map(function(lg) {
    return {
      timestamp: lg.timestamp,
      functionName: lg.functionName,
      userName: lg.userName,
      inputTokens: lg.inputTokens,
      outputTokens: lg.outputTokens,
      totalTokens: lg.totalTokens
    };
  });

  // ── summary ──
  var totalCalls = filtered.length;
  var effectiveDays = period;
  var dailyAvg = effectiveDays > 0 ? Math.round(grandTotal / effectiveDays) : 0;

  return {
    daily: daily,
    byFunction: byFunction,
    byUser: byUser,
    summary: {
      totalTokens: grandTotal,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCalls: totalCalls,
      estimatedCostUSD: Math.round(costUSD * 1000) / 1000,
      dailyAvgTokens: dailyAvg
    },
    recentLogs: recentLogs
  };
}
