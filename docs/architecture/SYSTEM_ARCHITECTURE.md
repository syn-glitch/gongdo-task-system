# 시스템 아키텍처 (System Architecture)

**작성자**: 김감사 (QA Specialist)
**작성일**: 2026-02-26
**최종 수정**: 2026-02-26
**관련 문서**: [JUDY_AI_AGENT.md](JUDY_AI_AGENT.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [API_REFERENCE.md](API_REFERENCE.md)

---

## 📋 개요 (Overview)

공도 업무 관리 시스템은 **Google Apps Script (GAS)** 기반의 서버리스 아키텍처로 구축된 통합 업무 관리 플랫폼입니다.

**핵심 철학**:
- **Zero Cost**: 구글 인프라 내 완전 무료 운영
- **Easy Access**: 슬랙 + 구글 시트로 비전공자도 쉽게 사용
- **AI-Powered**: Claude API 연동으로 지능형 비서 역할

---

## 🏗️ 전체 시스템 구성도 (System Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 인터페이스                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐        ┌──────────────┐       ┌────────────┐ │
│  │  Slack Bot  │◄──────►│ Web Browser  │◄─────►│ Mobile Web │ │
│  │ /주디, 모달   │  Magic │ judy_workspace│ Responsive│           │ │
│  └──────┬──────┘  Link  └──────┬───────┘       └─────┬──────┘ │
│         │                      │                     │        │
└─────────┼──────────────────────┼─────────────────────┼────────┘
          │                      │                     │
          └──────────────────────┴─────────────────────┘
                                 │
                ┌────────────────▼─────────────────┐
                │  Google Apps Script (GAS)       │
                │  서버리스 백엔드 (6분 타임아웃)      │
                └────────────────┬─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐          ┌───────▼────────┐      ┌──────▼────┐
    │ Sheets  │          │ Google Drive   │      │  Calendar │
    │ (DB)    │          │ (Markdown)     │      │  (동기화)  │
    │ Tasks   │          │ Archive/Memo   │      │           │
    │ Projects│          │                │      │           │
    │ Users   │          │                │      │           │
    └─────────┘          └────────────────┘      └───────────┘
         │                       │
         └───────────────────────┘
                     │
              ┌──────▼──────┐
              │ Claude API  │
              │ (AI Engine) │
              └─────────────┘
```

---

## 🔧 핵심 컴포넌트 (Core Components)

### 1. **프론트엔드 (Frontend)**

#### 1.1 슬랙 인터페이스 (Slack Interface)
```
역할: 가벼운 접수 창구 & 푸시 알림
파일: slack_command.gs, slack_notification.gs

주요 기능:
- /주디: 업무 등록 모달
- /주디 노트: Magic Link 발급
- /주디 내업무: Magic Link 발급
- 메시지 메뉴: 텍스트 → 업무 변환
```

**제약 사항**:
- ⚠️ 3초 타임아웃 룰: 슬랙 API는 3초 내 응답 필수
- ⚠️ AI 연산 제한: 무거운 AI 작업은 웹으로 유도

#### 1.2 웹 인터페이스 (Web Interface)
```
역할: AI 연산 & 심층 관리 공간
파일: judy_workspace.html (2,390줄)

주요 기능:
- 📝 주디 노트: 마크다운 에디터, AI 요약, 검색
- 📊 주디 대시보드: 업무 현황, 상태 변경, 등록/수정
- 📅 칸반 & 캘린더 (Phase 23, 예정)
```

**특징**:
- ✅ 6분 타임아웃: AI 연산 여유 시간
- ✅ SPA 구조: 단일 페이지로 모든 기능 통합
- ✅ 다크/라이트 테마
- ✅ 반응형 디자인 (모바일 최적화)

---

### 2. **백엔드 (Backend - GAS)**

#### 2.1 인증 시스템 (Authentication)
```javascript
// web_app.gs
function validateToken(token) {
  const cache = CacheService.getScriptCache();
  const userName = cache.get("MAGIC_" + token);

  if (userName) {
    cache.remove("MAGIC_" + token); // 일회용 토큰 즉시 파기
    return { valid: true, name: userName };
  }
  return { valid: false };
}
```

**Magic Link 흐름**:
1. 슬랙 `/주디 노트` 입력
2. GAS가 UUID 토큰 생성 → CacheService 10분 저장
3. 사용자에게 URL 전송 (`?token=xxx`)
4. 웹 접속 시 `validateToken()` 호출
5. 토큰 검증 후 즉시 파기 (1회용)

#### 2.2 데이터 처리 (Data Processing)
```
주요 파일:
- web_app.gs: 웹 API 엔드포인트
- drive_archive.gs: 마크다운 아카이브 관리
- slack_command.gs: 슬랙 명령어 핸들러
- auto_automation.gs: 트리거 및 자동화
- calendar_sync.gs: 캘린더 동기화
```

**API 엔드포인트** (web_app.gs):
| 함수명 | 역할 | LockService | Cache |
|---|---|:---:|:---:|
| `saveFromWeb()` | 메모 저장 | ❌ | ❌ |
| `parseTaskFromMemoWeb()` | AI 업무 추출 | ❌ | ❌ |
| `summarizeMemoContent()` | AI 요약 | ❌ | ❌ |
| `getAllTasksForWeb()` | 모든 업무 조회 | ❌ | ✅ 5분 |
| `getMyTasksForWeb()` | 내 업무 조회 | ❌ | ✅ 5분 |
| `changeTaskStatusFromWeb()` | 상태 변경 | ✅ 10초 | 파기 |
| `changeTaskDueDateFromWeb()` | 마감일 변경 | ✅ 10초 | 파기 |
| `updateTaskFromWeb()` | 업무 수정 | ✅ 10초 | 파기 |
| `registerTaskFromWeb()` | 업무 등록 | ✅ 10초 | 파기 |

#### 2.3 AI 엔진 연동 (AI Integration)
```
주요 파일:
- ai_chat.gs: AI 대화 (미사용)
- ai_report.gs: 일간/주간 리포트
- ai_task_parser.gs: 업무 자동 파싱
```

**Claude API 호출 패턴**:
```javascript
const payload = {
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 600,
  "temperature": 0,
  "system": systemPrompt,
  "messages": [{"role": "user", "content": text}]
};

const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
  "method": "post",
  "headers": {
    "x-api-key": CLAUDE_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  "payload": JSON.stringify(payload)
});
```

---

### 3. **데이터 계층 (Data Layer)**

#### 3.1 Google Sheets (Database)
```
역할: 관계형 데이터베이스 대체
파일: Tasks, Projects, Users, ActionLog, MemoEditLog

