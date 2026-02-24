# 20단계 개발 태스크 — `/주디 내업무` UX 개선 + 스마트 리마인더

> **작성일**: 2026-02-24 11:07  
> **수정 파일**: `slack_command.gs`  
> **예상 소요**: 약 1.5시간

---

## ✅ 완료된 작업 (오늘 오전)

- [x] `/주디 내업무` 기본 조회 기능 구현 (`sendMyTasksMessage`)
- [x] 상태 변경 모달 (`openStatusChangeModal` + `handleStatusChange`)
- [x] 담당자 이름 매칭 이슈 수정 (실명 + username 유연 매칭)
- [x] Slack 3초 타임아웃 방어 (CacheService 1시간 캐싱)
- [x] 슬래시 커맨드 재시도 방어 (trigger_id 중복 차단)

---

## 🔨 남은 작업

### Task 1: 인라인 드롭다운 UX 전환 (약 40분)
> 현재 [상태 변경] 버튼 → 모달 → 선택 → 제출 (4단계) → **드롭다운 선택 1단계로 축소**

- [x] **1-1.** `sendMyTasksMessage` 리팩토링
  - `accessory`를 `button` → `static_select`로 교체
  - 현재 상태를 `initial_option`으로 미리 선택된 상태로 표시
  - `action_id`에 행 번호 포함: `"status_select_ROW"`
  - 각 업무별 드롭다운 옵션: `▶ 진행중 / ⏸ 대기 / 🔴 보류 / ✅ 완료`

- [x] **1-2.** `doPost`의 `block_actions` 핸들러 수정
  - `action_id.startsWith("status_select_")`로 분기
  - 드롭다운 선택 값에서 `selected_option.value` 추출
  - `action_id`에서 행 번호 파싱 → Tasks 시트 직접 업데이트
  - 모달 없이 즉시 반영 + DM 알림 발송

- [ ] **1-3.** 기존 모달 코드 정리
  - `openStatusChangeModal` 함수 비활성화 또는 삭제
  - `handleStatusChange` 의 `view_submission` 분기 제거

---

### Task 2: 상단 요약 카운터 추가 (약 10분)
> 한눈에 업무 현황 파악

- [x] **2-1.** `sendMyTasksMessage` 메시지 상단에 카운터 블록 추가
  ```
  📋 송용남님의 업무 현황
  ⏸ 대기 3 · ▶ 진행중 2 · 🔴 보류 1
  ```

---

### Task 3: 마감일 경고 이모지 (약 15분)
> 위험 업무 즉시 식별

- [x] **3-1.** 마감일 기준 경고 로직 추가
  | 조건 | 표시 |
  |---|---|
  | 기한 초과 | 🚨 **N일 초과!** |
  | D-Day | 🔥 **오늘 마감!** |
  | D-1 | ⚠️ **내일 마감** |
  | 여유 | 📅 MM/DD |
  | 미설정 | (표시 없음) |

- [x] **3-2.** 마감 임박 업무를 리스트 상단에 정렬 (긴급도순)

---

### Task 4: 상태 변경 후 피드백 (약 15분)
> 변경 결과를 즉시 확인

- [x] **4-1.** 상태 변경 시 DM 알림 유지
  ```
  ✅ [GONG-002] 전주 양식 작성 배정 → 완료 처리됨!
  ```

- [x] **4-2.** (선택) `chat.update` API로 원래 메시지의 해당 업무 드롭다운 값 갱신
  - `response_url` 또는 메시지 `ts` 저장 필요
  - 복잡도 높으므로 우선순위 낮음

---

## 📐 기술 설계 요약

### 변경 전 (현재)
```
/주디 내업무 → 업무 리스트 (버튼) → 클릭 → 모달 오픈 → 상태 선택 → 제출
                                    ↑ 1~2초 로딩    ↑ 4단계
```

### 변경 후 (목표)
```
/주디 내업무 → 업무 리스트 (인라인 드롭다운) → 상태 선택 → 즉시 반영
                                              ↑ 1단계, 로딩 없음
```

### Slack Block Kit 구조 (핵심)
```javascript
{
  type: "section",
  text: { type: "mrkdwn", text: "🔥 *[GONG-002]* 전주 양식 작성\n_창문프로젝트 · 오늘 마감!_" },
  accessory: {
    type: "static_select",
    action_id: "status_select_5",   // 5 = 시트 행 번호
    initial_option: { text: { type: "plain_text", text: "⏸ 대기" }, value: "대기" },
    options: [
      { text: { type: "plain_text", text: "▶ 진행중" }, value: "진행중" },
      { text: { type: "plain_text", text: "⏸ 대기" },  value: "대기"  },
      { text: { type: "plain_text", text: "🔴 보류" },  value: "보류"  },
      { text: { type: "plain_text", text: "✅ 완료" },  value: "완료"  }
    ]
  }
}
```

---

## ⏭️ 다음 스프린트 (3순위: 스마트 리마인더)

> 이번 스프린트에서는 구현하지 않음. 다음 세션에서 진행.

- [ ] GAS 매일 실행 타임 트리거 설정
- [ ] Tasks 시트 스캔 → 마감 D-1, D-Day 업무 필터링
- [ ] 슬랙 DM 자동 발송 (`chat.postMessage`)
- [ ] 상태 `진행중` + 2일 무변화 자동 알림
