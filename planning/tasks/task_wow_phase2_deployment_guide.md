# 🚀 [Deployment Guide] WOW Phase 2 배포 및 테스트 가이드

---
**문서 정보**
- **작성자**: 자비스 팀장 Alex
- **작성일**: 2026-02-28
- **대상**: 자비스 개발팀, 김감사 QA팀
- **선행 작업**: Task 3.1, 3.2, 3.3 완료
---

## 📋 배포 체크리스트

### Step 1: Google Apps Script 배포

#### 1.1 Claude API 키 설정
```bash
1. Google Apps Script 편집기 열기
2. 프로젝트 설정(⚙️) > Script Properties 클릭
3. 속성 추가:
   - Key: CLAUDE_API_KEY
   - Value: sk-ant-api03-xxx... (실제 Claude API 키)
```

#### 1.2 ai_chat_wow.gs 배포
```bash
1. ai_chat_wow.gs 파일이 프로젝트에 추가되었는지 확인
2. 배포(Deploy) > 새 배포(New deployment) 클릭
3. 설정:
   - 유형(Type): 웹 앱(Web app)
   - 실행 계정(Execute as): Me
   - 액세스 권한(Who has access): Anyone
4. 배포(Deploy) 클릭
5. 생성된 배포 URL 복사
   예: https://script.google.com/macros/s/AKfycby.../exec
```

#### 1.3 wow_chat.html 엔드포인트 설정
```javascript
// src/frontend/wow_chat.html 360행 수정
const WOW_AI_ENDPOINT = "https://script.google.com/macros/s/[복사한 배포 ID]/exec";
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 정상 플로우 (Happy Path)

**목표**: 5단계 인터뷰 완료 후 Task Package 생성 및 시트 등록

**테스트 스크립트**:
```
1. wow_chat.html 열기
2. 사용자 입력: "근태 시스템에 자동 알림 기능 추가해줘"

[기대 결과]
- WOW 매니저: "좋은 아이디어네요! 🌟 현재 근태 미입력 시 어떤 불편함을 겪고 계신가요?"
- 상단 단계 표시: "공감(Empathize)"

3. 사용자 입력: "매번 수기로 확인해야 해서 번거로워요"

[기대 결과]
- WOW 매니저: (현재 상황 파악 질문)
- 상단 단계: "정의(Define)"

4. 사용자 입력: "슬랙으로 알림 받고 싶어요"

[기대 결과]
- WOW 매니저: (기능 정리 및 확인 질문)
- 상단 단계: "프로토타입(Prototype)"

5. 사용자 입력: "맞아요 ✅"

[기대 결과]
- WOW 매니저: "완벽합니다! 태스크를 생성하겠습니다."
- 스피너 표시: "벙커팀 시트로 태스크 전송 중..."
- 최종 메시지: "✅ 완벽히 정리되었습니다! ..."
- 상단 단계: "완료(Completed)"

6. 구글 시트 확인

[기대 결과]
- Agent_Tasks 시트에 새 행 추가
- Task_ID: 20260228-Wxxxxxx 형식
- 태스크명: "근태 시스템 자동 알림 추가" (또는 Claude가 생성한 제목)
- 상태: PLANNING
- 할당팀: BUNKER_TEAM

7. 슬랙 확인

[기대 결과]
- 슬랙 메시지 수신:
  "✨ [WOW Gateway 신규 접수]
   새로운 태스크 `20260228-Wxxxxxx` 가 벙커팀(PLANNING)에 할당되었습니다.
   📋 제목: ...
   🎯 우선순위: ...
   📝 설명: ..."
```

---

### 시나리오 2: 7턴 초과 (Circuit Breaker)

**목표**: 무한 루프 방지 메커니즘 검증

**테스트 스크립트**:
```
1. wow_chat.html 열기
2. 7번의 의미 없는 메시지 입력 (예: "음...", "그게...", "아니...")

[기대 결과]
- 7번째 입력 후 WOW 매니저:
  "제가 이해하기엔 너무 복잡한 요구사항 같습니다. 😅
   이 건은 더 정확한 파악을 위해 벙커팀 송PO님과 직접 미팅을 권장해 드립니다."
- 상단 단계: "종료(Failover)"
- [일정 잡기] 버튼 표시
```

---

### 시나리오 3: 세션 만료 (Garbage Collection)

**목표**: 1시간 미활동 세션 자동 만료 검증

**테스트 스크립트**:
```
1. wow_chat.html 열기
2. 한 번 메시지 입력 후 1시간 대기 (또는 브라우저 개발자 도구에서 sessionStorage TTL 조작)
3. 1시간 후 다시 메시지 입력

[기대 결과]
- 새로운 세션으로 시작 (대화 히스토리 초기화)
- WOW 매니저가 처음부터 공감 단계 질문
```

---

### 시나리오 4: Claude API 에러 처리

**목표**: API 장애 시 Fallback UI 동작 검증

**테스트 방법**:
```
1. 임시로 CLAUDE_API_KEY를 잘못된 값으로 설정
2. wow_chat.html에서 메시지 입력

[기대 결과]
- 타이핑 인디케이터 표시 후 사라짐
- WOW 매니저 에러 메시지:
  "⚠️ Claude API 키가 설정되지 않았습니다. ..."
  또는
  "❌ 네트워크 연결에 문제가 발생했습니다. ..."
```

---

### 시나리오 5: 웹훅 실패 시 재시도

**목표**: Webhook 통신 실패 대응 검증

**테스트 방법**:
```
1. 네트워크 차단 (브라우저 개발자 도구 > Network > Offline)
2. 대화 완료 후 Task Package 전송 시도

