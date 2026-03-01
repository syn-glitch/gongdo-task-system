# DOC-2026-03-02-001 — 완료 보고서 팀원 추적 + 토큰 사용량 기록 규칙 추가

---
- **태스크 ID**: DOC-2026-03-02-001
- **지시일**: 2026-03-02
- **담당팀**: 꼼꼼이 문서팀
- **담당자**: 꼼꼼이 (팀장)
- **상태**: ✅ 완료
- **승인**: ✅ 대표 승인 (2026-03-02)
---

## 지시 원문

> 1. 각 팀이 업무를 마무리하면 생성되는 업무 보고 문서에 에이전트 각 팀원이 진행한 내용을 작성하게해줘
> 2. 최종 마무리 보고할때, 에이전트 팀이 사용한 토큰을 나한테 보고해줘
> 3. 사용한 토큰은 팀 문서에도 남겨줘
> - 토큰은 근사치로 보고
> - TOKEN_USAGE_LOG.md는 각 팀 폴더 루트에 배치

## 팀장 이해 요약

- **핵심 요청**: 완료 보고서에 팀원별 수행 내역 + 토큰 사용량 추가, 토큰 누적 기록 체계 구축
- **작업 범위**: COMMON_RULES.md completion_report 규칙 확장, 5개 설계서 인라인 블록 반영, TOKEN_USAGE_LOG.md 템플릿 생성
- **완료 기준**: 모든 에이전트가 완료 보고 시 팀원별 내역과 토큰을 자동 보고하고, 팀 폴더에 누적 기록

## 작업 단계

- [x] 단계 1: COMMON_RULES.md `<completion_report>` 규칙에 【팀원별 수행 내역】 섹션 추가
- [x] 단계 2: COMMON_RULES.md `<completion_report>` 규칙에 【토큰 사용량】 섹션 추가
- [x] 단계 3: COMMON_RULES.md에 토큰 누적 기록 규칙 추가 (TOKEN_USAGE_LOG.md 업데이트 의무)
- [x] 단계 4: 5개 설계서 인라인 `<common_rules>` 블록 21개소 업데이트
- [x] 단계 5: TOKEN_USAGE_LOG.md 템플릿 생성 → 5개 팀 폴더에 배치
- [x] 단계 6: 변경 이력 업데이트 + 검증

## 산출물

| 산출물 | 파일 경로 | 상태 |
|--------|----------|------|
| COMMON_RULES.md v1.5 | GD_Agent_teams/COMMON_RULES.md | ✅ 완료 |
| jarvis-dev_DESIGN.md | GD_Agent_teams/jarvis-dev/jarvis-dev_DESIGN.md | ✅ 완료 |
| kim-qa_DESIGN.md | GD_Agent_teams/kim-qa/kim-qa_DESIGN.md | ✅ 완료 |
| gangcheol-ax_DESIGN.md | GD_Agent_teams/gangcheol-ax/gangcheol-ax_DESIGN.md | ✅ 완료 |
| bunker_DESIGN.md | GD_Agent_teams/bunker/bunker_DESIGN.md | ✅ 완료 |
| kkoomkkoom-docs_DESIGN.md | GD_Agent_teams/kkoomkkoom-docs/kkoomkkoom-docs_DESIGN.md | ✅ 완료 |
| TOKEN_USAGE_LOG.md (x5) | GD_Agent_teams/[각 팀 폴더]/TOKEN_USAGE_LOG.md | ✅ 완료 |

## 위임 사항

| 위임 대상 팀 | 전달 내용 | 상태 |
|-------------|----------|------|
| 해당 없음 | | |

## 변경 이력

| 날짜 | 변경 내용 | 변경자 |
|------|----------|--------|
| 2026-03-02 | 최초 생성 | 꼼꼼이 |
