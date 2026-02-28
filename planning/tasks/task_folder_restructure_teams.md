# 📁 팀 중심 폴더 구조 재편 프로젝트

**Task ID**: TASK-2026-02-28-FOLDER-RESTRUCTURE
**우선순위**: P0 (Critical)
**담당팀**: 꼼꼼이 AX 문서팀
**요청자**: 송용남 팀장
**예상 공수**: 6시간
**목표 완료일**: 2026-03-01

---

## 📋 Task 개요

현재 혼재된 폴더 구조(`agent_work/`, `qa/`, `ax/`)를 **팀 중심 구조 (`teams/`)**로 전면 재편하여 AI 에이전트 팀 간 협업 효율을 극대화하고, 향후 신규 팀(벙커팀 등) 추가 시 확장성을 확보합니다.

---

## 🎯 목표 (Goals)

### 핵심 목표
1. ✅ 모든 팀을 `teams/` 하위로 통합하여 일관성 확보
2. ✅ 각 팀별 독립적인 작업 공간 및 하위 구조 자율권 보장
3. ✅ 신규 팀(벙커팀) 추가를 대비한 확장 가능한 구조 설계
4. ✅ 전체 문서 링크 무결성 유지 (깨진 링크 0개)

### 성과 지표
- 폴더 구조 일관성: 100% (모든 팀이 `teams/` 하위)
- 링크 유효성: 100% (깨진 링크 0개)
- 팀별 README 작성률: 100% (5개 팀 전체)
- 마이그레이션 성공률: 100% (118개 파일 전수 이동)

---

## 📂 새로운 폴더 구조 (To-Be)

```
/공도 업무 관리/
├── teams/                           # 🆕 모든 팀의 루트 폴더
│   ├── jarvis-dev/                  # 자비스 개발팀
│   │   ├── README.md
│   │   ├── planning/                # 기획서 (자비스 PO)
│   │   │   ├── 2026-02/
│   │   │   └── 2026-03/
│   │   ├── development/             # 개발 산출물 (알렉스, 에이다, 클로이)
│   │   │   ├── features/
│   │   │   └── bugfixes/
│   │   ├── design/                  # 벨라 UX
│   │   ├── team-logs/               # 팀 활동 로그
│   │   └── archive/                 # 구버전 보관
│   │
│   ├── kim-qa/                      # 김감사 QA팀
│   │   ├── README.md
│   │   ├── reviews/                 # QA 리뷰
│   │   │   ├── 2026-02/
│   │   │   │   ├── functional/
│   │   │   │   ├── security/
│   │   │   │   ├── ux/
│   │   │   │   └── integrated/
│   │   │   └── 2026-03/
│   │   ├── reports/                 # 월간 QA 리포트
│   │   ├── templates/               # QA 템플릿
│   │   ├── retrospectives/          # 회고
│   │   │   ├── daily/
│   │   │   ├── weekly/
│   │   │   └── monthly/
│   │   ├── test-plans/              # 테스트 계획서
│   │   └── team-rules/              # QA 팀 규칙
│   │
│   ├── gangcheol-ax/                # 강철 AX팀
│   │   ├── README.md
│   │   ├── technical-debt/          # 기술 부채 백로그
│   │   │   ├── backlog.md
│   │   │   └── completed/
│   │   ├── refactoring/             # 리팩토링 작업
│   │   │   ├── 2026-02/
│   │   │   └── 2026-03/
│   │   ├── security/                # 보안 강화
│   │   ├── performance/             # 성능 최적화
│   │   ├── reports/                 # 월간 개선 리포트
│   │   └── team-rules/              # AX 팀 규칙
│   │
│   ├── kkoomkkoom-docs/             # 꼼꼼이 문서팀
│   │   ├── README.md
│   │   ├── templates/               # 전사 표준 템플릿
│   │   ├── style-guide/             # 문서 작성 가이드
│   │   ├── reports/                 # 문서 변경 리포트
│   │   ├── backlog/                 # 문서 작업 백로그
│   │   └── archive/                 # 구버전 문서
│   │
│   └── bunker/                      # 🆕 벙커팀 (신규 예정)
│       ├── README.md
│       ├── infrastructure/          # 인프라 관리
│       ├── deployment/              # 배포 자동화
│       ├── monitoring/              # 모니터링
│       ├── logs/                    # 시스템 로그
│       └── runbooks/                # 운영 매뉴얼
│
├── docs/                            # 전사 공통 문서 (유지)
│   ├── architecture/
│   ├── guides/
│   ├── specifications/
│   ├── troubleshooting/
│   └── projects/
│
├── planning/                        # 프로젝트 계획 (유지)
│   ├── implementation_plans/
│   └── tasks/
│
├── src/                             # 소스 코드 (유지)
│   ├── frontend/
│   ├── gas/
│   └── infra/
│
├── templates/                       # 문서 템플릿 (유지)
├── archive/                         # 프로젝트 아카이브 (유지)
├── design/                          # 디자인 리소스 (유지)
├── README.md
├── CHANGELOG.md
└── main task.md
```

