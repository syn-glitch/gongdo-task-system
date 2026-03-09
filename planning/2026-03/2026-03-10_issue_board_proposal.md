<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        2026-03-10_issue_board_proposal.md
 @version     v1.0.0
 @updated     2026-03-10 (KST)
 @agent       자비스 PO (자비스 개발팀)
 @ordered-by  용남 대표
 @description 이슈 게시판 기능 제안서 — 주디 워크스페이스 이슈 제보 → GitHub Issues 연동 전체 파이프라인 설계

 @change-summary
   AS-IS: 이슈 제보 채널 없음. 팀원이 에러 발견 시 구두/슬랙으로 비정형 전달
   TO-BE: 워크스페이스 내 이슈 게시판 → GitHub Issues 자동 등록 → 김감사 분석 → 해결 → 알림

 @features
   - [추가] 이슈 게시판 전체 파이프라인 설계 (3단계)
   - [추가] GitHub Issue body 메타데이터 템플릿
   - [추가] 1단계 작업 범위 및 산출물 정의

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-10 | 자비스 PO | 최초 작성
 ============================================
-->

# 이슈 게시판 기능 제안서 (Issue Board Proposal)

**상태**: 📝 제안 (김감사 QA 검토 대기)
**작성일**: 2026-03-10
**작성자**: 자비스 PO (자비스 개발팀)
**지시자**: 용남 대표

---

## 1. 배경 및 목적

현재 팀원이 주디 워크스페이스를 사용하면서 에러를 발견해도, 체계적으로 제보할 수 있는 채널이 없다. 구두나 슬랙 메시지로 비정형 전달되어 이슈가 누락되거나 추적이 불가능한 문제가 반복되고 있다.

**목적**: 워크스페이스 내에 이슈 게시판을 만들어, 팀원이 텍스트+이미지로 에러를 제보하면 GitHub Issues에 자동 등록되고, 이후 QA 분석 → 디버깅 → 해결 → 알림까지 이어지는 전체 파이프라인을 구축한다.

---

## 2. 전체 파이프라인 (3단계)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1단계 — 자비스팀 구현 🎯]

  팀원 (주디 워크스페이스)
    │
    ├─ 이슈 제보 폼 작성 (제목, 카테고리, 심각도, 설명, 스크린샷)
    │
    ▼
  GAS 백엔드 (github_issue.gs)
    │
    ├─ 이미지 → Google Drive 업로드 → 공유 URL 획득
    ├─ GitHub Issue 생성 (Issues API)
    │   ├─ title: 이슈 제목
    │   ├─ body: 구조화된 템플릿 (설명 + 이미지 + 환경정보 + 메타데이터)
    │   ├─ labels: ["bug", "from-workspace", 카테고리라벨]
    │   └─ 메타데이터 (HTML comment): reporter_slack_id, reporter_name
    │
    ▼
  GitHub Issue #N 생성 완료
    │
    └─ 워크스페이스 이슈 목록에 반영 (open/closed 탭)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [2단계 — 김감사 QA팀]

  GitHub Webhook / 폴링
    │
    ├─ 신규 Issue 감지 (label: "from-workspace")
    ├─ 이슈 내용 AI 분석 (재현 조건, 영향 범위, 긴급도 판단)
    ├─ QA 보고서 (md 파일) 생성
    └─ 슬랙 DM → 용남 대표에게 이슈 분석 보고서 전달

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [3단계 — 디버깅 & 해결 사이클 (벙커팀 설계)]

  용남 대표 검토 → 자비스팀 지시
    │
    ├─ 자비스팀 디버깅 & 수정
    ├─ 김감사 최종 QA 검수
    ├─ GitHub Issue close (해결 코멘트 포함)
    │
    ▼
  해결 알림
    ├─ 용남 대표 슬랙 보고
    └─ 제보 직원에게 슬랙 DM ("이슈 #N 해결되었습니다")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. GitHub Issue Body 템플릿

