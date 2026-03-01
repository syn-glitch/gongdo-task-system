/**
 * ============================================================================
 * [파일명]: slack_command.gs
 * [마지막 업데이트]: 2026년 02월 22일 10:20 (KST)
 * [현재 설정된 핵심 기능 현황]:
 *   1. 슬랙 '/주디' 슬래시 커맨드 수신 및 팝업 모달창 생성
 *   2. 모달창 내 '프로젝트명', '제목', '내용', '마감일', '담당자 지정' 입력 처리
 *   3. 구글 시트(Tasks) 백그라운드 저장 및 구글 캘린더 즉시 연동
 *   4. [옵션1 적용] 지정된 담당자에게 슬랙 API를 통한 1:1 개인 DM 알림 발송
 *   5. AI 챗봇(클로드)을 위한 Event Subscriptions 수신 및 3초 타임아웃 방어 캐시
 * ============================================================================
 */

/**
 * [헬퍼] Message Action/Interactivity 에러 메시지 개인 발송용
 * Slack Message Shortcut은 빈 HTTP 200 OK 응답만을 허용하므로, 
 * 발생한 에러를 JSON으로 Return하지 않고 이 함수를 통해 백그라운드에서 사용자에게만 몰래 전송합니다.
 */
function sendEphemeralError(userId, channelId, errorMsg) {
  try {
    const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
    if (!token || !userId || !channelId) return;

    UrlFetchApp.fetch("https://slack.com/api/chat.postEphemeral", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({
        channel: channelId,
        user: userId,
        text: errorMsg
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("[ERROR] sendEphemeralError 통신 자체 실패: " + e.message);
  }
}

function doPost(e) {
  // 1. Interactivity (모달 제출, 메시지 숏컷 등 payload가 있는 경우)
  if (e.parameter.payload) {
    const payloadStr = e.parameter.payload;
    const payload = JSON.parse(payloadStr);
    
    // 1-1. 모달 제출 (veiw_submission)
    if (payload.type === "view_submission") {
      return handleModalSubmission(payloadStr);
    }
    // 1-2. 인라인 드롭다운 상태 변경 (block_actions)
    else if (payload.type === "block_actions") {
      const action = payload.actions && payload.actions[0];
      
      // [20단계 UX 개선] 인라인 드롭다운에서 상태 변경
      if (action && action.action_id && action.action_id.startsWith("status_select_")) {
        const rowNum = parseInt(action.action_id.replace("status_select_", ""), 10);
        const newStatus = action.selected_option.value;
        return handleInlineStatusChange(rowNum, newStatus, payload.user.id);
      }
      
      // 기존 버튼 방식 호환 (필요시)
      if (action && action.action_id === "change_status_action") {
        const parts = action.value.split("|");
        const rowNum = parseInt(parts[0], 10);
        const taskId = parts[1] || "";
        const taskTitle = parts[2] || "업무";
        return openStatusChangeModal(payload.trigger_id, rowNum, taskId, taskTitle);
      }
      return ContentService.createTextOutput("");
    }
    // 1-3. [옵션 2] 메시지 단축키 (message_action)
    else if (payload.type === "message_action" && payload.callback_id === "create_task_from_message") {
      try {
        const triggerId = payload.trigger_id;

        // 안전성 검증
        if (!triggerId) {
          Logger.log("[ERROR] message_action: trigger_id가 없습니다.");
          sendEphemeralError(payload.user.id, payload.channel.id, "❌ 시스템 오류: trigger_id가 없습니다.");
          return ContentService.createTextOutput("");
        }

        if (!payload.message || !payload.message.text) {
          Logger.log("[ERROR] message_action: 메시지 내용이 없습니다.");
          sendEphemeralError(payload.user.id, payload.channel.id, "❌ 선택한 메시지에 내용이 없습니다.");
          return ContentService.createTextOutput("");
        }

        let messageText = payload.message.text || "";
        const userId = payload.message.user;
        const realName = fetchUserName(userId);

        Logger.log(`[INFO] message_action: 메시지 작성자=${realName}, 길이=${messageText.length}자`);

        // 본문 안에 있는 상대방 멘션(<@U...>) 치환
        messageText = messageText.replace(/<@(U[A-Z0-9]+)>/g, function(match, id) {
          return "@" + fetchUserName(id);
        });
        
        const prefillDesc = `[${realName}의 메시지에서 파생됨]\n${messageText}`;
        // 에러 상황을 대비해 모달 여는 함수에 현재 사용자ID와 채널ID도 같이 넘겨야 함
        return openTaskModal(triggerId, prefillDesc, payload.user.id, payload.channel.id);

      } catch (err) {
        Logger.log(`[FATAL] message_action 처리 중 오류:\n${err.message}\n${err.stack}`);
        sendEphemeralError(payload.user.id, payload.channel.id, "❌ 메시지 처리 중 오류가 발생했습니다.");
        return ContentService.createTextOutput("");
      }
    }
  } 
  // 2. Slash Command (/주디)
  else if (e.parameter.command === '/주디') {
    const commandText = e.parameter.text ? e.parameter.text.trim() : "";
    
    // [20단계] /주디 내업무 — 웹 대시보드 링크 반환 (즉시 응답)
    if (commandText === '내업무' || commandText === '내 업무') {
      try {
        const userId = e.parameter.user_id || "unknown";
        const userName = fetchUserName(userId);
        
        // ScriptApp.getService().getUrl() 이 권한 문제나 캐시 문제로 에러를 던질 수 있는지 확인
        const webAppUrl = ScriptApp.getService().getUrl();
        const dashboardUrl = webAppUrl + "?page=tasks&user=" + encodeURIComponent(userId) + "&name=" + encodeURIComponent(userName);
        
        const payload = {
          response_type: "ephemeral",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "📋 *" + userName + "님의 업무 현황*을 확인하세요!\n마감일 경고, 상태 변경을 한 화면에서 관리할 수 있습니다."
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "📊 내 업무 대시보드 열기", emoji: true },
                  url: dashboardUrl,
                  style: "primary"
                }
              ]
            }
          ]
        };
        return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput("에러 발생: " + err.message + "\\nStack: " + err.stack);
      }
    }
    
    // ⚡ Slack 재시도(Retry) 방어 (모달 관련 명령어에만 적용)
    const triggerId = e.parameter.trigger_id;
    if (triggerId) {
      const retryCache = CacheService.getScriptCache();
      if (retryCache.get("TRIGGER_" + triggerId)) {
        return ContentService.createTextOutput(""); // 재시도 요청 무시
      }
      retryCache.put("TRIGGER_" + triggerId, "1", 30);
    }
    
    if (commandText === '가이드' || commandText === '도움말') {
      const guideUrl = "https://github.com/syn-glitch/gongdo-task-system/blob/main/%EC%B2%AB_AI_%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8_%ED%8C%80%EC%9B%90_%EC%A3%BC%EB%94%94_%EA%B0%80%EC%9D%B4%EB%93%9C.md";
      
      const payload = {
        "response_type": "ephemeral",
        "text": "👩‍💻 첫 AI 팀원 주디(Judy) 활용 가이드입니다!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "👩‍💻 *첫 AI 팀원 주디(Judy) 활용 가이드입니다!*\n\n💡 *핵심 명령어*\n• `/주디` : 새로운 업무를 등록합니다.\n• `/주디 내업무` : 구글 시트에 등록된 내 할 일을 확인합니다.\n• 채팅창에 `노트` 입력 : 내 전용 메모장 접속 링크를 발급받습니다.\n• 메시지 우측 `[점 3개]` ➔ `[주디 - 업무로 가져오기]`\n\n📖 더 자세한 전체 기능과 사용법은 아래 버튼을 눌러 확인해 주세요!"
            }
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "📝 주디 상세 가이드 문서 보기",
                  "emoji": true
                },
                "url": guideUrl,
                "style": "primary"
              }
            ]
          }
        ]
      };
      
      return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 그 외는 새 업무 등록 모달 띄우기
    return openTaskModal(e.parameter.trigger_id, "", "", "");
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
        
        // --- [NEW] Intent Routing (의도 기반 라우팅) ---
        if (event.channel_type === "im" && event.text) {
          const senderName = fetchUserName(event.user);
          const text = event.text.trim();
          
          // Helper: 슬랙에 메시지 즉시 전송
          const replyToSlack = (msg) => {
             const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
             if (!token) return;
             UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
                method: "post", contentType: "application/json", headers: { "Authorization": "Bearer " + token },
                payload: JSON.stringify({ channel: event.user, text: msg }), muteHttpExceptions: true
             });
          };

          // 0. 매직 링크 발급 의도 파악 (Magic Link Intent)
          // "주디 노트", "메모장", "링크" 등 짧은 단독 명령어이거나 명시적으로 "열어"를 포함할 때
          const isMagicLinkIntent = (text.length < 20 && (text.includes("노트") || text.includes("메모장") || text.includes("링크") || text.includes("웹"))) || 
                                    text.includes("주디 노트 열어") || text.includes("메모장 열어");
                                    
          if (isMagicLinkIntent) {
             const magicToken = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
             const cache = CacheService.getScriptCache();
             cache.put("MAGIC_" + magicToken, senderName, 600); // 10분만 유효한 토큰 캐싱
             
             const webAppUrl = ScriptApp.getService().getUrl();
             const magicLink = webAppUrl + "?token=" + magicToken;
             
             // 슬랙 버튼 UI 구성
             const msgPayload = {
               channel: event.user,
               text: "주디 노트 매직 링크가 도착했습니다.",
               blocks: [
                 {
                   "type": "section",
                   "text": {
                     "type": "mrkdwn",
                     "text": `✨ *${senderName}* 님을 위한 전용 주디 접속 링크입니다.\n(이 링크는 10분 내 1회 클릭으로 인증되며, 이후 자유롭게 이용 가능합니다)`
                   }
                 },
                 {
                   "type": "actions",
                   "elements": [
                     {
                       "type": "button",
                       "text": {
                         "type": "plain_text",
                         "text": "🐰 내 주디 워크스페이스 열기",
                         "emoji": true
                       },
                       "url": magicLink,
                       "style": "primary"
                     }
                   ]
                 }
               ]
             };
             
             const slackToken = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
             if (slackToken) {
               UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
                  method: "post", contentType: "application/json", headers: { "Authorization": "Bearer " + slackToken },
                  payload: JSON.stringify(msgPayload), muteHttpExceptions: true
               });
             }
             return ContentService.createTextOutput(""); 
          }

          // 1. 검색 의도 파악 (Search Intent)
          const isSearchIntent = text.includes("오늘") && (text.includes("보여") || text.includes("검색") || text.includes("알려") || text.includes("뭐") || text.includes("기록"));
          
          if (isSearchIntent) {
            let todayMemoText = "오늘 기록된 메모가 없습니다.";
            if (typeof getArchivedMemos === 'function') {
               const memos = getArchivedMemos(senderName);
               if (memos && memos.length > 0) {
                 const latestMonth = memos[0];
                 const latestDay = latestMonth.days[0];
                 
                 const tz = Session.getScriptTimeZone();
                 const now = new Date();
                 const dateStr = Utilities.formatDate(now, tz, "yyyy-MM-dd");
                 
                 // 첫 번째 블록이 오늘 날짜인지 확인
                 if (latestDay && latestDay.date.includes(dateStr)) {
                   let formattedMemos = `📅 *${latestDay.date} 업무 기록 내역입니다:*\n\n`;
                   const sortedMemos = [...latestDay.memos].reverse(); 
                   sortedMemos.forEach(m => {
                     formattedMemos += `• *[${m.time}]* ${m.content}\n`;
                   });
                   todayMemoText = formattedMemos;
                 }
               }
            }
            replyToSlack(todayMemoText);
            
            // 검색 결과를 알려주고 완전히 종료 (AI 챗봇 호출 차단)
            return ContentService.createTextOutput(""); 
          }
          
          // 2. 저장 의도 (Save Intent) - 검색/링크 의도가 아니면 단순 메모 저장
          if (typeof appendMemoToArchive === 'function') {
            appendMemoToArchive(senderName, text, event.user);
          }
          
          // 저장 후 즉시 종료하여 불필요한 AI 챗봇(processAiChatSync) 답변 스레드 생성을 차단!
          return ContentService.createTextOutput("");
        }

        // --- 공개 채널 멘션(@주디) 일 경우에만 아래 AI 챗봇 응답 진행 ---
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

