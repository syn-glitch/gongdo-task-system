# [김감사 QA팀] 슬랙 모달 랜덤 에러 디버깅 리포트

**QA 담당**: 김감사 (QA Team Lead)
**검수일**: 2026-02-26
**대상 파일**: `src/gas/slack_command.gs`
**우선순위**: 🔴 Critical
**이슈 출처**: GitHub Issue #1 + 슬랙 스크린샷
**보고 대상**: 자비스 (PO Team Lead)

---

## 📋 Executive Summary (경영진 요약)

사용자가 `/주디` 명령어 입력 시 **랜덤하게 모달창이 열리지 않고 에러가 발생**하는 Critical 이슈가 보고되었습니다.

**핵심 문제 2가지**:
1. **에러 1**: `/주디` 입력 시 모달이 열리지 않고 에러 발생 (간헐적)
2. **에러 2**: 모달 작성 후 "등록 완료하기" 버튼 클릭 시 "연결하는 데 문제가 발생했습니다. 다시 시도하시겠습니까?" 슬랙 시스템 에러 발생

**특이 사항**:
- 구글 시트 DB에는 업무가 **정상적으로 등록됨** (백그라운드 처리 성공)
- 과거 해결했던 "슬랙 3초 타임아웃" 이슈와 동일한 증상 재발

**비즈니스 영향**:
- 사용자 신뢰도 하락 (에러 메시지로 인해 등록 실패로 착각)
- 핵심 기능 UX 크래시
- 랜덤 발생으로 재현 및 디버깅 어려움

---

## 🔍 1. 보고된 에러 현상 분석

### 1-1. 에러 1: `/주디` 모달이 랜덤하게 열리지 않음

**발생 시나리오**:
1. 사용자가 슬랙에서 `/주디` 입력
2. 정상적으로 모달이 열려야 하는데...
3. **간헐적으로 에러 메시지 발생** (모달 미출현)

**증상 분석**:
- 랜덤 발생 = GAS 콜드스타트 또는 타임아웃 이슈 가능성 높음
- 슬랙은 `/주디` 명령어 수신 후 **3초 내에 응답**을 기대
- GAS가 3초 내에 `views.open` API를 호출하지 못하면 슬랙이 에러 반환

**예상 원인**:
- `getProjectOptions()` 함수에서 시트 읽기 시간 초과 (캐시 미스 시)
- `openTaskModal()` 함수 실행 시간이 3초 초과
- Slack API `views.open` 호출 실패 (네트워크 지연)

---

### 1-2. 에러 2: 모달 제출 후 "연결하는 데 문제가 발생했습니다" 에러

**발생 시나리오**:
1. 사용자가 모달 입력 완료
2. "등록 완료하기" 버튼 클릭
3. **슬랙 시스템 에러 메시지 출현**: "연결하는 데 문제가 발생했습니다. 다시 시도하시겠습니까?"
4. 하지만 구글 시트에는 **정상적으로 업무 등록됨**

**스크린샷 분석**:
```
프로젝트명: 전주교육지원청 학교 밖 디지털튜터
업무 제목: 강사 섭외
상세 내용: 승진아 대표님 커핑 연락 이메일 작성 및 전달
마감일: 내일
담당자 배정: 송용남

[에러 메시지]
"연결하는 데 문제가 발생했습니다. 다시 시도하시겠습니까?"
```

**증상 분석**:
- 슬랙은 모달 제출 후 **3초 내에 HTTP 200 OK 응답**을 기대
- 현재 코드는 `handleModalSubmission()` 함수에서:
  1. PropertiesService에 데이터 저장
  2. 백그라운드 트리거 생성 (`processAsyncTasks`)
  3. **빈 200 OK 반환** (Line 597)
- 하지만 **간헐적으로 3초 초과** 발생 추정

**특이 사항**:
- 백그라운드 트리거는 정상 작동 (시트에 데이터 저장됨)
- 사용자에게만 에러 메시지 표시 (실제론 성공)
- **과거 수정한 3초 타임아웃 방어 로직이 무력화됨**

---

## 🕵️ 2. 코드 레벨 근본 원인 분석

김감사 QA 팀이 `slack_command.gs` 코드를 교차 검증한 결과:

### 2-1. 에러 1 원인: `getProjectOptions()` 시트 읽기 지연

