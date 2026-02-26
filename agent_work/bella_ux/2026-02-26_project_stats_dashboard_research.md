# [벨라 디자인 가이드] 프로젝트 통계 대시보드 리서치 보고서

**작성자**: 벨라 (UX/UI Designer)
**수신자**: 팀장님, 자비스 (PO)
**날짜**: 2026-02-26
**상태**: ✅ 리서치 완료 / 시안 제안 중

---

## 🔍 1. 글로벌 AI 트렌드 리서치 (OpenAI, Perplexity, Notion 중심)

팀장님의 요청에 따라 최신 AI 에이전트 서비스들의 대시보드 트렌드를 분석했습니다. 주요 인사키워드는 **'Hyper-Personalization(초개인화)'**와 **'Generative UI(생성형 UI)'**입니다.

### 💡 주요 벤치마킹 포인트
- **OpenAI (Fluid UI)**: 고정된 그리드보다 데이터의 성격에 따라 유연하게 변하는 인터페이스. 단순 수치 나열이 아닌 '맥락' 중심의 요약 제공.
- **Perplexity (Interactive Insight)**: 사용자가 질문하기 전 AI가 먼저 데이터의 이상징후(Anomaly)를 감지해 대시보드 상단에 넛지(Nudge) 형태로 띄워주는 방식.
- **Notion (Minimalist Visualization)**: 화려함보다는 정보의 위계(Hierarchy)를 명확히 하여 인지 부하를 줄이는 클린 디자인.

---

## 🎨 2. 주디 워크스페이스 대시보드 시각적 제안

우리 서비스의 프리미엄 가치를 높이기 위해 **'Dark Mode & Neon Gradient'** 스타일을 제안합니다.

### 🖼️ 시각적 시안 (Bella's Proposal)
![Project Dashboard Mockup](project_dashboard_mockup_bella_1772097991788.png)

### ✨ 핵심 디자인 요소 (Key Elements)
1. **Overall Project Completion**: 중앙에 거대한 Circular Progress를 배치하여 '전체 진척도'를 1초 만에 파악. (AI 예측 데이터 포함)
2. **Team Workload Distribution**: 누가 과부하 상태인지 가로 바 차트로 시각화. (협업 위임 의사결정 지원)
3. **At Risk Projects (Glow Card)**: 마감 임박 또는 이슈가 발생한 프로젝트를 네온 글로우(Glow) 효과가 들어간 카드로 강조하여 즉각적인 집중 유도.
4. **AI Insights & Recommendations**: 우측 하단에 주디 AI가 분석한 '오늘의 권장 조치' 영역을 마련하여 단순 통계를 넘어선 액션 제안.

---

## 🚀 3. 자비스(PO) 협업 요청 사항

벨라가 제안한 위 시안을 실제 데이터로 구현하기 위해 자비스님께 다음 데이터 가공을 요청합니다.
- `Tasks` 시트의 상태값(대기/진행/완료)을 프로젝트별 % 수치로 환산하는 로직.
- 담당자별 업무 개수를 카운트하여 'Workload' 데이터 추출.
- 마감일 D-Day가 3일 이내인 업무가 포함된 프로젝트 필터링.

---

**벨라의 의견**:
"단순히 시트의 숫자를 그래프로 옮기는 것이 아니라, 팀장님이 대시보드를 열었을 때 **'어디에 집중해야 할지' AI가 시각적으로 가이드해 주는 느낌**을 구현하고자 합니다. 시안의 네온 컬러는 '비상 상황'과 '정상 진행'을 극명하게 대비시켜 인지 효율을 극대화할 것입니다."
