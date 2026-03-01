# 🔍 [김감사 QA] 에이전트 자동화 제안에 대한 검토 의견

**작성일**: 2026-02-27
**작성자**: 김감사 (QA Team Lead)
**검토 대상**: [자비스 제안서](../../agent_work/jarvis_po/2026-02-27_agent_automation_ideas.md)

---

## 📋 Executive Summary

자비스 팀의 3가지 자동화 제안을 **QA 프로세스 관점**에서 검토한 결과, **제안 2 (구글 시트 기반 큐)를 강력히 지지**하며, 즉시 구현 가능한 **개선 버전**을 제안드립니다.

### 핵심 제안: "제안 2 + 제안 1 하이브리드"
- ✅ **구글 시트**를 에이전트 작업 큐(Queue)로 사용 (자비스 제안 2)
- ✅ **슬랙 알림**을 최종 승인 단계에서만 사용 (자비스 제안 1의 장점)
- ✅ **QA 프로세스 v2.0 호환성** 보장

---

## 🎯 제안별 QA 관점 평가

### ⭐ 제안 1: 슬랙 채널 기반 Webhook 핑퐁

| 평가 항목 | 점수 | 의견 |
|----------|------|------|
| **구현 난이도** | 🟡 중간 (3/5) | 슬랙 Event API 설정, Webhook 파싱 필요 |
| **히스토리 추적** | 🟡 중간 | 슬랙 메시지는 검색 가능하지만 구조화 안 됨 |
| **에러 핸들링** | 🔴 낮음 | Webhook 실패 시 복구 로직 복잡 |
| **팀장님 개입도** | ✅ 낮음 | 최종 알림만 수신 |
| **QA v2.0 호환성** | 🟡 중간 | QA 프로세스 7단계를 슬랙에서 표현하기 어려움 |

**종합 점수**: 65/100

**QA 팀 의견**:
- ✅ 장점: 팀장님이 슬랙에서 진행 상황을 실시간 관전 가능
- ❌ 단점: 슬랙 메시지는 **휘발성**이며, QA 체크리스트 관리 어려움
- ⚠️ 리스크: 네트워크 장애 시 에이전트 간 통신 끊김

---

### ⭐⭐⭐⭐⭐ 제안 2: 구글 시트 기반 칸반보드 큐

| 평가 항목 | 점수 | 의견 |
|----------|------|------|
| **구현 난이도** | ✅ 쉬움 (1/5) | 기존 GAS 인프라 100% 재사용 가능 |
| **히스토리 추적** | ✅ 최고 | 모든 상태 변경이 시트에 기록됨 |
| **에러 핸들링** | ✅ 최고 | 시트 기반이므로 재시도 로직 간단 |
| **팀장님 개입도** | ✅ 낮음 | 시트에 초기 요청만 작성 |
| **QA v2.0 호환성** | ✅ 최고 | QA 7단계를 시트 컬럼으로 완벽 표현 가능 |

**종합 점수**: 95/100

**QA 팀 강력 추천 사유**:
1. ✅ **QA_PROCESS_V2.0의 7단계를 시트 컬럼으로 관리** 가능
   - Global Context Scan → Column D
   - Code Style Analysis → Column E
   - Problem Discovery → Column F
   - ... (7개 컬럼)
2. ✅ **현재 Tasks 시트와 동일한 구조** 사용 → 학습 비용 제로
3. ✅ **트리거 기반 자동화**로 안정성 보장 (GAS 10분마다 실행)
4. ✅ **팀장님이 시트에서 전체 파이프라인 한눈에 확인** 가능

---

### ⭐⭐ 제안 3: 단일 에이전트 다중 페르소나 체인

| 평가 항목 | 점수 | 의견 |
|----------|------|------|
| **구현 난이도** | 🔴 매우 높음 (5/5) | LangChain, Self-reflection 복잡도 높음 |
| **히스토리 추적** | 🔴 낮음 | 내부 메모리 기반이므로 외부 추적 불가 |
| **에러 핸들링** | 🟡 중간 | Self-reflection 무한루프 위험 |
| **팀장님 개입도** | ✅ 낮음 | 최종 결과만 수신 |
| **QA v2.0 호환성** | 🔴 낮음 | QA 프로세스를 프롬프트로만 강제하기 어려움 |

**종합 점수**: 50/100

**QA 팀 의견**:
- ✅ 장점: 미래 지향적이며, 에이전트 독립성 극대화
- ❌ 단점: **QA 중간 과정이 블랙박스**화되어 디버깅 불가
- ❌ 단점: Self-reflection 품질 보장 어려움 (무한루프 or 조기 종료 위험)
- ⚠️ 리스크: 팀장님이 중간 개입 불가능 → **통제권 상실**

