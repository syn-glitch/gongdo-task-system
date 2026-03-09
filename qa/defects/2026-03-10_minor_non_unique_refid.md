# [v3.1 Bug] [MINOR/Functional] Duplicate and potentially non-unique refId generation

## 재현 경로
1. `src/gas/web_app.gs` 파일을 엽니다.
2. `addTaskReference` 함수를 찾습니다 (Line 775).
3. `var refId = "REF-" + Date.now();` 부분에서 아이디를 생성하고 있습니다.

## 기대 결과 vs 실제 결과
- **기대 결과**: 생성된 아이디는 시트 내에서 고유해야 합니다.
- **실제 결과**: `Date.now()`는 밀리초 단위로, 드물게 여러 요청이 동시에 들어올 경우 중복될 위험이 있습니다. 또한, 데이터 양이 많아질 경우 `Task_References` 내에서 유일성이 보장되지 않습니다.

## 권고 사항
아이디 생성 시 랜덤 문자열을 추가하거나, 시트 내의 마지막 아이디를 기반으로 인크리멘탈한 아이디를 생성하도록 로직을 강화하는 것이 좋습니다.
