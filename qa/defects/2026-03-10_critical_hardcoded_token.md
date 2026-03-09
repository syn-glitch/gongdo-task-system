# [v3.1 Bug] [CRITICAL/Security] Slack Bot Token Hardcoded in Source Code

## 재현 경로
1. `src/gas/slack_notification.gs` 파일을 엽니다.
2. 7행에서 `const SLACK_TOKEN = "xoxb-..."`와 같이 토큰이 하드코딩되어 있는 것을 확인합니다.

## 기대 결과 vs 실제 결과
- **기대 결과**: 보안을 위해 토큰이나 API 키는 `PropertiesService.getScriptProperties()`를 통해 관리되어야 하며, 소스 코드에 노출되지 않아야 합니다.
- **실제 결과**: `SLACK_TOKEN`이 소스 코드에 문자열로 직접 노출되어 있어, 코드 접근 권한이 있는 모든 사용자에게 토큰이 노출됩니다.

## 권고 사항
`PropertiesService`를 사용하여 토큰을 저장하고, 코드에서는 `PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN')`와 같이 호출하도록 수정해야 합니다.