---

## 💡 김감사 제안: "하이브리드 자동화 시스템 v1.0"

### 핵심 아이디어: 제안 2 + 제안 1의 장점 결합

```
[팀장님 요청]
    ↓
[구글 시트: Agent_Tasks]
    ↓ (자비스 트리거: 1분마다 시트 읽기)
[자비스 개발 시작]
    ↓
[자비스: 상태 변경 "QA_대기중" + .md 링크 추가]
    ↓ (김감사 트리거: 1분마다 시트 읽기)
[김감사 QA 시작]
    ↓
[김감사: QA v2.0 7단계 실행 → 시트에 체크리스트 기록]
    ↓
[김감사: 상태 변경 "디버깅_필요" or "최종_승인"]
    ↓ (자비스 트리거: 시트 읽기)
[자비스 수정 or 완료]
    ↓
[상태: "최종_승인" 확정]
    ↓ (GAS 트리거)
[슬랙 알림 → @팀장님 "최종 코드 배포 가능합니다!"]
```

---

## 🗂️ 구글 시트 구조 설계 (Agent_Tasks 시트)

### 시트명: `Agent_Tasks`

| 컬럼 | 필드명 | 설명 | 샘플 데이터 |
|------|--------|------|-------------|
| A | **Task_ID** | 고유 작업 ID | `AT-001` |
| B | **요청_내용** | 팀장님 요청 사항 | "슬랙 모달 랜덤 에러 수정" |
| C | **상태** | 현재 워크플로우 상태 | `대기중` → `개발중` → `QA_대기` → `디버깅_필요` → `최종_승인` |
| D | **담당_에이전트** | 현재 작업 중인 에이전트 | `자비스` or `김감사` |
| E | **개발_문서_링크** | 자비스가 작성한 .md 파일 경로 | `agent_work/jarvis_po/2026-02-27_*.md` |
| F | **QA_문서_링크** | 김감사가 작성한 QA 보고서 경로 | `qa/qa_reviews/2026-02-27_*.md` |
| G | **QA_체크리스트** | QA v2.0 7단계 진행 상황 | `[✅][✅][✅][⏳][ ][ ][ ]` |
| H | **에러_카운트** | 발견된 Critical 이슈 개수 | `3` |
| I | **핑퐁_횟수** | 자비스 ↔ 김감사 반복 횟수 | `2` |
| J | **등록_시간** | 요청 시각 | `2026-02-27 14:30` |
| K | **완료_시간** | 최종 승인 시각 | `2026-02-27 15:45` |
| L | **비고** | 특이사항 메모 | "긴급 핫픽스" |

### 상태(State) 전환 규칙

```
대기중 (팀장님 요청)
  ↓
개발중 (자비스 작업 중)
  ↓
QA_대기 (자비스 개발 완료, 김감사 검토 대기)
  ↓
QA_진행중 (김감사 QA v2.0 실행 중)
  ↓
[분기점]
  → 디버깅_필요 (Critical 이슈 발견) → 개발중으로 복귀
  → 최종_승인 (이슈 없음) → 완료
```

---

## 🤖 에이전트별 트리거 로직

