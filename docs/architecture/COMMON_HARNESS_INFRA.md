# ⚙️ 공통 하네스 인프라 설계서 (Common Agent Harness Infrastructure)

---

## 문서 개요

**목적**: 5개 에이전트 팀(벙커, 자비스, 김감사, 강철, 꼼꼼이)이 공통으로 사용하는 하네스 실행 인프라를 정의한다.
**범위**: 런타임 실행 아키텍처, 관측성·로깅, 자동 복구, 비용 거버넌스, 실패 기반 개선 루프
**대상 독자**: 팀장(전체 구조 이해), 자비스 팀(구현), 강철 팀(성능·보안 검증)

> **하네스란?**
> AI 모델을 감싸서 장기 실행 태스크를 관리하는 인프라.
> 모델이 CPU라면, 컨텍스트 윈도우는 RAM이고, 하네스는 운영체제(OS)다.
> 모델은 "무엇을·왜" 담당하고, 하네스는 "어떻게·어디서"를 담당한다.

---

## 하네스 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    🎛️ 하네스 컨트롤 플레인                     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 💰 비용   │  │ 📊 관측성 │  │ 🔄 복구   │  │ 🔁 개선   │   │
│  │ 거버넌스  │  │ ·로깅    │  │ ·재시도   │  │ 루프     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              🚦 태스크 라우터 (Task Router)            │   │
│  │  요청 분석 → 팀 식별 → 에이전트 선택 → 프롬프트 주입    │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │                                 │
│  ┌────────┬───────────────┼───────────────┬────────┐       │
│  ▼        ▼               ▼               ▼        ▼       │
│ 🏴벙커  🤵자비스      🕵️김감사       🔧강철   📝꼼꼼이     │
│ (AX)    (Dev)         (QA)          (AX)    (Docs)        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           💾 컨텍스트 지속성 계층                       │   │
│  │  progress.md · state.json · session_handoff          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           🛠️ 도구 계층 (Tool Layer)                   │   │
│  │  Claude Skills · MCP Servers · GAS API · GitHub     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---
---

## 1. 런타임 실행 아키텍처

### 1.1 설계 규칙

**태스크 라우팅 엔진**:
사용자의 자연어 요청을 분석하여 적합한 팀과 에이전트를 자동 선택하고, 해당 에이전트의 시스템 프롬프트를 Claude API에 주입하는 중앙 라우팅 시스템이다.

```
사용자 요청 → 의도 분류 → 팀 선택 → 에이전트 선택 → 시스템 프롬프트 로드
→ Claude API 호출 → 결과 검증 → 사용자 반환
```

**라우팅 규칙**:

| 의도 키워드 | 팀 | 1차 에이전트 |
|---|---|---|
| 데이터, 엑셀, 분석, KPI | 벙커 | 송PO → 정DA |
| 문서, 보고서, 공문, PPT | 벙커 | 송PO → 박DC |
| 알림, 공지, 슬랙, 소통 | 벙커 | 송PO → 김CM |
| 디자인, 로고, 테마, 브랜딩 | 벙커 | 송PO → 최AR |
| 스킬, 자동화 템플릿 | 벙커 | 송PO → 윤SK |
| 기획, PRD, 개발, 기능 | 자비스 | 자비스PO |
| 코드, GAS, API, 백엔드 | 자비스 | 자비스PO → 에이다 |
| UI, 프론트, HTML, 반응형 | 자비스 | 자비스PO → 클로이 |
| QA, 검수, 테스트, 승인 | 김감사 | 김감사 |
| 리팩토링, 성능, 보안 패치 | 강철 | 강철 |
| 템플릿, 가이드, 폴더 구조 | 꼼꼼이 | 꼼꼼이 |

**시스템 프롬프트 주입 방식**:
각 에이전트의 XML 시스템 프롬프트는 AGENTS.md 파일에서 로드하여 Claude API의 `system` 파라미터로 주입한다. 팀별 AGENTS.md는 각 팀 설계서 부록에 정의되어 있다.

---

### 1.2 참조 구현 (Python)

