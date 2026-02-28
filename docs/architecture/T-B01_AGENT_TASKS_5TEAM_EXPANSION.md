# T-B01: Agent_Tasks 시트 구조 분석 및 5팀 확장안

**작성일**: 2026-02-28
**작성자**: 정DA (벙커팀 / 데이터 분석)
**기반 문서**: AGENT_WORKFLOW_AUTOMATION.md (2026-02-27, 자비스 작성)

---

## 1. 기존 구조 분석 요약

### 기존 2팀 상태머신
```
대기 → 개발중(자비스) → QA대기 → QA중(김감사) → 수정요청 ↺ / 배포준비완료
```

### 기존 컬럼 (A~H, 8열)
| 열 | 헤더 | 용도 |
|---|---|---|
| A | Task ID | AGENT-001 형식 |
| B | 상태 (Status) | 6개 상태값 |
| C | 생성자 (Author) | 팀장님 고정 |
| D | 요구사항 (Request) | 자연어 |
| E | 개발 문서 링크 / 파일 경로 | 산출물 위치 |
| F | QA 리포트 링크 / 피드백 | QA 피드백 |
| G | 현재 소유권 (Owner) | Jarvis / Kim Gamsa / 팀장님 |
| H | 수정일시 | 타임스탬프 |

### 기존 구조의 한계점
1. 2팀(자비스, 김감사)만 지원 -- 팀 확장 시 상태값 폭발
2. 단일 피드백 열(F) -- 팀별 산출물/피드백 구분 불가
3. 의존성(dependencies) 미지원
4. 우선순위(priority) 미지원
5. 페이로드(input/output) 구조화 없음 -- 자연어 텍스트만 존재

---

## 2. 5팀 확장 상태 흐름 정의

### 2.1 팀 구성

| 팀 코드 | 팀명 | 역할 | 에이전트 예시 |
|---|---|---|---|
| `BUNKER` | 벙커 | 기획, 위임, 총괄 PM | 송PO, 정DA, 김작가 등 |
| `JARVIS` | 자비스 | 개발, 구현 | 자비스 |
| `KIMQA` | 김감사 | QA, 테스트 검증 | 김감사 |
| `KANGCHUL` | 강철 | 리팩토링, 보안, 성능 | 강철 |
| `KKOMKKOM` | 꼼꼼이 | 문서화 | 꼼꼼이 (미등록) |

### 2.2 정방향 상태 흐름 (Happy Path)

```
[PLAN_PENDING]       벙커가 태스크 수신 대기
       │
       ▼
[PLAN_IN_PROGRESS]   벙커가 기획/분석 중
       │
       ▼
[DEV_PENDING]        자비스 개발 대기 큐 진입
       │
       ▼
[DEV_IN_PROGRESS]    자비스 개발 중
       │
       ▼
[QA_PENDING]         김감사 QA 대기 큐 진입
       │
       ▼
[QA_IN_PROGRESS]     김감사 QA 수행 중
       │
       ▼
[HARDEN_PENDING]     강철 리팩토링/보안/성능 대기
       │
       ▼
[HARDEN_IN_PROGRESS] 강철 작업 중
       │
       ▼
[DOC_PENDING]        꼼꼼이 문서화 대기
       │
       ▼
[DOC_IN_PROGRESS]    꼼꼼이 문서화 중
       │
       ▼
[DEPLOY_READY]       배포 준비 완료 → 벙커(송PO) 최종 승인
       │
       ▼
[DONE]               완료/배포됨
```

### 2.3 역방향 흐름 (반려/수정 요청)

```
[QA_IN_PROGRESS]      → [DEV_REVISION]       김감사가 버그 발견 → 자비스 수정
[HARDEN_IN_PROGRESS]  → [DEV_REVISION]       강철이 구조적 문제 발견 → 자비스 재개발
[HARDEN_IN_PROGRESS]  → [QA_REVISION]        강철이 테스트 누락 발견 → 김감사 재검증
[DOC_IN_PROGRESS]     → [HARDEN_REVISION]    꼼꼼이가 스펙 불일치 발견 → 강철 재확인
[DEPLOY_READY]        → [PLAN_REVISION]      벙커(송PO)가 기획 변경 판단 → 재기획
```

