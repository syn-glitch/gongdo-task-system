# [김감사 제안] 문서 구조화 및 폴더 재편성 계획

**작성자**: 김감사 (QA Specialist)
**작성일**: 2026-02-26
**목적**: 공도 업무 관리 시스템의 모든 문서를 체계적으로 정리하여 AI 에이전트 팀과 신규 팀원의 접근성 향상

---

## 📊 현황 분석 (Current State Analysis)

### 전체 파일 규모
- **Markdown 문서**: 41개 (총 ~300KB)
- **GAS 코드**: 12개 파일 (총 3,621줄)
- **HTML 파일**: 4개 (총 5,341줄)
- **전체 라인 수**: 약 9,000줄 이상

### 문제점 (Pain Points)

#### 1. **루트 디렉토리 혼잡 (Root Clutter)**
- 모든 파일이 단일 폴더에 나열되어 있음
- 문서 유형별 구분 없음 (기획서, QA 문서, 구현 계획, 가이드 등 혼재)
- 파일명 규칙 불일치 (영어/한글 혼용, 접두사 체계 부재)

#### 2. **문서 중복 및 버전 혼란**
- `main task.md` (35KB) vs `JUDY_AI_AGENT.md` (8.6KB): 내용 일부 중복
- Implementation Plan이 Phase별로 분산 (phase9~20): 전체 로드맵 파악 어려움
- 임시 문서와 최종 문서 구분 어려움 (예: `주디 노트 심플 최종 버전_이후 고도화.md`)

#### 3. **AI 에이전트 작업물 추적 어려움**
- `[QA_...]`, `[자비스_...]`, `[김감사_...]` 문서가 루트에 산재
- 시간순 정렬 불가 (파일명에 날짜 없음)
- 에이전트별 작업 히스토리 조회 어려움

#### 4. **신규 팀원 온보딩 난이도**
- "어떤 문서부터 읽어야 하는지" 명확하지 않음
- README.md는 초기 설정 위주, 전체 시스템 이해에 부족
- 사용자 가이드와 개발자 가이드 분리 부족

---

## 🎯 재편성 목표 (Reorganization Goals)

### 1. **계층적 폴더 구조 (Hierarchical Folder Structure)**
- 문서 유형별 폴더 분리 (docs/, src/, design/, qa/, agent_work/)
- 3-Depth 이내 제한 (과도한 중첩 방지)

### 2. **명확한 파일 네이밍 규칙 (Clear Naming Convention)**
- 접두사 체계: `[카테고리]_제목_날짜.md` 형식
- 영문 우선, 한글은 제목에만 사용
- 버전 관리: v1, v2 또는 날짜 (YYYYMMDD)

### 3. **단일 진입점 (Single Source of Truth)**
- `main task.md`를 최상위 통합 문서로 유지
- 각 섹션은 상세 문서로 링크 (분리된 파일로 관리)

### 4. **AI 에이전트 작업 아카이브**
- 에이전트별 작업물을 시간순 정리
- 의사결정 히스토리 추적 가능

---

## 📁 제안하는 새 폴더 구조 (Proposed New Folder Structure)

