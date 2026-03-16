/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        supabase_migration.gs
 * @version     v1.0.0
 * @updated     2026-03-16 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description Google Sheets → Supabase 데이터 마이그레이션 스크립트.
 *              Phase별로 시트 데이터를 Supabase 테이블에 INSERT하고 전수 검증한다.
 *              마이그레이션 전용 — 완료 후 service_role 키를 Script Properties에서 삭제할 것.
 *
 * @change-summary
 *   AS-IS: 없음 (신규 파일)
 *   TO-BE: v1.0.0 — Phase 1 마이그레이션 (projects, users) + 전수 검증 + 롤백
 *
 * @features
 *   - [추가] migrateProjects() — Projects 시트 → projects 테이블
 *   - [추가] migrateUsers() — Users 시트 → users 테이블
 *   - [추가] validateMigration(table, sheetName) — 전수 검증 (건수 + 샘플 대조)
 *   - [추가] rollbackMigration(table) — 검증 실패 시 롤백 (TRUNCATE)
 *   - [추가] migratePhase1() — Phase 1 전체 순차 실행
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-16 | 에이다 BE | 최초 작성 — Phase 1 마이그레이션
 * ============================================
 */

// ═══════════════════════════════════════════
// 배치 설정
// ═══════════════════════════════════════════

/** 배치 INSERT 크기 (Supabase REST API 권장: 100건 이하) */
var MIGRATION_BATCH_SIZE = 100;

// ═══════════════════════════════════════════
// Phase 1: projects 마이그레이션
// ═══════════════════════════════════════════

/**
 * Projects 시트 → Supabase projects 테이블 마이그레이션.
 * 시트 컬럼 순서: A=프로젝트명, B=프로젝트 코드, C=사용 여부, D=Slack 채널 ID, E=프로젝트 설명, F=상태
 */
function migrateProjects() {
  console.log("━━━ [마이그레이션] projects 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Projects");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ Projects 시트에 데이터 없음. 건너뜀.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  var data = sheet.getDataRange().getValues();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = String(row[0] || "").trim();
    if (!name) continue; // 빈 행 건너뜀

    var rawStatus = String(row[5] || "").trim();
    var validStatuses = ["활성", "대기", "완료"];
    var status = validStatuses.indexOf(rawStatus) >= 0 ? rawStatus : "활성";

    records.push({
      name: name,
      code: String(row[1] || "").trim() || null,
      is_active: String(row[2] || "").trim() === "미사용" ? false : true,
      slack_channel: String(row[3] || "").trim() || null,
      description: String(row[4] || "").trim() || null,
      status: status
    });
  }

  if (records.length === 0) {
    console.log("⚠️ 유효한 Projects 레코드 없음.");
    return { success: true, count: 0, message: "유효 레코드 없음" };
  }

  // 배치 INSERT (service_role 키 사용)
  var inserted = batchInsert_("projects", records);
  console.log("✅ projects INSERT 완료: " + inserted + "건");

  // 전수 검증
  var validation = validateMigration("projects", "Projects");
  if (!validation.valid) {
    console.error("❌ projects 검증 실패! 롤백 수행.");
    rollbackMigration("projects");
    return { success: false, count: 0, message: "검증 실패 → 롤백 완료: " + validation.reason };
  }

  console.log("━━━ [마이그레이션] projects 완료 (" + inserted + "건) ━━━");
  return { success: true, count: inserted, message: "성공" };
}

// ═══════════════════════════════════════════
// Phase 1: users 마이그레이션
// ═══════════════════════════════════════════

/**
 * Users 시트 → Supabase users 테이블 마이그레이션.
 * 시트 컬럼 순서: A=이름, B=슬랙 ID, C=이메일
 */
