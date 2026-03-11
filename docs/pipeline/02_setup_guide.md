<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        02_setup_guide.md
 @version     v1.0.0
 @updated     2026-03-11 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description 파이프라인 각 단계에 필요한 모든 설정 가이드

 @change-summary
   AS-IS: 문서 없음
   TO-BE: GitHub Secrets, GAS, Slack, Anthropic 등 전체 설정 가이드

 @features
   - [추가] GitHub Secrets 설정
   - [추가] GitHub 리포 설정
   - [추가] GAS Script Properties
   - [추가] Slack App 설정
   - [추가] Anthropic API 설정
   - [추가] 워크플로우별 권한 매트릭스

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-11 | 꼼꼼이 | 최초 작성
 ============================================
-->

# 파이프라인 설정 가이드 (Setup Guide)

---
- **문서 버전**: v1.0.0
- **작성일**: 2026-03-11
- **작성자**: 꼼꼼이 (문서팀)
- **대상 독자**: 개발자 (민석님), 대표님
- **상태**: approved
---

## 1. 설정 체크리스트 (한눈에 보기)

```
[ ] 1. GitHub Secrets 3개 등록
[ ] 2. GitHub 리포 Actions 권한 설정
[ ] 3. GAS Script Properties 1개 등록
[ ] 4. Slack App 설정 (Bot Token, 인터랙티브 URL)
[ ] 5. Anthropic API 계정 + 크레딧 충전
[ ] 6. 하드코딩 값 확인 (CEO Slack ID 등)
```

---

## 2. GitHub Secrets 설정

**경로**: GitHub 리포 → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | 값 | 용도 |
|------------|-----|------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Claude API 호출 인증 |
| `SLACK_TOKEN` | `xoxb-...` | Slack Bot Token (메시지 발송) |
| `GITHUB_TOKEN` | (자동 제공) | GitHub Actions 내장 토큰 — 별도 등록 불필요 |

### ANTHROPIC_API_KEY 발급 방법
1. https://console.anthropic.com 접속
2. Settings → API Keys → Create Key
3. 키 복사 → GitHub Secret에 등록

### SLACK_TOKEN 발급 방법
1. https://api.slack.com/apps 접속
2. 해당 Slack App 선택
3. OAuth & Permissions → Bot User OAuth Token 복사
4. GitHub Secret에 등록

---

## 3. GitHub 리포 설정

### 3.1 Actions 권한

**경로**: Settings → Actions → General → Workflow permissions

```
✅ Read and write permissions (필수)
✅ Allow GitHub Actions to create and approve pull requests (필수)
```

### 3.2 워크플로우별 필요 권한

각 워크플로우 YAML 파일에 `permissions:` 블록이 명시되어 있습니다.
GitHub의 Workflow permissions가 "Read and write"여야 아래 권한이 작동합니다.

| 워크플로우 | permissions |
|----------|------------|
| kim-qa-issue-analysis | `issues: write`, `actions: write` |
| jarvis-issue-response | `issues: write`, `contents: write` |
| jarvis-auto-fix | `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`, `actions: write` |
| kim-qa-pr-review | `issues: write`, `pull-requests: write`, `contents: read` |

> **중요**: `permissions:` 블록을 명시하면 **나열된 권한만** 부여됩니다.
> 예: `actions: write`가 없으면 다른 워크플로우를 트리거할 수 없습니다.

### 3.3 브랜치 보호 규칙

현재 `main` 브랜치에 보호 규칙 없음 (자동 머지를 위해).
필요 시 추가 가능하나, 자동 PR 머지가 차단될 수 있으므로 주의.

---

## 4. GAS Script Properties 설정

**경로**: Apps Script 에디터 → 프로젝트 설정 → 스크립트 속성

| Property Name | 값 | 용도 |
|--------------|-----|------|
| `GITHUB_TOKEN` | `ghp_...` 또는 Fine-grained PAT | GAS에서 GitHub API 호출 (팀 배정, PR 머지) |

### GitHub Personal Access Token 발급

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Repository access: `syn-glitch/gongdo-task-system` 선택
3. 필요 권한:
   - **Issues**: Read and Write
   - **Pull requests**: Read and Write
   - **Contents**: Read and Write
   - **Actions**: Read and Write (워크플로우 트리거용)
4. Generate token → GAS Script Properties에 등록

> **주의**: Fine-grained token은 만료일이 있습니다. 만료 시 갱신 필요.

---

## 5. Slack App 설정

### 5.1 필요 권한 (Bot Token Scopes)

| Scope | 용도 |
|-------|------|
| `chat:write` | CEO에게 DM 발송 |
| `im:write` | DM 채널 열기 |

### 5.2 인터랙티브 컴포넌트

**경로**: Slack App → Interactivity & Shortcuts → Interactivity: ON

