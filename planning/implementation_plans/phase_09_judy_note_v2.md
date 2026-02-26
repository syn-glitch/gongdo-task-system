# 9단계 Implementation Plan: 동적 유저 관리 및 구글 SSO 보안 강화

> **최종 수정일**: 2026-02-22  
> **목표**: 하드코딩된 팀원 목록을 완전 제거하고, 구글 계정 자동 인증 + 스프레드시트 화이트리스트 기반의 노코드 동적 사용자 관리 시스템 구축

---

## 1. 현재 환경 분석

### 문제점
- 팀원 추가/제거 시 `slack_command.gs`와 `judy_note.html` 코드를 직접 수정해야 함 (하드코딩)
- 웹 메모장에서 드롭다운으로 타인 이름을 선택하여 메모 저장/열람이 가능 (보안 취약점)

### 도메인 환경
| 도메인 | 대상 |
|---|---|
| `@microchool.kr` | 팀원 일부 (구글 워크스페이스 A) |
| `@gongdo.kr` | 팀원 일부 (구글 워크스페이스 B) |
| `@gmail.com` | 관리자 테스트용 |

### 기술적 제약
- 3개 이상의 서로 다른 도메인이 혼용되므로 GAS 배포 옵션 중 `조직 내 사용자만`은 사용할 수 없음
- **해결책**: `실행 사용자 = 접속자 본인` + `액세스 = Google 계정 보유자` 조합으로 배포하면 `Session.getActiveUser().getEmail()`이 모든 도메인에서 정상 동작

---

## 2. 사전 준비 (배포 설정 변경)

앱스 스크립트 **[배포] → [새 배포]** 시 반드시 아래 설정 적용:

| 설정 항목 | 값 |
|---|---|
| **실행 사용자 (Execute as)** | `웹 앱에 액세스하는 사용자` |
| **액세스 권한 (Who has access)** | `Google 계정이 있는 모든 사용자` |

---

## 3. `Users` 시트 구조

기존 `setup_structure.gs`에서 이미 생성해 둔 `Users` 시트 활용 (헤더: `이름`, `슬랙 ID`, `이메일`)

| A열: 이름 | B열: 슬랙 ID | C열: 구글 이메일 |
|---|---|---|
| 송용남 | U02S3CN9E6R | yongnam@gmail.com |
| 이지은 | U08SJ3SJQ9W | jieun@microchool.kr |
| 정혜림 | U02SK29UVRP | hyerim@gongdo.kr |
| 문유나 | U0749G2SNBE | yuna@microchool.kr |
| 이상호 | U04JL09C6DV | sangho@gongdo.kr |
| 김관수 | U02S3EURC21 | kwansu@gongdo.kr |

> ⚡ **핵심 원리**: 앞으로 팀원 추가/제거는 이 시트에 한 줄만 추가/삭제하면 끝. 코드 수정 불필요.

---

## 4. 개발 상세

### Step 1: `web_app.gs` — 백엔드 인증 함수 신설

**`getAuthenticatedUser()` 함수 추가**
- `Session.getActiveUser().getEmail()`로 접속자의 구글 이메일을 서버단에서 안전하게 획득
- `Users` 시트 C열(이메일)과 대조하여 허가된 사용자인지 판별
- 결과 반환:
  - 일치 시 → `{ authorized: true, name: "송용남", email: "..." }`
  - 불일치 시 → `{ authorized: false, reason: "등록되지 않은 사용자입니다." }`

### Step 2: `judy_note.html` — 프론트엔드 자동 로그인 UI 개편

- 기존의 `<select id="userSelect">` 드롭다운 UI **완전 삭제**
- 대신 `<span id="userBadge">` 읽기 전용 배지로 교체
- 페이지 로딩 시 `google.script.run.getAuthenticatedUser()` 호출:
  - **인증 성공** → 배지에 `👤 송용남 님` 고정, 사이드바 자동 로드
  - **인증 실패** → 풀스크린 오버레이: `⛔ 접근 권한이 없습니다. 관리자에게 문의하세요.`

### Step 3: `slack_command.gs` — 하드코딩 딕셔너리 제거 & 캐시 도입

- `fetchUserName()` 함수 내의 `const dict = { ... }` 하드코딩 완전 제거
- 대체 로직:
  1. `CacheService`에서 `USER_MAP` 캐시 확인 (초고속)
  2. 캐시 미스 시 `Users` 시트에서 전체 읽어와 `{ slackId: name }` 형태로 1시간(3600초) 캐싱
  3. 시트에도 없으면 기존처럼 슬랙 API Fallback

---

## 5. 검증 시나리오

| # | 테스트 | 기대 결과 |
|---|---|---|
| 1 | `@gmail.com`으로 접속 (시트에 등록됨) | 상단에 `👤 송용남 님` 표시, 본인 메모만 로드 |
| 2 | `@gongdo.kr`로 접속 (시트에 등록됨) | 상단에 해당 팀원 이름 표시 |
| 3 | `@microchool.kr`로 접속 (시트에 등록됨) | 상단에 해당 팀원 이름 표시 |
| 4 | 시트에 미등록된 이메일로 접속 | `⛔ 접근 권한 없음` 오버레이 차단 |
| 5 | 슬랙 DM 전송 (신규 직원 시트 추가 후) | 코드 수정 없이 자동 이름 매핑 성공 |
| 6 | Users 시트에서 팀원 1명 삭제 후 해당 팀원 접속 | 즉시 접근 차단됨 |
