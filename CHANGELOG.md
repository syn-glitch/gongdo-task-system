# Changelog

공도 업무 관리 시스템의 모든 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
버전 관리는 Phase 단위로 구분합니다.

---

## [Phase 23] 2026-02-26 (진행 예정)
### Planned
- 칸반 보드 UI 구현 (Drag & Drop)
- 커스텀 웹 캘린더 구현
- LockService 전면 적용 (동시성 제어)
- ActionLog 시트 구축

### Decisions
- **UX 논쟁 해결**: 자비스(PO) vs 김감사(QA) 협의 완료
  - 에러 피드백: 심각도별 2단계 분기 (토스트 + 모달)
  - 모바일 뷰: 1차 스와이프 보드, 2.5차 리스트 뷰 추가

---

## [Phase 22] 2026-02-26
### Added
- 칸반 보드 & 커스텀 캘린더 기능 기획 완료
- `web_app.gs`에 `getAllTasksForWeb()` API 추가 (CacheService 5분 캐싱)
- `web_app.gs`에 `changeTaskDueDateFromWeb()` API 추가
- `logAction()` 함수 추가 (ActionLog 시트 기록)

### Changed
- 모든 쓰기 API에 LockService 적용 (`changeTaskStatusFromWeb`, `updateTaskFromWeb`, `registerTaskFromWeb`)
- 캐시 무효화 로직 추가 (`CacheService.getScriptCache().remove("ALL_TASKS_CACHE")`)

### QA
- 김감사: 칸반 & 캘린더 기능 검토 완료 (조건부 승인, 4.1/5.0)
- 자비스: UX 반대 의견 제출 및 협의

---

## [Phase 21] 2026-02-21
### Added
- ⏱️ **타임 트래킹 (Time Tracking)** 기능 Beta 배포
  - `진행중` 상태 전환 시 시작 시간 기록 (P열)
  - `완료` 상태 전환 시 종료 시간 및 소요 시간 계산 (Q열, R열)
  - 오늘의 총 몰입 시간 대시보드 표시 (관리자 전용)
- Feature Flag: 송용남, 정혜림 님만 타임 트래킹 UI 노출

### Changed
- `judy_workspace.html`: 소요 시간 뱃지 표시
- `web_app.gs:changeTaskStatusFromWeb()`: 타임 트래킹 로직 통합

---

## [Phase 20] 2026-02-22
### Added
- 🌐 **Judy Workspace (통합 SPA)** 출시
  - GNB 탭 기반 네비게이션: [📝 내 노트], [📊 내 업무]
  - 다크/라이트 테마 전환
  - 반응형 디자인 (모바일 최적화)
- `judy_workspace.html` 파일 생성 (2,390줄)

### Changed
- `web_app.gs:doGet()`: `judy_workspace` 템플릿 렌더링으로 변경
- Magic Link 인증 시 workspace로 리다이렉트

### Deprecated
- `judy_note.html` (구버전, workspace로 통합됨)
- `task_dashboard.html` (구버전, workspace로 통합됨)

---

## [Phase 11-18] 2026-02-20 ~ 2026-02-22
### Added
- ✏️ **주디 노트 수정/삭제 기능** (Phase 11)
  - Edit, Strikethrough, Delete 3가지 액션
  - 2-Phase Commit 백업 시스템
  - LockService 동시성 제어 (10초 타임아웃)
  - 단일 매칭 Regex 파서 (날짜 + 시간 + 내용)
  - File Integrity 검증
  - MemoEditLog 시트 기록
- ✨ **AI 업무 추출 (드래그 앤 드롭)** (Phase 17)
  - 텍스트 드래그 시 🐰 플로팅 버튼 표시
  - Claude API로 업무 파싱 (제목/마감일/상세)
  - 업무 등록 모달에 Pre-fill
- 📊 **웹 대시보드** (Phase 15)
  - 업무 현황 요약 카드
  - 업무 리스트 (진행 중/완료 탭)
  - 상태 변경 드롭다운

### Fixed
- 슬랙 모달 타임아웃 이슈 (Phase 14)
- AI 요약 응답 파싱 오류 (Phase 17)

### QA
- 김감사: 주디 노트 편집 기능 E2E 테스트 완료 (Full Approval, 4.7/5.0)
- 커밋: df61553

---

## [Phase 10] 2026-02-20
### Added
- 🔐 **Magic Link 인증 시스템**
  - 1회용 토큰 (CacheService 10분 유효)
  - `/주디 노트`, `/주디 내업무` 슬랙 명령어로 발급
  - `web_app.gs:validateToken()` 함수

### Security
- 토큰 일회용 처리 (사용 즉시 파기)
- 만료/재사용 방지

---

## [Phase 9] 2026-02-19
### Added
- 📝 **주디 노트 (Judy Note)** v2 출시
  - Google Drive 마크다운 아카이브
  - 날짜별/월별 폴더 구조
  - 키워드 검색 기능
  - AI 요약 기능 (`summarizeMemoContent`)
- `drive_archive.gs` 파일 생성
- `judy_note.html` 파일 생성

---

## [Phase 1-8] 2026-02-20
### Added
- ✅ Google Sheets DB 구조 (`Tasks`, `Projects`, `Users`)
- ✅ 슬랙 봇 알림 (프로젝트별 채널)
- ✅ 자동 ID 생성 (`GONG-001` 형식)
- ✅ 업무 상태 변경 감지 (onEdit 트리거)
- ✅ Google Calendar 동기화 (`calendar_sync.gs`)
- ✅ AI 리포트 (일간/주간 요약)

### Files Created
- `setup_structure.gs`
- `auto_automation.gs`
- `slack_command.gs`
- `slack_notification.gs`
- `calendar_sync.gs`
- `ai_report.gs`
- `ai_task_parser.gs`

---

## 문서 구조 개편 (2026-02-26)
### Changed
- 📂 **전체 폴더 구조 재편성**
  - 41개 Markdown 문서를 7개 카테고리로 분류
  - 12개 GAS 파일을 `src/gas/`로 이동
  - 4개 HTML 파일을 `src/frontend/`로 이동
- 📝 **파일 네이밍 규칙 표준화**
  - QA 문서: `YYYY-MM-DD_제목.md` 형식
  - 한글 파일명 → 영문 변환
- 🤖 **AI 에이전트 팀 운영 가이드 배포**
  - 의사결정 프로세스(Decision Flow) 확립
  - Fast-Track(긴급 조치) 시스템 도입
  - ActionLog 기록 의무화
  - 🎨 **신규 에이전트 합류**: 벨라(Bella, UX/UI Designer)
- 📚 **신규 문서 및 가이드 체계 구축**
  - `CHANGELOG.md` (본 파일)
  - `docs/architecture/SYSTEM_ARCHITECTURE.md`
  - `templates/` (4개 템플릿)

### Improved
- `main_task.md`: 인덱스 스타일로 간소화 (링크 중심)
- Git 커밋 메시지 규칙 확립

---

## 범례 (Legend)

- `Added`: 새로운 기능
- `Changed`: 기존 기능 변경
- `Deprecated`: 곧 제거될 기능
- `Removed`: 제거된 기능
- `Fixed`: 버그 수정
- `Security`: 보안 관련 변경
- `QA`: 품질 보증 활동
- `Decisions`: 주요 의사결정

---

**작성자**: 김감사 (QA Specialist)
**최종 수정**: 2026-02-26
