# 🧠 [Task] WOW-GATEWay Phase 2: Claude AI 통합 및 지능형 대화 엔진 구축

---
**문서 정보**
- **작성자**: 자비스 팀장 Alex
- **작성일**: 2026-02-28
- **상태**: Planning
- **우선순위**: P0 (최우선)
- **담당 팀**: 자비스 개발팀 (Alex, Ada, Chloe)
- **선행 작업**: Phase 1 (WOW 챗봇 UI) 완료
- **연관 문서**:
  - [V4_SYSTEM_REPORT_2026.md](../reports/V4_SYSTEM_REPORT_2026.md)
  - [task_wow_gateway.md](task_wow_gateway.md)
---

## 1. 프로젝트 배경 (Background)

### 현재 상태 (As-Is)
Phase 1에서 구축한 WOW 챗봇([wow_chat.html](../../src/frontend/wow_chat.html))은 **하드코딩된 룰베이스 시나리오**로 동작합니다.

**문제점**:
```javascript
// wow_chat.html:386-427
function simulateWOWResponse(userMsg) {
    // 하드코딩된 키워드 매칭 방식
    if (userMsg.includes('휴가')) {
        responseText = "와! 🏖️ 정말 편리하겠네요!...";
    } else if (userMsg.includes('구글') || userMsg.includes('자체')) {
        responseText = "구글 캘린더 연동이군요!...";
    }
    // ... 제한적인 시나리오만 대응 가능
}
```

**한계점**:
- ❌ 사전에 정의된 키워드 외 대응 불가
- ❌ 복잡한 요구사항 파악 불가능
- ❌ 자연스러운 대화 맥락 이해 부족
- ❌ Task Package 자동 추출 불가

### 목표 상태 (To-Be)
Claude API를 직접 연동하여 **진짜 AI 두뇌**를 이식합니다.

**기대 효과**:
- ✅ 비정형 자연어 완벽 이해
- ✅ 5단계 인터뷰 프레임워크 자율 진행 (Empathize → Define → Ideate → Prototype → Confirm)
- ✅ 대화 종료 시 구조화된 Task Package JSON 자동 생성
- ✅ 벙커팀/자비스팀이 바로 실행 가능한 데이터 파싱

---

## 2. 아키텍처 설계 (Architecture)

### 2.1 시스템 플로우
```
[사용자 입력]
    ↓
[wow_chat.html - Frontend]
    ↓ (AJAX/Fetch)
[ai_chat_wow.gs - GAS Backend] ← 신규 생성
    ↓ (Claude API)
[Claude Sonnet 4]
    ↓ (JSON Response)
[Task Package 추출]
    ↓ (Webhook)
[agent_sync.gs - handleWowTask()]
    ↓
[시트 등록 & 슬랙 알림]
```

### 2.2 핵심 컴포넌트

| 컴포넌트 | 역할 | 기술 스택 |
|---------|------|----------|
| **wow_chat.html** | 사용자 인터페이스 | HTML/CSS/JS (기존 유지) |
| **ai_chat_wow.gs** | Claude API 호출 백엔드 | Google Apps Script (신규) |
| **Claude API** | 자연어 처리 엔진 | Claude Sonnet 4 (Anthropic) |
| **agent_sync.gs** | Task 등록 핸들러 | GAS (기존 코드 재활용) |

---

## 3. 세부 구현 사양 (Specifications)

### 🎯 Task 3.1: Claude API 통합 백엔드 개발
**담당자**: 👩‍💻 Ada (Backend Dev)
**예상 공수**: 3시간
**파일**: `src/gas/ai_chat_wow.gs` (신규)

#### 구현 사항
1. **Claude API 호출 함수 작성**
   ```javascript
   function callClaudeForWow(sessionContext, userMessage) {
       const CLAUDE_API_KEY = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
       const url = "https://api.anthropic.com/v1/messages";

       const systemPrompt = `당신은 비전문가의 아이디어를 실행 가능한 태스크로 전환하는 'WOW 매니저'입니다.

       [인터뷰 프레임워크]
       1. Empathize(공감): 사용자의 불편함/니즈 파악
       2. Define(정의): 현재 상황(As-Is) 확인
       3. Ideate(아이디어): 해결 방안 구체화
       4. Prototype(프로토타입): 기능 요구사항 정리
       5. Confirm(확인): 최종 확인 및 Task Package 생성

       현재 단계에 맞는 질문을 하고, 5단계 완료 시 다음 JSON 형식으로 응답:
       {
           "task_completed": true,
           "task_package": {
               "title": "기능 제목",
               "description": "상세 설명",
               "category": "FEATURE|BUG|IMPROVEMENT",
               "priority": "HIGH|MEDIUM|LOW",
               "requirements": ["요구사항1", "요구사항2"],
               "stakeholder": "요청자 니즈 요약"
           }
       }`;

       const payload = {
           model: "claude-sonnet-4-20250514",
           max_tokens: 1500,
           system: systemPrompt,
           messages: sessionContext.messages
       };

       const options = {
           method: "post",
           headers: {
               "x-api-key": CLAUDE_API_KEY,
               "anthropic-version": "2023-06-01",
               "content-type": "application/json"
           },
           payload: JSON.stringify(payload),
           muteHttpExceptions: true
       };

       const response = UrlFetchApp.fetch(url, options);
       const result = JSON.parse(response.getContentText());

       return result.content[0].text;
   }
   ```