GitHub Issue 생성 시 아래 구조화된 템플릿을 사용한다. 2단계(김감사 자동 분석)에서 파싱 가능하도록 메타데이터를 HTML 코멘트로 삽입한다.

```markdown
## 🐛 이슈 제보

**카테고리**: 버그 / 기능오류 / UI깨짐 / 기타
**심각도**: 높음 / 보통 / 낮음
**발생 위치**: (어떤 탭/기능에서 발생했는지)

### 설명
(팀원이 작성한 이슈 설명)

### 스크린샷
![screenshot](Google Drive 이미지 공유 URL)

### 환경 정보
- 브라우저: (자동 수집)
- OS: (자동 수집)
- 화면 크기: (자동 수집)
- 발생 시각: (자동 기록)
- 워크스페이스 버전: (자동 삽입)

<!-- METADATA
reporter_slack_id: U12345678
reporter_name: 홍길동
workspace_version: v3.1.0
category: bug
severity: medium
location: kanban-board
submitted_at: 2026-03-10T14:30:00+09:00
-->
```

### 메타데이터 설계 의도

| 필드 | 용도 | 사용 단계 |
|------|------|----------|
| `reporter_slack_id` | 해결 시 DM 발송 대상 | 3단계 |
| `reporter_name` | 보고서 표시용 | 2단계 |
| `category` | 김감사 자동 분류 기준 | 2단계 |
| `severity` | 긴급도 판단 참고 | 2단계 |
| `location` | 발생 위치 자동 추적 | 2단계 |
| `workspace_version` | 버전별 이슈 추적 | 2~3단계 |
| `submitted_at` | 대응 시간 측정 | 3단계 |

---

## 4. 1단계 작업 범위 (자비스팀)

### 4.1 포함 범위

| # | 작업 항목 | 설명 |
|---|----------|------|
| 1 | 이슈 제보 폼 UI | 제목, 카테고리(드롭다운), 심각도(라디오), 설명(텍스트), 이미지 첨부(파일 선택) |
| 2 | 이미지 처리 | FileReader → Base64 → Google Drive 업로드 → 공유 URL 변환 |
| 3 | GitHub Issue 생성 | GitHub Issues API (POST) + 구조화된 body 템플릿 + labels 자동 부여 |
| 4 | 환경 정보 자동 수집 | navigator.userAgent 파싱, 화면크기, 현재 시각, 워크스페이스 버전 |
| 5 | 이슈 목록 조회 UI | GitHub Issues API (GET) → 게시판 형태 표시, open/closed 탭 분리 |
| 6 | 이슈 상세 보기 | 클릭 시 이슈 내용 + 상태 + 라벨 표시 (읽기 전용) |

### 4.2 제외 범위

| # | 제외 항목 | 사유 | 담당 |
|---|----------|------|------|
| 1 | GitHub Issue 자동 감지 + AI 분석 | 2단계 스코프 | 🕵️ 김감사 QA팀 |
| 2 | 슬랙 DM 보고서 발송 | 2단계 스코프 | 🕵️ 김감사 QA팀 |
| 3 | 해결 시 슬랙 DM 플로우 | 3단계 스코프 | 🏴 벙커팀 설계 |
| 4 | 이슈 수정/삭제/코멘트 | 2차 확장 | 자비스팀 (추후) |
| 5 | GitHub Labels 관리 UI | 2차 확장 | 자비스팀 (추후) |

---

## 5. 기술 설계

### 5.1 기존 시스템 활용

| 기존 자산 | 활용 방안 |
|----------|----------|
| `agent_sync.gs` GitHub API 패턴 | `GITHUB_TOKEN`, 헤더 구성, `UrlFetchApp` 패턴 재사용 |
| 세션 인증 (web_app.gs) | 이슈 작성자 = 현재 로그인 유저 자동 매핑 |
| `judy_workspace.html` 탭 구조 | 기존 탭에 "이슈" 탭 추가 |
| Google Drive API | 이미지 업로드 → 공유 URL 생성 |
| `PropertiesService` | `GITHUB_TOKEN` 이미 저장됨 |

