# 📊 공도 시스템 기술 부채 백로그

**문서 버전**: v1.0
**최초 작성**: 2026-02-28
**최종 업데이트**: 2026-02-28
**관리자**: 강철 (AX Team Lead)

본 문서는 공도 업무 관리 시스템의 **기술 부채(Technical Debt)** 항목을 추적하고 관리하는 백로그입니다.

---

## 📋 백로그 상태 정의

| 상태 | 설명 |
|------|------|
| 🔴 **Backlog** | 발견되었으나 아직 작업 시작 전 |
| 🟡 **In Progress** | 현재 작업 진행 중 |
| 🟢 **Completed** | 작업 완료 및 배포 완료 |
| 🔵 **Verified** | QA 검증 완료 및 효과 측정 완료 |

---

## 🚨 Priority 1: Critical (즉시 처리)

### TD-001: [보안] API 키 하드코딩 제거
- **발견 일자**: 2026-02-28
- **발견자**: 김감사 (보안 감사관)
- **심각도**: Critical
- **영향도**: 보안 침해 가능성 (API 키 노출 시 데이터 유출)
- **현재 상태**: 🔴 Backlog
- **담당자**: 보안전문가
- **예상 공수**: 4시간
- **마감일**: 2026-03-01

**상세 설명**:
현재 `slack_bot.gs` 파일에 슬랙 Webhook URL이 하드코딩되어 있음.
```javascript
var SLACK_WEBHOOK = "https://hooks.slack.com/services/T01.../B01.../abc123...";
```

**개선 방안**:
```javascript
// PropertiesService로 마이그레이션
var SLACK_WEBHOOK = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
```

**관련 문서**:
- 발견 보고서: `qa/qa_reviews/security/2026-02-28_api_key_hardcoding.md`

---

## 🔥 Priority 2: High (3일 이내 처리)

### TD-002: [성능] LockService 타임아웃 전략 개선
- **발견 일자**: 2026-02-27
- **발견자**: 김감사 (QA Team Lead)
- **심각도**: High
- **영향도**: 사용자 작업 실패 빈번 (동시성 충돌 시)
- **현재 상태**: 🔴 Backlog
- **담당자**: 성능전문가
- **예상 공수**: 6시간
- **마감일**: 2026-03-03

**상세 설명**:
현재 LockService 타임아웃이 파일마다 다름 (5초, 10초, 20초).
표준화되지 않아 예측 불가능한 에러 발생.

**개선 방안**:
1. 모든 Lock 타임아웃을 10초로 통일
2. Lock 획득 실패 시 3회 재시도 로직 추가
3. 재시도 간격 지수 백오프 (1초 → 2초 → 4초)

**관련 문서**:
- 발견 보고서: `qa/qa_reviews/2026-02-27_lockservice_timeout_issue.md`

---

### TD-003: [성능] CacheService 캐싱 전략 부재
- **발견 일자**: 2026-02-28
- **발견자**: 성능전문가
- **심각도**: High
- **영향도**: 페이지 로드 3-5초 소요 (목표: 1초 이내)
- **현재 상태**: 🔴 Backlog
- **담당자**: 성능전문가
- **예상 공수**: 8시간
- **마감일**: ~~2026-03-03~~ → **2026-03-10** (김감사 QA 피드백 반영: 성능전문가 과부하 방지)

**상세 설명**:
시트 읽기 작업이 매번 실행되어 페이지 로드가 느림.
캐싱 전략이 없어 불필요한 시트 읽기 반복.

**개선 방안**:
1. 프로젝트 목록: 5분 캐싱
2. 사용자 설정: 10분 캐싱
3. 업무 리스트: 1분 캐싱
4. 캐시 무효화 트리거 정의

**관련 문서**:
- 분석 보고서: `ax/performance/2026-02-28_cache_strategy_analysis.md`

---

## 📊 Priority 3: Medium (2주 이내 처리)

### TD-004: [리팩토링] judy_note.gs 함수 복잡도 개선
- **발견 일자**: 2026-02-26
- **발견자**: 자비스 (PO)
- **심각도**: Medium
- **영향도**: 신규 개발자 온보딩 어려움, 버그 발생 위험
- **현재 상태**: 🔴 Backlog
- **담당자**: 리팩터
- **예상 공수**: 10시간
- **마감일**: 2026-03-14

**상세 설명**:
`judy_note.gs`의 `createNote()` 함수가 150줄, Cyclomatic Complexity 18.
단일 책임 원칙 위반 (CRUD + AI 요약 + 캐시 관리 혼재).

**개선 방안**:
1. `createNote()` → `createNoteCore()` + `summarizeNoteContent()` + `invalidateNoteCache()` 분리
2. 유효성 검증 로직 → `validateNoteInput()` 함수로 추출
3. 에러 핸들링 로직 → `handleNoteError()` 함수로 추출