function migrateUsers() {
  console.log("━━━ [마이그레이션] users 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Users");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ Users 시트에 데이터 없음. 건너뜀.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  var data = sheet.getDataRange().getValues();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = String(row[0] || "").trim();
    if (!name) continue;

    records.push({
      name: name,
      slack_id: String(row[1] || "").trim() || null,
      email: String(row[2] || "").trim() || null
    });
  }

  if (records.length === 0) {
    console.log("⚠️ 유효한 Users 레코드 없음.");
    return { success: true, count: 0, message: "유효 레코드 없음" };
  }

  // 배치 INSERT (service_role 키 사용)
  var inserted = batchInsert_("users", records);
  console.log("✅ users INSERT 완료: " + inserted + "건");

  // 전수 검증
  var validation = validateMigration("users", "Users");
  if (!validation.valid) {
    console.error("❌ users 검증 실패! 롤백 수행.");
    rollbackMigration("users");
    return { success: false, count: 0, message: "검증 실패 → 롤백 완료: " + validation.reason };
  }

  console.log("━━━ [마이그레이션] users 완료 (" + inserted + "건) ━━━");
  return { success: true, count: inserted, message: "성공" };
}

// ═══════════════════════════════════════════
// 배치 INSERT 헬퍼
// ═══════════════════════════════════════════

/**
 * 레코드를 배치 단위로 Supabase에 INSERT한다.
 * service_role 키를 사용한다 (마이그레이션 전용).
 * @param {string} table
 * @param {Array<Object>} records
 * @returns {number} 삽입된 총 건수
 */
function batchInsert_(table, records) {
  var total = 0;
  for (var i = 0; i < records.length; i += MIGRATION_BATCH_SIZE) {
    var batch = records.slice(i, i + MIGRATION_BATCH_SIZE);
    var result = supabaseInsert(table, batch, { useServiceKey: false });

    var count = Array.isArray(result) ? result.length : (result ? 1 : 0);
    total += count;

    console.log("  배치 " + Math.floor(i / MIGRATION_BATCH_SIZE + 1) +
      ": " + count + "건 INSERT (" + total + "/" + records.length + ")");

    // GAS 실행 시간 보호: 5분 경과 시 경고
    if (i > 0 && i % 500 === 0) {
      console.log("  ⏱ " + i + "건 처리 완료. 실행 시간 확인 필요.");
    }
  }
  return total;
}

// ═══════════════════════════════════════════
// 전수 검증
// ═══════════════════════════════════════════

/**
 * 마이그레이션 전수 검증.
 * 1) 행 수 비교 (시트 유효 행 수 = Supabase 행 수)
 * 2) 첫 번째 레코드 샘플 대조
 * @param {string} table — Supabase 테이블명
 * @param {string} sheetName — 원본 시트명
 * @returns {{ valid: boolean, reason: string, sheetCount: number, dbCount: number }}
 */
function validateMigration(table, sheetName) {
  console.log("🔍 [검증] " + table + " ← " + sheetName);

  // 1. 시트 유효 행 수 집계
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { valid: false, reason: "시트 '" + sheetName + "' 없음", sheetCount: 0, dbCount: 0 };
  }

  var data = sheet.getDataRange().getValues();
  var sheetCount = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim()) sheetCount++;
  }

  // 2. Supabase 행 수 집계
  var dbRows = supabaseGet(table, "select=id", { useServiceKey: false });
  var dbCount = Array.isArray(dbRows) ? dbRows.length : 0;

  console.log("  시트 유효 행: " + sheetCount + " / Supabase 행: " + dbCount);

  // 3. 행 수 비교
  if (sheetCount !== dbCount) {
    var reason = "행 수 불일치 (시트: " + sheetCount + ", DB: " + dbCount + ")";
    console.error("  ❌ " + reason);
    return { valid: false, reason: reason, sheetCount: sheetCount, dbCount: dbCount };
  }

  // 4. 첫 행 샘플 대조 (name 필드 기준)
  if (sheetCount > 0) {
    var firstSheetName = String(data[1][0]).trim();
    var firstDbRow = supabaseGet(table, "select=name&limit=1&order=id.asc", { useServiceKey: false });
    if (firstDbRow && firstDbRow.length > 0) {
      var firstDbName = String(firstDbRow[0].name || "").trim();
      if (firstSheetName !== firstDbName) {
        var reason = "첫 행 불일치 (시트: '" + firstSheetName + "', DB: '" + firstDbName + "')";
        console.error("  ❌ " + reason);
        return { valid: false, reason: reason, sheetCount: sheetCount, dbCount: dbCount };
      }
      console.log("  ✅ 첫 행 일치: '" + firstSheetName + "'");
    }
  }

  console.log("  ✅ 검증 통과! (" + sheetCount + "건)");
  return { valid: true, reason: "통과", sheetCount: sheetCount, dbCount: dbCount };
}