```
공도 업무 관리/
│
├── README.md                          # 프로젝트 개요 및 Quick Start
├── main_task.md                       # 📌 통합 로드맵 (Single Source of Truth)
├── CHANGELOG.md                       # 🆕 버전별 변경 이력 (신규 생성)
│
├── 📂 docs/                           # 문서 (Documentation)
│   ├── 📂 guides/                     # 가이드 문서
│   │   ├── USER_GUIDE.md              # 사용자 가이드 (슬랙 명령어, 웹 사용법)
│   │   ├── DEVELOPER_GUIDE.md         # 🆕 개발자 가이드 (통합)
│   │   ├── SETUP_GUIDE.md             # 🆕 초기 설정 가이드 (README 분리)
│   │   ├── SLACK_GUIDE.md             # 슬랙 봇 가이드 (judy_slackbot_guide.md 이동)
│   │   ├── DASHBOARD_GUIDE.md         # 대시보드 가이드
│   │   └── JUDY_NOTE_GUIDE.md         # 주디 노트 가이드
│   │
│   ├── 📂 architecture/               # 시스템 아키텍처
│   │   ├── SYSTEM_ARCHITECTURE.md     # 🆕 전체 시스템 아키텍처 (다이어그램 포함)
│   │   ├── DATABASE_SCHEMA.md         # 🆕 데이터베이스 스키마 (Sheets 구조)
│   │   ├── API_REFERENCE.md           # 🆕 GAS 함수 API 레퍼런스
│   │   └── JUDY_AI_AGENT.md           # AI 에이전트 상세 설명
│   │
│   ├── 📂 specifications/             # 기술 명세서
│   │   ├── API_SPEC_judy_note_edit.md # 주디 노트 편집 API 명세
│   │   └── FEATURE_SPEC_time_tracking.md # 🆕 타임 트래킹 기능 명세
│   │
│   └── 📂 troubleshooting/            # 문제 해결
│       ├── SLACK_MODAL_TROUBLESHOOTING.md
│       ├── COMMON_ISSUES.md           # 🆕 자주 발생하는 문제 모음
│       └── 버그_분석.md
│
├── 📂 planning/                       # 기획 및 구현 계획
│   ├── 📂 implementation_plans/       # 구현 계획서 (Phase별)
│   │   ├── _INDEX.md                  # 🆕 Phase별 전체 인덱스
│   │   ├── phase_09_judy_note_v2.md   # implementation_plan_phase9.md
│   │   ├── phase_10_magic_link.md     # implementation_plan_phase10.md
│   │   ├── phase_11_note_edit.md      # implementation_plan_phase11.md
│   │   ├── phase_14_modal_refactor.md
│   │   ├── phase_15_dashboard.md
│   │   ├── phase_16_ui_polish.md
│   │   ├── phase_17_async_ai.md
│   │   ├── phase_18_archive_view.md
│   │   ├── phase_20_workspace.md
│   │   ├── phase_21_time_tracking.md  # implementation_plan_time_tracking.md
│   │   └── phase_22_kanban_calendar.md # implementation_plan_kanban_calendar.md
│   │
│   └── 📂 tasks/                      # 개발 작업 목록
│       ├── task_phase20.md
│       ├── task_workspace.md
│       ├── task_time_tracking.md
│       └── task_kanban_calendar.md
│
├── 📂 qa/                             # QA 및 테스트
│   ├── 📂 test_plans/                 # 테스트 계획서
│   │   └── TEST_PLAN_judy_note_edit.md
│   │
│   ├── 📂 qa_reviews/                 # QA 검토 문서 (에이전트 작업물)
│   │   ├── 2026-02-25_judy_note_edit_initial_review.md    # [QA_검토결과]_주디노트_수정기능.md
│   │   ├── 2026-02-25_time_tracking_request.md            # [QA_요청]_업무시간_트래킹.md
│   │   ├── 2026-02-26_judy_note_edit_final_approval.md    # [김감사_최종승인]_주디노트_수정기능_v1.md
│   │   ├── 2026-02-26_judy_note_edit_e2e_test.md          # [QA_E2E_최종검수]_주디노트_수정기능_v1.md
│   │   ├── 2026-02-26_kanban_calendar_review.md           # [QA_검토]_칸반_캘린더_기능.md
│   │   └── 2026-02-26_kanban_calendar_ux_debate.md        # [김감사_재검토]_칸반_캘린더_UX_논쟁_최종의견.md
│   │
│   └── 📂 qa_reports/                 # QA 리포트
│       └── _TEMPLATE_qa_review.md     # 🆕 QA 검토 템플릿
│
├── 📂 agent_work/                     # AI 에이전트 작업 히스토리
│   ├── 📂 jarvis_po/                  # 자비스 (PO) 작업물
│   │   ├── 2026-02-26_judy_note_agreement.md              # 주디노트 업데이트 자&김 v1_20260226.1450.md
│   │   └── 2026-02-26_kanban_calendar_response.md         # [자비스_회신]_칸반_캘린더_필수조건_및_UX_논의.md
│   │
│   ├── 📂 kim_qa/                     # 김감사 (QA) 작업물
│   │   └── (위 qa_reviews/ 폴더와 동일, 심볼릭 링크 또는 이동)
│   │
│   ├── 📂 ada_backend/                # 에이다 (Backend) 작업물 (미래)
│   ├── 📂 chloe_frontend/             # 클로이 (Frontend) 작업물 (미래)
│   └── 📂 hermit_infra/               # 허밋 (Infra) 작업물 (미래)
│
├── 📂 src/                            # 소스 코드 (GAS + HTML)
│   ├── 📂 gas/                        # Google Apps Script
│   │   ├── _main.gs                   # 🆕 진입점 (현재 slack_command.gs)
│   │   ├── setup_structure.gs         # 시트 구조 초기화
│   │   ├── auto_automation.gs         # 트리거 및 자동화
│   │   ├── slack_command.gs           # 슬랙 명령어 핸들러
│   │   ├── slack_notification.gs      # 슬랙 알림
│   │   ├── web_app.gs                 # 웹앱 백엔드
│   │   ├── drive_archive.gs           # Google Drive 아카이브
│   │   ├── calendar_sync.gs           # 캘린더 동기화
│   │   ├── ai_chat.gs                 # AI 채팅
│   │   ├── ai_report.gs               # AI 리포트
│   │   ├── ai_task_parser.gs          # AI 업무 파싱
│   │   ├── auto_dashboard.gs          # 대시보드 자동화
│   │   └── README.md                  # 🆕 GAS 코드 구조 설명
│   │
│   └── 📂 frontend/                   # 프론트엔드 (HTML/CSS/JS)
│       ├── judy_workspace.html        # 주디 워크스페이스 (통합 SPA)
│       ├── judy_note.html             # 주디 노트 (구버전, deprecated)
│       ├── task_dashboard.html        # 업무 대시보드 (구버전, deprecated)
│       ├── deployed_script.html       # 배포용 스크립트
│       └── README.md                  # 🆕 프론트엔드 구조 설명
│
├── 📂 design/                         # 디자인 및 프롬프트
│   ├── PROMPT_TEMPLATE.md             # AI 프롬프트 템플릿
│   └── UI_DESIGN_GUIDELINES.md        # 🆕 UI/UX 디자인 가이드라인
│
├── 📂 archive/                        # 보관 (사용 중단된 문서)
│   ├── judy_note.html                 # 주디 노트 v1 (워크스페이스로 통합됨)
│   ├── task_dashboard.html            # 대시보드 v1 (워크스페이스로 통합됨)
│   ├── judy_dev_note.md               # 개발 노트 (DEVELOPER_GUIDE.md로 통합)
│   ├── 주디 노트 심플 최종 버전_이후 고도화.md
│   └── 첫_AI_에이전트_팀원_주디_가이드.md
│
└── 📂 templates/                      # 템플릿 (신규 생성)
    ├── TEMPLATE_implementation_plan.md # 🆕 구현 계획서 템플릿
    ├── TEMPLATE_qa_review.md          # 🆕 QA 검토 템플릿
    ├── TEMPLATE_feature_spec.md       # 🆕 기능 명세서 템플릿
    └── TEMPLATE_agent_communication.md # 🆕 에이전트 간 커뮤니케이션 템플릿
```