**Request URL**: GAS 웹 앱 배포 URL
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

> 이 URL로 버튼 클릭 이벤트가 GAS `doPost()`로 전달됩니다.

### 5.3 슬래시 커맨드 (해당 시)

이슈 제보 등 슬래시 커맨드를 사용하는 경우에도 같은 Request URL 사용.

---

## 6. Anthropic API 설정

### 6.1 계정 및 크레딧

- https://console.anthropic.com → Plans & Billing
- 크레딧 충전 필수 (잔액 부족 시 API 400 에러 발생)
- **사용 모델**: `claude-sonnet-4-5-20250929`

### 6.2 요금

| 항목 | 가격 |
|------|------|
| Input tokens | $3 / 1M tokens |
| Output tokens | $15 / 1M tokens |

### 6.3 예상 비용 (이슈 1건 풀사이클)

| 단계 | 예상 비용 |
|------|----------|
| 1단계: 김감사 QA 분석 | ~$0.01~0.03 |
| 2단계: 자비스 이해보고서 | ~$0.01~0.03 |
| 3단계: 자비스 코드 수정 (Code Action) | ~$0.50~1.00 |
| 4단계: 김감사 PR 리뷰 | ~$0.01~0.03 |
| **합계** | **~$0.53~1.09 / 이슈** |

---

## 7. 하드코딩 값 목록

코드 내에 직접 기재된 값들입니다. 환경이 바뀌면 수정이 필요합니다.

| 값 | 위치 | 현재 값 |
|----|------|---------|
| Slack CEO ID | 4개 워크플로우 YAML + `slack_command.gs` | `U02S3CN9E6R` |
| GitHub 리포 | `slack_command.gs` | `syn-glitch/gongdo-task-system` |
| Claude 모델 | 4개 워크플로우 YAML | `claude-sonnet-4-5-20250929` |
| KRW 환율 | 4개 워크플로우 YAML | `1400` (USD→KRW) |
| 일일 실행 제한 | `kim-qa-issue-analysis.yml` | `20` 회/일 |
| PR diff 최대 길이 | `kim-qa-pr-review.yml` | `15000` 자 |
| Code Action 최대 턴 | `jarvis-auto-fix.yml` | `25` 턴 |

### 하드코딩 값 변경 시

- **Slack CEO ID 변경**: 4개 YAML 파일 + `slack_command.gs` 모두 수정 필요
- **리포 이전**: `slack_command.gs`의 owner/repo 변수 수정
- **모델 업그레이드**: 4개 YAML의 `model` 필드 수정

---

## 8. 파일별 설정 의존성

```
kim-qa-issue-analysis.yml
├── ANTHROPIC_API_KEY (Secret)
├── SLACK_TOKEN (Secret)
├── SLACK_CEO_ID (하드코딩)
├── .github/prompts/issue_triage_prompt.md (프롬프트)
└── actions: write (워크플로우 트리거 권한)

jarvis-issue-response.yml
├── ANTHROPIC_API_KEY (Secret)
├── SLACK_TOKEN (Secret)
├── SLACK_CEO_ID (하드코딩)
└── .github/prompts/jarvis_issue_response_prompt.md (프롬프트)

jarvis-auto-fix.yml
├── ANTHROPIC_API_KEY (Secret)
├── SLACK_TOKEN (Secret)
├── SLACK_CEO_ID (하드코딩)
├── GITHUB_TOKEN (내장 — git push, PR 생성용)
└── actions: write (김감사 리뷰 트리거 권한)

kim-qa-pr-review.yml
├── ANTHROPIC_API_KEY (Secret)
├── SLACK_TOKEN (Secret)
├── SLACK_CEO_ID (하드코딩)
└── .github/prompts/pr_review_prompt.md (프롬프트)

slack_command.gs
├── GITHUB_TOKEN (GAS Script Property)
├── SLACK_CEO_ID (하드코딩)
└── GitHub 리포 경로 (하드코딩)
```

---

## 9. 설정 검증 방법

### 테스트 순서

1. **GitHub Secrets 확인**: Settings → Secrets에 3개 키 존재 확인
2. **수동 트리거 테스트**: Actions → `kim-qa-issue-analysis` → Run workflow
3. **슬랙 수신 확인**: CEO DM으로 분석 보고서 도착 확인
4. **버튼 클릭 테스트**: 팀 배정 버튼 → GAS 로그 확인
5. **풀 파이프라인**: 이슈 생성 → 배포 승인까지 전체 순환

### 문제 발생 시 확인 순서

1. GitHub Actions 로그 확인 (Actions 탭 → 해당 워크플로우 → 로그)
2. `ANTHROPIC_API_KEY` 유효성 (크레딧 잔액 확인)
3. `SLACK_TOKEN` 유효성 (Slack App → OAuth)
4. GAS 실행 로그 (Apps Script → Executions)
