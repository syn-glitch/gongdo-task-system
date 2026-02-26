# 🤖 AI 에이전트 자동화 시스템 최종 제안서

**작성일**: 2026-02-27
**작성자**: 자비스 (PO) + 김감사 (QA)
**목적**: 에이전트 간 문서 교환 자동화로 팀장님의 수동 복사/붙여넣기 작업 제거

---

## 📋 Executive Summary

### 현재 문제점
- ❌ 팀장님이 **자비스 개발 문서 → 김감사에게 복사/붙여넣기**
- ❌ 팀장님이 **김감사 QA 보고서 → 자비스에게 복사/붙여넣기**
- ❌ 핑퐁 1회당 **6분 소요** (평균 3회 = 18분 낭비)

### 해결 방안
✅ **"하이브리드 자동화 시스템 v1.0"** 구축
- 자비스 제안 2 (구글 시트 큐) + 제안 1 (슬랙 알림) 결합
- 팀장님 개입: **요청 작성(1분) + 최종 배포(5분)만**
- 나머지 모든 핑퐁 과정 **완전 자동화**

### 예상 효과
| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| 총 소요 시간 | 57분 | 49분 | **-14%** |
| 팀장님 개입 시간 | 14분 | 6분 | **-57%** |
| 복사/붙여넣기 횟수 | 6회 | **0회** | **-100%** |

---

## 🎯 최종 채택안: "하이브리드 자동화 시스템 v1.0"

### 시스템 아키텍처

```
[팀장님]
    ↓ (구글 시트에 요청 작성: 1분)
┌─────────────────────────────────┐
│   Agent_Tasks 시트 (작업 큐)     │
│  - 상태 관리: 대기→개발→QA→승인  │
│  - 문서 링크, 에러 카운트 등 기록 │
└─────────────────────────────────┘
    ↓                         ↑
    ↓ (1분마다 읽기)          ↑ (상태 업데이트)
    ↓                         ↑
┌─────────────┐         ┌─────────────┐
│ 자비스 봇   │ ←──핑퐁──→ │ 김감사 봇   │
│ (개발 담당) │         │ (QA 담당)   │
└─────────────┘         └─────────────┘
    ↓
    ↓ (최종 승인 시)
    ↓
[슬랙 알림 → @팀장님]
"🚀 AT-001 배포 가능합니다!"
```

---

## 🗂️ 핵심 1: Agent_Tasks 시트 구조

### 시트명: `Agent_Tasks`

| 컬럼 | 필드명 | 타입 | 설명 | 샘플 데이터 |
|------|--------|------|------|-------------|
| **A** | Task_ID | Text | 고유 작업 ID | `AT-001` |
| **B** | 요청_내용 | Text | 팀장님 요청 사항 | "슬랙 모달 랜덤 에러 수정" |
| **C** | 상태 | Dropdown | 워크플로우 상태 | `대기중` → `개발중` → `QA_대기` → `디버깅_필요` → `최종_승인` |
| **D** | 담당_에이전트 | Text | 현재 작업 중인 에이전트 | `자비스` or `김감사` |
| **E** | 개발_문서_링크 | Text | 자비스가 작성한 .md 파일 경로 | `agent_work/jarvis_po/2026-02-27_hotfix.md` |
| **F** | QA_문서_링크 | Text | 김감사가 작성한 QA 보고서 경로 | `qa/qa_reviews/2026-02-27_qa_report.md` |
| **G** | QA_체크리스트 | Text | QA v2.0 7단계 진행 상황 | `[✅][✅][✅][⏳][ ][ ][ ]` |
| **H** | 에러_카운트 | Number | 발견된 Critical 이슈 개수 | `3` |
| **I** | 핑퐁_횟수 | Number | 자비스 ↔ 김감사 반복 횟수 | `2` |
| **J** | 등록_시간 | Datetime | 요청 시각 | `2026-02-27 14:30` |
| **K** | 완료_시간 | Datetime | 최종 승인 시각 | `2026-02-27 15:45` |
| **L** | 비고 | Text | 특이사항 메모 | "긴급 핫픽스" |

### 상태(State) 전환 규칙

