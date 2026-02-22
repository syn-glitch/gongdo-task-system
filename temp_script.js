
    // TUI Editor 인스턴스를 담을 전역 변수
    let editor;
    let viewer;

    // TUI Editor 초기화 함수
    function initEditor() {
      editor = new toastui.Editor({
        el: document.querySelector('#editor'),
        height: '100%',
        initialEditType: 'markdown',
        previewStyle: 'vertical', // 마크다운과 프리뷰를 반반 나누어 보여줌
        theme: currentHtmlTheme === 'dark' ? 'dark' : '',
        placeholder: '당신의 아이디어를 여기에 쏟아내세요...\n(일반 저장 시 드라이브에만 백업되며, AI 업무 추출 시 엑셀까지 등록됩니다)',
        hooks: {
          addImageBlobHook: (blob, callback) => {
            // 구글 드라이브 CORS 이슈 대비: 클립보드 이미지 직접 붙여넣기 기능 차단 또는 대체 스크립트 삽입 경로
            alert("보안 정책상 이미지 직접 붙여넣기는 지원하지 않습니다.\n외부 이미지 URL 링크 기능을 이용해주세요.");
            return false;
          }
        }
      });

      viewer = toastui.Editor.factory({
        el: document.querySelector('#viewer'),
        viewer: true,
        height: '100%',
        theme: currentHtmlTheme === 'dark' ? 'dark' : ''
      });

      // 단축키 설정 (Cmd+Enter / Ctrl+Enter 로 저장)
      document.querySelector('#editor').addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (currentMode === 'write') {
            saveMemo('saveFromWeb');
          }
        }
      });
    }

    const saveBtn = document.getElementById('saveBtn');
    const extractBtn = document.getElementById('extractBtn');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastStatus = document.getElementById('toastStatus');

    // Theme Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const htmlEl = document.documentElement;

    // Layout Elements
    const folderList = document.getElementById('folderList');
    const newMemoBtn = document.getElementById('newMemoBtn');
    const editorHeader = document.getElementById('editorHeader');
    const editorFooter = document.getElementById('editorFooter');
    const viewTitle = document.getElementById('viewTitle');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summaryOverlay = document.getElementById('summaryOverlay');
    const summaryContent = document.getElementById('summaryContent');
    const closeSummaryBtn = document.getElementById('closeSummaryBtn');

    // Auth Elements
    const userBadge = document.getElementById('userBadge');
    const accessDeniedOverlay = document.getElementById('accessDeniedOverlay');
    const accessDeniedMsg = document.getElementById('accessDeniedMsg');

    // State Variable
    let currentMode = 'write'; // 'write' or 'read'
    let currentHtmlTheme = 'dark';
    let currentUserName = null; // Magic Link 인증 완료 후 확보된 사용자 이름
    let cachedSidebarData = null; // 검색 취소 시 복구할 원래 폴더 리스트 데이터
    const searchInput = document.getElementById('searchInput');

    // ==========================================
    // 0. 테마 관리 (Light / Dark)
    // ==========================================
    const savedTheme = localStorage.getItem('judy_note_theme') || 'dark';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
      const newTheme = currentHtmlTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });

    function setTheme(theme) {
      currentHtmlTheme = theme;
      htmlEl.setAttribute('data-theme', theme);
      themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      localStorage.setItem('judy_note_theme', theme);
    }

    // ==========================================
    // 1. [Phase 10] 슬랙 기반 Magic Link (One-Time Token) 검증
    // ==========================================
    function showAccessDenied(reason) {
      accessDeniedMsg.innerHTML = reason;
      accessDeniedOverlay.style.display = 'flex';
    }

    // 구글 앱스 스크립트 특성상 window.location.search가 작동하지 않으므로,
    // doGet에서 주입해준 서버 사이드 템플릿 변수(token)를 사용합니다.
    const magicToken = "<?= token ?>";

    if (!magicToken) {
      userBadge.textContent = '⛔ 미인가';
      showAccessDenied('만료되었거나 잘못된 접속 정보입니다.<br>슬랙앱에서 [주디 노트 열어줘] 로 다시 접속하세요.');
    } else {
      // 서버를 통해 토큰 유효성 검증
      google.script.run
        .withSuccessHandler((result) => {
          if (result.valid) {
            // ✅ 인증 통과: 이름 표시 및 본인 데이터 로딩
            currentUserName = result.name;
            userBadge.textContent = `👤 ${result.name} 님`;
            loadSidebarData(result.name);

            // 보안 목적 + 미관상 URL에서 토큰 숨기기 (pushState 사용)
            if (window.history.replaceState) {
              const cleanUrl = window.location.href.split('?')[0];
              window.history.replaceState({}, document.title, cleanUrl);
            }
          } else {
            // ❌ 인증 실패 (만료, 없는 토큰, 이미 사용된 토큰)
            userBadge.textContent = '⛔ 미인가';
            showAccessDenied(result.reason);
          }
        })
        .withFailureHandler((err) => {
          userBadge.textContent = '⛔ 보안 에러';
          showAccessDenied('인증 서버 연결에 실패했습니다.<br>새로고침 하거나 슬랙에서 다시 접속하세요.');
        })
        .validateToken(magicToken);
    }

    // ==========================================
    // 2. 모드 전환 (Write <-> Read)
    // ==========================================
    newMemoBtn.addEventListener('click', () => {
      setToWriteMode();
    });

    function setToWriteMode() {
      currentMode = 'write';
      editorHeader.style.display = 'none';
      editorFooter.style.display = 'flex';

      document.getElementById('editor').style.display = 'flex';
      document.getElementById('viewer').style.display = 'none';
      if (editor) {
        editor.setMarkdown('');
        editor.focus();
      }
      summaryOverlay.classList.remove('show');
    }

    function setToReadMode(title, content) {
      currentMode = 'read';
      editorHeader.style.display = 'flex';
      editorFooter.style.display = 'none';
      viewTitle.textContent = title;

      document.getElementById('editor').style.display = 'none';
      document.getElementById('viewer').style.display = 'block';
      if (viewer) {
        viewer.setMarkdown(content.trim());
      }
      summaryOverlay.classList.remove('show'); // 혹시 열려있던 요약창 닫기
    }

    // ==========================================
    // 3. 사이드바 렌더링 및 검색 핸들링
    // ==========================================
    function loadSidebarData(userName) {
      folderList.innerHTML = '<div class="loading-text">폴더 정보를 불러오는 중...</div>';
      if (searchInput) searchInput.value = ''; // 초기화

      google.script.run
        .withSuccessHandler((data) => {
          try {
            cachedSidebarData = data;
            renderSidebar(data);
          } catch (err) {
            console.error("Render Error:", err);
            folderList.innerHTML = '<div class="loading-text" style="color:#f44336;">사이드바 렌더링 중 오류가 발생했습니다.</div>';
          }
        })
        .withFailureHandler((err) => {
          console.error("Backend Error:", err);
          folderList.innerHTML = `<div class="loading-text" style="color:#f44336;">데이터를 불러오지 못했습니다.<br>(${err.message})</div>`;
        })
        .getArchivedMemos(userName); // Backend 함수
    }

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          const userName = currentUserName;
          if (!userName) return;

          if (query === '') {
            renderSidebar(cachedSidebarData);
            return;
          }

          // 검색 모드 진입
          folderList.innerHTML = '<div class="loading-text">검색 중... 🔍</div>';
          google.script.run
            .withSuccessHandler((results) => {
              renderSearchResults(results, query);
            })
            .withFailureHandler((err) => {
              folderList.innerHTML = '<div class="loading-text" style="color:#f44336;">검색 실패</div>';
              console.error(err);
            })
            .searchArchivedMemos(userName, query);
        }
      });
    }

    function renderSearchResults(results, query) {
      folderList.innerHTML = '';

      const clearBtn = document.createElement('div');
      clearBtn.className = 'loading-text';
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.color = 'var(--primary)';
      clearBtn.style.fontWeight = '500';
      clearBtn.textContent = '← 폴더 목록으로 돌아가기';
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        renderSidebar(cachedSidebarData);
      });
      folderList.appendChild(clearBtn);

      if (!results || results.length === 0) {
        const emptyInfo = document.createElement('div');
        emptyInfo.className = 'loading-text';
        emptyInfo.textContent = '검색 결과가 없습니다.';
        folderList.appendChild(emptyInfo);
        return;
      }

      results.forEach(res => {
        const d = document.createElement('div');
        d.className = 'search-result-item';

        const dateDiv = document.createElement('div');
        dateDiv.className = 'search-result-date';
        dateDiv.textContent = `${res.date} ${res.time}`;

        const textDiv = document.createElement('div');
        textDiv.className = 'search-result-text';

        // Highlight The Match
        const safeQuery = query.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        // XSS 방어 (간단한 escape 후 highlight 적용)
        let escapedContent = res.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        escapedContent = escapedContent.replace(regex, '<span class="highlight">$1</span>');
        textDiv.innerHTML = escapedContent;

        d.appendChild(dateDiv);
        d.appendChild(textDiv);

        d.addEventListener('click', () => {
          // 검색된 원문을 클릭하면 우측 뷰어에 보여줌
          setToReadMode(res.date + " 검색 결과", `- **[${res.time}]**\n  ${res.content}`);
        });

        folderList.appendChild(d);
      });
    }

    function renderSidebar(data) {
      // data: [{month: "2026-02", days: [ {date: "2026-02-22 (일)", memos: [ {time: "14:30 PM", content: "..." } ] } ] }]
      if (!data || data.length === 0) {
        folderList.innerHTML = '<div class="loading-text">작성된 메모가 없습니다.</div>';
        return;
      }

      folderList.innerHTML = '';
      data.forEach(monthData => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'folder-title';
        titleDiv.innerHTML = `<span class="folder-icon">📁</span> ${monthData.month} 업무일지`;

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'folder-children';

        monthData.days.forEach(dayData => {
          // 하위 폴더: 날짜별 묶음 (또는 파일 리스트)
          const fileDiv = document.createElement('div');
          fileDiv.className = 'file-item';
          fileDiv.textContent = `📄 ${dayData.date}`;
          fileDiv.addEventListener('click', () => {
            // 해당 날짜 클릭 시 모든 메모 취합해서 읽기 모드로 진입
            let combinedContent = "";
            dayData.memos.forEach(m => {
              combinedContent += `- **[${m.time}]**\n  ${m.content}\n\n`;
            });
            setToReadMode(dayData.date, combinedContent);
          });
          childrenDiv.appendChild(fileDiv);
        });

        titleDiv.addEventListener('click', () => {
          folderDiv.classList.toggle('open');
        });

        folderDiv.appendChild(titleDiv);
        folderDiv.appendChild(childrenDiv);
        folderList.appendChild(folderDiv);
      });

      // 첫 번째 폴더는 기본 열어두기
      if (document.querySelector('.folder-item')) {
        document.querySelector('.folder-item').classList.add('open');
      }
    }

    // ==========================================
    // 4. 새 메모 저장 / 업무 추출 로직
    // ==========================================
    // (단축키 리스너는 initEditor() 로 이동됨)

    saveBtn.addEventListener('click', () => saveMemo('saveFromWeb'));
    extractBtn.addEventListener('click', () => saveMemo('extractFromWeb'));

    function showToast(message, isError = false) {
      toastMsg.textContent = message;
      toastStatus.style.background = isError ? '#f44336' : '#4caf50';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 5000);
    }

    function saveMemo(actionName) {
      const text = editor ? editor.getMarkdown().trim() : '';
      const userName = currentUserName;
      const isExtract = actionName === 'extractFromWeb';

      if (!userName) {
        showToast('⛔ 인증된 사용자가 없습니다. 새로고침 해주세요.', false);
        return;
      }

      if (!text) {
        if (editor) editor.focus();
        return;
      }

      // UI 상태 변경 (저장 중)
      saveBtn.disabled = true;
      extractBtn.disabled = true;

      const prevSaveText = saveBtn.textContent;
      const prevExtractText = extractBtn.textContent;

      if (isExtract) {
        extractBtn.textContent = "AI가 분석 중입니다... 🪄";
      } else {
        saveBtn.textContent = "저장 중...";
      }

      const runner = google.script.run
        .withSuccessHandler((res) => {
          saveBtn.disabled = false;
          extractBtn.disabled = false;
          saveBtn.textContent = prevSaveText;
          extractBtn.textContent = prevExtractText;

          if (res && res.success) {
            if (editor) editor.setMarkdown(""); // 입력창 초기화
            showToast(res.message);
            if (editor) editor.focus();

            // 사이드바 실시간 갱신 (저장 즉시 갱신)
            loadSidebarData(userName);
          } else {
            showToast("❌ 에러: " + (res ? res.message : "알 수 없는 에러"), true);
          }
        })
        .withFailureHandler((err) => {
          saveBtn.disabled = false;
          extractBtn.disabled = false;
          saveBtn.textContent = prevSaveText;
          extractBtn.textContent = prevExtractText;
          showToast("❌ 서버 통신 에러가 발생했습니다.", true);
          console.error("Save Error:", err);
        });

      if (actionName === 'saveFromWeb') {
        runner.saveFromWeb(userName, text);
      } else {
        runner.extractFromWeb(userName, text);
      }
    }

    // ==========================================
    // 5. 모달 형태 AI 요약
    // ==========================================
    closeSummaryBtn.addEventListener('click', () => {
      summaryOverlay.classList.remove('show');
    });

    summarizeBtn.addEventListener('click', () => {
      const text = viewer ? viewer.getMarkdown().trim() : '';
      const userName = currentUserName;

      if (!text) return;

      summarizeBtn.disabled = true;
      summarizeBtn.textContent = "요약 중... 🪄";

      google.script.run
        .withSuccessHandler((res) => {
          summarizeBtn.disabled = false;
          summarizeBtn.textContent = "✨ AI 내용 요약";

          if (res.success) {
            summaryContent.textContent = res.summary;
            summaryOverlay.classList.add('show');
          } else {
            showToast("❌ 요약 실패: " + res.message, true);
          }
        })
        .withFailureHandler((err) => {
          summarizeBtn.disabled = false;
          summarizeBtn.textContent = "✨ AI 내용 요약";
          showToast("❌ 서버 통신 에러가 발생했습니다.", true);
        })
        .summarizeMemoContent(text, userName);
    });

    // 초기 포커스 및 초기화
    window.onload = () => {
      initEditor();
    };
  