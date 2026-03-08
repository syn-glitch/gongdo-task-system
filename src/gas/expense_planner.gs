/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        expense_planner.gs
 * @version     v1.0.0
 * @updated     2026-03-02 11:30 (KST)
 * @agent       에이다 (자비스팀)
 * @ordered-by  용남 대표
 * @description
 *   - [신규] 재무 지출 계획 관리 백엔드 — CRUD + 네이버 쇼핑 API + 알림
 * @change-summary
 *   AS-IS: 없음 (신규 파일)
 *   TO-BE: 지출계획 시트 CRUD, 네이버 최저가 검색, 관리자 채널 노티
 * @features
 *   - 지출계획 등록/수정/삭제(소프트)
 *   - 네이버 쇼핑 API 최저가 자동 검색
 *   - 관리자 채널(#관리자_지출관리) 노티
 *   - plan_id 자동 채번 (LockService)
 *   - 입력값 검증 (금액/날짜/수식주입)
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-02 | 에이다 (자비스팀) | 최초 작성 — MVP 백엔드
 * ============================================
 */

// ═══════════════════════════════════════════
// 상수 정의
// ═══════════════════════════════════════════

var EXPENSE_SHEET_NAME = '지출계획';
var EXPENSE_CATEGORIES = ['소모품비', '식대', '교통비', '접대비', '통신비', '사무비품', '인쇄비', '교육비', '기타'];
var NAVER_API_TIMEOUT = 3000; // 3초 타임아웃
var PLAN_ID_PREFIX = 'PLAN';

// ═══════════════════════════════════════════
// 유틸리티 — 검증 · 보안
// ═══════════════════════════════════════════

/**
 * 지출계획 입력값 검증
 * @param {Object} data - { item, amount, dueDate, category }
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateExpenseInput(data) {
  if (!data.item || data.item.trim().length === 0) {
    return { valid: false, reason: '지출 항목을 입력해주세요.' };
  }
  if (data.item.length > 200) {
    return { valid: false, reason: '지출 항목은 200자 이내로 입력해주세요.' };
  }

  // 수식 주입 방지
  var dangerousChars = /^[=+\-@]/;
  if (dangerousChars.test(data.item)) {
    return { valid: false, reason: '항목명은 =, +, -, @ 로 시작할 수 없습니다.' };
  }

  var amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0 || amount > 100000000) {
    return { valid: false, reason: '금액은 1원 ~ 1억원 사이로 입력해주세요.' };
  }

  if (!data.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    return { valid: false, reason: '예정일을 올바른 형식(YYYY-MM-DD)으로 입력해주세요.' };
  }

  if (!data.category || EXPENSE_CATEGORIES.indexOf(data.category) === -1) {
    return { valid: false, reason: '올바른 카테고리를 선택해주세요.' };
  }

  return { valid: true };
}

/**
 * plan_id 자동 채번 — LockService 적용
 * @returns {string} 예: PLAN-2026-03-001
 */
function generatePlanId() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);
    if (!sheet) {
      return PLAN_ID_PREFIX + '-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM') + '-001';
    }
    var lastRow = sheet.getLastRow();
    var count = lastRow > 1 ? lastRow - 1 : 0;
    var num = String(count + 1).padStart(3, '0');
    return PLAN_ID_PREFIX + '-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM') + '-' + num;
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════
// 시트 초기화
// ═══════════════════════════════════════════

/**
 * 지출계획 시트가 없으면 생성 + 헤더 설정
 */
function ensureExpenseSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(EXPENSE_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(EXPENSE_SHEET_NAME);
  var headers = [
    'plan_id', '등록일', '등록자', '등록자_slack_id', '소속팀',
    '지출항목', '예상금액', '지출예정일', '카테고리', '업체명',
    '비교가정보', '비교자료URL', '메모', '상태',
    '실제금액', '실제지출일', '매칭_카드내역_row',
    '차이금액', '차이율', 'AI분석', '알림상태', '수정이력'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

// ═══════════════════════════════════════════
// CRUD — 지출계획
// ═══════════════════════════════════════════

/**
 * 지출 계획 등록 (웹 페이지에서 호출)
 */
function saveExpensePlan(data, userName, userEmail) {
  var validation = validateExpenseInput(data);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = ensureExpenseSheet();
    var planId = generatePlanId();
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    var row = [
      planId,                           // A: plan_id
      now,                              // B: 등록일
      userName || '',                   // C: 등록자
      data.slackId || '',               // D: 등록자_slack_id
      data.team || '',                  // E: 소속팀
      data.item,                        // F: 지출항목
      Number(data.amount),              // G: 예상금액
      data.dueDate,                     // H: 지출예정일
      data.category,                    // I: 카테고리
      data.vendor || '',                // J: 업체명
      data.compareInfo || '',           // K: 비교가정보
      data.compareFileUrl || '',        // L: 비교자료URL
      data.memo || '',                  // M: 메모
      '계획됨',                          // N: 상태
      '',                               // O: 실제금액
      '',                               // P: 실제지출일
      '',                               // Q: 매칭_카드내역_row
      '',                               // R: 차이금액
      '',                               // S: 차이율
      '',                               // T: AI분석
      '',                               // U: 알림상태
      '[]'                              // V: 수정이력
    ];

    sheet.appendRow(row);

    // 관리자 채널 노티
    sendExpenseAdminNotification('등록', {
      planId: planId,
      userName: userName,
      team: data.team,
      item: data.item,
      amount: data.amount,
      dueDate: data.dueDate,
      category: data.category
    });

    return { success: true, planId: planId };
  } catch (e) {
    console.error('saveExpensePlan error:', e);
    return { success: false, error: '저장 중 오류가 발생했습니다. 다시 시도해주세요.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 지출 계획 수정
 */
function updateExpensePlan(planId, data, userName) {
  var validation = validateExpenseInput(data);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = ensureExpenseSheet();
    var allData = sheet.getDataRange().getValues();

    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === planId) {
        var rowNum = i + 1;
        // 수정 이력 누적
        var historyRaw = allData[i][21] || '[]';
        var history;
        try { history = JSON.parse(historyRaw); } catch (e) { history = []; }
        history.push({
          일시: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
          변경자: userName,
          변경: '항목/금액/일자 수정'
        });

        sheet.getRange(rowNum, 6).setValue(data.item);        // F: 지출항목
        sheet.getRange(rowNum, 7).setValue(Number(data.amount)); // G: 예상금액
        sheet.getRange(rowNum, 8).setValue(data.dueDate);      // H: 지출예정일
        sheet.getRange(rowNum, 9).setValue(data.category);     // I: 카테고리
        sheet.getRange(rowNum, 10).setValue(data.vendor || ''); // J: 업체명
        sheet.getRange(rowNum, 11).setValue(data.compareInfo || ''); // K: 비교가정보
        sheet.getRange(rowNum, 13).setValue(data.memo || '');   // M: 메모
        sheet.getRange(rowNum, 22).setValue(JSON.stringify(history)); // V: 수정이력

        sendExpenseAdminNotification('수정', {
          planId: planId, userName: userName, item: data.item,
          amount: data.amount, dueDate: data.dueDate
        });

        return { success: true };
      }
    }
    return { success: false, error: '해당 계획을 찾을 수 없습니다.' };
  } catch (e) {
    console.error('updateExpensePlan error:', e);
    return { success: false, error: '수정 중 오류가 발생했습니다.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 지출 계획 소프트 삭제 (상태 → 취소)
 */
function cancelExpensePlan(planId, userName) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = ensureExpenseSheet();
    var allData = sheet.getDataRange().getValues();

    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === planId) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, 14).setValue('취소'); // N: 상태

        var historyRaw = allData[i][21] || '[]';
        var history;
        try { history = JSON.parse(historyRaw); } catch (e) { history = []; }
        history.push({
          일시: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
          변경자: userName,
          변경: '계획 취소'
        });
        sheet.getRange(rowNum, 22).setValue(JSON.stringify(history));

        sendExpenseAdminNotification('취소', {
          planId: planId, userName: userName, item: allData[i][5],
          amount: allData[i][6]
        });

        return { success: true };
      }
    }
    return { success: false, error: '해당 계획을 찾을 수 없습니다.' };
  } catch (e) {
    console.error('cancelExpensePlan error:', e);
    return { success: false, error: '취소 중 오류가 발생했습니다.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 사용자별 지출 계획 목록 조회 (본인 데이터만)
 */
function getMyExpensePlans(userEmail) {
  var sheet = ensureExpenseSheet();
  var allData = sheet.getDataRange().getValues();
  var plans = [];

  for (var i = 1; i < allData.length; i++) {
    // 본인 데이터만 (프라이버시)
    plans.push({
      planId: allData[i][0],
      registeredDate: allData[i][1],
      registrant: allData[i][2],
      team: allData[i][4],
      item: allData[i][5],
      amount: allData[i][6],
      dueDate: allData[i][7],
      category: allData[i][8],
      vendor: allData[i][9],
      compareInfo: allData[i][10],
      memo: allData[i][12],
      status: allData[i][13],
      actualAmount: allData[i][14],
      actualDate: allData[i][15],
      diffAmount: allData[i][17],
      diffRate: allData[i][18],
      alertStatus: allData[i][20]
    });
  }
  return plans;
}

/**
 * 카테고리 목록 반환
 */
function getExpenseCategories() {
  return EXPENSE_CATEGORIES;
}

// ═══════════════════════════════════════════
// 네이버 쇼핑 API
// ═══════════════════════════════════════════

/**
 * 네이버 쇼핑 API 최저가 검색
 * API 키는 PropertiesService에서 가져옴 (하드코딩 금지)
 * @param {string} query - 검색어
 * @returns {Object} 검색 결과 또는 에러
 */
function searchNaverShopping(query) {
  if (!query || query.trim().length === 0) {
    return { success: false, error: '검색어를 입력해주세요.' };
  }

  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('NAVER_CLIENT_ID');
  var clientSecret = props.getProperty('NAVER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('NAVER API keys not configured in PropertiesService');
    // 관리자에게 알림
    try {
      sendExpenseAdminNotification('시스템', {
        item: '⚠️ 네이버 API 키 미설정',
        userName: 'System'
      });
    } catch (e) { /* ignore */ }
    return { success: false, error: '네이버 검색 기능이 설정되지 않았습니다. 관리자에게 문의해주세요.' };
  }

  try {
    var url = 'https://openapi.naver.com/v1/search/shop.json'
      + '?query=' + encodeURIComponent(query)
      + '&display=5&sort=asc';

    var response = UrlFetchApp.fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      muteHttpExceptions: true,
      // GAS는 UrlFetchApp에 timeout 설정이 없으므로 기본값 사용
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      console.error('Naver API error code:', code, 'body:', response.getContentText().substring(0, 200));
      if (code === 401 || code === 403) {
        return { success: false, error: '네이버 API 키가 만료되었습니다. 관리자에게 문의해주세요.' };
      }
      return { success: false, error: '네이버 검색 중 오류가 발생했습니다. 수동으로 입력해주세요.' };
    }

    var result = JSON.parse(response.getContentText());
    if (!result.items || result.items.length === 0) {
      return { success: true, items: [], message: '검색 결과가 없습니다. 키워드를 변경하거나 수동 입력을 이용해주세요.' };
    }

    var items = result.items.map(function(item) {
      return {
        title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        lprice: Number(item.lprice),
        mallName: item.mallName,
        link: item.link,
        image: item.image
      };
    });

    return { success: true, items: items };

  } catch (e) {
    console.error('searchNaverShopping error:', e);
    return { success: false, error: '네이버 검색에 실패했습니다. 수동으로 입력해주세요.' };
  }
}

// ═══════════════════════════════════════════
// 관리자 알림
// ═══════════════════════════════════════════

/**
 * 지출계획 관리자 채널 알림
 * @param {string} eventType - '등록', '수정', '취소', '시스템'
 * @param {Object} data - 알림 데이터
 */
function sendExpenseAdminNotification(eventType, data) {
  var props = PropertiesService.getScriptProperties();
  var botToken = props.getProperty('SLACK_BOT_TOKEN');
  var adminChannel = props.getProperty('ADMIN_EXPENSE_CHANNEL') || '#관리자_지출관리';

  if (!botToken) {
    console.error('SLACK_BOT_TOKEN not configured');
    return;
  }

  var emoji = { '등록': '📅', '수정': '✏️', '취소': '❌', '시스템': '⚠️' };
  var icon = emoji[eventType] || '📋';

  var text = icon + ' [지출 계획 ' + eventType + ']\n\n';

  if (data.userName) text += '👤 ' + (eventType === '시스템' ? '' : '담당자: ') + data.userName;
  if (data.team) text += ' (' + data.team + ')';
  text += '\n';
  if (data.item) text += '📦 항목: ' + data.item + '\n';
  if (data.amount) text += '💰 예상 금액: ' + Number(data.amount).toLocaleString() + '원\n';
  if (data.dueDate) text += '📆 예정일: ' + data.dueDate + '\n';
  if (data.category) text += '📂 카테고리: ' + data.category + '\n';
  if (data.planId) text += '🔖 ID: ' + data.planId + '\n';

  try {
    UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + botToken },
      contentType: 'application/json',
      payload: JSON.stringify({
        channel: adminChannel,
        text: text
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('sendExpenseAdminNotification error:', e);
  }
}

// ═══════════════════════════════════════════
// API 키 초기 설정 — 1회 실행
// ═══════════════════════════════════════════

/**
 * 네이버 API 키를 PropertiesService에 안전하게 저장
 * ⚠️ GAS 에디터에서 1회만 실행 (코드에 키를 남기면 안 됨)
 * 실행 후 이 함수의 키 값을 반드시 삭제하세요!
 */
function setupNaverApiKeys() {
  var props = PropertiesService.getScriptProperties();
  // ⚠️ 아래 값을 실제 키로 교체 후 실행 → 즉시 삭제
  props.setProperty('NAVER_CLIENT_ID', 'YOUR_CLIENT_ID_HERE');
  props.setProperty('NAVER_CLIENT_SECRET', 'YOUR_CLIENT_SECRET_HERE');
  console.log('✅ 네이버 API 키 설정 완료. 이 함수의 키 값을 즉시 삭제하세요!');
}