**관련 문서**:
- 분석 보고서: `ax/refactoring/2026-02-28_judy_note_refactor_analysis.md`

---

### TD-005: [리팩토링] 중복 코드 제거 (시트 읽기 로직)
- **발견 일자**: 2026-02-28
- **발견자**: 리팩터
- **심각도**: Medium
- **영향도**: 코드 중복으로 버그 수정 시 누락 가능성
- **현재 상태**: 🔴 Backlog
- **담당자**: 리팩터
- **예상 공수**: 4시간
- **마감일**: 2026-03-14

**상세 설명**:
시트 읽기 로직이 8개 파일에 중복 (120줄 이상).
```javascript
var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Tasks');
var data = sheet.getDataRange().getValues();
var headers = data[0];
// ... 반복되는 로직
```

**개선 방안**:
공통 유틸리티 함수 생성
```javascript
// utils.gs
function getSheetData(sheetName) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();
  return {
    headers: data[0],
    rows: data.slice(1)
  };
}
```

**관련 문서**:
- 분석 보고서: `ax/refactoring/2026-02-28_duplicate_code_analysis.md`

---

## 🔵 Priority 4: Low (1개월 이내 처리)

### TD-006: [문서] 코드 주석 개선 (한글화 미완료)
- **발견 일자**: 2026-02-28
- **발견자**: 강철 (AX Team Lead)
- **심각도**: Low
- **영향도**: 가독성 저하, 비전공자 이해 어려움
- **현재 상태**: 🔴 Backlog
- **담당자**: 리팩터
- **예상 공수**: 6시간
- **마감일**: 2026-03-28

**상세 설명**:
일부 파일에 영문 주석 잔존 (AI 에이전트 팀 규칙 v2.0 위반).
```javascript
// Fetch tasks from sheet (X)
// 시트에서 업무 목록 가져오기 (O)
```

**개선 방안**:
전체 파일 스캔 후 영문 주석 → 한글 주석 변환.

---

### TD-007: [문서] Magic Number 상수화
- **발견 일자**: 2026-02-28
- **발견자**: 리팩터
- **심각도**: Low
- **영향도**: 유지보수 시 혼란 가능성
- **현재 상태**: 🔴 Backlog
- **담당자**: 리팩터
- **예상 공수**: 3시간
- **마감일**: 2026-03-28

**상세 설명**:
코드 내 Magic Number 산재 (예: `5000`, `10000`, `300`).
```javascript
lock.waitLock(10000); // 10초인지 10000밀리초인지 불명확
```

**개선 방안**:
상수로 정의
```javascript
var LOCK_TIMEOUT_MS = 10 * 1000; // 10초
lock.waitLock(LOCK_TIMEOUT_MS);
```

---

## 📈 완료된 기술 부채

### ✅ TD-000: [예시] 드래그 앤 드롭 터치 이벤트 버그 수정
- **발견 일자**: 2026-02-26
- **해결 일자**: 2026-02-27
- **담당자**: 클로이 (Frontend)
- **실제 공수**: 1시간
- **효과**: 모바일 사용자 경험 100% 개선
- **상태**: 🔵 Verified

**상세 설명**:
모바일에서 카드 드래그 시 페이지 스크롤 발생.
`preventDefault()` 추가로 해결.

**관련 문서**:
- 수정 기록: `docs/troubleshooting/2026-02-27_judy_drag_drop_debugging.md`
- QA 검증: `qa/qa_reviews/2026-02-27_judy_drag_drop_final_fix.md`

---

## 📊 통계 요약

**전체 백로그**: 7건
- 🔴 Critical: 1건
- 🔥 High: 2건
- 📊 Medium: 2건
- 🔵 Low: 2건

**완료된 항목**: 1건

**목표**:
- Critical/High → 3일 이내 해결률 100%
- Medium → 2주 이내 해결률 80%
- Low → 1개월 이내 해결률 70%

---

## 📋 추가 요청 방법

### 김감사 QA 팀 → 강철 AX 팀
QA 리뷰 중 구조적 개선이 필요한 항목 발견 시:
```markdown
제목: [TD 요청] LockService 타임아웃 전략 개선
심각도: High
발견자: 김감사 (QA Team Lead)
발견 일자: 2026-02-27
상세 설명: (내용)
```

### 자비스 개발 팀 → 강철 AX 팀
개발 중 레거시 코드 리팩토링 필요 시:
```markdown
제목: [TD 요청] judy_note.gs 함수 복잡도 개선
심각도: Medium
발견자: 자비스 (PO)
발견 일자: 2026-02-26
상세 설명: (내용)
```

---

**관리 원칙**:
- 모든 기술 부채는 이 문서에 등록
- 주 1회 백로그 검토 회의 (금요일 오후)
- 완료된 항목은 효과 측정 후 Verified 상태로 변경

---

> "기술 부채는 보이지 않는 적입니다. 우리는 그것을 가시화하고 제거합니다." - 강철 AX 팀
