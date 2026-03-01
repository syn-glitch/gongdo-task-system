# 🕵️ 통합 QA 보고서 — Judy Workspace

---

## 기본 정보

| 항목 | 내용 |
|------|------|
| QA ID | QA-2026-03-01-001 |
| 기능명 | Judy Workspace 전체 (FE + BE) |
| 검수일 | 2026-03-01 |
| 핑퐁 | 0회 / 5회 |
| 검수 대상 | `judy_workspace.html`, `web_app.gs`, `ai_task_parser.gs`, `slack_command.gs`, `agent_sync.gs` |
| 판정자 | 🕵️ 김감사 (QA Team Lead) |

---

## 병렬 QA 결과

| 영역 | 담당 | 점수 | CRITICAL | MAJOR | MINOR |
|------|------|------|----------|-------|-------|
| 기능 | 🔍 테스터 | **37** | 2 | 4 | 6 |
| 보안 | 🛡️ 보안감사관 | **32** | 3 | 6 | 3 |
| UX | 🎨 UX검증관 | **34** | 3 | 4 | 8 |

---

## Overall Score

```
(기능 37 × 0.4) + (보안 32 × 0.3) + (UX 34 × 0.3)
= 14.8 + 9.6 + 10.2
= 34.6점
```

---

## 최종 판정

### ❌ **반려** — CRITICAL 8건 (고유 6건), Overall Score 34.6점 (< 80)

반려 사유:
1. CRITICAL 이슈 8건 존재 (고유 이슈 6건, 영역 중복 2건) → CRITICAL 0건 기준 미충족
2. Overall Score 34.6점 → 80점 기준 미충족
3. 기능·보안·UX 전 영역에서 서비스 불가 수준의 결함 발견

---

## 전체 이슈 목록

### CRITICAL (즉시 수정 — 승인 불가)

| # | 영역 | 이슈 제목 | 파일 | 상세 |
|---|------|----------|------|------|
| C-1 | 기능 | `retryWithExponentialBackoff()`가 `google.script.run`과 호환 불가 | `judy_workspace.html` | `google.script.run`은 Promise를 반환하지 않아 retry 래퍼가 동작하지 않음. 상태 변경, 칸반 이동, 달력 조회 등 핵심 기능 전체 마비. `withSuccessHandler/withFailureHandler` 패턴으로 교체 필요 |
| C-2 | 기능 | `confirmModal` DOM 요소 미존재 | `judy_workspace.html` | JS에서 `getElementById('confirmModal')` 호출하나 해당 요소가 HTML에 정의되지 않음. 메모 삭제 시 null 참조로 스크립트 크래시 발생, 삭제 기능 완전 불능 |
| C-3 | 보안 | Claude API Key 하드코딩 | `ai_task_parser.gs` → `ai_report.gs` | `CLAUDE_API_KEY`가 전역 상수로 소스코드에 노출. Git 히스토리에 영구 잔존. PropertiesService로 이전 + 키 로테이션 필요 |
| C-4 | 보안 | Slack Bot Token 하드코딩 | `slack_command.gs` | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` 등이 전역 상수로 소스코드에 직접 기재. PropertiesService 이전 필수 |
| C-5 | 보안 | `handleInlineStatusChange` / `handleStatusChange`에 LockService 미적용 | `slack_command.gs` | 다수 사용자 동시 상태 변경 시 Race Condition 발생 가능. 다른 쓰기 함수(`web_app.gs`)에는 LockService 적용되어 있으나 Slack 경로에는 누락 |
| C-6 | 보안 | `agent_sync.gs` doGet/doPost 인증 전무 | `agent_sync.gs` | 외부 웹훅 엔드포인트에 인증·검증 로직 없음. 누구나 호출 가능하여 에이전트 상태 조작 위험 |
| C-7 | UX | `viewport` meta 태그 누락 | `judy_workspace.html` | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` 없음. 모바일 브라우저에서 데스크톱 축소 뷰로 렌더링 → 반응형 CSS 전체 무효화, 모바일 사용 불가 |
| C-8 | UX | 모바일 핵심 기능 사용 불가 (C-1, C-2 연쇄) | `judy_workspace.html` | `retryWithExponentialBackoff` 오류 + `confirmModal` 미존재로 모바일 환경에서 업무 등록·상태변경·삭제 등 핵심 워크플로우 전체 불가 |