---

## 📝 주요 변경 사항 (Key Changes)

### 1. **신규 생성 문서 (New Documents)**

#### A. `CHANGELOG.md`
```markdown
# Changelog

## [Phase 22] 2026-02-26
### Added
- 칸반 보드 & 커스텀 캘린더 기능 기획 (자비스 + 김감사 협의 완료)

### Changed
- 주디 노트 편집 기능 E2E 테스트 완료 및 배포 (commit df61553)

### Fixed
- LockService 타임아웃 방어 로직 적용
- 2-Phase Commit 백업 시스템 구축
```

#### B. `SYSTEM_ARCHITECTURE.md` (신규)
```markdown
# 시스템 아키텍처

## 전체 구성도
[Mermaid 다이어그램]

## 데이터 흐름
1. 슬랙 명령어 → GAS → Sheets
2. 웹 앱 → GAS → Drive/Sheets
3. AI 요청 → Claude API → GAS

## 주요 컴포넌트
...
```

#### C. `DATABASE_SCHEMA.md` (신규)
```markdown
# 데이터베이스 스키마

## Tasks 시트
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| A: ID | Text | 업무 고유 ID | GONG-001 |
| B: 업무 유형 | Text | 일반/긴급/프로젝트 | 일반 |
...
```

#### D. `DEVELOPER_GUIDE.md` (통합)
```markdown
# 개발자 가이드

## 개발 환경 설정
1. GAS 편집기 접근
2. 권한 설정
3. 트리거 설정

## 코드 기여 가이드
1. Git 브랜치 전략
2. 커밋 메시지 규칙
3. Pull Request 프로세스

## 로컬 개발 (clasp)
...
```

