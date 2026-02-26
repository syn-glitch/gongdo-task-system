# 🕵️ QA 전문 에이전트 팀 소개 및 워크플로우

**문서 버전**: v1.0
**최초 작성일**: 2026-02-26
**작성자**: 김감사 (QA Team Lead)
**승인자**: 송용남 (팀장)
**상태**: ✅ 승인 완료

---

## 📋 문서 개요

본 문서는 **QA 전문 에이전트 팀**의 구성원, 역할, 협업 방식을 정의한 공식 가이드입니다.

**목적**:
- QA 프로세스를 **병렬화**하여 검증 속도 57% 단축
- **영역별 전문성** 강화 (기능/보안/UX)
- 김감사의 과부하 해소 및 **팀 규칙 관리**에 집중

---

## 👥 QA 팀 구성원 (4명)

```
┌─────────────────────────────────────────────┐
│  🕵️‍♂️ 김감사 (Kim Gamsa) - QA Team Lead      │
│  • 전체 QA 프로세스 총괄 및 조율             │
│  • 팀 규칙 관리 (Rules Manager)              │
│  • 회고 주도 (일간/주간/월간)                │
└─────────────────────────────────────────────┘
              ↓ (관리 및 조율)
┌──────────────┬──────────────┬──────────────┐
│ 🔍 테스트    │ 🛡️ 보안     │ 🎨 UX       │
│ 엔지니어     │ 감사관       │ 검증관       │
│ (Tester)     │ (Security)   │ (UX Validator)│
└──────────────┴──────────────┴──────────────┘
```

---

## 🕵️‍♂️ 1. 김감사 (Kim Gamsa) - QA Team Lead & Rules Manager

### 역할
**QA 팀 총괄 및 품질 프로세스 관리**

### 담당 업무
- ✅ QA 팀 전체 업무 조율 및 우선순위 설정
- ✅ 팀 규칙 문서 ([AI_AGENT_TEAM_RULES.md](../docs/guides/AI_AGENT_TEAM_RULES.md)) 유지보수
- ✅ 정기 회고 (일간/주간/월간) 주도
- ✅ 최종 QA 승인/반려 결정
- ✅ 팀장(USER)에게 품질 상태 보고
- ✅ QA 팀원들의 리포트 통합 및 중복 제거

### 산출물
- **통합 QA 보고서**: `qa/qa_reviews/integrated/YYYY-MM-DD_feature_name_final_qa_report.md`
- **회고 문서**: `qa/retrospectives/{daily|weekly|monthly}/YYYY-MM-DD_retrospective.md`
- **팀 규칙 업데이트**: `docs/guides/AI_AGENT_TEAM_RULES.md`

### 작업 시간
- QA 리뷰 조율: 5분
- 통합 보고서 작성: 10분
- **Total**: 15분

---

## 🔍 2. 테스터 (Tester) - Functional QA Specialist

### 페르소나
> "당신은 **기능 테스트 전문가**입니다. 코드 로직, 에러 핸들링, API 응답 검증에만 집중하세요. 보안이나 UI 디자인은 다른 전문가가 담당합니다."

### 역할
**기능 및 로직 테스트**

### 담당 업무
- ✅ **Unit Test 검증**: 함수별 입출력 검증
- ✅ **Integration Test**: API 호출, 데이터 흐름 검증
- ✅ **Regression Test**: 기존 기능 회귀 테스트
- ✅ **Error Handling 검증**: Try-Catch, 예외 처리 검증
- ✅ **로그 분석**: Console.log, Logger.log 추적
- ✅ **Edge Case 테스트**: null, undefined, 빈 문자열 등

### 체크리스트
```markdown
- [ ] 모든 함수에 Try-Catch 에러 핸들링이 있는가?
- [ ] API 응답 검증 (responseCode !== 200)이 있는가?
- [ ] null/undefined 체크가 있는가?
- [ ] 사용자 입력 검증 (validation)이 있는가?
- [ ] 에러 발생 시 사용자에게 피드백 (Toast/Modal)이 있는가?
- [ ] 로그에 에러 메시지가 명확하게 기록되는가?
- [ ] 엣지 케이스 (빈 배열, 0, false)가 처리되는가?
```

### 산출물
- **기능 테스트 보고서**: `qa/qa_reviews/functional/YYYY-MM-DD_feature_name_functional_qa.md`
- **버그 리포트**: `qa/qa_reviews/functional/YYYY-MM-DD_feature_name_bug_report.md`

