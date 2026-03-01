# [김감사 QA] 슬랙 "이 메시지로 업무 등록" 기능 오류 분석

**검수자**: 김감사 (QA Specialist)
**검수일**: 2026-02-26
**대상 파일**: `src/gas/slack_command.gs`
**우선순위**: 🔴 높음 (Critical Bug - 기능 미작동)

---

## 📋 요약 (Executive Summary)

### 문제 상황
슬랙 댓글에서 `[점 3개] → "이 메시지로 업무 등록 Judy Ops"` 클릭 시 **업무 등록 모달이 나타나지 않음**.

### 근본 원인 (Root Cause)
1. **SLACK_TOKEN 참조 불일치**: 다른 파일에 정의된 변수를 직접 참조하여 `undefined` 에러 가능 (🔴 Critical)
2. **에러 처리 누락**: Slack API 실패 시 로깅/피드백 없음 (🟠 High)
3. **Slack App Manifest 설정 누락 가능성**: `message_actions` 설정 확인 필요 (🟡 Medium)

### 판정
⚠️ **Critical Bug** - 기능이 전혀 작동하지 않는 상태

---

## 🔥 핵심 문제 3가지 (우선순위 순)

### 1. SLACK_TOKEN 참조 불일치 (🔴 Critical)

**증거**: [slack_command.gs:447](../../src/gas/slack_command.gs#L447)
```javascript
headers: { "Authorization": "Bearer " + SLACK_TOKEN }
```

**문제점**:
- `SLACK_TOKEN`은 [slack_notification.gs:7](../../src/gas/slack_notification.gs#L7)에 정의됨
- GAS는 파일 로딩 순서에 따라 변수가 정의되지 않을 수 있음
- Line 197, 248에서는 안전하게 처리하지만, Line 447에서는 직접 참조

**수정안**:
```javascript
// 기존 코드 (slack_command.gs:447)
headers: { "Authorization": "Bearer " + SLACK_TOKEN }

// 수정안
const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
if (!token) {
  Logger.log("[ERROR] openTaskModal: SLACK_TOKEN이 정의되지 않았습니다.");
  return ContentService.createTextOutput(JSON.stringify({
    response_type: "ephemeral",
    text: "⚠️ 시스템 오류: Slack 인증 토큰이 없습니다. 관리자에게 문의하세요."
  })).setMimeType(ContentService.MimeType.JSON);
}

const options = {
  method: "post",
  contentType: "application/json",
  headers: { "Authorization": "Bearer " + token },
  payload: JSON.stringify(payload),
  muteHttpExceptions: true
};
```

---

### 2. API 응답 검증 누락 (🟠 High)

**증거**: [slack_command.gs:451-453](../../src/gas/slack_command.gs#L451-L453)
```javascript
UrlFetchApp.fetch(url, options);
return ContentService.createTextOutput("");
```

**문제점**:
- `UrlFetchApp.fetch()` 결과를 **전혀 검증하지 않음**
- Slack API 실패 시 (401, 404, 500 등) 사용자에게 피드백 없음
- 로그에도 기록되지 않아 디버깅 불가능

**예상 시나리오**:
| 오류 코드 | 원인 | 사용자 경험 |
|----------|------|-----------|
| `401 Unauthorized` | Token 만료/잘못됨 | 아무 일도 일어나지 않음 |
| `404 Not Found` | `callback_id` 불일치 | 아무 일도 일어나지 않음 |
| `invalid_trigger` | trigger_id 만료 (3초 제한) | 아무 일도 일어나지 않음 |

**수정안**:
```javascript
try {
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(`[ERROR] openTaskModal: Slack API 실패 (${responseCode})\nResponse: ${responseBody}`);

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

    return ContentService.createTextOutput(JSON.stringify({
      response_type: "ephemeral",
      text: "❌ " + errorMsg
    })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log("[SUCCESS] openTaskModal: 모달 오픈 성공");
  return ContentService.createTextOutput("");

} catch (err) {
  Logger.log(`[FATAL] openTaskModal: 예외 발생\n${err.message}\n${err.stack}`);
  return ContentService.createTextOutput(JSON.stringify({
    response_type: "ephemeral",
    text: "❌ 서버 통신 중 오류가 발생했습니다."
  })).setMimeType(ContentService.MimeType.JSON);
}
```

---

### 3. message_action 핸들러 안전성 부족 (🟡 Medium)

**증거**: [slack_command.gs:46-60](../../src/gas/slack_command.gs#L46-L60)

**문제점**:
- `trigger_id`, `payload.message.text` 존재 여부 검증 없음
- 예외 발생 시 catch 블록 없어 전체 서버 크래시 가능

**수정안**:
```javascript
else if (payload.type === "message_action" && payload.callback_id === "create_task_from_message") {
  try {
    const triggerId = payload.trigger_id;

    // 안전성 검증
    if (!triggerId) {
      Logger.log("[ERROR] message_action: trigger_id가 없습니다.");
      return ContentService.createTextOutput(JSON.stringify({
        response_type: "ephemeral",
        text: "❌ 시스템 오류: trigger_id가 없습니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!payload.message || !payload.message.text) {
      Logger.log("[ERROR] message_action: 메시지 내용이 없습니다.");
      return ContentService.createTextOutput(JSON.stringify({
        response_type: "ephemeral",
        text: "❌ 선택한 메시지에 내용이 없습니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let messageText = payload.message.text || "";
    const userId = payload.message.user;
    const realName = fetchUserName(userId);

    Logger.log(`[INFO] message_action: 메시지 작성자=${realName}, 길이=${messageText.length}자`);

    // 멘션 치환
    messageText = messageText.replace(/<@(U[A-Z0-9]+)>/g, function(match, id) {
      return "@" + fetchUserName(id);
    });

    const prefillDesc = `[${realName}의 메시지에서 파생됨]\n${messageText}`;
    return openTaskModal(triggerId, prefillDesc);

  } catch (err) {
    Logger.log(`[FATAL] message_action 처리 중 오류:\n${err.message}\n${err.stack}`);
    return ContentService.createTextOutput(JSON.stringify({
      response_type: "ephemeral",
      text: "❌ 메시지 처리 중 오류가 발생했습니다."
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 🧪 테스트 체크리스트

### ✅ Phase 1: Token 검증
```javascript
// Apps Script Editor에서 직접 실행
function testToken() {
  const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  Logger.log("Token 존재 여부: " + (token ? "✅ 있음" : "❌ 없음"));
  Logger.log("Token 길이: " + (token ? token.length : 0));
  Logger.log("Token 시작: " + (token ? token.substring(0, 10) + "..." : "N/A"));
}
```

**Expected**:
- Token 존재 여부: ✅ 있음
- Token 길이: 56
- Token 시작: xoxb-29029...

### ✅ Phase 2: Slack App Manifest 확인
1. [ ] https://api.slack.com/apps → 앱 선택
2. [ ] Features > Interactivity & Shortcuts 클릭
3. [ ] "Message shortcuts" 섹션에 다음이 있는지 확인:
   - Name: "이 메시지로 업무 등록 Judy Ops"
   - Callback ID: `create_task_from_message`
   - Description: "선택한 메시지 내용으로 새 업무를 등록합니다"

**Expected**: Message Shortcut이 존재하고 Callback ID가 `create_task_from_message`

### ✅ Phase 3: 실제 슬랙 테스트
1. [ ] 슬랙 채널에서 임의의 메시지 작성
2. [ ] 메시지 우측 `[점 3개]` 클릭
3. [ ] "이 메시지로 업무 등록 Judy Ops" 클릭
4. [ ] 모달창이 열리는지 확인
   - 제목: "새 업무 등록"
   - 상세 내용: `[작성자의 메시지에서 파생됨]\n원본 메시지`
5. [ ] 프로젝트 선택 후 "등록 완료하기" 클릭
6. [ ] "업무가 등록되었습니다" DM 수신 확인

### ✅ Phase 4: 로그 확인
```
Apps Script Editor > 실행 > 실행 기록

[INFO] message_action: 메시지 작성자=정혜림, 길이=42자
[SUCCESS] openTaskModal: 모달 오픈 성공
```

**Expected**: 에러 로그 없이 SUCCESS 로그만 표시

---

## 📊 근본 원인 분석 (5 Whys)

### Why 1: 왜 모달이 나타나지 않았나?
→ Slack API 호출이 실패했기 때문

### Why 2: 왜 API 호출이 실패했나?
→ SLACK_TOKEN이 undefined이거나 Manifest 설정이 없기 때문

### Why 3: 왜 SLACK_TOKEN이 undefined인가?
→ 다른 파일에 정의된 변수를 직접 참조하여 로딩 순서에 따라 정의되지 않을 수 있음

### Why 4: 왜 에러를 알 수 없었나?
→ API 응답 검증 및 에러 로깅이 없었기 때문

### Why 5: 왜 재발 방지가 안 되었나?
→ 코드 리뷰 시 "모든 외부 API 호출은 응답 검증 필수" 규칙이 없었음

---

## 🔄 재발 방지 대책

### 1. 코딩 규칙 추가
```markdown
## 외부 API 호출 필수 규칙
1. 모든 UrlFetchApp.fetch() 호출은 try-catch로 감싸기
2. responseCode !== 200 검증 필수
3. muteHttpExceptions: true 사용
4. 에러 시 Logger.log() 및 사용자 피드백 제공
```

### 2. Token 관리 규칙
```javascript
// ❌ 나쁜 예
headers: { "Authorization": "Bearer " + SLACK_TOKEN }

// ✅ 좋은 예
const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
if (!token) {
  Logger.log("[ERROR] Token이 없습니다.");
  return errorResponse("시스템 오류: 인증 토큰이 없습니다.");
}
```

### 3. QA 체크리스트 강화
- [ ] 모든 Slack Shortcut/Command는 Manifest와 코드의 `callback_id` 일치 확인
- [ ] Token 검증 스크립트 실행
- [ ] 로그 확인 후 배포

---

## 📞 담당자 배정

| 단계 | 담당자 | 예상 시간 | 상태 |
|------|--------|----------|------|
| 수정안 검토 | 자비스 (PO) | 5분 | ⏳ Pending |
| 코드 수정 | 아다 (Backend) | 15분 | ⏳ Pending |
| Manifest 확인 | 자비스 (PO) | 5분 | ⏳ Pending |
| 최종 QA | 김감사 (QA) | 10분 | ⏳ Pending |
| **Total** | - | **35분** | - |

---

## 📝 참고 문서

- [Slack API - Message Shortcuts](https://api.slack.com/interactivity/shortcuts/using#message_shortcuts)
- [slack_command.gs](../../src/gas/slack_command.gs)
- [slack_notification.gs](../../src/gas/slack_notification.gs)
- [AI Agent Team Rules v2.0](../../docs/guides/AI_AGENT_TEAM_RULES.md)

---

**작성자**: 김감사 (QA Specialist)
**최종 수정**: 2026-02-26 17:00
**버전**: 1.0
