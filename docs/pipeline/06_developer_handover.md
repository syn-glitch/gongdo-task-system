<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        06_developer_handover.md
 @version     v1.0.0
 @updated     2026-03-11 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description 개발자 민석님 인수인계 가이드

 @change-summary
   AS-IS: 문서 없음
   TO-BE: 프로젝트 구조, 핵심 코드, 트러블슈팅, 확장 가이드 문서화

 @features
   - [추가] 프로젝트 디렉토리 구조
   - [추가] 핵심 파일 및 함수 설명
   - [추가] 코드 수정 시 주의사항
   - [추가] 트러블슈팅 가이드
   - [추가] 확장 포인트

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-11 | 꼼꼼이 | 최초 작성
 ============================================
-->

# 개발자 인수인계 가이드 (민석님용)

---
- **문서 버전**: v1.0.0
- **작성일**: 2026-03-11
- **작성자**: 꼼꼼이 (문서팀)
- **대상 독자**: 개발자 민석님
- **상태**: approved
---

## 1. 프로젝트 개요

**공도 업무 관리** — Google Apps Script(GAS) 기반 웹 앱 + GitHub Actions AI 자동화 파이프라인

- **리포**: https://github.com/syn-glitch/gongdo-task-system (Public)
- **GAS 프로젝트**: Google Sheets 연동 웹 앱
- **기본 브랜치**: `main`

---

## 2. 프로젝트 디렉토리 구조

```
공도 업무 관리/
├── .github/
│   ├── workflows/                    # GitHub Actions 워크플로우
│   │   ├── kim-qa-issue-analysis.yml   # 1단계: 김감사 QA 자동 분석
│   │   ├── jarvis-issue-response.yml   # 2단계: 자비스 이해보고서
│   │   ├── jarvis-auto-fix.yml         # 3단계: 자비스 코드 수정 (Claude Code Action)
│   │   ├── kim-qa-pr-review.yml        # 4단계: 김감사 PR 리뷰
│   │   └── test-claude-code-action.yml # 테스트용 (비활성)
│   └── prompts/                      # AI 프롬프트 파일
│       ├── issue_triage_prompt.md      # 김감사 이슈 분석 프롬프트
│       ├── jarvis_issue_response_prompt.md  # 자비스 이해보고서 프롬프트
│       ├── jarvis_auto_fix_prompt.md   # 자비스 코드 수정 CI 전용 프롬프트
│       └── pr_review_prompt.md         # 김감사 PR 리뷰 프롬프트
│
├── src/
│   ├── gas/                          # GAS 프로젝트 루트 (clasp rootDir)
│   │   ├── .clasp.json                # clasp 설정 (scriptId)
│   │   ├── appsscript.json            # GAS 매니페스트
│   │   ├── slack_command.gs           # ★ 핵심: Slack 이벤트 + GitHub 연동
│   │   ├── web_app.gs                 # 웹 앱 프론트엔드 + 시트 관리
│   │   ├── github_issue.gs            # GitHub 이슈 API
│   │   ├── github_to_sheet_webhook.gs # GitHub 웹훅 수신
│   │   ├── ai_chat.gs                 # Claude AI 채팅
│   │   ├── ai_task_parser.gs          # AI 태스크 파싱
│   │   ├── ai_report.gs              # AI 리포트
│   │   ├── ai_briefing.gs            # AI 브리핑
│   │   ├── ai_token_logger.gs        # 토큰 로깅
│   │   ├── agent_sync.gs             # 에이전트 동기화
│   │   ├── slack_notification.gs     # 슬랙 알림
│   │   ├── drive_archive.gs          # 드라이브 아카이빙
│   │   ├── expense_planner.gs        # 경비 계획
│   │   ├── calendar_sync.gs          # 캘린더 동기화
│   │   ├── auto_automation.gs        # 자동화 트리거
│   │   ├── auto_dashboard.gs         # 대시보드
│   │   ├── markdown_notes.gs         # 마크다운 노트
│   │   ├── setup_structure.gs        # 초기 세팅
│   │   └── judy_workspace.html       # ★ 프론트엔드 (frontend에서 복사)
│   │
│   ├── frontend/                     # 프론트엔드 소스
│   │   ├── judy_workspace.html        # ★ 메인 워크스페이스 UI
│   │   ├── task_dashboard.html
│   │   ├── agenticflow_dashboard.html
│   │   ├── judy_note.html
│   │   ├── deployed_script.html
│   │   └── webhook_tester.html
│   │
│   └── infra/
│       └── slack_proxy.py            # 슬랙 프록시 (로컬 테스트용)
│
├── docs/                             # 문서
│   └── pipeline/                     # 파이프라인 문서 (이 문서)
│
├── reports/                          # 자동 생성 보고서
│   └── jarvis-response/              # 자비스 이해보고서 (워크플로우가 자동 커밋)
│
├── CLAUDE.md                         # Claude Code 설정 파일
└── GD_Agent_teams/                   # AI 에이전트 팀 설계서 (서브모듈)
```

