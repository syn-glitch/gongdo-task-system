// [🚀 최신수정본] 모달에 마감일 추가 + 캘린더 즉시 연동
/**
 * [기능 설명]: 슬랙 슬래시 커맨드와 모달(Interactivity) 상호작용을 처리합니다.
 */

function doPost(e) {
  // 1. Interactivity (모달 제출 등 payload가 있는 경우)
  if (e.parameter.payload) {
    return handleModalSubmission(e.parameter.payload);
  } 
  // 2. Slash Command (/주디)
  else if (e.parameter.command === '/주디') {
    return openTaskModal(e.parameter.trigger_id);
  }
  
  // 3. Event Subscriptions (JSON 바디로 들어옴)
  if (e.postData && e.postData.contents) {
    let eventData;
    try {
      eventData = JSON.parse(e.postData.contents);
    } catch (err) {
      return ContentService.createTextOutput("Invalid JSON");
    }

    // 3-1. URL Verification Challenge (슬랙 앱 설정 시 필수)
    if (eventData.type === "url_verification") {
      return ContentService.createTextOutput(eventData.challenge);
    }

    // 3-2. Event Callback (메시지 수신 등)
    if (eventData.type === "event_callback") {
      const event = eventData.event;
      
      // 봇 자신이 보낸 메시지 무시 (무한루프 방지)
      if (event.bot_id) {
        return ContentService.createTextOutput("");
      }
      
      // 🚀 핵심 기술: 슬랙의 3초 타임아웃 재시도(Retry) 방어 로직
      // AI 처리에 5초 이상이 걸리면 슬랙이 실패로 착각하고 같은 메시지를 또 보냅니다.
      // 이를 방지하기 위해 이벤트 ID를 캐시에 저장하고, 재시도 요청이 오면 즉시 빈 응답(200 OK)으로 돌려보냅니다.
      const eventId = eventData.event_id; 
      const cache = CacheService.getScriptCache();
      if (cache.get(eventId)) {
        return ContentService.createTextOutput(""); // 재시도 요청은 즉각 무시
      }
      cache.put(eventId, "true", 600); // 10분간 캐시 저장

      // 멘션(app_mention) 이거나 개인 DM(message, 채널 타입이 im) 일 경우
      if (event.type === "app_mention" || (event.type === "message" && event.channel_type === "im")) {
        
        // 1분 대기 트리거를 없애고, 즉시 AI 처리 함수를 호출합니다!
        const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
        if (typeof processAiChatSync === 'function') {
          processAiChatSync(event, ssId);
        }
      }
      
      // 3초 타임아웃을 피하기 위해 슬랙에는 즉시 빈 응답 반환
      return ContentService.createTextOutput("");
    }
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
        },
        // [NEW] 마감일 입력용 DatePicker 블록 추가
        {
          type: "input", block_id: "date_block", optional: true,
          element: { type: "datepicker", action_id: "date_input", placeholder: { type: "plain_text", text: "날짜 선택 (선택사항)" } },
          label: { type: "plain_text", text: "마감일" }
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
    
    // DatePicker에서 선택된 날짜 (형식: "YYYY-MM-DD" 또는 null)
    let dueDate = "";
    if (values.date_block && values.date_block.date_input && values.date_block.date_input.selected_date) {
      dueDate = values.date_block.date_input.selected_date; // "2026-03-01" 형식의 문자열
    }
    
    const username = payload.user.username || payload.user.name || "Slack User";
    const userId = payload.user.id; // DM을 보내기 위한 슬랙 유저 ID
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // 1. 임시 공간에 마감일(dueDate)도 함께 저장
    const taskData = { project, title, desc, username, ssId, dueDate, userId };
    const props = PropertiesService.getScriptProperties();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    props.setProperty(uniqueId, JSON.stringify(taskData));
    
    // 2. 알람 예약 (백그라운드에서 시트 기록)
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1) 
      .create();
    
    return ContentService.createTextOutput("");
  }
  
  return ContentService.createTextOutput("");
}

/**
 * 🕒 백그라운드 처리 함수: 시트 기록을 백그라운드에서 진행합니다.
 */
function processAsyncTasks(e) {
  if (e && e.triggerUid) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
  }

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  for (const key in allProps) {
    if (key.startsWith("TASK_")) {
      const data = JSON.parse(allProps[key]);
      
      const ss = SpreadsheetApp.openById(data.ssId);
      const sheet = ss.getSheetByName("Tasks");
      
      // 시트 구조에 맞게 데이터 배열 생성 (9번째 칸이 마감일)
      // A: 1(ID), B: 2(일반), C: 3(대기), D: 4(프로젝트), E: 5(제목), F: 6(내용), G: 7(담당자), H: 8(요청자), I: 9(마감일)
      let rowData = ["", "일반", "대기", data.project, data.title, data.desc, data.username, data.username, data.dueDate];
      
      sheet.appendRow(rowData);
      const newRow = sheet.getLastRow();
      
      // 🚨 구글 앱스 스크립트 특성상 코드로 시트를 직접 수정하면 onEdit(수동 트리거)가 발동하지 않습니다.
      // 따라서 캘린더 동기화 함수가 존재한다면 직접 즉시 호출해줍니다!
      if (typeof syncCalendarEvent === 'function') {
        try {
          syncCalendarEvent(sheet, newRow);
        } catch (err) {
          console.error("캘린더 즉시 연동 중 에러 발생: ", err);
        }
      }

      // 사용자에게 '등록 완료' 확인용 DM (Direct Message) 전송
      if (data.userId) {
        const url = "https://slack.com/api/chat.postMessage";
        const msgPayload = {
          channel: data.userId, // 사용자 ID로 DM 전송
          text: `✅ *[${data.project}] 업무 등록 완료!*\n\`${data.title}\` (담당: ${data.username})\n구글 시트와 캘린더에 성공적으로 등록되었습니다. 🎉`
        };
        const options = {
          method: "post",
          contentType: "application/json",
          headers: { "Authorization": "Bearer " + SLACK_TOKEN }, 
          payload: JSON.stringify(msgPayload),
          muteHttpExceptions: true
        };
        try { 
          const response = UrlFetchApp.fetch(url, options); 
          const result = JSON.parse(response.getContentText());
          if (!result.ok) {
            // 실패 원인을 시트의 L열(12번째 칸: 슬랙 링크 자리)에 임시로 기록해 디버깅
            sheet.getRange(newRow, 12).setValue("DM 실패: " + result.error);
          }
        } catch (err) {
          sheet.getRange(newRow, 12).setValue("요청 에러: " + err.toString());
        }
      } else {
        sheet.getRange(newRow, 12).setValue("DM 실패: 유저 ID 없음");
      }

      props.deleteProperty(key);
    }
  }
}

function authorizeForAsync() {
  Logger.log("백그라운드 트리거 사용 권한 설정이 완료되었습니다!");
}
