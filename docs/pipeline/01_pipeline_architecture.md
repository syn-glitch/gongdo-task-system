<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        01_pipeline_architecture.md
 @version     v1.0.0
 @updated     2026-03-11 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description 공도 업무 관리 시스템 AI 자동화 파이프라인 전체 아키텍처 문서

 @change-summary
   AS-IS: 문서 없음
   TO-BE: 파이프라인 전체 흐름, 워크플로우 연결 관계, 데이터 흐름 문서화

 @features
   - [추가] 전체 파이프라인 흐름도
   - [추가] 각 단계별 워크플로우 매핑
   - [추가] 시스템 구성 요소 설명

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-11 | 꼼꼼이 | 최초 작성
 ============================================
-->

# 공도 업무 관리 — AI 자동화 파이프라인 아키텍처

---
- **문서 버전**: v1.0.0
- **작성일**: 2026-03-11
- **작성자**: 꼼꼼이 (문서팀)
- **대상 독자**: 대표님, 개발자 (민석님)
- **상태**: approved
---

## 1. 시스템 개요

공도 업무 관리 시스템은 **이슈 제보 → AI 분석 → AI 코드 수정 → AI 리뷰 → 배포 승인**까지 전 과정을 자동화하는 파이프라인입니다.

### 사용 기술 스택

| 구성 요소 | 기술 | 역할 |
|----------|------|------|
| 웹 앱 | Google Apps Script (GAS) | 프론트엔드 + 백엔드 |
| 이슈 관리 | GitHub Issues | 버그/기능 요청 추적 |
| 자동화 | GitHub Actions | 워크플로우 실행 엔진 |
| AI 분석 | Claude API (Sonnet) | 이슈 분석, 보고서, 코드 리뷰 |
| AI 코딩 | Claude Code Action | 자동 코드 수정 |
| 메신저 | Slack (Block Kit) | 알림, 버튼 인터랙션 |
| 데이터 | Google Sheets | 업무 데이터 저장 |

### GitHub 리포지토리

- **리포**: `syn-glitch/gongdo-task-system` (Public)
- **기본 브랜치**: `main`

---

## 2. 전체 파이프라인 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                    공도 업무 관리 자동화 파이프라인                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 사용자                                                       │
│   │  워크스페이스에서 이슈 제보 버튼 클릭                             │
│   ▼                                                             │
│  ┌──────────────────────┐                                       │
│  │ 1단계: 김감사 QA 분석  │  kim-qa-issue-analysis.yml            │
│  │ (자동 트리거)          │  Claude Sonnet API                    │
│  └──────────┬───────────┘                                       │
│             │ ✅ 분석 완료 → 자동 트리거                             │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 2단계: 자비스 이해보고서 │  jarvis-issue-response.yml           │
│  │ (자동 트리거)          │  Claude Sonnet API                    │
│  └──────────┬───────────┘                                       │
│             │ ✅ 보고서 작성 → 슬랙 DM                              │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 슬랙: 팀 배정 버튼     │  CEO가 자비스/강철 선택                  │
│  │ 🤵 자비스 │ 🔧 강철    │                                       │
│  └──────────┬───────────┘                                       │
│             │ 🤵 자비스 선택 시                                     │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 3단계: 자비스 코드 수정  │  jarvis-auto-fix.yml                 │
│  │ (GAS → GitHub API)   │  Claude Code Action (멀티턴)           │
│  └──────────┬───────────┘                                       │
│             │ ✅ PR 생성 → 자동 트리거                               │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 4단계: 김감사 PR 리뷰   │  kim-qa-pr-review.yml                │
│  │ (자동 트리거)          │  Claude Sonnet API                    │
│  └──────────┬───────────┘                                       │
│             │ ✅/⚠️ 승인 → 슬랙 DM                                 │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ 슬랙: 배포 승인 버튼    │  CEO가 승인/보류 선택                   │
│  │ 🚀 승인 │ ⏸️ 보류     │                                       │
│  └──────────┬───────────┘                                       │
│             │ 🚀 승인 시                                           │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │ PR 머지 + 이슈 종료    │  GAS → GitHub API                    │
│  │ (자동 실행)            │  squash merge                        │
│  └──────────────────────┘                                       │
│                                                                 │
│  ⚠️ clasp push (GAS 배포)는 수동으로 별도 진행                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 각 단계 상세