### 자비스 트리거 (1분마다 실행)

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
    const taskId = data[i][0];
    const status = data[i][2]; // C열: 상태
    const agent = data[i][3];  // D열: 담당_에이전트

    // Case 1: 팀장님이 새 요청 등록 (상태: "대기중")
    if (status === "대기중") {
      sheet.getRange(i + 1, 3).setValue("개발중"); // 상태 변경
      sheet.getRange(i + 1, 4).setValue("자비스"); // 담당 설정

      // TODO: 여기서 Claude API 호출하여 개발 시작
      // 개발 완료 후 .md 파일 경로를 E열에 기록
      // 상태를 "QA_대기"로 변경

      Logger.log(`[자비스] ${taskId} 개발 시작`);
    }

    // Case 2: QA에서 디버깅 요청 (상태: "디버깅_필요")
    if (status === "디버깅_필요" && agent === "자비스") {
      sheet.getRange(i + 1, 3).setValue("개발중"); // 상태 변경

      const qaDocLink = data[i][5]; // F열: QA 문서 링크
      // TODO: QA 문서 읽어서 에러 사항 파악 후 수정

      Logger.log(`[자비스] ${taskId} 디버깅 시작 (QA 리뷰: ${qaDocLink})`);
    }
  }
}
```

---

### 김감사 트리거 (1분마다 실행)

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
    const taskId = data[i][0];
    const status = data[i][2]; // C열: 상태
    const devDocLink = data[i][4]; // E열: 개발 문서 링크

    // Case 1: QA 대기 중인 작업 발견
    if (status === "QA_대기") {
      sheet.getRange(i + 1, 3).setValue("QA_진행중"); // 상태 변경
      sheet.getRange(i + 1, 4).setValue("김감사"); // 담당 설정

      // TODO: devDocLink 파일 읽어서 QA v2.0 프로세스 실행
      // Phase 0: Global Context Scan → G열 체크리스트 업데이트
      // Phase 1: Code Style Analysis → G열 체크리스트 업데이트
      // ...
      // Phase 7: Report Writing → F열에 QA 문서 링크 기록

      // QA 완료 후 상태 분기
      const errorCount = 3; // TODO: 실제 에러 개수
      if (errorCount > 0) {
        sheet.getRange(i + 1, 3).setValue("디버깅_필요");
        sheet.getRange(i + 1, 4).setValue("자비스");
        sheet.getRange(i + 1, 8).setValue(errorCount); // H열: 에러 카운트
      } else {
        sheet.getRange(i + 1, 3).setValue("최종_승인");
        sendSlackNotification(taskId); // 팀장님께 슬랙 알림
      }

      Logger.log(`[김감사] ${taskId} QA 완료 (에러: ${errorCount}건)`);
    }
  }
}
```

---

