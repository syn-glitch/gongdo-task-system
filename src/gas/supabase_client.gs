/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        supabase_client.gs
 * @version     v1.0.0
 * @updated     2026-03-16 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description Supabase REST API 공통 클라이언트 모듈.
 *              GAS에서 Supabase PostgreSQL을 호출하는 모든 함수가 이 모듈을 통해 접근한다.
 *
 * @change-summary
 *   AS-IS: 없음 (신규 파일)
 *   TO-BE: v1.0.0 — Supabase REST API CRUD + RPC + 에러 마스킹 + 듀얼 모드 지원
 *
 * @features
 *   - [추가] supabaseGet(table, query) — 조건 조회 (SELECT)
 *   - [추가] supabaseGetAll(table) — 전체 조회 (SELECT *)
 *   - [추가] supabaseInsert(table, data) — 단건/배치 삽입 (INSERT)
 *   - [추가] supabaseUpdate(table, match, data) — 조건 수정 (UPDATE)
 *   - [추가] supabaseDelete(table, match) — 조건 삭제 (DELETE)
 *   - [추가] supabaseRpc(functionName, args) — RPC 호출
 *   - [추가] 에러 로깅 시 API Key 마스킹 (QA S-4 반영)
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-16 | 에이다 BE | 최초 작성 — Phase 1 환경 설정
 * ============================================
 */

// ═══════════════════════════════════════════
// Supabase 접속 정보 (Script Properties에서 읽기)
// ═══════════════════════════════════════════

/**
 * Supabase 접속 정보를 Script Properties에서 가져온다.
 * 키가 없으면 에러를 던진다.
 * @returns {{ url: string, anonKey: string, serviceKey: string }}
 */
function getSupabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SUPABASE_URL");
  var anonKey = props.getProperty("SUPABASE_ANON_KEY");
  var serviceKey = props.getProperty("SUPABASE_SERVICE_KEY");

  if (!url || !anonKey) {
    throw new Error("Supabase 설정 누락: GAS Script Properties에 SUPABASE_URL, SUPABASE_ANON_KEY를 등록하세요.");
  }

  return { url: url, anonKey: anonKey, serviceKey: serviceKey || "" };
}

// ═══════════════════════════════════════════
// 내부 헬퍼
// ═══════════════════════════════════════════

/**
 * API Key를 마스킹하여 로그에 노출되지 않도록 한다. (QA S-4)
 * @param {string} key
 * @returns {string} 마스킹된 키 (앞 8자 + ***)
 */
function maskApiKey_(key) {
  if (!key || key.length < 12) return "***";
  return key.substring(0, 8) + "***";
}

/**
 * Supabase REST API 공통 요청 함수.
 * @param {string} endpoint — URL 경로 (예: "/rest/v1/tasks?status=eq.대기")
 * @param {Object} options — { method, payload, useServiceKey }
 * @returns {Object|Array} 파싱된 JSON 응답
 */
function supabaseFetch_(endpoint, options) {
  var config = getSupabaseConfig_();
  var opts = options || {};
  var method = opts.method || "get";
  var apiKey = opts.useServiceKey ? config.serviceKey : config.anonKey;

  if (!apiKey) {
    throw new Error("Supabase API 키 누락: " + (opts.useServiceKey ? "SERVICE_KEY" : "ANON_KEY"));
  }

  var fetchOptions = {
    method: method,
    headers: {
      "apikey": apiKey,
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || ""
    },
    muteHttpExceptions: true
  };

  if (opts.payload) {
    fetchOptions.payload = JSON.stringify(opts.payload);
  }

  // Prefer 헤더가 비어있으면 제거
  if (!fetchOptions.headers["Prefer"]) {
    delete fetchOptions.headers["Prefer"];
  }

  var url = config.url + endpoint;

  try {
    var response = UrlFetchApp.fetch(url, fetchOptions);
    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code >= 200 && code < 300) {
      if (!body || body.trim() === "") return null;
      return JSON.parse(body);
    }

    // 에러 응답 — API Key를 마스킹하여 로그 (QA S-4)
    var safeBody = body
      .replace(new RegExp(config.anonKey, "g"), maskApiKey_(config.anonKey))
      .replace(new RegExp(config.serviceKey, "g"), maskApiKey_(config.serviceKey));

    console.error("[Supabase " + code + "] " + method.toUpperCase() + " " + endpoint + " → " + safeBody);
    throw new Error("Supabase 요청 실패 (HTTP " + code + "): " + safeBody.substring(0, 200));

  } catch (e) {
    // UrlFetchApp 자체 에러 (네트워크 등)
    if (e.message && e.message.indexOf("Supabase 요청 실패") >= 0) throw e;

    var safeMsg = String(e.message || e)
      .replace(new RegExp(config.anonKey, "g"), maskApiKey_(config.anonKey))
      .replace(new RegExp(config.serviceKey || "NOKEY", "g"), maskApiKey_(config.serviceKey));

    console.error("[Supabase 네트워크 에러] " + safeMsg);
    throw new Error("Supabase 연결 실패: " + safeMsg.substring(0, 200));
  }
}