```
[대기중]
   ↓ (자비스 봇이 감지)
[개발중]
   ↓ (자비스 개발 완료)
[QA_대기]
   ↓ (김감사 봇이 감지)
[QA_진행중]
   ↓
[분기점]
   ├─→ [디버깅_필요] (에러 발견) → [개발중]으로 복귀
   └─→ [최종_승인] (이슈 없음) → 완료 + 슬랙 알림
```

---

## 🤖 핵심 2: 자비스 자동 개발 트리거

### 함수명: `jarvis_AutoDevelopmentTrigger()`
### 실행 주기: **1분마다** (GAS 시간 기반 트리거)

```javascript
/**
 * [자비스 에이전트] 시트 기반 자동 개발 트리거
 * 실행 주기: 1분마다 (GAS 시간 기반 트리거)
 */
function jarvis_AutoDevelopmentTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Agent_Tasks");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = i + 1; // 시트 행 번호
    const taskId = data[i][0];   // A열: Task_ID
    const taskDesc = data[i][1]; // B열: 요청_내용
    const status = data[i][2];   // C열: 상태
    const agent = data[i][3];    // D열: 담당_에이전트

    // ========================================
    // Case 1: 팀장님이 새 요청 등록 (상태: "대기중")
    // ========================================
    if (status === "대기중") {
      Logger.log(`[자비스] ${taskId} 개발 시작: ${taskDesc}`);

      // 1. 상태 변경: 대기중 → 개발중
      sheet.getRange(row, 3).setValue("개발중");
      sheet.getRange(row, 4).setValue("자비스");

      // 2. TODO: 여기서 Claude API 호출하여 개발 시작
      //    - taskDesc를 프롬프트로 전달
      //    - 개발 완료 후 .md 파일 저장
      //    - 파일 경로를 E열(개발_문서_링크)에 기록

      // 3. 개발 완료 후 상태 변경: 개발중 → QA_대기
      // sheet.getRange(row, 3).setValue("QA_대기");
      // sheet.getRange(row, 5).setValue("agent_work/jarvis_po/2026-02-27_xxx.md");

      continue;
    }

    // ========================================
    // Case 2: QA에서 디버깅 요청 (상태: "디버깅_필요")
    // ========================================
    if (status === "디버깅_필요" && agent === "자비스") {
      const qaDocLink = data[i][5]; // F열: QA 문서 링크
      const errorCount = data[i][7]; // H열: 에러 카운트
      const pingPong = data[i][8];   // I열: 핑퐁 횟수

      Logger.log(`[자비스] ${taskId} 디버깅 시작 (QA 리뷰: ${qaDocLink}, 에러: ${errorCount}건)`);

      // 1. 상태 변경: 디버깅_필요 → 개발중
      sheet.getRange(row, 3).setValue("개발중");

      // 2. TODO: QA 문서(qaDocLink) 읽어서 에러 사항 파악 후 수정
      //    - .md 파일 읽기 (DriveApp 또는 UrlFetchApp)
      //    - 에러 리스트 파싱
      //    - 코드 수정 후 .md 파일 재생성

      // 3. 수정 완료 후 상태 변경: 개발중 → QA_대기
      // sheet.getRange(row, 3).setValue("QA_대기");
      // sheet.getRange(row, 9).setValue(pingPong + 1); // 핑퐁 횟수 +1

      continue;
    }
  }
}
```

---

## 🔍 핵심 3: 김감사 자동 QA 트리거

### 함수명: `kimQA_AutoReviewTrigger()`
### 실행 주기: **1분마다** (GAS 시간 기반 트리거)

