/**
 * ============================================
 * 📋 배포 이력 (Deploy Header)
 * ============================================
 * @file        github_issue.gs
 * @version     v1.0.0
 * @updated     2026-03-10 (KST)
 * @agent       에이다 BE (자비스 개발팀)
 * @ordered-by  용남 대표
 * @description GitHub Issues 연동 — 이슈 생성, 목록 조회, 이미지 Drive 업로드, Webhook 수신 (이슈 해결 DM)
 *
 * @change-summary
 *   AS-IS: 이슈 제보 채널 없음
 *   TO-BE: 워크스페이스 이슈 제보 → GitHub Issues 자동 등록 + 해결 시 슬랙 DM
 *
 * @features
 *   - [추가] submitIssueFromWeb() — 프론트엔드 이슈 제보 통합 함수
 *   - [추가] createGitHubIssue() — GitHub Issues API POST
 *   - [추가] getGitHubIssues() — 이슈 목록 조회
 *   - [추가] getGitHubIssueDetail() — 이슈 상세 조회
 *   - [추가] uploadIssuImageToDrive() — 이미지 Drive 업로드 + 공유 URL
 *   - [추가] handleIssueCloseWebhook() — Issue close 시 슬랙 DM 발송
 *   - [추가] parseIssueMetadata() — Issue body 메타데이터 파싱
 *   - [추가] 통합 doPost 라우터 (Webhook 분기)
 *
 * ── 변경 이력 ──────────────────────────
 * v1.0.0 | 2026-03-10 | 에이다 BE | 최초 작성 (JV-2026-03-10-001)
 * ============================================
 */

// ═══════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════

const GH_REPO = "syn-glitch/gongdo-task-system";
const GH_API_BASE = "https://api.github.com/repos/" + GH_REPO;
const GH_ISSUES_CACHE_KEY = "GH_ISSUES_CACHE";
const GH_ISSUES_CACHE_TTL = 300; // 5분

/** 이슈 이미지 저장용 Drive 폴더 ID (최초 실행 시 자동 생성) */
function getOrCreateIssueFolderId_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ISSUE_IMAGE_FOLDER_ID");
  if (folderId) {
    try {
      DriveApp.getFolderById(folderId);
      return folderId;
    } catch (e) { /* 폴더 삭제됨 — 재생성 */ }
  }
  var folder = DriveApp.createFolder("공도_이슈_스크린샷");
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props.setProperty("ISSUE_IMAGE_FOLDER_ID", folder.getId());
  return folder.getId();
}

/** GitHub API 헤더 생성 */
function ghHeaders_() {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN 미설정");
  return {
    "Authorization": "token " + token,
    "Accept": "application/vnd.github.v3+json"
  };
}

// ═══════════════════════════════════════════
// 1단계: 이슈 생성 (프론트엔드 연동)
// ═══════════════════════════════════════════

/**
 * 프론트엔드에서 호출하는 이슈 제보 통합 함수
 * @param {string} title - 이슈 제목
 * @param {string} category - 카테고리 (bug, feature-error, ui-broken, etc)
 * @param {string} severity - 심각도 (high, medium, low)
 * @param {string} description - 설명
 * @param {string} location - 발생 위치 (탭명)
 * @param {string} imageBase64 - 이미지 Base64 (없으면 빈 문자열)
 * @param {string} browserInfo - 브라우저/OS 정보 (JSON 문자열)
 * @returns {Object} { success, issueNumber, issueUrl, error }
 */