특징:
- ✅ 실시간 협업 가능
- ✅ 기획자도 직접 데이터 확인 가능
- ⚠️ 1,000건 이상 시 성능 저하
- ⚠️ 동시성 제어 필요 (LockService)
```

자세한 스키마는 [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) 참조

#### 3.2 Google Drive (File Storage)
```
역할: 마크다운 아카이브 영구 저장
구조:
  주디노트_아카이브/
  ├── syn/
  │   ├── 2026-02/
  │   │   ├── syn_2026-02-26.md
  │   │   └── syn_2026-02-25.md
  │   └── 2026-01/
  └── hyerim/
      └── 2026-02/
```

**파일 구조** (예시):
```markdown
# syn의 업무일지 (2026-02-26)

## 2026-02-26

- **[09:30]**
  회의: 칸반 & 캘린더 기능 기획
  - 자비스 팀장과 UX 논의
  - 김감사 QA 검토 완료

- **[14:20]**
  개발: 주디 노트 편집 기능 E2E 테스트
  - LockService 정상 작동 확인
  - 2-Phase Commit 백업 검증
```

#### 3.3 Google Calendar (Sync Target)
```
역할: 마감일 기반 일정 동기화
트리거: onEdit (상태/마감일 변경 시)

로직:
1. Tasks 시트 변경 감지
2. calendar_sync.gs:syncCalendarEvent() 호출
3. 상태가 "완료" or "보류" → 일정 삭제
4. 마감일 존재 + 활성 상태 → 일정 생성/업데이트
```

---

## 🔐 보안 아키텍처 (Security Architecture)

### 1. 인증 (Authentication)
```
Magic Link (1회용 토큰):
- 생성: UUID v4 (32자 랜덤)
- 저장: CacheService (10분 TTL)
- 검증: validateToken() → 즉시 파기
- 재사용 방지: 캐시에서 삭제 후 재요청 필요
```

### 2. 권한 관리 (Authorization)
```
Feature Flag (관리자 전용 기능):
- 타임 트래킹: 송용남, 정혜림
- 메모 편집: 송용남, 정혜림

구현:
window.isAdmin = ["송용남", "정혜림"].includes(userName);
```

### 3. 동시성 제어 (Concurrency Control)
```javascript
// LockService 패턴
const lock = LockService.getUserLock();
try {
  lock.waitLock(10000); // 10초 대기
  // ... 크리티컬 섹션
} catch (err) {
  return { success: false, message: "ERR_LOCK_TIMEOUT" };
} finally {
  lock.releaseLock();
}
```

### 4. 데이터 무결성 (Data Integrity)
```
2-Phase Commit (주디 노트 편집):
1. 백업 파일 생성 (Drive)
2. 원본 파일 수정
3. 무결성 검증 (파일 크기, 날짜 헤더 개수)
4. 성공 시 백업 삭제, 실패 시 백업 유지
```

---

## 📊 데이터 흐름 (Data Flow)

### 시나리오 1: 슬랙에서 업무 등록
```
[사용자] /주디
    ↓
[Slack] Modal 팝업 (slack_command.gs:handleJudyCommand)
    ↓
[사용자] 제목/마감일/상세 입력 → 제출
    ↓
[GAS] registerTask() 호출
    ↓
[Sheets] Tasks 시트에 행 추가
    ↓
[GAS] syncCalendarEvent() 트리거
    ↓
[Calendar] 마감일 기반 일정 생성
    ↓
[GAS] sendTaskNotification() 호출
    ↓