**수정(REVISION) 상태 처리 원칙:**
- `*_REVISION` 상태에서 수정 완료 시, 해당 팀의 `*_PENDING` 상태가 아닌 **다음 팀의 `*_PENDING`** 으로 재진입
- 예: `DEV_REVISION` → 자비스 수정 완료 → `QA_PENDING` (다시 QA부터)
- 반복 수정 횟수는 `revision_count` 필드로 추적

### 2.4 전체 상태값 목록 (18개)

| # | 상태 코드 | 소유 팀 | 설명 |
|---|---|---|---|
| 1 | `PLAN_PENDING` | BUNKER | 기획 대기 |
| 2 | `PLAN_IN_PROGRESS` | BUNKER | 기획 진행 중 |
| 3 | `PLAN_REVISION` | BUNKER | 기획 재검토 (반려됨) |
| 4 | `DEV_PENDING` | JARVIS | 개발 대기 |
| 5 | `DEV_IN_PROGRESS` | JARVIS | 개발 진행 중 |
| 6 | `DEV_REVISION` | JARVIS | 개발 수정 (반려됨) |
| 7 | `QA_PENDING` | KIMQA | QA 대기 |
| 8 | `QA_IN_PROGRESS` | KIMQA | QA 진행 중 |
| 9 | `QA_REVISION` | KIMQA | QA 재검증 (반려됨) |
| 10 | `HARDEN_PENDING` | KANGCHUL | 하드닝 대기 |
| 11 | `HARDEN_IN_PROGRESS` | KANGCHUL | 하드닝 진행 중 |
| 12 | `HARDEN_REVISION` | KANGCHUL | 하드닝 재확인 (반려됨) |
| 13 | `DOC_PENDING` | KKOMKKOM | 문서화 대기 |
| 14 | `DOC_IN_PROGRESS` | KKOMKKOM | 문서화 진행 중 |
| 15 | `DEPLOY_READY` | BUNKER | 배포 준비 완료 |
| 16 | `DONE` | - | 완료 |
| 17 | `ON_HOLD` | - | 보류 |
| 18 | `CANCELLED` | - | 취소 |

---

## 3. Agent_Tasks 시트 컬럼 구조안

### 3.1 컬럼 정의 (JSON)