### 5.2 신규 파일

| 파일 | 역할 |
|------|------|
| `src/gas/github_issue.gs` | GitHub Issues API CRUD 함수 |

### 5.3 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `src/frontend/judy_workspace.html` | 이슈 탭 UI + 제보 폼 + 이슈 목록 |
| `src/gas/judy_workspace.html` | 프론트엔드 동기화 (배포용) |

### 5.4 GitHub Issues API 사용 계획

```
POST /repos/syn-glitch/gongdo-task-system/issues     — 이슈 생성
GET  /repos/syn-glitch/gongdo-task-system/issues      — 이슈 목록 조회
GET  /repos/syn-glitch/gongdo-task-system/issues/:id  — 이슈 상세 조회
```

### 5.5 GitHub Labels 전략

| 라벨 | 색상 | 용도 |
|------|------|------|
| `from-workspace` | 🔵 파랑 | 워크스페이스 제보 이슈 식별 (김감사 자동 감지 트리거) |
| `bug` | 🔴 빨강 | 버그 카테고리 |
| `ui-broken` | 🟠 주황 | UI 깨짐 카테고리 |
| `feature-error` | 🟡 노랑 | 기능 오류 카테고리 |
| `etc` | ⚪ 회색 | 기타 카테고리 |
| `severity-high` | 🔴 빨강 | 심각도 높음 |
| `severity-medium` | 🟡 노랑 | 심각도 보통 |
| `severity-low` | 🟢 초록 | 심각도 낮음 |
| `qa-reviewed` | 🟣 보라 | 김감사 분석 완료 (2단계에서 사용) |
| `resolved` | 🟢 초록 | 해결 완료 (3단계에서 사용) |

---

## 6. 산출물

| 산출물 | 파일 경로 | 상태 |
|--------|----------|------|
| 이슈 백엔드 API | `src/gas/github_issue.gs` | ⬜ 미완 |
| 이슈 게시판 UI | `src/frontend/judy_workspace.html` | ⬜ 미완 |
| GAS 배포용 동기화 | `src/gas/judy_workspace.html` | ⬜ 미완 |
| task.md | `GD_Agent_teams/jarvis-dev/tasks/2026-03/task_issue_board.md` | ⬜ 미완 |

---

## 7. 팀 간 위임 사항

| 위임 대상 | 전달 내용 | 시점 | 상태 |
|----------|----------|------|------|
| 🕵️ 김감사 QA팀 | 1단계 제안서 QA 검토 | 현재 | 📝 대기 |
| 🕵️ 김감사 QA팀 | GitHub Issue 자동 감지 + AI 분석 + 슬랙 DM 보고서 (2단계) | 1단계 완료 후 | ⬜ 예정 |
| 🏴 벙커팀 | 해결 시 슬랙 DM 발송 플로우 설계 (3단계) | 1단계 완료 후 | 📝 설계 중 |

---

## 8. 리스크 및 고려사항

| 리스크 | 영향 | 대응 |
|--------|------|------|
| GitHub API 호출 제한 (시간당 5,000회) | 이슈 목록 조회 빈도 제한 | CacheService로 5분 캐싱 적용 |
| Google Drive 이미지 공유 링크 만료 | 스크린샷 접근 불가 | "뷰어 액세스" 권한으로 영구 공유 설정 |
| GAS 실행 시간 제한 (6분) | 대용량 이미지 업로드 실패 | 이미지 크기 제한 (5MB) + 리사이즈 |
| 메타데이터 파싱 오류 (2단계) | 김감사 자동 분석 실패 | HTML 코멘트 포맷 엄격 준수 + 검증 함수 |
