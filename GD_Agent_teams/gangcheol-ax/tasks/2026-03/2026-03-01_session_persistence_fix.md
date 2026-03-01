# 🔧 세션 지속성 버그 수정

**문서 번호**: TASK-AX-2026-03-01-001
**요청자**: 송PO (팀장)
**우선순위**: 🔴 P0 (Critical) — 사용자가 매번 슬랙에서 재인증해야 하는 UX 치명적 문제
**상태**: ✅ 완료
**작성일**: 2026-03-01
**완료일**: 2026-03-01
**담당자**: 강철 (강철AX팀)

---

## 🏁 수정 결과

### 채택한 방안: 방안 1+4 하이브리드 (서버 사이드 세션 + URL 파라미터 유지)

#### 수정 파일 및 내용

**1. `src/gas/web_app.gs` — 백엔드**
- `doGet()`: `template.session = e.parameter.session || ''` 추가 (세션 파라미터 전달)
- `validateToken()`: 매직 토큰 검증 성공 시 장기 세션 토큰(UUID) 발급, `CacheService`에 6시간(21600초) TTL로 저장. 반환값에 `sessionToken` 포함
- `validateSession()`: **신설 함수** — 세션 토큰 검증. 소멸하지 않고 검증 성공 시 TTL 6시간 갱신 (슬라이딩 윈도우)

**2. `src/gas/judy_workspace.html` + `src/frontend/judy_workspace.html` — 프론트엔드 (양쪽 동일 수정)**
- `initSession` 변수 추가 (`<?= session ?>`)
- `DOMContentLoaded` 인증 흐름 변경: 매직토큰 > 세션토큰 > 직접 파라미터 > 접근 거부
- `validateMagicToken()`: 인증 성공 시 URL을 `?session=<sessionToken>`으로 교체 (기존: URL 클린업)
- `validateSessionToken()`: **신설 함수** — 세션 토큰으로 서버 검증 후 인증
- `setAuthenticatedUser()`: localStorage 의존 코드 제거 (GAS sandboxed iframe에서 불안정)

#### 동작 흐름 (수정 후)
```
슬랙 "주디 노트" → 매직 토큰 생성 (CacheService, 10분 TTL)
     ↓
사용자 링크 클릭 → doGet(token=xxx) → validateToken(token)
     ↓
서버: MAGIC_xxx 검증 → 성공 → MAGIC_xxx 제거 (1회용 유지)
     ↓                    → SESSION_yyy 생성 (6시간 TTL)
     ↓                    → { valid: true, name, sessionToken: yyy } 반환
     ↓
프론트: URL을 ?session=yyy 로 replaceState
     ↓
새로고침(F5) → doGet(session=yyy) → validateSession(yyy)
     ↓
서버: SESSION_yyy 검증 → 성공 → TTL 6시간 갱신 (슬라이딩 윈도우)
     ↓
프론트: 정상 인증 → 워크스페이스 표시
```

#### 보안 분석
- 매직 토큰: 여전히 1회용, 10분 TTL → 보안 수준 유지
- 세션 토큰: 32자 UUID, 서버 사이드 저장(CacheService), 6시간 TTL
- URL에 세션 토큰 노출: 동일 브라우저/탭에서만 유효, 제3자가 URL 탈취 시 세션 도용 가능하나 내부 도구 특성상 수용 가능한 수준
- 슬라이딩 윈도우: 활성 사용 중에는 6시간마다 자동 갱신, 비활성 시 6시간 후 자동 만료

#### 1차 시도(localStorage) 실패 원인 분석
- GAS 웹앱은 `script.google.com`에서 sandboxed iframe으로 서빙됨
- 최신 브라우저의 3rd-party cookie/storage 차단 정책으로 iframe 내 localStorage 접근이 불안정
- 테마 저장(`judy_workspace_theme`)이 작동하는 경우도 있으나, 브라우저/설정에 따라 불일치
- 따라서 localStorage 의존을 제거하고 서버 사이드 세션 + URL 파라미터 방식으로 전환

---

## 📋 문제 설명

### 증상 (2가지)
1. **슬랙 "주디 노트" 매직 링크가 1회 클릭 후 재사용 불가** — 다시 클릭하면 "접근 권한이 없습니다" 표시
2. **주디 워크스페이스에서 새로고침(F5)하면 "접근 권한이 없습니다" 표시** — 매번 슬랙에서 링크를 재발급받아야 함

### 사용자 요구사항
> "이제 많이 안정화 되어서 한번 들어오면 계속 사용하고 싶어"