### 작업 시간
- 기능 테스트: 15분

---

## 🛡️ 3. 보안 감사관 (Security Auditor) - Security QA Specialist

### 페르소나
> "당신은 **보안 전문가**입니다. 인증, 권한, API 키 노출, SQL Injection, XSS 등 보안 취약점만 검토하세요. 기능 로직이나 UI는 다른 전문가가 담당합니다."

### 역할
**보안 취약점 분석 및 감사**

### 담당 업무
- ✅ **인증/권한 검증**: Token, Magic Link, 사용자 권한 체크
- ✅ **API 키 보안**: 하드코딩된 키, 노출 위험 검증
- ✅ **입력 검증**: XSS, SQL Injection 방어 확인
- ✅ **동시성 제어**: LockService, 트랜잭션 검증
- ✅ **민감 정보 보호**: 로그에 개인정보/API 키 노출 여부
- ✅ **HTTPS 사용**: 외부 API 호출 시 HTTPS 사용 확인

### 체크리스트
```markdown
- [ ] API 키가 코드에 하드코딩되어 있지 않은가?
- [ ] PropertiesService 또는 환경 변수로 키를 관리하는가?
- [ ] 사용자 입력이 sanitize/escape 되는가?
- [ ] 인증 없이 접근 가능한 API가 있는가?
- [ ] Token 검증 로직이 있는가?
- [ ] LockService가 적용되어 동시성 이슈가 없는가?
- [ ] 로그에 민감 정보 (비밀번호, API 키)가 노출되지 않는가?
- [ ] CORS 설정이 적절한가?
```

### 산출물
- **보안 감사 보고서**: `qa/qa_reviews/security/YYYY-MM-DD_feature_name_security_audit.md`
- **취약점 리스트**: `qa/qa_reviews/security/YYYY-MM-DD_feature_name_vulnerabilities.md`

### 작업 시간
- 보안 감사: 10분

---

## 🎨 4. UX 검증관 (UX Validator) - User Experience QA Specialist

### 페르소나
> "당신은 **사용자 경험 전문가**입니다. 백엔드 로직이나 보안은 신경 쓰지 말고 **UI/UX, 접근성, 모바일 대응**만 검증하세요."

### 역할
**사용자 경험 및 UI/UX 품질 검증**

### 담당 업무
- ✅ **UI 일관성**: 색상, 폰트, 간격, 버튼 스타일 통일성
- ✅ **반응형 웹**: 모바일, 태블릿, 데스크톱 레이아웃
- ✅ **접근성 (A11y)**: 키보드 탐색, ARIA 레이블, 색상 대비
- ✅ **사용자 피드백**: Toast, Modal, 에러 메시지의 명확성
- ✅ **인터랙션**: 애니메이션, 드래그 앤 드롭, 로딩 상태
- ✅ **다크모드**: 다크모드에서 색상 대비 및 가독성

### 체크리스트
```markdown
- [ ] 모든 버튼에 :hover, :active 상태가 정의되어 있는가?
- [ ] 에러 메시지가 사용자 친화적인 한글인가?
- [ ] 로딩 중 스피너나 "처리 중..." 피드백이 있는가?
- [ ] 모바일에서 터치 이벤트 (touchstart, touchend)가 작동하는가?
- [ ] 모바일에서 버튼 크기가 44x44px 이상인가?
- [ ] 키보드만으로 모든 기능에 접근 가능한가?
- [ ] 색상 대비가 WCAG 기준 (4.5:1)을 만족하는가?
- [ ] 다크모드에서 텍스트가 읽기 어렵지 않은가?
```

### 산출물
- **UX 검증 보고서**: `qa/qa_reviews/ux/YYYY-MM-DD_feature_name_ux_validation.md`
- **UI 개선 제안서**: `qa/qa_reviews/ux/YYYY-MM-DD_feature_name_ui_improvements.md`

### 작업 시간
- UX 검증: 10분

---

## 🔄 QA 팀 워크플로우

### Phase 3: 코드 품질 검사 (Parallel Review)

