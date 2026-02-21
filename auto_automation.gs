/**
 * [파일명]: auto_automation.gs
 * [생성 시간]: 2026년 02월 21일 21:20 (KST)
 * [추가된 내용 요약]: 기존 업무 ID 자동 생성 및 최근 수정일 업데이트 기능에 더하여, 
 *                     '기능 3: 달력 동기화 연동' 코드 블록이 새롭게 추가됨.
 *                     (상태, 프로젝트명, 제목, 내용, 담당자, 마감일 중 하나라도 수정되면 
 *                     calendar_sync.gs의 syncCalendarEvent 함수를 자동 호출하여 변경사항을 캘린더에 반영함)
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
 * ⚡ [중요 변경] 사용자가 셀을 수정할 때마다 자동으로 실행되는 함수 
 * (기존 onEdit는 구글의 보안 정책 상 캘린더 접근 권한이 없어서 이름을 변경해 '설치형 트리거'로 씁니다)
 */
function processTasksEdit(e) {
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

  // -------------------------------------------------------
  // 기능 3: 달력 동기화 연동 (상태, 마감일 등 관련 컬럼 수정 시)
  // -------------------------------------------------------
  // C열(3:상태), D열(4:프로젝트), E열(5:제목), F열(6:내용), G열(7:담당자), I열(9:마감일) 중 하나라도 변경되면
  const syncCols = [3, 4, 5, 6, 7, 9];
  if (syncCols.includes(col)) {
    // calendar_sync.gs 에 있는 동기화 함수 호출
    if (typeof syncCalendarEvent === 'function') {
      syncCalendarEvent(sheet, row);
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

/**
 * [Phase 6] ☀️ 모닝 브리핑 자동화 트리거 설치기
 * 편집기 상단에서 이 함수를 선택하고 한 번만 실행하면 매일 오전 8~9시 사이에 'generateMorningBriefing'이 실행됩니다.
 */
function installMorningBriefingTrigger() {
  // 중복 생성을 막기 위해 기존의 모닝 브리핑 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "generateMorningBriefing") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 매일 오전 8시 ~ 9시 사이에 동작하도록 스케줄링
  ScriptApp.newTrigger("generateMorningBriefing")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
    
  SpreadsheetApp.getUi().alert("✅ 모닝 브리핑 트리거 설치 완료!\n매일 오전 8시~9시 사이에 슬랙으로 브리핑이 전송됩니다.");
}

