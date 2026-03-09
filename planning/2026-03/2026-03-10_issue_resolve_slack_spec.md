<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        2026-03-10_issue_resolve_slack_spec.md
 @version     v1.0.0
 @updated     2026-03-10 (KST)
 @agent       송PO (벙커팀)
 @ordered-by  용남 대표
 @description 이슈 해결 슬랙 DM 플로우 구현 명세서 — 자비스팀 전달용

 @change-summary
   AS-IS: 없음 (신규)
   TO-BE: GitHub Issue close → 슬랙 DM 자동 발송 구현 명세

 @features
   - [추가] 구현 명세서 최초 작성

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-10 | 송PO | 최초 작성
 ============================================
-->

# 이슈 해결 슬랙 DM 플로우 — 구현 명세서

**작성**: 벙커팀 송PO (김CM 협업)
**대상**: 자비스 개발팀 (에이다 BE)
**관련 태스크**: BK-2026-03-10-001 → JV-2026-03-10-001

---

## 1. 개요

GitHub Issue가 close될 때, 아래 두 가지 슬랙 DM을 자동 발송한다:
1. **용남 대표**: 해결 보고 (상세)
2. **제보 직원**: 해결 알림 (간결)

---

## 2. 트리거 방식: GitHub Webhook

### 2.1 Webhook 설정

```
Repository: syn-glitch/gongdo-task-system
Settings → Webhooks → Add webhook

Payload URL: [GAS 웹앱 배포 URL]
Content type: application/json
Secret: (선택 — HMAC 검증용)
Events: Issues만 선택 (opened, closed, reopened 등)
Active: ✅
```

### 2.2 Webhook Payload 핵심 필드 (Issues event)

```json
{
  "action": "closed",
  "issue": {
    "number": 42,
    "title": "칸반 보드 드래그 오류",
    "body": "## 🐛 이슈 제보\n...\n<!-- METADATA\nreporter_slack_id: U12345678\n... -->",
    "html_url": "https://github.com/syn-glitch/gongdo-task-system/issues/42",
    "labels": [{"name": "from-workspace"}, {"name": "bug"}],
    "created_at": "2026-03-10T05:30:00Z",
    "closed_at": "2026-03-11T00:15:00Z",
    "user": {"login": "reporter-github-user"}
  },
  "sender": {"login": "closer-github-user"}
}
```

---

## 3. GAS 함수 명세

### 3.1 Webhook 수신 함수

기존 `github_to_sheet_webhook.gs`의 `doPost`를 확장하거나, `github_issue.gs`에 분기 로직을 추가한다.

```
함수명: handleIssueCloseWebhook(payload)

Input: GitHub Webhook payload (JSON)

처리 로직:
1. payload.action !== "closed" → return (무시)
2. payload.issue.labels에 "from-workspace" 없음 → return (무시)
3. parseIssueMetadata(payload.issue.body) 호출
4. 메타데이터 파싱 성공 → DM 2건 발송
5. 메타데이터 파싱 실패 → 에러 로깅 + 대표에게만 간략 DM

Output: ContentService JSON 응답 { status: "success" | "skipped" | "error" }
```

### 3.2 메타데이터 파싱 함수

```
함수명: parseIssueMetadata(issueBody)

Input: GitHub Issue body (string)

로직:
1. 정규식: /<!-- METADATA\n([\s\S]*?)-->/
2. 매치된 블록을 라인별 split
3. 각 라인에서 "key: value" 추출 (첫 번째 ': ' 기준 split)
4. trim 처리 후 Object로 반환

Output (성공):
{
  reporter_slack_id: "U12345678",
  reporter_name: "홍길동",
  category: "bug",
  severity: "high",
  location: "kanban-board",
  workspace_version: "v3.1.0",
  submitted_at: "2026-03-10T14:30:00+09:00"
}

Output (실패): null

필수 필드 검증:
- reporter_slack_id가 없으면 → null 반환 (제보자 DM 불가)
- reporter_name이 없으면 → "알 수 없는 제보자"로 대체
```

### 3.3 대표 해결 보고 DM 함수

```
함수명: sendIssueResolveReportDM(issue, metadata)

Input:
  - issue: { number, title, html_url, created_at, closed_at, labels }
  - metadata: parseIssueMetadata() 결과

로직:
1. 소요 시간 계산: closed_at - submitted_at (또는 created_at)
2. 카테고리/심각도 한글 변환
3. 메시지 조립 (아래 포맷)
4. sendTaskDM("송용남", message) 호출

메시지 포맷:
━━━━━━━━━━━━━━━━━━━━
✅ 이슈 해결 보고
━━━━━━━━━━━━━━━━━━━━
🔢 이슈: #{number} — {title}
🏷️ 카테고리: {category} | 심각도: {severity}
👤 제보자: {reporter_name}
📅 제보일: {submitted_at (KST 변환)}
📅 해결일: {closed_at (KST 변환)}
⏱️ 소요 시간: {diff 계산}

🔗 GitHub: {html_url}

📨 제보자({reporter_name})에게 해결 알림 DM 발송 완료
━━━━━━━━━━━━━━━━━━━━
```