```python
"""
하네스 코어: 태스크 라우터 + 에이전트 실행기
- 이 코드는 설계 의도를 보여주는 참조 구현입니다.
- 실제 배포 시 자비스 팀(에이다)이 GAS 환경에 맞게 수정합니다.
"""
import anthropic
import json
from pathlib import Path

# ── 에이전트 설정 로드 ──
def load_agent_config(team: str, agent: str) -> dict:
    """AGENTS.md에서 에이전트 설정을 파싱하여 반환"""
    config_path = Path(f"teams/{team}/AGENTS.md")
    # 마크다운 파싱 → JSON 변환
    raw = config_path.read_text(encoding="utf-8")
    return parse_agents_md(raw, agent)

# ── 태스크 라우터 ──
ROUTING_TABLE = {
    "데이터|엑셀|분석|KPI": ("bunker", "song_po"),
    "기획|PRD|개발|기능":    ("jarvis", "jarvis_po"),
    "QA|검수|테스트|승인":    ("kim_qa", "kim_gamsa"),
    "리팩토링|성능|보안패치":  ("gangcheol", "gangcheol"),
    "템플릿|가이드|폴더구조":  ("kkoomkkoom", "kkoomkkoom"),
}

def route_task(user_request: str) -> tuple[str, str]:
    """사용자 요청에서 팀·에이전트를 자동 선택"""
    for keywords, (team, agent) in ROUTING_TABLE.items():
        if any(kw in user_request for kw in keywords.split("|")):
            return team, agent
    return "bunker", "song_po"  # 기본: 벙커 송PO

# ── 에이전트 실행기 ──
client = anthropic.Anthropic()

def execute_agent(team: str, agent: str, user_message: str) -> dict:
    """에이전트 시스템 프롬프트를 로드하고 Claude API를 호출"""
    config = load_agent_config(team, agent)

    response = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=8096,
        system=config["system_prompt"],  # AGENTS.md에서 로드한 시스템 프롬프트
        messages=[{"role": "user", "content": user_message}]
    )

    result = {
        "agent": agent,
        "team": team,
        "response": response.content[0].text,
        "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
        "model": response.model,
    }
    return result

# ── 메인 실행 ──
def run_harness(user_request: str) -> dict:
    """하네스 메인 루프: 라우팅 → 실행 → 로깅"""
    team, agent = route_task(user_request)
    log_event("task_routed", {"team": team, "agent": agent, "request": user_request})

    result = execute_with_retry(team, agent, user_request)  # 섹션 3 참조
    log_event("task_completed", result)                      # 섹션 2 참조
    track_cost(result)                                       # 섹션 4 참조

    return result
```

**GAS 환경 적용 노트**:
- `anthropic` 패키지 → `UrlFetchApp.fetch()` + Anthropic REST API 직접 호출로 대체
- `Path` 파일 읽기 → `DriveApp.getFileById()` 또는 GitHub raw URL fetch로 대체
- `async/await` → GAS는 동기 실행이므로 콜백 패턴 또는 트리거 체인으로 대체

---
---

## 2. 관측성·로깅 표준 (Observability & Logging)

### 2.1 설계 규칙

**로깅 원칙**: "측정하지 않으면 개선할 수 없다"

모든 에이전트의 모든 도구 호출, 에러, 사람 개입, 타임아웃을 기록한다. 로그는 **구조화된 JSON** 형식으로 통일하여 자동 분석이 가능하게 한다.

**로그 이벤트 분류**:

| 이벤트 유형 | 설명 | 예시 |
|---|---|---|
| `task_routed` | 태스크가 특정 팀·에이전트에 배분됨 | 송PO → 정DA |
| `skill_invoked` | Claude Skill이 호출됨 | xlsx SKILL.md 로드 |
| `tool_called` | 외부 도구(MCP, API)가 호출됨 | 슬랙 API 호출 |
| `task_completed` | 태스크 정상 완료 | T-001 done |
| `task_failed` | 태스크 실패 | API 타임아웃 |
| `retry_attempted` | 재시도 발생 | 2차 재시도 (4초 대기) |
| `circuit_opened` | 서킷 브레이커 발동 | 5연속 실패 → 일시 정지 |
| `human_escalated` | 사람에게 에스컬레이션됨 | 팀장 승인 대기 |
| `cost_alert` | 비용 임계값 도달 | 월 예산 80% 도달 |

