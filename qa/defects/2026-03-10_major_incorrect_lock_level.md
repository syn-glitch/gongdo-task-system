# [v3.1 Bug] [MAJOR/Security] Incorrect Lock level for Task Registration

## 재현 경로
1. `src/gas/web_app.gs` 파일을 엽니다.
2. 373행에서 `withTaskLock` 함수가 호출되며, `LockService.getUserLock()`을 사용하는 것을 확인합니다.
3. 이 함수는 `registerTaskFromWeb` (Line 606) 등 모든 공용 시트 쓰기 작업에서 공통 래퍼로 사용됩니다.

## 기대 결과 vs 실제 결과
- **기대 결과**: 모든 팀원이 공유하는 `Tasks` 시트에 대한 쓰기 작업은 전역 잠금인 `LockService.getScriptLock()`을 사용해야 합니다.
- **실제 결과**: `getUserLock()`을 사용하여 사용자 본인에게만 적용되는 잠금을 걸어, 여러 사용자가 동시에 접근할 경우 시트 정합성이 깨질 위험이 있습니다.

## 권고 사항
`withTaskLock` 함수 내의 `LockService.getUserLock()`을 `LockService.getScriptLock()`으로 변경해야 합니다.
