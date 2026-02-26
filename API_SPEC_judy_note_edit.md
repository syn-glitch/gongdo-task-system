# API 명세서: 주디 노트 수정/삭제 기능

**문서 상태**: Draft
**작성자**: 에이다 & 허밋
**기준 문서**: `[김감사_최종승인]_주디노트_수정기능_v1.md`

---

## 🛑 에러 코드 정의 (공통반환: `errorCode`)

| 에러 코드 | 발생 원인 | 클라이언트 노출 방식 (권장 토스트) |
| :--- | :--- | :--- |
| `ERR_LOCK_TIMEOUT` | 동시 변경(웹/슬랙) 시 LockService 10초 대기 초과 | "다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요. ⏱️" |
| `ERR_DATE_NOT_FOUND` | 저장된 마크다운을 순회했으나 요청한 날짜(예: `## 2026-02-26 (목)`) 블록을 찾지 못함 | "서버에 해당 날짜 기록이 존재하지 않습니다. 새로고침 해주세요." |
| `ERR_CONTENT_NOT_FOUND` | 요청된 타임스탬프와 원본 내용이 정확히 일치하는 문서 내 구역을 찾지 못함 (이미 수정/삭제되었을 가능성) | "메모 내용을 찾을 수 없습니다. 이미 수정되거나 삭제되었을 수 있습니다." |
| `ERR_DUPLICATE_CONTENT` | 치환 로직 검사 결과, 완벽히 동일한 시간/내용 쌍이 2개 이상 발견되어 오작동 우려로 작업 거부 | "동일 구조의 메모가 다수 발견되어 안전을 위해 수동 확인이 필요합니다." |
| `ERR_FILE_TOO_SHORT` | 수정 파싱 이후 결과물의 총량 텍스트가 극단적으로 짧아져 무결성이 훼손되었다고 백업 검증기가 판단 | "서버 파싱 오류가 발생하여 안전하게 복구(Rollback) 되었습니다." |
| `ERR_DATE_HEADER_LOST` | 파싱 후 결과물의 `## ` 헤더 개수가 이전보다 감소하여 무결성이 훼손되었다고 판단 | "서버 파싱 오류(헤더 유실)가 발생하여 이전 상태로 복구(Rollback) 되었습니다." |

---

## 🔌 API 엔드포인트 세부 스펙

### 1. `safeUpdateArchivedMemo()` - (Backend Internal 단일 진입점)
실제 클라이언트가 직접 호출하지 않고, 아래 3개 API가 내부적으로 의존하는 백엔드 코어 함수입니다. (Lock + 2-Phase Commit 백업 + 무결성 검증 로직 관장)

*   **진입 조건**: `LockService.getUserLock().tryLock(10000)` 성공 시.

---

### 2. `google.script.run.editArchivedMemo(params)`
인라인 `<textarea>` 에서 수정한 새 텍스트로 문서를 치환합니다.

*   **매개변수 (Params Object)**
    *   `userName` (string): 요청 사용자명 ("송용남")
    *   `dateStr` (string): 찾을 블록의 날짜문자열 ("2026-02-26 (목)")
    *   `timeStr` (string): 찾을 블록의 시간 ("14:30 PM")
    *   `originalContent` (string): 편집 전 기존 원문 텍스트 (단 건 매칭 검사용)
    *   `newContent` (string): 유저가 수정한 새 텍스트
*   **반환(Return) 형식**: `JSON object`
    ```json
    {
      "success": true, // 또는 false
      "errorCode": null, // 실패 시 에러 코드 문자열
      "message": "수정 성공", // 실패 시 원인 구체적 로깅
      "newContent": "수정된 새 텍스트 내용..." 
    }
    ```

---

### 3. `google.script.run.deleteArchivedMemo(params)`
해당 메모 블록(타임스탬프 + 텍스트 전체 줄)을 마크다운 문서 내에서 완벽히 소거합니다.

*   **매개변수 (Params Object)**
    *   `userName`, `dateStr`, `timeStr`, `originalContent` (타입 및 용도 위와 동일)
*   **반환(Return) 형식**: `JSON object`
    ```json
    {
      "success": true,
      "errorCode": null,
      "message": "삭제 완료",
      "backupId": "backup_1739281923" // 클라이언트가 즉시 Undo 할 때 필요한 식별자
    }
    ```

---

### 4. `google.script.run.toggleStrikethroughMemo(params)`
완료(체크) 버튼 클릭 시 기존 텍스트 양 옆에 `~~` 문구를 붙이거나, 이미 붙어있다면 제거하는 토글(Toggle) 통신을 수행합니다.

*   **매개변수 (Params Object)**
    *   `userName`, `dateStr`, `timeStr`, `originalContent` (타입 및 용도 2번과 동일)
*   **반환(Return) 형식**: `JSON object`
    ```json
    {
      "success": true,
      "errorCode": null,
      "message": "취소선 토글 완료",
      "newContent": "~~취소선이 그어진 새 텍스트~~" // 프론트에 변경된 문자열 반환 (리렌더링 용도)
    }
    ```
