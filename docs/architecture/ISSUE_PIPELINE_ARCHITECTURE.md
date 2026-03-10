<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        ISSUE_PIPELINE_ARCHITECTURE.md
 @version     v1.0.0
 @updated     2026-03-10 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description 이슈 자동화 파이프라인 아키텍처 문서 — GitHub Actions + Claude API 기반 자동 QA/이해보고서 시스템

 @change-summary
   AS-IS: 해당 없음 (신규 문서)
   TO-BE: 이슈 자동화 파이프라인 아키텍처 및 설정 가이드

 @features
   - [추가] 시스템 아키텍처 다이어그램
   - [추가] 워크플로우 파일 구조 및 설정
   - [추가] Secrets 설정 가이드
   - [추가] 트러블슈팅 가이드

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-10 | 꼼꼼이 | 최초 작성
 ============================================
-->

# 이슈 자동화 파이프라인 — 아키텍처 문서

## 시스템 개요

GitHub Actions + Claude API를 활용한 3단계 이슈 자동 분석 파이프라인.
이슈 등록부터 QA 분석, 이해보고서 작성까지 자동화.

---

## 아키텍처 다이어그램

```
┌─────────────────────┐
│  주디 워크스페이스     │
│  (GAS Web App)       │
└──────────┬──────────┘
           │ submitIssueFromWeb() → GitHub Issues API
           ▼
┌─────────────────────┐
│  GitHub Issue 생성    │
│  라벨: from-workspace │
└──────────┬──────────┘
           │ trigger: issues [opened]
           ▼
┌──────────────────────────────────────────┐
│  GitHub Actions: kim-qa-issue-analysis    │
│                                          │
│  1. 중복 확인 (qa-reviewed 라벨)          │
│  2. analyzing 라벨 부착                   │
│  3. 일일 한도 체크 (20건/일)              │
│  4. Claude API 호출 (김감사 프롬프트)      │
│  5. QA 보고서 코멘트 등록                 │
│  6. 라벨 교체 (qa-reviewed / qa-failed)   │
│  7. 슬랙 DM (대표)                       │
│  8. 자비스 워크플로우 dispatch ◀── 체인    │
└──────────────────────┬───────────────────┘
                       │ workflow_dispatch (issue_number)
                       ▼
┌──────────────────────────────────────────┐
│  GitHub Actions: jarvis-issue-response    │
│                                          │
│  0. GitHub API로 이슈 데이터 조회          │
│  1. 리포 체크아웃                         │
│  2. 김감사 QA 코멘트 파싱                 │
│  3. Claude API 호출 (자비스 프롬프트)      │
│  4. md 파일 커밋 (reports/jarvis-response/)│
│  5. 이해보고서 코멘트 등록                 │
│  6. jarvis-reviewed 라벨 추가             │
│  7. 슬랙 DM (대표)                       │
└──────────────────────────────────────────┘
```

---

## 파일 구조

```
.github/
├── workflows/
│   ├── kim-qa-issue-analysis.yml    # 2단계: 김감사 QA 자동 분석
│   └── jarvis-issue-response.yml    # 3단계: 자비스 이해보고서
├── prompts/
│   ├── issue_triage_prompt.md       # 김감사 경량 시스템 프롬프트
│   └── jarvis_issue_response_prompt.md  # 자비스 경량 시스템 프롬프트
reports/
└── jarvis-response/                 # 자비스 이해보고서 md 파일 (자동 커밋)
```

---

## 워크플로우 상세

### 김감사 QA (`kim-qa-issue-analysis.yml`)

| 항목 | 값 |
|------|-----|
| 트리거 | `issues: [opened]` + `from-workspace` 라벨 필터 |
| 권한 | `issues: write`, `actions: write` |
| Claude 모델 | `claude-sonnet-4-5-20250929` |
| 일일 한도 | 20건/일 |
| 중복 방지 | `qa-reviewed` 라벨 존재 시 스킵 |

### 자비스 이해보고서 (`jarvis-issue-response.yml`)