### 3.1 — 1단계: 김감사 QA 자동 분석

| 항목 | 내용 |
|------|------|
| **워크플로우** | `.github/workflows/kim-qa-issue-analysis.yml` |
| **트리거** | GitHub Issue 생성 시 자동 (`from-workspace` 라벨 필수) |
| **AI 모델** | Claude Sonnet (`claude-sonnet-4-5-20250929`) |
| **프롬프트** | `.github/prompts/issue_triage_prompt.md` |
| **AI 역할** | 김감사 QA팀장 |
| **출력** | QA 분석 보고서 (기능 40% + 보안 30% + UX 30% 점수) |

**수행 작업**:
1. 이슈 중복 분석 방지 (`qa-reviewed` 라벨 체크)
2. 일일 실행 제한 (20회/일)
3. Claude API로 이슈 분석
4. GitHub 이슈에 QA 보고서 코멘트
5. 슬랙 DM (팀 배정 버튼 + 토큰 비용)
6. 자비스 이해보고서 워크플로우 자동 트리거

**라벨 관리**:
- 시작 시: `analyzing` 추가
- 성공 시: `qa-reviewed` 추가, `analyzing` 제거
- 실패 시: `qa-failed` 추가, `analyzing` 제거

---

### 3.2 — 2단계: 자비스 이해보고서 자동 작성

| 항목 | 내용 |
|------|------|
| **워크플로우** | `.github/workflows/jarvis-issue-response.yml` |
| **트리거** | `workflow_dispatch` (1단계에서 자동 호출) |
| **AI 모델** | Claude Sonnet |
| **프롬프트** | `.github/prompts/jarvis_issue_response_prompt.md` |
| **AI 역할** | 자비스 개발팀 PO |
| **출력** | 이해보고서 (원인 추정 + 수정 계획) |

**수행 작업**:
1. 이슈 + 김감사 QA 코멘트 수집
2. Claude API로 이해보고서 작성
3. `reports/jarvis-response/` 폴더에 .md 파일 커밋
4. GitHub 이슈에 이해보고서 코멘트
5. `jarvis-reviewed` 라벨 추가
6. 슬랙 DM (토큰 비용 포함)

---

### 3.3 — 슬랙 팀 배정 (GAS 처리)

| 항목 | 내용 |
|------|------|
| **처리 코드** | `src/gas/slack_command.gs` → `handleIssueTeamAssignment()` |
| **트리거** | CEO가 슬랙 버튼 클릭 (`assign_team_jarvis` / `assign_team_gangcheol`) |

**자비스 선택 시**:
1. GitHub 이슈에 `assigned:jarvis` 라벨 추가
2. `triggerJarvisAutoFix_()` 호출 → `jarvis-auto-fix.yml` 트리거
3. 슬랙 응답: "자동 코드 수정을 시작합니다"

**강철 선택 시**:
1. GitHub 이슈에 `assigned:gangcheol` 라벨 추가
2. 슬랙 응답: 수동 처리 안내

---

### 3.4 — 3단계: 자비스 자동 코드 수정

| 항목 | 내용 |
|------|------|
| **워크플로우** | `.github/workflows/jarvis-auto-fix.yml` |
| **트리거** | `workflow_dispatch` (GAS에서 GitHub API로 호출) |
| **AI 도구** | Claude Code Action (`anthropics/claude-code-action@v1`) |
| **최대 턴** | 25턴 (멀티턴 대화) |
| **허용 도구** | Edit, Read, Write, Glob, Grep, Bash |

**수행 작업**:
1. 이슈 + QA 보고서 + 이해보고서 수집
2. 컨텍스트 파일 준비 (`/tmp/fix_context.txt`)
3. Claude Code Action으로 코드 수정
4. 보안 게이트 (`.github/`, `.clasp.json`, `appsscript.json` 수정 차단)
5. `fix/issue-{번호}` 브랜치 생성 + PR 생성
6. `fix-pr-created` 라벨 추가
7. 슬랙 보고
8. 김감사 PR 리뷰 워크플로우 자동 트리거