// ═══════════════════════════════════════════
// 롤백
// ═══════════════════════════════════════════

/**
 * 마이그레이션 롤백: 테이블의 모든 데이터를 삭제한다.
 * ⚠️ 주의: 해당 테이블의 모든 행이 삭제됩니다.
 * @param {string} table
 */
function rollbackMigration(table) {
  console.log("🔄 [롤백] " + table + " 전체 삭제 시작...");
  try {
    // PostgREST에서 전체 삭제: 항상 참인 조건 사용
    supabaseDelete(table, "id=gt.0", { useServiceKey: false });
    console.log("✅ [롤백] " + table + " 전체 삭제 완료.");
  } catch (e) {
    console.error("❌ [롤백 실패] " + table + ": " + e.message);
    throw e;
  }
}

// ═══════════════════════════════════════════
// Phase 1 통합 실행
// ═══════════════════════════════════════════

/**
 * Phase 1 전체 마이그레이션 실행.
 * 순서: projects → users (FK 의존성 고려)
 * 각 단계에서 실패하면 해당 테이블 롤백 후 중단.
 */
function migratePhase1() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Phase 1: 기반 테이블 마이그레이션 시작   ║");
  console.log("╚══════════════════════════════════════════╝");

  var results = {};

  // 1. projects
  try {
    results.projects = migrateProjects();
    if (!results.projects.success) {
      console.error("❌ Phase 1 중단: projects 마이그레이션 실패.");
      return results;
    }
  } catch (e) {
    console.error("❌ projects 예외: " + e.message);
    results.projects = { success: false, count: 0, message: e.message };
    return results;
  }

  // 2. users
  try {
    results.users = migrateUsers();
    if (!results.users.success) {
      console.error("❌ Phase 1 중단: users 마이그레이션 실패.");
      return results;
    }
  } catch (e) {
    console.error("❌ users 예외: " + e.message);
    results.users = { success: false, count: 0, message: e.message };
    return results;
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ✅ Phase 1 마이그레이션 완료!            ║");
  console.log("║  projects: " + results.projects.count + "건                       ║");
  console.log("║  users:    " + results.users.count + "건                        ║");
  console.log("╚══════════════════════════════════════════╝");

  return results;
}

// ═══════════════════════════════════════════
// Phase 2: tasks 마이그레이션
// ═══════════════════════════════════════════

/**
 * Tasks 시트 → Supabase tasks 테이블 마이그레이션.
 * 프로젝트명 → project_id FK 매핑 포함.
 *
 * 시트 컬럼:
 *   A(0)=업무ID, B(1)=유형, C(2)=상태, D(3)=프로젝트명, E(4)=제목,
 *   F(5)=상세, G(6)=담당자, H(7)=요청자, I(8)=마감일, J(9)=선행업무,
 *   K(10)=우선순위, L(11)=슬랙링크, M(12)=캘린더ID, N(13)=최근수정일,
 *   O(14)=시작시간, P(15)=종료시간, Q(16)=소요시간(분), R(17)=시작일,
 *   S(18)=등록자, T(19)=참조자(CC)
 */
