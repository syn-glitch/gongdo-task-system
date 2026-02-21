/**
 * [파일명]: auto_dashboard.gs
 * [기능 설명]: 사용자가 커스텀 메뉴에서 '대시보드 자동 생성'을 클릭하면
 *             'Tasks' 시트의 데이터를 읽어와 'Dashboard' 시트에 
 *             차트(원형, 막대형)와 요약표를 자동으로 그려줍니다.
 */

function generateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName("Tasks");
  
  if (!taskSheet) {
    SpreadsheetApp.getUi().alert("⚠️ 'Tasks' 시트가 존재하지 않아 대시보드를 생성할 수 없습니다.");
    return;
  }

  // 1. Dashboard 시트 초기화 (기존 시트가 있으면 삭제 후 재생성)
  let dashboardSheet = ss.getSheetByName("Dashboard");
  if (dashboardSheet) {
    ss.deleteSheet(dashboardSheet);
  }
  dashboardSheet = ss.insertSheet("Dashboard");
  
  // 탭 색상 변경 (눈에 띄게)
  dashboardSheet.setTabColor("#4285F4");
  
  // 2. Tasks 시트 데이터 가져오기
  const lastRow = taskSheet.getLastRow();
  if (lastRow < 2) {
    dashboardSheet.getRange("A1").setValue("등록된 업무 데이터가 없습니다.");
    return;
  }
  
  const data = taskSheet.getRange(2, 1, lastRow - 1, 14).getValues();
  
  // 3. 통계 데이터 계산
  // 상태별 개수 집계
  const statusCounts = { "대기": 0, "진행중": 0, "완료": 0, "보류": 0 };
  // 담당자별 진행/대기 업무 개수 집계
  const assigneeCounts = {};
  
  data.forEach(row => {
    const status = row[2]; // C열 (상태)
    const assignee = row[6]; // G열 (담당자)
    
    // 상태 카운트
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
    
    // 담당자 카운트 (이름이 있고, 완료/보류가 아닌 실질적 업무량)
    if (assignee && (status === "대기" || status === "진행중")) {
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    }
  });

  // 4. 대시보드 시트에 요약 테이블 (차트의 소스 데이터) 먼저 그리기
  // (A열~B열: 상태 통계)
  dashboardSheet.getRange("A1").setValue("📊 전체 업무 상태 현황").setFontWeight("bold").setFontSize(14);
  dashboardSheet.getRange("A2").setValue("상태");
  dashboardSheet.getRange("B2").setValue("업무 수");
  
  let rowIdx = 3;
  for (const [status, count] of Object.entries(statusCounts)) {
    dashboardSheet.getRange(rowIdx, 1).setValue(status);
    dashboardSheet.getRange(rowIdx, 2).setValue(count);
    rowIdx++;
  }
  
  // (D열~E열: 담당자 통계)
  dashboardSheet.getRange("D1").setValue("👥 담당자별 잔여 업무량 (대기/진행중)").setFontWeight("bold").setFontSize(14);
  dashboardSheet.getRange("D2").setValue("담당자");
  dashboardSheet.getRange("E2").setValue("할당량");
  
  let rowIdx2 = 3;
  for (const [assignee, count] of Object.entries(assigneeCounts)) {
    dashboardSheet.getRange(rowIdx2, 4).setValue(assignee);
    dashboardSheet.getRange(rowIdx2, 5).setValue(count);
    rowIdx2++;
  }
  // 만약 담당자가 한 명도 없으면 임시 빈줄 생성 (차트 오류 방지)
  if (rowIdx2 === 3) {
    dashboardSheet.getRange("D3").setValue("진행중인 담당자 없음");
    dashboardSheet.getRange("E3").setValue(0);
    rowIdx2 = 4;
  }

  // 5. 차트 (Chart) 동적 생성 영역
  
  // 5-1. 상태 파이 차트 생성 (데이터 소스: A2 ~ B[마지막])
  const pieChartBuilder = dashboardSheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dashboardSheet.getRange(`A2:B${rowIdx - 1}`))
    .setPosition(2, 7, 0, 0) // G2 셀 즈음에 배치
    .setOption("title", "전체 업무 상태 분포")
    .setOption("pieHole", 0.4) // 도넛형
    .setOption("colors", ["#FBBC04", "#4285F4", "#34A853", "#EA4335"]) // 대기(노), 진행(파), 완료(초), 보류(빨) 색 매칭
    .build();
    
  dashboardSheet.insertChart(pieChartBuilder);
  
  
  // 5-2. 담당자별 할당량 막대 차트 생성 (데이터 소스: D2 ~ E[마지막])
  const barChartBuilder = dashboardSheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dashboardSheet.getRange(`D2:E${rowIdx2 - 1}`))
    .setPosition(18, 7, 0, 0) // 파이 차트 아래쯤에 배치
    .setOption("title", "담당자별 잔여 업무 로드")
    .setOption("legend", {position: "none"}) // 범례 숨김
    .setOption("hAxis", {title: "담당자 이름"})
    .setOption("vAxis", {title: "업무 수", minValue: 0})
    .build();
    
  dashboardSheet.insertChart(barChartBuilder);
  
  // 6. 미관상 깔끔하게 정리 (눈금선 제거, 열 너비 조절)
  dashboardSheet.setHiddenGridlines(true); // 눈금선 숨기기
  dashboardSheet.autoResizeColumns(1, 5); // 데이터 있는 열 자동 너비 조절 
  
  SpreadsheetApp.getUi().toast("✅ 대시보드 생성이 완료되었습니다!", "성공", 3);
}