---

## 3. 핵심 파일 상세

### 3.1 slack_command.gs (1,403줄) — 가장 중요한 파일

이 파일이 파이프라인의 **GAS 측 허브**입니다. 모든 Slack 인터랙션을 처리합니다.

#### 핵심 함수

| 함수 | 줄 번호 (대략) | 역할 |
|------|------------|------|
| `doPost(e)` | 상단 | 진입점. Slack 이벤트/버튼 클릭/웹훅을 라우팅 |
| `handleIssueTeamAssignment(action, payload)` | ~1144 | 팀 배정 버튼 처리. 자비스 선택 시 코드 수정 워크플로우 트리거 |
| `handleDeployDecision(action, payload)` | ~1250 | 배포 승인/보류 버튼 처리. PR 머지 + 이슈 종료 |
| `triggerJarvisAutoFix_(token, owner, repo, issueNumber)` | ~1347 | GitHub Actions `jarvis-auto-fix.yml` 워크플로우 디스패치 |
| `ensureGitHubLabel_(token, owner, repo, name, color, desc)` | ~1365 | GitHub 라벨 존재 확인/생성 |

#### doPost 라우팅 로직

```javascript
doPost(e)
  ├── Slack slash command → 처리
  ├── Slack interactive (button click)
  │     ├── action_id: "assign_team_jarvis" → handleIssueTeamAssignment()
  │     ├── action_id: "assign_team_gangcheol" → handleIssueTeamAssignment()
  │     ├── action_id: "deploy_approve_" → handleDeployDecision()
  │     └── action_id: "deploy_hold_" → handleDeployDecision()
  └── 기타 POST → handleWebhookPost() (github_issue.gs)
```

#### handleDeployDecision 상세

```javascript
// 보안: CEO만 실행 가능
if (slackPayload.user.id !== "U02S3CN9E6R") {
  return "권한이 없습니다";
}

// value 형식: "이슈번호|PR번호"
const [issueNumber, prNumber] = action.value.split("|");

if (action.action_id === "deploy_approve_") {
  // 1. PR squash merge
  // 2. 이슈 close (state: "closed")
  // 3. 코멘트: "배포 완료"
}

if (action.action_id === "deploy_hold_") {
  // 1. 이슈에 "보류" 코멘트
}
```

---

### 3.2 GitHub Actions 워크플로우

#### 워크플로우 간 연결

```
kim-qa-issue-analysis.yml
  └─(자동 트리거)─→ jarvis-issue-response.yml

GAS: triggerJarvisAutoFix_()
  └─(API dispatch)─→ jarvis-auto-fix.yml
                       └─(자동 트리거)─→ kim-qa-pr-review.yml
```

#### 자동 트리거 코드 패턴

```javascript
// GitHub Script에서 다른 워크플로우 트리거
await github.rest.actions.createWorkflowDispatch({
  owner: context.repo.owner,
  repo: context.repo.repo,
  workflow_id: 'jarvis-auto-fix.yml',
  ref: 'main',
  inputs: {
    issue_number: '19'
  }
});
```

