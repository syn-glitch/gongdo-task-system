# [김감사_QA리포트] 메모 박스 업무 등록(Add Task) 버그 원인 분석 및 핫픽스 방안

**작성자**: 김감사 (QA), 자비스 (PO)
**날짜**: 2026-02-26
**대상 파일**: `src/frontend/judy_workspace.html`
**이슈 종류**: 🔴 긴급 버그 (Fast-Track 적용)

---

## 🔍 에러 원인 분석 (Root Cause)

팀장님께서 보고하신 **"메모 박스에서 텍스트를 선택한 후 Add Task 버튼(📋)을 눌렀을 때, 선택된 텍스트가 미리 채워지지 않는 문제"**를 분석했습니다.

1. **현재 로직의 한계**:
   `judy_workspace.html` 내 `createMemoBlock` 함수의 `btnAddTask` 이벤트 핸들러(2876라인 부근)에서는 Add Task 버튼을 클릭하면 메모의 전체 내용(`currentContent`)을 기반으로 폼 모달을 열도록만 하드코딩되어 있습니다. 사용자가 드래그하여 선택한 텍스트를 인식하는 로직이 누락되어 있습니다.

2. **이벤트에 의한 선택 영역 유실 현상**:
   사용자가 텍스트를 드래그한 상태에서 버튼을 `click`하는 순간 화면 포커스가 버튼으로 이동하면서 브라우저 기본 동작에 의해 기존의 텍스트 선택 영역(`window.getSelection()`)이 초기화되거나 유실되고 맙니다.

---

## 🛠 해결 방안 (Hotfix Plan)

이 문제를 빠르게 해결하기 위해 다음과 같이 Hotfix 코드를 반영하겠습니다 (Fast-Track).

### 수정 사항 (`src/frontend/judy_workspace.html`)

1. **mousedown 이벤트 처리 추가 (`preventDefault`)**:
   `btnAddTask`에 `mousedown` 이벤트를 추가하고 `e.preventDefault()`를 호출하여, 버튼을 클릭하는 순간 메모의 텍스트 선택(Selection)이 강제 해제되는 것을 방지합니다.

2. **클릭 로직 분기 개선**:
   `btnAddTask.addEventListener('click', ...)` 내부 로직을 다음과 같이 개선합니다.
   - `window.getSelection().toString().trim()`을 사용해 사용자가 선택한 텍스트가 존재하는지 먼저 확인
   - **선택된 텍스트가 있다면** 👉 즉시 그 텍스트를 `openRegModal`에 전달
   - **없다면** 👉 기존대로 메모의 전체 텍스트(`cleanContent`)를 전달

---

## ✅ 진행 상황
- QA 분석 완료
- 잠시 후 `judy_workspace.html` 파일에 Hotfix 코드를 직접 수정하겠습니다!
