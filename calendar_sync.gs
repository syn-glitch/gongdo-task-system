/**
 * [파일명]: calendar_sync.gs
 * [생성 시간]: 2026년 02월 21일 21:20 (KST)
 * [추가된 내용 요약]: 구글 시트(Tasks)의 마감일과 상태를 구글 캘린더와 양방향 동기화하는 핵심 로직.
 *                     사용자의 디버깅 및 권한 승인 편의를 위해 맨 아랫부분에 아무 인자 없이 실행할 수 있는
 *                     'authorizeCalendar()' 전용 승인 함수를 명시적으로 추가함.
 */

// 사용할 구글 캘린더 ID (기본 캘린더를 쓰려면 'primary' 입력, 공유 캘린더면 해당 이메일 ID 입력)
const CALENDAR_ID = 'primary'; 

// 컬럼 인덱스 (1부터 시작)
const IDX = {
  STATUS: 3,       // C열: 상태
  PROJECT: 4,      // D열: 프로젝트
  TITLE: 5,        // E열: 업무 제목
  DESC: 6,         // F열: 상세 내용
  ASSIGNEE: 7,     // G열: 담당자
  DUE_DATE: 9,     // I열: 마감일
  CALENDAR_ID: 13  // M열: 캘린더 이벤트 ID 저장용
};

/**
 * Tasks 시트의 내용이 수정될 때 캘린더 동기화를 수행합니다.
 * 이 함수는 auto_automation.gs 의 onEdit 등에서 호출되어야 합니다.
 */
function syncCalendarEvent(sheet, row) {
  // 1. 필요한 데이터 읽어오기
  const values = sheet.getRange(row, 1, 1, 14).getValues()[0];
  
  const status = values[IDX.STATUS - 1];
  const project = values[IDX.PROJECT - 1];
  const title = values[IDX.TITLE - 1];
  const desc = values[IDX.DESC - 1];
  const assignee = values[IDX.ASSIGNEE - 1];
  const dueDate = values[IDX.DUE_DATE - 1];
  const eventId = values[IDX.CALENDAR_ID - 1];
  
  // 필수 정보가 없으면 안 함
  if (!project || !title) return;
  
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    console.error("캘린더를 찾을 수 없습니다: " + CALENDAR_ID);
    return;
  }
  
  // 캘린더 이벤트 제목 만들기
  const eventTitle = `[${project}] ${title} (${assignee})`;
  
  // 이벤트 설명 만들기
  const eventDesc = `상태: ${status}\n담당자: ${assignee}\n\n내용:\n${desc}`;
  
  // -----------------------------------------------------------------
  // 로직 1: 상태가 '완료' 또는 '보류'이거나 마감일이 지워졌을 때 -> 기존 일정 삭제
  // -----------------------------------------------------------------
  if (status === "완료" || status === "보류" || !dueDate) {
    if (eventId) {
      try {
        const event = calendar.getEventById(eventId);
        if (event) {
          event.deleteEvent();
        }
        // 시트에서 캘린더 ID 지우기
        sheet.getRange(row, IDX.CALENDAR_ID).clearContent();
      } catch (e) {
        console.error("이벤트 삭제 실패: ", e);
      }
    }
    return; // 삭제 후 종료
  }
  
  // -----------------------------------------------------------------
  // 로직 2: 마감일이 존재하고 활성 상태일 때 -> 일정 생성 또는 업데이트
  // -----------------------------------------------------------------
  // 날짜 형식 확인 (문자열로 들어온 경우 Date 객체로 변환 시도)
  let parseDate = dueDate;
  if (!(dueDate instanceof Date)) {
    if (typeof dueDate === 'string' && dueDate.trim() !== '') {
      parseDate = new Date(dueDate);
      if (isNaN(parseDate.getTime())) return;
    } else {
      return; 
    }
  }
  
  // '종일(All Day)' 이벤트로 처리 (마감일 하루 종일)
  if (eventId) {
    // 이미 일정이 있다면 업데이트
    try {
      const event = calendar.getEventById(eventId);
      if (event) {
        event.setTitle(eventTitle);
        event.setDescription(eventDesc);
        event.setAllDayDate(parseDate);
      } else {
        // ID는 있는데 실제 일정이 없어진 경우 다시 생성
        createNewEvent(calendar, sheet, row, eventTitle, parseDate, eventDesc);
      }
    } catch (e) {
       console.error("이벤트 업데이트 실패: ", e);
       // 에러 발생시 새로 생성 시도
       createNewEvent(calendar, sheet, row, eventTitle, parseDate, eventDesc);
    }
  } else {
    // 일정이 없으면 새로 생성
    createNewEvent(calendar, sheet, row, eventTitle, parseDate, eventDesc);
  }
}

/**
 * 캘린더에 새 종일 일정을 만들고 시트에 그 ID를 기록합니다.
 */
function createNewEvent(calendar, sheet, row, title, date, desc) {
  try {
    const newEvent = calendar.createAllDayEvent(title, date, {description: desc});
    // 시트의 M열(13번째)에 발급받은 이벤트 ID 기록
    sheet.getRange(row, IDX.CALENDAR_ID).setValue(newEvent.getId());
  } catch (e) {
    console.error("새 이벤트 생성 실패: ", e);
  }
}

/**
 * 🛑 [필수 세팅]: 편집기 상단에서 이 함수(authorizeCalendar)를 선택하고 
 * [▶실행] 버튼을 딱 한 번 눌러서 캘린더 접근 권한을 승인해주세요!
 */
function authorizeCalendar() {
  const calendar = CalendarApp.getCalendarById('primary');
  Logger.log("캘린더 접근 권한 설정이 완료되었습니다! 이제 시트에서 마감일을 입력해보세요.");
}