---

## 🔄 마이그레이션 계획 (6 Phases)

### Phase 1: 폴더 구조 생성 (30분)

**담당**: 아키비스트
**작업 내용**:
```bash
# 1. teams 루트 생성
mkdir -p teams

# 2. 각 팀 폴더 및 하위 구조 생성
mkdir -p teams/jarvis-dev/{planning/{2026-02,2026-03},development/{features,bugfixes},design,team-logs,archive}
mkdir -p teams/kim-qa/{reviews/2026-02/{functional,security,ux,integrated},reviews/2026-03,reports,templates,retrospectives/{daily,weekly,monthly},test-plans,team-rules}
mkdir -p teams/gangcheol-ax/{technical-debt/{completed},refactoring/{2026-02,2026-03},security,performance,reports,team-rules}
mkdir -p teams/kkoomkkoom-docs/{templates,style-guide,reports,backlog,archive}
mkdir -p teams/bunker/{infrastructure,deployment,monitoring,logs,runbooks}
```

**검증 체크리스트**:
- [ ] `teams/` 폴더 생성 확인
- [ ] 5개 팀 폴더 생성 확인
- [ ] 각 팀별 하위 폴더 구조 생성 확인

---

### Phase 2: 파일 마이그레이션 (2시간)

**담당**: 크로스체커
**작업 내용**:

#### 2.1 자비스 개발팀
```bash
# agent_work/jarvis_po/ → teams/jarvis-dev/planning/2026-02/
mv agent_work/jarvis_po/*.md teams/jarvis-dev/planning/2026-02/

# agent_work/bella_ux/ → teams/jarvis-dev/design/
mv agent_work/bella_ux/*.md teams/jarvis-dev/design/

# agent_work/alex_dev/ → teams/jarvis-dev/development/
mv agent_work/alex_dev/*.md teams/jarvis-dev/development/
```

**이동 대상**: 총 23개 파일

#### 2.2 김감사 QA팀
```bash
# qa/qa_reviews/ → teams/kim-qa/reviews/2026-02/
mv qa/qa_reviews/*.md teams/kim-qa/reviews/2026-02/

# qa/templates/ → teams/kim-qa/templates/
mv qa/templates/*.md teams/kim-qa/templates/

# qa/test_plans/ → teams/kim-qa/test-plans/
mv qa/test_plans/*.md teams/kim-qa/test-plans/

# qa/qa_team_overview.md, qa_team_rules.md → teams/kim-qa/team-rules/
mv qa/qa_team_overview.md teams/kim-qa/team-rules/
mv qa/qa_team_rules.md teams/kim-qa/team-rules/
mv qa/QA_PROCESS_V2.md teams/kim-qa/team-rules/
mv qa/README.md teams/kim-qa/
```

**이동 대상**: 총 34개 파일

