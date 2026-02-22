/**
 * ============================================================================
 * [파일명]: drive_archive.gs
 * [마지막 업데이트]: 2026-02-22 13:21 (KST)
 * [기능]: 슬랙 DM 텍스트를 구글 드라이브의 유저별/월별 마크다운(.md) 파일에 Append
 * [최근 개편]: 저장 로직 외에 과거 아카이브 문서를 트리형 JSON으로 변환하는 getArchivedMemos 함수 추가
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
function appendMemoToArchive(userName, memoText, userId) {
  // 슬랙으로 실시간 상태 전송용 헬퍼 함수
  const sendDebugLog = (msg) => {
    if (!userId) return;
    try {
      const props = PropertiesService.getScriptProperties();
      const token = props.getProperty("SLACK_TOKEN") || (typeof SLACK_TOKEN !== 'undefined' ? SLACK_TOKEN : "");
      if(!token) return;
      UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
        method: "post", contentType: "application/json", headers: { "Authorization": "Bearer " + token },
        payload: JSON.stringify({ channel: userId, text: msg }), muteHttpExceptions: true
      });
    } catch(e) {}
  };

  sendDebugLog("📡 `[시스템 진입]` 구글 드라이브 저장 기능이 방금 호출되었습니다!");

  if (!ARCHIVE_ROOT_FOLDER_ID || ARCHIVE_ROOT_FOLDER_ID === "여기에_루트_폴더_ID를_넣어주세요") {
    sendDebugLog("❌ `[에러]` 구글 드라이브 ROOT 폴더 ID가 없습니다!");
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
    
    // 3. 파일 찾기 (Google Doc 중복 방지: MIME 타입으로 필터링)
    let mdFile = null;
    const fileIter = userFolder.getFilesByName(currentMonthStr);
    while (fileIter.hasNext()) {
      const f = fileIter.next();
      // "Google 문서로 열기" 시 생성되는 Google Doc은 건너뛰고 원본 텍스트 파일만 사용
      if (f.getMimeType() !== 'application/vnd.google-apps.document') {
        mdFile = f;
        break;
      }
    }
    if (!mdFile) {
      mdFile = userFolder.createFile(currentMonthStr, `# ${userName}의 단기 업무 메모장 (${currentMonthStr.split('_')[0]})\n\n`);
    }
    
    // 4. 기존 내용 읽어오고 맨 아래 이어붙이기 (Append)
    const existingContent = mdFile.getBlob().getDataAsString();
    const tz = Session.getScriptTimeZone();
    
    const year = Utilities.formatDate(now, tz, "yyyy");
    const month = Utilities.formatDate(now, tz, "MM");
    const date = Utilities.formatDate(now, tz, "dd");
    
    // 날짜 정보를 한국 기준 요일로 정확히 가져옵니다
    // Utilities.formatDate(now, tz, "E") 는 'Sun', 'Mon' 같은 영문을 반환하므로 한글 변환
    const dayStr = getDayStringFromDate(now, tz); 
    
    const dateStr = `${year}-${month}-${date} (${dayStr})`;
    const timeStr = Utilities.formatDate(now, tz, "hh:mm a");
    
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
    sendDebugLog("✅ `[저장 완료]` 구글 드라이브 폴더에 마크다운 파일이 완벽하게 생성되었습니다!");
    return true;

  } catch (error) {
    console.error("🔥 구글 드라이브 아카이브 에러: ", error);
    sendDebugLog("🔥 `[치명적 에러]` 폴더 스크립트 도중 폭발함: " + error.toString());
    return false;
  }
}

/**
 * 날짜 숫자를 한글 요일로 변환
 * @param {Date} date
 * @param {string} tz - Timezone
 */
function getDayStringFromDate(date, tz) {
  // 요일만 숫자로 뽑을 때도 TimeZone의 영향을 받을 수 있으니 우회 방식 사용
  const eStr = Utilities.formatDate(date, tz, "E"); // Sun, Mon, Tue...
  const daysMap = {
    "Sun": "일", "Mon": "월", "Tue": "화", "Wed": "수", "Thu": "목", "Fri": "금", "Sat": "토"
  };
  return daysMap[eStr] || "일";
}