// ═══════════════════════════════════════════
// Public API — CRUD
// ═══════════════════════════════════════════

/**
 * SELECT — 조건 조회
 * @param {string} table — 테이블명 (예: "tasks")
 * @param {string} [query] — PostgREST 쿼리 문자열 (예: "status=eq.대기&order=created_at.desc")
 * @param {Object} [opts] — { useServiceKey: boolean }
 * @returns {Array} 조회 결과 배열
 */
function supabaseGet(table, query, opts) {
  var endpoint = "/rest/v1/" + table;
  if (query) endpoint += "?" + query;
  return supabaseFetch_(endpoint, {
    method: "get",
    useServiceKey: (opts && opts.useServiceKey) || false
  }) || [];
}

/**
 * SELECT * — 전체 조회
 * @param {string} table
 * @param {Object} [opts] — { useServiceKey: boolean }
 * @returns {Array}
 */
function supabaseGetAll(table, opts) {
  return supabaseGet(table, "select=*", opts);
}

/**
 * INSERT — 단건 또는 배치 삽입
 * @param {string} table
 * @param {Object|Array} data — 단건 객체 또는 배열
 * @param {Object} [opts] — { useServiceKey: boolean, upsert: boolean }
 * @returns {Object|Array} 삽입된 레코드
 */
function supabaseInsert(table, data, opts) {
  var prefer = "return=representation";
  if (opts && opts.upsert) {
    prefer += ",resolution=merge-duplicates";
  }
  return supabaseFetch_("/rest/v1/" + table, {
    method: "post",
    payload: data,
    prefer: prefer,
    useServiceKey: (opts && opts.useServiceKey) || false
  });
}

/**
 * UPDATE — 조건 수정
 * @param {string} table
 * @param {string} match — PostgREST 매칭 조건 (예: "id=eq.1")
 * @param {Object} data — 수정할 필드
 * @param {Object} [opts] — { useServiceKey: boolean }
 * @returns {Object|Array} 수정된 레코드
 */
function supabaseUpdate(table, match, data, opts) {
  return supabaseFetch_("/rest/v1/" + table + "?" + match, {
    method: "patch",
    payload: data,
    prefer: "return=representation",
    useServiceKey: (opts && opts.useServiceKey) || false
  });
}

/**
 * DELETE — 조건 삭제
 * @param {string} table
 * @param {string} match — PostgREST 매칭 조건 (예: "id=eq.1")
 * @param {Object} [opts] — { useServiceKey: boolean }
 * @returns {Object|Array|null}
 */
function supabaseDelete(table, match, opts) {
  return supabaseFetch_("/rest/v1/" + table + "?" + match, {
    method: "delete",
    prefer: "return=representation",
    useServiceKey: (opts && opts.useServiceKey) || false
  });
}

/**
 * RPC — 서버사이드 함수 호출
 * @param {string} functionName — Supabase function 이름
 * @param {Object} [args] — 함수 인자
 * @param {Object} [opts] — { useServiceKey: boolean }
 * @returns {Object|Array}
 */
function supabaseRpc(functionName, args, opts) {
  return supabaseFetch_("/rest/v1/rpc/" + functionName, {
    method: "post",
    payload: args || {},
    useServiceKey: (opts && opts.useServiceKey) || false
  });
}

// ═══════════════════════════════════════════
// 연결 테스트
// ═══════════════════════════════════════════

/**
 * Supabase 연결 테스트. GAS 메뉴나 디버깅에서 사용.
 * @returns {string} 결과 메시지
 */
function testSupabaseConnection() {
  try {
    var result = supabaseGet("projects", "select=id&limit=1");
    var msg = "✅ Supabase 연결 성공! projects 테이블 접근 확인.";
    console.log(msg);
    return msg;
  } catch (e) {
    var msg = "❌ Supabase 연결 실패: " + e.message;
    console.error(msg);
    return msg;
  }
}