#### 2.3 강철 AX팀
```bash
# ax/ 루트 파일 → teams/gangcheol-ax/team-rules/
mv ax/ax_team_overview.md teams/gangcheol-ax/team-rules/
mv ax/ax_team_rules.md teams/gangcheol-ax/team-rules/
mv ax/technical_debt_backlog.md teams/gangcheol-ax/technical-debt/backlog.md

# ax/performance/ → teams/gangcheol-ax/performance/
mv ax/performance/*.md teams/gangcheol-ax/performance/

# ax/refactoring/ → teams/gangcheol-ax/refactoring/2026-02/
mv ax/refactoring/*.md teams/gangcheol-ax/refactoring/2026-02/

# ax/security/ → teams/gangcheol-ax/security/
mv ax/security/*.md teams/gangcheol-ax/security/

# agent_work/gangcheol_ax/ → teams/gangcheol-ax/reports/
mv agent_work/gangcheol_ax/*.md teams/gangcheol-ax/reports/
```

**이동 대상**: 총 7개 파일

#### 2.4 꼼꼼이 문서팀 (신규 팀)
```bash
# templates/ → teams/kkoomkkoom-docs/templates/
cp templates/*.md teams/kkoomkkoom-docs/templates/
# (원본은 유지 - 전사 공통 템플릿으로도 사용)

# docs/guides/TERMINOLOGY_GUIDE.md → teams/kkoomkkoom-docs/style-guide/
# (신규 작성 예정)
```

**이동 대상**: 총 4개 파일 (복사)

#### 2.5 벙커팀 (준비 단계)
```bash
# 폴더 구조만 생성, 파일은 아직 없음
# README.md는 Phase 3에서 작성
```

**검증 체크리스트**:
- [ ] 자비스 팀 23개 파일 이동 완료
- [ ] 김감사 팀 34개 파일 이동 완료
- [ ] 강철 팀 7개 파일 이동 완료
- [ ] 꼼꼼이 팀 4개 파일 복사 완료
- [ ] 원본 파일 위치 확인

---

### Phase 3: README 작성 (1시간)

**담당**: 아키비스트 + 히스토리안
**작업 내용**:

각 팀의 `README.md` 작성 (템플릿 기반)

**템플릿 구조**:
```markdown
# [팀명]

**팀 미션**: [한 문장 미션]

## 👥 팀 구성
- [팀원 1] (역할)
- [팀원 2] (역할)
...

## 📂 폴더 구조
- `subfolder1/`: [설명]
- `subfolder2/`: [설명]
...

## 📋 주요 산출물
- [산출물 유형 1]: [설명]
- [산출물 유형 2]: [설명]

## 🔗 관련 문서
- [다른 팀 문서 링크]

## 📝 문서 작성 규칙
- 파일명: `YYYY-MM-DD_제목.md`
- 템플릿: `/teams/kkoomkkoom-docs/templates/xxx.md` 참고
```

**작성 대상**:
- [ ] `teams/jarvis-dev/README.md`
- [ ] `teams/kim-qa/README.md`
- [ ] `teams/gangcheol-ax/README.md`
- [ ] `teams/kkoomkkoom-docs/README.md`
- [ ] `teams/bunker/README.md`

---

### Phase 4: 링크 수정 (2시간)

**담당**: 크로스체커
**작업 내용**:

전체 문서에서 경로 변경된 파일 참조 수정

**수정 패턴**:
```bash
# 자동 치환 스크립트
find . -name "*.md" -type f -exec sed -i '' 's|agent_work/jarvis_po/|teams/jarvis-dev/planning/2026-02/|g' {} +
find . -name "*.md" -type f -exec sed -i '' 's|qa/qa_reviews/|teams/kim-qa/reviews/2026-02/|g' {} +
find . -name "*.md" -type f -exec sed -i '' 's|qa/QA_PROCESS_V2.md|teams/kim-qa/team-rules/QA_PROCESS_V2.md|g' {} +
find . -name "*.md" -type f -exec sed -i '' 's|ax/ax_team_overview.md|teams/gangcheol-ax/team-rules/ax_team_overview.md|g' {} +
find . -name "*.md" -type f -exec sed -i '' 's|ax/technical_debt_backlog.md|teams/gangcheol-ax/technical-debt/backlog.md|g' {} +
```