```json
{
  "columns": [
    {
      "col": "A",
      "field": "task_id",
      "header": "Task ID",
      "type": "string",
      "format": "TASK-YYYYMMDD-NNN",
      "example": "TASK-20260228-001",
      "description": "고유 태스크 식별자. 자동 생성.",
      "required": true
    },
    {
      "col": "B",
      "field": "title",
      "header": "제목",
      "type": "string",
      "example": "슬랙 모달 에러 수정 v2",
      "description": "태스크 제목 (50자 이내 권장)",
      "required": true
    },
    {
      "col": "C",
      "field": "status",
      "header": "상태",
      "type": "enum",
      "values": [
        "PLAN_PENDING", "PLAN_IN_PROGRESS", "PLAN_REVISION",
        "DEV_PENDING", "DEV_IN_PROGRESS", "DEV_REVISION",
        "QA_PENDING", "QA_IN_PROGRESS", "QA_REVISION",
        "HARDEN_PENDING", "HARDEN_IN_PROGRESS", "HARDEN_REVISION",
        "DOC_PENDING", "DOC_IN_PROGRESS",
        "DEPLOY_READY", "DONE", "ON_HOLD", "CANCELLED"
      ],
      "description": "현재 태스크 상태. 18개 상태값 중 하나.",
      "required": true
    },
    {
      "col": "D",
      "field": "assigned_team",
      "header": "담당팀",
      "type": "enum",
      "values": ["BUNKER", "JARVIS", "KIMQA", "KANGCHUL", "KKOMKKOM"],
      "description": "현재 태스크를 소유한 팀 코드",
      "required": true
    },
    {
      "col": "E",
      "field": "assigned_agent",
      "header": "담당 에이전트",
      "type": "string",
      "example": "jarvis",
      "description": "팀 내 실제 작업 에이전트 이름",
      "required": false
    },
    {
      "col": "F",
      "field": "priority",
      "header": "우선순위",
      "type": "enum",
      "values": ["P0_CRITICAL", "P1_HIGH", "P2_MEDIUM", "P3_LOW"],
      "description": "태스크 우선순위. P0이 최우선.",
      "required": true
    },
    {
      "col": "G",
      "field": "created_by",
      "header": "생성자",
      "type": "string",
      "example": "song-po",
      "description": "태스크를 최초 생성한 사람/에이전트",
      "required": true
    },
    {
      "col": "H",
      "field": "created_at",
      "header": "생성일시",
      "type": "datetime",
      "format": "YYYY-MM-DD HH:mm:ss",
      "example": "2026-02-28 14:30:00",
      "description": "태스크 생성 타임스탬프",
      "required": true
    },
    {
      "col": "I",
      "field": "updated_at",
      "header": "수정일시",
      "type": "datetime",
      "format": "YYYY-MM-DD HH:mm:ss",
      "description": "마지막 상태 변경 타임스탬프. 자동 갱신.",
      "required": true
    },
    {
      "col": "J",
      "field": "dependencies",
      "header": "선행 태스크",
      "type": "string",
      "format": "comma-separated task_ids",
      "example": "TASK-20260228-001,TASK-20260228-003",
      "description": "이 태스크 시작 전 완료되어야 할 태스크 ID 목록",
      "required": false
    },
    {
      "col": "K",
      "field": "input_ref",
      "header": "입력 참조",
      "type": "string",
      "example": "gdrive://docs/기획서_v2.md",
      "description": "입력 데이터 참조 (파일 경로, 문서 링크, 또는 JSON 패키지 ID)",
      "required": false
    },
    {
      "col": "L",
      "field": "output_ref",
      "header": "산출물 참조",
      "type": "string",
      "example": "agent_work/jarvis/2026-02-28_slack_modal.gs",
      "description": "작업 산출물 참조 (파일 경로, 문서 링크)",
      "required": false
    },
    {
      "col": "M",
      "field": "feedback",
      "header": "피드백/사유",
      "type": "string",
      "example": "3번 라인 캐시 미스 에러. revision_count:2",
      "description": "반려 사유, QA 리포트, 리뷰 코멘트 등. 최신 피드백만 기록(이력은 로그 시트).",
      "required": false
    },
    {
      "col": "N",
      "field": "revision_count",
      "header": "수정 횟수",
      "type": "integer",
      "default": 0,
      "description": "반려-수정 반복 횟수. 3회 초과 시 에스컬레이션.",
      "required": true
    },
    {
      "col": "O",
      "field": "tags",
      "header": "태그",
      "type": "string",
      "format": "comma-separated",
      "example": "slack,bugfix,urgent",
      "description": "분류/검색용 태그",
      "required": false
    },
    {
      "col": "P",
      "field": "payload_json",
      "header": "페이로드 (JSON)",
      "type": "json_string",
      "description": "구조화된 입출력 데이터. JSON 문자열. 상세 스키마는 섹션 5 참조.",
      "required": false
    }
  ],
  "total_columns": 16,
  "sheet_name": "Agent_Tasks",
  "id_format": "TASK-YYYYMMDD-NNN",
  "note": "기존 8열(A~H) → 16열(A~P)로 확장. 기존 매핑: A=A, B→C, C→G, D→K(input_ref), E→L(output_ref), F→M, G→D+E, H→I"
}
```

### 3.2 기존 대비 변경 요약

| 항목 | 기존 (2팀) | 확장 (5팀) |
|---|---|---|
| 컬럼 수 | 8 (A~H) | 16 (A~P) |
| 상태값 수 | 6개 | 18개 |
| 팀 구분 | Owner 열 1개로 통합 | assigned_team + assigned_agent 분리 |
| 우선순위 | 없음 | P0~P3 4단계 |
| 의존성 | 없음 | dependencies 열 |
| 페이로드 | 자연어(D열) | input_ref + output_ref + payload_json |
| 수정 추적 | 없음 | revision_count |
| 태그 | 없음 | tags 열 |