| 항목 | 값 |
|------|-----|
| 트리거 | `workflow_dispatch` (김감사 워크플로우에서 자동 호출) |
| 입력 | `issue_number` (문자열) |
| 권한 | `issues: write`, `contents: write` |
| Claude 모델 | `claude-sonnet-4-5-20250929` |
| 중복 방지 | `jarvis-reviewed` 라벨 존재 시 스킵 |
| 산출물 | md 파일 자동 커밋 + GitHub 코멘트 |

### 워크플로우 체인 방식

김감사 → 자비스는 `workflow_dispatch` API로 연결됩니다.

GitHub의 보안 정책상 기본 `GITHUB_TOKEN`으로 발생한 이벤트(라벨 추가 등)는 다른 워크플로우를 트리거하지 않습니다. 이를 우회하기 위해 김감사 워크플로우가 성공 시 `actions.createWorkflowDispatch()`로 자비스 워크플로우를 직접 호출합니다.

이를 위해 김감사 워크플로우의 `permissions`에 `actions: write`가 필요합니다.

---

## 경량 프롬프트

에이전트 팀의 전체 DESIGN.md는 PUBLIC 리포에 올리기엔 방대하므로, 각 에이전트의 핵심 역할만 추출한 **경량 프롬프트**를 `.github/prompts/`에 저장합니다.

| 파일 | 역할 | 원본 |
|------|------|------|
| `issue_triage_prompt.md` | 김감사 QA 분석 | `kim-qa_DESIGN.md` |
| `jarvis_issue_response_prompt.md` | 자비스 이해보고서 | `jarvis-dev_DESIGN.md` |

---

## Secrets 설정

GitHub 리포지토리 Settings > Secrets and variables > Actions에 아래 값이 필요합니다.

| Secret 이름 | 용도 | 비고 |
|-------------|------|------|
| `ANTHROPIC_API_KEY` | Claude API 인증 | `sk-ant-api03-...` |
| `SLACK_TOKEN` | 슬랙 DM 발송 | `xoxb-...` (Bot Token) |

슬랙 수신자 ID는 워크플로우 내 하드코딩: `U02S3CN9E6R` (대표)

---

## 라벨 체계

| 라벨 | 의미 | 부착 시점 |
|------|------|----------|
| `from-workspace` | 워크스페이스에서 제보된 이슈 | GAS에서 이슈 생성 시 |
| `analyzing` | 김감사 QA 분석 중 | 김감사 워크플로우 시작 |
| `qa-reviewed` | 김감사 QA 분석 완료 | 김감사 워크플로우 성공 |
| `qa-failed` | 김감사 QA 분석 실패 | Claude API 에러 등 |
| `jarvis-reviewed` | 자비스 이해보고서 작성 완료 | 자비스 워크플로우 성공 |

---

## 트러블슈팅

### Claude API 분석 실패
- **`[분석 실패] API 에러 (404)`**: 모델 ID가 잘못됨. 현재 유효 모델: `claude-sonnet-4-5-20250929`
- **`[분석 실패] API 에러 (401)`**: `ANTHROPIC_API_KEY` Secret이 만료 또는 미설정

### 자비스 워크플로우 스킵됨
- 김감사 워크플로우의 `actions: write` 권한이 없으면 dispatch 호출이 403으로 실패
- GitHub Actions 탭에서 김감사 워크플로우 로그의 "Trigger Jarvis workflow" 스텝 확인

### 슬랙 DM 미발송
- `SLACK_TOKEN` Secret이 설정되었는지 확인
- Bot 토큰에 `chat:write` 스코프가 있는지 확인
- 수신자 Slack ID (`U02S3CN9E6R`)가 올바른지 확인

### 빈 코멘트 게시
- 김감사 QA 코멘트를 찾지 못한 경우 자비스 보고서가 생성되지 않으며, 코멘트도 게시되지 않음 (CI-02 수정 반영)

---

## 향후 확장 계획

| 단계 | 내용 | 상태 |
|------|------|------|
| 승인 버튼 | 대표가 슬랙/웹에서 수정 승인 | 미구현 |
| 자비스 코드 수정 | 승인 후 자동 코드 수정 | 미구현 |
| 김감사 재QA | 수정 완료 → 자동 재검수 | 미구현 |
| Issue Close 알림 | 해결 시 제보자에게 슬랙 DM | 미구현 |