**로그 표준 형식 (JSON)**:

```json
{
  "timestamp": "2026-02-28T14:32:15+09:00",
  "event_type": "task_completed",
  "team": "bunker",
  "agent": "jung_da",
  "task_id": "T-001",
  "details": {
    "skill_used": "xlsx",
    "execution_time_ms": 12500,
    "tokens_input": 2340,
    "tokens_output": 1890,
    "output_file": "/outputs/급여대장_202602.xlsx"
  },
  "status": "success",
  "error": null
}
```

**메트릭 대시보드 항목**:

| 메트릭 | 단위 | 집계 주기 | 경고 임계값 |
|--------|------|----------|------------|
| 태스크 완료율 | % | 일간 | < 90% |
| 평균 응답 시간 | ms | 일간 | > 30,000ms |
| 에이전트별 토큰 사용량 | tokens | 일간 | 팀 예산 80% |
| 재시도 발생률 | % | 일간 | > 15% |
| 서킷 브레이커 발동 횟수 | 건 | 주간 | > 3건/주 |
| QA 통과율 | % | 주간 | < 85% |
| 핑퐁 평균 횟수 | 회 | 주간 | > 3회 |

---

### 2.2 참조 구현 (Python)

```python
"""
관측성 모듈: 구조화 로깅 + 메트릭 수집
"""
import json
import time
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

# ── 구조화 로그 ──
def log_event(event_type: str, details: dict) -> None:
    """JSON 구조화 로그를 출력 (파일 또는 스프레드시트로 전송 가능)"""
    log_entry = {
        "timestamp": datetime.now(KST).isoformat(),
        "event_type": event_type,
        "team": details.get("team", "unknown"),
        "agent": details.get("agent", "unknown"),
        "task_id": details.get("task_id", "N/A"),
        "details": details,
        "status": details.get("status", "info"),
        "error": details.get("error", None),
    }
    # 출력 (실제 배포 시 스프레드시트/로그 서비스로 전송)
    print(json.dumps(log_entry, ensure_ascii=False))
    append_to_log_sheet(log_entry)  # GAS: 로그 시트에 추가

# ── 실행 시간 측정 데코레이터 ──
def measure_time(func):
    """에이전트 실행 시간을 자동 측정"""
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed_ms = int((time.time() - start) * 1000)
        result["execution_time_ms"] = elapsed_ms
        log_event("execution_measured", {
            "agent": result.get("agent"),
            "task_id": result.get("task_id"),
            "execution_time_ms": elapsed_ms,
        })
        return result
    return wrapper

# ── 메트릭 집계 ──
class MetricsCollector:
    """일간·주간 메트릭 집계기"""
    def __init__(self):
        self.tasks_total = 0
        self.tasks_success = 0
        self.total_tokens = 0
        self.retry_count = 0

    def record_task(self, status: str, tokens: int):
        self.tasks_total += 1
        self.total_tokens += tokens
        if status == "success":
            self.tasks_success += 1

    def record_retry(self):
        self.retry_count += 1

    def get_summary(self) -> dict:
        return {
            "completion_rate": round(self.tasks_success / max(self.tasks_total, 1) * 100, 1),
            "total_tokens": self.total_tokens,
            "retry_rate": round(self.retry_count / max(self.tasks_total, 1) * 100, 1),
        }

metrics = MetricsCollector()
```

**GAS 환경 적용 노트**:
- `print(json.dumps(...))` → `SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs').appendRow([...])` 로 스프레드시트 로그
- 메트릭 대시보드 → 구글 스프레드시트 차트 또는 Data Studio 연동
- `time.time()` → `new Date().getTime()` (JavaScript)

---
---

## 3. 자동 복구·서킷 브레이커 (Auto-Recovery & Circuit Breaker)

### 3.1 설계 규칙

**재시도 정책**:
- 최대 재시도: **3회**
- 대기 전략: **지수 백오프** (2초 → 4초 → 8초)
- 재시도 대상: API 타임아웃, 네트워크 에러, 일시적 서비스 오류
- 재시도 제외: 인증 실패, 입력값 오류, 비용 한도 초과 (즉시 실패 처리)

