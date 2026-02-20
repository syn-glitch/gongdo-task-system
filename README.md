# 공도 업무 관리 시스템 (Gongdo Task Management System)

## 프로젝트 개요
이 프로젝트는 비전공자 팀원들도 쉽게 업무를 관리하고 공유할 수 있도록 **슬랙(Slack)**, **구글 스프레드시트(Google Sheets)**, **구글 캘린더(Google Calendar)**, **AI(Claude)**를 유기적으로 연결한 통합 업무 시스템입니다.

**핵심 목표:**
- **접근성:** 익숙한 슬랙과 구글 시트를 인터페이스로 사용
- **자동화:** Apps Script(GAS)를 통한 ID 생성, 알림, 리포팅 자동화
- **확장성:** 향후 AI 에이전트 도입을 고려한 데이터 구조 설계

## 시스템 아키텍처
1. **데이터베이스:** 구글 스프레드시트 (`Tasks`, `Projects`, `Users`)
2. **백엔드:** Google Apps Script (GAS)
3. **인터페이스:** 슬랙 (Slash Command, Modal, Webhook)
4. **일정:** 구글 캘린더 API

## 설치 및 설정 가이드

### 1단계: 구글 스프레드시트 설정
1. 새 구글 스프레드시트 생성
2. `확장 프로그램` > `Apps Script` 메뉴 선택
3. `setup_structure.gs` 코드 복사 & 붙여넣기 후 실행 -> **시트 구조 자동 생성**
4. `auto_automation.gs` 코드 복사 & 붙여넣기 -> **업무 ID 자동 생성 및 타임스탬프 기능 활성화**

## 파일 구조
- `README.md`: 프로젝트 설명서
- `task.md`: 개발 로드맵 및 진행 상황
- `implementation_plan.md`: 상세 구현 계획 및 DB 설계서
- `setup_structure.gs`: (v1.1) 시트 구조 자동 생성 스크립트
- `auto_automation.gs`: (v1.0) 업무 ID 생성 및 자동화 스크립트

## 개발 히스토리
- **2026-02-20**: 프로젝트 초기화 및 1단계(DB 구축) 완료.
  - 시트 구조 확정 (Tasks, Projects, Users)
  - Apps Script 2종 개발 완료 (구조 생성, 자동화)
