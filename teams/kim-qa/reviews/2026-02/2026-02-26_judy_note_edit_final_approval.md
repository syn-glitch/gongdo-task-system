# 🟢 [김감사 최종 승인] 주디 노트 수정 기능 개발 착수 승인

**검토자**: 김감사 (QA & 기술검토)
**검토일시**: 2026-02-26 15:00
**원본 문서**: `주디노트 업데이트 자&김 v1_20260226.1450.md`
**승인 상태**: ✅ **조건부 승인 (Conditional Approval)**

---

## 📋 Executive Summary

자비스 팀장님, **개발 착수를 승인합니다.**

김감사가 지적한 **Critical Issues (동시성, 백업, 파싱)**를 100% 수용하여 아키텍처를 대폭 보완한 점을 높이 평가합니다. UX 설계에 대한 의견 차이는 있으나, 사용자(팀장)의 최종 승인이 있었고 **2단계 삭제 확인 모달**로 안전장치를 마련한 점에서 합리적 타협점을 찾았다고 판단합니다.

**최종 평가**: 🟢 **조건부 승인** (5개 체크리스트 완료 시 → 완전 승인)

---

## ✅ 김감사 평가 - 수용된 항목

### 1. 🔒 동시성 제어 (LockService) - 완전 수용 ✅

**자비스 팀장 합의 내용**:
> `LockService.getUserLock()` 전면 필수 도입. 슬랙 봇 입력과 웹 수정을 동시에 할 경우 발생하는 파일 덮어쓰기 데이터 유실 100% 차단.

**김감사 평가**: ✅ **완벽히 수용됨**

**개발 시 추가 확인 사항**:
```javascript
// ✅ 필수 구현 확인
function appendMemoToArchive(userName, memoText, userId) {
  const lock = LockService.getUserLock();
  const lockKey = "MEMO_LOCK_" + userName;

  try {
    const hasLock = lock.tryLock(10000); // 10초 대기
    if (!hasLock) {
      throw new Error("⏱️ 다른 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.");
    }

    // 기존 로직...

  } finally {
    lock.releaseLock(); // ⚠️ 반드시 해제!
  }
}
```

**QA 체크리스트**:
- [ ] `appendMemoToArchive()` 함수에 Lock 적용 완료
- [ ] `safeUpdateArchivedMemo()` 함수에 Lock 적용 완료
- [ ] `tryLock()` Timeout 10초 설정 확인
- [ ] `finally` 블록에서 `releaseLock()` 호출 확인
- [ ] Lock 획득 실패 시 사용자 친화적 에러 메시지 표시

---

### 2. 💾 백업 시스템 (2-Phase Commit) - 완전 수용 ✅

**자비스 팀장 합의 내용**:
> 원본 `.md` 파일을 먼저 백업(`[파일명]_backup_[Timestamp].md`). 파일 무결성 검증 후 성공 시 백업 파일 파기.

**김감사 평가**: ✅ **완벽히 수용됨**

**개발 시 추가 확인 사항**:
```javascript
// ✅ 필수 구현 확인
function safeUpdateArchivedMemo(userName, dateStr, timeStr, originalContent, newContent, operation) {
  let backupFile = null;

  try {
    // Phase 1: 백업 생성
    const mdFile = getMonthlyMemoFile(userName, dateStr);
    const originalFullContent = mdFile.getBlob().getDataAsString();

    const timestamp = new Date().getTime();
    const backupFileName = mdFile.getName().replace('.md', `_backup_${timestamp}.md`);
    backupFile = mdFile.getParents().next().createFile(backupFileName, originalFullContent);

    // Phase 2: 수정 수행
    const updatedContent = performOperation(originalFullContent, operation, ...);

    // Phase 3: 무결성 검증
    validateFileIntegrity(originalFullContent, updatedContent);

    // Phase 4: 실제 쓰기
    mdFile.setContent(updatedContent);

    // Phase 5: 백업 삭제
    Utilities.sleep(1000); // 파일 시스템 동기화 대기
    backupFile.setTrashed(true);

    return { success: true };

  } catch (error) {
    if (backupFile) {
      // 실패 시 백업 유지 (이름에 _FAILED 추가)
      backupFile.setName(backupFile.getName().replace('_backup_', '_FAILED_backup_'));
    }
    throw error;
  }
}

// 무결성 검증 함수
function validateFileIntegrity(original, updated) {
  // 1. 최소 길이 체크
  if (updated.trim().length < 10) {
    throw new Error("ERR_FILE_TOO_SHORT: 파싱 결과가 비정상적으로 짧습니다.");
  }

  // 2. 날짜 헤더 개수 체크
  const originalDateCount = (original.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length;
  const updatedDateCount = (updated.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length;

  if (updatedDateCount < originalDateCount) {
    throw new Error(`ERR_DATE_HEADER_LOST: 날짜 헤더가 ${originalDateCount}개에서 ${updatedDateCount}개로 감소했습니다.`);
  }

  // 3. 기본 마크다운 구조 체크
  if (!updated.includes('# ') && original.includes('# ')) {
    throw new Error("ERR_STRUCTURE_BROKEN: 파일 구조가 손상되었습니다.");
  }
}
```