---

## 4. 팀별 상태 전이(State Transition) 매핑 테이블

### 4.1 정방향 전이

| 현재 상태 | 트리거 액션 | 다음 상태 | 소유권 이동 |
|---|---|---|---|
| `PLAN_PENDING` | 벙커가 태스크 픽업 | `PLAN_IN_PROGRESS` | BUNKER 유지 |
| `PLAN_IN_PROGRESS` | 벙커 기획 완료 | `DEV_PENDING` | BUNKER → JARVIS |
| `DEV_PENDING` | 자비스가 태스크 픽업 | `DEV_IN_PROGRESS` | JARVIS 유지 |
| `DEV_IN_PROGRESS` | 자비스 개발 완료 | `QA_PENDING` | JARVIS → KIMQA |
| `QA_PENDING` | 김감사가 태스크 픽업 | `QA_IN_PROGRESS` | KIMQA 유지 |
| `QA_IN_PROGRESS` | 김감사 QA 통과 | `HARDEN_PENDING` | KIMQA → KANGCHUL |
| `HARDEN_PENDING` | 강철이 태스크 픽업 | `HARDEN_IN_PROGRESS` | KANGCHUL 유지 |
| `HARDEN_IN_PROGRESS` | 강철 하드닝 완료 | `DOC_PENDING` | KANGCHUL → KKOMKKOM |
| `DOC_PENDING` | 꼼꼼이가 태스크 픽업 | `DOC_IN_PROGRESS` | KKOMKKOM 유지 |
| `DOC_IN_PROGRESS` | 꼼꼼이 문서화 완료 | `DEPLOY_READY` | KKOMKKOM → BUNKER |
| `DEPLOY_READY` | 벙커(송PO) 최종 승인 | `DONE` | BUNKER → (없음) |

### 4.2 역방향 전이 (반려/수정 요청)

| 현재 상태 | 반려 사유 | 다음 상태 | 소유권 이동 | 비고 |
|---|---|---|---|---|
| `QA_IN_PROGRESS` | 버그/결함 발견 | `DEV_REVISION` | KIMQA → JARVIS | 자비스 수정 후 → `QA_PENDING` |
| `HARDEN_IN_PROGRESS` | 구조적 결함, 성능 이슈 | `DEV_REVISION` | KANGCHUL → JARVIS | 자비스 수정 후 → `QA_PENDING` (QA 재통과 필수) |
| `HARDEN_IN_PROGRESS` | 테스트 커버리지 부족 | `QA_REVISION` | KANGCHUL → KIMQA | 김감사 보강 후 → `HARDEN_PENDING` |
| `DOC_IN_PROGRESS` | 스펙 불일치 | `HARDEN_REVISION` | KKOMKKOM → KANGCHUL | 강철 재확인 후 → `DOC_PENDING` |
| `DEPLOY_READY` | 기획 방향 변경 | `PLAN_REVISION` | BUNKER → BUNKER | 벙커 재기획 후 → `DEV_PENDING` |

### 4.3 REVISION 상태 완료 후 재진입 규칙

| REVISION 상태 | 수정 완료 후 진입 상태 | 근거 |
|---|---|---|
| `PLAN_REVISION` | `DEV_PENDING` | 기획 변경이므로 개발부터 재시작 |
| `DEV_REVISION` | `QA_PENDING` | 코드 변경이므로 QA부터 재검증 |
| `QA_REVISION` | `HARDEN_PENDING` | 테스트 보강 후 하드닝 재진입 |
| `HARDEN_REVISION` | `DOC_PENDING` | 스펙 확정 후 문서화 재진입 |

### 4.4 특수 전이