// [16단계 - 속도 개선] Projects 시트에서 프로젝트 목록을 슬랙 드롭다운 옵션으로 반환
// ⚡ CacheService로 1시간 캐싱 → Slack 3초 타임아웃 방어 + GAS 콜드스타트 대응
// ⚠️ Slack static_select는 options가 빈 배열이면 모달 자체가 열리지 않으므로 반드시 1개 이상 보장
function getProjectOptions() {
  try {
    const CACHE_KEY = "PROJECT_OPTIONS_CACHE";
    const cache = CacheService.getScriptCache();
    
    // 1. 캐시 확인 (캐시 히트 시 시트 읽기 생략 → 즉시 반환)
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) return parsed;
    }
    
    // 2. 캐시 미스 시 시트에서 직접 읽기
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Projects");
    if (!sheet || sheet.getLastRow() < 2) {
      return [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
    }
    
    const data = sheet.getDataRange().getValues();
    const options = [];
    
    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0]).trim();
      const code = String(data[i][1]).trim();
      const active = String(data[i][2]).trim();
      
      if (name && code && active !== "미사용") {
        options.push({
          text: { type: "plain_text", text: name },
          value: code
        });
      }
    }
    
    const result = options.length > 0
      ? options
      : [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
    
    // 3. 캐시에 저장 (1시간 = 3600초, clearProjectCache로 수동 무효화 가능)
    cache.put(CACHE_KEY, JSON.stringify(result), 3600);
    
    return result;
  } catch (e) {
    console.error("getProjectOptions 에러:", e);
    return [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
  }
}