**서킷 브레이커**:
- 발동 조건: 동일 에이전트가 **5연속 실패** 시 서킷 오픈
- 오픈 상태: 해당 에이전트 일시 정지, 팀장 + 팀 리드에게 알림
- 하프 오픈: **10분 후** 1건 테스트 시도 → 성공 시 서킷 클로즈
- 클로즈: 정상 운영 재개, 실패 카운터 리셋

```
정상 운영 (CLOSED)
    │
    ├─ 실패 1~4회: 재시도 (지수 백오프)
    │
    ├─ 5연속 실패: 서킷 OPEN → 에이전트 일시 정지
    │                          → 팀장·팀 리드 알림
    │
    ├─ 10분 대기: HALF-OPEN → 1건 테스트 시도
    │
    ├─ 테스트 성공: CLOSED → 정상 운영
    └─ 테스트 실패: OPEN 유지 → 10분 후 재시도
```

**폴백 전략**:

| 상황 | 폴백 행동 |
|------|----------|
| 특정 에이전트 서킷 오픈 | 같은 팀 내 다른 에이전트에게 단순 태스크 위임 |
| 팀 전체 서킷 오픈 | 팀장에게 에스컬레이션 + 장애 보고 |
| Claude API 전체 장애 | 대기열에 태스크 저장 → 복구 후 순차 실행 |
| 비용 한도 초과 | 저비용 모델(Haiku)로 전환 또는 대기열 저장 |

---

### 3.2 참조 구현 (Python)

```python
"""
자동 복구 모듈: 재시도 + 서킷 브레이커
"""
import asyncio
from enum import Enum

# ── 서킷 브레이커 ──
class CircuitState(Enum):
    CLOSED = "closed"       # 정상
    OPEN = "open"           # 차단
    HALF_OPEN = "half_open" # 테스트 중

class CircuitBreaker:
    """에이전트별 서킷 브레이커"""
    def __init__(self, failure_threshold=5, recovery_timeout=600):
        self.failure_threshold = failure_threshold  # 5연속 실패
        self.recovery_timeout = recovery_timeout    # 10분 (600초)
        self.failure_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time = None

    def record_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def record_failure(self, agent_id: str):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            log_event("circuit_opened", {
                "agent": agent_id,
                "failure_count": self.failure_count,
            })
            notify_escalation(agent_id, "서킷 브레이커 발동: 5연속 실패")

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            elapsed = time.time() - (self.last_failure_time or 0)
            if elapsed >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                return True  # 테스트 1건 허용
            return False
        return True  # HALF_OPEN → 테스트 실행

# 에이전트별 서킷 브레이커 인스턴스
circuit_breakers: dict[str, CircuitBreaker] = {}

def get_circuit(agent_id: str) -> CircuitBreaker:
    if agent_id not in circuit_breakers:
        circuit_breakers[agent_id] = CircuitBreaker()
    return circuit_breakers[agent_id]

# ── 재시도 래퍼 ──
RETRYABLE_ERRORS = (TimeoutError, ConnectionError, anthropic.APIStatusError)
NON_RETRYABLE_ERRORS = (anthropic.AuthenticationError, ValueError)

def execute_with_retry(team: str, agent: str, user_message: str,
                       max_retries: int = 3) -> dict:
    """지수 백오프 재시도 + 서킷 브레이커 통합"""
    circuit = get_circuit(agent)

    if not circuit.can_execute():
        log_event("circuit_blocked", {"agent": agent})
        return fallback_response(team, agent, user_message)

    for attempt in range(max_retries):
        try:
            result = execute_agent(team, agent, user_message)
            circuit.record_success()
            return result

        except NON_RETRYABLE_ERRORS as e:
            # 재시도 불가 에러 → 즉시 실패
            log_event("task_failed", {"agent": agent, "error": str(e), "retryable": False})
            circuit.record_failure(agent)
            raise

        except RETRYABLE_ERRORS as e:
            wait_seconds = 2 ** attempt  # 2초, 4초, 8초
            log_event("retry_attempted", {
                "agent": agent,
                "attempt": attempt + 1,
                "wait_seconds": wait_seconds,
                "error": str(e),
            })
            metrics.record_retry()
            time.sleep(wait_seconds)

    # 3회 모두 실패
    circuit.record_failure(agent)
    return fallback_response(team, agent, user_message)

def fallback_response(team: str, agent: str, user_message: str) -> dict:
    """폴백: 대기열 저장 + 알림"""
    log_event("fallback_triggered", {"team": team, "agent": agent})
    enqueue_task(team, agent, user_message)  # 대기열에 저장
    return {"status": "queued", "message": "일시적 장애로 대기열에 저장되었습니다."}
```

