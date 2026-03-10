<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        02_개발_문서_development.md
 @version     v1.0.0
 @updated     2026-03-10 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description 토큰 대시보드 개발 문서 — 아키텍처, API 명세, 코드 구조, 변경 이력

 @change-summary
   AS-IS: 문서 없음
   TO-BE: 개발 문서 최초 작성

 @features
   - [추가] 백엔드 코드 구조 및 함수 명세
   - [추가] 프론트엔드 모듈 구조
   - [추가] API 호출 지점 인벤토리
   - [추가] 데이터 스키마
   - [추가] 배포 이력

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-10 | 꼼꼼이 | 최초 작성
 ============================================
-->

# 📈 토큰 대시보드 — 개발 문서

---

## 1. 코드 구조

### 1.1 백엔드 (Google Apps Script)

**핵심 파일**: `src/gas/ai_token_logger.gs` (v1.0.0)

| 함수 | 역할 | 호출자 |
|------|------|--------|
| `callClaudeAPI(url, options, functionName, userName)` | Claude API 공통 래퍼. `UrlFetchApp.fetch()` 대체. 응답의 `usage` 필드를 자동 추출하여 `logTokenUsage()` 호출 | 모든 AI 파일 (9개 호출 지점) |
| `logTokenUsage(functionName, userName, inputTokens, outputTokens, model)` | TokenUsage 시트에 1행 추가 | `callClaudeAPI()` 내부 |
| `ensureTokenUsageSheet()` | TokenUsage 시트가 없으면 헤더와 함께 자동 생성 | `logTokenUsage()` 내부 |
| `getTokenUsageStats(period, userName)` | 기간별 통계 조회 API. 백엔드 권한 검증 포함 | 프론트엔드 `google.script.run` |

**상수**:

```javascript
var TOKEN_USAGE_SHEET_NAME = "TokenUsage";
var ALLOWED_TOKEN_VIEWERS = ["송용남", "정혜림"];
var DEFAULT_TOKEN_PRICE_INPUT = 3;    // $/1M tokens (Sonnet input)
var DEFAULT_TOKEN_PRICE_OUTPUT = 15;  // $/1M tokens (Sonnet output)
```

### 1.2 프론트엔드 (HTML/JS)

**파일**: `src/frontend/judy_workspace.html` (동기화: `src/gas/judy_workspace.html`)

토큰 모듈은 IIFE(즉시 실행 함수)로 캡슐화되어 있다:

```
<!-- ═══ 📈 토큰 사용량 모듈 ═══ -->
<script>
    (function() {
        'use strict';
        // TOKEN_ALLOWED_USERS, _tokenCurrentPeriod 등 내부 변수
        // checkAndShowTokenTab() — 인증 후 탭 표시
        // initTokenModule() — Google Charts 로드 + 첫 데이터 조회
        // loadTokenStats() — 백엔드 API 호출
        // renderTokenDashboard() — 차트·테이블·카드 렌더링
        // switchTokenPeriod() — 기간 필터 전환
    })();
</script>
```

**권한 체크 흐름**:
1. `setAuthenticatedUser(uid, uname)` 실행 (인증 완료 시)
2. → `checkAndShowTokenTab(uname)` 호출
3. → `TOKEN_ALLOWED_USERS`에 포함되면 GNB/하단 네비 탭 `display` 해제
4. 토큰 탭 클릭 시 → `initTokenModule()` → `loadTokenStats()`
5. `loadTokenStats()`에서 `g_userName`을 백엔드에 전달
6. 백엔드 `getTokenUsageStats()`에서 `ALLOWED_TOKEN_VIEWERS` 재검증

---

## 2. API 호출 지점 인벤토리

`callClaudeAPI()` 래퍼가 적용된 모든 지점:

| # | 파일 | 함수 | 용도 | userName |
|---|------|------|------|----------|
| 1 | `ai_chat.gs` | `processJudyWebChat()` | 웹 채팅 | 로그인 사용자명 |
| 2 | `ai_chat.gs` | `askClaudeForChat()` | 슬랙 채팅 | `"slack"` |
| 3 | `ai_report.gs` | `askClaude()` | 일일 리포트 | `"system"` |
| 4 | `ai_report.gs` | `generateMorningBriefing()` | 모닝 브리핑 | `"system"` |
| 5 | `ai_briefing.gs` | `getDailyBriefingForWeb()` | 웹 브리핑 | 로그인 사용자명 |
| 6 | `ai_task_parser.gs` | `extractTasksWithClaude()` | 업무 추출 | 사용자명 |
| 7 | `ai_task_parser.gs` | `parseTaskFromMemoWeb()` | 메모→업무 | 사용자명 |
| 8 | `ai_task_parser.gs` | `summarizeMemoContent()` | 메모 요약 | 사용자명 |
| 9 | `ai_task_parser.gs` | `summarizeLongText_chunk` | 청크 요약 | 사용자명 |
| 10 | `ai_task_parser.gs` | `summarizeLongText_merge` | 통합 요약 | 사용자명 |