**수정 대상**:
- `docs/architecture/AI_AGENT_TEAM_OVERVIEW.md` (팀 소개 링크)
- `docs/architecture/TEAM_STRUCTURE.md` (팀 구조 링크)
- 각 팀의 상호 참조 링크
- `main task.md` (프로젝트 인덱스)

**검증 체크리스트**:
- [ ] 링크 자동 치환 스크립트 실행
- [ ] 수동 링크 검증 (markdown-link-check 도구 사용)
- [ ] 깨진 링크 0개 확인

---

### Phase 5: 구폴더 정리 (30분)

**담당**: 아키비스트
**작업 내용**:

```bash
# 1. 백업 생성 (안전장치)
tar -czf backup_old_folders_2026-02-28.tar.gz agent_work/ qa/ ax/

# 2. 구폴더 삭제
rm -rf agent_work/
rm -rf qa/
rm -rf ax/

# 3. 빈 폴더 정리
rm -rf teams/jarvis-dev/development/features/.gitkeep
# (실제 파일이 들어올 때까지 .gitkeep 유지)
```

**백업 위치**: `/archive/folder_migration_backup/`

**검증 체크리스트**:
- [ ] 백업 파일 생성 확인
- [ ] 구폴더 삭제 완료
- [ ] teams/ 폴더만 남아있는지 확인

---

### Phase 6: 최종 검증 및 커밋 (1시간)

**담당**: 꼼꼼이 (팀장)
**작업 내용**:

#### 6.1 전체 검증
```bash
# 1. 폴더 구조 확인
tree teams/ -L 3

# 2. 파일 개수 검증
find teams/ -name "*.md" | wc -l
# 예상: 68개 (23+34+7+4 = 68)

# 3. 링크 유효성 검사
find . -name "*.md" -exec markdown-link-check {} \;

# 4. Git 상태 확인
git status
```

#### 6.2 Git 커밋
```bash
git add teams/
git add -u  # 삭제된 파일 추적
git commit -m "refactor(structure): 팀 중심 폴더 구조로 전면 재편 (teams/)

Phase 1: 폴더 구조 생성
- teams/ 루트 생성
- 5개 팀 폴더 및 하위 구조 생성 (자비스, 김감사, 강철, 꼼꼼이, 벙커)

Phase 2: 파일 마이그레이션
- agent_work/ → teams/jarvis-dev/ (23개 파일)
- qa/ → teams/kim-qa/ (34개 파일)
- ax/ → teams/gangcheol-ax/ (7개 파일)
- 꼼꼼이 문서팀 초기 세팅 (4개 파일)
- 벙커팀 폴더 구조 준비

Phase 3: README 작성
- 5개 팀 전체 README.md 작성

Phase 4: 링크 수정
- 전체 문서 경로 업데이트
- 깨진 링크 0개 달성

Phase 5: 구폴더 정리
- agent_work/, qa/, ax/ 폴더 삭제
- 백업 생성 완료

Phase 6: 최종 검증
- 폴더 구조 확인
- 파일 개수 검증 (68개)
- 링크 유효성 100%

Breaking Changes:
- agent_work/ 폴더 → teams/jarvis-dev/로 이동
- qa/ 폴더 → teams/kim-qa/로 이동
- ax/ 폴더 → teams/gangcheol-ax/로 이동

Migration:
- 모든 팀 관련 문서는 이제 teams/ 하위에서 관리
- 팀별 README.md 참고하여 새 경로 확인

🤖 Generated with Claude Code
Co-Authored-By: 꼼꼼이 AX 문서팀 <noreply@anthropic.com>"
```

**검증 체크리스트**:
- [ ] 전체 파일 개수 일치 (68개)
- [ ] 링크 유효성 100%
- [ ] Git 커밋 성공
- [ ] 팀장님 최종 승인