### 2. **파일 이름 변경 규칙 (Renaming Convention)**

| 기존 파일명 | 새 파일명 | 이유 |
|:---|:---|:---|
| `[QA_검토결과]_주디노트_수정기능.md` | `qa/qa_reviews/2026-02-25_judy_note_edit_initial_review.md` | 날짜 + 영문 제목 |
| `implementation_plan_phase20.md` | `planning/implementation_plans/phase_20_workspace.md` | 일관된 네이밍 |
| `judy_slackbot_guide.md` | `docs/guides/SLACK_GUIDE.md` | 대문자 + 명확한 카테고리 |
| `주디 노트 심플 최종 버전_이후 고도화.md` | `archive/judy_note_deprecated_roadmap.md` | 영문화 + archive |

### 3. **main_task.md 재구성 (Main Task Restructuring)**

현재 `main task.md`는 35KB로 비대함. 다음과 같이 분리 제안:

```markdown
# 공도 업무 관리 시스템 - 통합 로드맵

## 📌 Quick Links
- [사용자 가이드](docs/guides/USER_GUIDE.md)
- [개발자 가이드](docs/guides/DEVELOPER_GUIDE.md)
- [시스템 아키텍처](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [AI 에이전트 상세](docs/architecture/JUDY_AI_AGENT.md)

## 🚀 개발 로드맵
### [Phase 1-8] 기반 구축 (완료)
- ✅ Google Sheets DB 구조
- ✅ 슬랙 봇 알림
- ✅ 자동 ID 생성
- [상세 보기](planning/implementation_plans/_INDEX.md#phase-1-8)

### [Phase 9-18] 주디 노트 & 대시보드 (완료)
- ✅ 마크다운 아카이브
- ✅ AI 요약 & 업무 추출
- ✅ 웹 대시보드
- [상세 보기](planning/implementation_plans/_INDEX.md#phase-9-18)

### [Phase 20-21] 워크스페이스 통합 (완료)
- ✅ SPA 통합 (judy_workspace.html)
- ✅ 타임 트래킹 (Beta)
- [상세 보기](planning/implementation_plans/_INDEX.md#phase-20-21)

### [Phase 22] 칸반 & 캘린더 (진행 중 🔥)
- 🟡 백엔드 API 고도화
- 🟡 칸반 보드 UI
- 🟡 커스텀 캘린더
- [상세 계획서](planning/implementation_plans/phase_22_kanban_calendar.md)
- [QA 검토 의견](qa/qa_reviews/2026-02-26_kanban_calendar_review.md)

## 🤖 AI 에이전트 팀
### 현재 활성 팀원
- **자비스 (Jarvis)**: PO (Product Owner)
- **김감사 (Kim QA)**: QA Specialist
- **에이다 (Ada)**: Backend Developer
- **클로이 (Chloe)**: Frontend Developer
- **허밋 (Hermit)**: Infrastructure Engineer

### 작업 히스토리
- [자비스 작업물](agent_work/jarvis_po/)
- [김감사 작업물](agent_work/kim_qa/)

## 📊 최근 업데이트
- 2026-02-26: 칸반 & 캘린더 기획 협의 완료 (자비스 ↔ 김감사)
- 2026-02-26: 주디 노트 편집 기능 E2E 테스트 통과 (Full Approval)
- 2026-02-21: 타임 트래킹 기능 Beta 배포 (송용남, 정혜림)

[전체 변경 이력 보기](CHANGELOG.md)
```