// [캐시 무효화] 프로젝트를 추가/수정했을 때 캐시를 즉시 삭제하여 최신 데이터 반영
function clearProjectCache() {
  CacheService.getScriptCache().remove("PROJECT_OPTIONS_CACHE");
}

// [16단계 NEW] 프로젝트 코드 기반 구조적 ID 생성 (예: GONG-001)
function generateTaskId(sheet, projectCode) {
  if (!projectCode) return "";
  
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]); // A열: 업무 ID
    if (id.startsWith(projectCode + "-")) {
      const num = parseInt(id.split("-")[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  
  return projectCode + "-" + String(maxNum + 1).padStart(3, "0");
}

function openTaskModal(triggerId, prefillDesc = "", userId = "", channelId = "") {
  const url = "https://slack.com/api/views.open";
  
  // [옵션 2] 상세 내용 블록 구성 (전달받은 텍스트가 있으면 initial_value로 채움)
  const descBlock = {
    type: "input", block_id: "desc_block", optional: true,
    element: { type: "plain_text_input", multiline: true, action_id: "desc_input", placeholder: { type: "plain_text", text: "상세 내용을 입력하세요 (선택)" } },
    label: { type: "plain_text", text: "상세 내용" }
  };
  if (prefillDesc) {
    // [보안 패치] PropertiesService 9KB 한도를 넘지 않도록 최대 길이를 1500자로 대폭 안전하게 제한
    descBlock.element.initial_value = prefillDesc.substring(0, 1500);
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
          element: { 
            type: "static_select", 
            action_id: "project_input", 
            placeholder: { type: "plain_text", text: "프로젝트를 선택하세요" },
            options: getProjectOptions()
          },
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

  // 토큰 획득 (안전망)
  const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
  if (!token) {
    Logger.log("[ERROR] openTaskModal: SLACK_TOKEN이 정의되지 않았습니다.");
    if (userId && channelId) {
      sendEphemeralError(userId, channelId, "⚠️ 시스템 오류: Slack 인증 토큰이 없습니다. 관리자에게 문의하세요.");
    }
    return ContentService.createTextOutput("");
  }

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + token }, 
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200 || (responseBody && !JSON.parse(responseBody).ok)) {
      Logger.log(`[ERROR] openTaskModal: Slack API 실패 (${responseCode})\nResponse: ${responseBody}`);

      if (userId && channelId) {
        let errorMsg = "업무 등록 모달을 여는 중 오류가 발생했습니다.";
        try {
          const errorData = JSON.parse(responseBody);
          if (errorData.error === "invalid_trigger") {
            errorMsg = "⏱️ 시간이 초과되었습니다. 명령어를 다시 실행해주세요.";
          } else if (errorData.error === "not_authed" || errorData.error === "invalid_auth") {
            errorMsg = "🔒 Slack 인증 오류가 발생했습니다. 관리자에게 문의하세요.";
          } else {
            errorMsg += ` (오류 코드: ${errorData.error})`;
          }
        } catch (e) {}

        sendEphemeralError(userId, channelId, "❌ " + errorMsg);
      }
      return ContentService.createTextOutput("");
    }

    Logger.log("[SUCCESS] openTaskModal: 모달 오픈 성공");
    return ContentService.createTextOutput("");

  } catch (err) {
    Logger.log(`[FATAL] openTaskModal: 예외 발생\n${err.message}\n${err.stack}`);
    if (userId && channelId) {
      sendEphemeralError(userId, channelId, "❌ 서버 통신 중 오류가 발생했습니다.");
    }
    return ContentService.createTextOutput("");
  }
}