**QA 체크리스트**:
- [ ] 백업 파일 생성 확인 (타임스탬프 포함)
- [ ] 무결성 검증 로직 구현 (길이, 날짜 헤더 개수)
- [ ] 성공 시 백업 파일 자동 삭제 확인
- [ ] 실패 시 백업 파일 유지 (이름에 `_FAILED_` 추가)
- [ ] 1초 `Utilities.sleep()` 후 백업 삭제 (파일 시스템 동기화)

---

### 3. 🎯 정규식 파싱 (단일 매칭 강제) - 완전 수용 ✅

**자비스 팀장 합의 내용**:
> `dateStr`, `timeStr`, `originalContent` 3가지 인덱스를 모두 검사하여 **파일 내에 매칭되는 건이 "정확히 1건일 때만"** 텍스트를 치환.

**김감사 평가**: ✅ **완벽히 수용됨**

**개발 시 추가 확인 사항**:
```javascript
// ✅ 필수 구현 확인 (허밋 담당)
function findExactMemo(fullText, dateStr, timeStr, originalContent) {
  // 1단계: 날짜 블록 추출
  const dateBlockRegex = new RegExp(`## ${escapeRegex(dateStr)}\\n([\\s\\S]*?)(?=\\n## |$)`, 'g');
  const dateMatch = dateBlockRegex.exec(fullText);

  if (!dateMatch) {
    return { success: false, errorCode: "ERR_DATE_NOT_FOUND", matches: 0 };
  }

  const dateBlockContent = dateMatch[1];

  // 2단계: 타임스탬프 블록 추출
  const timeBlockRegex = new RegExp(
    `- \\*\\*\\[${escapeRegex(timeStr)}\\]\\*\\*\\n((?:  .*\\n?)*?)(?=\\n- \\*\\*\\[|$)`,
    'g'
  );

  const matches = [];
  let match;
  while ((match = timeBlockRegex.exec(dateBlockContent)) !== null) {
    matches.push({
      fullMatch: match[0],
      content: match[1].trim().replace(/  /g, ''),
      index: match.index
    });
  }

  // 3단계: originalContent로 정확한 메모 특정
  const exactMatches = matches.filter(m =>
    m.content === originalContent.trim()
  );

  // 4단계: 매칭 개수 검증
  if (exactMatches.length === 0) {
    return { success: false, errorCode: "ERR_CONTENT_NOT_FOUND", matches: 0 };
  }

  if (exactMatches.length > 1) {
    return { success: false, errorCode: "ERR_DUPLICATE_CONTENT", matches: exactMatches.length };
  }

  // 정확히 1개 매칭 → 성공
  return {
    success: true,
    match: exactMatches[0],
    startIndex: dateMatch.index + exactMatches[0].index,
    endIndex: dateMatch.index + exactMatches[0].index + exactMatches[0].fullMatch.length
  };
}

// 정규식 특수문자 이스케이프
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**QA 체크리스트**:
- [ ] `escapeRegex()` 함수 구현 (특수문자 이스케이프)
- [ ] 날짜 블록 정확히 추출 확인
- [ ] 타임스탬프 블록 정확히 추출 확인
- [ ] originalContent 매칭 개수 검증 (정확히 1개만 허용)
- [ ] 에러 코드 정의 (`ERR_DATE_NOT_FOUND`, `ERR_CONTENT_NOT_FOUND`, `ERR_DUPLICATE_CONTENT`)

