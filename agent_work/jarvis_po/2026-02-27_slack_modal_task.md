# 슬랙 모달 타임아웃 핫픽스 v3.0 작업 목록

---

## 🛠 작업 내용 (코드 수정 목록)

1. [x] **캐시 워밍업 함수 추가**: `slack_command.gs` 최하단에 `warmupProjectCache()` 함수를 추가 (10분 스케줄링용).
2. [x] **PropertiesService 부분 교체**: 모달 제출 시 `handleModalSubmission()` 내에서 `PropertiesService`로는 식별자만 기록하고 큰 JSON 페이로드는 `CacheService`에 저장하여 300~1000ms 지연 현상 제거.
3. [x] **백그라운드 처리 함수 수정**: `processAsyncTasks()` 내에서 `PropertiesService`를 루프 돌려 키를 찾고 `CacheService`에서 실제 데이터를 읽어오도록 수정(데이터 파싱 대응).
4. [x] **Optimistic UI 추가**: 모달 폼 전송에 성공하면 `update` response_action을 사용해 제출 모달창의 내용이 "등록 중..."이라는 안내 블록으로 변하도록 수정(UX 강화).

## 🚀 배포 체크리스트

1. [x] `slack_command.gs` 업데이트된 버전(`2026-02-27_slack_command_hotfix_v3.gs` 파일로) 익스포트.
2. [x] 팀장님께 검토 요청 및 수동 트리거 세팅(warmupProjectCache 10분, 등) 가이드 안내.