| 현재 상태 | 트리거 | 다음 상태 | 비고 |
|---|---|---|---|
| (모든 상태) | 벙커(송PO) 판단 | `ON_HOLD` | 외부 의존 대기 등 |
| (모든 상태) | 벙커(송PO) 판단 | `CANCELLED` | 태스크 폐기 |
| `ON_HOLD` | 재개 조건 충족 | (이전 상태) | 보류 전 상태로 복귀 |

### 4.5 상태 전이 다이어그램 (텍스트)

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    ▼                                                     │
  PLAN_PENDING → PLAN_IN_PROGRESS → DEV_PENDING → DEV_IN_PROGRESS → QA_PENDING
                    ▲                     ▲              │                  │
                    │                     │              │                  ▼
              PLAN_REVISION          DEV_REVISION ◄──────┘           QA_IN_PROGRESS
                    ▲                     ▲                               │
                    │                     │                    ┌──────────┤
                    │                     │                    ▼          ▼
                DEPLOY_READY        HARDEN_IN_PROGRESS ◄─ HARDEN_PENDING │
                    │                     │                               │
                    ▼                     ├──► QA_REVISION ──────────────►┘
                   DONE                   │
                                          ▼
                                    DOC_PENDING → DOC_IN_PROGRESS → DEPLOY_READY
                                         ▲              │
                                         │              ▼
                                    HARDEN_REVISION ◄───┘