---

## ⚠️ 김감사 의견 - 부분 기각된 항목

### 1. 🎨 UX 설계 (점 3개 메뉴 vs 1-Depth 아이콘)

**김감사 제안**: 더보기 메뉴 (점 3개 `⋮`) 안에 액션 버튼 숨기기

**자비스 반대 의견**: 1-Depth 직관적 UI (`✏️`, `✓`, `🗑️` 아이콘 직접 노출)

**최종 결정**: 🟡 **자비스 안 채택** (사용자 승인)

---

#### 김감사 의견: 부분 기각은 수용하되, 조건부 승인

**기각 사유 이해**:
- 사용자(팀장)가 빠른 조작을 선호
- 1-Depth 아이콘이 생산성 향상
- 2단계 삭제 확인 모달로 안전장치 마련

**김감사 조건**:
✅ **다음 5가지 UX 안전장치 구현 시 승인**

#### 조건 1: 호버 상태에서만 버튼 노출 (오작동 방지)
```css
/* 기본 상태: 버튼 숨김 */
.memo-block .action-buttons {
  opacity: 0;
  transition: opacity 0.2s;
}

/* 호버 시: 버튼 노출 */
.memo-block:hover .action-buttons {
  opacity: 1;
}

/* 모바일: 메모 터치 시 3초간 노출 */
.memo-block.touched .action-buttons {
  opacity: 1;
}
```

#### 조건 2: 삭제 버튼 강조 (Danger 스타일)
```html
<div class="action-buttons">
  <button class="action-edit">✏️</button>
  <button class="action-done">✓</button>
  <button class="action-delete danger">🗑️</button> <!-- danger 클래스 -->
</div>
```

```css
.action-delete.danger {
  color: #dc3545; /* 빨간색 */
  border: 1px solid #dc3545;
}

.action-delete.danger:hover {
  background-color: #dc3545;
  color: white;
  /* 호버 시 명확히 위험 신호 */
}
```

#### 조건 3: 2단계 삭제 확인 모달 (메모 미리보기 포함)
```javascript
function confirmDelete(memoBlock) {
  const content = memoBlock.querySelector('.memo-content').textContent;
  const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;

  showModal({
    title: "⚠️ 메모 삭제",
    message: `다음 메모를 삭제하시겠습니까?\n\n"${preview}"\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`,
    confirmText: "삭제",
    confirmStyle: "danger", // 빨간색 버튼
    cancelText: "취소",
    onConfirm: () => {
      // 실제 삭제 API 호출
      performDelete(memoBlock);
    }
  });
}
```

#### 조건 4: Undo 토스트 (3초간 복구 가능) - 선택 구현
```javascript
function performDelete(memoBlock) {
  google.script.run
    .withSuccessHandler(response => {
      if (response.success) {
        // UI에서 제거
        memoBlock.classList.add('deleting');
        setTimeout(() => memoBlock.remove(), 300);

        // Undo 토스트 (3초)
        showUndoToast("메모가 삭제되었습니다", 3000, () => {
          // Undo 버튼 클릭 시
          restoreMemo(response.backupId, memoBlock);
        });
      }
    })
    .deleteArchivedMemo(...);
}
```

#### 조건 5: 모바일 터치 최적화 (최소 44x44px)
```css
/* 모바일: 터치 타겟 최소 크기 보장 */
@media (max-width: 768px) {
  .action-buttons button {
    min-width: 44px;
    min-height: 44px;
    font-size: 18px; /* 아이콘 크기 증가 */
  }
}
```

**QA 체크리스트 (UX)**:
- [ ] 호버 시에만 버튼 노출 (기본 상태 숨김)
- [ ] 삭제 버튼 빨간색 강조 (danger 스타일)
- [ ] 삭제 확인 모달 구현 (메모 미리보기 포함)
- [ ] 모달 취소 버튼 명확히 노출 (기본 포커스: 취소)
- [ ] 모바일 터치 타겟 최소 44x44px

---

## 🚀 개발 착수 전 최종 체크리스트