### 3.4 제보자 해결 알림 DM 함수

```
함수명: sendIssueResolveNotifyDM(issue, metadata)

Input: 위와 동일

로직:
1. metadata.reporter_slack_id 확인
2. 메시지 조립 (아래 포맷)
3. triggerSlackDM(reporter_slack_id, message) 호출
   (또는 기존 conversations.open → chat.postMessage 패턴)

메시지 포맷:
━━━━━━━━━━━━━━━━━━━━
✅ 이슈가 해결되었습니다!
━━━━━━━━━━━━━━━━━━━━
🔢 이슈 #{number}: {title}

제보해 주신 이슈가 해결되었습니다.
업데이트된 워크스페이스에서 확인해 보세요. 🙏

🔗 상세: {html_url}

다른 이슈가 있으시면 워크스페이스 '이슈' 탭에서 제보해 주세요!
━━━━━━━━━━━━━━━━━━━━
```

---

## 4. 기존 함수 재사용 가이드

| 기존 함수 | 위치 | 용도 | 사용 방법 |
|----------|------|------|----------|
| `sendTaskDM(userName, message)` | `web_app.gs:910` | 대표 보고 DM | `sendTaskDM("송용남", 보고메시지)` |
| `triggerSlackDM(userId, message)` | `slack_command.gs:711` | 제보자 알림 DM | `triggerSlackDM(reporter_slack_id, 알림메시지)` — Slack ID 직접 사용 |
| `USER_NAME_TO_SLACK_ID` | `web_app.gs` 상단 | 이름→ID 매핑 | 대표 DM에 활용 (이미 사용 중) |

### 주의사항

- `sendTaskDM`은 **사용자명**(예: "송용남") 기반 → 내부에서 `USER_NAME_TO_SLACK_ID` 조회
- 제보자는 **Slack ID**(예: "U12345678")가 메타데이터에 있으므로 → `triggerSlackDM` 또는 직접 `conversations.open` 패턴 사용
- 두 함수가 다른 파일에 있으므로, `github_issue.gs`에서 호출 가능한지 확인 필요 (GAS는 같은 프로젝트 내 전역 함수 접근 가능)

---

## 5. 에러 핸들링

| 시나리오 | 대응 |
|---------|------|
| 메타데이터 파싱 실패 (METADATA 블록 없음) | 대표에게만 간략 DM 발송 ("이슈 #{N} 해결됨, 제보자 정보 없음") |
| reporter_slack_id 누락 | 대표 DM은 정상 발송, 제보자 DM은 스킵 + 로깅 |
| Slack DM 발송 실패 (토큰 오류 등) | 에러 로깅 (console.error), 다른 DM은 독립 실행 |
| Webhook 중복 수신 (같은 이벤트 2회) | issue.number + closed_at 조합으로 중복 체크 (CacheService 10분) |
| from-workspace 라벨 없는 이슈 close | 무시 (워크스페이스 제보가 아닌 이슈) |

---

## 6. 구현 위치 제안

`src/gas/github_issue.gs`에 통합 구현 권장:

```
github_issue.gs
├── createGitHubIssue()        ← 1단계: 이슈 생성
├── getGitHubIssues()          ← 1단계: 이슈 목록
├── getGitHubIssueDetail()     ← 1단계: 이슈 상세
├── submitIssueFromWeb()       ← 1단계: 프론트 연동
├── uploadImageToDrive()       ← 1단계: 이미지 업로드
│
├── handleIssueCloseWebhook()  ← 3단계: close 이벤트 처리
├── parseIssueMetadata()       ← 3단계: 메타데이터 파싱
├── sendIssueResolveReportDM() ← 3단계: 대표 보고 DM
└── sendIssueResolveNotifyDM() ← 3단계: 제보자 알림 DM
```

### Webhook doPost 분기

기존 `github_to_sheet_webhook.gs`의 `doPost`와 충돌 주의.
→ 권장: 하나의 `doPost`에서 이벤트 타입별 분기 처리

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);

  // GitHub Issues event (Webhook)
  if (payload.action && payload.issue) {
    return handleIssueCloseWebhook(payload);
  }

  // 기존 Agent Tasks webhook
  if (payload.taskId) {
    return handleAgentTaskWebhook(payload);
  }
}
```

---

## 7. GitHub Webhook 등록 절차 (대표 승인 필요)

1. https://github.com/syn-glitch/gongdo-task-system/settings/hooks 접속
2. "Add webhook" 클릭
3. Payload URL: GAS 웹앱 배포 URL 입력
4. Content type: `application/json`
5. Events: "Let me select individual events" → ✅ Issues 체크
6. Active: ✅
7. "Add webhook" 저장

> ⚠️ GAS 웹앱 URL이 변경되면 Webhook URL도 업데이트 필요