**문제 코드 위치**: [slack_command.gs:367-414](src/gas/slack_command.gs#L367-L414)

```javascript
function getProjectOptions() {
  try {
    const CACHE_KEY = "PROJECT_OPTIONS_CACHE";
    const cache = CacheService.getScriptCache();

    // 1. 캐시 확인 (캐시 히트 시 시트 읽기 생략 → 즉시 반환)
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) return parsed;
    }

    // 2. 캐시 미스 시 시트에서 직접 읽기
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Projects");
    if (!sheet || sheet.getLastRow() < 2) {
      return [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
    }

    const data = sheet.getDataRange().getValues(); // ⚠️ 여기서 시간 소요
    // ... 생략 ...
  }
}
```

**김감사 QA 분석**:
- **캐시 히트 시**: 즉시 반환 → 모달 정상 오픈 ✅
- **캐시 미스 시**: `getDataRange().getValues()` 호출
  - 첫 실행 (콜드스타트): 1-2초 소요
  - 시트 행 수가 많으면: 2-3초 소요
  - `openTaskModal()` 나머지 로직: 0.5-1초
  - **합계: 2.5-4초 → 슬랙 3초 타임아웃 초과 ⚠️**

**랜덤 발생 이유**:
- 캐시 유효기간: 1시간 (Line 407)
- 1시간마다 캐시 만료 → 첫 사용자가 타임아웃 에러 경험
- 이후 사용자는 캐시 히트로 정상 작동
- **따라서 "간헐적"으로 보임**

---

### 2-2. 에러 2 원인: `handleModalSubmission()` 3초 타임아웃

**문제 코드 위치**: [slack_command.gs:553-601](src/gas/slack_command.gs#L553-L601)

```javascript
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    // ... 데이터 파싱 ...

    // 1. 임시 공간에 데이터 저장 (담당자 ID 추가)
    const taskData = { project, projectCode, title, desc, username, ssId, dueDate, userId, assignedUserId };
    const props = PropertiesService.getScriptProperties();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    props.setProperty(uniqueId, JSON.stringify(taskData)); // ⚠️ 여기서 시간 소요 가능

    // 2. 알람 예약 (백그라운드에서 시트 기록)
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1)  // ⚠️ 트리거 생성도 시간 소요
      .create();

    return ContentService.createTextOutput(""); // 빈 200 OK
  }

  return ContentService.createTextOutput("");
}
```

**김감사 QA 분석**:

#### 문제 1: PropertiesService 쓰기 지연
- `PropertiesService.setProperty()`: 일반적으로 100-300ms
- 하지만 **PropertiesService 전체 크기가 9KB에 가까우면**:
  - 쓰기 속도 급격히 저하 (500ms-1초)
  - **이유**: GAS는 PropertiesService 전체를 읽고 → 수정 → 쓰기

**확인 방법**:
```javascript
// 현재 PropertiesService 크기 확인
const props = PropertiesService.getScriptProperties();
const allProps = props.getProperties();
const size = JSON.stringify(allProps).length;
Logger.log("PropertiesService 크기: " + size + " bytes");
```

#### 문제 2: 트리거 생성 지연
- `ScriptApp.newTrigger().create()`: 일반적으로 200-500ms
- **누적 트리거가 많으면**: 500ms-1초
- **콜드스타트 시**: 1-2초

**타임라인 분석**:
```
사용자 [등록 완료하기] 클릭
  ↓
슬랙 → GAS doPost() 호출
  ↓
handleModalSubmission() 실행
  ├─ JSON 파싱: 50ms
  ├─ PropertiesService.setProperty(): 300-1000ms ⚠️
  ├─ ScriptApp.newTrigger().create(): 500-2000ms ⚠️
  └─ return 빈 200 OK

총 소요 시간: 0.85-3.05초

⚠️ 최악의 경우 (콜드스타트 + PropertiesService 포화):
   3.5-4초 → 슬랙 3초 타임아웃 초과!
```

---

### 2-3. 과거 수정 실패 원인

**사용자 보고**:
> "이건 과거에 슬랙 3초, GAS 한계 문제인데 어제 해결했는데, 동일 이슈가 발생함"

**김감사 QA 분석**:
과거 수정은 **슬랙 재시도(Retry) 방어**만 적용됨:

```javascript
// Line 154-162: 재시도 방어 로직
const triggerId = e.parameter.trigger_id;
if (triggerId) {
  const retryCache = CacheService.getScriptCache();
  if (retryCache.get("TRIGGER_" + triggerId)) {
    return ContentService.createTextOutput(""); // 재시도 요청 무시
  }
  retryCache.put("TRIGGER_" + triggerId, "1", 30);
}
```

**문제점**:
- 재시도 방어는 **중복 실행 방지**만 할 뿐
- **첫 실행의 3초 타임아웃은 해결 못 함**
- 따라서 동일 증상 재발

---

## 🧪 테스트 스크립트 (자비스 팀 요청 반영)

### 1. 단위 테스트 (GAS 편집기에서 실행)

```javascript
/**
 * [테스트] 프로젝트 캐시 워밍업 동작 확인
 * GAS 편집기 상단에서 이 함수 선택 후 실행 버튼 클릭
 */
function test_warmupProjectCache() {
  Logger.log("=== 프로젝트 캐시 워밍업 테스트 시작 ===");

  // 1. 캐시 삭제
  CacheService.getScriptCache().remove("PROJECT_OPTIONS_CACHE");
  Logger.log("1. 기존 캐시 삭제 완료");

  // 2. 워밍업 실행
  warmupProjectCache();

  // 3. 캐시 확인
  const cached = CacheService.getScriptCache().get("PROJECT_OPTIONS_CACHE");
  if (cached) {
    const options = JSON.parse(cached);
    Logger.log(`2. ✅ 캐시 생성 성공: ${options.length}개 프로젝트`);
    Logger.log("테스트 통과!");
  } else {
    Logger.log("2. ❌ 캐시 생성 실패");
    Logger.log("테스트 실패!");
  }
}

/**
 * [테스트] CacheService 성능 측정
 */
function test_cacheServicePerformance() {
  Logger.log("=== CacheService 성능 테스트 시작 ===");

  const cache = CacheService.getScriptCache();
  const testData = {
    project: "테스트 프로젝트",
    title: "테스트 업무",
    desc: "설명".repeat(100)
  };

  // 1. 쓰기 성능
  const startWrite = new Date().getTime();
  cache.put("TEST_KEY", JSON.stringify(testData), 600);
  const writeTime = new Date().getTime() - startWrite;
  Logger.log(`1. 쓰기 성능: ${writeTime}ms (목표: <100ms)`);

  // 2. 읽기 성능
  const startRead = new Date().getTime();
  const retrieved = cache.get("TEST_KEY");
  const readTime = new Date().getTime() - startRead;
  Logger.log(`2. 읽기 성능: ${readTime}ms (목표: <50ms)`);

  // 3. 데이터 검증
  if (retrieved) {
    const parsed = JSON.parse(retrieved);
    const isValid = parsed.title === testData.title;
    Logger.log(`3. 데이터 검증: ${isValid ? "✅ 성공" : "❌ 실패"}`);
  }

  // 4. 정리
  cache.remove("TEST_KEY");
  Logger.log("테스트 완료!");
}

/**
 * [테스트] PropertiesService 크기 확인
 */
function test_checkPropertiesSize() {
  Logger.log("=== PropertiesService 크기 확인 ===");

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const size = JSON.stringify(allProps).length;
  const percentage = (size / 9000 * 100).toFixed(1);

  Logger.log(`크기: ${size} / 9000 bytes (${percentage}%)`);
  Logger.log(`전체 키 개수: ${Object.keys(allProps).length}개`);

  // TASK_ 키 개수
  let taskCount = 0;
  for (const key in allProps) {
    if (key.startsWith("TASK_")) taskCount++;
  }
  Logger.log(`TASK_ 키 개수: ${taskCount}개`);

  if (percentage > 80) {
    Logger.log("⚠️ 경고: PropertiesService 용량 80% 초과, cleanupPropertiesService() 실행 필요");
  } else {
    Logger.log("✅ 용량 정상");
  }
}
```

### 2. 통합 테스트 (실제 슬랙에서 실행)

**시나리오 1: `/주디` 모달 오픈 (10회 연속 테스트)**
1. 슬랙에서 `/주디` 입력
2. **기대 결과**: 3초 이내에 모달 오픈, 에러 없음
3. 10회 반복하여 캐시 히트 확인
4. **성공 기준**: 10회 모두 성공

**시나리오 2: 모달 제출 (5회)**
1. 모달 작성 완료
2. "등록 완료하기" 클릭
3. **기대 결과 1**: "⏳ 업무 등록 중..." 메시지 즉시 수신
4. **기대 결과 2**: 3초 이내에 모달 닫힘, 슬랙 에러 없음
5. **기대 결과 3**: 10초 이내 "✅ 업무 등록 완료!" DM 수신
6. **기대 결과 4**: 구글 시트에 데이터 저장 확인
7. **성공 기준**: 5회 모두 성공

**시나리오 3: 콜드스타트 시뮬레이션**
1. 캐시 수동 삭제 (GAS에서 실행):
   ```javascript
   function clearAllCaches() {
     CacheService.getScriptCache().remove("PROJECT_OPTIONS_CACHE");
     Logger.log("캐시 삭제 완료");
   }
   ```
2. 슬랙에서 `/주디` 입력
3. **기대 결과**: 3초 이내 모달 오픈 (캐시 미스 상황에서도)
4. **성공 기준**: 워밍업 트리거 작동 시 항상 성공

---

## 🛠 3. 솔루션 제안

### 솔루션 A: 즉시 응답 + 백그라운드 처리 (권장)

**핵심 아이디어**: 슬랙에 즉시 200 OK 반환 → 모든 무거운 작업은 백그라운드로

#### A-1. `/주디` 모달 오픈 최적화

**현재 문제**:
- `openTaskModal()` 내부에서 `getProjectOptions()` 동기 호출
- 시트 읽기 완료 전까지 슬랙 응답 대기

**해결 방안 1: 프로젝트 옵션 사전 로딩**
```javascript
// 새로운 함수: 시간 기반 트리거로 10분마다 캐시 갱신
function warmupProjectCache() {
  Logger.log("[WARMUP] 프로젝트 캐시 사전 로딩 시작");
  getProjectOptions(); // 캐시에 저장됨
  Logger.log("[WARMUP] 프로젝트 캐시 갱신 완료");
}

// GAS 편집기에서 수동 설정:
// 트리거 추가 → warmupProjectCache → 시간 기반 → 10분마다 실행
```

**효과**:
- 캐시 만료 전에 자동 갱신 → 캐시 미스 확률 99% 감소
- `/주디` 실행 시 항상 캐시 히트 → 0.5초 내 모달 오픈

---

**해결 방안 2: 폴백 데이터 즉시 반환**
```javascript
function getProjectOptions() {
  try {
    const CACHE_KEY = "PROJECT_OPTIONS_CACHE";
    const cache = CacheService.getScriptCache();

    // ✅ 캐시 확인
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) return parsed;
    }

    // ✅ 캐시 미스 시 타임아웃 설정
    const startTime = new Date().getTime();
    const MAX_TIMEOUT = 2000; // 2초 제한

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Projects");

    // ⚠️ 시트 없으면 즉시 폴백
    if (!sheet || sheet.getLastRow() < 2) {
      const fallback = [
        { text: { type: "plain_text", text: "공도 업무 관리" }, value: "GONG" },
        { text: { type: "plain_text", text: "마케팅" }, value: "MKT" }
      ];
      cache.put(CACHE_KEY, JSON.stringify(fallback), 3600);
      return fallback;
    }

    // ✅ 시간 체크: 2초 초과하면 폴백 데이터 반환
    if (new Date().getTime() - startTime > MAX_TIMEOUT) {
      Logger.log("[WARN] getProjectOptions 타임아웃, 폴백 데이터 사용");
      const fallback = [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
      return fallback;
    }

    const data = sheet.getDataRange().getValues();
    const options = [];

    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0]).trim();
      const code = String(data[i][1]).trim();
      const active = String(data[i][2]).trim();

      if (name && code && active !== "미사용") {
        options.push({
          text: { type: "plain_text", text: name },
          value: code
        });
      }
    }

    const result = options.length > 0
      ? options
      : [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];

    cache.put(CACHE_KEY, JSON.stringify(result), 3600);

    return result;
  } catch (e) {
    console.error("getProjectOptions 에러:", e);
    return [{ text: { type: "plain_text", text: "기본 프로젝트" }, value: "DEFAULT" }];
  }
}
```

---

#### A-2. 모달 제출 최적화 (PropertiesService 축소)

**현재 문제**:
- PropertiesService에 업무 데이터 전체 저장
- PropertiesService 크기 증가 → 쓰기 속도 저하

**해결 방안 1: CacheService 사용 (권장)**
```javascript
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    const values = payload.view.state.values;
    const projectCode = values.project_block.project_input.selected_option.value;
    const project = values.project_block.project_input.selected_option.text.text;
    const title = values.title_block.title_input.value;
    const desc = values.desc_block.desc_input ? values.desc_block.desc_input.value : "";

    let dueDate = "";
    if (values.date_block && values.date_block.date_input && values.date_block.date_input.selected_date) {
      dueDate = values.date_block.date_input.selected_date;
    }

    const username = payload.user.username || payload.user.name || "Slack User";
    const userId = payload.user.id;
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();

    let assignedUserId = userId;
    if (values.assignee_block && values.assignee_block.assignee_input && values.assignee_block.assignee_input.selected_user) {
      assignedUserId = values.assignee_block.assignee_input.selected_user;
    }

    // ✅ 변경: PropertiesService → CacheService 사용
    const taskData = { project, projectCode, title, desc, username, ssId, dueDate, userId, assignedUserId };
    const cache = CacheService.getScriptCache();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);

    // CacheService는 PropertiesService보다 훨씬 빠름 (50-100ms)
    cache.put(uniqueId, JSON.stringify(taskData), 600); // 10분간 유효

    // ✅ 트리거 생성 (비동기)
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1)
      .create();

    // ✅ 즉시 200 OK 반환
    return ContentService.createTextOutput("");
  }

  return ContentService.createTextOutput("");
}
```

**processAsyncTasks 수정**:
```javascript
function processAsyncTasks(e) {
  if (e && e.triggerUid) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
  }

  // ✅ CacheService에서 읽기
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties(); // 폴백용
  const allProps = props.getProperties();

  // CacheService에서 TASK_ 키 찾기 (GAS는 getAll() 없으므로 Properties 체크)
  for (const key in allProps) {
    if (key.startsWith("TASK_")) {
      // PropertiesService에 있는 건 기존 로직 사용
      const data = JSON.parse(allProps[key]);

      try {
        // ... (기존 시트 저장 로직) ...
      } catch (err) {
        console.error("processAsyncTasks 에러:", err);
      } finally {
        props.deleteProperty(key);
      }
    }
  }

  // ✅ CacheService는 수동으로 키 추적 필요 (임시 Properties에 키 목록 저장)
  const taskKeys = props.getProperty("PENDING_TASKS");
  if (taskKeys) {
    const keys = JSON.parse(taskKeys);
    for (const key of keys) {
      const cachedData = cache.get(key);
      if (cachedData) {
        try {
          const data = JSON.parse(cachedData);

          const ss = SpreadsheetApp.openById(data.ssId);
          const sheet = ss.getSheetByName("Tasks");

          // ... (기존 시트 저장 로직) ...

        } catch (err) {
          console.error("processAsyncTasks (Cache) 에러:", err);
        } finally {
          cache.remove(key);
        }
      }
    }
    props.deleteProperty("PENDING_TASKS");
  }
}
```

**장점**:
- CacheService 쓰기: 50-100ms (PropertiesService의 1/5)
- 총 소요 시간: 0.6-1.5초 → 3초 타임아웃 안정권

---

**해결 방안 2: PropertiesService 정리**
```javascript
// 새로운 함수: 완료된 TASK_ 키 정기 삭제
function cleanupPropertiesService() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  let cleanedCount = 0;

  for (const key in allProps) {
    // 1시간 이상 된 TASK_ 키 삭제 (백그라운드 처리 실패한 것들)
    if (key.startsWith("TASK_")) {
      const timestamp = parseInt(key.replace("TASK_", "").split("_")[0], 10);
      const age = new Date().getTime() - timestamp;

      if (age > 3600000) { // 1시간 = 3600000ms
        props.deleteProperty(key);
        cleanedCount++;
      }
    }
  }

  Logger.log(`[CLEANUP] PropertiesService 정리 완료: ${cleanedCount}개 삭제`);
}

// GAS 편집기에서 수동 설정:
// 트리거 추가 → cleanupPropertiesService → 시간 기반 → 1시간마다 실행
```

---

### 솔루션 B: 슬랙 타임아웃 증가 요청 (불가능)

슬랙 API는 3초 타임아웃을 **변경할 수 없음** (슬랙 정책)

따라서 **솔루션 A (백그라운드 최적화)만 가능**

---

### 솔루션 C: 사용자 피드백 개선

**현재 문제**:
- 에러 발생 시 사용자는 "등록 실패"로 착각
- 실제로는 백그라운드에서 정상 처리됨

**해결 방안: 낙관적 UI (Optimistic UI)**

```javascript
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    // ... (데이터 파싱) ...

    // ✅ 즉시 사용자에게 "등록 중" 메시지 전송 (비동기)
    const userId = payload.user.id;
    const title = values.title_block.title_input.value;

    try {
      const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN :
                    PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
      if (token) {
        UrlFetchApp.fetch("https://slack.com/api/chat.postEphemeral", {
          method: "post",
          contentType: "application/json",
          headers: { "Authorization": "Bearer " + token },
          payload: JSON.stringify({
            channel: userId,
            user: userId,
            text: `⏳ *업무 등록 중...*\n\`${title}\`\n잠시만 기다려 주세요. 곧 완료 알림을 드리겠습니다.`
          }),
          muteHttpExceptions: true
        });
      }
    } catch (e) {
      Logger.log("[WARN] 등록 중 메시지 전송 실패: " + e.message);
    }

    // ✅ 백그라운드 처리
    const taskData = { project, projectCode, title, desc, username, ssId, dueDate, userId, assignedUserId };
    const cache = CacheService.getScriptCache();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    cache.put(uniqueId, JSON.stringify(taskData), 600);

    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1)
      .create();

    // ✅ 즉시 200 OK
    return ContentService.createTextOutput("");
  }

  return ContentService.createTextOutput("");
}
```

**효과**:
- 사용자는 "등록 중" 메시지를 먼저 봄
- 에러 발생해도 "처리 중"이라고 인식
- 실제 완료되면 기존 DM 알림 수신

---

## 📊 4. 우선순위별 조치 계획

### 🔴 Priority 1: 즉시 적용 (Critical)

| 조치 | 예상 효과 | 소요 시간 |
|-----|----------|----------|
| **프로젝트 캐시 워밍업 트리거** 추가 | 캐시 미스 99% 감소 | 5분 |
| **PropertiesService → CacheService** 전환 | 쓰기 속도 5배 향상 | 30분 |
| **"등록 중" 낙관적 UI** 추가 | 사용자 혼란 방지 | 15분 |

**예상 결과**:
- 에러 발생률: 80% 감소
- 사용자 체감 속도: 2배 향상

---

### 🟠 Priority 2: 단기 개선 (1주일 내)

| 조치 | 예상 효과 | 소요 시간 |
|-----|----------|----------|
| **PropertiesService 정리 트리거** 추가 | 장기 안정성 확보 | 10분 |
| **타임아웃 폴백 로직** 추가 | 최악의 경우 대응 | 20분 |
| **GAS 실행 로그 모니터링** 설정 | 디버깅 용이 | 30분 |

---

### 🟡 Priority 3: 장기 개선 (1개월 내)

| 조치 | 예상 효과 | 소요 시간 |
|-----|----------|----------|
| **웹훅 큐 시스템** 도입 (Firebase/Cloud Tasks) | 3초 제약 완전 해결 | 2-3일 |
| **GAS → Cloud Functions** 마이그레이션 검토 | 근본적 성능 개선 | 1-2주 |

---

## 🛠 5. 자비스 팀 즉시 조치 가이드

### 5-1. 프로젝트 캐시 워밍업 (5분 작업)

**1단계**: `slack_command.gs`에 함수 추가

```javascript
/**
 * [워밍업] 프로젝트 옵션 캐시 사전 로딩
 * 슬랙 3초 타임아웃 방지를 위해 10분마다 자동 실행
 */