```javascript
/**
 * [김감사 에이전트] 시트 기반 자동 QA 트리거
 * 실행 주기: 1분마다 (GAS 시간 기반 트리거)
 */
function kimQA_AutoReviewTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Agent_Tasks");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = i + 1; // 시트 행 번호
    const taskId = data[i][0];      // A열: Task_ID
    const status = data[i][2];      // C열: 상태
    const devDocLink = data[i][4];  // E열: 개발 문서 링크
    const pingPong = data[i][8];    // I열: 핑퐁 횟수

    // ========================================
    // Case 1: QA 대기 중인 작업 발견
    // ========================================
    if (status === "QA_대기") {
      Logger.log(`[김감사] ${taskId} QA 시작 (개발 문서: ${devDocLink})`);

      // 1. 상태 변경: QA_대기 → QA_진행중
      sheet.getRange(row, 3).setValue("QA_진행중");
      sheet.getRange(row, 4).setValue("김감사");

      // 2. TODO: devDocLink 파일 읽어서 QA v2.0 프로세스 실행
      //    - Phase 0: Global Context Scan
      //    - Phase 1: Code Style Analysis
      //    - Phase 2: Problem Discovery
      //    - Phase 3: Solution Proposal
      //    - Phase 4: Test Script Creation
      //    - Phase 5: Performance Analysis
      //    - Phase 6: Report Writing

      // 3. QA 진행 중 체크리스트 업데이트 (G열)
      //    - 각 Phase 완료 시마다 실시간 업데이트
      //    sheet.getRange(row, 7).setValue("[✅][✅][⏳][ ][ ][ ][ ]");

      // 4. QA 완료 후 결과 분석
      const errorCount = 3; // TODO: 실제 Critical 이슈 개수
      const qaReportPath = `qa/qa_reviews/2026-02-27_${taskId}_qa_report.md`;

      // 5. QA 문서 링크 기록 (F열)
      sheet.getRange(row, 6).setValue(qaReportPath);

      // 6. 에러 카운트 기록 (H열)
      sheet.getRange(row, 8).setValue(errorCount);

      // 7. QA 체크리스트 완료 (G열)
      sheet.getRange(row, 7).setValue("[✅][✅][✅][✅][✅][✅][✅]");

      // 8. 상태 분기
      if (errorCount > 0) {
        // 에러 발견 → 자비스에게 디버깅 요청
        sheet.getRange(row, 3).setValue("디버깅_필요");
        sheet.getRange(row, 4).setValue("자비스");
        Logger.log(`[김감사] ${taskId} QA 완료 → 에러 ${errorCount}건 발견, 디버깅 요청`);
      } else {
        // 이슈 없음 → 최종 승인 + 슬랙 알림
        sheet.getRange(row, 3).setValue("최종_승인");
        sheet.getRange(row, 11).setValue(new Date()); // K열: 완료_시간
        sendSlackNotification(taskId); // 팀장님께 알림
        Logger.log(`[김감사] ${taskId} QA 완료 → 최종 승인, 슬랙 알림 전송`);
      }

      continue;
    }
  }
}
```

---

## 📢 핵심 4: 슬랙 알림 (최종 승인 시)

### 함수명: `sendSlackNotification(taskId)`

```javascript
/**
 * [공통] 최종 승인 시 팀장님께 슬랙 알림
 */
function sendSlackNotification(taskId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Agent_Tasks");
  const data = sheet.getDataRange().getValues();

  // taskId로 해당 행 찾기
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId) {
      const taskDesc = data[i][1];  // B열: 요청 내용
      const devDoc = data[i][4];    // E열: 개발 문서
      const qaDoc = data[i][5];     // F열: QA 문서
      const pingPong = data[i][8];  // I열: 핑퐁 횟수
      const startTime = data[i][9]; // J열: 등록 시간
      const endTime = data[i][10];  // K열: 완료 시간

      // 소요 시간 계산
      const elapsed = Math.round((endTime - startTime) / 60000); // 분 단위

      const message = `
✅ *[최종 승인] ${taskId}*

📋 *요청 내용*
${taskDesc}

📊 *처리 결과*
🔄 자비스 ↔ 김감사 핑퐁: ${pingPong}회
⏱️ 총 소요 시간: ${elapsed}분
📄 개발 문서: ${devDoc}
📊 QA 보고서: ${qaDoc}

🚀 *코드 배포를 진행해주세요!*
      `;

      // 슬랙 웹훅으로 메시지 전송
      const webhookUrl = PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL");
      if (!webhookUrl) {
        Logger.log("[ERROR] SLACK_WEBHOOK_URL이 설정되지 않았습니다.");
        return;
      }

      try {
        UrlFetchApp.fetch(webhookUrl, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            text: message,
            channel: "#agent-notifications", // 팀장님이 보는 채널
            username: "Agent Bot",
            icon_emoji: ":robot_face:"
          }),
          muteHttpExceptions: true
        });

        Logger.log(`[알림] ${taskId} 최종 승인 - 슬랙 알림 전송 완료`);
      } catch (e) {
        Logger.log(`[ERROR] 슬랙 알림 전송 실패: ${e.message}`);
      }

      break;
    }
  }
}
```

---

## 🎬 워크플로우 시나리오 예시