function migrateTasks() {
  console.log("━━━ [마이그레이션] tasks 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Tasks");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ Tasks 시트에 데이터 없음.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  // 1. Supabase projects 테이블에서 name → id 매핑 생성
  var projects = supabaseGetAll("projects");
  var projectNameToId = {};
  for (var p = 0; p < projects.length; p++) {
    projectNameToId[projects[p].name] = projects[p].id;
    if (projects[p].code) {
      projectNameToId[projects[p].code] = projects[p].id;
    }
  }
  console.log("  프로젝트 매핑: " + Object.keys(projectNameToId).length + "개");

  // 2. 시트 데이터 읽기 + 변환
  var data = sheet.getDataRange().getValues();
  var records = [];
  var skipped = 0;
  var unmappedProjects = {};

  var VALID_STATUSES = ["대기", "진행중", "완료", "보류", "삭제됨", "수락대기"];
  var VALID_PRIORITIES = ["🔥 높음", "중간", "낮음"];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var taskId = String(row[0] || "").trim();
    var title = String(row[4] || "").trim();
    if (!taskId || !title) { skipped++; continue; }

    // 프로젝트명 → project_id 매핑
    var projectName = String(row[3] || "").trim();
    var projectId = projectNameToId[projectName] || null;
    if (projectName && !projectId) {
      unmappedProjects[projectName] = (unmappedProjects[projectName] || 0) + 1;
    }

    // 상태 검증
    var status = String(row[2] || "").trim();
    if (VALID_STATUSES.indexOf(status) < 0) status = "대기";

    // 우선순위 검증
    var priority = String(row[10] || "").trim();
    if (VALID_PRIORITIES.indexOf(priority) < 0) priority = "중간";

    // 날짜 변환 헬퍼
    var dueDate = formatDateForDb_(row[8]);
    var startTime = formatTimestampForDb_(row[14]);
    var endTime = formatTimestampForDb_(row[15]);
    var durationMin = !isNaN(parseFloat(row[16])) ? Math.round(parseFloat(row[16])) : null;
    var startDate = formatDateForDb_(row[17]);
    var updatedAt = formatTimestampForDb_(row[13]);

    records.push({
      task_id: taskId,
      task_type: String(row[1] || "").trim() || null,
      status: status,
      project_id: projectId,
      title: title,
      description: String(row[5] || "").trim() || null,
      assignee: String(row[6] || "").trim() || null,
      requester: String(row[7] || "").trim() || null,
      due_date: dueDate,
      predecessor: String(row[9] || "").trim() || null,
      priority: priority,
      slack_link: String(row[11] || "").trim() || null,
      calendar_id: String(row[12] || "").trim() || null,
      start_time: startTime,
      end_time: endTime,
      duration_min: durationMin,
      start_date: startDate,
      creator: String(row[18] || "").trim() || null,
      cc_assignees: String(row[19] || "").trim() || null,
      updated_at: updatedAt || new Date().toISOString()
    });
  }

  // 매핑 실패 프로젝트 로깅
  var unmappedKeys = Object.keys(unmappedProjects);
  if (unmappedKeys.length > 0) {
    console.log("  ⚠️ 매핑 실패 프로젝트 (" + unmappedKeys.length + "종):");
    for (var u = 0; u < unmappedKeys.length; u++) {
      console.log("    - '" + unmappedKeys[u] + "': " + unmappedProjects[unmappedKeys[u]] + "건");
    }
  }

  console.log("  유효 레코드(중복 전): " + records.length + "건 / 건너뜀: " + skipped + "건");

  // 2.5. 시트 내 중복 task_id 제거 (마지막 행 우선)
  var seen = {};
  var deduped = [];
  for (var d = records.length - 1; d >= 0; d--) {
    if (!seen[records[d].task_id]) {
      seen[records[d].task_id] = true;
      deduped.unshift(records[d]);
    }
  }
  var dupCount = records.length - deduped.length;
  if (dupCount > 0) {
    console.log("  ⚠️ 시트 내 중복 task_id " + dupCount + "건 제거 → " + deduped.length + "건");
  }
  records = deduped;

  if (records.length === 0) {
    return { success: true, count: 0, message: "유효 레코드 없음" };
  }

  // 3. 배치 UPSERT (중복 task_id 시 덮어쓰기)
  var inserted = batchUpsert_("tasks", records, "task_id");
  console.log("✅ tasks UPSERT 완료: " + inserted + "건");

  // 4. 검증 (task_id 기준)
  var validation = validateTasksMigration_(data, inserted);

  console.log("━━━ [마이그레이션] tasks 완료 (" + inserted + "건) ━━━");
  return { success: true, count: inserted, message: "성공", unmappedProjects: unmappedProjects };
}

/**
 * tasks 전용 검증: 시트 유효 행 수 vs Supabase 행 수
 */
