// [🚀 최신수정본] 모달 타임아웃 완벽 우회 (비동기 예약 방식 적용)
/**
 * [기능 설명]: 슬랙 슬래시 커맨드와 모달(Interactivity) 상호작용을 처리합니다.
 */

function doPost(e) {
  if (e.parameter.payload) {
    return handleModalSubmission(e.parameter.payload);
  } 
  else if (e.parameter.command === '/주디') {
    return openTaskModal(e.parameter.trigger_id);
  } 
  
  return ContentService.createTextOutput("알 수 없는 요청입니다.");
}

function openTaskModal(triggerId) {
  const url = "https://slack.com/api/views.open";
  
  const payload = {
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "task_registration_modal",
      title: { type: "plain_text", text: "새 업무 등록" },
      submit: { type: "plain_text", text: "등록 완료하기" },
      close: { type: "plain_text", text: "취소" },
      blocks: [
        {
          type: "input", block_id: "project_block",
          element: { type: "plain_text_input", action_id: "project_input", placeholder: { type: "plain_text", text: "예: 공도 개발" } },
          label: { type: "plain_text", text: "프로젝트명" }
        },
        {
          type: "input", block_id: "title_block",
          element: { type: "plain_text_input", action_id: "title_input", placeholder: { type: "plain_text", text: "업무 제목을 입력하세요" } },
          label: { type: "plain_text", text: "업무 제목" }
        },
        {
          type: "input", block_id: "desc_block", optional: true,
          element: { type: "plain_text_input", multiline: true, action_id: "desc_input", placeholder: { type: "plain_text", text: "상세 내용을 입력하세요 (선택)" } },
          label: { type: "plain_text", text: "상세 내용" }
        }
      ]
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN }, 
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);

  return ContentService.createTextOutput("");
}

/**
 * ⚡ 개선된 제출 함수: 사용자가 '등록' 버튼을 눌렀을 때 실행
 */
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    const values = payload.view.state.values;
    const project = values.project_block.project_input.value;
    const title = values.title_block.title_input.value;
    const desc = values.desc_block.desc_input ? values.desc_block.desc_input.value : "";
    const username = payload.user.username || payload.user.name || "Slack User";
    
    // 현재 접속된 스프레드시트의 ID 가져오기
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // 1. 시트에 적을 데이터를 'PropertiesService' 임시 공간에 저장
    const taskData = { project, title, desc, username, ssId };
    const props = PropertiesService.getScriptProperties();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    props.setProperty(uniqueId, JSON.stringify(taskData));
    
    // 2. 알람(트리거)을 맞춰 1밀리초 뒤(실제로는 1분 이내)에 시트에 기록하게 예약
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1) 
      .create();
    
    // 3. 그리고 제일 중요한 것! 슬랙에게 "다 됐어, 창 닫아!" 즉시 응답 (0.1초 컷)
    return ContentService.createTextOutput("");
  }
  
  return ContentService.createTextOutput("");
}

/**
 * 🕒 백그라운드 처리 함수: 시트 기록을 백그라운드에서 진행합니다.
 */
function processAsyncTasks(e) {
  // 1. 일회용 트리거 삭제 (쓰레기 방지)
  if (e && e.triggerUid) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
  }

  // 2. 임시 저장소에서 대기 중인 데이터를 꺼내옵니다.
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  for (const key in allProps) {
    if (key.startsWith("TASK_")) {
      const data = JSON.parse(allProps[key]);
      
      // 저장해둔 아이디로 시트 정확히 찾아가기
      const ss = SpreadsheetApp.openById(data.ssId);
      const sheet = ss.getSheetByName("Tasks");
      
      // 여유롭게 시트에 데이터 삽입
      sheet.appendRow(["", "일반", "대기", data.project, data.title, data.desc, data.username, data.username]);
      
      // 처리 완료된 데이터는 큐에서 지움
      props.deleteProperty(key);
    }
  }
}

/**
 * 🛑 [필수 세팅]: 편집기 상단에서 이 함수(authorizeForAsync)를 선택하고 [▶실행] 버튼을 딱 한 번 눌러서 권한을 승인해주세요!
 */
function authorizeForAsync() {
  Logger.log("백그라운드 트리거 사용 권한 설정이 완료되었습니다!");
}
