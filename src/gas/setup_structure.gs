// [🚨 복구용] 이 코드를 전체 복사해서 GAS의 'Setup Structure.gs'에 그대로 덮어쓰기 하세요!
/**
 * [코드 버전]: v2.1 (Projects 시트 자동 코드 안내 트리거 추가)
 * [기능 설명]: 1. 시트 구조 안전 업데이트 (setupDatabase) — 기존 데이터 보호 + 변경 미리보기
 *             2. 드롭다운 메뉴 적용 (applyValidations)
 *             3. 메뉴바 통합 관리 (onOpen)
 *             4. 프로젝트 코드 누락 시 자동 안내 (onEdit)
 */

const DB_CONFIG = {
  TASKS: {
    NAME: "Tasks",
    HEADERS: [
      "업무 ID", "업무 유형", "상태", "프로젝트", "업무 제목",
      "상세 내용", "담당자", "요청자", "마감일", "선행 업무",
      "우선순위", "슬랙 링크", "캘린더 ID", "최근 수정일", "시작 시간",
      "종료 시간", "소요 시간(분)"
    ]
  },
  PROJECTS: {
    NAME: "Projects",
    HEADERS: ["프로젝트명", "프로젝트 코드", "사용 여부", "Slack 채널 ID", "프로젝트 설명", "상태"]
  },
  USERS: {
    NAME: "Users",
    HEADERS: ["이름", "슬랙 ID", "이메일"]
  }
};

