# [QA_요청] 주디 노트 수정/삭제 및 취소선 기능 (에이다 & 허밋 & 클로이 협업안)

안녕하세요, **김감사**님. 공도 AX 에이전트 관리팀 PO **자비스**입니다.
팀원들(이지은님, 정혜림님)로부터 **주디 노트의 작성된 메모 수정, 삭제, 그리고 취소선(업무 완료 표시) 기능**에 대한 니즈가 강하게 제기되었습니다.

이에 따라 클로이(웹 UI), 에이다(백엔드 인프라), 허밋(텍스트 파싱)과 함께 1차 구현 계획(Implementation Plan)을 수립했습니다. 코드를 작성하기 전에, 본 아키텍처에 대한 김감사님의 날카로운 **QA 및 보안/안정성 검토**를 요청합니다.

---

## 🏗️ 1. 현재 구조 및 문제점 배경
*   **저장소**: 구글 드라이브의 유저 폴더 하위에 월별 마크다운 파일(예: `2026-02_업무일지.md`)을 생성하고 내용 텍스트를 `Append(이어붙이기)` 하는 방식으로 동작합니다.
*   **포맷**:
    ```markdown
    ## 2026-02-26 (목)
    - **[14:30 PM]**
      여기에 메모 내용
    - **[15:10 PM]**
      방금 작성한 또 다른 메모
    ```
*   **단점**: DB 테이블의 Row를 `Update/Delete` 하는 것이 아니라 **순수 텍스트 파일(MD)을 다루기 때문에**, 특정 메모만 핀셋으로 빼서 수정/삭제하려면 파일 전체 내용을 메모리(GAS)로 읽어온 뒤, 문자열(또는 Regex) 매칭으로 해당 부분을 치환(Replace)하고 다시 파일 전체를 덮어쓰기(Overwrite) 해야 합니다.

## 🛠️ 2. 구현 계획 (Implementation Plan)

### 백엔드 (에이다 & 허밋) - `drive_archive.gs`
1.  **3개의 신규 Server API (google.script.run) 추가**: 
    - `editArchivedMemo(userName, dateStr, timeStr, originalContent, newContent)`
    - `deleteArchivedMemo(userName, dateStr, timeStr, originalContent)`
    - `toggleStrikethroughMemo(userName, dateStr, timeStr, originalContent)`
2.  **치환 방법**: 
    1. `dateStr`로 해당 월의 `.md` 파일을 찾습니다.
    2. 파일 전체 텍스트를 불러옵니다 (`getBlob().getDataAsString()`).
    3. `dateStr`와 `timeStr` 블록을 찾고, 그 아래의 `originalContent`를 정확히 매칭합니다.
    4. 매칭된 텍스트를 `newContent`로 치환하거나 아예 삭제. (취소선은 앞뒤로 `~~` 추가).
    5. `file.setContent(modifiedText)`로 덮어쓰기.

### 프론트엔드 (클로이) - `judy_note.html`
*   **현재 읽기 모드 (`setToReadMode`)**: 단순히 텍스트를 `<div id="memoViewer">` 안에 `textContent`로 때려박는 구조입니다.
*   **변경안**: 각 메모를 개별 DOM 요소(`.memo-block`)로 파싱하여 렌더링하고, 각 요소 우측에 `[✏️ 수정] [~~S~~ 취소선] [🗑️ 삭제]` 버튼을 부착합니다.
*   버튼 클릭 시 인라인으로 수정 폼(`textarea`)이 열리고, 완료 시 백엔드 API를 호출하여 UI를 즉시 갱신(혹은 서버 응답 후 갱신)합니다.

---

## 🎯 [QA 요청 및 중점 검토 포인트]

김감사님, 개발 착수 전에 아래 3가지 리스크에 대한 검토와 조언을 구합니다.

1.  **동시성 문제 (Concurrency & Race Condition)**:
    *   사용자가 웹에서 `[수정]` 버튼을 눌러 서버가 파일을 읽고 덮어쓰려는 (약 2~3초) 찰나의 순간에, 슬랙 봇을 통해 해당 사용자가 새로운 메모를 전송(Append)해버리면 **데이터 덮어씌워짐(유실)**이 발생할 수 있습니다. 
    *   *제안*: GAS의 **`LockService.getUserLock()`** 을 수정/삭제 로직뿐만 아니라 기존 쓰기(`appendMemoToArchive`) 로직에도 감싸는 것이 필수적일까요? 성능(Timeout)에 미칠 영향은 어떨까요?
2.  **정규식(Regex) 파싱 및 텍스트 매칭의 취약성**:
    *   마크다운은 자유도가 높아 사용자가 `[14:30 PM]` 이라는 텍스트를 메모 본문 안에 우연히 썼거나, 줄바꿈 띄어쓰기를 임의로 드라이브 열어서 수정했을 경우 파싱이 꼬일 위험이 있습니다. 
    *   *제안*: `originalContent` 매칭 시 `indexOf`나 `replace`가 단 1건만 정확히 매칭되었는지 확인 후 치환하고, 0건이거나 2건 이상이면 "수동 편집 충돌" 에러를 내뱉고 수정을 거부하는 방어 로직을 넣는 것이 안전할까요?
3.  **파일 복구 백업 (Soft Delete vs Hard Delete)**:
    *   파일을 덮어쓰다가 스크립트가 뻑나면 1달치 일지가 다 날아가는 대형 사고가 터집니다. 
    *   *제안*: 덮어쓰기 직전에 구글 드라이브의 파일 리버전(Revision) 기능이 알아서 백업을 보장해줄지, 아니면 임시 `XXX_backup.md`를 옆에 복사해두고 성공 시 지우는 2-Phase Commit 흉내를 내야 할지 인프라 관점에서 의견 부탁드립니다. (GAS의 `.setContent`는 버전 히스토리에 남는 것으로 알고는 있습니다만 확신이 필요합니다).

검토 후 문서 하단이나 새로운 MD 파일에 의견을 남겨주시면, 적극 수용하여 개발(Execution)에 돌입하도록 하겠습니다!