> **필수 권한**: `actions: write` — 없으면 `Resource not accessible by integration` 에러

---

### 3.3 프롬프트 파일

| 파일 | 역할 | 핵심 포인트 |
|------|------|-----------|
| `issue_triage_prompt.md` | 김감사 QA 분석 | 3축 분석 (기능40%+보안30%+UX30%), 담당팀 추천 |
| `jarvis_issue_response_prompt.md` | 자비스 이해보고서 | 원인 추정, 수정 계획 |
| `jarvis_auto_fix_prompt.md` | 자비스 CI 코드 수정 | src/ 전용, 보안 규칙, frontend/gas 동기화 |
| `pr_review_prompt.md` | 김감사 PR 리뷰 | 코드품질40%+보안30%+완성도30%, 판정 기준 |

---

## 4. 코드 수정 시 주의사항

### 4.1 frontend/gas 동기화

`src/frontend/judy_workspace.html` 수정 시 반드시:
```bash
cp src/frontend/judy_workspace.html src/gas/judy_workspace.html
```

GAS는 `src/gas/` 폴더만 업로드하므로, frontend만 수정하면 반영 안 됩니다.

### 4.2 수정 금지 파일 (보안 게이트)

자동 코드 수정(Claude Code Action)에서 아래 파일 수정이 감지되면 자동 롤백됩니다:

```
.github/*          ← 워크플로우, 프롬프트
.clasp.json        ← GAS 프로젝트 ID
appsscript.json    ← GAS 매니페스트
```

수동 수정은 가능하지만, 자동화 파이프라인에서는 차단됩니다.

### 4.3 하드코딩 값 변경 시

`SLACK_CEO_ID`를 변경해야 하는 경우 **5곳** 수정:

```
.github/workflows/kim-qa-issue-analysis.yml
.github/workflows/jarvis-issue-response.yml
.github/workflows/jarvis-auto-fix.yml
.github/workflows/kim-qa-pr-review.yml
src/gas/slack_command.gs
```

### 4.4 CLAUDE.md

프로젝트 루트의 `CLAUDE.md`는 Claude Code Action이 참조하는 설정 파일입니다.
CI 환경에서는 프롬프트에 전달된 지침이 CLAUDE.md보다 우선합니다.

---

## 5. 개발 환경 세팅

### 필수 도구

```bash
# Node.js (clasp 실행용)
node -v  # v18 이상 권장

# clasp (GAS CLI)
npm install -g @google/clasp

# clasp 로그인
clasp login
```

### 프로젝트 클론 & 설정

```bash
# 리포 클론
git clone https://github.com/syn-glitch/gongdo-task-system.git
cd gongdo-task-system

# GAS 프로젝트 연결 확인
cat src/gas/.clasp.json
# {"scriptId":"...","rootDir":"."}
```

### 코드 수정 → 배포 흐름

```bash
# 1. 코드 수정
vi src/gas/slack_command.gs

# 2. frontend 수정 시 gas에도 복사
cp src/frontend/judy_workspace.html src/gas/judy_workspace.html

# 3. GAS에 코드 업로드
cd src/gas
clasp push

# 4. (필요 시) 배포 업데이트
clasp deployments              # 배포 ID 확인
clasp deploy -i {ID} -d "설명"  # 배포 업데이트

# 5. git 커밋 & 푸시
cd ../..
git add -A
git commit -m "fix: 설명"
git push
```

---

## 6. 트러블슈팅

### 6.1 "Your credit balance is too low" (HTTP 400)

**원인**: Anthropic API 크레딧 소진
**확인**: https://console.anthropic.com → Plans & Billing
**해결**: 크레딧 추가 구매

### 6.2 "Resource not accessible by integration" (워크플로우 트리거 실패)

**원인**: 워크플로우 YAML에 `actions: write` 권한 누락
**확인**: 해당 워크플로우의 `permissions:` 블록
**해결**: `actions: write` 추가

```yaml
permissions:
  contents: write
  issues: write
  actions: write  # ← 이것이 없으면 다른 워크플로우 트리거 불가
```

### 6.3 git push 실패 (GitHub Actions 내)

