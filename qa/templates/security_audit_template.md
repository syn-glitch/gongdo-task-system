# [🛡️ 보안 감사] 기능명 보안 감사 리포트

**QA 담당**: 보안 감사관 (Security Auditor)
**검수일**: YYYY-MM-DD
**대상 파일**: `path/to/file.gs` 또는 `path/to/file.html`
**우선순위**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## 📋 요약 (Executive Summary)

**1-2문장으로 보안 평가 요약**:
- 예: API 키 하드코딩 1건, 인증 우회 가능성 1건 등 총 2개의 Critical 보안 취약점 발견.

---

## 🛡️ 보안 감사 체크리스트

### 1. 인증 및 권한
- [ ] Token 검증 로직이 있는가?
- [ ] Magic Link 만료 시간이 설정되어 있는가?
- [ ] 사용자 권한 체크가 있는가? (관리자 전용 기능)
- [ ] 인증 없이 접근 가능한 API가 있는가?
- [ ] Session/Token 재사용 공격 방어가 있는가?

### 2. API 키 및 민감 정보
- [ ] API 키가 코드에 하드코딩되어 있지 않은가?
- [ ] PropertiesService.getScriptProperties() 사용 여부
- [ ] 환경 변수로 키를 관리하는가?
- [ ] 로그에 API 키가 노출되지 않는가?
- [ ] GitHub/public repository에 키가 커밋되지 않았는가?

### 3. 입력 검증 (XSS, SQL Injection)
- [ ] 사용자 입력이 sanitize/escape 되는가?
- [ ] HTML 태그가 그대로 렌더링되지 않는가?
- [ ] SQL 쿼리에 직접 입력값이 들어가지 않는가? (Prepared Statement)
- [ ] URL 파라미터 검증이 있는가?

### 4. 동시성 제어
- [ ] LockService가 적용되어 있는가?
- [ ] Lock 타임아웃이 설정되어 있는가?
- [ ] Race Condition 가능성은 없는가?
- [ ] 트랜잭션 처리가 원자적(Atomic)인가?

### 5. HTTPS 및 통신 보안
- [ ] 외부 API 호출 시 HTTPS를 사용하는가?
- [ ] HTTP로 민감 정보를 전송하지 않는가?
- [ ] CORS 설정이 적절한가?
- [ ] 중간자 공격(MITM) 방어가 있는가?

### 6. 민감 정보 노출
- [ ] 로그에 비밀번호가 노출되지 않는가?
- [ ] 로그에 개인정보 (이메일, 전화번호)가 노출되지 않는가?
- [ ] 에러 메시지에 내부 구조가 노출되지 않는가?
- [ ] 스택 트레이스가 사용자에게 노출되지 않는가?

### 7. 데이터 검증
- [ ] 파일 업로드 시 파일 타입 검증이 있는가?
- [ ] 파일 크기 제한이 있는가?
- [ ] 이메일 형식 검증이 있는가?
- [ ] URL 형식 검증이 있는가?

---

## ✅ 통과 항목 (Passed)

**보안 기준을 만족하는 항목:**

- ✅ [파일명:라인] 보안 요구사항 설명
- ✅ [파일명:라인] 보안 요구사항 설명

**예시**:
- ✅ [web_app.gs:25-30] PropertiesService를 사용하여 API 키 안전하게 관리
- ✅ [slack_command.gs:100-110] Magic Link 3분 만료 시간 설정됨

---

## 🚨 발견된 취약점 (Vulnerabilities Found)

| 우선순위 | 파일 위치 | 취약점 | 위험도 | 수정안 |
|---------|----------|--------|--------|--------|
| 🔴 Critical | [파일:라인] | 취약점 설명 | 높음 | 수정 방법 |
| 🟠 High | [파일:라인] | 취약점 설명 | 중간 | 수정 방법 |