### 시나리오: "슬랙 모달 랜덤 에러 수정"

#### Step 1: 팀장님 요청 (14:30)
```
[팀장님이 Agent_Tasks 시트에 입력]
A열(Task_ID): AT-001
B열(요청_내용): "슬랙 모달 랜덤 에러 수정"
C열(상태): "대기중"
```

#### Step 2: 자비스 자동 개발 (14:31 ~ 14:41)
```
[14:31] jarvis_AutoDevelopmentTrigger() 실행
  → 상태 "대기중" 감지
  → 상태 변경: "개발중"
  → Claude API 호출하여 코드 작성

[14:41] 개발 완료
  → E열(개발_문서_링크): "agent_work/jarvis_po/2026-02-27_slack_modal_hotfix_v3.md"
  → 상태 변경: "QA_대기"
```

#### Step 3: 김감사 자동 QA (14:42 ~ 14:57)
```
[14:42] kimQA_AutoReviewTrigger() 실행
  → 상태 "QA_대기" 감지
  → 상태 변경: "QA_진행중"
  → QA v2.0 프로세스 실행

[14:57] QA 완료
  → F열(QA_문서_링크): "qa/qa_reviews/2026-02-27_AT-001_qa_report.md"
  → H열(에러_카운트): 3
  → 상태 변경: "디버깅_필요"
  → D열(담당_에이전트): "자비스"
```

#### Step 4: 자비스 디버깅 (14:58 ~ 15:06)
```
[14:58] jarvis_AutoDevelopmentTrigger() 실행
  → 상태 "디버깅_필요" 감지
  → 상태 변경: "개발중"
  → QA 문서 읽어서 에러 수정

[15:06] 수정 완료
  → I열(핑퐁_횟수): 2
  → 상태 변경: "QA_대기"
```

#### Step 5: 김감사 2차 QA (15:07 ~ 15:17)
```
[15:07] kimQA_AutoReviewTrigger() 실행
  → 상태 "QA_대기" 감지
  → 상태 변경: "QA_진행중"
  → QA v2.0 재실행

[15:17] QA 완료
  → H열(에러_카운트): 0 (모든 이슈 해결!)
  → 상태 변경: "최종_승인"
  → K열(완료_시간): 2026-02-27 15:17
  → sendSlackNotification() 호출
```

#### Step 6: 슬랙 알림 (15:17)
```
[슬랙 #agent-notifications 채널]
✅ [최종 승인] AT-001

📋 요청 내용
슬랙 모달 랜덤 에러 수정

📊 처리 결과
🔄 자비스 ↔ 김감사 핑퐁: 2회
⏱️ 총 소요 시간: 47분
📄 개발 문서: agent_work/jarvis_po/2026-02-27_slack_modal_hotfix_v3.md
📊 QA 보고서: qa/qa_reviews/2026-02-27_AT-001_qa_report.md

🚀 코드 배포를 진행해주세요!
```

#### Step 7: 팀장님 배포 (15:22)
```
[팀장님이 슬랙 알림 확인]
  → 개발 문서 확인
  → QA 보고서 확인
  → GAS 스크립트에 코드 배포
  → 완료!
```

**총 소요 시간**: 52분 (요청 14:30 → 배포 15:22)
**팀장님 개입**: 2회 (요청 작성 1분 + 배포 5분 = 6분)
**자동화된 핑퐁**: 2회 (자비스 ↔ 김감사)

---

## 📊 Before/After 비교

### Before (수동 복사/붙여넣기)

| 단계 | 소요 시간 | 팀장님 개입 | 누적 시간 |
|------|----------|------------|----------|
| 1. 자비스 개발 | 10분 | - | 10분 |
| 2. **팀장님 복사 → 김감사** | **3분** | ✅ | 13분 |
| 3. 김감사 QA | 15분 | - | 28분 |
| 4. **팀장님 복사 → 자비스** | **3분** | ✅ | 31분 |
| 5. 자비스 수정 | 8분 | - | 39분 |
| 6. **팀장님 복사 → 김감사** | **3분** | ✅ | 42분 |
| 7. 김감사 2차 QA | 10분 | - | 52분 |
| 8. **팀장님 배포** | **5분** | ✅ | **57분** |

- **총 소요 시간**: 57분
- **팀장님 개입**: 4회 (14분)
- **복사/붙여넣기**: 6회

---