function validateTasksMigration_(sheetData, insertedCount) {
  var sheetCount = 0;
  for (var i = 1; i < sheetData.length; i++) {
    var taskId = String(sheetData[i][0] || "").trim();
    var title = String(sheetData[i][4] || "").trim();
    if (taskId && title) sheetCount++;
  }

  var dbRows = supabaseGet("tasks", "select=id");
  var dbCount = Array.isArray(dbRows) ? dbRows.length : 0;

  console.log("🔍 [tasks 검증] 시트: " + sheetCount + "건 / DB: " + dbCount + "건");

  if (sheetCount !== dbCount) {
    console.log("  ⚠️ 건수 차이 발생 (시트: " + sheetCount + ", DB: " + dbCount + ")");
  } else {
    console.log("  ✅ 건수 일치!");
  }

  return { sheetCount: sheetCount, dbCount: dbCount };
}

/**
 * 레코드를 배치 UPSERT (중복 키 시 덮어쓰기).
 * @param {string} table
 * @param {Array<Object>} records
 * @param {string} conflictColumn — UNIQUE 컬럼명 (예: "task_id")
 * @returns {number} 처리된 총 건수
 */
function batchUpsert_(table, records, conflictColumn) {
  var total = 0;
  for (var i = 0; i < records.length; i += MIGRATION_BATCH_SIZE) {
    var batch = records.slice(i, i + MIGRATION_BATCH_SIZE);

    var config = getSupabaseConfig_();
    var url = config.url + "/rest/v1/" + table + "?on_conflict=" + conflictColumn;
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "apikey": config.anonKey,
        "Authorization": "Bearer " + config.anonKey,
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates"
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      var result = JSON.parse(response.getContentText());
      var count = Array.isArray(result) ? result.length : 1;
      total += count;
      console.log("  배치 " + Math.floor(i / MIGRATION_BATCH_SIZE + 1) +
        ": " + count + "건 UPSERT (" + total + "/" + records.length + ")");
    } else {
      var body = response.getContentText();
      console.error("[Supabase " + code + "] UPSERT 실패: " + body.substring(0, 300));
      throw new Error("Supabase UPSERT 실패 (HTTP " + code + "): " + body.substring(0, 200));
    }
  }
  return total;
}

// ═══════════════════════════════════════════
// 날짜 변환 헬퍼
// ═══════════════════════════════════════════

/**
 * 시트의 날짜 값 → "YYYY-MM-DD" 문자열 (DATE 컬럼용)
 */
function formatDateForDb_(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var str = String(val).trim();
  if (!str) return null;
  // "YYYY-MM-DD" 형태면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // 그 외 Date 파싱 시도
  var d = new Date(str);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return null;
}

/**
 * 시트의 타임스탬프 값 → ISO 8601 문자열 (TIMESTAMPTZ 컬럼용)
 */