**예시**:
| 우선순위 | 파일 위치 | 취약점 | 위험도 | 수정안 |
|---------|----------|--------|--------|--------|
| 🔴 Critical | slack_notification.gs:7 | SLACK_TOKEN이 하드코딩되어 GitHub에 노출 | **극심** | PropertiesService로 이동 및 GitHub에서 키 제거 후 재발급 |
| 🟠 High | slack_command.gs:55 | 사용자 입력 sanitize 없이 직접 메시지 전송. XSS 가능성 | 높음 | messageText.replace(/</g, '&lt;') 추가 |

---

## 🔥 위험도 평가

### 🔴 Critical 취약점 (즉시 수정 필요)
**X개 발견**

1. **API 키 노출** ([파일:라인])
   - **영향**: 모든 사용자 데이터 접근 가능, 악의적 API 호출 가능
   - **조치**: 즉시 키 재발급 및 PropertiesService로 이동

2. **인증 우회** ([파일:라인])
   - **영향**: 관리자 권한 없이 민감 기능 접근 가능
   - **조치**: 사용자 권한 체크 추가

---

### 🟠 High 취약점 (긴급 수정 필요)
**X개 발견**

1. **XSS 취약점** ([파일:라인])
   - **영향**: 사용자 세션 탈취 가능
   - **조치**: 입력 sanitize 추가

---

### 🟡 Medium 취약점 (배포 후 추적 관리)
**X개 발견**

---

## 🛠️ 권장 보안 조치

### 즉시 조치 (Critical/High)
1. [ ] API 키 재발급 및 PropertiesService로 이동
2. [ ] 인증 로직 강화 (권한 체크 추가)
3. [ ] 사용자 입력 sanitize 추가

### 장기 개선 (Medium/Low)
1. [ ] HTTPS Strict Transport Security (HSTS) 적용
2. [ ] Content Security Policy (CSP) 헤더 추가
3. [ ] 정기 보안 감사 일정 수립

---

## 📊 보안 점수

**전체 보안 점수**: X / 100

| 영역 | 점수 | 평가 |
|------|------|------|
| 인증/권한 | X/20 | ✅/⚠️/❌ |
| API 키 관리 | X/20 | ✅/⚠️/❌ |
| 입력 검증 | X/20 | ✅/⚠️/❌ |
| 동시성 제어 | X/15 | ✅/⚠️/❌ |
| 통신 보안 | X/15 | ✅/⚠️/❌ |
| 민감 정보 | X/10 | ✅/⚠️/❌ |

**평가 기준**:
- ✅ 우수 (90점 이상)
- ⚠️ 보통 (70-89점)
- ❌ 위험 (70점 미만)

---

## ⚠️ 개선 제안 (Recommendations)

**선택 사항이지만 권장하는 보안 개선:**

- 📌 [파일:라인] 비밀번호 정책 강화 (최소 8자, 특수문자 포함)
- 📌 [파일:라인] 로그인 실패 횟수 제한 (Brute Force 방어)
- 📌 [파일:라인] IP 화이트리스트 적용 (관리자 API)
- 📌 [파일:라인] Rate Limiting 추가 (DDoS 방어)

---

## 🎯 우선순위 분류

- 🔴 **Critical**: X개 (즉시 수정)
- 🟠 **High**: X개 (긴급 수정)
- 🟡 **Medium**: X개 (배포 후 추적)
- 🟢 **Low**: X개 (선택적 개선)

**Total**: X개 취약점

---

## 📝 최종 판정

- [ ] ✅ **승인** (Critical/High 취약점 0개)
- [ ] ⚠️ **조건부 승인** (Medium 취약점만 있음)
- [ ] ❌ **반려** (Critical/High 취약점 1개 이상)

**선택한 판정**: [✅/⚠️/❌]

**사유**:
- 예: Critical 취약점 2개 발견 (API 키 노출, 인증 우회). 즉시 수정 필요.

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Apps Script Security Best Practices](https://developers.google.com/apps-script/guides/security)
- [Slack API Security](https://api.slack.com/authentication/best-practices)

---

**작성자**: 보안 감사관 (Security Auditor)
**작성 시간**: X분
**최종 수정**: YYYY-MM-DD HH:MM
