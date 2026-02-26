# [QA_검토] 칸반 보드 & 커스텀 캘린더 통합 기능

**검토자**: 김감사 (QA Specialist)
**요청자**: 자비스 (PO), 팀장
**검토 대상**: `implementation_plan_kanban_calendar.md`, `task_kanban_calendar.md`
**검토 날짜**: 2026-02-26
**검토 상태**: 🟡 **조건부 승인 (Conditional Approval)**

---

## 📊 종합 평가 (Overall Rating)

| 평가 항목 | 점수 | 비고 |
|:---|:---:|:---|
| **기획 완성도** | ★★★★☆ (4.0/5.0) | 컨셉과 목표가 명확하고 현실적 |
| **UX/UI 설계** | ★★★★☆ (4.0/5.0) | 직관적이나 모바일 최적화 필요 |
| **기술 아키텍처** | ★★★☆☆ (3.5/5.0) | Optimistic UI 전략은 우수하나 동시성 이슈 보완 필요 |
| **리스크 관리** | ★★★★☆ (4.0/5.0) | 주요 리스크를 식별했으나 구체적 방어 로직 미흡 |
| **구현 가능성** | ★★★★★ (5.0/5.0) | 기존 인프라로 100% 구현 가능 |
| **전체 평균** | **★★★★☆ (4.1/5.0)** | 우수한 기획이나 5가지 필수 조건 충족 시 승인 |

---

## ✅ 1. 기획 측면 검토 (Planning Review)

### 🟢 강점 (Strengths)

1. **"시트 우선(Sheets First)" 아키텍처 철학이 명확함**
   - "구글 캘린더는 도구일 뿐, 데이터의 주인은 구글 시트다" → 단일 진실 공급원(Single Source of Truth) 원칙 준수
   - 기존 `calendar_sync.gs` 인프라를 재활용하여 중복 구현 없음
   - 데이터 무결성 측면에서 매우 안전한 설계

2. **SPA 탭 기반 유기적 전환 전략**
   - 기존 [📌 업무], [📝 노트] 탭과 자연스럽게 통합
   - [📅 스케줄/칸반] 탭 내부에서 보드/달력 토글 → 사용자 학습 비용 최소화
   - GNB 구조가 이미 `judy_workspace.html`에 구축되어 있어 퍼블리싱 공수 절감

3. **현실적인 개발 견적**
   - 10~14 영업일 (약 2주) → 에이전트 협업 구조를 고려하면 충분히 달성 가능
   - 난이도를 "상"으로 정직하게 평가 → 예상치 못한 지연 리스크를 사전에 인지

### 🟡 우려 사항 (Concerns)

1. **"전체 업무 데이터 반환" API의 성능 병목 가능성**
   - 현재 `getMyTasksForWeb()` 함수(web_app.gs:242)는 `for` 루프로 Tasks 시트 전체를 순회 (O(n) 복잡도)
   - 팀원 5명, 월 평균 업무 200건 가정 시 **1,000건 이상의 데이터를 매번 전부 읽게 됨**
   - GAS의 Spreadsheet API는 `getDataRange()`가 느리므로 응답 시간 3~5초 발생 가능
   - **권장**: `CacheService`로 5분 캐싱 + 증분 업데이트(Incremental Update) 패턴 도입

2. **드래그 앤 드롭 시 동시성 충돌 방어 로직 누락**
   - 사용자 A가 업무 X를 "진행중"으로 드래그하는 찰나에, 사용자 B가 동일 업무를 "완료"로 변경 시 **Last-Write-Wins 문제** 발생
   - 주디 노트 수정 기능(commit df61553)에서는 `LockService`로 해결했으나, 본 기획서에는 동시성 제어 언급 없음
   - **권장**: `changeTaskStatusFromWeb()` 및 `changeTaskDueDateFromWeb()` 함수에 `LockService.getUserLock()` 도입 필수

3. **ActionLog 시트의 스키마(Schema) 및 용도 불명확**
   - "모든 이동 직후 로그를 남겨 유실 방지" → 구체적으로 어떤 컬럼(User, TaskID, Action, OldValue, NewValue, Timestamp)을 기록할지 명세 필요
   - 로그 용도가 단순 감사(Audit)인지, Undo 기능 지원인지, 아니면 충돌 해결(Conflict Resolution) 용도인지 불분명
   - **권장**: 로그 스키마를 백엔드 구현 전에 확정하고, 최소 7일치 보관 정책 수립

---