2. **세션 컨텍스트 관리**
   - CacheService 활용 (기존 [ai_chat.gs](../../src/gas/ai_chat.gs:74-123) 패턴 재활용)
   - 대화 히스토리 누적 저장 (Claude messages 배열 형식)
   - 1시간 만료 GC 적용 (기존 세션 관리 로직 연동)

3. **Task Package 파싱 로직**
   ```javascript
   function parseTaskPackage(claudeResponse) {
       try {
           const jsonMatch = claudeResponse.match(/\{[\s\S]*"task_completed"[\s\S]*\}/);
           if (jsonMatch) {
               const taskData = JSON.parse(jsonMatch[0]);
               if (taskData.task_completed) {
                   return taskData.task_package;
               }
           }
       } catch (e) {
           Logger.log("Task Package 파싱 실패: " + e.message);
       }
       return null;
   }
   ```

#### 품질 기준 (DoD)
- [ ] Claude API 호출 성공률 95% 이상
- [ ] 평균 응답 시간 3초 이내
- [ ] Task Package JSON 유효성 검증 100%
- [ ] 에러 핸들링 완료 (API 키 누락, 타임아웃, 파싱 오류 등)

---

### 🎨 Task 3.2: Frontend 대화 엔진 교체
**담당자**: 👧 Chloe (Frontend Dev)
**예상 공수**: 2시간
**파일**: `src/frontend/wow_chat.html` (수정)

