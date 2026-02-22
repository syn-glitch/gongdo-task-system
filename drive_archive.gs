/**
 * ============================================================================
 * [파일명]: drive_archive.gs
 * [마지막 업데이트]: 2026년 02월 22일 10:15 (KST)
 * [기능]: 슬랙 DM 텍스트를 구글 드라이브의 유저별/월별 마크다운(.md) 파일에 Append
 * ============================================================================
 */

// 🌟 [설정] 아카이브가 저장될 최상위(Root) 폴더 ID를 여기에 입력하세요.
// 드라이브 웹에서 폴더를 열고 URL의 'folders/' 뒤에 있는 영문숫자가 ID입니다.
const ARCHIVE_ROOT_FOLDER_ID = "1bA6ZTxDDpvTUGG0FR9V0qW8UCzmC-3vF"; 

/**
 * [핵심 함수] 구글 드라이브에 메모를 일자별 마크다운으로 추가합니다.
 * @param {string} userName - 슬랙 유저의 실제 이름 (예: 송용남)
 * @param {string} memoText - 슬랙 DM으로 보낸 원문 텍스트
 */
function appendMemoToArchive(userName, memoText) {
  if (!ARCHIVE_ROOT_FOLDER_ID || ARCHIVE_ROOT_FOLDER_ID === "여기에_루트_폴더_ID를_넣어주세요") {
    console.error("⛔ 구글 드라이브 ROOT 폴더 ID가 설정되지 않았습니다.");
    return false;
  }

  try {
    const rootFolder = DriveApp.getFolderById(ARCHIVE_ROOT_FOLDER_ID);
    
    // 1. 유저별 폴더 찾기 (없으면 생성)
    let userFolder = null;
    const folderIter = rootFolder.getFoldersByName(userName);
    if (folderIter.hasNext()) {
      userFolder = folderIter.next();
    } else {
      userFolder = rootFolder.createFolder(userName);
    }
    
    // 2. 이번 달 파일명 (예: 2026-02_업무일지.md)
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}_업무일지.md`;
    
    // 3. 파일 찾기 (없으면 생성)
    let mdFile = null;
    const fileIter = userFolder.getFilesByName(currentMonthStr);
    if (fileIter.hasNext()) {
      mdFile = fileIter.next();
    } else {
      mdFile = userFolder.createFile(currentMonthStr, `# ${userName}의 단기 업무 메모장 (${currentMonthStr.split('_')[0]})\n\n`);
    }
    
    // 4. 기존 내용 읽어오고 맨 아래 이어붙이기 (Append)
    const existingContent = mdFile.getBlob().getDataAsString();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} (${getDayString(now.getDay())})`;
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "hh:mm a");
    
    // 날짜 헤더(`## 2026-02-22 (일)`)가 오늘 이미 추가되어 있는지 확인
    let newContent = existingContent;
    const dateHeader = `\n## ${dateStr}\n`;
    if (!existingContent.includes(`## ${dateStr}`)) {
      newContent += dateHeader; // 오늘 처음 쓰는 거면 날짜 헤더 추가!
    }
    
    // 메모 내용을 불릿 리스트로 추가
    newContent += `- **[${timeStr}]**\n  ${memoText.replace(/\n/g, '\n  ')}\n\n`; 
    
    // 파일 덮어쓰기 (구글 드라이브 스크립트 특성상 덮어쓰기가 권장됨)
    mdFile.setContent(newContent);
    Logger.log(`✅ [${userName}] 메모 아카이브 저장 완료`);
    return true;

  } catch (error) {
    console.error("🔥 구글 드라이브 아카이브 에러: ", error);
    return false;
  }
}

/**
 * 날짜 숫자를 한글 요일로 변환
 */
function getDayString(dayNum) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[dayNum];
}
