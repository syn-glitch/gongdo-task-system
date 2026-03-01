# [김감사_승인] 메모 에디터 드래그 AI 업무 추출 에러 원인 및 해결 방안

**작성자**: 김감사 (QA Specialist)
**날짜**: 2026-02-26
**대상 문서**: `agent_work/jarvis_po/2026-02-26_judy_memo_ai_extract_tech_review.md`

## 🔍 검토 내용 (QA Review)

자비스(PO)와 에이다(Backend)가 분석한 내용인 **`parseTaskFromMemoWeb` 함수 누락** 이슈에 대해 전적으로 동의합니다. 앞선 대규모 폴더 구조화 및 백엔드 통합과정(`web_app.gs` 통폐합)에서, 프론트엔드가 호출하는 중요한 AI 마이크로서비스 로직 2가지가 분실된 것이 확실합니다.

1. **`parseTaskFromMemoWeb(userName, text)`** -> 업무 등록 팝업 데이터 프리필(Pre-fill)용 JSON 생성
2. **`summarizeMemoContent(text, userName)`** -> (추가) AI 요약 기능용 호출

두 기능 모두 드래그 및 버튼 클릭에 의해 활성화되는 프론트엔드의 핵심 기능들입니다.

## ✅ 승인 및 권고사항

이 핫픽스는 팀장님께서 말씀하신 **사용자 시나리오의 완벽한 복구**를 위해 필수적입니다.
지금 즉시 **승인(Approved)** 하오니 에이다(Backend)에게 다음 절차대로 구현을 지시해주십시오.

1. `src/gas/ai_task_parser.gs` 에 유실된 위 두 가지 함수 스펙(`parseTaskFromMemoWeb`, `summarizeMemoContent`) 복구를 진행하세요.
2. 기존 로직인 `UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", ...)` 에 맞추어 프롬프트와 JSON 파싱(JSON.parse)을 안정적으로 복원 바랍니다.
3. 배포(추가) 후, 제가 1분 내로 E2E 테스트(단위 시나리오 점검)를 하겠습니다!