/**
 * ⚡ 개선된 제출 함수: 사용자가 '등록' 버튼을 눌렀을 때 실행
 */
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  // [20단계] 상태 변경 모달 제출은 handleStatusChange로 라우팅
  if (payload.type === "view_submission" && payload.view.callback_id === "status_change_modal") {
    return handleStatusChange(payloadStr);
  }

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    const values = payload.view.state.values;
    // [16단계] static_select에서 선택된 프로젝트 코드와 이름 추출
    const projectCode = values.project_block.project_input.selected_option.value;  // 코드 (예: "GONG")
    const project = values.project_block.project_input.selected_option.text.text;  // 이름 (예: "공도 업무 관리")
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
    // [v3 핫픽스] 대용량 JSON 저장은 속도가 빠른 CacheService로, 키 관리는 PropertiesService로 하이브리드 저장
    const taskData = { project, projectCode, title, desc, username, ssId, dueDate, userId, assignedUserId };
    const props = PropertiesService.getScriptProperties();
    const cache = CacheService.getScriptCache();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    
    props.setProperty(uniqueId, "1"); // 1바이트 플래그 기록 (매우 빠름)
    cache.put(uniqueId, JSON.stringify(taskData), 600); // 10분간 캐시로 유지 (매우 빠름)
    
    // 2. 알람 예약 (백그라운드에서 시트 기록)
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1) 
      .create();
    
    // 3. 모달 제출 즉시 사용자에게 "등록 중" 메시지 전송 (Optimistic UI 피드백)
    const responsePayload = {
      "response_action": "update",
      "view": {
        "type": "modal",
        "title": { "type": "plain_text", "text": "등록 중..." },
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "⏳ *업무를 등록하고 있습니다...*\n구글 시트와 캘린더에 저장 중이니 잠시만 기다려주세요."
            }
          }
        ]
      }
    };
    return ContentService.createTextOutput(JSON.stringify(responsePayload))
      .setMimeType(ContentService.MimeType.JSON);
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

  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  for (const key in allProps) {
    if (key.startsWith("TASK_")) {
      const cachedData = cache.get(key);
      if (!cachedData) {
        // 캐시 데이터가 만료되거나 비어있으면 찌꺼기 키만 남은 것이므로 삭제하고 무시
        props.deleteProperty(key);
        continue;
      }
      const data = JSON.parse(cachedData);
      
      try {
        const ss = SpreadsheetApp.openById(data.ssId);
        const sheet = ss.getSheetByName("Tasks");
        
        // [1차 업그레이드] 슬랙 API로 할당된 담당자 이름(Real Name) 가져오기
        // ⚡ 본인 업무도 실명으로 저장 (fetchUserName 활용)
        let assigneeName = fetchUserName(data.assignedUserId || data.userId);
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

        // 시트 구조: A(ID), B(업무유형), C(상태), D(프로젝트), E(제목), F(내용), G(담당자), H(요청자), I(마감일), J~M(선행/우선순위/멘션/캘린더), N(수정일), O(등록시간)
        const taskId = generateTaskId(sheet, data.projectCode);
        const today = new Date();
        let rowData = [
          taskId,       // A: ID
          "일반",        // B: 업무 유형
          "대기",        // C: 상태
          data.project, // D: 프로젝트 (project 명칭)
          data.title,   // E: 제목
          data.desc,    // F: 상세 내용
          assigneeName, // G: 담당자
          data.username,// H: 요청자
          data.dueDate, // I: 마감일
          "",           // J: 선행 업무
          "",           // K: 우선순위
          "",           // L: 슬랙 멘션
          "",           // M: 캘린더 ID
          today,        // N: 최근 수정일
          today         // O: 업무 등록시간
        ];
        
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

        // [핵심 패치] 비동기 작업이 모두 성공했다면, 웹 대시보드(주디 워크스페이스)에서 즉각 조회되도록 캐시 무효화
        CacheService.getScriptCache().remove("ALL_TASKS_CACHE");

      } catch (err) {
        console.error("processAsyncTasks 처리 중 에러 발생:", err);
      } finally {
        // 성공하든 실패하든 무조건 큐에서 삭제하여 고아(Orphaned) 찌꺼기가 남는 것을 영구 방지
        props.deleteProperty(key);
        cache.remove(key); // 캐시 메모리 해제
      }
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
  
  // 1. 웹 메모장(주디 노트) 폴더명과 100% 일치시키기 위한 매핑
  const dict = {
    "U02S3CN9E6R": "송용남",
    "U08SJ3SJQ9W": "이지은",
    "U02SK29UVRP": "정혜림",
    "U0749G2SNBE": "문유나",
    "U04JL09C6DV": "이상호",
    "U02S3EURC21": "김관수"
  };
  if (dict[userId]) return dict[userId];

  // 2. 매핑에 없는 사람은 번거롭더라도 슬랙 API 호출
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

/**
 * [20단계] 내업무 비동기 처리 함수 (response_url로 전송)
 */
function processMyTasksAsync(e) {
  // 트리거 정리
  if (e && e.triggerUid) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === e.triggerUid) ScriptApp.deleteTrigger(trigger);
    }
  }

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  for (const key in allProps) {
    if (!key.startsWith("MYTASK_")) continue;
    try {
      const data = JSON.parse(allProps[key]);
      props.deleteProperty(key);
      
      const userName = fetchUserName(data.userId);
      const payload = buildMyTasksPayload(data.userId, userName, data.slackUsername, data.ssId);
      
      // response_url로 업무 리스트 전송 (replace_original로 로딩 메시지 교체)
      UrlFetchApp.fetch(data.responseUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (err) {
      console.error("processMyTasksAsync 에러:", err);
      props.deleteProperty(key);
    }
  }
}

/**
 * [20단계 UX 개선] 업무 리스트 페이로드 생성 (인라인 드롭다운 + 요약 카운터 + 마감일 경고)
 */
function buildMyTasksPayload(userId, userName, slackUsername, ssId) {
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName("Tasks");
  if (!sheet) {
    return { response_type: "ephemeral", text: "Tasks 시트를 찾을 수 없습니다." };
  }

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const myTasks = [];

  for (let i = 1; i < data.length; i++) {
    const rowId    = data[i][0];
    const status   = String(data[i][2]).trim();
    const project  = String(data[i][3]).trim();
    const title    = String(data[i][4]).trim();
    const assignee = String(data[i][6]).trim();
    const rawDue   = data[i][8];

    if (!title) continue;
    if (status === "완료") continue;
    if (assignee !== userName && assignee !== slackUsername) continue;

    // 마감일 파싱 및 D-Day 계산
    let dueDate = "";
    let dDays = null;
    if (rawDue) {
      const d = new Date(rawDue);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        dDays = Math.round((d - today) / 86400000);
        dueDate = (d.getMonth() + 1) + "/" + d.getDate();
      }
    }

    myTasks.push({ row: i + 1, id: rowId, title, project, status, dueDate, dDays });
  }

  if (myTasks.length === 0) {
    return {
      response_type: "ephemeral",
      text: "📋 " + userName + "님의 진행 중인 업무가 없습니다. 🎉"
    };
  }

  // 긴급도순 정렬: 기한초과 → 오늘 → 내일 → 나머지 → 마감일 없음
  myTasks.sort((a, b) => {
    const aPri = a.dDays !== null ? a.dDays : 9999;
    const bPri = b.dDays !== null ? b.dDays : 9999;
    return aPri - bPri;
  });

  // 상태별 카운트
  const counts = { "진행중": 0, "대기": 0, "보류": 0 };
  myTasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  // 상단 요약 카운터
  const summary = "▶️ 진행중 " + counts["진행중"] + "  ·  ⏸️ 대기 " + counts["대기"] + "  ·  🔴 보류 " + counts["보류"];

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: "📋 *" + userName + "님의 업무 현황*\n" + summary } },
    { type: "divider" }
  ];

  // 상태 드롭다운 옵션 (공통)
  const statusOptions = [
    { text: { type: "plain_text", text: "▶️ 진행중" }, value: "진행중" },
    { text: { type: "plain_text", text: "⏸️ 대기" },  value: "대기"  },
    { text: { type: "plain_text", text: "🔴 보류" },  value: "보류"  },
    { text: { type: "plain_text", text: "✅ 완료" },  value: "완료"  }
  ];

  for (const task of myTasks) {
    // 마감일 경고 이모지
    let dueTag = "";
    if (task.dDays !== null) {
      if (task.dDays < 0)       dueTag = "  ·  🚨 *" + Math.abs(task.dDays) + "일 초과!*";
      else if (task.dDays === 0) dueTag = "  ·  🔥 *오늘 마감!*";
      else if (task.dDays === 1) dueTag = "  ·  ⚠️ *내일 마감*";
      else                      dueTag = "  ·  📅 " + task.dueDate;
    }

    const idTag = task.id ? "*[" + task.id + "]* " : "";

    // 현재 상태를 initial_option으로 설정
    const currentOption = statusOptions.find(o => o.value === task.status);

    const sectionBlock = {
      type: "section",
      text: { type: "mrkdwn", text: idTag + task.title + "\n_" + task.project + dueTag + "_" },
      accessory: {
        type: "static_select",
        action_id: "status_select_" + task.row,
        options: statusOptions
      }
    };
    // initial_option 설정 (현재 상태 미리 선택)
    if (currentOption) {
      sectionBlock.accessory.initial_option = currentOption;
    }

    blocks.push(sectionBlock);
  }

  return {
    response_type: "ephemeral",
    blocks
  };
}