---

## 🔄 마이그레이션 계획 (Migration Plan)

### Phase 1: 폴더 구조 생성 (5분)
```bash
mkdir -p docs/guides docs/architecture docs/specifications docs/troubleshooting
mkdir -p planning/implementation_plans planning/tasks
mkdir -p qa/test_plans qa/qa_reviews qa/qa_reports
mkdir -p agent_work/jarvis_po agent_work/kim_qa agent_work/ada_backend agent_work/chloe_frontend agent_work/hermit_infra
mkdir -p src/gas src/frontend
mkdir -p design archive templates
```

### Phase 2: 문서 이동 (10분)
```bash
# 가이드 문서
mv USER_GUIDE.md docs/guides/
mv DASHBOARD_GUIDE.md docs/guides/
mv judy_slackbot_guide.md docs/guides/SLACK_GUIDE.md
mv judy_note_guide.md docs/guides/JUDY_NOTE_GUIDE.md

# 아키텍처
mv JUDY_AI_AGENT.md docs/architecture/

# 구현 계획서
mv implementation_plan_phase*.md planning/implementation_plans/
mv implementation_plan_kanban_calendar.md planning/implementation_plans/phase_22_kanban_calendar.md
mv implementation_plan_time_tracking.md planning/implementation_plans/phase_21_time_tracking.md

# QA 문서
mv TEST_PLAN_judy_note_edit.md qa/test_plans/
mv "[QA_검토결과]_주디노트_수정기능.md" qa/qa_reviews/2026-02-25_judy_note_edit_initial_review.md
mv "[QA_요청]_업무시간_트래킹.md" qa/qa_reviews/2026-02-25_time_tracking_request.md
mv "[김감사_최종승인]_주디노트_수정기능_v1.md" qa/qa_reviews/2026-02-26_judy_note_edit_final_approval.md
mv "[QA_E2E_최종검수]_주디노트_수정기능_v1.md" qa/qa_reviews/2026-02-26_judy_note_edit_e2e_test.md
mv "[QA_검토]_칸반_캘린더_기능.md" qa/qa_reviews/2026-02-26_kanban_calendar_review.md
mv "[김감사_재검토]_칸반_캘린더_UX_논쟁_최종의견.md" qa/qa_reviews/2026-02-26_kanban_calendar_ux_debate.md

# 에이전트 작업물
mv "주디노트 업데이트 자&김 v1_20260226.1450.md" agent_work/jarvis_po/2026-02-26_judy_note_agreement.md
mv "[자비스_회신]_칸반_캘린더_필수조건_및_UX_논의.md" agent_work/jarvis_po/2026-02-26_kanban_calendar_response.md

# 소스 코드
mv *.gs src/gas/
mv *.html src/frontend/

# 보관
mv "주디 노트 심플 최종 버전_이후 고도화.md" archive/judy_note_deprecated_roadmap.md
mv "첫_AI_에이전트_팀원_주디_가이드.md" archive/first_agent_guide.md
mv judy_dev_note.md archive/judy_dev_note_old.md
```