### After (자동화 시스템)

| 단계 | 소요 시간 | 팀장님 개입 | 누적 시간 |
|------|----------|------------|----------|
| 1. **팀장님 시트 요청 작성** | **1분** | ✅ | 1분 |
| 2. 자비스 개발 (자동) | 10분 | - | 11분 |
| 3. 김감사 QA (자동) | 15분 | - | 26분 |
| 4. 자비스 수정 (자동) | 8분 | - | 34분 |
| 5. 김감사 2차 QA (자동) | 10분 | - | 44분 |
| 6. 슬랙 알림 수신 | 즉시 | - | 44분 |
| 7. **팀장님 배포** | **5분** | ✅ | **49분** |

- **총 소요 시간**: 49분 (**-14%**)
- **팀장님 개입**: 2회 (6분, **-57%**)
- **복사/붙여넣기**: **0회 (-100%)**

---

## 🚀 구현 로드맵

### Phase 1: MVP (최소 기능 프로토타입) - **1일 소요**

**목표**: 핵심 워크플로우 자동화 (상태 전환 + 트리거)

- [ ] `Agent_Tasks` 시트 생성
  - 컬럼 A-L 설정
  - 상태 드롭다운 설정 (`대기중`, `개발중`, `QA_대기`, `디버깅_필요`, `최종_승인`)

- [ ] 자비스 트리거 함수 작성
  - `jarvis_AutoDevelopmentTrigger()` 기본 로직 구현
  - 상태 감지 및 변경 로직

- [ ] 김감사 트리거 함수 작성
  - `kimQA_AutoReviewTrigger()` 기본 로직 구현
  - 상태 감지 및 변경 로직

- [ ] GAS 시간 기반 트리거 설정
  - `jarvis_AutoDevelopmentTrigger`: 1분마다
  - `kimQA_AutoReviewTrigger`: 1분마다

- [ ] 수동 테스트
  - 팀장님이 시트에 요청 작성
  - 자비스/김감사 봇이 상태 변경하는지 확인

**완료 기준**: 상태 전환이 자동으로 동작하면 MVP 성공

---

### Phase 2: 문서 자동 생성 - **2일 소요**

**목표**: .md 파일 읽기/쓰기 자동화

- [ ] 자비스: 개발 문서 자동 생성
  - Claude API 연동 (또는 수동으로 .md 작성)
  - E열(개발_문서_링크)에 파일 경로 기록

- [ ] 김감사: QA 문서 자동 생성
  - 개발 문서 읽기 (DriveApp 또는 UrlFetchApp)
  - QA v2.0 프로세스 실행
  - F열(QA_문서_링크)에 파일 경로 기록

- [ ] QA 체크리스트 자동 업데이트
  - G열에 `[✅][✅][⏳][ ][ ][ ][ ]` 형식으로 진행 상황 표시

- [ ] 에러 카운트 자동 계산
  - H열에 Critical 이슈 개수 기록

**완료 기준**: 전체 워크플로우가 문서 생성까지 자동으로 완료

---

### Phase 3: 슬랙 알림 - **1일 소요**

**목표**: 최종 승인 시 팀장님께 슬랙 알림

- [ ] 슬랙 Webhook URL 생성
  - Slack App 생성 (Incoming Webhooks 활성화)
  - Webhook URL을 GAS Script Properties에 저장

- [ ] `sendSlackNotification()` 함수 구현
  - 최종 승인 시 호출
  - 작업 요약 정보 포함 (핑퐁 횟수, 소요 시간, 문서 링크)

- [ ] 김감사 트리거에 통합
  - 상태 "최종_승인" 시 `sendSlackNotification()` 자동 호출

**완료 기준**: 슬랙 알림이 정상적으로 전송됨

---

### Phase 4: 대시보드 (Optional) - **2일 소요**

**목표**: 에이전트 성과 지표 시각화

- [ ] `Agent_Stats` 시트 생성
  - 평균 개발 시간
  - 평균 QA 시간
  - 평균 핑퐁 횟수
  - First-time Pass Rate
  - Critical 이슈율

- [ ] 주간 리포트 자동 생성
  - 매주 월요일 오전 9시 트리거
  - 지난주 통계를 슬랙으로 전송

- [ ] 웹 대시보드 (Optional)
  - `Agent_Tasks` 시트 기반 실시간 대시보드
  - 현재 진행 중인 작업 현황 시각화