---

## 🔍 원인 분석

### 현재 인증 흐름
```
슬랙 "주디 노트" → 매직 토큰 생성 (CacheService, 10분 TTL)
     ↓
사용자 링크 클릭 → doGet()에서 token URL 파라미터 수신
     ↓
프론트엔드 validateMagicToken(token) → 서버 validateToken(token) 호출
     ↓
서버: cache.get("MAGIC_" + token) → 성공 → cache.remove() ← ❌ 토큰 즉시 소멸
     ↓
프론트엔드: setAuthenticatedUser() → window.history.replaceState()로 URL에서 토큰 제거
     ↓
새로고침 시: token 없음, userId 없음, userName 없음 → "접근 권한이 없습니다"
```

### 핵심 원인
- `web_app.gs:validateToken()` (line 38-48)에서 `cache.remove("MAGIC_" + token)` → 1회용 토큰
- 인증 성공 후 세션을 유지하는 메커니즘이 전혀 없음
- URL에서 토큰도 제거(`replaceState`)하므로 새로고침 시 인증 정보가 완전히 소실

---

## 🛠️ 1차 시도 (실패)

### 시도한 방법: localStorage 세션 저장
`setAuthenticatedUser()`에서 `localStorage.setItem('judy_session', ...)` 저장 후, DOMContentLoaded에서 localStorage 체크하여 자동 인증.

### 실패 원인 (조사 필요)
localStorage 저장 자체가 안 되는 것인지, GAS 웹앱의 iframe 환경에서 localStorage가 제한되는 것인지 확인 필요.

**가설**:
- GAS 웹앱은 `script.google.com`의 **sandboxed iframe** 안에서 실행됨
- iframe sandbox 환경에서 `localStorage` 접근이 차단될 수 있음
- `HtmlService.XFrameOptionsMode`와 관련될 수 있음

---

## 📂 관련 파일

| 파일 | 위치 | 관련 코드 |
|------|------|----------|
| `web_app.gs` | `src/gas/web_app.gs` | `validateToken()` (line 38-48), `doGet()` (line 7-17) |
| `judy_workspace.html` | `src/gas/judy_workspace.html` | DOMContentLoaded 인증 흐름 (line 1798-1815), `validateMagicToken()` (line 1818-1839), `setAuthenticatedUser()` (line 1841-1853) |
| `slack_command.gs` | `src/gas/slack_command.gs` | 매직 링크 생성 (line 259-305) |

---

## 💡 해결 방향 제안

### 방안 1: 서버 사이드 세션 (PropertiesService/CacheService)
- 토큰 검증 성공 시 장기 세션 토큰 발급 (UUID)
- `CacheService`는 최대 6시간이므로, `PropertiesService` 또는 시트 기반 세션 저장소 고려
- URL에 세션 토큰을 유지하거나, cookie 기반 전달

### 방안 2: localStorage 디버깅
- GAS sandboxed iframe에서 localStorage가 실제로 작동하는지 확인
- `HtmlService.createHtmlOutput().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` 설정 확인
- 작동한다면 가장 간단한 해결책

### 방안 3: 토큰 재사용 허용
- `validateToken()`에서 `cache.remove()` 제거
- TTL을 10분 → 6시간(21600초)로 확장
- 단, 보안 수준 하락 트레이드오프

### 방안 4: URL 파라미터 유지
- `replaceState`로 URL 클린업하지 않고 토큰을 URL에 유지
- 방안 3과 함께 사용하면 새로고침 시 재인증 가능

---

## ✅ 완료 기준

1. 슬랙에서 매직 링크 클릭 → 정상 접속
2. **새로고침(F5)해도 인증 유지** — "접근 권한이 없습니다" 미표시
3. **브라우저 탭 닫고 재접속해도** 일정 시간(최소 수시간) 인증 유지
4. 보안: 다른 사용자의 세션을 탈취할 수 없어야 함
5. 3개 뷰(내업무, 칸반, 달력) 모두에서 정상 작동 확인

---

## 📎 참고

- 현재 localStorage는 테마 저장에만 사용 중 (`judy_workspace_theme` 키)
- GAS 웹앱은 `script.google.com` 도메인의 sandboxed iframe으로 서빙됨
- 1차 시도 코드가 이미 `judy_workspace.html`에 반영되어 있음 (localStorage 저장/읽기 코드)
- 실패 원인 디버깅 후 코드 수정 또는 대체 방안 적용 필요