**GAS 환경 적용 노트**:
- `time.sleep()` → `Utilities.sleep(ms)` (GAS)
- `async` 없음 → 동기 실행, 트리거 체인으로 비동기 시뮬레이션
- 서킷 상태 저장 → `PropertiesService.getScriptProperties()` 에 JSON 저장

---
---

## 4. 비용·리소스 거버넌스 (Cost & Resource Governance)

### 4.1 설계 규칙

**비용 제어 원칙**: "에이전트는 예산을 협상할 수 없다"

**팀별 월간 토큰 예산**:

| 팀 | 월간 예산 (토큰) | 주요 모델 | 비고 |
|---|---:|---|---|
| 🏴 벙커 | 5,000,000 | Sonnet | 데이터·문서·디자인 |
| 🤵 자비스 | 8,000,000 | Sonnet | 코드 생성 토큰 많음 |
| 🕵️ 김감사 | 3,000,000 | Sonnet | QA 리뷰 (입력 많음) |
| 🔧 강철 | 4,000,000 | Sonnet | 리팩토링 코드 분석 |
| 📝 꼼꼼이 | 2,000,000 | Sonnet | 문서 작성·변환 |
| **합계** | **22,000,000** | | |

**경고 임계값**:

| 사용률 | 행동 |
|:------:|------|
| **80%** | ⚠️ 경고 알림 (팀 리드 + 팀장) |
| **90%** | 🟠 모델 다운그레이드 (Sonnet → Haiku) |
| **95%** | 🔴 신규 태스크 대기열 저장, 진행 중 태스크만 완료 |
| **100%** | 🚫 팀 일시 정지, 팀장 승인 후 추가 예산 또는 다음 월 |

**단일 태스크 리밋**:

| 제한 | 값 | 초과 시 |
|------|---:|--------|
| 최대 토큰 (1회 호출) | 16,000 | 태스크 분할 |
| 최대 실행 시간 (1회) | 120초 | 타임아웃 → 재시도 |
| 최대 도구 호출 (1 태스크) | 50회 | 강제 종료 → 사람 검토 |
| 최대 재시도 | 3회 | 서킷 브레이커 체크 |

---

### 4.2 참조 구현 (Python)

```python
"""
비용 거버넌스 모듈: 팀별 예산 추적 + 경고 + 자동 제한
"""

# ── 팀별 예산 설정 ──
TEAM_BUDGETS = {
    "bunker":     {"monthly_tokens": 5_000_000, "used": 0},
    "jarvis":     {"monthly_tokens": 8_000_000, "used": 0},
    "kim_qa":     {"monthly_tokens": 3_000_000, "used": 0},
    "gangcheol":  {"monthly_tokens": 4_000_000, "used": 0},
    "kkoomkkoom": {"monthly_tokens": 2_000_000, "used": 0},
}

def track_cost(result: dict) -> None:
    """태스크 완료 후 토큰 사용량 추적"""
    team = result["team"]
    tokens = result.get("tokens_used", 0)

    budget = TEAM_BUDGETS[team]
    budget["used"] += tokens
    usage_pct = budget["used"] / budget["monthly_tokens"] * 100

    # 경고 임계값 체크
    if usage_pct >= 100:
        log_event("cost_alert", {"team": team, "level": "CRITICAL", "usage_pct": 100})
        pause_team(team)
    elif usage_pct >= 95:
        log_event("cost_alert", {"team": team, "level": "HIGH", "usage_pct": usage_pct})
        queue_new_tasks(team)  # 신규 태스크 대기열로
    elif usage_pct >= 90:
        log_event("cost_alert", {"team": team, "level": "MEDIUM", "usage_pct": usage_pct})
        downgrade_model(team, "claude-haiku-4-5-20251001")
    elif usage_pct >= 80:
        log_event("cost_alert", {"team": team, "level": "WARNING", "usage_pct": usage_pct})
        notify_team_lead(team, f"월간 예산 {usage_pct:.0f}% 사용")

def check_task_limits(team: str, estimated_tokens: int) -> bool:
    """태스크 실행 전 리밋 체크"""
    budget = TEAM_BUDGETS[team]
    remaining = budget["monthly_tokens"] - budget["used"]

    if estimated_tokens > 16_000:
        log_event("task_too_large", {"team": team, "tokens": estimated_tokens})
        return False  # 태스크 분할 필요

    if estimated_tokens > remaining:
        log_event("budget_exceeded", {"team": team, "remaining": remaining})
        return False  # 예산 부족

    return True
```