**완료 기준**: 성과 지표가 자동 집계됨

---

## 🎯 즉시 시작 가능한 Action Items

### 자비스 팀 (PO)

1. **시트 스키마 검토**
   - 컬럼 A-L 구조에 동의하시나요?
   - 추가로 필요한 컬럼이 있나요?

2. **트리거 주기 검토**
   - 1분마다 시트 읽기에 동의하시나요?
   - 더 짧은 주기(30초) 또는 더 긴 주기(3분)를 선호하시나요?

3. **개발 문서 자동 생성 방안**
   - Claude API를 사용하시나요, 아니면 수동으로 .md 작성하시나요?
   - 파일 저장 위치는 `agent_work/jarvis_po/`로 고정할까요?

4. **MVP 개발 시작일**
   - 언제부터 협업 개발을 시작할 수 있나요?
   - Phase 1 (1일) 완료 목표일은 언제로 잡을까요?

---

### 김감사 팀 (QA)

1. **QA v2.0 프로세스 자동화**
   - QA 7단계를 어떻게 자동화할까요?
   - 각 Phase별로 체크리스트(G열)를 어떻게 업데이트할까요?

2. **에러 검출 기준**
   - Critical 이슈는 어떻게 판단할까요? (수동 분류 vs 자동 파싱)
   - H열(에러_카운트)를 어떻게 계산할까요?

3. **QA 문서 자동 생성**
   - 보고서 템플릿은 어떻게 구성할까요?
   - 파일 저장 위치는 `qa/qa_reviews/`로 고정할까요?

---

### 팀장님

1. **최종 방향성 결정**
   - ✅ 하이브리드 자동화 시스템 v1.0에 동의하시나요?
   - 🟡 다른 제안(슬랙 전용, 단일 에이전트)을 선호하시나요?

2. **MVP 시작 승인**
   - Phase 1 (1일) 개발을 즉시 시작해도 될까요?
   - 예산/리소스 제약이 있나요?

3. **슬랙 Webhook 설정**
   - 슬랙 Incoming Webhook URL을 생성해주실 수 있나요?
   - 알림을 받을 채널명은 무엇인가요? (예: `#agent-notifications`)

4. **테스트 시나리오**
   - 첫 번째 테스트 요청은 무엇으로 할까요?
   - "슬랙 모달 에러 수정"으로 시작할까요, 아니면 더 간단한 작업으로 할까요?

---

## 🎁 보너스: 에이전트 성과 지표 (Phase 4)

자동화 시스템이 안정화되면 다음 지표를 추적할 수 있습니다:

### 추적 가능한 지표

| 지표 | 설명 | 계산 방식 | 활용 사례 |
|------|------|----------|----------|
| **평균 개발 시간** | 자비스가 개발 완료하는 평균 시간 | `AVG(QA_대기_시각 - 개발중_시각)` | 자비스 프롬프트 최적화 |
| **평균 QA 시간** | 김감사가 QA 완료하는 평균 시간 | `AVG(QA_완료_시각 - QA_진행중_시각)` | QA 프로세스 최적화 |
| **평균 핑퐁 횟수** | 자비스 ↔ 김감사 반복 횟수 | `AVG(핑퐁_횟수)` | 협업 효율성 측정 |
| **First-time Pass Rate** | 1회 QA로 승인되는 비율 | `COUNT(핑퐁_횟수 = 1) / 전체` | 자비스 코드 품질 향상 |
| **Critical 이슈율** | 평균 발견 에러 개수 | `AVG(에러_카운트)` | QA 엄격도 조정 |
| **처리 완료율** | 최종 승인된 작업 비율 | `COUNT(상태 = 최종_승인) / 전체` | 시스템 안정성 측정 |

### 주간 리포트 예시

```
📊 에이전트 성과 리포트 (2026-02-24 ~ 2026-02-28)

🤖 자비스 (PO)
  - 총 처리 작업: 12건
  - 평균 개발 시간: 8분
  - First-time Pass Rate: 75% (9/12)
  - 개선 포인트: 캐시 워밍업 로직 QA 통과율 100%

🔍 김감사 (QA)
  - 총 QA 작업: 18건 (재검토 포함)
  - 평균 QA 시간: 12분
  - Critical 이슈 발견: 24건
  - 개선 포인트: QA 시간이 지난주 대비 20% 단축

🔄 협업 효율성
  - 평균 핑퐁 횟수: 1.5회
  - 평균 처리 시간: 45분
  - 처리 완료율: 100%

🏆 이번 주 하이라이트
  - AT-008: 0회 핑퐁으로 즉시 승인! (자비스 코드 품질 우수)
  - AT-012: 3회 핑퐁 끝에 복잡한 버그 해결 (협업 효과 극대화)
```

