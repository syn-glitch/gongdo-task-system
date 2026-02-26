# [🔍 기능 테스트] 기능명 QA 리포트

**QA 담당**: 테스터 (Functional QA Specialist)
**검수일**: YYYY-MM-DD
**대상 파일**: `path/to/file.gs` 또는 `path/to/file.html`
**우선순위**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## 📋 요약 (Executive Summary)

**1-2문장으로 전체 평가 요약**:
- 예: 기본 기능은 정상 작동하나, 에러 핸들링 및 Edge Case 처리에 3개의 Critical 이슈 발견.

---

## ✅ 기능 테스트 체크리스트

### 1. 에러 핸들링
- [ ] 모든 함수에 Try-Catch 블록이 있는가?
- [ ] API 호출 시 응답 코드 검증 (responseCode !== 200)이 있는가?
- [ ] muteHttpExceptions: true 사용 여부
- [ ] 에러 발생 시 사용자에게 명확한 피드백 (Toast/Modal)이 있는가?
- [ ] Logger.log() 또는 console.error()로 에러 로깅이 있는가?

### 2. 입력 검증
- [ ] null/undefined 체크가 있는가?
- [ ] 빈 문자열 ("") 체크가 있는가?
- [ ] 타입 검증 (typeof, instanceof)이 있는가?
- [ ] 사용자 입력 검증 (길이, 형식)이 있는가?

### 3. API 통신
- [ ] UrlFetchApp.fetch() 호출 시 try-catch로 감싸져 있는가?
- [ ] 응답 body 파싱 시 JSON.parse() 에러 처리가 있는가?
- [ ] 타임아웃 처리가 있는가?
- [ ] 재시도 로직이 필요한 경우 구현되어 있는가?

### 4. 데이터 흐름
- [ ] 함수 입력과 출력이 명확한가?
- [ ] 데이터 변환 로직이 정확한가?
- [ ] 상태 관리가 일관성 있게 이루어지는가?

### 5. Edge Case
- [ ] 빈 배열 ([]) 처리가 있는가?
- [ ] 숫자 0, false, null, undefined 처리가 있는가?
- [ ] 매우 긴 문자열 (1000자 이상) 처리가 있는가?
- [ ] 특수 문자 (따옴표, 백슬래시) 처리가 있는가?

### 6. 로그 및 디버깅
- [ ] 주요 분기점에 로그가 있는가?
- [ ] 에러 메시지가 명확하고 추적 가능한가?
- [ ] 디버깅을 위한 충분한 정보가 로그에 포함되어 있는가?

---

## ✅ 통과 항목 (Passed)

**정상적으로 작동하는 항목을 나열하세요:**

- ✅ [파일명:라인] 기능 설명
- ✅ [파일명:라인] 기능 설명
- ✅ [파일명:라인] 기능 설명

**예시**:
- ✅ [slack_command.gs:100-120] 사용자 입력 검증 로직이 정상 작동함
- ✅ [web_app.gs:50-75] API 응답 검증이 올바르게 구현됨

---

## ❌ 발견된 문제 (Issues Found)

| 우선순위 | 파일 위치 | 문제 설명 | 수정안 |
|---------|----------|----------|--------|
| 🔴 Critical | [파일:라인] | 문제 설명 | 수정 방법 |
| 🟠 High | [파일:라인] | 문제 설명 | 수정 방법 |
| 🟡 Medium | [파일:라인] | 문제 설명 | 수정 방법 |

**예시**:
| 우선순위 | 파일 위치 | 문제 설명 | 수정안 |
|---------|----------|----------|--------|
| 🔴 Critical | slack_command.gs:451 | UrlFetchApp.fetch() 호출 시 try-catch 없음. API 실패 시 서버 크래시 가능 | try-catch 블록으로 감싸고 에러 시 사용자 피드백 제공 |
| 🟠 High | web_app.gs:75 | null 체크 누락. payload.message가 없을 경우 크래시 | if (!payload.message) return errorResponse("메시지 없음") 추가 |

---

## 🧪 테스트 시나리오

**실제 테스트한 시나리오를 기록하세요:**

### Test Case 1: 정상 케이스
- **입력**: 유효한 데이터
- **Expected**: 성공 메시지
- **Actual**: ✅ 성공

### Test Case 2: 에러 케이스
- **입력**: null 값
- **Expected**: 에러 메시지 "데이터가 없습니다"
- **Actual**: ❌ 크래시 (null 체크 없음)

### Test Case 3: Edge Case
- **입력**: 빈 배열
- **Expected**: "결과 없음" 메시지
- **Actual**: ✅ 성공

---

## ⚠️ 개선 제안 (Recommendations)

**필수는 아니지만 개선하면 좋을 항목:**

- 📌 [파일:라인] 변수명을 더 명확하게 (예: `data` → `taskData`)
- 📌 [파일:라인] 주석 추가 (복잡한 로직 설명)
- 📌 [파일:라인] 함수 분리 (100줄 이상 함수는 쪼개기)
- 📌 [파일:라인] 매직 넘버 제거 (30 → TIMEOUT_SECONDS)

---

## 🎯 우선순위 분류

- 🔴 **Critical**: X개
- 🟠 **High**: X개
- 🟡 **Medium**: X개
- 🟢 **Low**: X개

**Total**: X개 이슈

---

## 📝 최종 판정

- [ ] ✅ **승인** (Critical/High 이슈 0개)
- [ ] ⚠️ **조건부 승인** (Medium 이슈만 있음)
- [ ] ❌ **반려** (Critical/High 이슈 1개 이상)

**선택한 판정**: [✅/⚠️/❌]

**사유**:
- 예: Critical 이슈 2개 발견 (에러 핸들링 누락). 수정 후 재검토 필요.

---

**작성자**: 테스터 (Functional QA Specialist)
**작성 시간**: X분
**최종 수정**: YYYY-MM-DD HH:MM
