# T-B02: 팀 간 커뮤니케이션 인터페이스 정의서

**작성자**: 김CM
**상태**: 완료 (T-B01 상태값 매핑 반영 완료)
**최종 수정**: 2026-02-28

---

## 1. 파이프라인 개요

```
벙커(기획) →[H1]→ 자비스(개발) →[H2]→ 김감사(QA) →[H3]→ 강철(리팩토링) →[H4]→ 꼼꼼이(문서화)
```

| 전환점 | 발신팀 | 수신팀 | 설명 |
|--------|--------|--------|------|
| H1 | 벙커(기획) | 자비스(개발) | 기획 완료 → 개발 착수 |
| H2 | 자비스(개발) | 김감사(QA) | 개발 완료 → QA 착수 |
| H3 | 김감사(QA) | 강철(리팩토링) | QA 통과 → 리팩토링 착수 |
| H4 | 강철(리팩토링) | 꼼꼼이(문서화) | 리팩토링 완료 → 문서화 착수 |

---

## 2. 핸드오프 프로토콜 정의서

### 2.1 핸드오프 메시지 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HandoffMessage",
  "description": "팀 간 태스크 핸드오프 메시지 표준 포맷",
  "type": "object",
  "required": ["handoff_id", "type", "source", "target", "task", "timestamp"],
  "properties": {
    "handoff_id": {
      "type": "string",
      "description": "고유 핸드오프 식별자 (UUID v4)",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "type": {
      "type": "string",
      "enum": ["handoff", "reject", "revision_request", "ack", "escalation"],
      "description": "메시지 유형"
    },
    "source": {
      "type": "object",
      "required": ["team_id", "team_name", "agent_id"],
      "properties": {
        "team_id": { "type": "string", "description": "발신 팀 ID" },
        "team_name": { "type": "string", "description": "발신 팀 이름" },
        "agent_id": { "type": "string", "description": "발신 에이전트 ID" }
      }
    },
    "target": {
      "type": "object",
      "required": ["team_id", "team_name"],
      "properties": {
        "team_id": { "type": "string", "description": "수신 팀 ID" },
        "team_name": { "type": "string", "description": "수신 팀 이름" },
        "agent_id": { "type": "string", "description": "수신 에이전트 ID (선택)" }
      }
    },
    "task": {
      "type": "object",
      "required": ["task_id", "title", "status_from", "status_to"],
      "properties": {
        "task_id": { "type": "string", "description": "태스크 ID" },
        "title": { "type": "string", "description": "태스크 제목" },
        "status_from": {
          "type": "string",
          "enum": ["PLAN_IN_PROGRESS", "DEV_PENDING", "DEV_IN_PROGRESS", "QA_PENDING", "QA_IN_PROGRESS", "HARDEN_PENDING", "HARDEN_IN_PROGRESS", "DOC_PENDING"],
          "description": "전이 전 상태 (T-B01 상태값)"
        },
        "status_to": {
          "type": "string",
          "enum": ["PLAN_IN_PROGRESS", "DEV_PENDING", "DEV_IN_PROGRESS", "QA_PENDING", "QA_IN_PROGRESS", "HARDEN_PENDING", "HARDEN_IN_PROGRESS", "DOC_PENDING"],
          "description": "전이 후 상태 (T-B01 상태값)"
        },
        "priority": {
          "type": "string",
          "enum": ["P0", "P1", "P2", "P3"],
          "description": "우선순위"
        },
        "artifacts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "path"],
            "properties": {
              "name": { "type": "string" },
              "path": { "type": "string" },
              "type": { "type": "string", "enum": ["document", "code", "config", "diagram", "test_result"] }
            }
          },
          "description": "전달 산출물 목록"
        },
        "context": {
          "type": "string",
          "description": "핸드오프 배경/맥락 설명"
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "메시지 생성 시각 (ISO 8601)"
    },
    "timeout_minutes": {
      "type": "integer",
      "default": 30,
      "description": "ACK 응답 제한 시간(분)"
    },
    "metadata": {
      "type": "object",
      "description": "확장 필드 (팀별 커스텀 데이터)"
    }
  }
}
```

### 2.2 트리거 조건 (T-B01 상태값 매핑 반영 완료)

| 전환점 | 트리거 조건 | status_from | status_to |
|--------|------------|-------------|-----------|
| H1 | 기획 산출물 완료 및 승인 | `PLAN_IN_PROGRESS` | `DEV_PENDING` |
| H2 | 개발 완료 및 빌드 성공 | `DEV_IN_PROGRESS` | `QA_PENDING` |
| H3 | QA 테스트 전체 통과 | `QA_IN_PROGRESS` | `HARDEN_PENDING` |
| H4 | 리팩토링 완료 및 코드리뷰 통과 | `HARDEN_IN_PROGRESS` | `DOC_PENDING` |

> **출처**: T-B01(정DA) 상태 전이 매핑 산출물 기준

### 2.3 수신 확인(ACK) 프로토콜

```json
{
  "handoff_id": "원본 핸드오프 ID 참조",
  "type": "ack",
  "source": { "team_id": "수신팀", "team_name": "...", "agent_id": "..." },
  "target": { "team_id": "발신팀", "team_name": "...", "agent_id": "..." },
  "task": {
    "task_id": "원본 task_id",
    "title": "원본 title",
    "status_from": "원본 status_to",
    "status_to": "원본 status_to"
  },
  "ack_status": "accepted | rejected | deferred",
  "ack_message": "수신 확인 메시지",
  "timestamp": "2026-02-28T00:00:00Z"
}
```

**ACK 규칙:**
- ACK 응답 제한 시간: 기본 30분 (P0 태스크: 15분)
- `accepted`: 수신 팀이 태스크 인수 확인
- `rejected`: 수신 불가 → 반려 사유 포함, 역방향 흐름 트리거
- `deferred`: 수신 보류 → 사유 포함, 재전송 스케줄링

---

## 3. 예외 처리 규칙

### 3.1 반려/수정요청 시 역방향 흐름

```
정방향: 벙커 → 자비스 → 김감사 → 강철 → 꼼꼼이
역방향: 직전 팀으로만 반려 (스킵 반려 금지)
```

**역방향 메시지 포맷:**

```json
{
  "handoff_id": "신규 UUID",
  "type": "reject",
  "source": { "team_id": "반려팀", "...": "..." },
  "target": { "team_id": "직전팀", "...": "..." },
  "task": {
    "task_id": "원본 task_id",
    "title": "원본 title",
    "status_from": "현재 상태",
    "status_to": "직전 팀 상태로 롤백"
  },
  "reject_reason": {
    "category": "quality | scope | dependency | blocker",
    "description": "반려 상세 사유",
    "action_items": [
      {
        "assignee": "담당자",
        "action": "수정 내용",
        "deadline": "기한"
      }
    ]
  },
  "timestamp": "2026-02-28T00:00:00Z"
}
```

**역방향 흐름 규칙:**
1. 반려는 직전 팀으로만 가능 (H3 김감사 → H2 자비스만 가능, 벙커로 직접 반려 불가)
2. 2단계 이상 역방향 필요 시 에스컬레이션 규칙 적용
3. 반려 메시지에는 반드시 `reject_reason`과 `action_items` 포함
4. 반려 후 수정 완료 시 동일 `task_id`로 재핸드오프

### 3.2 타임아웃 처리

| 단계 | 조건 | 액션 |
|------|------|------|
| 1차 알림 | ACK 제한시간 50% 경과 | 수신 팀에 리마인더 발송 |
| 2차 알림 | ACK 제한시간 100% 도달 | 수신 팀 + 송PO에게 알림 |
| 에스컬레이션 | ACK 제한시간 150% 초과 | 에스컬레이션 규칙 적용 |

### 3.3 에스컬레이션 규칙

```
Level 1: 해당 팀 리드에게 알림 (타임아웃 150%)
Level 2: 송PO에게 에스컬레이션 (타임아웃 200% 또는 2회 연속 반려)
Level 3: 팀장(User)에게 보고 (송PO 판단)
```

**에스컬레이션 트리거:**
- ACK 타임아웃 150% 초과
- 동일 태스크 2회 연속 반려
- P0 태스크의 역방향 흐름 발생
- 2단계 이상 역방향 반려 필요

---

## 4. 알림 체계

### 4.1 알림 채널 및 방식

| 채널 | 방식 | 용도 |
|------|------|------|
| SendMessage (DM) | 1:1 메시지 | 핸드오프 전달, ACK 요청, 반려 통보 |
| SendMessage (broadcast) | 전체 메시지 | 긴급 에스컬레이션, 파이프라인 중단 |
| TaskUpdate | 태스크 상태 변경 | 상태 동기화, 진행 추적 |

### 4.2 우선순위별 알림 차등

| 우선순위 | ACK 제한시간 | 리마인더 | 에스컬레이션 |
|----------|-------------|----------|-------------|
| P0 (긴급) | 15분 | 7분 후 | 22분 후 |
| P1 (높음) | 30분 | 15분 후 | 45분 후 |
| P2 (보통) | 60분 | 30분 후 | 90분 후 |
| P3 (낮음) | 120분 | 60분 후 | 180분 후 |

### 4.3 알림 메시지 템플릿

**핸드오프 알림:**
```
[핸드오프] {source.team_name} → {target.team_name}
태스크: {task.title} ({task.priority})
ACK 기한: {timeout_minutes}분 내 응답 필요
```

**리마인더:**
```
[리마인더] ACK 대기 중 - {task.title}
발신: {source.team_name} | 경과: {elapsed_minutes}분
즉시 응답 부탁드립니다.
```

**에스컬레이션:**
```
[에스컬레이션 L{level}] ACK 타임아웃 - {task.title}
발신: {source.team_name} → 수신: {target.team_name}
경과: {elapsed_minutes}분 | 조치 필요
```

---

## 5. 꼼꼼이팀 인터페이스 (Stub)

> **참고**: 꼼꼼이팀 인터페이스는 스텁 수준으로 정의. 상세 구현은 추후 확정.

### 5.1 H4 핸드오프 수신 인터페이스

```json
{
  "handoff_id": "UUID",
  "type": "handoff",
  "source": { "team_id": "KANGCHEOL", "team_name": "강철(리팩토링)" },
  "target": { "team_id": "KKOMKKOM", "team_name": "꼼꼼이(문서화)" },
  "task": {
    "task_id": "...",
    "title": "...",
    "status_from": "HARDEN_IN_PROGRESS",
    "status_to": "DOC_PENDING",
    "artifacts": [
      { "name": "리팩토링 완료 코드", "path": "...", "type": "code" },
      { "name": "리팩토링 변경 로그", "path": "...", "type": "document" }
    ]
  }
}
```

### 5.2 꼼꼼이팀 산출물 포맷 (Stub)

```json
{
  "documentation_output": {
    "type": "stub - 추후 정의",
    "expected_artifacts": ["API 문서", "사용자 가이드", "변경 이력"],
    "output_format": "TBD"
  }
}
```

### 5.3 꼼꼼이팀 완료 후 흐름

- 꼼꼼이팀은 파이프라인 최종 단계
- 문서화 완료 시 송PO에게 최종 보고 (핸드오프 아닌 완료 보고)
- 완료 보고 포맷은 추후 정의

---

## 6. 상태 동기화 메커니즘

### 6.1 동기화 원칙
- 모든 상태 변경은 TaskUpdate를 통해 중앙 태스크 시스템에 반영
- 핸드오프 메시지와 TaskUpdate는 원자적(atomic)으로 처리
- 상태 불일치 발생 시 핸드오프 메시지의 상태가 우선 (source of truth)

### 6.2 상태 추적 흐름
```
1. 발신팀: 핸드오프 메시지 전송 + TaskUpdate(status_to)
2. 수신팀: ACK 응답 + TaskUpdate(상태 확인)
3. 반려 시: 역방향 메시지 + TaskUpdate(롤백 상태)
4. 에스컬레이션 시: 에스컬레이션 메시지 + TaskUpdate(블로커 표시)
```

---

## 부록: 미결 사항

| 항목 | 상태 | 비고 |
|------|------|------|
| ~~트리거 조건 상태값~~ | ~~완료~~ | ~~T-B01 반영 완료~~ |
| 꼼꼼이팀 상세 인터페이스 | 스텁 | 추후 확정 |
| 파이프라인 최종 완료 보고 포맷 | 미정의 | 추후 확정 |