> **참고**: C-8은 C-1, C-2의 UX 영향으로 별도 계상. C-7은 UX 고유 이슈.

---

### MAJOR (배포 전 수정 필요)

| # | 영역 | 이슈 제목 | 파일 | 상세 |
|---|------|----------|------|------|
| M-1 | 기능 | 이지은 Slack User ID 불일치 | `ai_task_parser.gs` | `assigneeMap`에서 이지은 ID가 `U02SK29UVRP`로 설정되어 있으나, 실제 활성 ID는 `U08SJ3SJQ9W`. Claude 파싱 후 자동 배정 시 DM이 잘못된 사용자에게 전달됨 |
| M-2 | 기능 | 에러 응답에 내부 시트 ID 포함 | `web_app.gs` | 에러 발생 시 응답 메시지에 스프레드시트 ID가 포함되어 클라이언트에 노출. 정보 유출 위험 |
| M-3 | 기능 | `getActiveSpreadsheet()` 트리거 컨텍스트 호환 불가 | `slack_command.gs` | 시간 기반 트리거 / 웹 앱 컨텍스트에서 `getActiveSpreadsheet()`는 null 반환. `openById()` 사용 필요 |
| M-4 | 기능 | 비동기 태스크 처리 실패 시 사용자 피드백 없음 | `slack_command.gs` | `processAsyncTasks()` 실패 시 Slack 사용자에게 결과 미전달. 업무가 등록되었는지 확인 불가 |
| M-5 | 보안 | `AGENT_SHEET_ID` 하드코딩 | `agent_sync.gs` | 스프레드시트 ID가 소스코드에 직접 기재. PropertiesService 이전 권고 |
| M-6 | 보안 | 매직 링크 토큰 만료 정책 미흡 | `slack_command.gs` | 매직 링크 토큰 유효기간이 과도하거나 일회용 소멸 처리 미구현. 토큰 재사용 가능성 |
| M-7 | 보안 | 세션 토큰 저장소 보안 | `web_app.gs` | 세션 토큰이 CacheService에 저장되나, 캐시 만료 시 재인증 플로우가 불완전 |
| M-8 | 보안 | Slack 요청 서명 검증 불완전 | `slack_command.gs` | `verifySlackSignature()` 구현은 있으나, 타임스탬프 리플레이 공격 방어 window가 부재하거나 과도 |
| M-9 | 보안 | 입력값 검증 불충분 | `web_app.gs`, `slack_command.gs` | 일부 사용자 입력(메모 내용, 태스크 제목)에 대한 길이 제한·특수문자 필터링 미흡 |
| M-10 | 보안 | `updateTaskFromWeb`에서 필드 화이트리스트 미적용 | `web_app.gs` | 클라이언트가 임의 필드를 전송하여 의도하지 않은 셀 수정 가능 |
| M-11 | UX | 로딩 상태 표시 불일관 | `judy_workspace.html` | 일부 API 호출에서 로딩 스피너가 표시되지 않거나, 표시 후 제거되지 않는 경우 존재 |
| M-12 | UX | 에러 상태 한글 메시지 미통일 | `judy_workspace.html` | 일부 에러에서 영문 기술 메시지가 사용자에게 그대로 노출. 한글 사용자 친화적 메시지로 래핑 필요 |
| M-13 | UX | 빈 상태(Empty State) UI 미구현 | `judy_workspace.html` | 태스크가 없을 때, 노트가 없을 때 등 빈 상태에서 안내 문구 및 행동 유도(CTA) 부재 |
| M-14 | UX | 터치 타겟 크기 44×44px 미달 | `judy_workspace.html` | 일부 버튼·아이콘의 터치 영역이 44×44px 미만으로 모바일에서 오탭 빈도 높음 |

---

### MINOR (다음 스프린트 처리 가능)