### Phase 0: 준비 단계 (개발 전 필수)

#### 1. API 명세서 작성
```markdown
파일명: API_SPEC_judy_note_edit.md

내용:
### 1. editArchivedMemo()
- **파라미터**: userName, dateStr, timeStr, originalContent, newContent
- **반환값**: { success: true/false, errorCode: string, message: string }
- **에러 코드**:
  - ERR_DATE_NOT_FOUND: 해당 날짜 없음
  - ERR_CONTENT_NOT_FOUND: 메모 내용 불일치
  - ERR_DUPLICATE_CONTENT: 동일 메모 2개 이상
  - ERR_LOCK_TIMEOUT: Lock 획득 실패
  - ERR_FILE_TOO_SHORT: 파싱 결과 비정상
  - ERR_DATE_HEADER_LOST: 날짜 헤더 손실

### 2. deleteArchivedMemo()
- **파라미터**: userName, dateStr, timeStr, originalContent
- **반환값**: { success: true/false, errorCode: string, backupId: string }

### 3. toggleStrikethroughMemo()
- **파라미터**: userName, dateStr, timeStr, originalContent
- **반환값**: { success: true/false, errorCode: string, newContent: string }
```

**QA 승인 조건**:
- [ ] API 명세서 작성 완료
- [ ] 모든 에러 코드 정의 완료
- [ ] 파라미터 타입 명시 (string, boolean, number)
- [ ] 반환값 구조 명시

---

#### 2. 테스트 계획 수립
```markdown
파일명: TEST_PLAN_judy_note_edit.md

### 단위 테스트 (Unit Test)
- [ ] escapeRegex() - 특수문자 이스케이프
- [ ] findExactMemo() - 정확히 1개 매칭
- [ ] validateFileIntegrity() - 무결성 검증

### 통합 테스트 (Integration Test)
- [ ] 동시성 테스트: 2개 브라우저 탭에서 동시 수정
- [ ] 백업 테스트: 수정 실패 시 백업 유지
- [ ] 파싱 테스트: 동일 시간 2개 메모 존재 시

### E2E 테스트 (End-to-End)
- [ ] 슬랙에서 메모 작성 + 웹에서 수정 (동시 실행)
- [ ] 웹에서 수정 중 네트워크 끊김 시뮬레이션
- [ ] 모바일 환경 (iOS Safari, Android Chrome)
```

**QA 승인 조건**:
- [ ] 테스트 계획 문서 작성 완료
- [ ] 단위/통합/E2E 테스트 케이스 정의
- [ ] 테스트 담당자 지정 (에이다, 허밋, 클로이)

---

#### 3. 로깅 및 모니터링 계획
```markdown
### 로깅 전략
1. MemoEditLog 시트 생성
   - 컬럼: 타임스탬프, 작업, 사용자, 날짜, 시간, 성공여부, 에러코드

2. 모든 수정/삭제 작업 로그 기록
   - 성공/실패 모두 기록
   - Lock 획득 실패도 기록

3. 백업 파일 생성/삭제 로그
   - 백업 파일명, 타임스탬프 기록

### 모니터링 지표
- 일일 수정 요청 수
- Lock 획득 실패 비율
- 파싱 에러 발생 비율
- 백업 파일 유지 건수 (실패 건수)
```

**QA 승인 조건**:
- [ ] MemoEditLog 시트 생성 완료
- [ ] 모든 API에 로깅 코드 추가
- [ ] 주간 모니터링 리포트 양식 작성

---

### Phase 1: 백엔드 개발 (에이다, 허밋)

**예상 기간**: 3~5일

**작업 내용**:
1. `drive_archive.gs` 파일에 다음 함수 추가:
   - `safeUpdateArchivedMemo()` - Lock + 백업 + 검증
   - `findExactMemo()` - 정규식 파싱 + 단일 매칭
   - `validateFileIntegrity()` - 무결성 검증
   - `editArchivedMemo()` - 수정 API
   - `deleteArchivedMemo()` - 삭제 API
   - `toggleStrikethroughMemo()` - 취소선 API

2. 기존 `appendMemoToArchive()` 함수 수정:
   - LockService 적용
   - Timeout 에러 핸들링