**GAS 환경 적용 노트**:
- 예산 데이터 → 전용 스프레드시트 "비용_관리" 시트에 저장
- 월초 자동 리셋 → 시간 기반 트리거 (매월 1일 00:00)
- 알림 → 슬랙 Webhook 또는 이메일

---
---

## 5. 실패 기반 반복 개선 루프 (Failure-Driven Iteration Loop)

### 5.1 설계 규칙

**원칙**: "각 실패는 빠진 가드레일을 드러낸다. 가드레일을 추가하고, 배포하고, 다음 실패를 찾는다."

**개선 사이클**:

```
1️⃣ 실패 수집 (Collect)
   └─ 로그에서 task_failed, retry_attempted, circuit_opened 이벤트 수집

2️⃣ 원인 분류 (Classify)
   └─ 프롬프트 문제 | 도구 문제 | 입력 문제 | 인프라 문제 | 모델 한계

3️⃣ 패치 작성 (Patch)
   └─ 프롬프트 수정 | behavior_rules 추가 | 도구 설정 변경 | 가드레일 추가

4️⃣ 검증 (Verify)
   └─ 동일 입력으로 재실행 → 실패 재현 안 됨 확인

5️⃣ 배포 (Deploy)
   └─ AGENTS.md 업데이트 → 팀 공지

6️⃣ 효과 측정 (Measure)
   └─ 1주 후 동일 유형 실패 재발 여부 확인
```

**실패 원인 분류 체계**:

| 분류 | 비율 (예상) | 대응 방법 | 담당 |
|------|:----------:|----------|------|
| **프롬프트 문제** | 40% | 시스템 프롬프트 behavior_rules 보강 | 각 팀 리드 |
| **도구 문제** | 20% | SKILL.md 가이드 보완, 도구 설정 변경 | 윤SK (벙커) |
| **입력 문제** | 15% | 입력 검증 가드레일 추가 | 강철 (보안전문가) |
| **인프라 문제** | 15% | 재시도 정책 조정, 서킷 설정 변경 | 강철 (성능전문가) |
| **모델 한계** | 10% | 태스크 분할, 프롬프트 단순화, 모델 업그레이드 | 자비스 (알렉스) |

**주간 실패 리뷰 프로세스**:

| 단계 | 담당 | 산출물 |
|------|------|--------|
| ① 주간 실패 로그 수집 | 자동 (로깅 시스템) | failure_weekly_YYYY-WW.json |
| ② 원인 분류 | 강철 AX팀 | 분류 보고서 |
| ③ 패치 우선순위 결정 | 각 팀 리드 협의 | 패치 백로그 |
| ④ 패치 적용 | 해당 팀 | AGENTS.md 업데이트 |
| ⑤ 효과 확인 | 김감사 QA팀 | 재발 여부 보고 |

---

### 5.2 참조 구현 (Python)