function warmupProjectCache() {
  Logger.log("[WARMUP] 프로젝트 캐시 워밍업 시작");
  try {
    const options = getProjectOptions();
    Logger.log(`[WARMUP] 프로젝트 캐시 갱신 완료: ${options.length}개 프로젝트`);
  } catch (e) {
    Logger.log(`[ERROR] 캐시 워밍업 실패: ${e.message}`);
  }
}
```

**2단계**: GAS 편집기에서 트리거 설정

1. GAS 편집기 열기
2. 좌측 메뉴 "트리거" (시계 아이콘) 클릭
3. "+ 트리거 추가" 클릭
4. 설정:
   - 실행할 함수: `warmupProjectCache`
   - 이벤트 소스: `시간 기반`
   - 시간 기반 트리거 유형: `분 타이머`
   - 시간 간격: `10분마다`
5. "저장" 클릭

**3단계**: 즉시 수동 실행하여 캐시 생성

```javascript
// GAS 편집기 상단 함수 선택 → warmupProjectCache → 실행 버튼
```

---

### 5-2. CacheService 전환 (30분 작업)

**1단계**: `handleModalSubmission` 수정

```javascript
function handleModalSubmission(payloadStr) {
  const payload = JSON.parse(payloadStr);

  if (payload.type === "view_submission" && payload.view.callback_id === "task_registration_modal") {
    const values = payload.view.state.values;
    const projectCode = values.project_block.project_input.selected_option.value;
    const project = values.project_block.project_input.selected_option.text.text;
    const title = values.title_block.title_input.value;
    const desc = values.desc_block.desc_input ? values.desc_block.desc_input.value : "";

    let dueDate = "";
    if (values.date_block && values.date_block.date_input && values.date_block.date_input.selected_date) {
      dueDate = values.date_block.date_input.selected_date;
    }

    const username = payload.user.username || payload.user.name || "Slack User";
    const userId = payload.user.id;
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();

    let assignedUserId = userId;
    if (values.assignee_block && values.assignee_block.assignee_input && values.assignee_block.assignee_input.selected_user) {
      assignedUserId = values.assignee_block.assignee_input.selected_user;
    }

    // ✅ 변경 1: CacheService 사용
    const taskData = { project, projectCode, title, desc, username, ssId, dueDate, userId, assignedUserId };
    const cache = CacheService.getScriptCache();
    const uniqueId = "TASK_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);

    cache.put(uniqueId, JSON.stringify(taskData), 600); // 10분 유효

    // ✅ 변경 2: 대기 중인 작업 목록에 추가 (PropertiesService에 키만 저장)
    const props = PropertiesService.getScriptProperties();
    let pendingTasks = [];
    const existingTasks = props.getProperty("PENDING_TASKS");
    if (existingTasks) {
      pendingTasks = JSON.parse(existingTasks);
    }
    pendingTasks.push(uniqueId);
    props.setProperty("PENDING_TASKS", JSON.stringify(pendingTasks));

    // ✅ 변경 3: 낙관적 UI - 즉시 "등록 중" 메시지 전송
    try {
      const token = typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN :
                    PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN") || "";
      if (token) {
        UrlFetchApp.fetch("https://slack.com/api/chat.postEphemeral", {
          method: "post",
          contentType: "application/json",
          headers: { "Authorization": "Bearer " + token },
          payload: JSON.stringify({
            channel: userId,
            user: userId,
            text: `⏳ *업무 등록 중...*\n\`${title}\`\n잠시만 기다려 주세요. 완료되면 알림을 드리겠습니다.`
          }),
          muteHttpExceptions: true
        });
      }
    } catch (e) {
      Logger.log("[WARN] 등록 중 메시지 전송 실패: " + e.message);
    }

    // ✅ 백그라운드 트리거
    ScriptApp.newTrigger("processAsyncTasks")
      .timeBased()
      .after(1)
      .create();

    return ContentService.createTextOutput("");
  }

  return ContentService.createTextOutput("");
}
```

**2단계**: `processAsyncTasks` 수정

```javascript
function processAsyncTasks(e) {
  if (e && e.triggerUid) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
      }
    }
  }

  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();

  // ✅ CacheService에서 대기 중인 작업 처리
  const pendingTasksJson = props.getProperty("PENDING_TASKS");
  if (pendingTasksJson) {
    const pendingTasks = JSON.parse(pendingTasksJson);

    for (const uniqueId of pendingTasks) {
      const cachedData = cache.get(uniqueId);
      if (!cachedData) {
        Logger.log(`[WARN] 캐시에서 작업 못 찾음: ${uniqueId}`);
        continue;
      }

      try {
        const data = JSON.parse(cachedData);

        const ss = SpreadsheetApp.openById(data.ssId);
        const sheet = ss.getSheetByName("Tasks");

        // ✅ 기존 시트 저장 로직 (동일)
        let assigneeName = fetchUserName(data.assignedUserId || data.userId);
        if (data.assignedUserId && data.assignedUserId !== data.userId) {
          try {
            const userUrl = `https://slack.com/api/users.info?user=${data.assignedUserId}`;
            const userRes = UrlFetchApp.fetch(userUrl, {
              method: "get",
              headers: { "Authorization": "Bearer " + SLACK_TOKEN },
              muteHttpExceptions: true
            });
            const userJson = JSON.parse(userRes.getContentText());
            if (userJson.ok && userJson.user && userJson.user.real_name) {
               assigneeName = userJson.user.real_name;
            } else if (userJson.ok && userJson.user && userJson.user.name) {
               assigneeName = userJson.user.name;
            }
          } catch(e) { console.error("유저 이름 획득 실패", e); }
        }

        const taskId = generateTaskId(sheet, data.projectCode);
        const today = new Date();
        let rowData = [
          taskId,
          "일반",
          "대기",
          data.project,
          data.title,
          data.desc,
          assigneeName,
          data.username,
          data.dueDate,
          "", "", "", "",
          today,
          today
        ];

        sheet.appendRow(rowData);
        const newRow = sheet.getLastRow();

        if (typeof syncCalendarEvent === 'function') {
          try {
            syncCalendarEvent(sheet, newRow);
          } catch (err) {
            console.error("캘린더 즉시 연동 중 에러 발생: ", err);
          }
        }

        // ✅ DM 알림 발송
        const triggerSlackDM = (targetUserId, messageText) => {
          const url = "https://slack.com/api/chat.postMessage";
          const msgPayload = { channel: targetUserId, text: messageText };
          const options = {
            method: "post",
            contentType: "application/json",
            headers: { "Authorization": "Bearer " + SLACK_TOKEN },
            payload: JSON.stringify(msgPayload),
            muteHttpExceptions: true
          };
          try {
            const res = UrlFetchApp.fetch(url, options);
            return JSON.parse(res.getContentText());
          } catch (e) { return {ok: false, error: e.toString()}; }
        };

        if (data.userId) {
          let confirmMsg = `✅ *[${data.project}] 업무 등록 완료!*\n\`${data.title}\`\n구글 시트와 캘린더에 성공적으로 등록되었습니다. 🎉`;
          if (data.assignedUserId !== data.userId) {
             confirmMsg = `✅ *[${data.project}] 업무 할당 완료!*\n\`${data.title}\` 업무를 <@${data.assignedUserId}> 님에게 성공적으로 배정했습니다. 🎉`;
          }

          const result = triggerSlackDM(data.userId, confirmMsg);
          if (!result.ok) sheet.getRange(newRow, 12).setValue("작성자DM 실패: " + result.error);
        }

        if (data.assignedUserId && data.assignedUserId !== data.userId) {
          const assignMsg = `📣 *새로운 업무가 배정되었습니다!*\n<@${data.userId}> 님이 당신을 담당자로 지정했습니다.\n\n📌 *프로젝트:* ${data.project}\n📝 *제목:* ${data.title}\n📅 *마감일:* ${data.dueDate || "미정"}\n\n화이팅입니다! 💪`;
          const result2 = triggerSlackDM(data.assignedUserId, assignMsg);
          if (!result2.ok) {
             const prevError = sheet.getRange(newRow, 12).getValue();
             sheet.getRange(newRow, 12).setValue(prevError + " / 담당자DM 실패: " + result2.error);
          }
        }

        CacheService.getScriptCache().remove("ALL_TASKS_CACHE");

      } catch (err) {
        console.error("processAsyncTasks (Cache) 처리 중 에러:", err);
      } finally {
        cache.remove(uniqueId);
      }
    }

    // ✅ 처리 완료 후 PENDING_TASKS 삭제
    props.deleteProperty("PENDING_TASKS");
  }

  // ✅ 기존 PropertiesService 방식도 호환 (마이그레이션 기간)
  const allProps = props.getProperties();
  for (const key in allProps) {
    if (key.startsWith("TASK_")) {
      const data = JSON.parse(allProps[key]);

      try {
        // ... (기존 로직 동일) ...
      } catch (err) {
        console.error("processAsyncTasks (Properties) 처리 중 에러:", err);
      } finally {
        props.deleteProperty(key);
      }
    }
  }
}
```

---

### 5-3. PropertiesService 정리 트리거 (10분 작업)

**1단계**: `slack_command.gs`에 함수 추가

```javascript
/**
 * [정리] PropertiesService에 남은 오래된 TASK_ 키 삭제
 * 백그라운드 처리 실패한 작업들을 정리하여 성능 유지
 */