---

## 🎯 예상 성과

### Before (현재)
```
agent_work/     # 혼재 (개인 + 팀)
qa/             # QA 팀만
ax/             # AX 팀만
docs/           # 공통
```
- 일관성: ❌ (각기 다른 구조)
- 확장성: ❌ (신규 팀 추가 시 혼란)
- 검색성: ⚠️ (팀별 위치 다름)

### After (목표)
```
teams/          # 모든 팀 통합
  ├── jarvis-dev/
  ├── kim-qa/
  ├── gangcheol-ax/
  ├── kkoomkkoom-docs/
  └── bunker/
docs/           # 전사 공통
```
- 일관성: ✅ (모든 팀 동일 계층)
- 확장성: ✅ (teams/new-team/ 추가만 하면 됨)
- 검색성: ✅ (teams/팀명/ 규칙)

---

## 📊 리스크 관리

### 리스크 1: 파일 이동 중 손실
**확률**: Low
**영향도**: Critical
**대응책**:
- Phase 5 시작 전 전체 백업 생성
- Git으로 모든 변경사항 추적
- 마이그레이션 스크립트 사전 테스트

### 리스크 2: 링크 깨짐
**확률**: Medium
**영향도**: High
**대응책**:
- Phase 4에서 자동 스크립트 + 수동 검증
- markdown-link-check 도구 활용
- 팀별 문서 교차 검증

### 리스크 3: 팀원 혼란
**확률**: Medium
**영향도**: Medium
**대응책**:
- 사전 공지 (3개 팀 회신서)
- README.md에 새 경로 명시
- Slack 공지 및 Q&A 세션

---

## ✅ 완료 체크리스트

### Phase 1: 폴더 구조 생성
- [ ] teams/ 루트 생성
- [ ] jarvis-dev/ 하위 구조 생성
- [ ] kim-qa/ 하위 구조 생성
- [ ] gangcheol-ax/ 하위 구조 생성
- [ ] kkoomkkoom-docs/ 하위 구조 생성
- [ ] bunker/ 하위 구조 생성

### Phase 2: 파일 마이그레이션
- [ ] 자비스 팀 23개 파일 이동
- [ ] 김감사 팀 34개 파일 이동
- [ ] 강철 팀 7개 파일 이동
- [ ] 꼼꼼이 팀 4개 파일 복사

### Phase 3: README 작성
- [ ] jarvis-dev/README.md
- [ ] kim-qa/README.md
- [ ] gangcheol-ax/README.md
- [ ] kkoomkkoom-docs/README.md
- [ ] bunker/README.md

### Phase 4: 링크 수정
- [ ] 자동 치환 스크립트 실행
- [ ] 수동 링크 검증
- [ ] 깨진 링크 0개 확인

### Phase 5: 구폴더 정리
- [ ] 백업 생성
- [ ] agent_work/ 삭제
- [ ] qa/ 삭제
- [ ] ax/ 삭제

### Phase 6: 최종 검증
- [ ] 파일 개수 확인 (68개)
- [ ] 링크 유효성 100%
- [ ] Git 커밋 성공
- [ ] 팀장님 승인

---

## 🔗 관련 문서

- [꼼꼼이 AX 문서팀 리팩토링 계획서](../planning/tasks/task_judy_workspace_refactoring.md)
- [3개 팀 공식 공지 문서](링크 추가 예정)
- [문서 표준화 가이드라인](../../teams/kkoomkkoom-docs/style-guide/)

---

## 📝 문서 변경 이력

| 버전 | 날짜 | 변경자 | 주요 변경 사항 |
|------|------|--------|----------------|
| v1.0 | 2026-02-28 | 꼼꼼이 AX 문서팀 | 최초 작성 - 팀 중심 폴더 구조 재편 Task |

---

**문서 버전**: v1.0
**작성일**: 2026-02-28
**작성자**: 꼼꼼이 (AX 문서팀 팀장)
**승인자**: 송용남 팀장