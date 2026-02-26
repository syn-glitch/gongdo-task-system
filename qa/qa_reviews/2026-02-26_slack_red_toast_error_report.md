# [김감사 QA팀 검토용] 슬랙 "이 메시지로 업무 등록" 붉은색 에러 토스트 분석 및 핫픽스 (v2)

**작성자**: 자비스 (PO) / 안티그래피티 (Agentic 개발)
**검토 요청 대상**: 김감사 (QA Specialist) 및 QA 팀
**작성일**: 2026-02-26
**대상 파일**: `src/gas/slack_command.gs`
**우선순위**: 🔴 높음 (Critical Bug - UX 크래시)

---

## 📋 1. 버그 현상 요약 (Bug Report)

최근 배포된 `slack_command.gs` 핫픽스 이후, 슬랙 사용자가 댓글에서 `[점 3개] → "이 메시지로 업무 등록 Judy Ops"` 숏컷 기능을 클릭하여 에러 상황(예: payload 데이터 누락, 토큰 오류 등)에 직면할 경우, **시스템 다이얼로그인 붉은색 에러 토스트("죄송합니다. 제대로 작동하지 않았습니다. 다시 시도하시겠습니까?")가 발생**하는 치명적 엣지 케이스가 발견되었습니다.

## 🕵️‍♂️ 2. 근본 원인 분석 (Root Cause Analysis: PO / Dev)

해당 이슈는 이전에 김감사님이 `2026-02-26_slack_message_action_bug_report.md` 문서에서 지적한 내용("API 응답 검증 누락 및 예외 발생 시 피드백 없음")을 수선하는 과정에서 발생한 **프로토콜 스펙 충돌(Protocol Specification Mismatch)**입니다.

1. **기존 QA 수정 (문제 촉발)**: 에러 발생 시 사용자에게 피드백을 주기 위해 앱스 스크립트에서 아래와 같이 **JSON 데이터**(`response_type: "ephemeral"`)를 Return 하도록 코드를 변경했습니다.
   ```javascript
   // ❌ 문제가 된 기존 수정 방식 (JSON Return)
   return ContentService.createTextOutput(JSON.stringify({
     response_type: "ephemeral",
     text: "❌ 메시지 처리 중 오류가 발생했습니다."
   })).setMimeType(ContentService.MimeType.JSON);
   ```

2. **Slack API 스펙의 이중성**: 
   - 일반적인 **Slash Command (`/주디`)**: 위와 같이 `response_type` JSON을 Return 하면 에피메럴(Ephemeral) 메시지로 잘 변환하여 보여줍니다.
   - **Message Shortcut (Interactivity Payload)**: 이 인터페이스는 HTTP 200 OK 빈 텍스트(Acknowledge)만 즉시 반환받기를 기대합니다. 만약 **JSON을 Return하면 이를 "비정상 응답(Malformed Response)"으로 간주**하고 붉은 토스트를 띄웁니다.

3. **`SLACK_TOKEN` 획득 안정성 (추가 원인)**: V8 엔진이 구동되는 GAS의 첫 콜드스타트 로딩 시점에서는 `const token = typeof SLACK_TOKEN...` 평가 로직조차 드물게 런타임 에러를 뱉는 일이 있어 확실한 폴백(Fallback) 안전망이 한 층 더 필요합니다.

---

## 🛠 3. 해결 방안 및 핫픽스 계획 (Proposed Solution)

김감사(QA) 팀의 검토 후 바로 배포할 수 있는 2차 핫픽스 코딩 방향은 다음과 같습니다.

### [Fix 1] JSON Return 구조 전면 철폐 및 공식 API 호출로 전환
- `slack_command.gs`의 `message_action` 블록 및 `openTaskModal` 함수 안의 모든 `try-catch` 블록에서 JSON 반환 코드를 일괄 제거합니다.
- 조용히 자신에게만 보이는 에러 메시지(Ephemeral)를 발송하려면 `Return`이 아닌 **슬랙 공식 `chat.postEphemeral` API**를 직접 호출하여 푸시합니다.
- 스크립트의 맨 끝은 무조건 **빈 HTTP 200 OK**(`return ContentService.createTextOutput("");`) 구조만을 고정적으로 반환하도록 하여, 슬랙 시스템이 오류를 띄우지 않도록(Acknowledge 응답) 방어합니다.

### [Fix 2] `SLACK_TOKEN` 획득 이중 안전망 구축
- 파일 최상단이나 공통 헬퍼에서 한 번만 `PropertiesService`를 안전하게 캐싱해 오도록 변환하여 런타임 크래시를 원천 차단합니다.

---

## ✅ 4. QA 팀 검토 요청 (Review Request)

QA 리드 김감사님, 위 분석 내용과 해결 방향(JSON Return → `chat.postEphemeral` 백그라운드 호출 → 무조건 Empty `200 OK` 응답)에 대해 보안/기능상 문제가 없는지 최종 리뷰(교차 체크)를 요청드립니다. 

**승인이 완료되면 즉시 `slack_command.gs` 코드를 수정하여 최종본(V2)을 제출하겠습니다.**