/**
 * [20단계] 인라인 드롭다운에서 상태 변경 시 즉시 시트 반영 + DM 알림
 */
function handleInlineStatusChange(rowNum, newStatus, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Tasks");
  if (!sheet || isNaN(rowNum)) return ContentService.createTextOutput("");

  sheet.getRange(rowNum, 3).setValue(newStatus);       // C열: 상태
  sheet.getRange(rowNum, 14).setValue(new Date());     // N열: 최근 수정일

  const taskTitle = sheet.getRange(rowNum, 5).getValue();
  const taskId    = sheet.getRange(rowNum, 1).getValue();
  const idTag     = taskId ? "[" + taskId + "] " : "";

  const msg = "✅ *업무 상태 변경 완료!*\n`" + idTag + taskTitle + "`\n→ 새 상태: *" + newStatus + "*";
  
  // 상태 변경 후 웹 대시보드 강제 새로고침 리프레시 캐시 삭제
  CacheService.getScriptCache().remove("ALL_TASKS_CACHE");

  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify({ channel: userId, text: msg }),
    muteHttpExceptions: true
  });

  return ContentService.createTextOutput("");
}

/**
 * [20단계] 업무 상태 변경 모달 열기
 */
function openStatusChangeModal(triggerId, rowNum, taskId, taskTitle) {
  const modalPayload = {
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "status_change_modal",
      private_metadata: String(rowNum),
      title: { type: "plain_text", text: "업무 상태 변경" },
      submit: { type: "plain_text", text: "변경 완료" },
      close: { type: "plain_text", text: "취소" },
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: (taskId ? "*[" + taskId + "]* " : "") + taskTitle }
        },
        {
          type: "input", block_id: "status_block",
          element: {
            type: "static_select",
            action_id: "status_input",
            placeholder: { type: "plain_text", text: "변경할 상태를 선택하세요" },
            options: [
              { text: { type: "plain_text", text: "▶️ 진행중" }, value: "진행중" },
              { text: { type: "plain_text", text: "⏸️ 대기" },  value: "대기"  },
              { text: { type: "plain_text", text: "🔴 보류" },  value: "보류"  },
              { text: { type: "plain_text", text: "✅ 완료" },  value: "완료"  }
            ]
          },
          label: { type: "plain_text", text: "새로운 상태" }
        }
      ]
    }
  };

  UrlFetchApp.fetch("https://slack.com/api/views.open", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify(modalPayload)
  });

  return ContentService.createTextOutput("");
}