/**
 * 🚨 [필수 권한 부여용 함수]
 * 구글 드라이브(DriveApp)를 백그라운드에서 조작하려면 최초 1회 수동 권한 승인이 필요합니다.
 * 편집기 상단 화살표(▶) 오른쪽의 함수 선택창에서 'testDriveAuth'를 선택 후 [실행] 버튼을 누르세요.
 */
function testDriveAuth() {
  Logger.log("구글 드라이브 접근 권한을 확인합니다...");
  try {
    const folder = DriveApp.getFolderById(ARCHIVE_ROOT_FOLDER_ID);
    Logger.log("✅ 권한 승인 완료! 폴더 연결 성공: " + folder.getName());
  } catch (e) {
    Logger.log("❌ 에러: " + e.message);
  }
}

/**
 * 🚨 [가장 강력한 권한 강제 승인 함수]
 * 이 함수는 폴더를 임시로 "생성"하여 구글이 강제로 [파일 쓰기/생성] 권한을 완전히 붇도록 만듭니다.
 */
function forceDriveAuth() {
  // 쓰기 권한을 강제로 요구하기 위해 임시 폴더를 만들었다가 곧바로 휴지통에 넣습니다.
  const tempFolder = DriveApp.createFolder("주디_권한인증용_임시폴더");
  tempFolder.setTrashed(true); 
  
  SpreadsheetApp.getUi().alert("✅ 완벽한 드라이브 쓰기/생성 권한 승인이 완료되었습니다!\n이제 앱스 스크립트에서 봇을 '새 버전'으로 딱 한 번만 더 배포해 주세요.");
}

/**
 * 프론트엔드에서 사용자 선택 시 기존 메모들을 폴더 트리 구조로 파싱해 반환합니다.
 */
