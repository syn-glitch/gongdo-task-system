# [김감사 운영가이드] AI 에이전트 팀 필수 규칙

**문서 버전**: v2.0
**최초 작성일**: 2026-02-26
**최종 수정일**: 2026-02-26
**작성자**: 김감사 (QA Specialist)
**검토자**: 자비스 (PO)
**승인자**: 송용남 (팀장)
**상태**: ✅ 승인 완료

---

## 📋 목차

0. [v2.0 주요 변경사항](#0-v20-주요-변경사항) ⭐ NEW
1. [작업 분류 체계](#1-작업-분류-체계) ⭐ NEW
2. [문서/코드 생성 필수 규칙](#2-문서코드-생성-필수-규칙)
3. [커뮤니케이션 규칙](#3-커뮤니케이션-규칙)
4. [개발 프로세스 규칙](#4-개발-프로세스-규칙)
5. [회고 규칙 (정기 회고 체계)](#5-회고-규칙-정기-회고-체계) ⭐ 대폭 개선
6. [디버깅 기록 규칙](#6-디버깅-기록-규칙)
7. [Git 커밋 및 배포 규칙](#7-git-커밋-및-배포-규칙)
8. [추가 운영 규칙](#8-추가-운영-규칙)

---

## 0. v2.0 주요 변경사항

**철학**: "엄격한 문서화" → **"유연한 엄격함 (Flexible Rigor)"**

### 🎯 핵심 개선 (Top 5)

1. **작업 분류 체계 도입** (Micro/Small/Medium+)
   - 작업 크기에 따라 차등 프로세스 적용
   - Fast-Track 프로세스 허용 (Micro 작업)

2. **회고 규칙 대폭 개선**
   - 개별 작업 회고 → 정기 회고 체계 (일간/주간/월간)
   - 문서 작업 시간 **70% 절감**

3. **에러 메시지 이원화**
   - 사용자 노출: 한글
   - 시스템 내부: 영문 식별자 + 한글 설명

4. **진행률 공유 최적화**
   - PROGRESS.md: 실시간 → 필요 시 (일일 2회)
   - 에디터 출력: 전체 코드 → Diff + 링크

5. **토큰 효율 극대화**
   - 토큰 사용량 **80% 절감**
   - 실제 구현 시간 **50% 증가**

### 📝 자비스 (PO) 피드백 반영
- ✅ Fast-Track 프로세스 도입
- ✅ 에러 메시지 이원화
- ✅ PROGRESS.md 업데이트 빈도 조절
- ✅ 에디터창 출력 최적화

---

## 1. 작업 분류 체계

모든 작업을 **3단계**로 분류하여 차등 프로세스 적용:

| 분류 | 예상 소요 시간 | 예시 | 프로세스 |
|:---|:---:|:---|:---|
| 🟢 **Micro** | < 30분 | 오타 수정, CSS 미세 조정, 문서 업데이트 | Fast-Track (간소화) |
| 🟡 **Small** | 30분~2시간 | 단일 기능 추가, 버그 수정, UI 컴포넌트 추가 | Simplified (부분 간소화) |
| 🔴 **Medium+** | 2시간 이상 | 새로운 Phase, 복잡한 기능, 아키텍처 변경 | Full Process (전체) |

### 프로세스 비교표

| 단계 | 🟢 Micro | 🟡 Small | 🔴 Medium+ |
|:---|:---:|:---:|:---:|
| **Task 문서 작성** | ❌ | ⚠️ 간단히 | ✅ 필수 |
| **구현 계획서 작성** | ❌ | ⚠️ 간단히 | ✅ 필수 |
| **Skills 분석 보고** | ❌ | ❌ | ✅ 필수 |
| **팀장 사전 승인** | ❌ (사후) | ⚠️ 채팅창 | ✅ 필수 |
| **구현** | ✅ | ✅ | ✅ |
| **개별 작업 회고** | ❌ | ❌ | ❌ |
| **정기 회고 참여** | ✅ | ✅ | ✅ |
| **QA 검토** | ⚠️ 자가 검토 | ✅ | ✅ |
| **팀장 사후 보고** | ✅ | ✅ | ✅ |
| **Git 커밋** | ✅ | ✅ | ✅ |

**NOTE**: 개별 작업 회고는 폐지되고, 대신 **정기 회고 체계 (일간/주간/월간)**으로 대체됩니다. (섹션 5 참조)

---

## 2. 문서/코드 생성 필수 규칙

### 2-1. 언어 규칙 ✅ 필수

#### 에러 메시지 이원화 (v2.0 추가)

- ✅ **사용자 노출 메시지** (Toast, Modal, Alert): 한글
  ```javascript
  showToast('즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.');
  ```

- ✅ **시스템 내부 에러** (throw, console.error, 로그): 영문 식별자 + 한글 설명
  ```javascript
  throw new Error('ERR_LOCK_TIMEOUT: 동시 작업 대기 시간 초과');
  console.error('ERR_CACHE_MISS: 캐시에서 데이터를 찾을 수 없음');
  ```

**장점**:
- 글로벌 검색 가능 (`ERR_LOCK_TIMEOUT` 검색)
- 코드 리뷰 시 영문 식별자로 빠른 파악
- 한글 설명으로 비전공자도 이해 가능

---

## 1. 문서/코드 생성 필수 규칙

### 1-1. 언어 규칙 ✅ 필수

#### 모든 문서는 **한글**로 작성
- ✅ **문서 본문**: 한글 (기술 용어는 영문 병기 가능)
- ✅ **주석**: 한글
- ✅ **UI 노출 에러 메시지**: 한글 (사용자 편의성 목적)
- ✅ **시스템 내부 에러 코드**: 영문 대문자 식별자 + 한글 설명 (예: `ERR_LOCK_TIMEOUT: 동시 작업 대기 시간 초과`)
- ⚠️ **변수명/함수명**: 영문 (camelCase)

#### 예시
```javascript
// ✅ 좋은 예
// 주디노트 즐겨찾기 토글 함수
function toggleFavorite(noteId) {
  // 노트 ID 유효성 검사
  if (!noteId) {
    throw new Error("노트 ID가 필요합니다.");
  }
}

// ❌ 나쁜 예
// Toggle favorite feature
function toggleFavorite(noteId) {
  // Validate note ID
  if (!noteId) {
    throw new Error("Note ID is required");
  }
}
```

---

### 1-2. 코드 헤더 규칙 ✅ 필수

**모든 코드 파일(.gs, .html) 상단에 다음 형식의 주석 필수**

#### GAS 파일 (.gs) 헤더 템플릿

```javascript
/**
 * ============================================
 * 파일명: judy_note.gs
 * 버전: v2.3.1 (최신)
 * 최종 수정일: 2026-02-27 15:30
 * 작성자: Ada (Backend Agent)
 *
 * [기능 요약]
 * - 주디노트 CRUD 기능 (생성, 조회, 수정, 삭제)
 * - 즐겨찾기 기능 (v2.3.0에서 추가)
 * - 실시간 자동저장
 * - LockService 동시성 제어
 *
 * [이번 업데이트 내용]
 * - 즐겨찾기 토글 API 추가
 * - LockService 타임아웃 10초로 증가 (기존 5초)
 * - 에러 메시지 한글화
 * - 캐시 무효화 로직 추가
 *
 * [업데이트 이유]
 * 사용자가 중요한 노트를 상단에 고정하고 싶다는 요청 (팀장)
 * 비전공자도 별 아이콘으로 직관적으로 사용 가능하도록 UX 개선
 * LockService 타임아웃으로 인한 간헐적 오류 방지
 *
 * [관련 문서]
 * - 계획: planning/implementation_plans/phase_24_judy_favorite.md
 * - QA: qa/qa_reviews/2026-02-27_judy_favorite_qa.md
 * - 회고: qa/retrospectives/2026-02-27_judy_favorite_retrospective.md
 * ============================================
 */
```

#### HTML 파일 (.html) 헤더 템플릿

```html
<!--
============================================
파일명: judy_note.html
버전: v2.3.1 (최신)
최종 수정일: 2026-02-27 15:30
작성자: Chloe (Frontend Agent)

[기능 요약]
- 주디노트 리스트 표시
- 노트 작성/수정 모달
- 즐겨찾기 별 아이콘 토글
- 드래그 앤 드롭 정렬

[이번 업데이트 내용]
- 즐겨찾기 별 아이콘 UI 추가
- 즐겨찾기 노트 상단 고정 표시
- 모바일 터치 이벤트 지원

[업데이트 이유]
즐겨찾기 기능 백엔드 API 완성에 따른 프론트엔드 구현
모바일 사용자 비율 40% 고려하여 터치 이벤트 필수 지원

[관련 문서]
- 계획: planning/implementation_plans/phase_24_judy_favorite.md
- QA: qa/qa_reviews/2026-02-27_judy_favorite_qa.md
============================================
-->
```

---

### 1-3. 문서 헤더 규칙 ✅ 필수

**모든 마크다운 문서 상단에 메타데이터 필수**

```markdown
---
title: 주디노트 즐겨찾기 기능 구현 계획
version: v1.2
created: 2026-02-27
updated: 2026-02-28
status: approved
authors: 자비스, Ada, Chloe
reviewers: 김감사
approver: 송용남 (팀장)
---
```

---

## 2. 커뮤니케이션 규칙

### 2-1. 채팅창 vs 에디터창 구분 ✅ 필수

#### 원칙
- **채팅창**: 요약 보고만 (3-5줄)
- **에디터창**: 상세 내용 (문서, 코드, 계획서)

---

#### 📊 채팅창 보고 템플릿

```markdown
[자비스] 주디노트 즐겨찾기 기능 구현 완료했습니다! ✅

📌 요약:
- 별 아이콘으로 즐겨찾기 토글
- 즐겨찾기 노트는 상단 고정 표시
- 모바일 터치 이벤트 지원
- QA 통과 완료

📄 상세 내용은 에디터창에서 확인해주세요:
- [구현 계획서](planning/implementation_plans/phase_24_judy_favorite.md)
- [백엔드 코드](src/gas/judy_note.gs)
- [프론트엔드 코드](src/frontend/judy_note.html)
- [QA 보고서](qa/qa_reviews/2026-02-27_judy_favorite_qa.md)
- [회고 문서](qa/retrospectives/2026-02-27_judy_favorite_retrospective.md)
```

#### 📝 에디터창 표시 내용
- 전체 구현 계획 문서
- 코드 파일 수정 사항 (전체 파일 출력 지양, 핵심 변경 로직 및 주석 위주로 효율적 표시)
- QA 테스트 결과 상세
- 회고 문서 전체
- 디버깅 로그 전체

---

### 2-2. 보고 흐름 ✅ 필수

```
Step 1: 업무 접수
└─ 채팅창: "접수 완료, 분석 시작하겠습니다"

Step 2: 계획 수립 완료
└─ 채팅창: 계획 요약 (3-5줄) + 파일 링크
└─ 에디터창: task.md 파일 자동 열림

Step 3: 팀장 검토 요청
└─ 채팅창: "에디터창에서 계획서 확인 부탁드립니다"

Step 4: 구현 중
└─ 채팅창: 진행률만 표시 (25%, 50%, 75%)
└─ agent_work/PROGRESS.md 실시간 업데이트

Step 5: 구현 완료
└─ 채팅창: 완료 요약 + 파일 링크
└─ 에디터창: 코드, QA 문서, 회고 링크 제공

Step 6: 배포 승인 요청
└─ 채팅창: "회고 작성 완료, Git 커밋 진행해도 될까요?"

Step 7: 배포 완료
└─ 채팅창: "배포 완료! GitHub 링크: [URL]"
```

---

## 3. 개발 프로세스 규칙

### 3-1. 시작 전 필수 절차 ✅ 필수

**"계획 없이 구현 시작 금지"** (단, 긴급/단순 작업 예외)

#### 🚀 긴급 조치 Fast-Track (예외 프로세스)
- **적용 대상**: 예상 소요 시간 1시간 미만의 단순 작업 또는 긴급 버그 수정(Hotfix)
- **절차**: Task 문서화, 계획서 수립, Skills 분석 절차 생략 → 즉각적인 코드/로직 구현 → 사후 디버깅 로그/완료 보고서 작성
- **장점**: 불필요한 문서화 오버헤드 최소화로 프로젝트 지연 방지

#### 기본 업무 시작 시퀀스

```
1️⃣ [자비스] 요구사항 분석 및 Task 문서 작성
   파일: planning/tasks/task_[기능명].md
   내용: 배경, 목적, 요구사항, 제약사항, 우선순위
   보고: 채팅창 요약 + 에디터창 파일 열기

2️⃣ [팀장] Task 검토 및 피드백
   승인: "진행해"
   수정: "여기 수정해줘: [구체적 내용]"

3️⃣ [자비스] 상세 구현 계획 작성
   파일: planning/implementation_plans/phase_XX_[기능명].md
   내용:
   - 기술 스택 및 사용할 Claude Skills
   - 백엔드/프론트엔드 작업 분리
   - 예상 소요시간
   - 기술적 고려사항 (GAS 타임아웃, LockService 등)
   - 테스트 계획
   보고: 채팅창 요약 + 에디터창 파일 열기

4️⃣ [팀장] 구현 계획 최종 승인
   승인: "OK, 시작해"
   수정: "이 부분 다시 고민해봐: [내용]"

5️⃣ [자비스] Ada, Chloe에게 작업 분배
   - Ada: 백엔드 구현
   - Chloe: 프론트엔드 구현
   - 각자 agent_work/[이름]/에 진행 상황 기록

6️⃣ 구현 시작
```

---

### 3-2. Claude/Anthropic Skills 참고 필수 ✅ 필수

**모든 작업 시작 전 사용할 Skills 분석 및 보고**

#### Skills 분석 보고 템플릿

```markdown
## [자비스] 사용할 Claude/Anthropic Skills 분석

### ✅ 이번 작업에 적용할 Skills

#### 1. Prompt Caching
- **사용 위치**: AI 회고 생성 API
- **사용 이유**:
  - 공도 시스템 컨텍스트(시트 구조, 함수 목록, 코딩 스타일)를 캐싱
  - 매번 동일한 시스템 정보를 전달할 필요 없음
  - API 토큰 비용 90% 절감 가능
- **예상 효과**:
  - 회고 생성 속도: 8초 → 2초 (4배 향상)
  - 월간 API 비용: $50 → $5 (90% 절감)
- **참고 문서**: https://docs.anthropic.com/claude/docs/prompt-caching

#### 2. Extended Thinking
- **사용 위치**: 드래그앤드롭 로직 설계
- **사용 이유**:
  - 터치/마우스 이벤트 충돌 해결 필요
  - GAS 6분 타임아웃 내 대용량 데이터 처리 방법 고민
  - 모바일 브라우저별 호환성 고려
- **예상 효과**:
  - 엣지 케이스 사전 발견으로 리팩토링 최소화
  - 버그 발생률 50% 감소 예상
- **참고 문서**: https://docs.anthropic.com/claude/docs/extended-thinking

#### 3. Tool Use (Function Calling)
- **사용 위치**: 슬랙봇 명령어 파싱
- **사용 이유**:
  - 자연어 명령을 구조화된 함수 호출로 변환
  - "/judy 오늘 할일 보여줘" → getTasks({date: "today"})
- **예상 효과**:
  - 명령어 인식률 95% 이상
  - 사용자 경험 개선

### ❌ 이번 작업에 적용하지 않는 Skills

#### Analysis Tool
- **미사용 이유**:
  - 이번 작업은 데이터 분석 불필요
  - UI 구현에 집중

#### Vision (이미지 분석)
- **미사용 이유**:
  - 이미지 입력/분석 기능 없음
  - 텍스트 기반 작업만 수행
```

---

## 5. 회고 규칙 (정기 회고 체계)

**v2.0 대폭 개선**: 개별 작업 회고 폐지 → **정기 회고 체계 (일간/주간/월간)** 도입

### 🎯 철학 변경

- **v1.0**: "회고 없는 배포 금지" → 모든 작업마다 회고 문서 작성
- **v2.0**: "정기 회고로 패턴 분석" → 개별 작업은 정기 회고에서 일괄 다룸

**장점**:
- 문서 작업 시간 **70% 절감**
- 팀 전체가 동일한 인사이트 공유
- 개별 작업의 미시적 회고 → 팀 전체의 거시적 회고

---

### 5-1. 일간 회고 (Daily Retrospective) - 5분

#### 📅 일간 회고 개요
- **시점**: 매일 업무 종료 시 (EOD, End of Day)
- **형식**: 채팅창에 간단히 보고
- **참여자**: 각 에이전트 개별
- **소요 시간**: 5분

#### 내용 템플릿

```markdown
[Ada] 오늘 회고 (2026-02-27)
- ✅ 완료: 주디노트 즐겨찾기 백엔드 (5시간)
- 📚 배운 점: LockService 타임아웃은 10초 이상 필요
- 🚀 내일 할 일: 알림 시스템 백엔드 구현 계획
```

**NOTE**:
- 파일로 저장하지 않음 (채팅창 보고만)
- 간단한 3줄 형식 (완료, 배운 점, 내일 계획)

---

### 5-2. 주간 회고 (Weekly Retrospective) - 30분

#### 📊 주간 회고 개요
- **시점**: 매주 금요일 오후
- **형식**: `qa/retrospectives/weekly/YYYY-WW_weekly_retro.md`
- **참여자**: 전체 에이전트 (자비스, Ada, Chloe, 김감사, 벨라) + 팀장님
- **소요 시간**: 30분

#### 내용 템플릿

**파일명**: `qa/retrospectives/weekly/2026-W09_weekly_retro.md`

```markdown
# 2026년 9주차 (W09) 주간 회고

**작성자**: 자비스 (PO)
**참여자**: 전체 에이전트 + 팀장님
**날짜**: 2026-02-28 (금)

## 📊 주간 통계
- **완료 Phase**: Phase 23-1, 23-2 (칸반 보드)
- **완료 작업 수**: 12개
- **버그 수**: 2개 (모두 해결)
- **평균 소요 시간**: 작업당 2.5시간

## ✅ Keep (잘한 점)
1. 칸반 보드 드래그 앤 드롭 UX가 직관적 (팀장님 피드백)
2. LockService 동시성 문제 사전 차단

## ⚠️ Problem (개선할 점)
1. 모바일 테스트 지연 (Phase 23-2에서 30분 손실)
2. 캐시 무효화 시나리오 누락 (Phase 23-1)

## 🚀 Try (다음 주 시도할 것)
1. 개발 중간에 모바일 병렬 테스트
2. 캐시 사용 체크리스트 사전 확인

## 📅 다음 주 계획
- Phase 23-3: 커스텀 캘린더 구현
- Phase 24: AI 프로액티브 에이전트 기획
```

---

### 5-3. 월간 회고 (Monthly Retrospective) - 1시간

#### 🗓️ 월간 회고 개요
- **시점**: 매월 마지막 금요일
- **형식**: `qa/retrospectives/monthly/YYYY-MM_monthly_retro.md`
- **참여자**: 전체 에이전트 + 팀장님 (필수)
- **소요 시간**: 1시간

#### 내용 템플릿

**파일명**: `qa/retrospectives/monthly/2026-02_monthly_retro.md`

```markdown
# 2026년 2월 월간 회고

**작성자**: 김감사 (QA)
**참여자**: 전체 에이전트 + 팀장님
**날짜**: 2026-02-28

## 📊 월간 통계
- **완료 Phase**: Phase 20~23 (4개)
- **배포 횟수**: 8회
- **버그 발생**: 5개 (모두 해결)
- **평균 Phase 완료 시간**: 3일

## 🎯 주요 성과
1. Judy Workspace 통합 SPA 출시 (Phase 20)
2. 타임 트래킹 Beta 배포 (Phase 21)
3. 칸반 보드 완성 (Phase 23)

## 🏛️ 아키텍처 결정 회고 (ADR)
1. **결정**: LockService 타임아웃 10초 통일
   - **이유**: 5초는 너무 짧아 타임아웃 빈번
   - **결과**: 동시성 에러 90% 감소

2. **결정**: CacheService 5분 캐싱 표준화
   - **이유**: 성능 향상 및 GAS 할당량 절감
   - **결과**: 페이지 로드 50% 개선

## 📈 성장 메트릭
- **개발 속도**: 작업당 평균 2.5시간 (목표 3시간 대비 ↑ 20%)
- **코드 품질**: QA 재작업률 5% (목표 10% 대비 ↑ 50%)
- **팀장 만족도**: 4.5/5.0

## 🚀 다음 달 로드맵
- Phase 24: AI 프로액티브 에이전트
- Phase 25: 프로젝트 통계 대시보드
- AI 에이전트 팀 운영규칙 v2.0 안정화
```

---

### 5-4. 개별 작업 회고는 폐지

**v1.0**: 모든 Phase마다 상세 회고 문서 작성 (30분~1시간)
**v2.0**: 개별 작업 회고 폐지, 정기 회고에서 일괄 다룸

**예외**: 🔴 **Medium+ 작업 중 특별히 중요한 Phase**는 선택적으로 개별 회고 가능
- 예: 아키텍처 대변경, 보안 기능 추가, 3일 이상 소요된 작업

---

## 6. 디버깅 기록 규칙

**템플릿 사용 필수**: `templates/TEMPLATE_retrospective.md`

#### 필수 포함 항목

```markdown
## [기능명] 개발 회고

### 📊 작업 정보
- **기능명**: 주디노트 즐겨찾기
- **작업 기간**: 2026-02-27 ~ 2026-02-27 (1일)
- **예상 시간**: 4시간
- **실제 시간**: 5시간
- **차이 이유**: 캐시 무효화 로직 추가 (+1시간)

### 👥 참여자
- 자비스 (PO): 요구사항 분석, 계획 수립
- Ada (Backend): GAS API 구현
- Chloe (Frontend): HTML/CSS/JS 구현
- 김감사 (QA): E2E 테스트, 보안 검토
- 송용남 (팀장): 계획 승인, 최종 검수

### ✅ 잘한 점 (Keep)
1. **LockService 사전 적용**
   - 동시성 문제를 구현 단계부터 고려
   - QA에서 동시성 버그 0건

2. **모바일 우선 개발**
   - 터치 이벤트를 초기부터 구현
   - 반응형 디자인 적용으로 추가 수정 불필요

3. **명확한 에러 메시지**
   - "즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요."
   - 비전공자 팀장님도 이해하기 쉬움

### ⚠️ 개선할 점 (Problem)
1. **캐시 무효화 시나리오 누락**
   - 초기 계획에서 고려하지 못함
   - QA 단계에서 발견되어 1시간 추가 소요
   - 영향: 일정 20% 지연

2. **모바일 테스트 지연**
   - 개발 완료 후 모바일 테스트 시작
   - 실제 기기 테스트가 늦어져 배포 30분 지연

### 🚀 시도할 것 (Try)
1. **캐시 사용 체크리스트 작성**
   - 다음 작업부터 캐시 사용 시 무효화 시나리오 필수 체크
   - qa/checklists/CACHE_CHECKLIST.md 생성 예정

2. **모바일 병렬 개발**
   - 데스크톱/모바일 동시 개발 및 테스트
   - Chloe가 개발 중간에 모바일 확인하는 프로세스 추가

### 📚 배운 점 (Learn)
1. **GAS에서 HTML5 Drag API 제한**
   - HTML5 Drag API는 GAS 환경에서 일부 제한
   - 직접 touchstart/touchmove/touchend 이벤트 핸들링 필요

2. **터치 이벤트는 preventDefault() 필수**
   - passive: false 옵션 필수
   - 그렇지 않으면 페이지 스크롤과 충돌

3. **CacheService와 LockService 조합**
   - Lock 획득 전 캐시 읽기
   - Lock 획득 후 시트 쓰기
   - Lock 해제 후 캐시 무효화
   - 순서가 중요함을 학습

### 📈 성능 메트릭
- **구현 전**:
  - 즐겨찾기 기능 없음
  - 페이지 로드: 2.3초

- **구현 후**:
  - 즐겨찾기 토글 응답: 0.8초
  - 페이지 로드: 2.1초 (캐시 최적화로 개선)
  - LockService 대기: 평균 0.1초

- **목표 대비**:
  - ✅ 1초 이내 응답 (목표 달성)
  - ✅ 페이지 로드 개선 (부수 효과)

### 🔗 관련 문서
- 계획: planning/implementation_plans/phase_24_judy_favorite.md
- QA: qa/qa_reviews/2026-02-27_judy_favorite_qa.md
- 디버깅: docs/troubleshooting/2026-02-27_judy_favorite_debugging.md
```

---

### 4-3. 디버깅 로그 작성 규칙

**템플릿 사용 필수**: `templates/TEMPLATE_debugging_log.md`

#### 필수 포함 항목

```markdown
## [기능명] 디버깅 로그

### 에러 1: 드래그 시 페이지 스크롤 발생

**발생 시각**: 2026-02-27 14:32
**심각도**: Medium (기능 작동하나 UX 저해)
**발견자**: Chloe (Frontend)
**해결자**: Chloe (Frontend)

**에러 내용**:
모바일에서 카드를 드래그할 때 페이지가 함께 스크롤됨
사용자가 의도한 위치에 드롭하기 어려움

**재현 방법**:
1. 모바일 브라우저(iOS Safari, Android Chrome)에서 접속
2. 태스크 카드를 터치하여 드래그
3. 드래그 중 페이지가 스크롤됨

**원인 분석**:
touchmove 이벤트에 preventDefault() 누락
브라우저 기본 동작(스크롤)이 실행됨

**해결 방법**:
```javascript
// ❌ 수정 전
element.addEventListener('touchmove', (e) => {
  // 드래그 로직만 있음
  handleDrag(e);
});

// ✅ 수정 후
element.addEventListener('touchmove', (e) => {
  e.preventDefault(); // 브라우저 기본 스크롤 방지
  handleDrag(e);
}, { passive: false }); // passive: false 필수!
```

**소요 시간**: 30분 (문제 파악 20분 + 수정 10분)
**참고 문서**:
- MDN - Touch Events: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
- passive 옵션 설명: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive

**재발 방지 방안**:
터치 이벤트 구현 시 체크리스트 항목 추가
- [ ] preventDefault() 호출 확인
- [ ] passive: false 옵션 확인
- [ ] iOS Safari, Android Chrome 실기기 테스트

---

### 에러 2: LockService 타임아웃

**발생 시각**: 2026-02-27 15:10
**심각도**: High (기능 실패)
**발견자**: 김감사 (QA)
**해결자**: Ada (Backend)

**에러 내용**:
```
Exception: Could not obtain lock after 5 seconds
at toggleFavorite (judy_note.gs:127)
```

**재현 방법**:
1. 2개 브라우저 탭에서 동시 로그인
2. 동일한 노트를 동시에 즐겨찾기 토글
3. 한쪽에서 타임아웃 에러 발생

**원인 분석**:
- LockService 타임아웃 5초로 설정
- 시트 쓰기 작업이 3-4초 소요 (데이터 많을 경우)
- 2개 요청이 충돌하면 5초 내 Lock 획득 실패

**해결 방법**:
```javascript
// ❌ 수정 전
var lock = LockService.getScriptLock();
lock.waitLock(5000); // 5초

// ✅ 수정 후
var lock = LockService.getScriptLock();
lock.waitLock(10000); // 10초로 증가
```

**추가 개선**:
에러 메시지 한글화 및 사용자 친화적으로 변경
```javascript
try {
  lock.waitLock(10000);
} catch (e) {
  throw new Error("다른 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.");
}
```

**소요 시간**: 45분 (재현 15분 + 분석 20분 + 수정/테스트 10분)
**참고 문서**:
- GAS LockService: https://developers.google.com/apps-script/reference/lock/lock-service

**재발 방지 방안**:
- 모든 Lock 타임아웃 10초 이상으로 통일
- 동시성 테스트를 QA 필수 항목에 추가
```

---

## 5. Git 커밋 및 배포 규칙

### 5-1. 커밋 전 승인 프로세스 ✅ 필수

**"팀장 승인 없이 Git Push 금지"**

#### 배포 승인 시퀀스

```
1️⃣ QA 통과 확인
   [김감사] "QA 통과했습니다. 배포 가능합니다."

2️⃣ 회고 및 디버깅 로그 작성
   [자비스/Ada/Chloe] 회고 문서 작성
   [해당 에이전트] 디버깅 로그 작성

3️⃣ 팀장님께 배포 승인 요청 (채팅창)
   [자비스] "팀장님, 회고 및 디버깅 문서 작성 완료했습니다.
            Git 커밋 및 Push 진행해도 될까요?"

   📄 생성된 문서:
   - 회고: qa/retrospectives/2026-02-27_judy_favorite_retrospective.md
   - 디버깅: docs/troubleshooting/2026-02-27_judy_favorite_debugging.md

   📝 커밋 메시지 (초안):
   feat: add favorite feature to judy note
   - Add toggleFavorite() API
   - Add star icon UI
   ...

4️⃣ 팀장 검토 및 승인
   [팀장] "ㅇㅇ" 또는 "회고 내용 이 부분 수정해줘"

5️⃣ Git 커밋 및 Push
   [자비스] git add -A
   [자비스] git commit -m "..."
   [자비스] git push origin main

6️⃣ 배포 완료 보고 (채팅창)
   [자비스] "배포 완료했습니다! ✅
            GitHub: https://github.com/.../commit/abc123"
```

---

### 5-2. 커밋 메시지 규칙 ✅ 필수

#### 형식

```
<type>: <subject>

<body>

Co-Authored-By: <name> <email>
Co-Authored-By: <name> <email>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

#### Type 종류

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경

#### 예시

```bash
feat: add favorite feature to judy note

- Add toggleFavorite() API in judy_note.gs
- Add star icon UI in judy_note.html
- Apply LockService for concurrency control (10s timeout)
- Support mobile touch events with preventDefault
- Add cache invalidation logic

Co-Authored-By: Ada <ada@gongdo.team>
Co-Authored-By: Chloe <chloe@gongdo.team>
Co-Authored-By: Kim QA <kim@gongdo.team>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 6. 추가 운영 규칙

### 6-1. 작업 진행률 정기 공유 ✅ 권장

**목적**: 팀장님이 "지금 어디까지 됐어?" 물어보지 않아도 알 수 있도록

#### PROGRESS.md 파일 관리

잦은 I/O 오버헤드를 줄이기 위해 각 에이전트는 `agent_work/[agent_name]/PROGRESS.md` 파일을 **일 1회(Daily)** 또는 **주요 마일스톤(Phase) 완료 시** 정기적으로 업데이트합니다.

**예시**:
```markdown
# Ada 작업 진행률

**최종 업데이트**: 2026-02-27 15:30

## 🔥 현재 작업: 주디노트 즐겨찾기 백엔드
- [x] toggleFavorite() API 구현 (100%)
- [x] LockService 적용 (100%)
- [x] 캐시 무효화 로직 (100%)
- [x] 단위 테스트 작성 (100%)
- [x] 통합 테스트 (100%)
- [x] 디버깅 로그 작성 (100%)

**상태**: ✅ 완료 (QA 대기 중)

---

## ⏳ 다음 작업: 알림 시스템 백엔드
- [ ] 요구사항 분석 (대기)
- [ ] 계획 수립 (대기)

**상태**: 📝 대기 (팀장 승인 대기)
```

---

### 6-2. 체크리스트 활용 ✅ 필수

#### 코드 리뷰 체크리스트

**위치**: `qa/checklists/CODE_REVIEW_CHECKLIST.md`

**사용 시점**:
- 구현 완료 후 자가 체크 (자비스, Ada, Chloe)
- QA 시작 전 필수 확인 (김감사)

#### 보안 체크리스트

**위치**: `qa/checklists/SECURITY_CHECKLIST.md`

**사용 시점**:
- 인증/데이터 접근 관련 기능 구현 시
- QA 단계에서 필수 확인

---

### 6-3. Claude Skills 가이드 참고 ✅ 필수

**위치**: `docs/guides/CLAUDE_SKILLS_GUIDE.md`

**사용 시점**:
- 모든 작업 계획 수립 시
- "어떤 Skills를 사용할지" 판단 필요 시

---

### 6-4. 파일 네이밍 규칙 ✅ 필수

#### 계획 문서
```
planning/tasks/task_[기능명].md
planning/implementation_plans/phase_XX_[기능명].md
```

#### QA 문서
```
qa/qa_reviews/YYYY-MM-DD_[기능명]_[단계].md
qa/test_plans/TEST_PLAN_[기능명].md
```

#### 회고/디버깅
```
qa/retrospectives/YYYY-MM-DD_[기능명]_retrospective.md
docs/troubleshooting/YYYY-MM-DD_[기능명]_debugging.md
```

#### 에이전트 작업물
```
agent_work/jarvis_po/YYYY-MM-DD_[작업내용].md
agent_work/ada_backend/YYYY-MM-DD_[작업내용].md
agent_work/chloe_frontend/YYYY-MM-DD_[작업내용].md
agent_work/kim_qa/YYYY-MM-DD_[작업내용].md
```

---

## 📊 규칙 준수 체크 매트릭스

| 규칙 | 자비스 | Ada | Chloe | 김감사 | 팀장 |
|------|--------|-----|-------|--------|------|
| 한글 작성 | ✅ | ✅ | ✅ | ✅ | - |
| 코드 헤더 | - | ✅ | ✅ | 검증 | - |
| 채팅=요약 | ✅ | ✅ | ✅ | ✅ | - |
| 계획 먼저 | ✅ | - | - | 검증 | 승인 |
| Skills 분석 | ✅ | ✅ | ✅ | - | - |
| 회고 작성 | ✅ | ✅ | ✅ | ✅ | 참여 |
| 디버깅 로그 | - | ✅ | ✅ | - | - |
| Git 승인 | 실행 | - | - | - | 승인 |

---

## 🎯 빠른 참조 (Quick Reference)

### 작업 시작 시
1. ✅ Task 문서 작성 → 팀장 승인
2. ✅ 구현 계획 작성 → 팀장 승인
3. ✅ Skills 분석 보고
4. ✅ 구현 시작

### 코드 작성 시
1. ✅ 파일 상단에 헤더 주석 (버전, 날짜, 기능, 업데이트 이유)
2. ✅ 주석 한글 작성
3. ✅ 에러 메시지 한글 작성

### 작업 완료 시
1. ✅ 회고 문서 작성
2. ✅ 디버깅 로그 작성 (에러 발생 시)
3. ✅ 팀장 배포 승인 요청
4. ✅ Git 커밋 & Push
5. ✅ GitHub 링크 보고

### 보고 시
1. ✅ 채팅창: 요약만 (3-5줄)
2. ✅ 에디터창: 상세 문서 링크 제공

---

## 📚 관련 문서

- [AI 에이전트 팀 운영 가이드](./[김감사_완료보고]_문서구조화_및_AI에이전트팀_운영가이드.md)
- [Claude Skills 사용 가이드](./docs/guides/CLAUDE_SKILLS_GUIDE.md)
- [코드 리뷰 체크리스트](./qa/checklists/CODE_REVIEW_CHECKLIST.md)
- [보안 체크리스트](./qa/checklists/SECURITY_CHECKLIST.md)

---

**이 문서는 모든 AI 에이전트가 작업 시작 전 필수로 확인해야 합니다.**
