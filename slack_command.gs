/**
 * ============================================================================
 * [파일명]: slack_command.gs
 * [마지막 업데이트]: 2026년 02월 22일 00:40 (KST)
 * [현재 설정된 핵심 기능 현황]:
 *   1. 슬랙 '/주디' 슬래시 커맨드 수신 및 팝업 모달창 생성
 *   2. 모달창 내 '프로젝트명', '제목', '내용', '마감일', '담당자 지정' 입력 처리
 *   3. 구글 시트(Tasks) 백그라운드 저장 및 구글 캘린더 즉시 연동
 *   4. [옵션1 적용] 지정된 담당자에게 슬랙 API를 통한 1:1 개인 DM 알림 발송
 *   5. AI 챗봇(클로드)을 위한 Event Subscriptions 수신 및 3초 타임아웃 방어 캐시
 * ============================================================================
 */

function doPost(e) {
  // 1. Interactivity (모달 제출, 메시지 숏컷 등 payload가 있는 경우)
  if (e.parameter.payload) {
    const payloadStr = e.parameter.payload;
    const payload = JSON.parse(payloadStr);
    
    // 1-1. 모달 제출 (veiw_submission)
    if (payload.type === "view_submission") {
      return handleModalSubmission(payloadStr);
    }
    // 1-2. [옵션 2] 메시지 단축키 (message_action)
    else if (payload.type === "message_action" && payload.callback_id === "create_task_from_message") {
      const triggerId = payload.trigger_id;
      // 메시지 원문과 작성자 추출
      const messageText = payload.message.text || "";
      const userId = payload.message.user;
      const realName = fetchUserName(userId); // ID 대신 실명 가져오기
      
      const prefillDesc = `[${realName}의 메시지에서 파생됨]\n${messageText}`;
      return openTaskModal(triggerId, prefillDesc);
    }
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

function openTaskModal(triggerId, prefillDesc = "") {
  const url = "https://slack.com/api/views.open";
  
  // [옵션 2] 상세 내용 블록 구성 (전달받은 텍스트가 있으면 initial_value로 채움)
  const descBlock = {
    type: "input", block_id: "desc_block", optional: true,
    element: { type: "plain_text_input", multiline: true, action_id: "desc_input", placeholder: { type: "plain_text", text: "상세 내용을 입력하세요 (선택)" } },
    label: { type: "plain_text", text: "상세 내용" }
  };
  if (prefillDesc) {
    descBlock.element.initial_value = prefillDesc.substring(0, 2900);
  }

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
        descBlock, // 위에서 구성한 동적 입력 블록
        // [NEW] 마감일 입력용 DatePicker 블록 추가
        {
          type: "input", block_id: "date_block", optional: true,
          element: { type: "datepicker", action_id: "date_input", placeholder: { type: "plain_text", text: "날짜 선택 (선택사항)" } },
          label: { type: "plain_text", text: "마감일" }
        },
        // [1차 업그레이드] 담당자 선택용 Users Select 블록 추가
        {
          type: "input", block_id: "assignee_block", optional: true,
          element: { type: "users_select", action_id: "assignee_input", placeholder: { type: "plain_text", text: "담당자 선택 (기본값: 본인)" } },
          label: { type: "plain_text", text: "담당자 배정" }
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
    const userId = payload.user.id; // DM을 보내기 위한 슬랙 유저 ID (작성자)
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // [1차 업그레이드] 담당자 슬랙 ID 추출 (선택 안 했으면 작성자 본인으로)
    let assignedUserId = userId;
    if (values.assignee_block && values.assignee_block.assignee_input && values.assignee_block.assignee_input.selected_user) {
      assignedUserId = values.assignee_block.assignee_input.selected_user;
    }
    
    // 1. 임시 공간에 데이터 저장 (담당자 ID 추가)
    const taskData = { project, title, desc, username, ssId, dueDate, userId, assignedUserId };
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
      
      // [1차 업그레이드] 슬랙 API로 할당된 담당자 이름(Real Name) 가져오기
      let assigneeName = data.username; // 기본값은 작성자
      if (data.assignedUserId && data.assignedUserId !== data.userId) {
        try {
          const userUrl = `https://slack.com/api/users.info?user=${data.assignedUserId}`;
          const userRes = UrlFetchApp.fetch(userUrl, {
            method: "get",
            headers: { "Authorization": "Bearer " + SLACK_TOKEN },
            muteHttpExceptions: true
          });
          const userJson = JSON.parse(userRes.getContentText());
          if (userJson.ok && userJson.user && userJson.user.real_name) {
             assigneeName = userJson.user.real_name;
          } else if (userJson.ok && userJson.user && userJson.user.name) {
             assigneeName = userJson.user.name;
          }
        } catch(e) { console.error("유저 이름 획득 실패", e); }
      }

      // 시트 구조에 맞게 데이터 배열 생성 (9번째 칸이 마감일)
      // A: 1(ID), B: 2(일반), C: 3(대기), D: 4(프로젝트), E: 5(제목), F: 6(내용), G: 7(담당자), H: 8(요청자), I: 9(마감일)
      let rowData = ["", "일반", "대기", data.project, data.title, data.desc, assigneeName, data.username, data.dueDate];
      
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

      // [공통 DM 알림 발송 함수]
      const triggerSlackDM = (targetUserId, messageText) => {
        const url = "https://slack.com/api/chat.postMessage";
        const msgPayload = {
          channel: targetUserId,
          text: messageText
        };
        const options = {
          method: "post",
          contentType: "application/json",
          headers: { "Authorization": "Bearer " + SLACK_TOKEN }, 
          payload: JSON.stringify(msgPayload),
          muteHttpExceptions: true
        };
        try { 
          const res = UrlFetchApp.fetch(url, options);
          return JSON.parse(res.getContentText());
        } catch (e) { return {ok: false, error: e.toString()}; }
      };

      // 1. 작성자에게 '등록 완료' 확인용 DM 전송
      if (data.userId) {
        let confirmMsg = `✅ *[${data.project}] 업무 등록 완료!*\n\`${data.title}\`\n구글 시트와 캘린더에 성공적으로 등록되었습니다. 🎉`;
        if (data.assignedUserId !== data.userId) {
           confirmMsg = `✅ *[${data.project}] 업무 할당 완료!*\n\`${data.title}\` 업무를 <@${data.assignedUserId}> 님에게 성공적으로 배정했습니다. 🎉`;
        }
        
        const result = triggerSlackDM(data.userId, confirmMsg);
        if (!result.ok) sheet.getRange(newRow, 12).setValue("작성자DM 실패: " + result.error);
      } else {
        sheet.getRange(newRow, 12).setValue("작성자DM 실패: ID 없음");
      }
      
      // 2. [1차 업그레이드] 타인을 담당자로 지정했을 경우 타인에게 '지정 알림' DM 전송
      if (data.assignedUserId && data.assignedUserId !== data.userId) {
        const assignMsg = `📣 *새로운 업무가 배정되었습니다!*\n<@${data.userId}> 님이 당신을 담당자로 지정했습니다.\n\n📌 *프로젝트:* ${data.project}\n📝 *제목:* ${data.title}\n📅 *마감일:* ${data.dueDate || "미정"}\n\n화이팅입니다! 💪`;
        const result2 = triggerSlackDM(data.assignedUserId, assignMsg);
        if (!result2.ok) {
           const prevError = sheet.getRange(newRow, 12).getValue();
           sheet.getRange(newRow, 12).setValue(prevError + " / 담당자DM 실패: " + result2.error);
        }
      }


      props.deleteProperty(key);
    }
  }
}

function authorizeForAsync() {
  Logger.log("백그라운드 트리거 사용 권한 설정이 완료되었습니다!");
}

/**
 * [헬퍼] 슬랙 유저 ID를 실명(Real Name)으로 변환
 */
function fetchUserName(userId) {
  if (!userId) return "누군가";
  try {
    const userUrl = `https://slack.com/api/users.info?user=${userId}`;
    const userRes = UrlFetchApp.fetch(userUrl, {
      method: "get",
      headers: { "Authorization": "Bearer " + SLACK_TOKEN },
      muteHttpExceptions: true
    });
    const userJson = JSON.parse(userRes.getContentText());
    if (userJson.ok && userJson.user) {
       return userJson.user.real_name || userJson.user.name || userId;
    }
  } catch(e) { console.error("유저 이름 획득 실패", e); }
  return userId;
}