/**
 * [onEdit 트리거] Projects 시트에서 프로젝트명을 입력할 때 코드가 비어있으면 안내 팝업 자동 표시
 * - 조건: Projects 시트의 A열(프로젝트명) 편집 + B열(코드)이 비어있으면
 * - 동작: 토스트 + 대화상자로 코드 자동 추천 메뉴 안내
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    
    // Projects 시트의 A열(프로젝트명) 입력 시에만 반응
    if (sheet.getName() !== DB_CONFIG.PROJECTS.NAME) return;
    if (range.getColumn() !== 1) return; // A열이 아니면 무시
    if (range.getRow() < 2) return;      // 헤더 행은 무시
    
    const projectName = String(range.getValue()).trim();
    if (!projectName) return; // 비어있으면 무시
    
    // B열(코드)이 비어있는지 확인
    const codeCell = sheet.getRange(range.getRow(), 2);
    const existingCode = String(codeCell.getValue()).trim();
    if (existingCode) return; // 코드가 이미 있으면 무시
    
    // 가운데 팝업으로 안내 + [지금 바로 생성] 클릭 시 자동 실행
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      "🔔 프로젝트 코드 누락",
      "'" + projectName + "' 프로젝트에 코드가 없습니다.\n\n" +
      "코드가 없으면 슬랙 업무 등록 드롭다운에 표시되지 않습니다.\n\n" +
      "[확인] 클릭 시 코드를 지금 바로 자동 생성합니다.",
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response === ui.Button.OK) {
      suggestProjectCodes(); // 확인 클릭 시 코드 자동 추천 함수 즉시 실행
    }

  } catch (err) {
    // onEdit 내에서 에러가 나도 시트 작동에 영향 없도로 조용히 무시
    console.error("onEdit 에러:", err);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 업무 시스템 관리')
    .addItem('1단계: 시트 구조 자동 생성', 'setupDatabase')
    .addItem('🔧 드롭다운 메뉴 적용하기', 'applyValidations')
    .addItem('🔠 프로젝트 코드 자동 추천', 'suggestProjectCodes')
    .addSeparator()
    .addItem('📊 대시보드 자동 생성 (새로고침)', 'generateDashboard')
    .addSeparator()
    .addItem('🔔 슬랙 연결 테스트', 'testFirstProjectAlert')
    .addItem('🐞 현재 행 강제 알림 (디버깅)', 'debugCurrentRow')
    .addSeparator()
    .addItem('🔐 (최종) 구글 드라이브 권한 1초만에 뚫기', 'forceDriveAuth')
    .addToUi();
}

/**
 * 1단계: 시트 구조 안전 업데이트
 * - 실행 전 변경 사항을 미리보기로 보여주고, 사용자 확인 후에만 적용
 * - 기존 데이터가 있는 컬럼은 절대 건드리지 않고, 새 컬럼만 오른쪽에 추가
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // 1단계: 변경 사항 분석 (실제 수정 없이 미리보기만)
  const allChanges = [];
  for (const key in DB_CONFIG) {
    const config = DB_CONFIG[key];
    const changes = analyzeSheetChanges(ss, config.NAME, config.HEADERS);
    if (changes.hasChanges) {
      allChanges.push(changes);
    }
  }
  
  // 변경 사항이 없으면 바로 종료
  if (allChanges.length === 0) {
    ui.alert("✅ 최신 상태", "모든 시트가 이미 최신 구조입니다. 변경할 사항이 없습니다.", ui.ButtonSet.OK);
    return;
  }
  
  // 2단계: 변경 사항 요약 생성
  let summary = "📋 아래 변경 사항을 적용하시겠습니까?\n\n";
  
  for (const change of allChanges) {
    summary += "【 " + change.sheetName + " 시트 】\n";
    
    if (change.isNew) {
      summary += "  🆕 시트 새로 생성 (컬럼 " + change.newHeaders.length + "개)\n";
      summary += "  → " + change.newHeaders.join(", ") + "\n";
    } else {
      if (change.addedColumns.length > 0) {
        summary += "  ➕ 추가될 컬럼: " + change.addedColumns.join(", ") + "\n";
      }
      if (change.dataRowCount > 0) {
        summary += "  ⚠️ 현재 데이터 " + change.dataRowCount + "행 존재 — 기존 데이터는 보존됩니다\n";
      }
    }
    summary += "\n";
  }
  
  summary += "※ 기존 컬럼과 데이터는 절대 삭제되지 않습니다.";
  
  // 3단계: 사용자 확인
  const response = ui.alert("🔧 시트 구조 업데이트", summary, ui.ButtonSet.OK_CANCEL);
  
  if (response !== ui.Button.OK) {
    ui.alert("❌ 취소됨", "변경 사항이 적용되지 않았습니다.", ui.ButtonSet.OK);
    return;
  }
  
  // 4단계: 실제 적용
  for (const key in DB_CONFIG) {
    const config = DB_CONFIG[key];
    safeUpdateSheet(ss, config.NAME, config.HEADERS);
  }
  
  // 드롭다운도 자동 적용
  applyValidations();
  
  ui.alert("✅ 업데이트 완료", "시트 구조와 드롭다운 메뉴가 안전하게 적용되었습니다.", ui.ButtonSet.OK);
}

/**
 * [분석 전용] 시트의 현재 상태와 목표 상태를 비교하여 변경 사항만 반환 (수정 없음)
 */
function analyzeSheetChanges(ss, sheetName, targetHeaders) {
  const sheet = ss.getSheetByName(sheetName);
  const result = { sheetName: sheetName, hasChanges: false, isNew: false, addedColumns: [], newHeaders: targetHeaders, dataRowCount: 0 };
  
  if (!sheet) {
    result.hasChanges = true;
    result.isNew = true;
    return result;
  }
  
  // 현재 헤더 읽기
  const lastCol = sheet.getLastColumn();
  const currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  
  // 데이터 행 수 확인
  result.dataRowCount = Math.max(0, sheet.getLastRow() - 1);
  
  // 새로 추가될 컬럼 찾기 (기존에 없는 것만)
  for (let i = 0; i < targetHeaders.length; i++) {
    if (currentHeaders.indexOf(targetHeaders[i]) === -1) {
      result.addedColumns.push(targetHeaders[i]);
      result.hasChanges = true;
    }
  }
  
  return result;
}