### Phase 3: 신규 문서 생성 (15분)
- CHANGELOG.md
- docs/architecture/SYSTEM_ARCHITECTURE.md
- docs/architecture/DATABASE_SCHEMA.md
- docs/architecture/API_REFERENCE.md
- docs/guides/DEVELOPER_GUIDE.md
- docs/guides/SETUP_GUIDE.md
- planning/implementation_plans/_INDEX.md
- templates/*.md (4개 템플릿)

### Phase 4: main_task.md 재구성 (10분)
- 기존 내용을 섹션별로 분리
- 각 섹션은 개별 파일로 이동
- main_task.md는 인덱스 역할만 (링크 중심)

### Phase 5: Git Commit (5분)
```bash
git add .
git commit -m "docs: restructure entire documentation and folder hierarchy

- Organize 41 markdown files into logical folders (docs/, planning/, qa/, agent_work/, src/)
- Rename files to follow consistent naming convention (date + english title)
- Create new architecture and guide documents
- Refactor main_task.md into index-style navigation
- Archive deprecated documents

Co-Authored-By: Kim QA <noreply@gongdo.team>"
```

---

## 📋 파일 이동 매핑표 (File Migration Mapping)

| # | 기존 경로 | 새 경로 | 비고 |
|:---:|:---|:---|:---|
| 1 | `README.md` | `README.md` | 유지 (Quick Start 위주로 간소화) |
| 2 | `main task.md` | `main_task.md` | 이름만 변경 (공백 제거) |
| 3 | `USER_GUIDE.md` | `docs/guides/USER_GUIDE.md` | 이동 |
| 4 | `DEVELOPER_NOTES.md` | `docs/guides/DEVELOPER_GUIDE.md` | 이동 + 통합 |
| 5 | `DASHBOARD_GUIDE.md` | `docs/guides/DASHBOARD_GUIDE.md` | 이동 |
| 6 | `judy_slackbot_guide.md` | `docs/guides/SLACK_GUIDE.md` | 이동 + 이름 변경 |
| 7 | `judy_note_guide.md` | `docs/guides/JUDY_NOTE_GUIDE.md` | 이동 + 이름 변경 |
| 8 | `JUDY_AI_AGENT.md` | `docs/architecture/JUDY_AI_AGENT.md` | 이동 |
| 9 | `API_SPEC_judy_note_edit.md` | `docs/specifications/API_SPEC_judy_note_edit.md` | 이동 |
| 10 | `SLACK_MODAL_TROUBLESHOOTING.md` | `docs/troubleshooting/SLACK_MODAL_TROUBLESHOOTING.md` | 이동 |
| 11 | `버그_분석.md` | `docs/troubleshooting/버그_분석.md` | 이동 |
| 12 | `PROMPT_TEMPLATE.md` | `design/PROMPT_TEMPLATE.md` | 이동 |
| 13-24 | `implementation_plan_phase*.md` | `planning/implementation_plans/phase_XX_*.md` | 이동 + 통일된 네이밍 |
| 25 | `implementation_plan_kanban_calendar.md` | `planning/implementation_plans/phase_22_kanban_calendar.md` | 이동 |
| 26 | `implementation_plan_time_tracking.md` | `planning/implementation_plans/phase_21_time_tracking.md` | 이동 |
| 27-30 | `task_*.md` | `planning/tasks/` | 이동 |
| 31 | `TEST_PLAN_judy_note_edit.md` | `qa/test_plans/TEST_PLAN_judy_note_edit.md` | 이동 |
| 32-37 | `[QA_...]`, `[김감사_...]` | `qa/qa_reviews/2026-02-XX_*.md` | 이동 + 날짜 접두사 |
| 38-39 | `[자비스_...]`, `주디노트 업데이트...` | `agent_work/jarvis_po/2026-02-26_*.md` | 이동 |
| 40-51 | `*.gs` | `src/gas/` | 이동 |
| 52-55 | `*.html` | `src/frontend/` | 이동 |
| 56-58 | `주디 노트 심플...`, `첫_AI...` | `archive/` | 보관 |

---

## 🎯 문서 작성 규칙 (Documentation Guidelines)

### 1. **파일 네이밍 규칙**

#### Markdown 문서
```
[카테고리]_제목_버전.md

예시:
- SYSTEM_ARCHITECTURE.md
- DEVELOPER_GUIDE.md
- API_SPEC_judy_note_edit.md
- 2026-02-26_kanban_calendar_review.md (QA 문서)
```

#### GAS 코드
```
[기능]_[역할].gs

예시:
- slack_command.gs
- drive_archive.gs
- ai_task_parser.gs
```

#### HTML 파일
```
[컴포넌트명].html

예시:
- judy_workspace.html
- task_dashboard.html (deprecated)
```

### 2. **Markdown 문서 구조**

#### 모든 문서 상단에 메타데이터 포함
```markdown
# 문서 제목

**작성자**: 이름 (역할)
**작성일**: YYYY-MM-DD
**최종 수정**: YYYY-MM-DD
**관련 문서**: [링크1](path), [링크2](path)

---

## 개요
...
```

#### 섹션 깊이 제한 (최대 4레벨)
```markdown
# H1: 문서 제목 (1개만)
## H2: 대분류
### H3: 중분류
#### H4: 소분류 (여기까지만)
```

#### 코드 블록에 언어 명시
````markdown
```javascript
function example() {
  return true;
}
```
````

### 3. **커밋 메시지 규칙**

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Agent Name <email>
```

**Type**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서만 변경
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가
- `chore`: 빌드/설정 변경

**Scope**:
- `gas`: GAS 코드
- `frontend`: HTML/CSS/JS
- `docs`: 문서
- `qa`: QA 문서

**예시**:
```
docs(structure): restructure entire documentation hierarchy

- Organize 41 markdown files into logical folders
- Rename files with consistent naming convention
- Create architecture and developer guides

Co-Authored-By: Kim QA <noreply@gongdo.team>
```

---

## 📅 실행 타임라인 (Execution Timeline)

| 단계 | 작업 | 담당 | 예상 시간 | 완료 기준 |
|:---:|:---|:---|:---:|:---|
| 1 | 폴더 구조 생성 | 김감사 | 5분 | 모든 폴더 생성 완료 |
| 2 | 기존 문서 이동 | 김감사 | 10분 | 41개 파일 이동 완료 |
| 3 | 신규 문서 작성 | 김감사 | 30분 | 8개 신규 문서 생성 |
| 4 | main_task.md 재구성 | 김감사 | 15분 | 인덱스 스타일로 변환 |
| 5 | 링크 검증 | 김감사 | 10분 | 모든 내부 링크 확인 |
| 6 | Git 커밋 | 김감사 | 5분 | 변경사항 커밋 |
| **총** | | | **75분** | |

---

## ✅ 승인 요청 (Approval Request)

**팀장님께 승인 요청드립니다**:

1. ✅ **위 폴더 구조에 동의하십니까?**
   - 수정 필요 시 어떤 부분인지 말씀해주세요

2. ✅ **파일 이동 및 이름 변경에 동의하십니까?**
   - 특히 한글 파일명 → 영문 변환에 대해

3. ✅ **main_task.md를 인덱스 스타일로 간소화하는 것에 동의하십니까?**
   - 또는 기존 상세 내용을 유지하시겠습니까?

4. ✅ **신규 생성 문서 목록에 추가/삭제할 것이 있습니까?**
   - SYSTEM_ARCHITECTURE.md
   - DATABASE_SCHEMA.md
   - API_REFERENCE.md
   - DEVELOPER_GUIDE.md
   - SETUP_GUIDE.md
   - CHANGELOG.md
   - 템플릿 4종

---

**승인 방법**:
1. **전체 승인**: "김감사, 제안대로 진행해주세요"
2. **부분 수정**: "X번 항목은 Y로 변경하고 진행해주세요"
3. **대기**: "Z 문서를 먼저 확인하고 다시 논의합시다"

**팀장님의 결정을 기다리겠습니다!** 🙇‍♂️