## 🎨 2. UX/UI 설계 검토 (UX/UI Design Review)

### 🟢 강점 (Strengths)

1. **칸반 보드 3컬럼 구조 (대기/진행/완료)가 GTD(Getting Things Done) 방법론과 정합**
   - 팀원들의 기존 업무 흐름과 일치 (Tasks 시트의 '상태' 컬럼 기준)
   - 시각적 직관성이 뛰어나 온보딩 비용 낮음

2. **Optimistic UI 전략 채택이 탁월함**
   - GAS 응답 1~2초 대기를 사용자가 체감하지 않도록 선반영 후 검증
   - 실패 시 롤백 로직 명시 → 데이터 정합성 유지

3. **모바일 터치 이벤트 대응 계획 포함**
   - "롱탭 후 이동" 인터랙션 고려 → 모바일 UX 연구가 선행됨을 확인

### 🔴 위험 요소 (Risk Factors)

1. **"Optimistic UI 실패 시 롤백" 로직의 UX 혼란 우려 ⚠️**
   - 사용자가 카드를 "완료" 컬럼으로 드래그 → 즉시 UI에서 이동됨 → 2초 후 서버가 `ERR_LOCK_TIMEOUT` 반환 → 카드가 다시 원래 컬럼으로 "툭" 하고 튀어나옴
   - 이 현상이 반복되면 사용자는 **"버그가 있다"고 인지**할 가능성 높음
   - **해결책**: 롤백 시 단순히 UI를 되돌리는 것이 아니라, **가운데 모달로 "다른 사용자가 수정 중입니다. 3초 후 재시도하시겠습니까?"** 명확한 피드백 제공 필수

2. **모바일 화면에서 칸반 3컬럼 동시 표시 불가 (iPhone SE 기준 가로 375px)**
   - 컬럼당 최소 200px 필요 시 600px 이상 필요 → 모바일에서는 가로 스크롤 발생
   - 제안하신 "1열씩 스와이프"도 좋지만, 더 나은 대안: **모바일에서는 자동으로 "리스트 뷰"로 전환하고, 각 카드에 상태 드롭다운 제공**
   - `CSS @media (max-width: 768px)` 조건으로 뷰를 아예 변경하는 것이 사용성 측면에서 유리

3. **드래그 중 시각적 피드백 (Visual Feedback) 명세 누락**
   - 카드를 집었을 때 약간 확대(Scale 1.05) + 그림자(Box Shadow) 효과
   - 드롭 가능한 영역에 점선 테두리 또는 배경색 변화
   - 드롭 불가능한 영역에서는 마우스 커서를 `not-allowed`로 변경
   - **권장**: [김감사_최종승인]_주디노트_수정기능_v1.md 에서 삭제 버튼에 2단계 컨펌 모달을 요구했던 것처럼, **드래그 인터랙션도 시각적 상태 전환 명세서를 작성**하여 클로이에게 전달

---

## 💻 3. 코드 개발 계획 검토 (Code Development Review)

### 🟢 기존 인프라 재사용성 (Infrastructure Reusability)

| 기능 | 기존 코드 | 재사용 가능 여부 | 비고 |
|:---|:---|:---:|:---|
| 상태 변경 API | `web_app.gs:changeTaskStatusFromWeb()` (313줄) | ✅ 100% 재사용 가능 | 이미 타임 트래킹(Phase 21) 로직 포함 |
| 캘린더 동기화 | `calendar_sync.gs:syncCalendarEvent()` (27줄) | ✅ 100% 재사용 가능 | 마감일 변경 시 자동 트리거 작동 |
| 토큰 인증 | `web_app.gs:validateToken()` (30줄) | ✅ 100% 재사용 가능 | Magic Link 10분 유효 |
| 업무 목록 조회 | `web_app.gs:getMyTasksForWeb()` (242줄) | ⚠️ 50% 수정 필요 | 현재는 "내 업무"만 반환, 팀 전체 필터 추가 필요 |

### 🔴 신규 개발 필요 항목 (New Development Required)

#### **Phase 1: 백엔드 API (에이다 & 허밋) - 예상 3~4일**