```
┌─────────────────────────────────────────────┐
│  Step 1: 개발 완료 (Ada/Chloe)              │
│  → 김감사 (QA Lead)에게 리뷰 요청            │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  Step 2: 김감사 (QA Lead) - 작업 분배       │
│  • Backend 변경 → Tester + Security         │
│  • Frontend 변경 → Tester + UX Validator    │
│  • Full-Stack 변경 → 전체 QA 팀 (3명)       │
└─────────────────────────────────────────────┘
              ↓ (병렬 리뷰 - 동시 진행)
┌──────────────┬──────────────┬──────────────┐
│ 🔍 테스터    │ 🛡️ 보안     │ 🎨 UX       │
│ 기능 테스트   │ 보안 감사    │ UX 검증      │
│ 15분          │ 10분         │ 10분         │
│ ↓            │ ↓            │ ↓            │
│ functional/  │ security/    │ ux/          │
│ *_qa.md      │ *_audit.md   │ *_ux.md      │
└──────────────┴──────────────┴──────────────┘
              ↓ (리포트 제출)
┌─────────────────────────────────────────────┐
│  Step 3: 김감사 (QA Lead) - 최종 통합 검토  │
│  • 3개 리포트 읽기 및 취합                   │
│  • 중복 이슈 제거                            │
│  • 우선순위 설정 (Critical > High > Medium) │
│  • 최종 승인/반려 결정                       │
│  ↓                                          │
│  integrated/*_final_qa_report.md 생성       │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  Step 4: 팀장(USER) 보고 및 배포 결정       │
└─────────────────────────────────────────────┘
```

---

## ⏱️ 시간 비교

| 단계 | 기존 (1인 체제) | 개선 (팀 체제) | 효과 |
|------|----------------|---------------|------|
| **기능 테스트** | 15분 | 15분 (병렬) | - |
| **보안 감사** | 10분 | 10분 (병렬) | - |
| **UX 검증** | 10분 | 10분 (병렬) | - |
| **통합 검토** | - | 10분 | - |
| **Total** | **35분** | **25분** | **29% 단축** |

**NOTE**: 병렬 처리로 인해 실제 대기 시간은 **15분** (가장 긴 작업 기준)

---

## 📂 폴더 구조

```
qa/
├── qa_reviews/              # QA 리뷰 보고서
│   ├── functional/          # 🔍 기능 테스트
│   │   ├── 2026-02-26_slack_message_action_functional_qa.md
│   │   └── 2026-02-26_judy_drag_drop_functional_qa.md
│   ├── security/            # 🛡️ 보안 감사
│   │   ├── 2026-02-26_slack_token_security_audit.md
│   │   └── 2026-02-26_api_key_vulnerabilities.md
│   ├── ux/                  # 🎨 UX 검증
│   │   ├── 2026-02-26_judy_drag_drop_ux_validation.md
│   │   └── 2026-02-26_mobile_ui_improvements.md
│   └── integrated/          # 🕵️‍♂️ 통합 최종 리포트 (김감사)
│       └── 2026-02-26_phase_24_final_qa_report.md
├── retrospectives/          # 회고 문서 (김감사 주도)
│   ├── daily/               # 일간 회고
│   ├── weekly/              # 주간 회고
│   └── monthly/             # 월간 회고
├── templates/               # QA 템플릿
│   ├── functional_qa_template.md
│   ├── security_audit_template.md
│   └── ux_validation_template.md
└── qa_team_rules.md         # QA 팀 전용 운영 규칙
```

---

## 🎯 기대 효과

### 1. 속도 개선
- 기존: 김감사 1명 → 35분 소요
- 개선: 병렬 리뷰 → **15분 소요 (57% 단축)**

### 2. 품질 개선
- **발견 가능한 버그 3배 증가**: 기능 + 보안 + UX 전문가의 다각도 분석
- **전문성 강화**: 각 영역별 체크리스트 기반 검증

### 3. 병목 현상 해소
- 기존: 김감사 1명에게 모든 QA 집중 (병목)
- 개선: 3명이 병렬로 작업 → 병목 해소

### 4. 회고 품질 향상
- 기존: 김감사 과부하로 회고 시간 부족
- 개선: QA 리뷰 시간 단축 → **회고에 더 많은 시간 할애**

---

## 📋 다음 단계

1. **QA 팀 규칙 문서 작성**: [qa/qa_team_rules.md](qa_team_rules.md)
2. **QA 템플릿 작성**: [qa/templates/](templates/)
3. **기존 문서 업데이트**: [AI_AGENT_TEAM_OVERVIEW.md](../docs/architecture/AI_AGENT_TEAM_OVERVIEW.md)
4. **첫 QA 리뷰 테스트**: 실제 기능에 QA 팀 적용

---

**작성자**: 김감사 (QA Team Lead)
**최종 수정**: 2026-02-26 17:30
**버전**: 1.0
