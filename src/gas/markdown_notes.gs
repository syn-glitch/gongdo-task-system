/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        markdown_notes.gs
 * @version     v1.0.1
 * @updated     2026-03-08 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description 마크다운 노트 CRUD API 및 챗봇 RAG 검색 API.
 *              Notes_v2 시트에 노트를 저장하고, 챗봇이 사용자 노트를 검색할 수 있도록 한다.
 *
 * @change-summary
 *   AS-IS: v1.0.0 — saveNote() 수정 시 작성자 권한 검증 누락
 *   TO-BE: v1.0.1 — saveNote() 작성자 권한 검증 추가 (QA F-1 해소)
 *
 * @features
 *   - [추가] ensureNotesSheet_() — Notes_v2 시트 자동 생성
 *   - [추가] saveNote(noteData) — 노트 저장 (신규/수정 겸용)
 *   - [추가] getNoteList(userName) — 노트 목록 조회
 *   - [추가] getNoteById(noteId) — 단일 노트 상세 조회
 *   - [추가] deleteNote(noteId, userName) — 노트 삭제
 *   - [추가] searchNotesForRAG(userName, query) — 챗봇 RAG용 노트 검색
 *   - [수정] saveNote() — 수정 시 작성자 일치 검증 추가 (QA F-1)
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.1 | 2026-03-08 | 에이다 BE | saveNote() 작성자 권한 검증 추가 (QA F-1)
 * v1.0.0 | 2026-03-08 | 에이다 BE | 최초 작성 — Notes_v2 CRUD + RAG 검색 API
 * ============================================
 */

// ═══════════════════════════════════════════
// Notes_v2 시트 관리
// ═══════════════════════════════════════════

/**
 * Notes_v2 시트가 없으면 자동 생성하고 헤더를 설정합니다.
 * 컬럼: A:ID | B:제목 | C:본문(마크다운) | D:태그 | E:연결업무ID | F:작성자 | G:작성일 | H:수정일
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureNotesSheet_() {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheetByName("Notes_v2");
  if (!sheet) {
    sheet = ss.insertSheet("Notes_v2");
    sheet.appendRow(["ID", "제목", "본문", "태그", "연결업무ID", "작성자", "작성일", "수정일"]);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(3, 400); // 본문 컬럼 넓게
  }
  return sheet;
}

/**
 * 고유 노트 ID 생성 (타임스탬프 기반)
 */
function generateNoteId_() {
  return "N" + new Date().getTime();
}

// ═══════════════════════════════════════════
// CRUD API
// ═══════════════════════════════════════════

/**
 * 노트 저장 (신규 생성 또는 기존 수정)
 * @param {Object} noteData - { id?, title, body, tags?, linkedTaskId?, userName }
 * @returns {Object} { success, noteId, message }
 */
function saveNote(noteData) {
  try {
    if (!noteData || !noteData.userName) {
      return { success: false, message: "인증된 사용자가 없습니다." };
    }
    if (!noteData.body || !noteData.body.trim()) {
      return { success: false, message: "노트 내용이 비어있습니다." };
    }

    // 50,000자 하드 리밋
    if (noteData.body.length > 50000) {
      return { success: false, message: "노트 내용이 50,000자를 초과합니다. 내용을 줄여주세요." };
    }

    var sheet = ensureNotesSheet_();
    var now = new Date();
    var nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    var title = noteData.title || noteData.body.substring(0, 30).replace(/\n/g, " ");
    var tags = noteData.tags || "";
    var linkedTaskId = noteData.linkedTaskId || "";

    if (noteData.id) {
      // 수정 모드: 기존 노트 찾아서 업데이트
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === noteData.id) {
          // QA F-1: 작성자 권한 검증
          if (data[i][5] !== noteData.userName) {
            return { success: false, message: "본인이 작성한 노트만 수정할 수 있습니다." };
          }
          var row = i + 1;
          sheet.getRange(row, 2).setValue(title);
          sheet.getRange(row, 3).setValue(noteData.body);
          sheet.getRange(row, 4).setValue(tags);
          sheet.getRange(row, 5).setValue(linkedTaskId);
          sheet.getRange(row, 8).setValue(nowStr);
          return { success: true, noteId: noteData.id, message: "노트가 수정되었습니다." };
        }
      }
      return { success: false, message: "수정할 노트를 찾을 수 없습니다." };
    } else {
      // 신규 생성
      var noteId = generateNoteId_();
      sheet.appendRow([noteId, title, noteData.body, tags, linkedTaskId, noteData.userName, nowStr, nowStr]);
      return { success: true, noteId: noteId, message: "노트가 저장되었습니다." };
    }
  } catch (e) {
    console.error("saveNote Error:", e);
    return { success: false, message: "노트 저장 중 오류가 발생했습니다." };
  }
}