/**
 * [20단계] 상태 변경 모달 제출 처리 — Tasks 시트에 상태 반영
 */
function handleStatusChange(payloadStr) {
  const payload = JSON.parse(payloadStr);
  if (payload.view.callback_id !== "status_change_modal") return ContentService.createTextOutput("");

  const rowNum    = parseInt(payload.view.private_metadata, 10);
  const newStatus = payload.view.state.values.status_block.status_input.selected_option.value;
  const userId    = payload.user.id;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Tasks");
  if (!sheet || isNaN(rowNum)) return ContentService.createTextOutput("");

  sheet.getRange(rowNum, 3).setValue(newStatus);       // C열: 상태
  sheet.getRange(rowNum, 14).setValue(new Date());     // N열: 최근 수정일

  const taskTitle = sheet.getRange(rowNum, 5).getValue();
  const taskId    = sheet.getRange(rowNum, 1).getValue();
  const idTag     = taskId ? "[" + taskId + "] " : "";

  const msg = "✅ *업무 상태 변경 완료!*\n`" + idTag + taskTitle + "`\n→ 새 상태: *" + newStatus + "*";
  
  // 상태 변경 후 웹 대시보드 강제 새로고침 리프레시 캐시 삭제
  CacheService.getScriptCache().remove("ALL_TASKS_CACHE");

  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify({ channel: userId, text: msg }),
    muteHttpExceptions: true
  });

  return ContentService.createTextOutput("");
}