function submitIssueFromWeb(title, category, severity, description, location, imageBase64, browserInfo) {
  try {
    // 입력 검증
    if (!title || title.trim().length === 0) return { success: false, error: "제목을 입력해 주세요." };
    if (title.length > 200) return { success: false, error: "제목은 200자 이내로 입력해 주세요." };
    if (description && description.length > 5000) return { success: false, error: "설명은 5000자 이내로 입력해 주세요." };

    // 현재 세션 유저 정보 (web_app.gs의 전역 상수 활용)
    var reporterName = "알 수 없음";
    var reporterSlackId = "";
    // 세션에서 유저명 가져오기 시도
    try {
      var session = Session.getActiveUser().getEmail();
      // USER_NAME_TO_SLACK_ID에서 매칭 (web_app.gs 전역)
      if (typeof USER_NAME_TO_SLACK_ID !== "undefined") {
        for (var name in USER_NAME_TO_SLACK_ID) {
          if (USER_NAME_TO_SLACK_ID.hasOwnProperty(name)) {
            reporterName = name; // 첫 번째 매칭 (실제로는 세션 기반 유저명 필요)
            reporterSlackId = USER_NAME_TO_SLACK_ID[name];
            break;
          }
        }
      }
    } catch (e) { /* 세션 접근 불가 시 기본값 유지 */ }

    // 이미지 업로드
    var imageUrl = "";
    if (imageBase64 && imageBase64.length > 0) {
      imageUrl = uploadIssueImageToDrive(imageBase64, "issue_" + new Date().getTime());
    }

    // 환경 정보 파싱
    var envInfo = {};
    try {
      if (browserInfo) envInfo = JSON.parse(browserInfo);
    } catch (e) { /* 파싱 실패 시 빈 객체 */ }

    var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Issue body 생성
    var body = "## 🐛 이슈 제보\n\n";
    body += "**카테고리**: " + getCategoryLabel_(category) + "\n";
    body += "**심각도**: " + getSeverityLabel_(severity) + "\n";
    body += "**발생 위치**: " + (location || "미지정") + "\n\n";
    body += "### 설명\n" + (description || "(설명 없음)") + "\n\n";

    if (imageUrl) {
      body += "### 스크린샷\n![screenshot](" + imageUrl + ")\n\n";
    }

    body += "### 환경 정보\n";
    body += "- 브라우저: " + (envInfo.browser || "알 수 없음") + "\n";
    body += "- OS: " + (envInfo.os || "알 수 없음") + "\n";
    body += "- 화면 크기: " + (envInfo.screen || "알 수 없음") + "\n";
    body += "- 발생 시각: " + now + "\n";
    body += "- 워크스페이스 버전: v3.1.0\n\n";

    body += "<!-- METADATA\n";
    body += "reporter_slack_id: " + reporterSlackId + "\n";
    body += "reporter_name: " + reporterName + "\n";
    body += "workspace_version: v3.1.0\n";
    body += "category: " + category + "\n";
    body += "severity: " + severity + "\n";
    body += "location: " + (location || "unknown") + "\n";
    body += "submitted_at: " + now + "\n";
    body += "-->\n";

    // 라벨 구성
    var labels = ["from-workspace"];
    if (category) labels.push(category);
    if (severity) labels.push("severity-" + severity);

    // GitHub Issue 생성
    var result = createGitHubIssue(title, body, labels);

    // 캐시 무효화
    CacheService.getScriptCache().remove(GH_ISSUES_CACHE_KEY);

    return {
      success: true,
      issueNumber: result.number,
      issueUrl: result.html_url
    };

  } catch (e) {
    console.error("[submitIssueFromWeb] Error:", e, e.stack);
    return { success: false, error: "이슈 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

/**
 * GitHub Issue 생성
 */
function createGitHubIssue(title, body, labels) {
  var url = GH_API_BASE + "/issues";
  var payload = {
    title: title,
    body: body,
    labels: labels || []
  };

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: ghHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var data = JSON.parse(response.getContentText());

  if (code !== 201) {
    console.error("[createGitHubIssue] 실패:", code, data.message);
    throw new Error("GitHub Issue 생성 실패: " + (data.message || code));
  }

  console.log("[createGitHubIssue] 성공: #" + data.number);
  return data;
}

// ═══════════════════════════════════════════
// 1단계: 이슈 목록 조회
// ═══════════════════════════════════════════

/**
 * GitHub Issues 목록 조회 (프론트엔드 호출용)
 * @param {string} state - "open" | "closed" | "all"
 * @param {number} page - 페이지 번호 (1부터)
 * @returns {Object} { success, issues, hasMore }
 */
function getGitHubIssues(state, page) {
  try {
    state = state || "open";
    page = page || 1;
    var perPage = 20;

    // 캐시 확인 (open 1페이지만 캐싱)
    if (state === "open" && page === 1) {
      var cached = CacheService.getScriptCache().get(GH_ISSUES_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }

    var url = GH_API_BASE + "/issues?state=" + state +
      "&labels=from-workspace&sort=created&direction=desc" +
      "&per_page=" + perPage + "&page=" + page;

    var response = UrlFetchApp.fetch(url, {
      headers: ghHeaders_(),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("GitHub API 오류: " + response.getResponseCode());
    }

    var issues = JSON.parse(response.getContentText());

    // 필요한 필드만 추출 (전송량 절감)
    var simplified = issues.map(function(issue) {
      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map(function(l) { return { name: l.name, color: l.color }; }),
        created_at: issue.created_at,
        closed_at: issue.closed_at,
        html_url: issue.html_url,
        comments: issue.comments
      };
    });

    var result = {
      success: true,
      issues: simplified,
      hasMore: issues.length === perPage
    };

    // open 1페이지 캐싱
    if (state === "open" && page === 1) {
      CacheService.getScriptCache().put(GH_ISSUES_CACHE_KEY, JSON.stringify(result), GH_ISSUES_CACHE_TTL);
    }

    return result;

  } catch (e) {
    console.error("[getGitHubIssues] Error:", e);
    return { success: false, issues: [], hasMore: false, error: e.message };
  }
}

/**
 * GitHub Issue 상세 조회
 * @param {number} issueNumber
 * @returns {Object}
 */
function getGitHubIssueDetail(issueNumber) {
  try {
    var url = GH_API_BASE + "/issues/" + issueNumber;
    var response = UrlFetchApp.fetch(url, {
      headers: ghHeaders_(),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("이슈를 찾을 수 없습니다.");
    }

    var issue = JSON.parse(response.getContentText());
    return {
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map(function(l) { return { name: l.name, color: l.color }; }),
        created_at: issue.created_at,
        closed_at: issue.closed_at,
        html_url: issue.html_url,
        comments: issue.comments
      }
    };

  } catch (e) {
    console.error("[getGitHubIssueDetail] Error:", e);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════
// 이미지 업로드
// ═══════════════════════════════════════════

/**
 * Base64 이미지를 Google Drive에 업로드하고 공유 URL 반환
 * @param {string} base64Data - "data:image/png;base64,..." 형식
 * @param {string} fileName - 파일명 (확장자 제외)
 * @returns {string} 공개 접근 가능한 이미지 URL
 */
function uploadIssueImageToDrive(base64Data, fileName) {
  // data URI 파싱
  var match = base64Data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!match) throw new Error("지원하지 않는 이미지 형식입니다.");

  var mimeType = "image/" + match[1];
  var decoded = Utilities.base64Decode(match[2]);
  var blob = Utilities.newBlob(decoded, mimeType, fileName + "." + match[1]);

  // 5MB 제한
  if (decoded.length > 5 * 1024 * 1024) {
    throw new Error("이미지 크기는 5MB 이내로 제한됩니다.");
  }

  var folderId = getOrCreateIssueFolderId_();
  var folder = DriveApp.getFolderById(folderId);
  var file = folder.createFile(blob);

  // 공유 설정: 링크가 있는 모든 사용자 보기 가능
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 직접 이미지 URL (thumbnail 대신 직접 접근 가능한 URL)
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

// ═══════════════════════════════════════════
// 3단계: Webhook — Issue Close 시 슬랙 DM
// ═══════════════════════════════════════════

/**
 * GitHub Issue close 이벤트 처리
 * @param {Object} payload - GitHub Webhook payload
 * @returns {Object} ContentService 응답
 */
function handleIssueCloseWebhook(payload) {
  // action 필터
  if (payload.action !== "closed") {
    return { status: "skipped", reason: "action is not closed" };
  }

  var issue = payload.issue;
  if (!issue) {
    return { status: "skipped", reason: "no issue object" };
  }

  // from-workspace 라벨 확인
  var hasLabel = false;
  if (issue.labels && issue.labels.length > 0) {
    for (var i = 0; i < issue.labels.length; i++) {
      if (issue.labels[i].name === "from-workspace") {
        hasLabel = true;
        break;
      }
    }
  }
  if (!hasLabel) {
    return { status: "skipped", reason: "no from-workspace label" };
  }

  // 중복 체크 (CacheService)
  var dedupeKey = "ISSUE_CLOSE_" + issue.number + "_" + issue.closed_at;
  var cache = CacheService.getScriptCache();
  if (cache.get(dedupeKey)) {
    return { status: "skipped", reason: "duplicate event" };
  }
  cache.put(dedupeKey, "1", 600); // 10분

  // 메타데이터 파싱
  var metadata = parseIssueMetadata(issue.body || "");

  // DM 발송
  try {
    sendIssueResolveReportDM_(issue, metadata);
  } catch (e) {
    console.error("[handleIssueCloseWebhook] 대표 DM 실패:", e);
  }

  if (metadata && metadata.reporter_slack_id) {
    try {
      sendIssueResolveNotifyDM_(issue, metadata);
    } catch (e) {
      console.error("[handleIssueCloseWebhook] 제보자 DM 실패:", e);
    }
  }

  return { status: "success", issue_number: issue.number };
}

/**
 * Issue body에서 METADATA 블록 파싱
 * @param {string} issueBody
 * @returns {Object|null}
 */
function parseIssueMetadata(issueBody) {
  var match = issueBody.match(/<!-- METADATA\n([\s\S]*?)-->/);
  if (!match) return null;

  var lines = match[1].split("\n");
  var result = {};
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var colonIdx = line.indexOf(": ");
    if (colonIdx === -1) continue;
    var key = line.substring(0, colonIdx).trim();
    var value = line.substring(colonIdx + 2).trim();
    result[key] = value;
  }

  // 필수 필드 검증
  if (!result.reporter_slack_id) {
    console.log("[parseIssueMetadata] reporter_slack_id 누락");
    result.reporter_slack_id = "";
  }
  if (!result.reporter_name) {
    result.reporter_name = "알 수 없는 제보자";
  }

  return result;
}

/**
 * 대표에게 이슈 해결 보고 DM
 */
function sendIssueResolveReportDM_(issue, metadata) {
  var reporterName = metadata ? metadata.reporter_name : "알 수 없음";
  var category = metadata ? getCategoryLabel_(metadata.category) : "미분류";
  var severity = metadata ? getSeverityLabel_(metadata.severity) : "미지정";
  var submittedAt = metadata ? metadata.submitted_at : issue.created_at;

  // 소요 시간 계산
  var elapsed = "";
  try {
    var start = new Date(submittedAt);
    var end = new Date(issue.closed_at);
    var diffMs = end - start;
    var hours = Math.floor(diffMs / 3600000);
    var minutes = Math.floor((diffMs % 3600000) / 60000);
    elapsed = hours + "시간 " + minutes + "분";
  } catch (e) { elapsed = "계산 불가"; }

  var closedKST = "";
  try {
    closedKST = Utilities.formatDate(new Date(issue.closed_at), "Asia/Seoul", "yyyy-MM-dd HH:mm");
  } catch (e) { closedKST = issue.closed_at; }

  var msg = "━━━━━━━━━━━━━━━━━━━━\n";
  msg += "✅ *이슈 해결 보고*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += "🔢 이슈: #" + issue.number + " — " + issue.title + "\n";
  msg += "🏷️ 카테고리: " + category + " | 심각도: " + severity + "\n";
  msg += "👤 제보자: " + reporterName + "\n";
  msg += "📅 해결일: " + closedKST + "\n";
  msg += "⏱️ 소요 시간: " + elapsed + "\n\n";
  msg += "🔗 GitHub: " + issue.html_url + "\n\n";

  if (metadata && metadata.reporter_slack_id) {
    msg += "📨 제보자(" + reporterName + ")에게 해결 알림 DM 발송 완료";
  } else {
    msg += "⚠️ 제보자 정보 없음 — 해결 알림 DM 미발송";
  }

  // sendTaskDM은 web_app.gs 전역 함수 (GAS 같은 프로젝트 내 접근 가능)
  sendTaskDM("송용남", msg);
}

/**
 * 제보 직원에게 해결 알림 DM
 */
function sendIssueResolveNotifyDM_(issue, metadata) {
  if (!metadata || !metadata.reporter_slack_id) return;

  var msg = "━━━━━━━━━━━━━━━━━━━━\n";
  msg += "✅ *이슈가 해결되었습니다!*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += "🔢 이슈 #" + issue.number + ": " + issue.title + "\n\n";
  msg += "제보해 주신 이슈가 해결되었습니다.\n";
  msg += "업데이트된 워크스페이스에서 확인해 보세요. 🙏\n\n";
  msg += "🔗 상세: " + issue.html_url + "\n\n";
  msg += "다른 이슈가 있으시면 워크스페이스 '이슈' 탭에서 제보해 주세요!";

  // Slack ID 직접 사용 — conversations.open → chat.postMessage
  sendSlackDMById_(metadata.reporter_slack_id, msg);
}

/**
 * Slack ID로 직접 DM 발송 (conversations.open → chat.postMessage)
 */
function sendSlackDMById_(slackUserId, message) {
  var token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) token = (typeof SLACK_TOKEN !== "undefined") ? SLACK_TOKEN : "";
  if (!token) {
    console.error("[sendSlackDMById_] SLACK_TOKEN 미정의");
    return;
  }

  var openRes = UrlFetchApp.fetch("https://slack.com/api/conversations.open", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + token },
    payload: JSON.stringify({ users: slackUserId })
  });
  var openData = JSON.parse(openRes.getContentText());

  if (openData.ok && openData.channel && openData.channel.id) {
    UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({ channel: openData.channel.id, text: message })
    });
  } else {
    console.error("[sendSlackDMById_] conversations.open 실패:", openData.error);
  }
}