**수정 규칙**:
- `src/` 디렉토리만 수정 가능
- `src/frontend/` 수정 시 `src/gas/`에도 동기화

---

### 3.5 — 4단계: 김감사 PR 코드 리뷰

| 항목 | 내용 |
|------|------|
| **워크플로우** | `.github/workflows/kim-qa-pr-review.yml` |
| **트리거** | `workflow_dispatch` (3단계에서 자동 호출) |
| **AI 모델** | Claude Sonnet |
| **프롬프트** | `.github/prompts/pr_review_prompt.md` |
| **출력** | PR 리뷰 보고서 + 판정 (승인/조건부/반려) |

**판정 기준**:
| 판정 | 조건 |
|------|------|
| ✅ 승인 | Overall 80점 이상, 보안 이슈 없음 |
| ⚠️ 조건부 승인 | Overall 60~79점, 경미한 이슈만 |
| ❌ 반려 | Overall 60점 미만 또는 보안 이슈 |

**승인/조건부 시**: 슬랙에 배포 승인 버튼 전송
**반려 시**: 수동 확인 필요 안내

---

### 3.6 — 배포 승인 (GAS 처리)

| 항목 | 내용 |
|------|------|
| **처리 코드** | `src/gas/slack_command.gs` → `handleDeployDecision()` |
| **트리거** | CEO가 슬랙 배포 버튼 클릭 |
| **보안** | CEO만 실행 가능 (`SLACK_CEO_ID` 검증) |

**🚀 배포 승인 시**:
1. PR squash merge 실행
2. 이슈 close
3. GitHub 코멘트: 배포 완료
4. ⚠️ `clasp push`는 수동 별도 진행

**⏸️ 보류 시**:
1. 이슈에 보류 코멘트
2. 수동으로 GitHub에서 머지/종료 안내

---

## 4. 워크플로우 자동 연결 체인

```
이슈 생성 (from-workspace)
    │
    ├──→ kim-qa-issue-analysis.yml ──자동──→ jarvis-issue-response.yml
    │
    │    (슬랙 팀 배정 대기)
    │
    ├──→ GAS: triggerJarvisAutoFix_()
    │
    ├──→ jarvis-auto-fix.yml ──자동──→ kim-qa-pr-review.yml
    │
    │    (슬랙 배포 승인 대기)
    │
    └──→ GAS: handleDeployDecision() → PR 머지 + 이슈 종료
```

**사람이 개입하는 지점** (2곳):
1. 슬랙 팀 배정 버튼 클릭 (자비스 vs 강철)
2. 슬랙 배포 승인/보류 버튼 클릭

---

## 5. 데이터 흐름

```
[워크스페이스 UI] → [GAS doPost] → [GitHub Issue 생성]
                                          │
                                          ▼
                                   [GitHub Actions]
                                     │         │
                                     ▼         ▼
                              [Claude API]  [Claude Code Action]
                                     │         │
                                     ▼         ▼
                              [이슈 코멘트]  [PR 생성]
                                     │         │
                                     ▼         ▼
                                [Slack DM] ← [토큰 비용 계산]
                                     │
                                     ▼
                              [CEO 버튼 클릭]
                                     │
                                     ▼
                              [GAS doPost] → [GitHub API]
                                               │
                                               ▼
                                         [PR 머지/이슈 종료]
```

---

## 6. 안전장치 요약

| 안전장치 | 설명 |
|---------|------|
| 중복 실행 방지 | `qa-reviewed`, `jarvis-reviewed`, `fix-pr-created` 라벨로 재실행 차단 |
| 일일 제한 | QA 분석 20회/일 |
| 보안 게이트 | `.github/`, `.clasp.json`, `appsscript.json` 수정 시 롤백 |
| CEO 전용 | 배포 승인 버튼은 `SLACK_CEO_ID` 검증 |
| 수정 범위 제한 | Claude Code Action은 `src/` 디렉토리만 수정 가능 |
| PR 리뷰 필수 | 코드 수정 후 반드시 김감사 QA 리뷰 통과 필요 |
