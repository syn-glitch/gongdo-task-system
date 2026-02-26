# SYSTEM ARCHITECTURE: 주디 워크스페이스 (Judy Workspace)

**최종 업데이트**: 2026-02-26
**작성자**: Antigravity (PO/Architect)

---

## 🏗 전체 시스템 개요
본 시스템은 Google Apps Script(GAS)를 백엔드로 사용하며, 주 데이터 저장소로 Google Sheets와 Drive를 활용하는 서버리스 협업 툴입니다.

### 1. 프론트엔드 (Frontend)
- **주디 슬랙봇 (Slack Bot)**: 가벼운 접수 창구 및 확성기 역할.
- **주디 워크스페이스 (Web Workspace)**: HTML5 SPA 기반의 딥 다이브 관리 공간.

### 2. 백엔드 (Backend - Google Apps Script)
- **web_app.gs**: 웹 클라이언트와의 통신 및 데이터 처리 (doGet, API).
- **slack_command.gs**: 슬랙 인터랙티브 모달 및 명령어 처리.
- **ai_report.gs / ai_task_parser.gs**: Claude 3 API 연동 AI 엔진.
- **drive_archive.gs**: 마크다운 파일 입출력 관리.
- **calendar_sync.gs**: 구글 캘린더 실시간 동기화.

### 3. 데이터 계층 (Data Layer)
- **Google Sheets**: Tasks(업무), Projects(프로젝트), Users(유저), ActionLog(로그).
- **Google Drive**: 마크다운 메모 아카이브 저장소.
- **Google Calendar**: 업무 마감일 기반 일정 동기화.

---

## 🔒 보안 및 안전 장치
1. **Magic Link Auth**: 슬랙 개인 DM을 통한 1회용 토큰 인증 (보안 강화).
2. **LockService**: 다중 접속 및 슬랙-웹 수시 충돌 방지를 위한 동시성 제어.
3. **CacheService**: 빈번한 시트 읽기 부하 감소 및 성능 최적화.
4. **ActionLog**: 모든 데이터 변경 이력 영구 기록.

---

## 📈 성능 최적화 (Optimizations)
- **캐싱 전략**: `getAllTasksForWeb` 등 무거운 조회 시 2~5분 캐싱 적용.
- **Optimistic UI**: 비동기 등록 후 프론트엔드 단에서 캐시 파기 유도.
- **이미지 최적화**: 드라이브 내 대용량 미디어 처리 분리 (향후 계획).