```python
"""
실패 분석 모듈: 실패 수집 → 분류 → 패치 추적
"""

# ── 실패 분류기 ──
FAILURE_CATEGORIES = {
    "prompt":        ["hallucination", "wrong_format", "ignored_rules", "off_topic"],
    "tool":          ["skill_not_found", "skill_error", "mcp_timeout", "api_error"],
    "input":         ["invalid_format", "missing_field", "encoding_error"],
    "infrastructure":["timeout", "rate_limit", "network_error", "memory_exceeded"],
    "model_limit":   ["context_overflow", "capability_gap", "reasoning_error"],
}

def classify_failure(error_log: dict) -> str:
    """에러 로그에서 실패 원인을 자동 분류"""
    error_msg = error_log.get("error", "").lower()
    for category, keywords in FAILURE_CATEGORIES.items():
        if any(kw in error_msg for kw in keywords):
            return category
    return "unknown"

# ── 패치 추적기 ──
class PatchTracker:
    """실패 → 패치 → 효과 측정 추적"""
    def __init__(self):
        self.patches = []

    def create_patch(self, failure_id: str, category: str,
                     description: str, assigned_to: str) -> dict:
        patch = {
            "patch_id": f"PATCH-{len(self.patches)+1:03d}",
            "failure_id": failure_id,
            "category": category,
            "description": description,
            "assigned_to": assigned_to,
            "status": "pending",  # pending → applied → verified → closed
            "created": datetime.now(KST).isoformat(),
            "verified": None,
            "recurrence": None,  # 재발 여부
        }
        self.patches.append(patch)
        log_event("patch_created", patch)
        return patch

    def verify_patch(self, patch_id: str, recurred: bool) -> None:
        for p in self.patches:
            if p["patch_id"] == patch_id:
                p["status"] = "verified" if not recurred else "reopened"
                p["verified"] = datetime.now(KST).isoformat()
                p["recurrence"] = recurred
                log_event("patch_verified", p)

    def weekly_summary(self) -> dict:
        total = len(self.patches)
        applied = sum(1 for p in self.patches if p["status"] in ("applied","verified","closed"))
        verified = sum(1 for p in self.patches if p["status"] == "verified")
        recurred = sum(1 for p in self.patches if p.get("recurrence"))
        return {
            "total_patches": total,
            "applied": applied,
            "verified": verified,
            "recurrence_rate": round(recurred / max(verified, 1) * 100, 1),
        }

patch_tracker = PatchTracker()
```

---
---

## 6. 크로스 팀 하네스 연동 맵

각 팀의 하네스 구성요소가 어떻게 연결되는지 전체 흐름:

```
사용자 요청
    │
    ▼
┌─ 태스크 라우터 ─────────────────────────────────┐
│  의도 분류 → 팀 선택 → 에이전트 선택              │
│  비용 리밋 체크 → 서킷 브레이커 체크              │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼          ▼
  벙커       자비스     김감사      강철       꼼꼼이
  AGENTS.md  AGENTS.md  AGENTS.md  AGENTS.md  AGENTS.md
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
  에이전트 실행 (시스템 프롬프트 + Claude API)
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
  관측성 로그 (JSON) → 통합 로그 시트
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
  비용 추적 → 팀별 예산 차감
    │
    ▼
  실패 시 → 재시도 (3회) → 서킷 브레이커 → 폴백
    │
    ▼
  완료 → progress.md 업데이트 → 세션 핸드오프 준비
    │
    ▼
  주간 실패 리뷰 → 패치 → AGENTS.md 업데이트 → 개선 루프
```

---
---

## 부록: 용어집

| 용어 | 설명 |
|------|------|
| **하네스 (Harness)** | AI 모델을 감싸서 태스크 실행을 관리하는 인프라. 모델이 엔진이면 하네스는 자동차. |
| **서킷 브레이커** | 연속 실패 시 에이전트를 일시 정지시키는 안전장치 |
| **지수 백오프** | 재시도 간격을 2배씩 늘리는 대기 전략 (2초→4초→8초) |
| **컨텍스트 지속성** | 세션 간에 작업 진행 상태를 유지하는 메커니즘 |
| **AGENTS.md** | 에이전트가 직접 파싱하는 기계 가독 설정 파일 |
| **폴백** | 주요 경로 실패 시 대체 행동 (대기열 저장, 모델 전환 등) |
| **골든 패스** | 팀이 상속하는 사전 승인된 표준 설정 |
| **패치** | 실패 원인을 해결하기 위한 프롬프트·규칙·설정 변경 |
| **관측성** | 시스템 내부 상태를 외부에서 파악할 수 있는 능력 |

---

**문서 버전**: v1.0
**작성일**: 2026-02-28
**작성자**: 벙커 AX팀 기반 하네스 설계
**상태**: ✅ 완성
**참조**: Anthropic "Effective harnesses for long-running agents", OpenAI "Harness Engineering", Salesforce "Agent Harness"