**원인**: GITHUB_TOKEN으로 push 시 인증 문제
**해결**: 워크플로우에서 remote URL 재설정

```yaml
- run: |
    git remote set-url origin "https://x-access-token:${{ github.token }}@github.com/${{ github.repository }}.git"
    git push origin branch-name
```

### 6.4 GAS 200버전 에러

**원인**: `clasp deploy` 반복으로 200개 버전 초과
**해결**: Apps Script 에디터 → 프로젝트 설정 → 구버전 수동 삭제
**자세한 내용**: [04_gas_deployment_notes.md](./04_gas_deployment_notes.md)

### 6.5 Slack 버튼 클릭 시 무반응

**원인 1**: Slack App Interactivity URL이 GAS 배포 URL과 불일치
**확인**: Slack App → Interactivity → Request URL
**해결**: 최신 GAS 배포 URL로 업데이트

**원인 2**: GAS 실행 에러
**확인**: Apps Script → Executions (실행 로그)

### 6.6 PR 머지 실패 (handleDeployDecision)

**원인**: merge conflict 또는 브랜치 삭제됨
**확인**: GitHub에서 해당 PR 상태 확인
**해결**: 수동으로 conflict 해결 후 머지, 또는 새 PR 생성

---

## 7. 확장 가이드

### 7.1 새 워크플로우 추가

1. `.github/workflows/new-workflow.yml` 생성
2. 트리거 설정 (`workflow_dispatch` 또는 이벤트)
3. `permissions:` 블록에 필요 권한 명시
4. 필요 시 `.github/prompts/new_prompt.md` 생성
5. 슬랙 보고가 필요하면 토큰 추적 코드 포함

### 7.2 새 Slack 버튼 추가

1. 워크플로우의 Slack Block Kit에 버튼 추가:
```python
{
    "type": "button",
    "text": {"type": "plain_text", "text": "버튼 텍스트"},
    "action_id": "new_action_id",
    "value": f"{issue_number}"
}
```

2. `slack_command.gs`의 `doPost()`에 라우팅 추가:
```javascript
if (action.action_id === "new_action_id") {
    return handleNewAction(action, payload);
}
```

3. 핸들러 함수 구현

### 7.3 AI 모델 변경

모든 워크플로우의 `model` 필드 수정:
```python
payload = json.dumps({
    "model": "claude-sonnet-4-5-20250929",  # ← 여기 변경
    ...
})
```

Claude Code Action은 `anthropic_api_key`만 전달하면 자동으로 최신 모델 사용.

### 7.4 강철 AX팀 자동화 추가

현재 강철팀은 수동 처리입니다. 자동화하려면:
1. `gangcheol-auto-fix.yml` 워크플로우 생성
2. `handleIssueTeamAssignment()`에서 강철 선택 시 트리거 추가
3. 강철 전용 프롬프트 작성 (리팩토링/성능 개선 초점)

---

## 8. 파일 변경 영향 범위 맵

```
slack_command.gs 수정 시:
├── clasp push 필요
├── Slack 인터랙션 전체에 영향
└── 배포 업데이트 필요할 수 있음

워크플로우 YAML 수정 시:
├── git push만으로 즉시 반영
└── GAS/clasp 작업 불필요

프롬프트 .md 수정 시:
├── git push만으로 즉시 반영
├── AI 분석 결과 품질에 영향
└── 테스트 후 반영 권장

judy_workspace.html 수정 시:
├── src/frontend/ + src/gas/ 양쪽 수정 필수
├── clasp push 필요
└── 배포 업데이트 필요
```

---

## 9. 연락처 및 참고

- **Anthropic Console**: https://console.anthropic.com
- **Slack App 관리**: https://api.slack.com/apps
- **GitHub Actions 로그**: https://github.com/syn-glitch/gongdo-task-system/actions
- **GAS 에디터**: https://script.google.com
- **파이프라인 아키텍처**: [01_pipeline_architecture.md](./01_pipeline_architecture.md)
- **설정 가이드**: [02_setup_guide.md](./02_setup_guide.md)
