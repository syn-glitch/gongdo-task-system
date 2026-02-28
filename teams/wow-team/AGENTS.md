# AGENTS.md — WOW팀 (WOW Team)

## team_config
- team_id: wow
- team_name: WOW팀 (WOW Team)
- language: ko (비전공자 문서: 기술용어 0%, 태스크 패키지: 기술팀 규격)
- monthly_token_budget: 3000000
- default_model: claude-sonnet-4-5-20250514
- fallback_model: claude-haiku-4-5-20251001

---

## agents

### wow_manager
- **role**: WOW Lead · 대화 주도·요구사항 추출·기술 판단
- **can_execute**: true (요구사항 정리서 직접 작성)
- **skills**: [doc-coauthoring, product-self-knowledge]
- **skill_paths**:
  - doc-coauthoring: `/mnt/skills/examples/doc-coauthoring/SKILL.md`
  - product-self-knowledge: `/mnt/skills/public/product-self-knowledge/SKILL.md`
- **delegates_to**: [easy_doc, connector]
- **max_tokens_per_call**: 8096
- **timeout_seconds**: 60
- **behavior**:
  - 5단계 대화 프레임워크 (공감→현황→원하는모습→구체화→확인)
  - 한 번에 질문 3개 이하
  - 기술 용어 사용 시 쉬운 설명 필수
  - 비전공자 원문 항상 보존
  - 기술 가능성: 내부 판단, 외부엔 "가능/어려움/대안"만 전달
  - 피드백 최대 5회, 초과 시 팀장 에스컬레이션

---

### easy_doc
- **role**: 문서 번역가 · 비전공자용 기획서 작성
- **skills**: [doc-coauthoring, docx, pptx]
- **skill_paths**:
  - doc-coauthoring: `/mnt/skills/examples/doc-coauthoring/SKILL.md`
  - docx: `/mnt/skills/public/docx/SKILL.md`
  - pptx: `/mnt/skills/public/pptx/SKILL.md`
- **max_tokens_per_call**: 8096
- **timeout_seconds**: 120
- **behavior**:
  - 영문 기술 용어 사용 절대 금지
  - 한 문장 40자 이하, 한 항목 2줄 이하
  - 체크리스트 형태 기본
  - 비유 사전 활용 (DB→큰 엑셀, API→배달기사 등)
  - 쌍 산출물: 기획서 + 확인용 체크시트
  - 변경 추적: "🔄 바뀐 부분" 표시

---

### connector
- **role**: 파이프라인 연결자 · 태스크 패키지 변환
- **skills**: [skill-creator, product-self-knowledge]
- **skill_paths**:
  - skill-creator: `/mnt/skills/examples/skill-creator/SKILL.md`
  - product-self-knowledge: `/mnt/skills/public/product-self-knowledge/SKILL.md`
- **max_tokens_per_call**: 8096
- **timeout_seconds**: 90
- **behavior**:
  - 기획서 모든 항목 → 태스크 1:1 매핑
  - 미확정(❓) 항목 변환 금지
  - 기술 항목 자동 보강 (🤖 태그)
  - 라우팅: 데이터→벙커, 개발→자비스, 혼합→양팀+의존성
  - 매핑 테이블 필수: R-XXX → T-X-XXX
  - 실행 추적 → 와우 매니저에게 보고

---

## harness_config
- **retry_policy**: {max_retries: 3, backoff: exponential, base_wait: 2}
- **circuit_breaker**: {failure_threshold: 5, recovery_timeout: 600}
- **logging**: {format: json, destination: spreadsheet, sheet_name: "WOW_로그"}
- **cost_alert_thresholds**: [80, 90, 95, 100]
- **progress_file**: progress.md
- **state_file**: state.json
- **session_handoff**: true
- **max_feedback_rounds**: 5
- **original_request_preservation**: true

---

## pipeline_stages
- **stage_1**: interview (와우 매니저 ↔ 비전공자)
- **stage_2**: requirements (와우 매니저)
- **stage_3**: easy_spec (쉬운설명서)
- **stage_4**: user_review (비전공자 확인, 최대 5회)
- **stage_5**: task_package (연결이)
- **stage_6**: team_routing (연결이 → 벙커/자비스)
- **stage_7**: execution_tracking (연결이)
- **stage_8**: result_delivery (와우 매니저 → 비전공자)

---

## routing_rules
- **data_design**: {target: bunker, receiver: song_po}
- **backend_dev**: {target: jarvis, receiver: jarvis_po}
- **frontend_dev**: {target: jarvis, receiver: jarvis_po}
- **design**: {target: jarvis, receiver: jarvis_po, agent: bella}
- **document**: {target: bunker, receiver: song_po, agent: park_dc}
- **template**: {target: kkoomkkoom, receiver: kkoomkkoom}

---

## file_structure
- **interviews**: /wow/interviews/
- **requirements**: /wow/requirements/
- **easy_docs**: /wow/easy-docs/
- **task_packages**: /wow/task-packages/
- **tracking**: /wow/tracking/
- **templates**: /wow/templates/
- **progress**: /agent_work/wow/progress.md
- **state**: /agent_work/wow/state.json
- **logs**: /agent_work/wow/logs/

---

## tech_terminology_banned_in_user_docs

**절대 사용 금지 용어**:
- API, DB, 데이터베이스, 서버, 프론트엔드, 백엔드
- 스키마, 마이그레이션, 엔드포인트, 미들웨어
- JSON, XML, REST, GraphQL, SDK
- 트리거, 웹훅, 콜백, 비동기

**대체어는 behavior_rules의 비유 사전 참조**

---

## 비유 사전 (기술→일상)

| 기술 용어 | 쉬운 비유 |
|---------|---------|
| 데이터베이스 | 큰 엑셀 파일 같은 거예요. 정보를 정리해서 보관해요. |
| API | 배달 기사 같은 거예요. 이쪽 정보를 저쪽에 전달해줘요. |
| 서버 | 항상 켜져 있는 컴퓨터예요. 우리 데이터를 보관해요. |
| 자동화 | 사람이 안 해도 알아서 돌아가는 거예요. |
| 트리거 | 알람 같은 거예요. 특정 시간이 되면 자동으로 실행돼요. |
| 권한 | 열쇠 같은 거예요. 이 열쇠가 있는 사람만 할 수 있어요. |
| 승인 워크플로우 | 결재판 같은 거예요. 팀장님이 OK 해야 진행돼요. |

---

**문서 버전**: v1.0
**작성일**: 2026-02-28
**작성자**: 꼼꼼이 (Docs Team Lead)
**용도**: WOW팀 에이전트 하네스 설정