1. **`getAllTasksForWeb(userId, filterOptions)` 신규 API 구현**
   ```javascript
   /**
    * filterOptions 예시:
    * {
    *   assignee: "syn" | "all",  // 담당자 필터
    *   status: ["대기", "진행중"] | "all",  // 상태 필터 (완료 제외 가능)
    *   project: "GONG" | "all"   // 프로젝트 필터
    * }
    */
   function getAllTasksForWeb(userId, filterOptions) {
     // ⚠️ 주의: Tasks 시트 1000건 이상일 때 getDataRange() 성능 병목
     // 해결: CacheService 5분 캐싱 + 마지막 수정일(N열) 기준 증분 조회
   }
   ```
   - **필수**: `CacheService.getScriptCache()` 5분 캐싱 적용 (주디 노트 수정 기능의 `getProjectOptions()` 참고)
   - **필수**: `LockService` 적용하여 동시 조회 시 데이터 무결성 보장

2. **`changeTaskDueDateFromWeb(rowNum, newDueDate)` 신규 API 구현**
   ```javascript
   function changeTaskDueDateFromWeb(rowNum, newDueDate) {
     const lock = LockService.getUserLock();
     try {
       if (!lock.tryLock(10000)) {
         return { success: false, errorCode: "ERR_LOCK_TIMEOUT", message: "다른 작업 진행 중" };
       }

       const sheet = ss.getSheetByName("Tasks");
       sheet.getRange(rowNum, 9).setValue(new Date(newDueDate)); // I열: 마감일
       sheet.getRange(rowNum, 14).setValue(new Date()); // N열: 수정일

       // ✅ calendar_sync.gs의 syncCalendarEvent()가 자동 호출됨 (onEdit 트리거)
       return { success: true };
     } finally {
       lock.releaseLock();
     }
   }
   ```
   - **주의**: `onEdit` 트리거는 웹 API 호출 시 자동 작동하지 않으므로, `calendar_sync.gs:syncCalendarEvent(sheet, rowNum)`을 **명시적으로 호출** 필요

3. **`ActionLog` 시트 생성 및 로그 함수 구축**
   ```javascript
   function logUserAction(userName, actionType, taskId, oldValue, newValue) {
     try {
       let logSheet = ss.getSheetByName("ActionLog");
       if (!logSheet) {
         logSheet = ss.insertSheet("ActionLog");
         logSheet.appendRow(["Timestamp", "User", "Action", "TaskID", "OldValue", "NewValue"]);
       }

       const timestamp = new Date();
       logSheet.appendRow([timestamp, userName, actionType, taskId, oldValue, newValue]);
     } catch (e) {
       console.error("ActionLog 기록 실패:", e);
     }
   }
   ```
   - **용도 명확화 필요**: 단순 감사(Audit)인지, Undo 기능인지 결정 후 스키마 확정

#### **Phase 2: 칸반 보드 UI (클로이) - 예상 4~5일**

**HTML 구조 예시**:
```html
<div id="kanbanBoard" class="kanban-container">
  <div class="kanban-column" data-status="대기">
    <div class="kanban-header">대기 (5)</div>
    <div class="kanban-cards" id="column-waiting"></div>
  </div>
  <div class="kanban-column" data-status="진행중">
    <div class="kanban-header">진행중 (3)</div>
    <div class="kanban-cards" id="column-inprogress"></div>
  </div>
  <div class="kanban-column" data-status="완료">
    <div class="kanban-header">완료 (12)</div>
    <div class="kanban-cards" id="column-done"></div>
  </div>
</div>
```

**드래그 앤 드롭 로직 (Optimistic UI with Rollback)**:
```javascript
let draggedCard = null;
let originalColumn = null;

function onCardDragStart(event) {
  draggedCard = event.target;
  originalColumn = draggedCard.parentElement;
  draggedCard.classList.add('dragging'); // 투명도 50%
}

function onColumnDrop(event, newStatus) {
  event.preventDefault();

  const taskRow = draggedCard.dataset.row;
  const oldStatus = draggedCard.dataset.status;

  // 1. Optimistic UI: 즉시 카드 이동
  event.target.closest('.kanban-cards').appendChild(draggedCard);
  draggedCard.dataset.status = newStatus;
  draggedCard.classList.remove('dragging');

  // 2. 백엔드 API 호출
  google.script.run
    .withSuccessHandler(() => {
      showToast(`✅ 업무 상태가 ${newStatus}로 변경되었습니다.`);
    })
    .withFailureHandler((error) => {
      // 3. 실패 시 롤백 + 명확한 에러 메시지
      originalColumn.appendChild(draggedCard);
      draggedCard.dataset.status = oldStatus;

      if (error.message.includes("LOCK_TIMEOUT")) {
        showErrorModal("다른 사용자가 이 업무를 수정 중입니다. 3초 후 다시 시도하시겠습니까?");
      } else {
        showToast(`❌ 오류: ${error.message}`);
      }
    })
    .changeTaskStatusFromWeb(taskRow, newStatus);
}
```

