/**
 * [코드 버전]: v1.1
 * [기능 설명]: 이 코드는 버튼 한 번으로 구글 스프레드시트에 필요한 3가지 시트(업무, 프로젝트, 팀원)와
 *             각 시트의 복잡한 머리글(헤더)을 자동으로 만들어주는 '설치 마법사'입니다.
 * [기술 내용]: executeSpreadsheetSetup() 함수가 실행되면 getSheetByName()으로 시트 존재 여부를 확인하고,
 *             없으면 insertSheet()로 생성한 뒤 setValues()로 헤더 배열을 시트 1행에 입력하고 디자인을 적용합니다.
 */

// 전역 변수 설정: 시트 이름과 헤더 구조 정의
const DB_CONFIG = {
  TASKS: {
    NAME: "Tasks",
    HEADERS: [
      "업무 ID",       // A: 고유 식별자 (자동 생성)
      "업무 유형",     // B: 일반, 회의, 개발 등 (AI 분류용)
      "상태",          // C: 대기, 진행중, 완료 등
      "프로젝트",      // D: 프로젝트명
      "업무 제목",     // E: 요약
      "상세 내용",     // F: 구체적 지시사항 (AI 참조용)
      "담당자",        // G: 실무자
      "요청자",        // H: 지시자
      "마감일",        // I: YYYY-MM-DD
      "선행 업무",     // J: 먼저 해야 할 업무 ID
      "우선순위",      // K: 높음, 중간, 낮음
      "슬랙 링크",     // L: 스레드 URL
      "캘린더 ID",     // M: 숨김 (시스템용)
      "최근 수정일"    // N: 자동 기록
    ]
  },
  PROJECTS: {
    NAME: "Projects",
    HEADERS: [
      "프로젝트명",    // A
      "프로젝트 코드", // B: ID 접두사 (예: MKT)
      "사용 여부"      // C: 사용/중지
    ]
  },
  USERS: {
    NAME: "Users",
    HEADERS: [
      "이름",          // A
      "슬랙 ID",       // B: U01234567
      "이메일"         // C: user@company.com
    ]
  }
};

/**
 * 스프레드시트가 열릴 때 실행되는 함수
 * 상단 메뉴에 '업무 시스템 관리' 메뉴를 추가합니다.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 업무 시스템 관리')
    .addItem('1단계: 시트 구조 자동 생성', 'setupDatabase')
    .addToUi();
}

/**
 * 1단계: 데이터베이스 시트와 헤더를 자동으로 생성하는 함수
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    // 1. Tasks 시트 생성
    createOrUpdateSheet(ss, DB_CONFIG.TASKS.NAME, DB_CONFIG.TASKS.HEADERS);
    
    // 2. Projects 시트 생성
    createOrUpdateSheet(ss, DB_CONFIG.PROJECTS.NAME, DB_CONFIG.PROJECTS.HEADERS);
    
    // 3. Users 시트 생성
    createOrUpdateSheet(ss, DB_CONFIG.USERS.NAME, DB_CONFIG.USERS.HEADERS);
    
    ui.alert("✅ 설정 완료", "모든 시트와 헤더가 성공적으로 생성되었습니다.\n이제 프로젝트와 팀원 데이터를 입력해주세요.", ui.ButtonSet.OK);
    
  } catch (e) {
    ui.alert("❌ 오류 발생", "설정 중 오류가 발생했습니다:\n" + e.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 헬퍼 함수: 시트가 없으면 만들고, 헤더를 설정함
 */
function createOrUpdateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // 헤더 설정 (1행)
  // 기존 데이터가 있어도 1행은 덮어씁니다 (구조 강제)
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  
  // 헤더 스타일 꾸미기
  headerRange.setFontWeight("bold")
    .setBackground("#f3f3f3") // 연한 회색 배경
    .setHorizontalAlignment("center");
    
  // 틀 고정 (1행 고정)
  sheet.setFrozenRows(1);
}