/**
 * 노트 목록 조회 (최신순)
 * @param {string} userName
 * @returns {Object} { success, notes: [{id, title, tags, createdAt, updatedAt, preview}] }
 */
function getNoteList(userName) {
  try {
    var sheet = ensureNotesSheet_();
    var data = sheet.getDataRange().getValues();
    var notes = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][5] === userName) {
        notes.push({
          id: data[i][0],
          title: data[i][1],
          tags: data[i][3],
          createdAt: data[i][6],
          updatedAt: data[i][7],
          preview: (data[i][2] || "").substring(0, 80).replace(/\n/g, " ")
        });
      }
    }

    // 최신순 정렬 (수정일 기준)
    notes.sort(function(a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });

    return { success: true, notes: notes };
  } catch (e) {
    console.error("getNoteList Error:", e);
    return { success: false, notes: [], message: "노트 목록을 불러오지 못했습니다." };
  }
}

/**
 * 단일 노트 상세 조회
 * @param {string} noteId
 * @returns {Object} { success, note: {id, title, body, tags, linkedTaskId, userName, createdAt, updatedAt} }
 */
function getNoteById(noteId) {
  try {
    var sheet = ensureNotesSheet_();
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === noteId) {
        return {
          success: true,
          note: {
            id: data[i][0],
            title: data[i][1],
            body: data[i][2],
            tags: data[i][3],
            linkedTaskId: data[i][4],
            userName: data[i][5],
            createdAt: data[i][6],
            updatedAt: data[i][7]
          }
        };
      }
    }
    return { success: false, message: "노트를 찾을 수 없습니다." };
  } catch (e) {
    console.error("getNoteById Error:", e);
    return { success: false, message: "노트 조회 중 오류가 발생했습니다." };
  }
}

/**
 * 노트 삭제
 * @param {string} noteId
 * @param {string} userName - 본인 확인용
 * @returns {Object} { success, message }
 */
function deleteNote(noteId, userName) {
  try {
    var sheet = ensureNotesSheet_();
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === noteId) {
        if (data[i][5] !== userName) {
          return { success: false, message: "본인이 작성한 노트만 삭제할 수 있습니다." };
        }
        sheet.deleteRow(i + 1);
        return { success: true, message: "노트가 삭제되었습니다." };
      }
    }
    return { success: false, message: "삭제할 노트를 찾을 수 없습니다." };
  } catch (e) {
    console.error("deleteNote Error:", e);
    return { success: false, message: "노트 삭제 중 오류가 발생했습니다." };
  }
}

// ═══════════════════════════════════════════
// RAG 검색 API (챗봇 연동)
// ═══════════════════════════════════════════

/**
 * 챗봇 RAG용 노트 검색 — 키워드 + 메타데이터 필터링
 * 챗봇 시스템에서 호출하여 사용자 노트 컨텍스트를 AI에 전달합니다.
 * @param {string} userName
 * @param {string} query - 검색 키워드
 * @returns {string} 마크다운 형식의 검색 결과 텍스트
 */
function searchNotesForRAG(userName, query) {
  try {
    var sheet = ensureNotesSheet_();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return "저장된 마크다운 노트가 없습니다.";

    var queryLower = (query || "").toLowerCase();
    var results = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][5] !== userName) continue;

      var title = String(data[i][1] || "");
      var body = String(data[i][2] || "");
      var tags = String(data[i][3] || "");

      // 키워드 매칭 (제목, 본문, 태그)
      if (!queryLower ||
          title.toLowerCase().indexOf(queryLower) !== -1 ||
          body.toLowerCase().indexOf(queryLower) !== -1 ||
          tags.toLowerCase().indexOf(queryLower) !== -1) {
        results.push({
          title: title,
          body: body.substring(0, 500), // RAG 컨텍스트는 500자로 제한
          tags: tags,
          date: data[i][6]
        });
      }
    }

    if (results.length === 0) return "'" + query + "' 관련 마크다운 노트를 찾지 못했습니다.";

    // 최대 5건만 전달 (토큰 절약)
    var text = "📝 [사용자 마크다운 노트 검색 결과 — " + results.length + "건]\n";
    var limit = Math.min(results.length, 5);
    for (var j = 0; j < limit; j++) {
      var r = results[j];
      text += "\n--- 노트: " + r.title + " (" + r.date + ") ---\n";
      if (r.tags) text += "태그: " + r.tags + "\n";
      text += r.body + "\n";
    }

    if (results.length > 5) {
      text += "\n(외 " + (results.length - 5) + "건 더 있음)";
    }

    return text;
  } catch (e) {
    console.error("searchNotesForRAG Error:", e);
    return "노트 검색 중 오류가 발생했습니다.";
  }
}