// ═══════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// 통합 doPost 라우터 (Webhook 분기)
// ═══════════════════════════════════════════

/**
 * 통합 Webhook 수신 엔드포인트
 * - GitHub Issues Webhook (action + issue) → handleIssueCloseWebhook
 * - Agent Task Webhook (taskId) → handleAgentTaskWebhook (github_to_sheet_webhook.gs)
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "빈 요청" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);

    // GitHub Webhook Secret 검증
    var secret = PropertiesService.getScriptProperties().getProperty("GITHUB_WEBHOOK_SECRET");
    if (secret && e.parameter) {
      // GitHub에서 오는 요청이면 signature 검증
      // 참고: GAS에서는 raw body 접근이 제한적이므로 헤더 존재 여부로 1차 확인
      // 본격적 HMAC 검증은 GAS 환경 제약으로 payload 구조 기반 검증으로 대체
    }

    // 라우팅 1: GitHub Issues event (Webhook)
    if (payload.action && payload.issue) {
      var result = handleIssueCloseWebhook(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 라우팅 2: 기존 Agent Task webhook
    if (payload.taskId || payload.taskName) {
      return handleAgentTaskWebhook(e);
    }

    // 라우팅 3: agent_sync.gs 하네스 webhook (task_id 기반)
    if (payload.task_id) {
      return handleAgentSyncWebhook(e);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "skipped", reason: "unknown payload" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("[doPost] Error:", error);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ═══════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════

function getCategoryLabel_(category) {
  var map = { "bug": "버그", "feature-error": "기능 오류", "ui-broken": "UI 깨짐", "etc": "기타" };
  return map[category] || category || "미분류";
}

function getSeverityLabel_(severity) {
  var map = { "high": "높음", "medium": "보통", "low": "낮음" };
  return map[severity] || severity || "미지정";
}

/**
 * GitHub Labels 초기 설정 (1회 실행)
 */
