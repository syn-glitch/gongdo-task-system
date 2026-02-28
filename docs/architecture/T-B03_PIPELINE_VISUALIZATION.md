# T-B03: 파이프라인 시각화 다이어그램

> 작성: 최AR (디자인) | 우선순위: P1
> 상태: T-B01/T-B02 산출물 반영 전 기본 설계

---

## 1. 팀별 비주얼 정의 (Visual Identity)

### 1-1. 컬러 매핑

| 팀 | 역할 | HEX (Primary) | HEX (Light/BG) | 비고 |
|---|---|---|---|---|
| 벙커 BUNKER | 기획 | `#1A1A1A` | `#3A3A3A` | 블랙 계열 -- 기반, 시작점 |
| 자비스 JARVIS | 개발 | `#1565C0` | `#BBDEFB` | 블루 계열 -- 기술, 신뢰 |
| 김감사 AUDITOR | QA | `#C62828` | `#FFCDD2` | 레드 계열 -- 검증, 경고 |
| 강철 STEEL | 리팩토링 | `#616161` | `#E0E0E0` | 그레이 계열 -- 견고함, 구조 |
| 꼼꼼이 DETAIL | 문서화 | `#2E7D32` | `#C8E6C9` | 그린 계열 -- 완성, 정리 (미확정) |

### 1-2. 아이콘/이모지 매핑

| 팀 | 이모지 | 의미 |
|---|---|---|
| 벙커 | `[ B ]` | Bunker 이니셜, 방패 형상 |
| 자비스 | `{ J }` | 코드 블록 연상 |
| 김감사 | `< A >` | 검사 태그 |
| 강철 | `[ S ]` | 구조 블록 |
| 꼼꼼이 | `( D )` | 부드러운 문서 형태 (점선 = 미확정) |

### 1-3. 상태별 컬러

| 상태 | HEX | 용도 |
|---|---|---|
| 정상 흐름 (Forward) | `#1B5E20` | 진행 방향 화살표 |
| 역방향 흐름 (Reject/Revise) | `#E65100` | 반려/수정 요청 화살표 |
| 대기 (Idle) | `#9E9E9E` | 비활성 노드 |
| 에러 (Error) | `#B71C1C` | 실패/블로킹 상태 |

### 1-4. 타이포그래피 (다이어그램 내)

- 팀명: **Bold**, 14px 이상
- 설명 텍스트: Regular, 12px
- 상태 라벨: Medium, 11px, 대문자 권장
- 폰트: `Pretendard` (한글) / `JetBrains Mono` (코드/다이어그램)

---

## 2. 파이프라인 흐름도 (Pipeline Flowchart)

### 2-1. 정상 흐름 + 역방향 흐름

```mermaid
flowchart LR
    subgraph BUNKER ["[ B ] 벙커 -- 기획"]
        B1[요구사항 정의]
        B2[태스크 분배]
    end

    subgraph JARVIS ["{ J } 자비스 -- 개발"]
        J1[설계]
        J2[구현]
        J3[단위 테스트]
    end

    subgraph AUDITOR ["< A > 김감사 -- QA"]
        A1[코드 리뷰]
        A2[통합 테스트]
        A3[품질 판정]
    end

    subgraph STEEL ["[ S ] 강철 -- 리팩토링"]
        S1[구조 분석]
        S2[리팩토링 실행]
        S3[회귀 검증]
    end

    subgraph DETAIL ["( D ) 꼼꼼이 -- 문서화"]
        D1[API 문서]
        D2[사용자 가이드]
        D3[변경 이력]
    end

    %% 정상 흐름 (Forward Flow)
    B2 -->|"태스크 전달"| J1
    J3 -->|"구현 완료"| A1
    A3 -->|"QA 통과"| S1
    S3 -->|"리팩토링 완료"| D1

    %% 역방향 흐름 (Reject / Revise)
    A3 -.->|"반려: 결함 발견"| J1
    S1 -.->|"수정 요청: 구조 문제"| J2
    A1 -.->|"반려: 기준 미달"| J2
    J1 -.->|"명세 불충분"| B1

    %% 스타일 정의
    style BUNKER fill:#1A1A1A,stroke:#1A1A1A,color:#FFFFFF
    style JARVIS fill:#1565C0,stroke:#1565C0,color:#FFFFFF
    style AUDITOR fill:#C62828,stroke:#C62828,color:#FFFFFF
    style STEEL fill:#616161,stroke:#616161,color:#FFFFFF
    style DETAIL fill:#2E7D32,stroke:#2E7D32,color:#FFFFFF,stroke-dasharray: 5 5
```

