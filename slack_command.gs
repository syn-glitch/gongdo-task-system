// [✨ 최신 수정본] 이 코드를 전체 복사해서 GAS의 'slack_command.gs'에 덮어쓰기 하세요!
/**
 * [기능 설명]: 슬랙 슬래시 커맨드와 모달(Interactivity) 상호작용을 처리합니다.
 *             사용자가 슬랙에서 '/주디'를 입력하면 모달을 띄우고,
 *             모달에서 '등록'을 누르면 스프레드시트 Tasks 시트에 새 업무를 추가합니다.
 */

function doPost(e) {
  // 슬랙에서 오는 POST 요청의 내용을 확인합니다.
  
  // 1. 모달 전송 (Interactivity) 처리: e.parameter.payload가 있는 경우
  if (e.parameter.payload) {
    return handleModalSubmission(e.parameter.payload);
  } 
  // 2. 슬래시 커맨드 처리: e.parameter.command가 '/주디'인 경우
  else if (e.parameter.command === '/주디') {
    return openTaskModal(e.parameter.trigger_id);
  } 
  
  return ContentService.createTextOutput("알 수 없는 요청입니다.");
}

/**
 * 슬랙 화면에 '새 업무 등록' 모달 창을 띄우는 함수
 */
function openTaskModal(triggerId) {
  const url = "https://slack.com/api/views.open";
  
  // 모달 UI (Block Kit) 정의
  const payload = {
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "task_registration_modal",
      title: {
        type: "plain_text",
        text: "새 업무 등록"
      },
      submit: {
        type: "plain_text",
        text: "등록"
      },
      close: {
        type: "plain_text",
        text: "취소"
      },
      blocks: [
        {
          type: "input",
          block_id: "project_block",
          element: {
            type: "plain_text_input",
            action_id: "project_input",
            placeholder: {
              type: "plain_text",
              text: "예: 공도 개발"
            }
          },
          label: {
            type: "plain_text",
            text: "프로젝트명"
          }
        },
        {
          type: "input",
          block_id: "title_block",
          element: {
            type: "plain_text_input",
            action_id: "title_input",
            placeholder: {
              type: "plain_text",
              text: "업무 제목을 입력하세요"
            }
          },
          label: {
            type: "plain_text",
            text: "업무 제목"
          }
        },
        {
          type: "input",
          block_id: "desc_block",
          optional: true,
          element: {
            type: "plain_text_input",
            multiline: true,
            action_id: "desc_input",
            placeholder: {
              type: "plain_text",
              text: "상세 내용을 입력하세요 (선택)"
            }
          },
          label: {
            type: "plain_text",
            text: "상세 내용"
          }
        }
      ]
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    // slack_notification.gs에 선언된 SLACK_TOKEN을 사용 (GAS는 전역 변수 공유)
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);

  // 슬래시 커맨드 응답은 빈 문서로 200 OK를 반환해야 합니다. (MIME 타입 설정 시 슬랙 오류 발생 가능)
  return ContentService.createTextOutput("");
}

/**
 * 사용자가 모달에서 '등록' 버튼을 눌렀을 때 데이터를 처리하는 함수
 */
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    // 사용자가 입력한 값 추출
    const values = payload.view.state.values;
    const project = values.project_block.project_input.value;
    const title = values.title_block.title_input.value;
    const desc = values.desc_block.desc_input ? values.desc_block.desc_input.value : "";
    
    // Slack 사용자 이메일이나 이름을 담당자/요청자로 임시 설정 (이름은 payload.user.name 에 들어옴)
    const username = payload.user.username || payload.user.name || "Slack User";
    
    // 시트 입력 작업 진행 (Execution 로그상 1초 미만으로 소요됨을 확인했습니다)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Tasks");
    sheet.appendRow(["", "일반", "대기", project, title, desc, username, username]);
    
    // [중요] 타임아웃이 아니었습니다! GAS 특성상(302 리다이렉트) 슬랙에 JSON을 반환하면 에러가 납니다.
    // 무조건 빈 문자열을 반환해야만 슬랙이 모달을 정상적으로 스스로 닫습니다.
    return ContentService.createTextOutput("");
  }
  
  return ContentService.createTextOutput("");
}
