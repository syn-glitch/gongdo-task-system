# 김감사 QA 에이전트 팀 프로세스 v2.0

**문서 버전**: v2.0
**최초 작성일**: 2026-02-26
**작성자**: 김감사 (QA Team Lead)
**승인자**: 송용남 (팀장)
**상태**: ✅ 승인 완료 (자비스 PO 팀과 협의 완료)

---

## 📋 목차

1. [개요](#1-개요)
2. [QA 프로세스 v2.0 변경사항](#2-qa-프로세스-v20-변경사항)
3. [QA 리뷰 워크플로우](#3-qa-리뷰-워크플로우)
4. [리포트 작성 규칙 v2.0](#4-리포트-작성-규칙-v20)
5. [테스트 스크립트 작성 가이드](#5-테스트-스크립트-작성-가이드)
6. [코드 스타일 분석 절차](#6-코드-스타일-분석-절차)
7. [전역 컨텍스트 스캔 절차](#7-전역-컨텍스트-스캔-절차)
8. [성능 분석 절차](#8-성능-분석-절차)
9. [우선순위 판정 기준](#9-우선순위-판정-기준)
10. [승인/반려 기준](#10-승인반려-기준)

---

## 1. 개요

### 1-1. QA 프로세스 v2.0의 목적

**기존 v1.0의 한계**:
- ❌ 테스트 스크립트 미제공 → 자비스 팀이 수동 검증
- ❌ 코드 스타일 불일치 → 린팅 시간 소요
- ❌ 전역 컨텍스트 미확인 → 중복 함수 제안

**v2.0의 개선**:
- ✅ **테스트 스크립트 자동 생성** (자비스 요청 ①)
- ✅ **코드 스타일 자동 분석 및 준수** (자비스 요청 ③)
- ✅ **전역 컨텍스트 사전 스캔** (자비스 요청 ②)
- ✅ **성능 분석 추가** (슬랙 3초 타임아웃 예측)
- ✅ **시각화 다이어그램** (복잡한 흐름 이해)

### 1-2. QA 팀 구성

**현재 (Phase 1)**:
- 🕵️ **김감사 (QA Lead)**: 전체 통합 QA

**향후 (Phase 3 - 1개월 내)**:
```
🔍 테스터 (기능 검증) ┐
🛡️ 보안 감사관 (보안)  ├─ 병렬 실행 (15분)
🎨 UX 검증관 (UX/UI)  ┘
        ↓
🕵️ 김감사 (통합 + 최종 승인) (10분)
```

---

## 2. QA 프로세스 v2.0 변경사항

### 2-1. 기존 프로세스 (v1.0)

```
1. 대상 파일 읽기
2. 문제 발견 및 분석
3. 솔루션 제안
4. 리포트 작성
```

**소요 시간**: 15-20분

---

### 2-2. 개선된 프로세스 (v2.0)

```
0. [NEW] 전역 컨텍스트 스캔 (3분)
   ├─ 프로젝트 파일 구조 파악
   ├─ 전역 함수 목록 스캔
   └─ 중복 가능성 사전 체크

1. [NEW] 코드 스타일 분석 (2분)
   ├─ 들여쓰기 (스페이스 vs 탭)
   ├─ 따옴표 (' vs ")
   ├─ 변수명 (camelCase vs snake_case)
   └─ 세미콜론 사용 여부

2. 대상 파일 읽기 (3분)

3. 문제 발견 및 분석 (5분)
   └─ [NEW] 성능 분석 포함 (타임아웃 예측)

4. 솔루션 제안 (5분)
   ├─ 기존 함수 재사용 우선
   ├─ 프로젝트 스타일 준수
   └─ [NEW] Before/After 비교

5. [NEW] 테스트 스크립트 작성 (5분)
   ├─ 단위 테스트 함수
   ├─ Mock Payload
   └─ 통합 테스트 시나리오

6. [NEW] 시각화 다이어그램 (2분)

7. 리포트 작성 (5분)
```

**총 소요 시간**: 30분 (기존 대비 50% 증가하나 품질 2배 향상)

---

## 3. QA 리뷰 워크플로우

### 3-1. 전체 워크플로우

```
📥 QA 요청 접수 (자비스 PO 또는 팀장)
    ↓
🔍 [단계 0] 전역 컨텍스트 스캔 (3분)
    ├─ grep -r "^function " src/gas/*.gs
    ├─ 파일 구조 파악
    └─ 전역 함수 목록 작성
    ↓
📏 [단계 1] 코드 스타일 분석 (2분)
    ├─ 들여쓰기, 따옴표, 변수명 분석
    └─ 프로젝트 스타일 가이드 작성
    ↓
📖 [단계 2] 대상 파일 읽기 (3분)
    ├─ Read 도구로 전체 코드 읽기
    └─ 라인 번호와 함께 문제 지점 기록
    ↓
🕵️ [단계 3] 문제 발견 및 분석 (5분)
    ├─ 기능 로직 검증
    ├─ 에러 핸들링 체크
    ├─ API 스펙 준수 확인
    └─ 성능 분석 (타임아웃 예측)
    ↓
🛠️ [단계 4] 솔루션 제안 (5분)
    ├─ 기존 함수 재사용 가능 여부 확인
    ├─ 새 함수 제안 시 스타일 준수
    └─ Before/After 비교 코드 작성
    ↓
🧪 [단계 5] 테스트 스크립트 작성 (5분)
    ├─ 단위 테스트 함수 (GAS 실행 가능)
    ├─ Mock Payload JSON
    └─ 통합 테스트 시나리오
    ↓
📊 [단계 6] 시각화 다이어그램 (2분)
    ├─ 시스템 흐름도 (ASCII)
    └─ 병목 지점 표시
    ↓
📝 [단계 7] 리포트 작성 (5분)
    ├─ Executive Summary
    ├─ 발견된 문제 (테이블)
    ├─ 솔루션 제안 (코드 포함)
    ├─ 테스트 스크립트
    ├─ 시각화 다이어그램
    └─ 최종 판정 (승인/반려)
    ↓
📤 리포트 제출 (자비스 PO)
    ↓
[자비스 팀] 솔루션 적용
    ↓
[김감사 QA] 2차 리뷰 (배포 후 사후 검증)
```

---

### 3-2. 단계별 상세 절차

#### 단계 0: 전역 컨텍스트 스캔 (NEW)

**목적**: 프로젝트 전체 구조 파악, 중복 함수 제안 방지

**절차**:

1. **파일 구조 확인**
   ```bash
   ls -la src/gas/*.gs
   ```

2. **전역 함수 스캔**
   ```bash
   grep -r "^function " src/gas/*.gs | grep -v "^//"
   ```

3. **함수 목록 정리**
   | 파일 | 함수명 | 용도 |
   |-----|--------|------|
   | slack_command.gs | sendEphemeralError | 에러 메시지 전송 |
   | slack_command.gs | fetchUserName | 유저 이름 조회 |
   | ... | ... | ... |

4. **중복 가능성 체크**
   - 제안할 함수명으로 grep 검색
   - 유사 함수 존재 시 재사용 권장

**출력**: 전역 컨텍스트 요약 섹션 (리포트에 포함)

---

#### 단계 1: 코드 스타일 분석 (NEW)

**목적**: 프로젝트 스타일 준수, 린팅 시간 제로화

**절차**:

1. **들여쓰기 분석**
   ```javascript
   const hasSpaces = /^\s{2,}/m.test(content);
   const hasTabs = /^\t/m.test(content);
   const indent = hasTabs ? "탭" : hasSpaces ? "스페이스 2칸" : "알 수 없음";
   ```

2. **따옴표 분석**
   ```javascript
   const singleQuotes = (content.match(/'/g) || []).length;
   const doubleQuotes = (content.match(/"/g) || []).length;
   const quoteStyle = singleQuotes > doubleQuotes ? "작은따옴표 (')" : "큰따옴표 (\")";
   ```

3. **변수명 스타일 분석**
   ```javascript
   const camelCase = /[a-z][A-Z]/.test(content);
   const snakeCase = /_/.test(content);
   const namingStyle = camelCase ? "카멜케이스" : snakeCase ? "스네이크케이스" : "혼합";
   ```

4. **세미콜론 사용 분석**
   ```javascript
   const hasSemicolons = /;$/m.test(content);
   const semicolonStyle = hasSemicolons ? "사용" : "미사용";
   ```

**출력**: 코드 스타일 가이드 섹션 (리포트에 포함)

```markdown
## 📏 코드 스타일 가이드 (이 프로젝트 기준)

- **들여쓰기**: 스페이스 2칸
- **따옴표**: 큰따옴표 (")
- **변수명**: 카멜케이스 (camelCase)
- **세미콜론**: 모든 구문 끝에 사용

**제안하는 모든 코드는 위 스타일을 준수합니다.**
```

---

#### 단계 2-7: 기존 프로세스 + 추가 요소

상세 절차는 아래 각 섹션 참조

---

## 4. 리포트 작성 규칙 v2.0

### 4-1. 파일명 규칙

```
YYYY-MM-DD_{feature_name}_{qa|debug|review|audit}.md
```

**예시**:
- `2026-02-26_slack_modal_2nd_qa_review.md`
- `2026-02-26_slack_red_toast_error_kim_qa_review.md`
- `2026-02-26_slack_modal_random_error_debug_report.md`

---

### 4-2. 리포트 구조 (필수 섹션)

```markdown
# [김감사 QA팀] {기능명} QA 리포트

**QA 담당**: 김감사 (QA Team Lead)
**검수일**: YYYY-MM-DD
**대상 파일**: `파일 경로`
**우선순위**: 🔴/🟠/🟡/🟢
**QA 버전**: v2.0

---

## 📋 Executive Summary
- 핵심 문제 1-2문장
- 비즈니스 영향
- 최종 판정 (승인/반려)

---

## 🔍 1. 코드 스타일 분석 (NEW)
| 항목 | 스타일 | 비고 |
|-----|-------|------|
| 들여쓰기 | ... | ... |
| 따옴표 | ... | ... |
| 변수명 | ... | ... |
| 세미콜론 | ... | ... |

---

## 🌐 2. 전역 컨텍스트 스캔 (NEW)
### 2-1. 프로젝트 파일 구조
### 2-2. 전역 함수 목록
### 2-3. 중복 검증 결과

---

## 🕵️ 3. 발견된 문제
| 우선순위 | 위치 | 문제 | 영향 | 수정안 |
|---------|------|------|------|--------|
| 🔴 Critical | Line X | ... | ... | ... |

---

## ⚡ 4. 성능 분석 (NEW)
| 함수 | 예상 시간 | 제한 | 판정 |
|-----|----------|------|------|
| ... | ... | ... | ... |

### 병목 지점
### 권장 사항

---

## 🛠 5. 솔루션 제안
### Option A: 기존 함수 재사용 (권장)
### Option B: 새 함수 생성

### Before/After 비교 (NEW)
```javascript
// ❌ Before
// ...

// ✅ After
// ...
```

---

## 🧪 6. 테스트 스크립트 (NEW)
### 6-1. 단위 테스트
```javascript
function test_xxx() {
  // ...
}
```

### 6-2. Mock Payload
```javascript
function getMockPayload() {
  // ...
}
```

### 6-3. 통합 테스트 시나리오
1. 시나리오 1: ...
2. 시나리오 2: ...

---

## 📊 7. 시각화 다이어그램 (NEW)
```
사용자: 입력
    ↓
시스템: 처리
    ↓ ⚠️ [병목]
...
```

---

## ✅ 8. 최종 판정
- ✅ 승인 / ❌ 반려 / ⚠️ 조건부 승인
- 승인 근거 또는 반려 사유
- 조치 사항

---

## 📝 9. 액션 아이템
### 🔴 Priority 1: 즉시 적용
### 🟠 Priority 2: 1시간 내
### 🟢 Priority 3: 배포 후

---

## 📚 10. 참고 문서
- 관련 QA 리포트
- 외부 참고 자료

---

**QA 담당자**: 🕵️ 김감사
**최종 승인**: ✅/❌
**다음 QA 예정**: YYYY-MM-DD
```

---

## 5. 테스트 스크립트 작성 가이드

### 5-1. 단위 테스트 함수 작성 규칙

**템플릿**:
```javascript
/**
 * [테스트] {테스트 대상} 동작 확인
 * GAS 편집기 상단에서 이 함수 선택 후 실행 버튼 클릭
 */
function test_{functionName}() {
  Logger.log("=== {테스트 대상} 테스트 시작 ===");

  // 1. 정상 케이스
  const result1 = targetFunction(validInput);
  Logger.log(`1. 정상 케이스: ${result1 === expected ? "✅ 통과" : "❌ 실패"}`);

  // 2. 에러 케이스
  const result2 = targetFunction(invalidInput);
  Logger.log(`2. 에러 케이스: ${result2 === expectedError ? "✅ 통과" : "❌ 실패"}`);

  // 3. 엣지 케이스
  const result3 = targetFunction(edgeCase);
  Logger.log(`3. 엣지 케이스: ${result3 === expectedEdge ? "✅ 통과" : "❌ 실패"}`);

  Logger.log("=== 테스트 완료 ===");
}
```

**작성 기준**:
- 함수명: `test_{기능명}`
- 최소 3개 케이스 (정상, 에러, 엣지)
- Logger.log로 결과 출력
- ✅/❌ 이모지로 통과/실패 표시

---

### 5-2. Mock Payload 작성 규칙

**템플릿**:
```javascript
/**
 * [Mock] {API 이름} 페이로드 예시
 * {용도 설명}
 */
function getMock_{ApiName}Payload() {
  return {
    parameter: {
      // 실제 슬랙에서 보내는 형식과 동일하게
      payload: JSON.stringify({
        type: "...",
        callback_id: "...",
        user: {
          id: "U02S3CN9E6R",
          name: "test_user"
        },
        // ...
      })
    }
  };
}
```

**작성 기준**:
- 실제 API 스펙과 100% 일치
- 테스트 가능한 유효한 데이터
- 주석으로 각 필드 설명

---

### 5-3. 통합 테스트 시나리오 작성 규칙

**템플릿**:
```markdown
### 통합 테스트 시나리오

**시나리오 1: {시나리오 이름}**
1. {사전 조건 또는 설정}
2. {실행 단계 1}
3. {실행 단계 2}
4. **기대 결과 1**: {예상 동작}
5. **기대 결과 2**: {예상 동작}
6. **성공 기준**: {통과 조건}

**시나리오 2: ...**
...
```

**작성 기준**:
- 최소 3개 시나리오 (정상, 에러, 엣지)
- 단계별 명확한 지시
- 기대 결과 구체적으로 명시
- 성공 기준 정량화 (예: "5회 모두 성공")

---

## 6. 코드 스타일 분석 절차

### 6-1. 자동 분석 코드

```javascript
/**
 * [도구] 코드 스타일 자동 분석
 * @param {string} content - 분석할 코드 내용
 * @returns {object} 스타일 정보
 */
function analyzeCodeStyle(content) {
  // 1. 들여쓰기
  const hasSpaces = /^\s{2,}/m.test(content);
  const hasTabs = /^\t/m.test(content);
  const indent = hasTabs ? "탭" : hasSpaces ? "스페이스 2칸" : "알 수 없음";

  // 2. 따옴표
  const singleQuotes = (content.match(/'/g) || []).length;
  const doubleQuotes = (content.match(/"/g) || []).length;
  const quoteStyle = singleQuotes > doubleQuotes ? "작은따옴표 (')" : "큰따옴표 (\")";

  // 3. 변수명
  const camelCase = /[a-z][A-Z]/.test(content);
  const snakeCase = /_[a-z]/.test(content);
  const namingStyle = camelCase ? "카멜케이스" : snakeCase ? "스네이크케이스" : "혼합";

  // 4. 세미콜론
  const hasSemicolons = /;$/m.test(content);
  const semicolonStyle = hasSemicolons ? "사용" : "미사용";

  return {
    indent,
    quoteStyle,
    namingStyle,
    semicolonStyle
  };
}
```

### 6-2. 스타일 준수 검증

제안하는 코드가 프로젝트 스타일을 준수하는지 자동 검증:

```javascript
function validateCodeStyle(code, projectStyle) {
  const issues = [];

  // 1. 들여쓰기 체크
  if (projectStyle.indent === "스페이스 2칸" && /\t/.test(code)) {
    issues.push("❌ 탭 사용됨 (프로젝트는 스페이스 2칸)");
  }

  // 2. 따옴표 체크
  if (projectStyle.quoteStyle === "큰따옴표 (\")" && /'[^']+'/.test(code)) {
    issues.push("❌ 작은따옴표 사용됨 (프로젝트는 큰따옴표)");
  }

  // 3. 세미콜론 체크
  if (projectStyle.semicolonStyle === "사용" && /[^;\s]\n/.test(code)) {
    issues.push("❌ 세미콜론 누락 (프로젝트는 세미콜론 필수)");
  }

  return issues.length === 0 ? "✅ 스타일 일치" : issues.join("\n");
}
```

---

## 7. 전역 컨텍스트 스캔 절차

### 7-1. 파일 구조 스캔

```bash
# 프로젝트 내 모든 GAS 파일 나열
ls -la src/gas/*.gs

# 출력 예시:
# slack_command.gs
# judy_note.gs
# calendar_sync.gs
# claude_ai.gs
```

### 7-2. 전역 함수 스캔

```bash
# 모든 GAS 파일에서 함수 선언 찾기
grep -r "^function " src/gas/*.gs | grep -v "^//"

# 출력 예시:
# slack_command.gs:function sendEphemeralError(userId, channelId, errorMsg) {
# slack_command.gs:function fetchUserName(userId) {
# judy_note.gs:function appendMemoToArchive(userName, text, userId) {
```

### 7-3. 중복 검증 프로세스

**제안 함수**: `warmupProjectCache`

**검증**:
```bash
grep -r "warmupProjectCache" src/gas/*.gs
# 결과: 없음 → ✅ 중복 없음, 신규 함수 제안 가능
```

**제안 함수**: `sendSlackMessage`

**검증**:
```bash
grep -r "sendSlackMessage" src/gas/*.gs
# 결과: slack_notification.gs:function sendSlackMessage(channel, text)
# → ⚠️ 이미 존재, 재사용 권장
```

---

## 8. 성능 분석 절차

### 8-1. 슬랙 3초 타임아웃 예측

**분석 대상**: 슬랙 API 호출하는 모든 함수

**절차**:

1. **병목 지점 식별**
   ```javascript
   // 예상 소요 시간이 긴 작업 식별
   - SpreadsheetApp.getDataRange().getValues()  // 1-3초
   - PropertiesService.setProperty()            // 300-1000ms
   - UrlFetchApp.fetch()                        // 200-500ms
   - ScriptApp.newTrigger().create()            // 500-2000ms
   ```

2. **실행 시간 계산**
   ```
   openTaskModal() 함수:
     ├─ getProjectOptions() (캐시 미스)
     │   └─ getDataRange().getValues()  2-3초
     ├─ JSON.stringify(payload)         50ms
     └─ UrlFetchApp.fetch(slack API)    200-500ms

   총 예상 시간: 2.25-3.55초
   슬랙 제한: 3초
   판정: ⚠️ 위험 (캐시 미스 시 타임아웃 가능)
   ```

3. **리포트 테이블 작성**
   | 함수 | 예상 시간 | 슬랙 제한 | 판정 |
   |-----|----------|---------|------|
   | openTaskModal (캐시 히트) | 0.5-1초 | 3초 | ✅ 안전 |
   | openTaskModal (캐시 미스) | 2.25-3.55초 | 3초 | ⚠️ 위험 |
   | handleModalSubmission | 1-2초 | 3초 | ✅ 안전 |

4. **권장 사항 제시**
   - 캐시 워밍업 트리거 추가
   - CacheService 사용
   - 타임아웃 방어 로직

---

## 9. 우선순위 판정 기준

### 9-1. 우선순위 정의

| 우선순위 | 정의 | 예시 | 대응 시간 |
|---------|------|------|----------|
| 🔴 **Critical** | 기능 완전 중단, 데이터 손실, 보안 취약점 | 슬랙 모달 열리지 않음, API 키 노출 | 즉시 (1시간 내) |
| 🟠 **High** | 주요 기능 심각한 영향, 사용자 경험 매우 나쁨 | 에러 핸들링 누락, 간헐적 타임아웃 | 긴급 (4시간 내) |
| 🟡 **Medium** | 기능은 작동하나 불편함, 일부 케이스 오작동 | Edge Case 미처리, 느린 응답 | 정상 (1일 내) |
| 🟢 **Low** | 매우 작은 문제, 코드 품질 개선 | 변수명 개선, 주석 추가 | 여유 (1주일 내) |

### 9-2. 우선순위 판정 알고리즘

```javascript
function determinePriority(issue) {
  // Critical 판정
  if (issue.causesDataLoss || issue.exposesApiKey || issue.crashesSystem) {
    return "🔴 Critical";
  }

  // High 판정
  if (issue.affectsMainFeature || issue.causesTimeouts || issue.poorUX) {
    return "🟠 High";
  }

  // Medium 판정
  if (issue.affectsEdgeCases || issue.slowPerformance) {
    return "🟡 Medium";
  }

  // Low 판정
  return "🟢 Low";
}
```

---

## 10. 승인/반려 기준

### 10-1. 승인 기준

| 상태 | 조건 | 조치 |
|------|------|------|
| **✅ 승인** | Critical/High 이슈 **0개** | 즉시 배포 가능 |
| **⚠️ 조건부 승인** | Medium 이슈만 있음 | 배포 후 추적 관리 |
| **❌ 반려** | Critical/High 이슈 **1개 이상** | 수정 후 재검토 필요 |

### 10-2. 최종 판정 프로세스

```
발견된 이슈 분류
    ↓
우선순위별 개수 집계
    ├─ 🔴 Critical: X개
    ├─ 🟠 High: X개
    ├─ 🟡 Medium: X개
    └─ 🟢 Low: X개
    ↓
판정 알고리즘 적용
    ├─ Critical + High = 0 → ✅ 승인
    ├─ Critical + High = 0, Medium > 0 → ⚠️ 조건부 승인
    └─ Critical + High ≥ 1 → ❌ 반려
    ↓
리포트에 최종 판정 기록
    ├─ 승인/반려 사유
    ├─ 조치 사항
    └─ 다음 단계
```

---

## 📚 부록

### 부록 A: 체크리스트

#### QA 리뷰 전 체크리스트

- [ ] 전역 컨텍스트 스캔 완료
- [ ] 코드 스타일 분석 완료
- [ ] 대상 파일 전체 읽기 완료
- [ ] 성능 분석 완료 (타임아웃 예측)
- [ ] 외부 API 스펙 확인 완료

#### QA 리포트 작성 체크리스트

- [ ] Executive Summary 작성
- [ ] 코드 스타일 분석 섹션 포함
- [ ] 전역 컨텍스트 스캔 결과 포함
- [ ] 발견된 문제 테이블 작성 (우선순위, 위치, 수정안)
- [ ] 성능 분석 섹션 포함
- [ ] 솔루션 제안 (Before/After 비교)
- [ ] 테스트 스크립트 3종 포함 (단위, Mock, 통합)
- [ ] 시각화 다이어그램 포함
- [ ] 최종 판정 (승인/반려) 명시
- [ ] 액션 아이템 (Priority 1/2/3)
- [ ] 참고 문서 링크

---

### 부록 B: 템플릿 파일

**위치**: `qa/templates/`

```
qa/templates/
├── qa_review_template_v2.md          # QA 리뷰 템플릿
├── debug_report_template_v2.md       # 디버깅 리포트 템플릿
├── test_script_template.js           # 테스트 스크립트 템플릿
└── code_snippets/                    # 코드 스니펫 라이브러리
    ├── error_handling_slack.js
    ├── cache_warmup_pattern.js
    └── properties_cleanup.js
```

---

### 부록 C: 자주 사용하는 도구 함수

```javascript
// 코드 스타일 분석
function analyzeCodeStyle(content) { /* ... */ }

// 스타일 검증
function validateCodeStyle(code, projectStyle) { /* ... */ }

// 실행 시간 측정
function measureExecutionTime(funcName, func) { /* ... */ }

// PropertiesService 크기 확인
function checkPropertiesSize() { /* ... */ }
```

---

## 📞 문의 및 피드백

**QA 프로세스 관련 문의**:
- 담당자: 김감사 (QA Team Lead)
- 협업 파트너: 자비스 (PO Team Lead)

**프로세스 개선 제안**:
- 주간 회고 미팅 (매주 금요일 15분)
- 문서 수정 요청: Pull Request to `qa/QA_PROCESS_V2.md`

---

**작성자**: 🕵️ 김감사 (QA Team Lead)
**승인자**: 송용남 (팀장)
**협의 완료**: 자비스 (PO Team Lead)
**문서 버전**: v2.0
**다음 업데이트 예정**: 2026-03-05 (주간 회고 후)

---

**End of QA Process v2.0**