/**
 * [QA 제안 v2] 프로젝트 캐시 워밍업 함수
 * - 매 10분마다 실행하여 캐시 만료 방지
 * - 스크립트 편집기 → 트리거 → 매 10분 실행으로 수동 등록 요망
 */
function warmupProjectCache() {
  try {
    Logger.log("=== 프로젝트 캐시 워밍업 시작 ===");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Projects");
    if (!sheet || sheet.getLastRow() < 2) {
      Logger.log("[WARN] Projects 시트가 비어있거나 존재하지 않음");
      return;
    }

    const data = sheet.getDataRange().getValues();
    const options = [];

    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0]).trim();
      const code = String(data[i][1]).trim();
      const active = String(data[i][2]).trim();

      if (name && code && active !== "미사용") {
        options.push({
          text: { type: "plain_text", text: name },
          value: code
        });
      }
    }

    const result = options.length > 0
      ? options
      : [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];

    const cache = CacheService.getScriptCache();
    cache.put("PROJECT_OPTIONS_CACHE", JSON.stringify(result), 3600); // 1시간 캐싱

    Logger.log(`[SUCCESS] 캐시 워밍업 완료: ${result.length}개 프로젝트`);
  } catch (e) {
    Logger.log("[ERROR] warmupProjectCache 실패: " + e.message);
  }
}
