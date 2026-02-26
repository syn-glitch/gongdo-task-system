/**
 * [코드 버전]: v1.3 (메뉴 제거 버전)
 * [기능 설명]: (주의) 이 파일에는 더 이상 onOpen 함수가 없습니다. setup_structure.gs가 메뉴를 담당합니다.
 *             Tasks 시트에서 '상태'가 '대기'나 '진행중'으로 바뀔 때 슬랙 알림을 보냅니다.
 */

const SLACK_TOKEN = "xoxb-2902925238769-10544673152421-FrhseNzvd9tHLxAz9pITmYyx"; 

// -----------------------------------------------------------
// 1. 테스트 및 디버깅 함수 (메뉴에서 호출)
// -----------------------------------------------------------
/**
 * [NEW] 디버깅용: 현재 선택된 행의 알림을 강제로 보내고, 결과를 팝업으로 띄웁니다.
 */
function debugCurrentRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  
  if (sheet.getName() !== "Tasks" || row <= 1) {
    SpreadsheetApp.getUi().alert("❌ 'Tasks' 시트의 업무 내용이 있는 행을 선택하고 실행해주세요.");
    return;
  }

  // 1. 데이터 읽기
  const values = sheet.getRange(row, 1, 1, 8).getValues()[0];
  const project = values[3]; // D열
  const title = values[4];   // E열
  
  let debugMsg = `🔍 [${row}행 진단 시작]\n`;
  debugMsg += `1. 프로젝트명: '${project}'\n`;
  debugMsg += `2. 업무 제목: '${title}'\n`;

  if (!project || !title) {
    SpreadsheetApp.getUi().alert(debugMsg + "❌ 실패: 프로젝트명이나 제목이 비어있습니다.");
    return;
  }

  // 2. 채널 ID 찾기
  const channelId = findChannelIdByProjectName(ss, project);
  debugMsg += `3. 채널 ID 검색: ${channelId ? `'${channelId}'` : "❌ 못 찾음"}\n`;

  if (!channelId) {
    SpreadsheetApp.getUi().alert(debugMsg + "\n💡 [해결법] Projects 시트의 이름과 Tasks 시트의 이름이 띄어쓰기까지 똑같은지 확인하세요.");
    return;
  }

  // 3. 슬랙 전송 시도 (에러 메시지 상세 출력)
  const url = "https://slack.com/api/chat.postMessage";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify({
      channel: channelId,
      text: `🐞 디버깅 메시지입니다.\n> ${title}`
    }),
    muteHttpExceptions: true // 에러 발생해도 멈추지 않고 응답 내용 확인
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      SpreadsheetApp.getUi().alert(debugMsg + `4. 전송 결과: ✅ 성공!\n\n(참고: 자동 알림이 안 왔다면, '트리거' 설정 문제일 수 있습니다.)`);
    } else {
      SpreadsheetApp.getUi().alert(debugMsg + `4. 전송 실패: ❌ ${result.error}\n\n💡 [해결법]\n- not_in_channel: 봇을 채널에 초대했나요?\n- invalid_auth: 토큰이 잘못되었습니다.`);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(`🔥 치명적 오류: ${e.toString()}`);
  }
}

function testFirstProjectAlert() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const output = getProjectChannelInfo(ss, 2);
  if (!output) {
    SpreadsheetApp.getUi().alert("❌ Projects 시트 2행에 데이터가 없거나 채널 ID가 비어있습니다.");
    return;
  }
  sendSlackMessage(output.channelId, `🔔 *[연결 테스트]*\n프로젝트: *${output.name}*\n이 채널로 알림이 오나요? 성공입니다! 🎉`);
  SpreadsheetApp.getUi().alert(`✅ 전송 성공! 채널(${output.name})을 확인하세요.`);
}

// -----------------------------------------------------------
// 2. 실제 알림 로직 (이 함수를 트리거에 연결하세요!)
// -----------------------------------------------------------
function checkAndSendAlert(e) {
  // e가 없으면(직접 실행하면) 중단
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  
  // 1) 'Tasks' 시트가 아니면 무시
  if (sheet.getName() !== "Tasks") return;
  
  // 2) 수정된 컬럼 확인
  // C열(3번째) = '상태', D열(4번째) = '프로젝트', E열(5번째) = '제목'
  const col = range.getColumn();
  const row = range.getRow();
  
  // 헤더 수정은 무시
  if (row <= 1) return;

  // 3) 핵심 로직: '상태(C열)'가 변경되었을 때만 알림 발송
  if (col === 3) { 
    const status = e.value; // 변경된 값
    
    // '대기' 또는 '진행중'으로 바꼈을 때만 알림
    if (status === "대기" || status === "진행중") {
      sendTaskNotification(row);
    }
  }
}

function sendTaskNotification(rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName("Tasks");
  
  // 데이터 읽기 (A:I) -> 0:ID, 1:유형, 2:상태, 3:프로젝트, 4:제목, 5:내용, 6:담당자, 7:요청자, 8:마감일
  const data = taskSheet.getRange(rowNumber, 1, 1, 9).getValues()[0];
  const taskInfo = {
    id: data[0], type: data[1], status: data[2], 
    project: data[3], title: data[4], desc: data[5], 
    assignee: data[6], requester: data[7], dueDate: data[8]
  };

  // 필수 정보 체크
  if (!taskInfo.project || !taskInfo.title) return;

  const channelId = findChannelIdByProjectName(ss, taskInfo.project);
  if (channelId) {
    const message = buildSlackMessage(taskInfo);
    sendSlackMessage(channelId, message);
  }
}

function buildSlackMessage(info) {
  let icon = "🆕";
  if (info.status === "진행중") icon = "▶️";
  if (info.status === "완료") icon = "✅";
  
  // 마감일 포맷팅 (YYYY-MM-DD)
  let dateStr = "미지정";
  if (info.dueDate instanceof Date) {
    const yyyy = info.dueDate.getFullYear();
    const mm = String(info.dueDate.getMonth() + 1).padStart(2, '0');
    const dd = String(info.dueDate.getDate()).padStart(2, '0');
    dateStr = `${yyyy}-${mm}-${dd}`;
  } else if (info.dueDate) {
    dateStr = info.dueDate;
  }

  return `${icon} *업무 상태 변경: ${info.status}*\n` +
         `📂 *${info.project}* | 🆔 ${info.id}\n` +
         `📋 <${getInfoUrl(info.id)}|*${info.title}*>\n` + 
         `👤 담당: ${info.assignee} (요청: ${info.requester})\n` + 
         `📅 마감일: ${dateStr}\n` + 
         `─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n` +
         `${info.desc}`;
}

function getInfoUrl(id) { return "https://docs.google.com/spreadsheets"; }

// -----------------------------------------------------------
// 3. 헬퍼 함수들
// -----------------------------------------------------------
function findChannelIdByProjectName(ss, projectName) {
  const sheet = ss.getSheetByName("Projects");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == projectName && data[i][3]) return data[i][3];
  }
  return null;
}

function getProjectChannelInfo(ss, row) {
  const sheet = ss.getSheetByName("Projects");
  const name = sheet.getRange(row, 1).getValue();
  const channelId = sheet.getRange(row, 4).getValue();
  return (name && channelId) ? { name: name, channelId: channelId } : null;
}

function sendSlackMessage(channelId, text) {
  const url = "https://slack.com/api/chat.postMessage";
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify({ channel: channelId, text: text })
  };
  try { UrlFetchApp.fetch(url, options); } catch (e) { Logger.log(e); }
}