### 2-2. 간소화 버전 (Overview)

```mermaid
flowchart LR
    B["[ B ] 벙커\n기획"]
    J["{ J } 자비스\n개발"]
    A["< A > 김감사\nQA"]
    S["[ S ] 강철\n리팩토링"]
    D["( D ) 꼼꼼이\n문서화"]

    B ==>|"태스크"| J
    J ==>|"산출물"| A
    A ==>|"승인"| S
    S ==>|"완료"| D

    A -.->|"반려"| J
    S -.->|"수정"| J
    J -.->|"명세 부족"| B

    style B fill:#1A1A1A,stroke:#3A3A3A,color:#FFF
    style J fill:#1565C0,stroke:#1976D2,color:#FFF
    style A fill:#C62828,stroke:#D32F2F,color:#FFF
    style S fill:#616161,stroke:#757575,color:#FFF
    style D fill:#2E7D32,stroke:#388E3C,color:#FFF,stroke-dasharray: 5 5
```

---

## 3. 상태 전이 다이어그램 (State Diagram)

```mermaid
stateDiagram-v2
    [*] --> Draft : 태스크 생성

    state "벙커 영역" as BunkerZone {
        Draft --> Planned : 요구사항 확정
        Planned --> Assigned : 태스크 배분
    }

    state "자비스 영역" as JarvisZone {
        Assigned --> InDev : 개발 착수
        InDev --> DevComplete : 구현 완료
        InDev --> NeedSpec : 명세 불충분
        NeedSpec --> Draft : 기획 재요청
    }

    state "김감사 영역" as AuditorZone {
        DevComplete --> InReview : QA 착수
        InReview --> Approved : 품질 통과
        InReview --> Rejected : 결함 발견
        Rejected --> InDev : 수정 요청
    }

    state "강철 영역" as SteelZone {
        Approved --> InRefactor : 리팩토링 착수
        InRefactor --> Refactored : 리팩토링 완료
        InRefactor --> StructIssue : 구조 문제 발견
        StructIssue --> InDev : 재구현 요청
    }

    state "꼼꼼이 영역 (미확정)" as DetailZone {
        Refactored --> InDoc : 문서화 착수
        InDoc --> Documented : 문서 완료
    }

    Documented --> [*] : 파이프라인 완료
```

---

## 4. 역방향 흐름 상세 (Rejection Paths)

```mermaid
flowchart TB
    subgraph REJECT_FLOWS ["역방향 흐름 패턴"]

        subgraph P1 ["패턴 1: QA 반려"]
            QA_FAIL["김감사: 결함 발견"]
            QA_FAIL -->|"결함 리포트 첨부"| DEV_FIX["자비스: 수정 착수"]
            DEV_FIX -->|"수정 완료"| QA_RE["김감사: 재검증"]
        end

        subgraph P2 ["패턴 2: 구조 문제"]
            STR_FAIL["강철: 구조 문제"]
            STR_FAIL -->|"리팩토링 가이드 첨부"| DEV_RE["자비스: 재구현"]
            DEV_RE -->|"재구현 완료"| QA_AGAIN["김감사: 재검증"]
        end

        subgraph P3 ["패턴 3: 명세 부족"]
            SPEC_FAIL["자비스: 명세 불충분"]
            SPEC_FAIL -->|"질의서 첨부"| PLAN_RE["벙커: 명세 보완"]
            PLAN_RE -->|"보완 완료"| DEV_START["자비스: 개발 재개"]
        end
    end

    style P1 fill:#FFCDD2,stroke:#C62828
    style P2 fill:#E0E0E0,stroke:#616161
    style P3 fill:#3A3A3A,stroke:#1A1A1A,color:#FFF
```

---

## 5. 디자인 노트

### 적용 원칙
- **점선(dash)**: 꼼꼼이 팀 관련 요소 및 역방향 흐름에 사용
- **실선(solid)**: 정상 흐름, 확정된 팀 관련 요소
- **굵은 화살표(==>)**: 메인 파이프라인 흐름 (Overview)
- **얇은 점선 화살표(-.->)**: 반려/수정 요청

### Mermaid 렌더링 호환성
- GitHub Markdown: 지원
- GitLab Markdown: 지원
- VS Code (Markdown Preview Mermaid): 지원
- Notion: 미지원 (이미지 변환 필요)

### 확장 포인트
- T-B01(정DA) 산출물 수신 시: 상태 전이 다이어그램의 상태값/조건 상세화
- T-B02(김CM) 산출물 수신 시: 팀 간 인터페이스 메시지 포맷 반영

---

*최AR | 벙커 디자인팀 | v1.0-draft*