[Slack] 프로젝트 채널에 알림 전송
```

### 시나리오 2: 웹에서 AI 업무 추출
```
[사용자] judy_workspace.html 접속 (Magic Link)
    ↓
[Web] validateToken() 호출 → 인증 성공
    ↓
[사용자] 노트 탭에서 회의록 작성 → 텍스트 드래그
    ↓
[Web] 🐰 플로팅 버튼 표시 → 클릭
    ↓
[GAS] parseTaskFromMemoWeb() 호출
    ↓
[Claude API] 텍스트 분석 → JSON 반환
   {
     "title": "UI 개선 작업",
     "desc": "칸반 보드 드래그 앤 드롭 구현",
     "due": "2026-03-01"
   }
    ↓
[Web] 업무 등록 모달에 Pre-fill
    ↓
[사용자] 확인 후 등록
    ↓
[GAS] registerTaskFromWeb() 호출
    ↓
[Sheets] Tasks 시트에 추가
```

### 시나리오 3: 칸반 보드 드래그 (Phase 23, 예정)
```
[사용자] 칸반 보드에서 카드 드래그 (대기 → 진행중)
    ↓
[Web] Optimistic UI: 즉시 카드 이동 (시각적 반영)
    ↓
[GAS] changeTaskStatusFromWeb(rowNum, "진행중") 호출
    ↓
[LockService] 10초 대기 → Lock 획득
    ↓
[Sheets] 상태 변경 + 시작 시간 기록 (타임 트래킹)
    ↓
[Cache] ALL_TASKS_CACHE 파기
    ↓
[ActionLog] 로그 기록 (User, Action, TaskID, Old/New)
    ↓
[GAS] syncCalendarEvent() 트리거
    ↓
[Calendar] 일정 업데이트
    ↓
[Web] 성공 토스트 표시 "✅ 진행중으로 변경"

# 실패 시:
[LockService] 10초 내 Lock 획득 실패
    ↓
[GAS] return { success: false, message: "ERR_LOCK_TIMEOUT" }
    ↓
[Web] 카드 원위치 (Rollback) + 모달 표시
      "⚠️ 다른 사용자가 이 업무를 수정 중입니다.
       3초 후 재시도하시겠습니까?"
```

---

## ⚡ 성능 최적화 (Performance Optimization)

### 1. 캐싱 전략 (Caching Strategy)
```javascript
// 5분 캐싱 (업무 목록)
function getAllTasksForWeb() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("ALL_TASKS_CACHE");
  if (cached) return JSON.parse(cached);

  // ... 데이터 조회

  cache.put("ALL_TASKS_CACHE", JSON.stringify(data), 300); // 5분
  return data;
}

// 캐시 무효화 (데이터 변경 시)
CacheService.getScriptCache().remove("ALL_TASKS_CACHE");
```

### 2. 로드 밸런싱 (Load Balancing)
```
슬랙: 가벼운 작업 (모달, 알림)
웹: 무거운 작업 (AI 연산, 대시보드)
```

### 3. 증분 업데이트 (Incremental Update)
```
현재: getDataRange().getValues() → 전체 시트 읽기
개선 (예정): 마지막 수정일(N열) 기준으로 변경된 행만 조회
```

---

## 🚧 제약 사항 및 한계 (Constraints & Limitations)

### 1. GAS 환경 제약
- ⏱️ **6분 타임아웃**: 단일 함수 실행 시간 제한
- 🔄 **동기 처리만 가능**: Async/Await 미지원
- 📊 **Sheets 성능**: 1,000건 이상 시 3~5초 응답

### 2. 슬랙 API 제약
- ⏱️ **3초 타임아웃**: 응답 지연 시 `operation_timeout` 에러
- 🚫 **AI 연산 불가**: 무거운 작업은 웹으로 위임

### 3. 확장성 한계
- 👥 **동시 사용자**: 10명 이하 권장
- 📈 **데이터 규모**: Tasks 3,000건 이하 권장
- 🔄 **동시성**: LockService로 부분적 해결

---

## 🔮 향후 개선 방향 (Future Improvements)

### Phase 1: 임시 방편 (현재~3개월)
```
Cloudflare Workers를 미들웨어로 활용:
- 슬랙 3초 룰 응답 대행
- 실제 연산은 GAS 트리거로 전달
```

### Phase 2: 완전 독립 (6개월~1년, 업무량 500건/일 초과 시)
```
Node.js (Express/NestJS) + PostgreSQL:
- 비동기 처리 지원
- 대규모 데이터 처리
- 웹소켓 실시간 동기화
```

---

## 📚 참고 문서 (Related Documents)

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md): 데이터베이스 스키마 상세
- [API_REFERENCE.md](API_REFERENCE.md): GAS 함수 API 레퍼런스
- [JUDY_AI_AGENT.md](JUDY_AI_AGENT.md): AI 에이전트 상세 설명
- [DEVELOPER_GUIDE.md](../guides/DEVELOPER_GUIDE.md): 개발자 가이드

---

**작성자**: 김감사 (QA Specialist)
**최종 수정**: 2026-02-26