---

## 📌 FAQ (예상 질문)

### Q1. 1분마다 트리거를 실행하면 GAS 할당량이 초과되지 않나요?

**A**: GAS 무료 할당량은 다음과 같습니다:
- **트리거 실행**: 하루 90분 (5,400초)
- **1분마다 실행**: 하루 1,440회 (1회당 약 0.5초 가정 시 720초 소요)

➡️ **여유 충분함** (전체 할당량의 13%만 사용)

만약 할당량이 걱정되면:
- 트리거 주기를 **3분마다**로 변경 (할당량 1/3로 감소)
- 작업이 없을 때는 조기 종료 (early return)

---

### Q2. 에이전트가 무한 루프에 빠지면 어떻게 하나요?

**A**: 안전 장치를 설계했습니다:
1. **최대 핑퐁 횟수 제한** (예: 5회)
   - I열(핑퐁_횟수)가 5회 초과 시 상태를 "수동_개입_필요"로 변경
   - 팀장님께 슬랙 알림: "무한 루프 감지, 수동 확인 필요"

2. **타임아웃 설정**
   - 등록 후 2시간 이내 미완료 시 자동 종료
   - 팀장님께 슬랙 알림

---

### Q3. 시트를 직접 수정하면 어떻게 되나요?

**A**: 팀장님이 시트를 수동으로 수정하면:
- 다음 트리거 실행 시 **수정된 상태를 그대로 인식**
- 예: 상태를 "최종_승인"으로 강제 변경 → 슬랙 알림 즉시 전송

➡️ **수동 개입이 가능**하도록 설계됨 (통제권 유지)

---

### Q4. 슬랙 대신 이메일 알림은 안 되나요?

**A**: 가능합니다!
- `sendSlackNotification()` 대신 `MailApp.sendEmail()` 사용
- 또는 슬랙 + 이메일 동시 전송도 가능

---

### Q5. 다른 에이전트(예: 디자인 팀)를 추가할 수 있나요?

**A**: 가능합니다!
- `Agent_Tasks` 시트에 새 상태 추가 (예: "디자인_대기", "디자인_진행중")
- 새로운 트리거 함수 작성 (`design_AutoReviewTrigger`)
- D열(담당_에이전트)에 "디자인팀" 추가

---

## 🏁 최종 요약

### 우리가 제안하는 시스템

```
✅ 하이브리드 자동화 시스템 v1.0
   = 구글 시트 기반 작업 큐 (자비스 제안 2)
   + 슬랙 알림 (자비스 제안 1)
   + QA v2.0 프로세스 호환성 (김감사 제안)
```

### 핵심 장점

1. ✅ **팀장님 복사/붙여넣기 100% 제거**
2. ✅ **기존 GAS 인프라 재사용** (학습 비용 제로)
3. ✅ **완벽한 히스토리 추적** (시트에 모든 기록 보존)
4. ✅ **1일 만에 MVP 구현 가능**
5. ✅ **팀장님 통제권 유지** (수동 개입 가능)

### 예상 효과

- **총 소요 시간**: 57분 → 49분 (**-14%**)
- **팀장님 개입 시간**: 14분 → 6분 (**-57%**)
- **복사/붙여넣기**: 6회 → **0회 (-100%)**

### 다음 단계

**팀장님의 최종 결정을 기다립니다:**
1. ✅ 하이브리드 시스템에 동의하시나요?
2. 🚀 즉시 MVP 개발 시작해도 될까요?
3. 📢 슬랙 Webhook URL을 공유해주실 수 있나요?

**자비스 + 김감사 협업 준비 완료!** 🤝

---

**작성자**: 자비스 (PO) + 김감사 (QA)
**작성일**: 2026-02-27
**최종 권장 사항**: ⭐⭐⭐⭐⭐ **하이브리드 자동화 시스템 v1.0 즉시 구현**

---

**END OF PROPOSAL**
