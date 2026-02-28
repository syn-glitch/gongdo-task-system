# 🗑️ 에이전트 문서 클린업 및 단일화 작업 (Agent Docs Cleanup & Unification)

## 📌 업무 형태 분석
지금 팀장님께서 요청하신 업무는 **SSOT(Single Source of Truth, 단일 진실 공급원) 확보** 작업입니다.
최신 버전의 '에이전트 별 설계서 및 하네스 기반 인프라 설계서'가 공식 디렉토리(teams 및 docs)에 배치되었으므로, 과거에 생성되었던 초안, 중복 문서, 혹은 구버전의 팀 아키텍처 문서들을 완전히 삭제하여 다른 에이전트들이 오래된 지침(가이드)을 참고하여 시스템이 오작동하는 리스크를 방지하는 중대한 인프라 정리 작업입니다.

## 🎯 작업 목표
- 현재까지 분산되고 파편화되어 있던 과거 AI Agent 관련 `.md` 문서들을 모두 식별.
- 최신화된 `TEAM_DESIGN.md`와 `COMMON_HARNESS_INFRA.md`만을 유일한 참조 문서로 남김.
- 식별된 불필요/구버전 문서를 완전히 삭제(Delete) 및 깃허브 반영.

## 📋 단계별 실행 계획 (Task Plan)

- [ ] **Step 1: 깃허브 업로드 링크 보고**
  - 방금 `main` 브랜치에 Push된 최신 에이전트 설계서들의 GitHub Repository URL 링크 제공.
- [ ] **Step 2: 삭제 대상 문서 색출 (Identification)**
  - `archive/`, `docs/architecture/` 등에 산재한 구버전 에이전트 문서들 리스트업 및 삭제 사유 명시.
- [x] **Step 3: 팀장님 Confirm (승인 대기)**
  - 팀장님이 "삭제"라고 말씀하실 때까지 대기.
- [x] **Step 4: 문서 영구 삭제 및 Git Commit (Execution)**
  - 승인이 떨어지면 대상 파일들을 모두 삭제 후 Github에 Push하여 저장소 정리 완료.
