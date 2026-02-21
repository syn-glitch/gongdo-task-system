// [🚨 복구용] 이 코드를 전체 복사해서 GAS의 'Setup Structure.gs'에 그대로 덮어쓰기 하세요!
/**
 * [코드 버전]: v1.5 (디버깅 메뉴 추가됨)
 * [기능 설명]: 1. 시트 구조 생성 (setupDatabase)
 *             2. 드롭다운 메뉴 적용 (applyValidations)
 *             3. 메뉴바 통합 관리 (onOpen - 여기에 디버깅 버튼 추가됨!)
 */

const DB_CONFIG = {
  TASKS: {
    NAME: "Tasks",
    HEADERS: [
      "업무 ID", "업무 유형", "상태", "프로젝트", "업무 제목",
      "상세 내용", "담당자", "요청자", "마감일", "선행 업무",
      "우선순위", "슬랙 링크", "캘린더 ID", "최근 수정일"
    ]
  },
  PROJECTS: {
    NAME: "Projects",
    HEADERS: ["프로젝트명", "프로젝트 코드", "사용 여부", "Slack 채널 ID"]
  },
  USERS: {
    NAME: "Users",
    HEADERS: ["이름", "슬랙 ID", "이메일"]
  }
};

/**
 * [통합 메뉴 함수]
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 업무 시스템 관리')
    .addItem('1단계: 시트 구조 자동 생성', 'setupDatabase')
    .addItem('🔧 드롭다운 메뉴 적용하기', 'applyValidations')
    .addSeparator()
    .addItem('📊 대시보드 자동 생성 (새로고침)', 'generateDashboard')
    .addSeparator()
    .addItem('🔔 슬랙 연결 테스트', 'testFirstProjectAlert')
    .addItem('🐞 현재 행 강제 알림 (디버깅)', 'debugCurrentRow')
    .addToUi();
}

/**
 * 1단계: 시트 구조 생성
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createOrUpdateSheet(ss, DB_CONFIG.TASKS.NAME, DB_CONFIG.TASKS.HEADERS);
  createOrUpdateSheet(ss, DB_CONFIG.PROJECTS.NAME, DB_CONFIG.PROJECTS.HEADERS);
  createOrUpdateSheet(ss, DB_CONFIG.USERS.NAME, DB_CONFIG.USERS.HEADERS);
  
  // 구조 만들고 유효성 검사도 바로 적용
  applyValidations();
  
  SpreadsheetApp.getUi().alert("✅ 설정 완료", "시트 구조와 드롭다운 메뉴가 적용되었습니다.", SpreadsheetApp.getUi().ButtonSet.OK);
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
}

function setDropdown(sheet, colIndex, values) {
  // 2행부터 1000행까지 적용
  const range = sheet.getRange(2, colIndex, 999, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true) // true = 드롭다운 화살표 표시
    .setAllowInvalid(false)           // 목록에 없는 값 입력 금지
    .build();
  range.setDataValidation(rule);
}

function createOrUpdateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold").setBackground("#f3f3f3").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}
