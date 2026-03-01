# 🚨 [QA Report] 주디 워크스페이스 메모 저장 기능 장애 리포트

**문서 정보**
- **작성자**: 벙커팀장 박기획
- **보고대상**: 김감사 QA 팀장, 강철 AX 팀장
- **작성일**: 2026-03-01
- **상태**: 🔴 긴급 조치 필요 (Critical Bug)

---

## 🛑 1. 장애 현황 (Issue Summary)
*   **증상**: 주디 워크스페이스(웹) 및 주디 노트에서 '메모 저장' 및 'AI 업무 추출' 버튼을 클릭해도 저장이 되지 않고, 서버 응답 오류가 발생함.
*   **영향 범위**: 모든 사용자의 웹 기반 업무 메모 작성/저장/AI 추출 기능 마비.

## 🔍 2. 원인 분석 (Root Cause)
자비스 개발팀의 최근 코드 구조화(Refactor) 과정에서 프런트엔드가 호출하는 백엔드 API 함수 2종이 누락되었습니다.

- **프런트엔드 호출 규격**: 
  1. `google.script.run.saveFromWeb(userName, text)`
  2. `google.script.run.extractFromWeb(userName, text)`
- **백엔드 현황**: `src/gas/web_app.gs` 및 기타 `.gs` 파일 내에 해당 함수들이 존재하지 않음 (삭제됨).
- **관련 커밋**: `recent_changes.diff` 확인 결과, `saveFromWeb`과 `extractFromWeb` 함수가 통째로 삭제된 이력이 발견되었습니다.

## 🛠️ 3. 해결 방안 (Proposed Fix)
`src/gas/web_app.gs` 파일 하단에 아래의 복구 코드를 즉시 삽입해야 합니다.

```javascript
/**
 * [장애 복구] 프론트엔드(judy_workspace.html)에서 호출하는 저장 함수
 */
function saveFromWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "내용이 없습니다." };
    const result = appendMemoToArchive(userName, text, null);
    return { success: !!result, message: result ? "성공적으로 저장되었습니다." : "저장 중 오류가 발생했습니다." };
  } catch (err) {
    return { success: false, message: "Critical Error: " + err.message };
  }
}

/**
 * [장애 복구] 프론트엔드에서 '✨ AI 업무 추출 및 저장' 버튼을 눌렀을 때 호출되는 함수
 */
function extractFromWeb(userName, text) {
  try {
    if (!text || text.trim() === "") return { success: false, message: "내용이 없습니다." };
    
    // 1. 구글 드라이브 아카이브에 영구 저장 (백업)
    appendMemoToArchive(userName, text, null);
    
    // 2. AI 분석기를 돌려서 Tasks 시트에 등록
    const summaryMsg = parseAndCreateTasks(text, userName);
    
    return { success: true, message: summaryMsg };
  } catch (err) {
    return { success: false, message: "AI 파싱 웹 오류: " + err.message };
  }
}
```

## 📋 4. 김감사 QA 팀장 확인 요청
- 위 코드가 이전에 사용되던 `appendMemoToArchive` 로직과 100% 호환되는지 검증 부탁드립니다.
- 백엔드 배포 후 `judy_workspace.html`에서 정상적으로 '성공 토스트'가 출력되는지 확인해 주세요.

---

**"김감사 팀장님, 위 내용을 확인하신 후 문제 없으면 강철 AX 팀장에게 전달하여 즉시 운영 서버에 `clasp push` 하도록 지시하겠습니다!"** 🫡🔥