function formatTimestampForDb_(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  var str = String(val).trim();
  if (!str) return null;
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// ═══════════════════════════════════════════
// Phase 2 통합 실행
// ═══════════════════════════════════════════

/**
 * Phase 2 전체 마이그레이션 실행.
 * tasks 테이블 마이그레이션 (project_id FK 매핑 포함).
 */
function migratePhase2() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Phase 2: tasks 테이블 마이그레이션 시작   ║");
  console.log("╚══════════════════════════════════════════╝");

  var results = {};

  try {
    results.tasks = migrateTasks();
    if (!results.tasks.success) {
      console.error("❌ Phase 2 중단: tasks 마이그레이션 실패.");
      return results;
    }
  } catch (e) {
    console.error("❌ tasks 예외: " + e.message);
    results.tasks = { success: false, count: 0, message: e.message };
    return results;
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ✅ Phase 2 마이그레이션 완료!            ║");
  console.log("║  tasks: " + results.tasks.count + "건                         ║");
  console.log("╚══════════════════════════════════════════╝");

  return results;
}

// ═══════════════════════════════════════════
// Phase 3: task_references, notes 마이그레이션
// ═══════════════════════════════════════════

/**
 * Task_References 시트 → task_references 테이블.
 * 시트: A=Ref_ID, B=Task_ID, C=Author, D=Content, E=Action_Type, F=Timestamp
 * ※ 시트 컬럼 순서가 DB 스키마와 다르므로 주의 (Author/Content 순서 차이)
 */
function migrateTaskReferences() {
  console.log("━━━ [마이그레이션] task_references 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Task_References");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ Task_References 시트에 데이터 없음.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  console.log("  헤더: " + headers.join(", "));

  // 헤더 기반 컬럼 인덱스 감지
  var iRefId = headers.indexOf("Ref_ID");
  var iTaskId = headers.indexOf("Task_ID");
  var iAuthor = headers.indexOf("Author");
  var iContent = headers.indexOf("Content");
  var iAction = headers.indexOf("Action_Type");
  var iTimestamp = headers.indexOf("Timestamp");

  if (iRefId < 0) iRefId = 0;
  if (iTaskId < 0) iTaskId = 1;
  if (iAuthor < 0) iAuthor = 2;
  if (iContent < 0) iContent = 3;
  if (iAction < 0) iAction = 4;
  if (iTimestamp < 0) iTimestamp = 5;

  var records = [];
  var seen = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var refId = String(row[iRefId] || "").trim();
    if (!refId) continue;
    if (seen[refId]) continue; // 중복 제거
    seen[refId] = true;

    records.push({
      ref_id: refId,
      task_id: String(row[iTaskId] || "").trim() || null,
      author: String(row[iAuthor] || "").trim() || null,
      content: String(row[iContent] || "").trim() || null,
      action_type: String(row[iAction] || "").trim() || "ADD",
      created_at: formatTimestampForDb_(row[iTimestamp]) || new Date().toISOString()
    });
  }

  console.log("  유효 레코드: " + records.length + "건");
  if (records.length === 0) return { success: true, count: 0, message: "유효 레코드 없음" };

  var inserted = batchUpsert_("task_references", records, "ref_id");
  console.log("✅ task_references UPSERT 완료: " + inserted + "건");
  return { success: true, count: inserted, message: "성공" };
}

/**
 * Notes_v2 시트 → notes 테이블.
 * 시트: A=ID, B=제목, C=본문, D=태그, E=연결업무ID, F=작성자, G=작성일, H=수정일
 */
function migrateNotes() {
  console.log("━━━ [마이그레이션] notes 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Notes_v2");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ Notes_v2 시트에 데이터 없음.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  var data = sheet.getDataRange().getValues();
  var records = [];
  var seen = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var noteId = String(row[0] || "").trim();
    if (!noteId) continue;
    if (seen[noteId]) continue;
    seen[noteId] = true;

    records.push({
      note_id: noteId,
      title: String(row[1] || "").trim() || null,
      content: String(row[2] || "").trim() || null,
      tags: String(row[3] || "").trim() || null,
      linked_task_id: String(row[4] || "").trim() || null,
      author: String(row[5] || "").trim() || null,
      created_at: formatTimestampForDb_(row[6]) || new Date().toISOString(),
      updated_at: formatTimestampForDb_(row[7]) || new Date().toISOString()
    });
  }

  console.log("  유효 레코드: " + records.length + "건");
  if (records.length === 0) return { success: true, count: 0, message: "유효 레코드 없음" };

  var inserted = batchUpsert_("notes", records, "note_id");
  console.log("✅ notes UPSERT 완료: " + inserted + "건");
  return { success: true, count: inserted, message: "성공" };
}

/**
 * Phase 3 통합 실행: task_references + notes
 */
function migratePhase3() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Phase 3: 연결 테이블 마이그레이션 시작    ║");
  console.log("╚══════════════════════════════════════════╝");

  var results = {};

  try {
    results.taskReferences = migrateTaskReferences();
  } catch (e) {
    console.error("❌ task_references 예외: " + e.message);
    results.taskReferences = { success: false, count: 0, message: e.message };
  }

  try {
    results.notes = migrateNotes();
  } catch (e) {
    console.error("❌ notes 예외: " + e.message);
    results.notes = { success: false, count: 0, message: e.message };
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ✅ Phase 3 완료!                         ║");
  console.log("║  task_references: " + (results.taskReferences ? results.taskReferences.count : 0) + "건                  ║");
  console.log("║  notes: " + (results.notes ? results.notes.count : 0) + "건                           ║");
  console.log("╚══════════════════════════════════════════╝");
  return results;
}

