<!--
 ============================================
 📋 문서 배포 이력 (Deploy Header)
 ============================================
 @file        04_gas_deployment_notes.md
 @version     v1.0.0
 @updated     2026-03-11 (KST)
 @agent       꼼꼼이 (꼼꼼이 문서팀)
 @ordered-by  용남 대표
 @description GAS 배포 200회 제한 및 운영 노트

 @change-summary
   AS-IS: 문서 없음
   TO-BE: GAS 버전 제한, 삭제 방법, clasp 운영 노트 문서화

 @features
   - [추가] GAS 200버전 제한 설명 및 대응
   - [추가] clasp push vs deploy 차이
   - [추가] 버전 삭제 방법
   - [추가] 배포 운영 주의사항

 ── 변경 이력 ──────────────────────────
 v1.0.0 | 2026-03-11 | 꼼꼼이 | 최초 작성
 ============================================
-->

# GAS 배포 200회 제한 & 운영 노트

---
- **문서 버전**: v1.0.0
- **작성일**: 2026-03-11
- **작성자**: 꼼꼼이 (문서팀)
- **대상 독자**: 대표님, 개발자 (민석님)
- **상태**: approved
---

## 1. GAS 버전 200개 제한

### 문제

Google Apps Script는 프로젝트당 **최대 200개 버전(Version)**만 보관할 수 있습니다.
200개를 초과하면 아래 에러가 발생합니다:

```
Cannot create more versions: Script has reached the limit of 200 versions.
```

### 버전이 생성되는 경우

| 동작 | 버전 생성 여부 |
|------|-------------|
| `clasp push` | ❌ 생성 안 함 (코드만 업로드) |
| `clasp deploy` | ✅ 새 버전 생성 |
| `clasp deploy -i {id}` | ✅ 새 버전 생성 (기존 배포 업데이트) |
| Apps Script 에디터 → 배포 관리 → 새 배포 | ✅ 새 버전 생성 |

> **핵심**: `clasp push`는 버전을 만들지 않습니다. `clasp deploy`만 버전을 만듭니다.

---

## 2. 버전 삭제 방법

### CLI로 삭제 (불가)

```bash
# ❌ clasp에는 버전 삭제 명령이 없습니다
clasp version --delete  # 이런 명령 없음
```

Google Apps Script API도 버전 삭제 엔드포인트를 제공하지 않습니다.

### Apps Script 에디터에서 수동 삭제 (가능)

1. https://script.google.com 접속
2. 해당 프로젝트 열기
3. 좌측 메뉴 → **프로젝트 설정** (톱니바퀴 아이콘)
4. 아래로 스크롤 → **버전** 섹션
5. 불필요한 구버전 선택 → **삭제**

> **주의**: 현재 활성 배포에 연결된 버전은 삭제하지 마세요.

### 삭제 기준 권장

| 삭제 대상 | 보존 대상 |
|----------|----------|
| 3개월 이상 된 구버전 | 현재 활성 배포 버전 |
| 테스트/실험 버전 | 최근 10개 버전 |
| 중간 디버깅 버전 | 중요 마일스톤 버전 |

---

## 3. clasp push vs clasp deploy

### clasp push

```bash
clasp push
```

- GAS 프로젝트에 **코드만 업로드** (덮어쓰기)
- 버전 생성 없음
- 기존 배포(웹 앱 URL)에는 영향 없음
- **개발 중 자주 사용** (코드 올리고 테스트)

### clasp deploy

```bash
# 새 배포 생성
clasp deploy --description "v3.2.0 버그 수정"

# 기존 배포 업데이트 (배포 ID 지정)
clasp deploy -i AKfycbx... --description "v3.2.1 핫픽스"
```

- 새 **버전**을 생성하고 해당 버전에 배포 연결
- 웹 앱 URL의 실제 코드가 업데이트됨
- `clasp push` 후 `clasp deploy`로 반영

### 일반적인 배포 순서

```bash
# 1. 코드 수정 후 업로드
clasp push

# 2. 배포 목록 확인
clasp deployments

# 3. 기존 배포 업데이트 (ID 확인 후)
clasp deploy -i {DEPLOYMENT_ID} --description "설명"
```

---

## 4. 현재 프로젝트 배포 구조

### clasp 설정 파일

**위치**: `src/gas/.clasp.json`

```json
{
  "scriptId": "...",
  "rootDir": "."
}
```

- `rootDir`: `src/gas/` 디렉토리가 GAS 프로젝트의 루트
- `clasp push` 시 이 디렉토리의 `.gs`, `.html` 파일이 업로드됨

### appsscript.json

**위치**: `src/gas/appsscript.json`

```json
{
  "timeZone": "Asia/Seoul",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

> **중요**: 이 파일은 자동 수정 대상에서 제외되어 있습니다 (보안 게이트).

---

## 5. 200버전 도달 방지 전략

### 5.1 push만 사용하고 deploy는 최소화

```bash
# 개발 중: push만 (버전 안 만듦)
clasp push

# 확정 배포 시에만: deploy (버전 만듦)
clasp deploy -i {ID} --description "v3.2.0"
```

### 5.2 주기적 버전 정리

- **월 1회** Apps Script 에디터에서 구버전 정리
- 최근 10~20개 버전만 유지
- 활성 배포 버전은 절대 삭제하지 않음

### 5.3 배포 버전 기록

배포할 때마다 아래 정보를 기록해두면 관리에 도움됩니다:

```
| 날짜 | 버전 | 배포 ID | 설명 |
|------|------|---------|------|
| 2026-03-11 | v45 | AKfycbx... | 슬랙 배포 버튼 기능 추가 |
```

---

## 6. 실제 경험 (2026-03-10)

### 발생한 상황

`clasp deploy`를 반복 실행하여 200버전 한도에 도달.
에러: `Cannot create more versions`

### 해결 과정

1. Apps Script 에디터 접속
2. 프로젝트 설정 → 버전 섹션
3. 구버전 약 100개 수동 삭제
4. 이후 `clasp deploy` 정상 동작

### 교훈

- `clasp push`로 충분한 경우 `clasp deploy`를 하지 않는다
- 배포가 필요하면 기존 배포 ID에 `-i` 옵션으로 업데이트한다
- 월 1회 구버전 정리를 습관화한다

---

## 7. 파이프라인과의 관계

자동화 파이프라인에서 PR이 머지되어도 **GAS 배포는 자동으로 되지 않습니다**.

```
PR 머지 (GitHub) → git pull (로컬) → clasp push → clasp deploy (수동)
```

이유:
- GAS 배포는 `clasp` CLI로만 가능
- GitHub Actions에서 `clasp push`를 자동화하면 보안 위험 (GAS 프로젝트 전체 접근)
- 따라서 배포는 대표님/개발자가 수동으로 진행

### PR 머지 후 GAS 반영 절차

```bash
# 1. 최신 코드 받기
cd "공도 업무 관리"
git pull origin main

# 2. GAS 프로젝트에 코드 업로드
cd src/gas
clasp push

# 3. (필요 시) 배포 업데이트
clasp deploy -i {DEPLOYMENT_ID} --description "이슈 #19 수정 반영"
```
