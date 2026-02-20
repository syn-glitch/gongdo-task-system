/**
 * [코드 버전]: v1.0
 * [기능 설명]: 사용자가 'Tasks' 시트의 '프로젝트'를 선택하거나 내용을 수정하면 자동으로 2가지 일을 해줍니다.
 *             1. 프로젝트에 맞는 멋진 업무 ID (예: MKT-001)를 자동으로 지어줍니다.
 *             2. 내용이 바뀔 때마다 '최근 수정일' 칸에 현재 시간을 자동으로 기록합니다.
 * [기술 내용]: onEdit(e) 트리거를 사용하여 사용자의 셀 편집 이벤트를 감지합니다.
 *             Tasks 시트의 특정 열(프로젝트)이 수정되었을 때 Projects 시트를 참조(VLOOKUP 유사)하여 코드를 가져오고,
 *             Max ID를 계산하여 새로운 ID를 부여합니다.
 */

// 설정 변수
const SHEET_NAMES = {
  TASKS: "Tasks",
  PROJECTS: "Projects"
};

// 열 위치 설정 (1부터 시작하는 인덱스)
// Tasks 시트 기준
const COLS = {
  ID: 1,           // A열: 업무 ID
  PROJECT: 4,      // D열: 프로젝트
  LAST_UPDATED: 14 // N열: 최근 수정일
};

/**
 * 사용자가 셀을 수정할 때마다 자동으로 실행되는 함수 (Simple Trigger)
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  // 1. 'Tasks' 시트에서 일어난 일이 아니면 무시
  if (sheetName !== SHEET_NAMES.TASKS) return;
  
  const row = range.getRow();
  const col = range.getColumn();
  
  // 헤더(1행) 건드린 건 무시
  if (row <= 1) return;

  // -------------------------------------------------------
  // 기능 1: '최근 수정일' 자동 업데이트
  // -------------------------------------------------------
  // 내용을 수정했으니 N열에 현재 시간을 찍어줍니다.
  // 단, 시스템이 '최근 수정일'을 고치는 경우는 제외 (무한루프 방지)
  if (col !== COLS.LAST_UPDATED) {
    const timestamp = new Date();
    sheet.getRange(row, COLS.LAST_UPDATED).setValue(timestamp);
  }

  // -------------------------------------------------------
  // 기능 2: 업무 ID 자동 생성
  // -------------------------------------------------------
  // 조건: '프로젝트'(D열)를 변경했고, 아직 '업무 ID'(A열)가 비어있을 때만 실행
  if (col === COLS.PROJECT && e.value) {
    const idCell = sheet.getRange(row, COLS.ID);
    const currentId = idCell.getValue();
    
    // 이미 ID가 있으면 생성하지 않음 (ID 불변성 유지)
    if (currentId !== "") return;
    
    // 프로젝트 이름 가져오기
    const projectName = e.value;
    
    // 프로젝트 코드 찾기 ('Projects' 시트에서)
    const projectCode = getProjectCode(projectName);
    
    if (projectCode) {
      // 새 ID 생성 (예: MKT-005)
      const newId = generateNewId(sheet, projectCode);
      idCell.setValue(newId);
    } else {
      // 프로젝트 코드를 못 찾으면 알림 (토스트 메시지)
      SpreadsheetApp.getActiveSpreadsheet().toast(`⚠️ '${projectName}'의 코드를 찾을 수 없습니다. Projects 시트를 확인하세요.`);
    }
  }
}

/**
 * Projects 시트에서 프로젝트 이름을 찾아 코드를 반환하는 함수
 */
function getProjectCode(projectName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectSheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
  
  // Projects 시트가 없으면 중단
  if (!projectSheet) return null;
  
  // 2행부터 마지막 행까지 데이터를 가져옴 (A:B)
  const lastRow = projectSheet.getLastRow();
  if (lastRow < 2) return null;
  
  const data = projectSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  
  // 반복문으로 이름 매칭
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === projectName) { // A열: 프로젝트명
      return data[i][1];             // B열: 프로젝트 코드 반환
    }
  }
  return null;
}

/**
 * 해당 프로젝트 코드의 다음 번호 ID를 생성하는 함수
 * 예: 현재 MKT-003까지 있다면 -> MKT-004 반환
 */
function generateNewId(sheet, code) {
  const lastRow = sheet.getLastRow();
  // 데이터가 없으면 1번부터
  if (lastRow < 2) return `${code}-001`;
  
  // A열(ID) 전체 데이터를 가져옴
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  
  let maxNum = 0;
  const prefix = `${code}-`;
  
  // 기존 ID들을 훑어보며 가장 큰 숫자를 찾음
  ids.forEach(id => {
    if (typeof id === 'string' && id.startsWith(prefix)) {
      const numPart = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });
  
  // 다음 번호 생성 (001, 002 형식 맞춤)
  const nextNum = maxNum + 1;
  const paddedNum = nextNum.toString().padStart(3, '0');
  
  return `${prefix}-${paddedNum}`;
}