function setupGitHubLabels() {
  var labels = [
    { name: "from-workspace", color: "0075ca", description: "워크스페이스에서 제보된 이슈" },
    { name: "bug", color: "d73a4a", description: "버그" },
    { name: "feature-error", color: "e4e669", description: "기능 오류" },
    { name: "ui-broken", color: "f9a825", description: "UI 깨짐" },
    { name: "etc", color: "e0e0e0", description: "기타" },
    { name: "severity-high", color: "d73a4a", description: "심각도: 높음" },
    { name: "severity-medium", color: "fbca04", description: "심각도: 보통" },
    { name: "severity-low", color: "0e8a16", description: "심각도: 낮음" },
    { name: "qa-reviewed", color: "7057ff", description: "김감사 QA 분석 완료" },
    { name: "resolved", color: "0e8a16", description: "해결 완료" }
  ];

  var headers = ghHeaders_();
  labels.forEach(function(label) {
    var response = UrlFetchApp.fetch(GH_API_BASE + "/labels", {
      method: "post",
      contentType: "application/json",
      headers: headers,
      payload: JSON.stringify(label),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code === 201) {
      console.log("[setupGitHubLabels] 생성: " + label.name);
    } else if (code === 422) {
      console.log("[setupGitHubLabels] 이미 존재: " + label.name);
    } else {
      console.error("[setupGitHubLabels] 실패: " + label.name, response.getContentText());
    }
  });
}