[기대 결과]
- 에러 메시지: "⚠️ V4 웹훅 통신 지연"
- [🔄 재전송 시도] 버튼 표시
- 버튼 클릭 시 재전송
```

---

## 🔍 QA 체크리스트

### 기능 테스트
- [ ] Claude API 호출 성공
- [ ] 5단계 인터뷰 진행 확인
- [ ] Task Package JSON 파싱 성공
- [ ] 구글 시트 등록 확인
- [ ] 슬랙 알림 발송 확인
- [ ] 대시보드 🌟 WOW 배지 표시 (기존 기능 유지)

### 보안 테스트
- [ ] XSS 방지 (입력값 sanitization 동작)
- [ ] 최대 500자 입력 제한
- [ ] 7턴 제한 동작
- [ ] 세션 만료 (1시간) 동작

### 성능 테스트
- [ ] Claude API 평균 응답 시간 < 3초
- [ ] 타이핑 인디케이터 자연스러운 타이밍
- [ ] 동시 접속 5명 이상 처리 가능

### UI/UX 테스트
- [ ] 모바일 반응형 정상 동작
- [ ] 다크 모드 / 라이트 모드 전환
- [ ] 스크롤 자동 하단 이동
- [ ] 메시지 버블 애니메이션

### 호환성 테스트
- [ ] Chrome 최신 버전
- [ ] Safari 최신 버전
- [ ] Firefox 최신 버전
- [ ] 모바일 Safari (iOS)
- [ ] 모바일 Chrome (Android)

---

## 🐛 알려진 이슈 및 제한사항

### 이슈 1: CORS 정책
**증상**: 로컬 파일로 열 때 fetch() 실패
**해결**: GAS Web App으로 배포하거나 로컬 서버 사용 (예: `python -m http.server`)

### 이슈 2: no-cors 모드
**증상**: WEBHOOK_URL fetch 응답 확인 불가
**설명**: 기존 설계대로 동작 (agent_sync.gs가 응답 처리)

### 이슈 3: 긴 대화 시 토큰 비용
**증상**: 5단계 이상 긴 대화 시 토큰 사용량 증가
**대응**: 향후 대화 요약 로직 추가 고려

---

## 📊 성능 벤치마크 기록

| 지표 | 목표 | 실측 | 상태 |
|-----|------|------|------|
| Claude API 응답 시간 | < 3초 | ??? | ⏳ 측정 필요 |
| Task 생성 성공률 | > 90% | ??? | ⏳ 측정 필요 |
| 시스템 가용성 | > 99.5% | ??? | ⏳ 측정 필요 |
| 평균 인터뷰 완료 시간 | < 3분 | ??? | ⏳ 측정 필요 |

**측정 방법**:
```javascript
// wow_chat.html에 추가
const startTime = performance.now();
// ... Claude API 호출
const endTime = performance.now();
console.log(`응답 시간: ${(endTime - startTime) / 1000}초`);
```

---

## 🔧 트러블슈팅

### 문제: "WOW_AI_ENDPOINT is not defined"
**원인**: wow_chat.html 360행 엔드포인트 미설정
**해결**: 배포된 GAS URL로 교체

### 문제: "CLAUDE_API_KEY not found"
**원인**: Script Properties 미설정
**해결**: GAS 프로젝트 설정에서 API 키 추가

### 문제: "Agent_Tasks sheet not found"
**원인**: 시트 이름 불일치
**해결**: agent_sync.gs의 AGENT_SHEET_ID 확인

### 문제: 대화가 무한 반복
**원인**: Claude의 Task Package JSON 생성 실패
**해결**: System Prompt 재검토 또는 Few-Shot Examples 추가

---

## 📝 QA 승인 프로세스

### 1단계: 자비스 내부 테스트
- [ ] 자비스 팀원 전원 시나리오 1~5 실행
- [ ] 발견된 버그 즉시 수정

### 2단계: 김감사 QA팀 검수
- [ ] QA 체크리스트 전항목 점검
- [ ] 테스트 결과 리포트 작성
- [ ] Pass/Fail 판정

### 3단계: 벙커팀 UAT (User Acceptance Test)
- [ ] 송PO가 실제 요구사항 입력 테스트
- [ ] 생성된 Task Package 품질 평가

### 4단계: 전사 베타 공개
- [ ] 한정된 팀원 대상 파일럿 (예: 5명)
- [ ] 피드백 수렴 (1주일)

### 5단계: 정식 출시
- [ ] 전 직원 대상 공지
- [ ] 사용 가이드 배포 (꼼꼼이 팀)

---

## 🎯 성공 지표 확인

배포 후 1주일 내 다음 지표 달성 여부 확인:

- ✅ **WOW 태스크 생성 10건 이상**
- ✅ **벙커팀의 요구사항 재확인 작업 50% 감소**
- ✅ **사용자 만족도 NPS 8점 이상** (설문조사)
- ✅ **시스템 장애 0건** (Critical 에러 없음)

---

## 📞 긴급 연락망

| 문제 유형 | 담당자 | 연락 방법 |
|----------|-------|----------|
| 백엔드 에러 | Ada | Slack @ada-backend |
| Frontend 버그 | Chloe | Slack @chloe-frontend |
| 인프라 장애 | Alex | Slack @alex-jarvis |
| QA 관련 | 김감사 | Slack @kim-qa-team |
| API 키 이슈 | 시스템 관리자 | admin@company.com |

---

**"자비스 팀장 Alex - Phase 2 개발 완료. 이제 배포 및 QA를 진행하여 WOW Gateway를 정식 가동하겠습니다!"** 🚀