/**
 * [안전 업데이트] 기존 데이터를 보존하면서 새 컬럼만 오른쪽에 추가
 */
function safeUpdateSheet(ss, sheetName, targetHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  
  // 시트가 없으면 새로 생성
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headerRange = sheet.getRange(1, 1, 1, targetHeaders.length);
    headerRange.setValues([targetHeaders]);
    headerRange.setFontWeight("bold").setBackground("#f3f3f3").setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    return;
  }
  
  // 현재 헤더 읽기
  var lastCol = sheet.getLastColumn();
  var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  
  // 새 컬럼만 오른쪽에 추가 (기존 컬럼 순서/데이터 보존)
  var nextCol = lastCol + 1;
  for (var i = 0; i < targetHeaders.length; i++) {
    if (currentHeaders.indexOf(targetHeaders[i]) === -1) {
      var cell = sheet.getRange(1, nextCol);
      cell.setValue(targetHeaders[i]);
      cell.setFontWeight("bold").setBackground("#f3f3f3").setHorizontalAlignment("center");
      nextCol++;
    }
  }
  
  sheet.setFrozenRows(1);
}

/**
 * 데이터 유효성 검사(드롭다운) 적용 함수
 */
function applyValidations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(DB_CONFIG.TASKS.NAME);
  
  if (!taskSheet) return;

  // 1. 상태 (C열) 드롭다운
  setDropdown(taskSheet, 3, ["대기", "진행중", "완료", "보류"]);
  
  // 2. 우선순위 (K열) 드롭다운
  setDropdown(taskSheet, 11, ["🔥 높음", "중간", "낮음"]);

  // 3. 업무 유형 (B열) 드롭다운
  setDropdown(taskSheet, 2, ["일반", "회의", "개발", "디자인", "외근"]);
  
  // 4. [16단계] Projects 시트 - 사용 여부 및 상태 드롭다운
  const projectSheet = ss.getSheetByName(DB_CONFIG.PROJECTS.NAME);
  if (projectSheet) {
    setDropdown(projectSheet, 3, ["사용", "미사용"]);
    setDropdown(projectSheet, 6, ["활성", "대기", "완료"]);
  }
}

function setDropdown(sheet, colIndex, values) {
  // 2행부터 1000행까지 적용
  var range = sheet.getRange(2, colIndex, 999, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true) // true = 드롭다운 화살표 표시
    .setAllowInvalid(false)           // 목록에 없는 값 입력 금지
    .build();
  range.setDataValidation(rule);
}

/**
 * 🔠 Projects 시트에서 코드가 없는 프로젝트를 찾아 자동으로 코드를 추천하고 적용
 * 메뉴: 🚀 업무 시스템 관리 → 프로젝트 코드 자동 추천
 */
function suggestProjectCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = ss.getSheetByName("Projects");
  
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert("Projects 시트에 프로젝트 데이터가 없습니다.");
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  // 이미 사용 중인 코드 수집 (중복 방지)
  const usedCodes = new Set();
  for (let i = 1; i < data.length; i++) {
    const code = String(data[i][1]).trim();
    if (code) usedCodes.add(code.toUpperCase());
  }
  
  // 코드가 없는 프로젝트 찾기
  const toFill = [];
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0]).trim();
    const code = String(data[i][1]).trim();
    if (name && !code) {
      const suggested = generateCodeFromName(name, usedCodes);
      usedCodes.add(suggested); // 추천 코드도 즉시 사용 중으로 등록 (다음 행과 중복 방지)
      toFill.push({ row: i + 1, name: name, code: suggested });
    }
  }
  
  if (toFill.length === 0) {
    ui.alert("✅ 완료", "모든 프로젝트에 이미 코드가 있습니다.", ui.ButtonSet.OK);
    return;
  }
  
  // 추천 목록을 사용자에게 미리 보여주기
  let preview = "아래 코드를 자동으로 생성합니다. 적용하시겠습니까?\n\n";
  for (const item of toFill) {
    preview += "  " + item.name + "  →  " + item.code + "\n";
  }
  preview += "\n※ 적용 후 원하는 코드로 언제든지 직접 수정 가능합니다.";
  
  const response = ui.alert("🔠 프로젝트 코드 자동 추천", preview, ui.ButtonSet.OK_CANCEL);
  
  if (response !== ui.Button.OK) {
    ui.alert("❌ 취소됨", "코드가 적용되지 않았습니다.", ui.ButtonSet.OK);
    return;
  }
  
  // 실제 시트에 코드 기입
  for (const item of toFill) {
    sheet.getRange(item.row, 2).setValue(item.code);
  }
  
  // ⚡ 슬랙 드롭다운 캐시 즉시 무효화 → 다음 /주디 실행 시 새 프로젝트 바로 반영
  if (typeof clearProjectCache === 'function') clearProjectCache();
  
  ui.alert("✅ 완료", toFill.length + "개 프로젝트 코드가 자동 생성되었습니다.\n슬랙 드롭다운에 즉시 반영됩니다.", ui.ButtonSet.OK);
}

/**
 * [헬퍼] 프로젝트명에서 영문 코드 자동 생성
 * 우선순위: 영문 대문자 약어 → 한글 초성(영문 변환) → 순번
 */
function generateCodeFromName(name, usedCodes) {
  // 1. 영문 단어가 포함된 경우: 앞글자 대문자 추출 (예: "AI지니어스" → "AI")
  const englishWords = name.match(/[A-Za-z]+/g);
  let candidate = "";
  
  if (englishWords) {
    candidate = englishWords.map(w => w.substring(0, 2).toUpperCase()).join("").substring(0, 4);
  }
  
  // 2. 한글 단어 처리: 자주 쓰이는 키워드를 영문으로 매핑
  const keywordMap = {
    "교육": "EDU", "학교": "SCH", "대학": "UNV", "학원": "ACD",
    "마케팅": "MKT", "홍보": "PR", "브랜드": "BRD",
    "개발": "DEV", "시스템": "SYS", "플랫폼": "PLT", "앱": "APP",
    "공도": "GONG", "행정": "ADM", "운영": "OPS", "기획": "PLN",
    "디자인": "DSN", "콘텐츠": "CNT", "프로젝트": "PRJ",
    "현대": "HYD", "아카데미": "ACD", "성인": "ADL", "창문": "WIN",
    "지원": "SUP", "전주": "JNJ", "넷마블": "NMB"
  };
  
  if (!candidate) {
    for (const keyword in keywordMap) {
      if (name.includes(keyword)) {
        candidate = keywordMap[keyword];
        break;
      }
    }
  }
  
  // 3. 매핑도 없으면 한글 초성 추출 (앞 3글자)
  if (!candidate) {
    const CHOSUNG = ["G","GG","N","D","DD","R","M","B","BB","S","SS","A","J","JJ","C","K","T","P","H"];
    let initials = "";
    for (let i = 0; i < name.length && initials.length < 3; i++) {
      const code = name.charCodeAt(i);
      if (code >= 44032 && code <= 55203) { // 한글 범위
        initials += CHOSUNG[Math.floor((code - 44032) / 588)];
      }
    }
    candidate = initials.substring(0, 4);
  }
  
  // 4. 후보가 여전히 비어있으면 순번 기반 코드
  if (!candidate) candidate = "PRJ";
  
  // 5. 중복이면 숫자 붙여서 해결 (예: EDU → EDU2 → EDU3)
  let finalCode = candidate;
  let suffix = 2;
  while (usedCodes.has(finalCode)) {
    finalCode = candidate + suffix;
    suffix++;
  }
  
  return finalCode;
}