**QA 체크리스트 (백엔드)**:
- [ ] Lock 적용 확인 (모든 쓰기 작업)
- [ ] 백업 생성/삭제 로직 확인
- [ ] 무결성 검증 로직 확인
- [ ] 정규식 파싱 정확도 테스트 (100개 샘플)
- [ ] 에러 코드 일관성 확인

---

### Phase 2: 프론트엔드 개발 (클로이)

**예상 기간**: 3~5일

**작업 내용**:
1. `judy_note.html` (또는 `judy_workspace.html`) 수정:
   - 메모 렌더링 리팩토링 (`.memo-block` DOM 파싱)
   - 1-Depth 아이콘 버튼 추가 (호버 시 노출)
   - 인라인 편집 모드 (textarea 토글)
   - 삭제 확인 모달
   - Undo 토스트 (선택 구현)

2. CSS 스타일링:
   - 호버 효과
   - Danger 버튼 스타일
   - 모바일 반응형 (최소 44x44px)

**QA 체크리스트 (프론트엔드)**:
- [ ] 호버 시에만 버튼 노출 확인
- [ ] 삭제 버튼 빨간색 강조 확인
- [ ] 삭제 확인 모달 메시지 명확성
- [ ] 모바일 터치 타겟 크기 확인
- [ ] 에러 메시지 사용자 친화적 표시

---

### Phase 3: 통합 테스트 (전체 팀)

**예상 기간**: 2~3일

**테스트 시나리오**:
1. **동시성 테스트**:
   - 2개 브라우저 탭에서 동시 수정
   - 슬랙 메모 작성 + 웹 수정 동시 실행
   - Lock 획득 실패 시 에러 메시지 확인

2. **백업 테스트**:
   - 수정 중 스크립트 강제 종료 (Timeout 유발)
   - 백업 파일 유지 확인
   - `_FAILED_backup_` 이름 확인

3. **파싱 테스트**:
   - 동일 시간 2개 메모 존재
   - 메모 본문에 타임스탬프 패턴 포함
   - 특수문자, 이모지, 긴 URL 포함

4. **모바일 테스트**:
   - iOS Safari, Android Chrome
   - 터치 타겟 정확성
   - 호버 대신 터치 이벤트 동작

**QA 승인 조건**:
- [ ] 모든 테스트 시나리오 통과
- [ ] 동시성 충돌 발생 확률 < 0.1%
- [ ] 파싱 정확도 > 99%
- [ ] 백업 복원 성공률 100%

---

### Phase 4: 단계적 배포 (Feature Flag)

**배포 전략**:
```javascript
// 초기: 관리자만 접근
const FEATURE_MEMO_EDIT_ENABLED_USERS = ["송용남", "정혜림"];

// 1주 후: 전체 팀원
const FEATURE_MEMO_EDIT_ENABLED_USERS = ["송용남", "정혜림", "이지은", "김개발"];

// 2주 후: 전체 공개
const FEATURE_MEMO_EDIT_ENABLED = true;
```

**QA 모니터링 (1주간)**:
- [ ] 일일 에러율 < 1%
- [ ] Lock 획득 실패 < 5%
- [ ] 사용자 불만 접수 0건
- [ ] 데이터 유실 사고 0건

**롤백 트리거**:
- 데이터 유실 사고 1건 이상 → 즉시 롤백
- 에러율 > 5% → 즉시 롤백
- 사용자 불만 3건 이상 → 재검토 후 결정

---

## 🎯 김감사 최종 의견

### ✅ 승인 사유

1. **Critical Issues 100% 수용**: 동시성, 백업, 파싱 모두 해결책 마련
2. **합리적 타협**: UX 설계는 사용자 승인 + 안전장치 추가
3. **체계적 계획**: Phase 0~4 단계별 계획 명확
4. **리스크 관리**: Feature Flag, 로깅, 모니터링 체계

### ⚠️ 조건부 승인 - 5대 필수 조건

**다음 5가지 완료 시 → 완전 승인**:

1. ✅ **API 명세서 작성** (`API_SPEC_judy_note_edit.md`)
2. ✅ **테스트 계획 수립** (`TEST_PLAN_judy_note_edit.md`)
3. ✅ **MemoEditLog 시트 생성** (로깅 체계)
4. ✅ **UX 안전장치 5가지 구현** (호버, Danger 스타일, 2단계 모달, Undo, 모바일 최적화)
5. ✅ **Feature Flag 적용** (단계적 배포)