### 최종 승인 시 슬랙 알림 (제안 1 장점 활용)

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
      const taskDesc = data[i][1]; // B열: 요청 내용
      const devDoc = data[i][4];   // E열: 개발 문서
      const qaDoc = data[i][5];    // F열: QA 문서
      const pingPong = data[i][8]; // I열: 핑퐁 횟수

      const message = `
✅ *[최종 승인] ${taskId}*

📋 *요청 내용*: ${taskDesc}
🔄 *자비스 ↔ 김감사 핑퐁*: ${pingPong}회
📄 *개발 문서*: ${devDoc}
📊 *QA 보고서*: ${qaDoc}

🚀 코드 배포를 진행해주세요!
      `;

      // 슬랙 웹훅으로 메시지 전송
      const webhookUrl = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL";
      UrlFetchApp.fetch(webhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ text: message })
      });

      Logger.log(`[알림] ${taskId} 최종 승인 - 팀장님께 슬랙 알림 전송`);
      break;
    }
  }
}
```

---

## 📊 예상 효과 (Before/After)

### Before (현재 - 수동 복사/붙여넣기)

| 단계 | 소요 시간 | 팀장님 개입 | 누적 시간 |
|------|----------|------------|----------|
| 1. 자비스 개발 | 10분 | - | 10분 |
| 2. 팀장님 복사 → 김감사 | **3분** | ✅ | 13분 |
| 3. 김감사 QA | 15분 | - | 28분 |
| 4. 팀장님 복사 → 자비스 | **3분** | ✅ | 31분 |
| 5. 자비스 수정 | 8분 | - | 39분 |
| 6. 팀장님 복사 → 김감사 | **3분** | ✅ | 42분 |
| 7. 김감사 2차 QA | 10분 | - | 52분 |
| 8. 팀장님 배포 | **5분** | ✅ | 57분 |

**총 소요 시간**: 57분
**팀장님 개입 횟수**: 4회 (14분)

---

### After (자동화 시스템)

| 단계 | 소요 시간 | 팀장님 개입 | 누적 시간 |
|------|----------|------------|----------|
| 1. 팀장님 시트 요청 작성 | **1분** | ✅ | 1분 |
| 2. 자비스 개발 (자동) | 10분 | - | 11분 |
| 3. 김감사 QA (자동) | 15분 | - | 26분 |
| 4. 자비스 수정 (자동) | 8분 | - | 34분 |
| 5. 김감사 2차 QA (자동) | 10분 | - | 44분 |
| 6. 슬랙 알림 수신 | 즉시 | - | 44분 |
| 7. 팀장님 배포 | **5분** | ✅ | 49분 |

**총 소요 시간**: 49분 (**8분 단축**)
**팀장님 개입 횟수**: 2회 (6분, **8분 절약**)

---

## 🎯 구현 우선순위

### Phase 1: MVP (최소 기능 프로토타입) - 1일 소요

- [ ] `Agent_Tasks` 시트 생성 (컬럼 A-L)
- [ ] 자비스 트리거 함수 작성 (`jarvis_AutoDevelopmentTrigger`)
- [ ] 김감사 트리거 함수 작성 (`kimQA_AutoReviewTrigger`)
- [ ] GAS 시간 기반 트리거 설정 (1분마다 실행)
- [ ] 기본 상태 전환 로직 구현

### Phase 2: QA v2.0 통합 - 2일 소요

- [ ] QA 7단계 체크리스트 자동 업데이트 (G열)
- [ ] 에러 카운트 자동 계산 (H열)
- [ ] .md 파일 읽기/쓰기 자동화

### Phase 3: 슬랙 알림 - 1일 소요

- [ ] 슬랙 Webhook 설정
- [ ] `sendSlackNotification()` 함수 구현
- [ ] 최종 승인 시 자동 알림

### Phase 4: 대시보드 (Optional) - 2일 소요

- [ ] `Agent_Tasks` 시트 기반 웹 대시보드 구축
- [ ] 실시간 진행 상황 시각화
- [ ] 히스토리 차트 (평균 핑퐁 횟수, 처리 시간 등)

**총 개발 기간**: 최소 1일 (MVP), 최대 6일 (Full)

---

## 🚀 즉시 시작 가능한 Action Items

### 자비스 팀

1. `Agent_Tasks` 시트 스키마 검토 및 피드백
2. `jarvis_AutoDevelopmentTrigger()` 함수 초안 작성
3. 개발 완료 시 .md 파일 경로를 시트에 기록하는 로직 구현

### 김감사 팀 (나)

1. `kimQA_AutoReviewTrigger()` 함수 초안 작성
2. QA v2.0 프로세스를 시트 체크리스트(G열)로 매핑
3. QA 보고서 자동 생성 로직 구현

### 팀장님

1. 3가지 제안 중 최종 방향성 결정
2. MVP 시작 승인 여부 결정
3. 슬랙 Webhook URL 생성 및 공유

---

## 🎁 보너스 제안: "에이전트 성과 지표 대시보드"

자동화 시스템이 안정화되면, `Agent_Tasks` 시트 데이터를 기반으로 **에이전트별 성과 지표**를 추적할 수 있습니다:

| 지표 | 설명 | 계산 방식 |
|------|------|----------|
| **평균 개발 시간** | 자비스가 개발 완료하는 평균 시간 | `(완료_시간 - 등록_시간) / 작업 수` |
| **평균 QA 시간** | 김감사가 QA 완료하는 평균 시간 | `(QA_완료_시간 - QA_시작_시간) / 작업 수` |
| **평균 핑퐁 횟수** | 자비스 ↔ 김감사 반복 횟수 | `SUM(핑퐁_횟수) / 작업 수` |
| **First-time Pass Rate** | 1회 QA로 승인되는 비율 | `(핑퐁_횟수 = 1인 작업 수) / 전체 작업 수` |
| **Critical 이슈율** | 평균 발견 에러 개수 | `SUM(에러_카운트) / 작업 수` |

**활용 사례**:
- "자비스의 First-time Pass Rate이 80% → 90%로 개선되었습니다!" (프롬프트 개선 효과)
- "김감사의 평균 QA 시간이 15분 → 10분으로 단축되었습니다!" (QA 자동화 효과)

---

## 🏁 김감사 최종 의견

### 강력 추천: **"하이브리드 자동화 시스템 v1.0"**

**이유**:
1. ✅ **구글 시트 기반**으로 현재 인프라 100% 재사용
2. ✅ **QA v2.0 프로세스**를 시트 컬럼으로 완벽 표현
3. ✅ **슬랙 알림**으로 팀장님께 최종 결과만 전달
4. ✅ **1일 만에 MVP 구현 가능** (자비스+김감사 협업)
5. ✅ **히스토리 추적 완벽** (시트에 모든 기록 보존)
6. ✅ **팀장님 복사/붙여넣기 작업 100% 제거**

### 다음 단계

**팀장님께 여쭙고 싶은 질문**:
1. 3가지 제안 중 어떤 방향성을 선호하시나요?
2. 즉시 MVP 개발을 시작해도 될까요? (자비스+김감사 협업, 1일 소요)
3. 슬랙 Webhook URL을 공유해주실 수 있나요?

**자비스 팀께 드리는 질문**:
1. `Agent_Tasks` 시트 스키마(컬럼 A-L)에 동의하시나요?
2. 1분마다 시트를 읽는 트리거 방식에 동의하시나요?
3. 언제부터 협업 개발을 시작할 수 있나요?

---

**작성자**: 김감사 (QA Team Lead)
**검토 완료일**: 2026-02-27
**최종 권장 사항**: ⭐⭐⭐⭐⭐ **하이브리드 자동화 시스템 v1.0 즉시 구현**

---

**END OF REVIEW**