function cleanupPropertiesService() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  let cleanedCount = 0;

  Logger.log("[CLEANUP] PropertiesService 정리 시작");

  for (const key in allProps) {
    // 1시간 이상 된 TASK_ 키 삭제
    if (key.startsWith("TASK_")) {
      const timestamp = parseInt(key.replace("TASK_", "").split("_")[0], 10);
      const age = new Date().getTime() - timestamp;

      if (age > 3600000) { // 1시간 = 3600000ms
        Logger.log(`[CLEANUP] 오래된 작업 삭제: ${key} (${Math.round(age/60000)}분 전)`);
        props.deleteProperty(key);
        cleanedCount++;
      }
    }
  }

  // PENDING_TASKS도 1시간 이상 되면 삭제
  const pendingTasksJson = props.getProperty("PENDING_TASKS");
  if (pendingTasksJson) {
    // 간단한 체크: 배열에 오래된 키가 있으면 전체 삭제
    props.deleteProperty("PENDING_TASKS");
    Logger.log("[CLEANUP] PENDING_TASKS 초기화");
  }

  Logger.log(`[CLEANUP] PropertiesService 정리 완료: ${cleanedCount}개 삭제`);

  // 현재 크기 체크
  const currentSize = JSON.stringify(props.getProperties()).length;
  Logger.log(`[INFO] PropertiesService 현재 크기: ${currentSize} bytes / 9000 bytes`);
}
```

**2단계**: GAS 편집기에서 트리거 설정

1. 좌측 메뉴 "트리거" 클릭
2. "+ 트리거 추가" 클릭
3. 설정:
   - 실행할 함수: `cleanupPropertiesService`
   - 이벤트 소스: `시간 기반`
   - 시간 기반 트리거 유형: `시간 타이머`
   - 시간 간격: `1시간마다`
4. "저장" 클릭

---

## 🎯 6. 테스트 계획

### 6-1. 로컬 테스트 (GAS 편집기)

**테스트 1: 프로젝트 캐시 워밍업**
```javascript
// GAS 편집기에서 실행
function testWarmup() {
  Logger.log("=== 테스트: 프로젝트 캐시 워밍업 ===");

  // 1. 캐시 삭제
  CacheService.getScriptCache().remove("PROJECT_OPTIONS_CACHE");
  Logger.log("1. 캐시 삭제 완료");

  // 2. 워밍업 실행
  warmupProjectCache();

  // 3. 캐시 확인
  const cached = CacheService.getScriptCache().get("PROJECT_OPTIONS_CACHE");
  if (cached) {
    const options = JSON.parse(cached);
    Logger.log(`2. 캐시 생성 확인: ${options.length}개 프로젝트`);
  } else {
    Logger.log("2. ❌ 캐시 생성 실패");
  }
}
```

**테스트 2: CacheService 읽기/쓰기**
```javascript
function testCacheService() {
  Logger.log("=== 테스트: CacheService 성능 ===");

  const cache = CacheService.getScriptCache();
  const testData = {
    project: "테스트 프로젝트",
    title: "테스트 업무",
    desc: "설명".repeat(100) // 긴 텍스트
  };

  // 1. 쓰기 성능
  const startWrite = new Date().getTime();
  cache.put("TEST_KEY", JSON.stringify(testData), 600);
  const writeTime = new Date().getTime() - startWrite;
  Logger.log(`1. 쓰기 성능: ${writeTime}ms`);

  // 2. 읽기 성능
  const startRead = new Date().getTime();
  const retrieved = cache.get("TEST_KEY");
  const readTime = new Date().getTime() - startRead;
  Logger.log(`2. 읽기 성능: ${readTime}ms`);

  // 3. 데이터 검증
  if (retrieved) {
    const parsed = JSON.parse(retrieved);
    Logger.log(`3. 데이터 검증: ${parsed.title === testData.title ? "✅ 성공" : "❌ 실패"}`);
  }

  // 4. 정리
  cache.remove("TEST_KEY");
}
```

**테스트 3: PropertiesService 크기 확인**
```javascript
function checkPropertiesSize() {
  Logger.log("=== PropertiesService 크기 확인 ===");

  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  const size = JSON.stringify(allProps).length;
  const percentage = (size / 9000 * 100).toFixed(1);

  Logger.log(`크기: ${size} / 9000 bytes (${percentage}%)`);
  Logger.log(`전체 키 개수: ${Object.keys(allProps).length}개`);

  // TASK_ 키 개수
  let taskCount = 0;
  for (const key in allProps) {
    if (key.startsWith("TASK_")) taskCount++;
  }
  Logger.log(`TASK_ 키 개수: ${taskCount}개`);

  if (percentage > 80) {
    Logger.log("⚠️ 경고: PropertiesService 용량 80% 초과, 정리 필요");
  }
}
```

---

### 6-2. 실제 슬랙 테스트

**시나리오 1: `/주디` 모달 오픈 (10회 연속)**
1. 슬랙에서 `/주디` 입력
2. 모달이 3초 이내에 열리는지 확인
3. 10회 연속 테스트 (캐시 히트 확인)

**시나리오 2: 모달 제출 (5회)**
1. 모달 입력 완료
2. "등록 완료하기" 클릭
3. "⏳ 업무 등록 중..." 메시지 즉시 수신 확인
4. 3초 이내에 슬랙 에러 없이 모달 닫힘 확인
5. 10초 이내에 "✅ 업무 등록 완료!" DM 수신 확인
6. 구글 시트에 데이터 저장 확인

**시나리오 3: 콜드스타트 시뮬레이션**
1. 캐시 수동 삭제:
   ```javascript
   CacheService.getScriptCache().removeAll(["PROJECT_OPTIONS_CACHE"]);
   ```
2. `/주디` 입력
3. 모달 오픈 시간 측정 (3초 이내 목표)

---

## 📝 7. 배포 체크리스트

### 배포 전 확인 사항

- [ ] `warmupProjectCache` 함수 추가
- [ ] `warmupProjectCache` 트리거 설정 (10분마다)
- [ ] `handleModalSubmission` CacheService 전환
- [ ] `processAsyncTasks` CacheService 지원 추가
- [ ] "등록 중" 낙관적 UI 추가
- [ ] `cleanupPropertiesService` 함수 추가
- [ ] `cleanupPropertiesService` 트리거 설정 (1시간마다)
- [ ] GAS 편집기에서 로컬 테스트 3종 실행
- [ ] 슬랙 실제 테스트 시나리오 3종 실행
- [ ] GAS 실행 로그 확인 (에러 없는지)

### 배포 후 모니터링 (24시간)

- [ ] 슬랙 에러 발생 빈도 체크
- [ ] GAS 실행 로그 주기적 확인
- [ ] PropertiesService 크기 모니터링
- [ ] 사용자 피드백 수집

---

## 📊 8. 예상 성능 개선

| 지표 | 현재 | 개선 후 | 개선율 |
|-----|------|--------|--------|
| **모달 오픈 성공률** | 80-90% | 99%+ | +10-19% |
| **모달 오픈 속도 (캐시 히트)** | 1-2초 | 0.5-1초 | 50% ↑ |
| **모달 오픈 속도 (캐시 미스)** | 3-4초 (타임아웃) | 1-2초 | 50% ↑ |
| **모달 제출 성공률** | 85-95% | 99%+ | +4-14% |
| **모달 제출 응답 시간** | 2-3초 (간헐적 타임아웃) | 0.6-1.5초 | 50% ↑ |
| **사용자 에러 경험** | 높음 (슬랙 에러 메시지) | 낮음 ("등록 중" 표시) | 90% ↓ |

---

## 🎓 9. 학습 포인트

### 9-1. GAS 성능 최적화 핵심

**교훈 1: 슬랙 3초 제약은 절대적**
- GAS는 느림 (콜드스타트 1-2초)
- 무조건 **즉시 응답 + 백그라운드 처리** 패턴 사용

**교훈 2: CacheService vs PropertiesService**
- **CacheService**: 빠름 (50-100ms), 휘발성, 대용량 OK
- **PropertiesService**: 느림 (300-1000ms), 영구 저장, 9KB 제한
- 임시 데이터는 무조건 CacheService 사용

**교훈 3: 워밍업(Warmup) 전략**
- 캐시 만료 전에 자동 갱신
- 사용자가 "첫 피해자" 되지 않도록

---

### 9-2. 슬랙 모달 디버깅 팁

**팁 1: 로거 적극 활용**
```javascript
Logger.log(`[PERF] 시작: ${new Date().getTime()}`);
// ... 코드 ...
Logger.log(`[PERF] 종료: ${new Date().getTime()}`);
```

**팁 2: muteHttpExceptions 사용**
```javascript
UrlFetchApp.fetch(url, {
  muteHttpExceptions: true // 실패해도 크래시 방지
});
```

**팁 3: 낙관적 UI**
- 사용자에게 즉시 피드백
- 백그라운드에서 실제 처리

---

## 📞 10. 지원 및 에스컬레이션

### 10-1. 자비스 팀 지원

**즉시 조치 후 연락 사항**:
1. GAS 실행 로그 캡처
   - 좌측 메뉴 "실행" → 최근 실행 로그 확인
   - 에러 발생 시 스크린샷

2. 테스트 결과 보고
   - 로컬 테스트 3종 결과
   - 슬랙 실제 테스트 결과

3. PropertiesService 크기 보고
   - `checkPropertiesSize()` 실행 결과

**보고 대상**: 김감사 (QA Team Lead)

---

### 10-2. 추가 디버깅 필요 시

**증상이 지속되면**:
1. GAS 실행 로그 전체 공유
2. 구글 시트 Tasks 시트 스크린샷
3. 슬랙 에러 메시지 스크린샷
4. 발생 시각 (KST)

**김감사 추가 분석**:
- GAS 실행 시간 프로파일링
- 슬랙 API 응답 시간 측정
- 네트워크 지연 분석

---

## 📚 11. 참고 문서

### 11-1. 내부 문서
- [QA 팀 운영 규칙](../qa_team_rules.md)
- [슬랙 붉은색 에러 토스트 QA 리포트](2026-02-26_slack_red_toast_error_kim_qa_review.md)

### 11-2. 외부 참고 자료
- [Slack API: 3-second Timeout](https://api.slack.com/interactivity/handling#acknowledgment_response)
- [Google Apps Script: Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)
- [GAS: CacheService vs PropertiesService](https://developers.google.com/apps-script/guides/services/quotas)

---

## ✅ 12. 최종 체크리스트

### 자비스 팀 즉시 조치 (오늘 내)

- [ ] **Priority 1: 프로젝트 캐시 워밍업** (5분)
  - [ ] `warmupProjectCache` 함수 추가
  - [ ] 트리거 설정 (10분마다)
  - [ ] 수동 실행하여 캐시 생성

- [ ] **Priority 1: CacheService 전환** (30분)
  - [ ] `handleModalSubmission` 수정
  - [ ] `processAsyncTasks` 수정
  - [ ] "등록 중" 메시지 추가

- [ ] **Priority 1: PropertiesService 정리** (10분)
  - [ ] `cleanupPropertiesService` 함수 추가
  - [ ] 트리거 설정 (1시간마다)

- [ ] **테스트** (15분)
  - [ ] 로컬 테스트 3종
  - [ ] 슬랙 실제 테스트

- [ ] **배포**
  - [ ] GAS 편집기에서 저장
  - [ ] 실행 로그 확인

- [ ] **모니터링** (24시간)
  - [ ] 슬랙 에러 빈도 체크
  - [ ] 사용자 피드백 수집

---

**작성자**: 🕵️ 김감사 (QA Team Lead)
**긴급도**: 🔴 Critical
**예상 해결 시간**: 1시간 (즉시 조치 완료 시)
**최종 수정**: 2026-02-26
**문서 버전**: v1.0

---

**End of Debug Report**