---

## 3. 데이터 스키마

### TokenUsage 시트

| 열 | 필드명 | 타입 | 설명 |
|----|--------|------|------|
| A | timestamp | String | 호출 시각 (`yyyy-MM-dd HH:mm:ss`) |
| B | date | String | 날짜 (`yyyy-MM-dd`) — 일별 집계 키 |
| C | functionName | String | 호출 함수명 |
| D | userName | String | 사용자명 |
| E | inputTokens | Number | 입력 토큰 수 |
| F | outputTokens | Number | 출력 토큰 수 |
| G | totalTokens | Number | 합계 (E + F) |
| H | model | String | 사용 모델명 (예: `claude-sonnet-4-20250514`) |

### getTokenUsageStats() 응답 구조

```javascript
{
  daily: [
    { date: "2026-03-10", inputTokens: 11265, outputTokens: 514, totalTokens: 11779, calls: 1 }
  ],
  byFunction: [
    { name: "processJudyWebChat", totalTokens: 11779, calls: 1, pct: 100 }
  ],
  byUser: [
    { name: "송용남", totalTokens: 11779, calls: 1, pct: 100 }
  ],
  summary: {
    totalTokens: 11779,
    totalInputTokens: 11265,
    totalOutputTokens: 514,
    totalCalls: 1,
    estimatedCostUSD: 0.042,
    dailyAvgTokens: 11779
  },
  recentLogs: [
    { timestamp: "2026-03-10 14:30:00", functionName: "processJudyWebChat", userName: "송용남", inputTokens: 11265, outputTokens: 514, totalTokens: 11779 }
  ]
}
```

---

## 4. 주요 설계 결정

### 4.1 Fail-Safe 로깅

```javascript
// callClaudeAPI() 내부
try {
  if (result && result.usage) {
    logTokenUsage(functionName, userName, inputTokens, outputTokens, model);
  }
} catch (logErr) {
  console.error("[TokenLogger] 로깅 실패 (AI 응답은 정상 반환):", logErr.message);
}
return result; // 로깅 실패해도 반드시 반환
```

### 4.2 이중 권한 검증

- **프론트엔드**: `TOKEN_ALLOWED_USERS` 배열로 탭 자체를 숨김 (UI 레벨)
- **백엔드**: `ALLOWED_TOKEN_VIEWERS` 배열로 API 응답 거부 (데이터 레벨)
- 프론트엔드만 우회해도 백엔드에서 차단됨

### 4.3 프라이버시 정책

- 요청 본문(사용자 질문, 시스템 프롬프트)은 **절대 기록하지 않음**
- 응답 본문(AI 답변)도 **절대 기록하지 않음**
- 기록 항목: 시각, 함수명, 사용자명, 토큰 수, 모델명 (메타데이터만)

### 4.4 비용 환산

```
비용(USD) = (inputTokens / 1,000,000 × INPUT_PRICE) + (outputTokens / 1,000,000 × OUTPUT_PRICE)
```

단가는 `PropertiesService`에서 `TOKEN_PRICE_INPUT`, `TOKEN_PRICE_OUTPUT`으로 오버라이드 가능.

---

## 5. 변경 파일 요약

| 파일 | 변경 유형 | 버전 |
|------|----------|------|
| `src/gas/ai_token_logger.gs` | **신규** | v1.0.0 |
| `src/gas/ai_chat.gs` | 수정 (래퍼 적용 2곳 + API키 수정) | v1.2.0 → v1.3.0 |
| `src/gas/ai_report.gs` | 수정 (래퍼 적용 2곳 + API키 수정) | v1.1.0 → v1.3.0 |
| `src/gas/ai_briefing.gs` | 수정 (래퍼 적용 1곳) | v1.0.0 → v1.1.0 |
| `src/gas/ai_task_parser.gs` | 수정 (래퍼 적용 5곳) | v1.1.0 → v1.2.0 |
| `src/frontend/judy_workspace.html` | 수정 (토큰 탭 + 모듈 추가) | — |

---

## 6. 배포 이력

| 버전 | 날짜 | GAS @버전 | 내용 |
|------|------|----------|------|
| v3.1.4 | 2026-03-10 | @195 | 토큰 대시보드 최초 배포 + QA 수정 |
| v3.1.5 | 2026-03-10 | @197 | 토큰 탭 권한 체크 타이밍 수정 (인증 후 표시) |
| v3.1.6 | 2026-03-10 | @198 | Date 직렬화 수정 + 디버깅 로그 추가 |

---

## 7. 향후 개선 사항

- [ ] 인라인 스타일 CSS → 별도 클래스 리팩토링 (강철 AX팀 위임)
- [ ] 토큰 단가 PropertiesService 설정 UI 추가
- [ ] 월간 비용 리포트 슬랙 자동 전송
- [ ] 접근 권한 관리 UI (현재는 코드 직접 수정)