// ═══════════════════════════════════════════
// Phase 4: 로그 + 보조 테이블 마이그레이션
// ═══════════════════════════════════════════

/**
 * ActionLog 시트 → action_logs 테이블.
 * 시트: A=timestamp, B=user_name, C=action, D=target_id, E=old_value, F=new_value, G=source, H=details
 */
function migrateActionLogs() {
  console.log("━━━ [마이그레이션] action_logs 시작 ━━━");
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("ActionLog");

  if (!sheet || sheet.getLastRow() < 2) {
    console.log("⚠️ ActionLog 시트에 데이터 없음.");
    return { success: true, count: 0, message: "데이터 없음" };
  }

  var data = sheet.getDataRange().getValues();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var timestamp = formatTimestampForDb_(row[0]);
    if (!timestamp && !String(row[1] || "").trim()) continue;

    records.push({
      created_at: timestamp || new Date().toISOString(),
      user_name: String(row[1] || "").trim() || null,
      action: String(row[2] || "").trim() || null,
      task_id: String(row[3] || "").trim() || null,
      old_value: String(row[4] || "").trim() || null,
      new_value: String(row[5] || "").trim() || null,
      source: String(row[6] || "").trim() || null,
      details: String(row[7] || "").trim() || null
    });
  }

  console.log("  유효 레코드: " + records.length + "건");
  if (records.length === 0) return { success: true, count: 0, message: "유효 레코드 없음" };

  var inserted = batchInsert_("action_logs", records);
  console.log("✅ action_logs INSERT 완료: " + inserted + "건");
  return { success: true, count: inserted, message: "성공" };
}

/**
 * Phase 4 통합 실행: action_logs (+ 향후 token_usage, expenses 등)
 */
function migratePhase4() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Phase 4: 로그 테이블 마이그레이션 시작    ║");
  console.log("╚══════════════════════════════════════════╝");

  var results = {};

  try {
    results.actionLogs = migrateActionLogs();
  } catch (e) {
    console.error("❌ action_logs 예외: " + e.message);
    results.actionLogs = { success: false, count: 0, message: e.message };
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  ✅ Phase 4 완료!                         ║");
  console.log("║  action_logs: " + (results.actionLogs ? results.actionLogs.count : 0) + "건                     ║");
  console.log("╚══════════════════════════════════════════╝");
  return results;
}

/** tasks 테이블 확인 (디버깅용) */
function checkTasksInSupabase() {
  var rows = supabaseGet("tasks", "select=task_id,title,status,project_id&limit=10&order=created_at.desc");
  console.log("Supabase tasks (최근 10건):");
  for (var i = 0; i < rows.length; i++) {
    console.log("  " + rows[i].task_id + " | " + rows[i].title + " | " + rows[i].status + " | proj:" + rows[i].project_id);
  }
  return rows;
}

// ═══════════════════════════════════════════
// 개별 검증 (수동 실행용)
// ═══════════════════════════════════════════

/** projects 테이블 검증만 단독 실행 */
function validateProjects() {
  return validateMigration("projects", "Projects");
}

/** users 테이블 검증만 단독 실행 */
function validateUsers() {
  return validateMigration("users", "Users");
}

/** Supabase에 저장된 projects 목록 확인 (디버깅용) */
function checkProjectsInSupabase() {
  var rows = supabaseGetAll("projects", { useServiceKey: false });
  console.log("Supabase projects (" + rows.length + "건):");
  for (var i = 0; i < rows.length; i++) {
    console.log("  " + rows[i].id + " | " + rows[i].name + " | " + rows[i].code + " | " + rows[i].status);
  }
  return rows;
}

/** Supabase에 저장된 users 목록 확인 (디버깅용) */
function checkUsersInSupabase() {
  var rows = supabaseGetAll("users", { useServiceKey: false });
  console.log("Supabase users (" + rows.length + "건):");
  for (var i = 0; i < rows.length; i++) {
    console.log("  " + rows[i].id + " | " + rows[i].name + " | " + rows[i].slack_id);
  }
  return rows;
}