**재검토 요청 시점**:
- Phase 1 (백엔드) 완료 후
- Phase 2 (프론트엔드) 완료 후
- Phase 3 (통합 테스트) 완료 후

각 Phase 완료 시 `[QA_재검토_요청]_Phase1_완료.md` 형식으로 문서 작성 후 김감사 호출 바랍니다.

---

## 💡 자비스 팀장에게 드리는 조언

### 칭찬할 점 ✅

1. **빠른 의사결정**: QA 검토 → 합의안 작성 30분 만에 완료
2. **적극적 수용**: Critical Issues를 100% 수용한 자세
3. **명확한 문서화**: 최종 결정 사항을 표로 정리 (가독성 우수)
4. **팀 협업**: 에이다, 허밋, 클로이 역할 분담 명확

### 개선 제안 📝

1. **API 명세서 먼저**: 코드 작성 전 API 명세서부터 작성하세요.
   - 에이다, 허밋, 클로이가 동시 작업 시 인터페이스 충돌 방지
   - 프론트엔드 개발자가 백엔드 완성 전에 Mock API로 선작업 가능

2. **테스트 주도 개발(TDD)**: 함수 작성 전 테스트 케이스 먼저 작성
   - `findExactMemo()` 함수 예시:
     ```javascript
     // 테스트 먼저 작성
     function testFindExactMemo() {
       const testCases = [
         { input: "동일 시간 2개 메모", expected: "ERR_DUPLICATE_CONTENT" },
         { input: "메모 없음", expected: "ERR_CONTENT_NOT_FOUND" },
         { input: "정상 케이스", expected: "success" }
       ];
       // ... 테스트 로직
     }

     // 그 다음 함수 구현
     function findExactMemo(...) { }
     ```

3. **일일 스탠드업**: Phase 1~3 동안 매일 10분 진행 상황 공유
   - 에이다: "오늘 Lock 로직 완성, 내일 백업 로직"
   - 허밋: "오늘 정규식 파싱 완성, 테스트 케이스 50개 통과"
   - 클로이: "오늘 메모 렌더링 리팩토링, 내일 버튼 추가"

4. **코드 리뷰 필수화**: 모든 함수는 최소 1명 리뷰 후 머지
   - 에이다가 Lock 로직 작성 → 허밋 리뷰
   - 허밋이 파싱 로직 작성 → 에이다 리뷰
   - 클로이가 UI 작성 → 자비스 리뷰

5. **포스트모템 작성**: 배포 후 1주일 뒤 회고
   - 잘된 점 (Keep)
   - 개선할 점 (Problem)
   - 다음 액션 (Try)

---

## 📎 참고 자료

- [drive_archive.gs](drive_archive.gs) - 현재 코드 (수정 대상)
- [Google Apps Script LockService](https://developers.google.com/apps-script/reference/lock/lock-service)
- [정규식 테스트 도구](https://regex101.com/)
- [모바일 터치 타겟 가이드](https://web.dev/tap-targets/)

---

## 🎊 최종 결론

**김감사 평가**: 🟢 **조건부 승인 (Conditional Approval)**

자비스 팀장님, **개발 착수를 승인합니다.**

위 5대 필수 조건(API 명세서, 테스트 계획, 로깅 시트, UX 안전장치, Feature Flag)을 준수하며 개발을 진행하시고, 각 Phase 완료 시 재검토 요청 바랍니다.

**기대하는 결과**:
- 데이터 유실 사고 0건
- 사용자 만족도 향상
- 팀 개발 역량 강화

**응원 메시지**:
> "완벽한 계획보다 완벽한 실행이 중요합니다. Phase별로 착실히 진행하시고, 문제가 생기면 즉시 김감사를 호출하세요. 함께 만들어가겠습니다!"

---

**검토 완료**: 김감사
**승인 일시**: 2026-02-26 15:00
**문서 상태**: 🟢 **조건부 승인** - 5대 필수 조건 완료 시 → 완전 승인

**Next Action**: 에이다, 허밋 → Phase 0 (API 명세서 작성) 착수