**⚠️ 김감사 강력 권고 사항**:
- 롤백 시 단순 토스트가 아닌 **가운데 모달(Modal)로 에러 원인과 재시도 옵션 제공**
- 카드 이동 중 로딩 스피너를 카드 우측 상단에 표시하여 "서버 통신 중"임을 명시

#### **Phase 3: 웹 캘린더 UI (클로이 & 자비스) - 예상 5~6일**

**외부 라이브러리 사용 여부 결정 필요**:
- **옵션 A**: 순수 JS로 자체 구현 → 가볍지만 날짜 계산 버그 위험 (윤년, 타임존)
- **옵션 B**: [FullCalendar.io](https://fullcalendar.io/) 무료 버전 사용 → 검증된 라이브러리지만 107KB 용량
- **김감사 추천**: **옵션 B (FullCalendar 무료 버전)** → 이유: 타임존, 윤년, DST(Daylight Saving Time) 처리를 직접 구현하면 버그 발생 확률 30% 이상

**날짜 드래그 이동 로직**:
```javascript
// FullCalendar 이벤트 드롭 핸들러
calendar.on('eventDrop', function(info) {
  const taskRow = info.event.extendedProps.rowNum;
  const newDueDate = info.event.start; // Date 객체

  // Optimistic UI: FullCalendar가 자동으로 화면 업데이트 완료

  google.script.run
    .withSuccessHandler(() => {
      showToast(`✅ 마감일이 ${formatDate(newDueDate)}로 변경되었습니다.`);
    })
    .withFailureHandler((error) => {
      // 롤백: FullCalendar API 사용
      info.revert(); // 이벤트를 원래 날짜로 되돌림
      showErrorModal(`날짜 변경 실패: ${error.message}`);
    })
    .changeTaskDueDateFromWeb(taskRow, newDueDate.toISOString().split('T')[0]);
});
```

**⚠️ 김감사 강력 권고 사항**:
- **타임존 이슈 방어**: GAS의 `Session.getScriptTimeZone()`이 'Asia/Seoul'로 설정되어 있는지 확인
- **날짜 경계 드래그 검증**: 2월 29일(윤년) → 3월 1일로 넘어갈 때 날짜 계산 오류 QA 필수

---

## 🚨 4. 리스크 관리 및 대응 전략 (Risk Management)

| # | 리스크 항목 | 발생 확률 | 영향도 | 자비스 제안 대책 | 김감사 보완 대책 |
|:---:|:---|:---:|:---:|:---|:---|
| 1 | **GAS 1~2초 레이턴시** | 🔴 90% | 🟡 중 | Optimistic UI 적용 | ✅ 우수함. 추가로 로딩 스피너 표시 권장 |
| 2 | **모바일 칸반 가시성** | 🟡 70% | 🟠 중상 | 1열씩 스와이프 뷰 | ⚠️ 대안: 모바일은 리스트 뷰로 자동 전환 권장 |
| 3 | **드래그 중 데이터 유실** | 🟢 15% | 🔴 상 | ActionLog 시트 기록 | ⚠️ ActionLog만으로 부족. **LockService 필수 도입** |
| 4 | **동시 수정 충돌** | 🟡 30% | 🔴 상 | (언급 없음) | 🔴 **위험**: LockService 즉시 적용 필수 |
| 5 | **타임존 계산 오류** | 🟡 40% | 🟠 중상 | (언급 없음) | 🔴 **위험**: FullCalendar 라이브러리 사용 강력 권장 |

### 🔴 추가 식별된 리스크 (Newly Identified Risks)

#### **리스크 A: Tasks 시트 1000건 이상 시 성능 급락 ⚠️**
- **현상**: `getDataRange().getValues()`는 O(n) 시간 복잡도로 1000건 이상일 때 5~8초 소요
- **대책**:
  1. `CacheService` 5분 캐싱 적용 (첫 조회만 느림)
  2. 증분 업데이트: 마지막 조회 이후 수정된 행만 갱신 (N열: 최근 수정일 활용)
  3. 페이지네이션: 최근 30일 데이터만 로드, "더보기" 버튼으로 과거 데이터 추가 로드

#### **리스크 B: 드래그 도중 브라우저 강제 종료 시 데이터 불일치**
- **현상**: 사용자가 카드를 드래그 중 브라우저 탭을 닫으면 Optimistic UI는 반영되었지만 서버 통신 미완료
- **대책**:
  1. `window.onbeforeunload` 이벤트로 "진행 중인 작업이 있습니다" 경고 표시
  2. 페이지 재진입 시 서버 데이터를 다시 조회하여 UI 동기화

#### **리스크 C: 캘린더 이벤트 중복 생성 (Calendar Event Duplication)**
- **현상**: 사용자가 웹에서 마감일 변경 → `changeTaskDueDateFromWeb()` 호출 → `syncCalendarEvent()` 수동 호출 → 동시에 `onEdit` 트리거도 작동 → 구글 캘린더에 동일 일정 2개 생성
- **대책**:
  1. `calendar_sync.gs`에서 캘린더 ID(M열) 확인 후 기존 이벤트 업데이트만 수행
  2. 또는 `changeTaskDueDateFromWeb()` 함수에서 `syncCalendarEvent()` 호출 시 `skipTrigger: true` 플래그 전달

---

## 🎯 5. 최종 의사 결정 및 조건부 승인 (Final Decision)

### ✅ 승인 결정 (Approval with Conditions)

**결론**: 본 기획안은 전략적으로 우수하며, 기술적으로도 충분히 구현 가능하나, 아래 **5가지 필수 조건**을 모두 충족한 후 개발 착수를 승인합니다.

---

## 🛑 필수 조건 5가지 (5 Mandatory Conditions)

### 조건 1: 동시성 제어 (Concurrency Control) - LockService 전면 도입 ⚠️
**담당**: 에이다 & 허밋
**기한**: Phase 1 백엔드 개발 시작 전 (D+0)
**요구사항**:
- `changeTaskStatusFromWeb()`, `changeTaskDueDateFromWeb()`, `getAllTasksForWeb()`에 `LockService.getUserLock()` 적용
- 10초 타임아웃 설정 및 `ERR_LOCK_TIMEOUT` 에러 코드 반환
- 주디 노트 수정 기능(commit df61553)의 `safeUpdateArchivedMemo()` 구조 참고

**검증 방법**: 2명의 사용자가 동시에 같은 업무를 드래그할 때, 한 명은 성공하고 다른 한 명은 "다른 작업 진행 중" 토스트 메시지 확인

---

### 조건 2: Optimistic UI 실패 시 명확한 에러 모달 제공 🔴
**담당**: 클로이
**기한**: Phase 2 칸반 보드 개발 중 (D+4)
**요구사항**:
- 롤백 시 토스트가 아닌 **가운데 모달 팝업** 표시
- 모달 내용: "다른 사용자가 이 업무를 수정 중입니다. 3초 후 다시 시도하시겠습니까?" + [재시도] [취소] 버튼
- [재시도] 클릭 시 동일 API 재호출

**검증 방법**: 동시성 충돌 상황을 의도적으로 발생시켜 모달 팝업 확인

---

### 조건 3: ActionLog 시트 스키마 및 용도 확정 📋
**담당**: 자비스 (PO) + 에이다 (개발)
**기한**: Phase 1 시작 전 (D+0)
**요구사항**:
- ActionLog 컬럼 구조 확정: `[Timestamp, User, Action, TaskID, OldValue, NewValue, ErrorCode]`
- 로그 용도 명시: 감사(Audit) 전용 / Undo 기능 지원 / 충돌 해결 용도 중 선택
- 최소 7일치 로그 보관 정책 수립

**검증 방법**: 카드를 10번 드래그한 후 ActionLog 시트에 10개의 행이 정확히 기록되었는지 확인

---

### 조건 4: 모바일 UX 최적화 - 반응형 뷰 전환 📱
**담당**: 클로이 + 자비스 (UX 검토)
**기한**: Phase 2~3 개발 중 (D+7)
**요구사항**:
- `@media (max-width: 768px)` 조건에서 칸반 보드를 **리스트 뷰로 자동 전환**
- 각 카드에 상태 드롭다운 제공 (대기/진행중/완료)
- 캘린더는 모바일에서 "주간 뷰"만 제공 (월간 뷰는 가시성 불량)

**검증 방법**: iPhone SE (375px), Galaxy S10 (360px) 해상도에서 실제 테스트

---

### 조건 5: 캘린더 라이브러리 선택 및 타임존 검증 🌍
**담당**: 클로이
**기한**: Phase 3 시작 전 (D+8)
**요구사항**:
- FullCalendar.io 무료 버전 도입 (또는 동급 검증된 라이브러리)
- GAS 스크립트 속성에서 `Session.getScriptTimeZone() === 'Asia/Seoul'` 확인
- 윤년(2월 29일 → 3월 1일) 날짜 드래그 테스트 케이스 작성

**검증 방법**: 2024년 2월 29일에 업무를 드래그하여 3월 1일로 이동 시 정확히 1일 증가 확인

---

## 📝 6. 김감사 추가 권장 사항 (Additional Recommendations)

### 권장 1: Feature Flag로 단계별 출시 (Staged Rollout) 🚩
- Phase 2 완료 후 칸반 보드만 먼저 배포 (송용남, 정혜림에게만 노출)
- 1주일 베타 테스트 후 문제 없으면 Phase 3 캘린더 기능 추가

### 권장 2: 드래그 성능 벤치마크 기준 수립 ⏱️
- 카드 드래그 시작 → UI 반영까지 **100ms 이내** (Optimistic UI)
- 백엔드 API 응답 → 최종 확정까지 **2초 이내** (GAS 한계 고려)
- 2초 초과 시 "서버 응답 지연 중..." 로딩 메시지 표시

### 권장 3: E2E 테스트 시나리오 사전 작성 ✅
Phase 4 통합 테스트 전에 아래 시나리오를 김감사에게 전달 요청:
1. ✅ 칸반: 카드 드래그 성공 케이스 (대기 → 진행중 → 완료)
2. ❌ 칸반: 동시성 충돌 케이스 (2명이 동시에 같은 카드 드래그)
3. ✅ 캘린더: 날짜 드래그 성공 케이스 (2/26 → 3/1)
4. ❌ 캘린더: 타임존 오류 케이스 (UTC 0시 vs KST 9시 차이)
5. ✅ 통합: 칸반에서 상태 변경 → Tasks 시트 → 구글 캘린더 앱 반영 확인

---

## 🎬 7. 다음 액션 플랜 (Next Steps)

### 자비스 팀장 → 김감사
- [ ] 위 5가지 필수 조건에 대한 수용 여부 회신 (`[자비스_회신]_칸반_캘린더_필수조건.md` 파일 생성)
- [ ] ActionLog 스키마 최종안 제출 (D+0)
- [ ] 모바일 반응형 뷰 전환 UX 와이어프레임 제출 (D+3)

### 에이다 & 허밋 (백엔드)
- [ ] LockService 적용된 API 3종 개발 완료 (D+4)
- [ ] 100건 더미 데이터로 성능 테스트 (응답 시간 3초 이하 검증)

### 클로이 (프론트엔드)
- [ ] 칸반 보드 HTML/CSS 퍼블리싱 완료 (D+7)
- [ ] FullCalendar.io 라이브러리 통합 (D+10)
- [ ] 모바일 반응형 CSS 적용 (D+12)

### 김감사 (QA)
- [ ] Phase 2 완료 시 칸반 보드 E2E 테스트 (D+8)
- [ ] Phase 3 완료 시 캘린더 통합 테스트 (D+13)
- [ ] 최종 승인 문서 발행 (`[QA_최종승인]_칸반_캘린더_v1.md`)

---

## 📌 최종 요약 (Summary)

**기획의 핵심 강점**:
- "시트 우선" 아키텍처가 명확하고 안전함
- Optimistic UI 전략으로 UX 레이턴시 해결
- 기존 인프라(calendar_sync.gs, changeTaskStatusFromWeb) 재사용으로 개발 공수 절감

**주요 위험 요소**:
- 동시성 제어 누락 (LockService 미적용)
- Optimistic UI 롤백 시 사용자 혼란 가능성
- 모바일 칸반 가시성 문제

**김감사 최종 결론**:
> **"5가지 필수 조건을 모두 충족하면 즉시 개발 착수 승인. 주디 노트 수정 기능(commit df61553)에서 보여준 LockService + 2-Phase Commit 수준의 안전장치를 이번에도 동일하게 적용한다면, 공도 팀의 업무 생산성을 혁신적으로 끌어올릴 수 있는 킬러 피처가 될 것입니다. 자비스 팀장과 개발진의 역량을 신뢰하며, 성공적인 배포를 기대합니다."**

---

**검토 완료일**: 2026-02-26
**검토자**: 김감사 (QA Specialist)
**다음 문서**: `[자비스_회신]_칸반_캘린더_필수조건.md` (자비스 팀장 작성 예정)