#### 구현 사항
1. **기존 룰베이스 로직 제거**
   - [wow_chat.html:386-427](../../src/frontend/wow_chat.html#L386-L427) `simulateWOWResponse()` 함수 전체 교체

2. **백엔드 API 연동**
   ```javascript
   async function processWOWChat(userMsg) {
       let session = initSession(); // 기존 세션 관리 재활용

       // 백엔드로 메시지 전송
       const response = await fetch(GAS_WOW_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
               session_id: session.id,
               user_message: userMsg,
               turn_count: session.turns
           })
       });

       const data = await response.json();

       // Claude 응답 표시
       typingIndicator.style.display = 'none';
       addMessageToChat('WOW', data.claude_response);

       // Task Package 완료 시 웹훅 전송
       if (data.task_package) {
           await runWebhook(JSON.stringify(data.task_package));
       }
   }
   ```

3. **프로그레스 인디케이터 고도화**
   - 현재 인터뷰 단계 실시간 반영 (Empathize → Define → ...)
   - 진행률 표시 (예: "3/5 단계 진행 중")

#### 품질 기준 (DoD)
- [ ] 기존 UI/UX 동작 100% 호환
- [ ] 네트워크 에러 시 Fallback 메시지 표출
- [ ] 타이핑 인디케이터 자연스러운 타이밍 유지
- [ ] 모바일 반응형 정상 동작

---

### 🔗 Task 3.3: 웹훅 페이로드 확장
**담당자**: 👨‍💻 Alex (Tech Lead)
**예상 공수**: 1시간
**파일**: `src/gas/agent_sync.gs` (수정)

#### 구현 사항
1. **handleWowTask() 함수 업그레이드**
   - 기존: `payload.content` (단순 문자열)
   - 개선: `payload.task_package` (구조화된 JSON)

2. **시트 데이터 매핑 강화**
   ```javascript
   function handleWowTask(payload) {
       const taskPkg = payload.task_package;

       // 시트 매핑 확장
       newRow[0] = generateTaskId(); // Task_ID
       newRow[1] = taskPkg.title; // 태스크명
       newRow[2] = "PLANNING"; // 상태
       newRow[3] = taskPkg.category; // 유형
       newRow[4] = taskPkg.priority; // 우선순위
       newRow[5] = taskPkg.description; // 상세설명
       newRow[6] = "BUNKER_TEAM"; // 할당팀

       // 요구사항을 별도 열에 JSON 저장
       const reqsColIndex = headers.indexOf("요구사항(V4)");
       if (reqsColIndex > -1) {
           newRow[reqsColIndex] = JSON.stringify(taskPkg.requirements);
       }
   }
   ```

3. **슬랙 알림 포맷 개선**
   ```javascript
   sendSlackMessage(`✨ *[WOW Gateway 신규 접수]*
   📋 제목: ${taskPkg.title}
   🎯 우선순위: ${taskPkg.priority}
   📝 설명: ${taskPkg.description}

   👉 대시보드에서 확인: https://...`, "INFO");
   ```

#### 품질 기준 (DoD)
- [ ] 기존 WOW 태스크 생성 로직 100% 호환
- [ ] 새로운 필드 추가 시 시트 헤더 자동 생성
- [ ] 슬랙 알림 가독성 향상

---

### 🧪 Task 3.4: 통합 테스트 및 QA
**담당자**: 김감사 QA팀 (검증), 자비스팀 전원 (수정)
**예상 공수**: 2시간

#### 테스트 시나리오
1. **정상 플로우 테스트**
   ```
   입력: "우리 팀 근태 시스템에 출퇴근 자동 알림 추가해줘"

   기대 결과:
   - 5단계 인터뷰 완료
   - Task Package JSON 생성
   - 시트에 PLANNING 상태로 등록
   - 슬랙 알림 발송
   - 대시보드에 🌟 WOW 배지 표시
   ```

2. **엣지 케이스 테스트**
   - 7턴 초과 시 에스컬레이션 메시지
   - 세션 만료(1시간) 후 재시작
   - Claude API 타임아웃 처리
   - 네트워크 단절 시 재시도 버튼

3. **부하 테스트**
   - 동시 접속 5명 이상 처리 가능 확인
   - CacheService 동시성 이슈 점검

#### 품질 기준 (DoD)
- [ ] 모든 테스트 시나리오 100% 통과
- [ ] QA팀 최종 승인 획득
- [ ] 성능 벤치마크 기록 (평균 응답 시간, 성공률)

---

## 4. 프롬프트 엔지니어링 전략

### 4.1 System Prompt 설계 원칙
1. **역할 명확화**: "당신은 WOW 매니저입니다" (페르소나 고정)
2. **단계별 가이드**: 5단계 프레임워크 구조화
3. **출력 포맷 강제**: JSON Schema 명시
4. **한국어 최적화**: 자연스러운 존댓말 톤앤매너

### 4.2 Few-Shot Examples
```javascript
const exampleConversations = [
    {
        user: "회의실 예약 시스템 만들고 싶어요",
        assistant: "좋은 아이디어네요! 현재는 어떤 방식으로 회의실을 예약하고 계신가요?",
        stage: "Empathize"
    },
    {
        user: "엑셀 파일로 수기 관리해요",
        assistant: "불편하셨겠어요. 구글 캘린더 같은 툴 연동을 원하시나요, 아니면 자체 시스템을 선호하시나요?",
        stage: "Define"
    }
    // ... 추가 예시
];
```

### 4.3 Temperature 설정
- `temperature: 0.7` (창의성과 일관성 균형)
- `max_tokens: 1500` (충분한 응답 길이 확보)

---

## 5. 데이터 플로우 다이어그램

```
┌─────────────────┐
│  사용자 (비전공자) │
└────────┬────────┘
         │ "근태 알림 기능 추가해줘"
         ▼
┌─────────────────────────┐
│  wow_chat.html          │
│  - 세션 관리             │
│  - UI 렌더링             │
└────────┬────────────────┘
         │ POST /wowChat
         ▼
┌─────────────────────────┐
│  ai_chat_wow.gs (GAS)   │
│  - Claude API 호출       │
│  - 대화 컨텍스트 관리     │
└────────┬────────────────┘
         │
         ├─────────────┐
         ▼             ▼
    [Claude API]   [CacheService]
         │         (세션 저장)
         │
         │ JSON Response
         ▼
┌─────────────────────────┐
│  Task Package Parser    │
│  - JSON 유효성 검증      │
│  - 필드 매핑             │
└────────┬────────────────┘
         │
         │ Webhook POST
         ▼
┌─────────────────────────┐
│  agent_sync.gs          │
│  - handleWowTask()      │
│  - 시트 등록             │
│  - 슬랙 알림             │
└─────────────────────────┘
         │
         ├──────────┬──────────┐
         ▼          ▼          ▼
    [Google      [Slack]  [Dashboard]
     Sheets]                🌟 WOW Badge
```

---

## 6. 일정 및 마일스톤

| 날짜 | 마일스톤 | 담당자 | 상태 |
|-----|---------|-------|------|
| D+1 | Task 3.1 완료 (백엔드 개발) | Ada | ⏳ Pending |
| D+1 | Task 3.2 완료 (프론트엔드) | Chloe | ⏳ Pending |
| D+2 | Task 3.3 완료 (웹훅 확장) | Alex | ⏳ Pending |
| D+2 | Task 3.4 완료 (QA) | 김감사팀 | ⏳ Pending |
| D+3 | 전사 공개 (베타 테스트) | 전체 | ⏳ Pending |
| D+7 | 피드백 수렴 및 개선 | 자비스팀 | ⏳ Pending |

**예상 총 공수**: 8시간 (1인 기준)
**병렬 작업 시**: 1.5일 완료 가능

---

## 7. 리스크 관리 (Risk Management)

### 7.1 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|-------|-------|----------|
| Claude API 응답 지연 (>5초) | 🔴 High | - 타임아웃 3초 설정<br>- Fallback 메시지 표출 |
| API 호출 비용 폭증 | 🟡 Medium | - 일일 사용량 모니터링<br>- 팀별 쿼터 설정 |
| JSON 파싱 실패 | 🟡 Medium | - 정규식 + try-catch<br>- 재시도 로직 3회 |
| 세션 동시성 충돌 | 🟢 Low | - LockService 적용 (기존 agent_sync.gs 패턴) |

### 7.2 비즈니스 리스크

| 리스크 | 영향도 | 대응 방안 |
|-------|-------|----------|
| 사용자가 AI 응답 불신 | 🟡 Medium | - "AI가 생성한 내용입니다" 명시<br>- 최종 확인 단계 필수화 |
| 잘못된 Task Package 생성 | 🔴 High | - 벙커팀 검수 단계 유지<br>- QA 반려 시 재생성 로직 |
| 개인정보 유출 우려 | 🟡 Medium | - 입력값 필터링 강화<br>- Claude API 데이터 보관 정책 확인 |

---

## 8. 성공 지표 (Success Metrics)

### 8.1 정량 지표 (Quantitative)
- ✅ **태스크 생성 성공률**: 90% 이상
- ✅ **평균 인터뷰 완료 시간**: 3분 이내
- ✅ **사용자 만족도**: NPS 8점 이상 (10점 만점)
- ✅ **시스템 가용성**: 99.5% 이상 (월간)

### 8.2 정성 지표 (Qualitative)
- ✅ 비전공자 팀원이 기술 용어 없이 요청 가능
- ✅ 벙커팀의 요구사항 재확인 작업 50% 감소
- ✅ WOW 태스크의 QA 1차 통과율 향상

---

## 9. 후속 작업 (Follow-up Tasks)

Phase 2 완료 후 다음 단계로 진행:

### Phase 3: 에이전트 자동 핸드오프
- 벙커팀 PLANNING 완료 시 자비스팀 자동 코딩 시작
- 김감사 QA 자동 검증 로직

### Phase 4: 대시보드 고도화
- WOW 태스크 전용 분석 대시보드
- 토큰 사용량 차트
- 대화 히스토리 드릴다운

---

## 10. 참고 자료 (References)

### 내부 문서
- [V4 시스템 통합 보고서](../reports/V4_SYSTEM_REPORT_2026.md)
- [WOW Gateway Task 문서](task_wow_gateway.md)
- [기존 AI Chat 구현](../../src/gas/ai_chat.gs)

### 외부 자료
- [Claude API Documentation](https://docs.anthropic.com/claude/reference/messages_post)
- [Google Apps Script Best Practices](https://developers.google.com/apps-script/guides/services/quotas)
- [Design Thinking 5단계 프레임워크](https://www.interaction-design.org/literature/article/5-stages-in-the-design-thinking-process)

---

## 11. 연락처 (Contacts)

| 역할 | 담당자 | 연락 방법 |
|-----|-------|----------|
| **Tech Lead** | 👨‍💻 Alex | Slack: @alex-jarvis |
| **Backend Dev** | 👩‍💻 Ada | Slack: @ada-backend |
| **Frontend Dev** | 👧 Chloe | Slack: @chloe-frontend |
| **QA Lead** | 김감사 | Slack: @kim-qa-team |
| **Product Owner** | 송PO (벙커팀) | Slack: @song-bunker |

---

**"자비스 팀장 Alex 작성 완료. 이 문서를 기반으로 Phase 2 개발을 즉시 착수하겠습니다."** 🚀✨