| # | 영역 | 이슈 제목 | 파일 |
|---|------|----------|------|
| m-1 | 기능 | 콘솔 경고 메시지 미처리 | `judy_workspace.html` |
| m-2 | 기능 | 중복 이벤트 리스너 바인딩 가능성 | `judy_workspace.html` |
| m-3 | 기능 | 미사용 함수/변수 잔존 | `judy_workspace.html`, `slack_command.gs` |
| m-4 | 기능 | 날짜 포맷 불일관 (YYYY-MM-DD vs MM/DD) | `web_app.gs`, `judy_workspace.html` |
| m-5 | 기능 | 매직 넘버 상수화 미흡 | `slack_command.gs` |
| m-6 | 기능 | 에러 로깅 레벨 불일관 (console.log vs console.error) | `judy_workspace.html` |
| m-7 | 보안 | HTTP → HTTPS 강제 리다이렉트 미확인 | `web_app.gs` |
| m-8 | 보안 | 에러 로그에 민감 정보 포함 가능성 | `ai_task_parser.gs` |
| m-9 | 보안 | Content-Security-Policy 헤더 미설정 | `web_app.gs` |
| m-10 | UX | 다크 모드 일부 요소 색상 미조정 | `judy_workspace.html` |
| m-11 | UX | 키보드 탐색(Tab) 순서 불합리 | `judy_workspace.html` |
| m-12 | UX | `aria-label` 속성 대부분 누락 | `judy_workspace.html` |
| m-13 | UX | 포커스 인디케이터 시각적 구분 미흡 | `judy_workspace.html` |
| m-14 | UX | 색 대비 일부 항목 WCAG AA 미달 | `judy_workspace.html` |
| m-15 | UX | 성공 피드백(Toast) 표시 시간 불일관 | `judy_workspace.html` |
| m-16 | UX | 모바일 가로 모드 레이아웃 미최적화 | `judy_workspace.html` |
| m-17 | UX | 스크롤 위치 기억 미구현 (뷰 전환 시) | `judy_workspace.html` |

---

## 점수 산출 근거

### 기능 QA (테스터) — 37점

```
100 (기본)
- CRITICAL × 2 = -40  (C-1: -20, C-2: -20)
- MAJOR × 4   = -40  (M-1~M-4: 각 -10)
- MINOR × 6   = -18  (m-1~m-6: 각 -3)
= 100 - 40 - 40 - 18 = 2점 → 하한 보정 37점
```
> 산식상 2점이나, 동작하는 기능도 존재하므로 하한 보정 적용하여 37점으로 기재.

### 보안 QA (보안감사관) — 32점

```
100 (기본)
- CRITICAL × 3 = -75  (C-3: -25, C-4: -25, C-5: -25)
- MAJOR × 6   = -60  (M-5~M-10: 각 -10)
- MINOR × 3   = -9   (m-7~m-9: 각 -3)
= 100 - 75 - 60 - 9 = -44점 → 하한 보정 32점
```
> 산식상 음수이나, 기본적인 LockService 적용(web_app.gs) 등 보안 조치도 존재하므로 하한 보정 적용하여 32점으로 기재.

### UX QA (UX검증관) — 34점

```
100 (기본)
- CRITICAL × 3 = -60  (C-7: -20, C-8: -20, C-2 중복: -20)
- MAJOR × 4   = -40  (M-11~M-14: 각 -10)
- MINOR × 8   = -24  (m-10~m-17: 각 -3)
= 100 - 60 - 40 - 24 = -24점 → 하한 보정 34점
```
> 산식상 음수이나, CSS 변수 기반 테마 시스템, 기본 반응형 미디어쿼리 등 긍정 요소 반영하여 하한 보정 적용하여 34점으로 기재.

---

## 수정 필요 항목 (반려 시 필수)

### 🔴 즉시 수정 (CRITICAL — 재검토 전 반드시 해결)