function getArchivedMemos(userName) {
  if (!ARCHIVE_ROOT_FOLDER_ID || ARCHIVE_ROOT_FOLDER_ID === "여기에_루트_폴더_ID를_넣어주세요") {
    return [];
  }
  
  try {
    const rootFolder = DriveApp.getFolderById(ARCHIVE_ROOT_FOLDER_ID);
    const folderIter = rootFolder.getFoldersByName(userName);
    if (!folderIter.hasNext()) return [];
    
    const userFolder = folderIter.next();
    const fileIterAll = userFolder.getFiles();
    const result = [];
    
    while(fileIterAll.hasNext()) {
      const file = fileIterAll.next();
      const fileName = file.getName();
      let content = "";
      let monthPrefix = "";
      
      if (file.getMimeType() === 'application/vnd.google-apps.document' && fileName.includes("_업무일지")) {
        monthPrefix = fileName.replace("_업무일지", "");
        try {
          content = DocumentApp.openById(file.getId()).getBody().getText();
        } catch(e) {
          console.error("구글 문서 파싱 실패: ", e);
          continue;
        }
      } else if (fileName.endsWith("_업무일지.md")) {
        monthPrefix = fileName.replace("_업무일지.md", "");
        content = file.getBlob().getDataAsString();
      } else {
        continue;
      }
      
      const blocks = content.split(/\n## /g);
      const days = [];
      
      for (let i = 1; i < blocks.length; i++) {
         const dayBlock = blocks[i];
         const lines = dayBlock.split('\n');
         const dateStr = lines[0].trim();
         const memos = [];
         // 정규식으로 '- **[시간]**' 패턴 매칭 및 컨텐츠 파싱
         const regex = /\n?- \*\*\[(.*?)\]\*\*\n/g;
         let match;
         let lastIndex = 0;
         let lastTime = null;

         while ((match = regex.exec(dayBlock)) !== null) {
           if (lastTime !== null) {
             const rawContent = dayBlock.substring(lastIndex, match.index);
             const cleanContent = cleanMemoContent(rawContent);
             if (cleanContent) {
               memos.push({ time: lastTime, content: cleanContent });
             }
           }
           lastTime = match[1];
           lastIndex = regex.lastIndex;
         }
         
         // 마지막 메모 조각 처리
         if (lastTime !== null) {
           const rawContent = dayBlock.substring(lastIndex);
           const cleanContent = cleanMemoContent(rawContent);
           if (cleanContent) {
             memos.push({ time: lastTime, content: cleanContent });
           }
         }
         
         if (memos.length > 0) {
            days.push({
               date: dateStr,
               memos: memos.reverse() // 해당 날짜 내림차순(최근게 위로)
            });
         }
      }
      
      if (days.length > 0) {
        result.push({
          month: monthPrefix,
          days: days.reverse() // 최근 날짜가 위로 오도록
        });
      }
    }
    
    // 월별로 가장 최근 달이 위로 오도록 정렬
    result.sort((a, b) => b.month.localeCompare(a.month));
    
    return result;
  } catch(e) {
    console.error("아카이브 읽기 실패", e);
    return [];
  }
}

/**
 * [AI 에이전트 및 프론트엔드 공용 검색 API]
 * 사용자의 모든 아카이브 문서(.md)를 순회하며 특정 키워드나 태그를 포함한 메모를 검색합니다.
 * 순수 JSON 배열 형태로 반환하여 AI가 RAG(검색 증강 생성) 모델의 툴(Tool)로 바로 활용할 수 있습니다.
 */
function searchArchivedMemos(userName, query) {
  if (!ARCHIVE_ROOT_FOLDER_ID || ARCHIVE_ROOT_FOLDER_ID === "여기에_루트_폴더_ID를_넣어주세요") {
    return [];
  }
  
  if (!query || query.trim() === "") return [];
  const lowerQuery = query.toLowerCase();
  
  try {
    const rootFolder = DriveApp.getFolderById(ARCHIVE_ROOT_FOLDER_ID);
    const folderIter = rootFolder.getFoldersByName(userName);
    if (!folderIter.hasNext()) return [];
    
    const userFolder = folderIter.next();
    const fileIterAll = userFolder.getFiles();
    const searchResults = [];
    
    while(fileIterAll.hasNext()) {
      const file = fileIterAll.next();
      const fileName = file.getName();
      let content = "";
      
      if (file.getMimeType() === 'application/vnd.google-apps.document' && fileName.includes("_업무일지")) {
        try {
          content = DocumentApp.openById(file.getId()).getBody().getText();
        } catch(e) {
          console.error("구글 문서 파싱 실패: ", e);
          continue;
        }
      } else if (fileName.endsWith("_업무일지.md")) {
        content = file.getBlob().getDataAsString();
      } else {
        continue;
      }
      const blocks = content.split(/\n## /g);
      
      // 첫 블록은 스킵 (제목)
      for (let i = 1; i < blocks.length; i++) {
         const dayBlock = blocks[i];
         const lines = dayBlock.split('\n');
         const dateStr = lines[0].trim();
         // 정규식 매칭을 이용해 개별 메모 내용 추출
         const regex = /\n?- \*\*\[(.*?)\]\*\*\n/g;
         let match;
         let lastIndex = 0;
         let lastTime = null;

         while ((match = regex.exec(dayBlock)) !== null) {
           if (lastTime !== null) {
             const rawContent = dayBlock.substring(lastIndex, match.index);
             const cleanContent = cleanMemoContent(rawContent);
             if (cleanContent && cleanContent.toLowerCase().includes(lowerQuery)) {
               searchResults.push({
                 date: dateStr,
                 time: lastTime,
                 content: cleanContent,
                 fileName: fileName
               });
             }
           }
           lastTime = match[1];
           lastIndex = regex.lastIndex;
         }
         
         if (lastTime !== null) {
           const rawContent = dayBlock.substring(lastIndex);
           const cleanContent = cleanMemoContent(rawContent);
           if (cleanContent && cleanContent.toLowerCase().includes(lowerQuery)) {
             searchResults.push({
               date: dateStr,
               time: lastTime,
               content: cleanContent,
               fileName: fileName
             });
           }
         }
      }
    }
    
    // 날짜 역순 정렬
    searchResults.sort((a, b) => {
       const dateA = a.date.substring(0, 10);
       const dateB = b.date.substring(0, 10);
       return dateB.localeCompare(dateA);
    });
    
    return searchResults;
  } catch(e) {
    console.error("아카이브 검색 에러", e);
    return [];
  }
}

/**
 * 하위 메모 내용에서 들여쓰기 공백을 제거하고 정리해주는 헬퍼
 */
function cleanMemoContent(rawContent) {
   return rawContent.split('\n').map(l => {
        if (l.startsWith('  ')) return l.substring(2);
        return l;
   }).join('\n').trim();
}
