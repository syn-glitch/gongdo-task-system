# Slack Modal & Google Apps Script (GAS) 연동 시 발생하는 타임아웃/에러 해결 가이드

## 🚨 문제 원인: GAS의 302 리다이렉트와 Slack의 응답 형식 충돌

Slack 모달(Modal)에서 사용자가 '등록' 버튼을 클릭(Interactivity)했을 때, 다음과 같은 오류 상황에 직면할 수 있습니다.

**증상:**
1. 데이터는 구글 시트(GAS)에 정상적으로 기록되지만, Slack 화면에는 "연결하는 데 문제가 발생했습니다"라는 붉은 에러 창이 뜹니다.
2. 모달창을 닫기 위해 `{"response_action": "clear"}` 또는 다음 화면을 띄우기 위해 `{"response_action": "update"}` 같은 JSON 응답을 시도할 때 발생합니다.

**진짜 원인:**
- **시간 초과(Timeout)가 아닙니다:** GAS 실행 로그를 보면 1초 내외로 성공적으로 종료됩니다.
- **구글의 보안 정책 (302 Redirect):** 구글 Apps Script는 어떤 HTTP POST 요청에 대해 JSON 응답을 할 때, 항상 임시 URL로 한 번 주소를 넘기는(302 Redirect) 과정을 강제합니다.
- **슬랙의 깐깐한 수신 규칙:** 슬랙은 최초 요청한 주소에서 일직선으로(200 OK) 내려오는 JSON 데이터만 정상적인 명령으로 읽습니다. 중간에 한 번이라도 리다이렉트(302)를 타게 되면, 그 안에 아무리 정확한 JSON 응답(`response_action`)이 들어있어도 파싱을 포기하고 무조건 에러 처리해버립니다.

---

## 💡 해결책 1: 순수 GAS만 사용할 때 (가장 단순한 방법)

별도의 백엔드 서버 없이 오직 Google Apps Script만 사용해야 한다면, 슬랙에게 **아무런 JSON 명령도 내리지 않는 것**이 유일한 답입니다.

**방법:**
모달 제출 처리(`doPost` 내부)의 가장 마지막 응답으로 **순수 빈 문자열**만 반환합니다.
```javascript
// 실패하는 코드 (에러 유발)
return ContentService.createTextOutput(JSON.stringify({"response_action": "clear"}))
  .setMimeType(ContentService.MimeType.JSON);

// 성공하는 코드 (모달이 조용히 닫힘)
return ContentService.createTextOutput("");
```
> **한계점:** 이 방식을 쓰면 "등록이 완료되었습니다" 같은 두 번째 확인 모달창(`response_action: update`)을 띄우는 화려한 UX는 절대 구현할 수 없습니다. 단순히 창이 스르륵 닫히고 끝납니다.

---

## 🚀 해결책 2: 가장 완벽한 구현 (Python Proxy 서버 도입)

(※ 과거 '혜림AX 영수증 파싱 봇'에서 성공적으로 안착했던 방식입니다.)

성공 팝업 모달을 유려하게 띄우고, 구글 시트의 응답 지연(Latency) 문제에서도 완벽하게 해방되려면 **슬랙과 GAS 사이에 번역기(Proxy) 서버를 하나 두어야 합니다.**

### 작동 원리 (Pipe-line)
1. 사용자가 슬랙에서 [등록] ➡️ **Python 서버**가 요청을 받음
2. **Python 서버**는 즉각 응답(0.01초): `{"response_action": "update", "view": {...완료 팝업...}}` (직접 JSON을 내려주므로 슬랙이 에러 없이 예쁘게 완료 창을 띄움!)
3. **Python 서버**는 방금 받은 데이터를 백그라운드에서 구글 Apps Script(GAS)로 조용히 쏴줌(Forward).
4. **GAS**는 시간 눈치 볼 필요 없이 천천히 구글 시트에 데이터를 기록함.

### Vercel / Render 등 무료 클라우드 활용
내 컴퓨터를 항상 켜두고 `ngrok`을 써야 하는 부담을 지우기 위해, 이 가벼운 Python(Flask) 코드를 **Vercel**이나 **Render.com** 같은 무료 클라우드에 딱 한 번 올려둡니다 (배포).
- 클라우드가 나만의 고정 URL(예: `https://my-slack-proxy.onrender.com/slack/events`)을 무료로 만들어 줍니다.
- 이 주소를 슬랙 API 홈페이지의 `Request URL`로 지정하면 24시간 365일 에러 없는 봇이 완성됩니다.

이 방식이 용남님이 원하시는 **[에러 없는 팝업 띄우기 + ngrok 안 쓰기]**를 모두 만족하는 가장 완벽하고 전문적인 앱 연동 아키텍처입니다.