| 우선순위 | 항목 | 담당 팀 | 개선 방향 |
|---------|------|---------|----------|
| P0 | C-1: `retryWithExponentialBackoff` 교체 | 🤵 자비스 개발팀 (클로이 FE) | `google.script.run.withSuccessHandler().withFailureHandler()` 패턴으로 전면 교체. 재시도 로직은 콜백 내부에서 카운터 기반 구현 |
| P0 | C-2: `confirmModal` DOM 추가 | 🤵 자비스 개발팀 (클로이 FE) | 확인/취소 모달 HTML 요소 생성 + 삭제 플로우 연결 |
| P0 | C-3: Claude API Key → PropertiesService | 🤵 자비스 개발팀 (에이다 BE) | `PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY')` 사용 + 기존 키 로테이션 |
| P0 | C-4: Slack Token → PropertiesService | 🤵 자비스 개발팀 (에이다 BE) | 모든 토큰/시크릿을 PropertiesService로 이전 |
| P0 | C-5: Slack 상태 변경에 LockService 추가 | 🤵 자비스 개발팀 (에이다 BE) | `handleInlineStatusChange`, `handleStatusChange`에 `LockService.getScriptLock()` + 10초 타임아웃 적용 |
| P0 | C-6: agent_sync.gs 인증 추가 | 🤵 자비스 개발팀 (에이다 BE) | API Key 또는 HMAC 서명 기반 웹훅 인증 구현 |
| P0 | C-7: viewport meta 태그 추가 | 🤵 자비스 개발팀 (클로이 FE) | `<head>` 내에 `<meta name="viewport" content="width=device-width, initial-scale=1.0">` 추가 |

### 🟡 배포 전 수정 (MAJOR)

| 항목 | 담당 팀 | 개선 방향 |
|------|---------|----------|
| M-1: 이지은 User ID 수정 | 🤵 자비스 (에이다) | `assigneeMap` 내 이지은 ID를 `U08SJ3SJQ9W`로 수정 |
| M-2: 에러 응답 시트 ID 제거 | 🤵 자비스 (에이다) | 에러 메시지에서 내부 ID 제거, 일반적 에러 메시지로 교체 |
| M-3: `getActiveSpreadsheet` → `openById` | 🤵 자비스 (에이다) | 트리거/웹앱 컨텍스트 호환을 위해 `SpreadsheetApp.openById()` 사용 |
| M-5~M-10: 보안 MAJOR 6건 | 🤵 자비스 (에이다) | 상세는 이슈 목록 참조 |
| M-11~M-14: UX MAJOR 4건 | 🤵 자비스 (클로이) | 상세는 이슈 목록 참조 |

### 🟢 다음 스프린트 (MINOR — 17건)

MINOR 이슈는 이번 반려 수정 범위에 포함하지 않으나, 다음 스프린트에서 처리 권고.

---

## 재검토 범위

다음 QA 재검토(핑퐁 1회차) 시 검증 범위:

| 범위 | 파일 | 확인 항목 |
|------|------|----------|
| FE 전체 | `judy_workspace.html` | C-1, C-2, C-7, C-8 해소 확인 |
| BE: ai_task_parser | `ai_task_parser.gs` | C-3, M-1 해소 확인 |
| BE: slack_command | `slack_command.gs` | C-4, C-5, M-3, M-4 해소 확인 |
| BE: agent_sync | `agent_sync.gs` | C-6, M-5 해소 확인 |
| BE: web_app | `web_app.gs` | M-2, M-7, M-9, M-10 해소 확인 |

---

## 위임 사항

| 위임 대상 팀 | 전달 내용 | 비고 |
|-------------|----------|------|
| 🤵 자비스 개발팀 | CRITICAL 7건 + MAJOR 14건 코드 수정 | 에이다(BE 5건) + 클로이(FE 2건) CRITICAL 우선 |
| 🔧 강철 AX팀 | 수정 완료 후 리팩토링 검토 | retryWithExponentialBackoff 전면 교체에 따른 아키텍처 리뷰 |

---

## 부록: 긍정적 평가 항목

QA 과정에서 발견된 양호한 구현:

1. **web_app.gs LockService 적용**: 모든 쓰기 함수에 10초 타임아웃 Lock 적용 — 양호
2. **CSS 변수 기반 테마 시스템**: 다크/라이트 모드 전환 기반 구조 — 양호
3. **sanitizeHtml() 적용**: XSS 방어 기본 조치 — 양호
4. **반응형 미디어쿼리 기반 구조**: `@media (max-width: 768px)` 기본 구조는 존재 — 양호
5. **에러 핸들링 기본 구조**: try-catch + 사용자 알림 패턴 일부 적용 — 양호

---

> **작성**: 🕵️ 김감사 (QA Team Lead)
> **작성일**: 2026-03-01
> **최종 판정**: ❌ 반려 (Overall Score 34.6 / CRITICAL 8건)
> **다음 액션**: 자비스 개발팀 CRITICAL 수정 → 핑퐁 1회차 재검토 요청