```

---

## 5. JSON 태스크 패키지 스키마 초안

### 5.1 태스크 패키지 (payload_json 열에 저장되는 구조)

```json
{
  "$schema": "task_package_v1",
  "schema_version": "1.0.0",
  "task_package": {
    "task_id": "TASK-20260228-001",
    "title": "슬랙 모달 에러 수정 v2",
    "status": "DEV_PENDING",
    "priority": "P1_HIGH",
    "created_by": "song-po",
    "created_at": "2026-02-28T14:30:00+09:00",
    "updated_at": "2026-02-28T15:00:00+09:00",
    "assigned_team": "JARVIS",
    "assigned_agent": "jarvis",
    "revision_count": 0,
    "dependencies": [],
    "tags": ["slack", "bugfix"],

    "pipeline_history": [
      {
        "seq": 1,
        "from_status": "PLAN_PENDING",
        "to_status": "PLAN_IN_PROGRESS",
        "actor": "song-po",
        "team": "BUNKER",
        "timestamp": "2026-02-28T14:30:00+09:00",
        "note": "태스크 착수"
      },
      {
        "seq": 2,
        "from_status": "PLAN_IN_PROGRESS",
        "to_status": "DEV_PENDING",
        "actor": "song-po",
        "team": "BUNKER",
        "timestamp": "2026-02-28T15:00:00+09:00",
        "note": "기획 완료, 개발 위임"
      }
    ],

    "team_payloads": {
      "BUNKER": {
        "phase": "planning",
        "input": {
          "request": "슬랙 모달 에러 2.0 기획서대로 수정",
          "spec_ref": "gdrive://docs/slack_modal_spec_v2.md",
          "acceptance_criteria": [
            "모달 열림/닫힘 정상 동작",
            "에러 메시지 사용자 친화적 표시",
            "기존 데이터 유실 없음"
          ]
        },
        "output": {
          "plan_doc_ref": "gdrive://docs/plan_slack_modal_v2.md",
          "estimated_complexity": "medium"
        }
      },
      "JARVIS": {
        "phase": "development",
        "input": {
          "plan_ref": "gdrive://docs/plan_slack_modal_v2.md",
          "target_files": [
            "src/slack/modal_handler.gs",
            "src/slack/error_display.gs"
          ]
        },
        "output": {
          "code_ref": null,
          "commit_hash": null,
          "dev_notes": null
        }
      },
      "KIMQA": {
        "phase": "qa",
        "input": {
          "code_ref": null,
          "test_scope": null
        },
        "output": {
          "qa_report_ref": null,
          "bugs_found": [],
          "verdict": null
        }
      },
      "KANGCHUL": {
        "phase": "hardening",
        "input": {
          "code_ref": null,
          "qa_report_ref": null
        },
        "output": {
          "refactor_ref": null,
          "security_findings": [],
          "performance_report": null
        }
      },
      "KKOMKKOM": {
        "phase": "documentation",
        "input": {
          "code_ref": null,
          "refactor_ref": null
        },
        "output": {
          "doc_ref": null,
          "changelog_entry": null
        },
        "_note": "꼼꼼이팀 GitHub 미등록. 인터페이스만 정의, 상세 보류."
      }
    }
  }
}
```

### 5.2 스키마 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `task_id` | string | Y | TASK-YYYYMMDD-NNN 형식 |
| `title` | string | Y | 태스크 제목 |
| `status` | enum | Y | 18개 상태값 중 하나 |
| `priority` | enum | Y | P0_CRITICAL ~ P3_LOW |
| `created_by` | string | Y | 생성자 ID |
| `created_at` | ISO 8601 | Y | 생성 타임스탬프 |
| `updated_at` | ISO 8601 | Y | 최종 수정 타임스탬프 |
| `assigned_team` | enum | Y | 5개 팀 코드 |
| `assigned_agent` | string | N | 팀 내 담당 에이전트 |
| `revision_count` | integer | Y | 반려 횟수 (기본값 0) |
| `dependencies` | string[] | N | 선행 태스크 ID 배열 |
| `tags` | string[] | N | 분류 태그 |
| `pipeline_history` | object[] | Y | 상태 전이 이력 (감사 추적용) |
| `team_payloads` | object | Y | 팀별 입출력 데이터 |
| `team_payloads.*.phase` | string | Y | 팀 담당 단계명 |
| `team_payloads.*.input` | object | N | 해당 팀의 입력 데이터 |
| `team_payloads.*.output` | object | N | 해당 팀의 산출물 데이터 |

---

## 6. 보조 시트 구조 (권장)

Agent_Tasks 시트 외에 다음 보조 시트를 권장합니다.

### 6.1 Agent_Task_Log (상태 전이 이력)

| 열 | 필드 | 설명 |
|---|---|---|
| A | log_id | 자동 증가 ID |
| B | task_id | 참조 태스크 ID |
| C | from_status | 이전 상태 |
| D | to_status | 변경된 상태 |
| E | actor | 변경 수행자 |
| F | team | 변경 수행 팀 |
| G | timestamp | 변경 시각 |
| H | note | 변경 사유/메모 |

### 6.2 Agent_Registry (에이전트 등록부)

| 열 | 필드 | 설명 |
|---|---|---|
| A | agent_id | 에이전트 고유 ID |
| B | agent_name | 에이전트 이름 |
| C | team | 소속 팀 코드 |
| D | role | 역할 설명 |
| E | status | active / inactive / pending |
| F | github_registered | Y/N |

---

## 7. 꼼꼼이팀 관련 유의사항

- GitHub 미등록 상태이므로 `Agent_Registry`에서 `status=pending`, `github_registered=N`으로 등록
- `DOC_PENDING` / `DOC_IN_PROGRESS` 상태 전이 로직은 구현하되, 실제 트리거는 보류
- `team_payloads.KKOMKKOM`의 인터페이스(input/output 구조)만 정의, 세부 구현은 등록 완료 후 확정
- 꼼꼼이팀 미등록 시 대체 흐름: `HARDEN_IN_PROGRESS` → `DEPLOY_READY` (문서화 단계 스킵 가능, 송PO 승인 필요)

---

## 8. 검증 체크리스트

- [x] 상태값: 18개 정의 완료 (정방향 14 + 특수 4)
- [x] 5팀 모두 최소 2개 이상의 상태 보유
- [x] 역방향 흐름: 5개 반려 경로 정의
- [x] REVISION 재진입 규칙: 4개 경로 명확화
- [x] 컬럼 구조: 16열, 기존 8열 대비 매핑 명시
- [x] JSON 스키마: pipeline_history + team_payloads 포함
- [x] 꼼꼼이팀: 인터페이스만 정의, 상세 보류 명시
- [x] 기존 문서와의 호환성: 기존 열 매핑 테이블 제공 (3.1 note 참조)
