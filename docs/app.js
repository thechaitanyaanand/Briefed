// App logic for Briefed Landing Page and Portal Documentation
document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. CUSTOM RETRO BLOCKY CURSOR
  // ==========================================
  const cursor = document.getElementById('custom-cursor');
  let cursorX = 0;
  let cursorY = 0;
  let targetX = 0;
  let targetY = 0;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function updateCursor() {
    const ease = 0.25;
    cursorX += (targetX - cursorX) * ease;
    cursorY += (targetY - cursorY) * ease;
    
    if (cursor) {
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
    }
    requestAnimationFrame(updateCursor);
  }
  updateCursor();

  // Highlight clickable elements on hover
  const clickables = document.querySelectorAll('button, a, .floppy-card, .sim-switch-box, .rotary-dial, .brutal-slider, .fader-track, input, textarea');
  clickables.forEach(item => {
    item.addEventListener('mouseenter', () => {
      if (cursor) cursor.classList.add('hovering');
    });
    item.addEventListener('mouseleave', () => {
      if (cursor) cursor.classList.remove('hovering');
    });
  });


  // ==========================================
  // 2. HERO TERMINAL TYPING ANIMATION
  // ==========================================
  const typedSpan = document.getElementById('terminal-typed-text');
  const outputBlock = document.getElementById('terminal-output');
  const terminalCursor = document.getElementById('terminal-cursor');
  
  const textToType = 'briefed init --interactive';
  let typeIndex = 0;

  const logs = [
    { text: '✓ Git post-merge and post-rewrite hook hooks resolved successfully.', type: 'success', delay: 400 },
    { text: '✓ Scanning workspace directories... Resolved hook target: CLAUDE.md', type: 'success', delay: 300 },
    { text: '  - Injecting Briefed core post-merge script inside .git/hooks/', type: 'gray', delay: 200 },
    { text: '✓ Config merger successfully initialized and saved to .briefed.json', type: 'success', delay: 400 },
    { text: '  ⚠ Windows hook safety: Forcing standard Unix LF line-endings on all hook scripts.', type: 'warn', delay: 300 },
    { text: '✓ Prototype Pollution shield enabled ( constructor & __proto__ strips activated ).', type: 'success', delay: 250 },
    { text: '\nNext Steps:', type: 'white', delay: 200 },
    { text: '  1. Stage your configuration files:', type: 'gray', delay: 100 },
    { text: '     git add CLAUDE.md .briefed.json', type: 'white', delay: 100 },
    { text: '  2. Trigger context sync manually anytime using: briefed run', type: 'gray', delay: 100 },
    { text: '  3. Ready! Merging or switching branches automatically triggers background syncs.', type: 'gray', delay: 100 }
  ];

  function typeChar() {
    if (typedSpan && typeIndex < textToType.length) {
      typedSpan.textContent += textToType.charAt(typeIndex);
      typeIndex++;
      setTimeout(typeChar, 70 + Math.random() * 40);
    } else {
      if (terminalCursor) terminalCursor.style.display = 'none';
      setTimeout(triggerOutput, 300);
    }
  }

  let logIndex = 0;
  function triggerOutput() {
    if (outputBlock && logIndex < logs.length) {
      const log = logs[logIndex];
      const lineDiv = document.createElement('div');
      lineDiv.className = 'term-log';
      
      if (log.type === 'success') lineDiv.classList.add('term-success');
      if (log.type === 'warn') lineDiv.classList.add('term-warn');
      if (log.type === 'gray') lineDiv.classList.add('term-gray');

      lineDiv.textContent = log.text;
      outputBlock.appendChild(lineDiv);
      logIndex++;
      setTimeout(triggerOutput, log.delay);
    }
  }

  if (typedSpan) setTimeout(typeChar, 1000);


  // ==========================================
  // 3. COPY INSTALL COMMAND INTERACTION
  // ==========================================
  const installBtn = document.getElementById('install-copy-btn');
  const ctaBtn = document.getElementById('cta-install-btn');
  const tooltip = document.getElementById('copy-tooltip');

  function copyText() {
    const textToCopy = 'npm install -g briefed';
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (tooltip) {
        tooltip.style.display = 'block';
        setTimeout(() => {
          tooltip.style.display = 'none';
        }, 2000);
      }
    });
  }

  if (installBtn) installBtn.addEventListener('click', copyText);
  if (ctaBtn) ctaBtn.addEventListener('click', copyText);


  // ==========================================
  // 4. FLOPPY DISK SHUTTER SLIDE INTERACTION
  // ==========================================
  const floppyCards = document.querySelectorAll('.floppy-card');
  floppyCards.forEach(card => {
    const metalShutter = card.querySelector('.shutter-metal');
    
    card.addEventListener('mouseenter', () => {
      if (metalShutter) {
        metalShutter.style.transform = 'translateX(60px)';
        metalShutter.style.transition = 'transform 0.2s ease-out';
      }
    });

    card.addEventListener('mouseleave', () => {
      if (metalShutter) {
        metalShutter.style.transform = 'translateX(0px)';
      }
    });

    card.addEventListener('click', () => {
      const protectNotch = card.querySelector('.notch-slider');
      if (protectNotch) {
        const isNotched = protectNotch.style.transform === 'translateY(-6px)';
        protectNotch.style.transform = isNotched ? 'translateY(0px)' : 'translateY(-6px)';
        protectNotch.style.transition = 'transform 0.1s ease';
      }
    });
  });


  // ==========================================
  // 5. LIVE SIMULATOR SYSTEM (Toggles, Custom editor, Tab routing)
  // ==========================================
  
  // Tab Routing - Presets vs Custom Editor
  const simBtnPresets = document.getElementById('sim-btn-presets');
  const simBtnCustom = document.getElementById('sim-btn-custom');
  const simPanePresets = document.getElementById('sim-pane-presets');
  const simPaneCustom = document.getElementById('sim-pane-custom');

  let activeInputTab = 'presets'; // 'presets' | 'custom'

  if (simBtnPresets && simBtnCustom) {
    simBtnPresets.addEventListener('click', () => {
      simBtnPresets.classList.add('active');
      simBtnCustom.classList.remove('active');
      if (simPanePresets) simPanePresets.classList.add('active');
      if (simPaneCustom) simPaneCustom.classList.remove('active');
      activeInputTab = 'presets';
      renderSimulatorOutput();
    });

    simBtnCustom.addEventListener('click', () => {
      simBtnCustom.classList.add('active');
      simBtnPresets.classList.remove('active');
      if (simPaneCustom) simPaneCustom.classList.add('active');
      if (simPanePresets) simPanePresets.classList.remove('active');
      activeInputTab = 'custom';
      renderSimulatorOutput();
    });
  }

  // Output Tabs Routing - CLAUDE.md vs Terminal Output
  const btnOutClaude = document.getElementById('btn-out-claude');
  const btnOutTerminal = document.getElementById('btn-out-terminal');
  const paneOutClaude = document.getElementById('sim-out-pane-claude');
  const paneOutTerminal = document.getElementById('sim-out-pane-terminal');

  if (btnOutClaude && btnOutTerminal) {
    btnOutClaude.addEventListener('click', () => {
      btnOutClaude.classList.add('active');
      btnOutTerminal.classList.remove('active');
      if (paneOutClaude) paneOutClaude.classList.add('active');
      if (paneOutTerminal) paneOutTerminal.classList.remove('active');
    });

    btnOutTerminal.addEventListener('click', () => {
      btnOutTerminal.classList.add('active');
      btnOutClaude.classList.remove('active');
      if (paneOutTerminal) paneOutTerminal.classList.add('active');
      if (paneOutClaude) paneOutClaude.classList.remove('active');
    });
  }

  // Preset switch controls
  const toggleAuth = document.getElementById('toggle-auth');
  const toggleDeps = document.getElementById('toggle-deps');
  const toggleBugfix = document.getElementById('toggle-bugfix');
  const simOutput = document.getElementById('simulator-output-pre');
  const simTerminalPre = document.getElementById('simulator-terminal-pre');

  const switches = [
    { btn: toggleAuth, id: 'auth', active: true },
    { btn: toggleDeps, id: 'deps', active: false },
    { btn: toggleBugfix, id: 'bugfix', active: false }
  ];

  switches.forEach(sw => {
    if (sw.btn) {
      sw.btn.addEventListener('click', () => {
        sw.active = !sw.active;
        if (sw.active) {
          sw.btn.classList.add('active');
          sw.btn.textContent = 'ON';
        } else {
          sw.btn.classList.remove('active');
          sw.btn.textContent = 'OFF';
        }
        renderSimulatorOutput();
      });
    }
  });

  // Custom Editor Simulator trigger
  const btnRunCustomSim = document.getElementById('btn-run-custom-sim');
  const customDiffInput = document.getElementById('custom-diff-input');

  if (btnRunCustomSim) {
    btnRunCustomSim.addEventListener('click', () => {
      renderSimulatorOutput();
      // Auto-switch output pane to CLAUDE.md to show update
      if (btnOutClaude) btnOutClaude.click();
    });
  }

  // The core simulator logic
  function renderSimulatorOutput() {
    if (!simOutput || !simTerminalPre) return;

    if (activeInputTab === 'custom') {
      simulateCustomDiffOutput();
      return;
    }

    // Preset scenarios rendering
    const isAuth = switches.find(s => s.id === 'auth').active;
    const isDeps = switches.find(s => s.id === 'deps').active;
    const isBugfix = switches.find(s => s.id === 'bugfix').active;

    if (!isAuth && !isDeps && !isBugfix) {
      simOutput.textContent = `# AI Context (CLAUDE.md)\n\nManaged by Briefed.\n\n<!-- BRIEFED_START -->\n<!-- BRIEFED_END -->`;
      simTerminalPre.textContent = `admin@briefed-shell:~$ briefed run --verbose\n` +
                                   `[briefed] Checking changes between ORIG_HEAD and HEAD...\n` +
                                   `[briefed] No files modified. Skipping summary execution. ⚡`;
      return;
    }

    let files = [];
    let added = [];
    let removed = [];
    let branchName = 'main';
    let hash = 'abc1234';
    let additions = 0;
    let deletions = 0;
    let summaryText = '';

    const linesOfCode = [];
    
    if (isAuth) {
      branchName = 'feature/auth-oauth2';
      hash = 'e8b39a1';
      files.push('src/auth.ts', 'src/types.ts');
      additions += 142;
      deletions += 18;
      added.push('OAuth2 session management logic', 'TokenTypes interface');
      removed.push('Legacy local cookie crypt table');
      summaryText += `- Implemented OAuth2 authorization token handling in src/auth.ts to manage user session contexts securely.\n- Configured TokenTypes interfaces in src/types.ts.`;
    }

    if (isDeps) {
      if (branchName === 'main') {
        branchName = 'patch/upgrade-deps';
        hash = 'f29d71c';
      } else {
        branchName += '+deps';
      }
      files.push('package.json', 'package-lock.json');
      additions += 32;
      deletions += 12;
      added.push('chalk dependency for CLI color outputs', 'vitest test harness');
      summaryText += `\n- Upgraded testing frameworks. Registered vitest framework globally for local mock execution.\n- Installed chalk dependency to enable advanced color logs inside hook scripts.`;
    }

    if (isBugfix) {
      if (branchName === 'main') {
        branchName = 'hotfix/windows-crlf';
        hash = '5d710ab';
      } else {
        branchName += '+crlf';
      }
      files.push('src/hook.ts');
      additions += 14;
      deletions += 3;
      added.push('Unix LF hook sanitization line endings');
      removed.push('Windows CRLF carriage returns');
      summaryText += `\n- Solved Windows CRLF interpreter failure by forcing LF line-endings during git hooks initialization.`;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Compile final CLAUDE.md display content
    const contextContent = 
`# AI Context

Managed by Briefed.

<!-- BRIEFED_START -->
## [${today}] ${hash} (${branchName})
${summaryText.trim()}

FILES: ${files.join(', ')}
<!-- BRIEFED_END -->

# Engineering Instructions
- Code quality standard: Use Vitest for assertions.
- Formatting style: ESModules import schema.`;

    simOutput.textContent = contextContent;

    // Compile verbose CLI terminal logs
    const activeBackend = document.getElementById('readout-backend') ? document.getElementById('readout-backend').textContent.toLowerCase() : 'ollama';
    const limitLines = document.getElementById('readout-lines') ? parseInt(document.getElementById('readout-lines').textContent) : 10;
    
    let terminalLog = `admin@briefed-shell:~$ briefed run --verbose\n` +
                      `[briefed] Reading config parameters from local .briefed.json...\n` +
                      `[briefed] Successfully verified target file path: CLAUDE.md\n` +
                      `[briefed] Resolving Git boundaries... Found ORIG_HEAD at parent branch index.\n` +
                      `[briefed] Running diff query: git diff --name-only ORIG_HEAD HEAD -- ":(exclude)CLAUDE.md"\n` +
                      `[briefed] Excluded 1 target context file from diff to prevent contamination loop.\n` +
                      `[briefed] Changed files detected: ${files.join(', ')}\n` +
                      `[briefed] Accumulating total code lines: +${additions} insertions, -${deletions} deletions.\n` +
                      `[briefed] Threshold verification: ${additions + deletions} lines modified (minDiffLines limit: ${limitLines})\n`;

    if (activeBackend === 'none') {
      terminalLog += `[briefed] Backend set to NONE. Bypassing LLM summary call. Running mechanical index mapping...\n` +
                     `[briefed] Compiled mechanical directory grouping successfully.\n`;
    } else {
      terminalLog += `[briefed] Triggering active secret scrubbing filters... (0 exposed credentials found)\n` +
                     `[briefed] Contacting LLM service backend (${activeBackend}) using model: default...\n` +
                     `[briefed] Context parsed. LLM summary returned in 0.38s.\n`;
    }

    terminalLog += `[briefed] Acquiring write lock file: CLAUDE.md.lock\n` +
                   `[briefed] Deduplication scan: Commit ${hash} is new. Writing context block...\n` +
                   `[briefed] Executing atomic buffer exchange renameSync to avoid file contamination.\n` +
                   `[briefed] Released write lock. Sync finished successfully! ✅\n`;

    simTerminalPre.textContent = terminalLog;
  }

  // Parse and simulate custom diff entry compilation
  function simulateCustomDiffOutput() {
    const rawDiffText = customDiffInput ? customDiffInput.value : '';
    
    // Quick regex scans
    const lines = rawDiffText.split('\n');
    let additionsCount = 0;
    let deletionsCount = 0;
    const modifiedFilesSet = new Set();
    let containsSecrets = false;
    let scrubbedCredentials = [];

    lines.forEach(line => {
      if (line.startsWith('+++ b/')) {
        modifiedFilesSet.add(line.replace('+++ b/', '').trim());
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additionsCount++;
        // Check secret patterns
        if (/(AIzaSy[A-Za-z0-9_-]{33}|postgres:\/\/|API_KEY|aws_secret)/gi.test(line)) {
          containsSecrets = true;
          if (line.includes('AIzaSy')) scrubbedCredentials.push('Google Gemini API Key');
          if (line.includes('postgres://')) scrubbedCredentials.push('PostgreSQL Database connection string');
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletionsCount++;
      }
    });

    const fileList = Array.from(modifiedFilesSet);
    const displayFiles = fileList.length > 0 ? fileList.join(', ') : 'src/db.ts';

    // Formulate a beautiful summary
    let summaryText = '';
    if (containsSecrets) {
      summaryText = `- Added Postgres Database Pool instance inside src/db.ts to configure query clustering.\n- Refactored server credential handling to leverage environment variables instead of hardcoded strings.\n- Masked exposed credentials during client-side git-merge pipeline checks.`;
    } else if (fileList.length > 0) {
      summaryText = `- Integrated source modifications inside: ${fileList.join(', ')}.\n- Formatted repository structures to align with local project specifications.`;
    } else {
      summaryText = `- Executed manual local sync check to inspect file system parameters.`;
    }

    const today = new Date().toISOString().split('T')[0];
    const contextContent = 
`# AI Context

Managed by Briefed.

<!-- BRIEFED_START -->
## [${today}] c97f2ab (custom-diff-run)
${summaryText}

FILES: ${displayFiles}
<!-- BRIEFED_END -->`;

    simOutput.textContent = contextContent;

    const activeBackend = document.getElementById('readout-backend') ? document.getElementById('readout-backend').textContent.toLowerCase() : 'ollama';
    const limitLines = document.getElementById('readout-lines') ? parseInt(document.getElementById('readout-lines').textContent) : 10;
    const totalDiffLines = additionsCount + deletionsCount;

    let terminalLog = `admin@briefed-shell:~$ briefed run --verbose\n` +
                      `[briefed] Reading config parameters from local .briefed.json...\n` +
                      `[briefed] Successfully verified target file path: CLAUDE.md\n` +
                      `[briefed] Resolving Git boundaries... Found custom buffer diff input.\n` +
                      `[briefed] Changed files detected: ${displayFiles}\n` +
                      `[briefed] Accumulating total code lines: +${additionsCount} insertions, -${deletionsCount} deletions.\n` +
                      `[briefed] Threshold verification: ${totalDiffLines} lines modified (minDiffLines limit: ${limitLines})\n`;

    if (totalDiffLines < limitLines) {
      terminalLog += `[briefed] ⚠ Total changes (${totalDiffLines} lines) fall below minDiffLines limit (${limitLines}).\n` +
                     `[briefed] Skipping LLM request to conserve tokens! Instantly compiled mechanical folder groupings.\n`;
    } else if (containsSecrets) {
      terminalLog += `[briefed] 🛡️ CRITICAL SECURITY ALERT: Exposed keys detected in local code buffer!\n`;
      scrubbedCredentials.forEach(cred => {
        terminalLog += `[briefed]   - Redacted: ${cred}\n`;
      });
      terminalLog += `[briefed] Running API payload scrubbers... Redacted credentials successfully.\n`;
      
      if (activeBackend === 'none') {
        terminalLog += `[briefed] Backend set to NONE. Running mechanical sync parser.\n`;
      } else {
        terminalLog += `[briefed] Contacting LLM service backend (${activeBackend}) using model: default...\n` +
                       `[briefed] Context parsed. LLM summary returned in 0.42s.\n`;
      }
    } else {
      if (activeBackend === 'none') {
        terminalLog += `[briefed] Backend set to NONE. Running mechanical sync parser.\n`;
      } else {
        terminalLog += `[briefed] Contacting LLM service backend (${activeBackend})...\n` +
                       `[briefed] Context parsed. LLM summary returned in 0.29s.\n`;
      }
    }

    terminalLog += `[briefed] Acquiring write lock file: CLAUDE.md.lock\n` +
                   `[briefed] Deduplication scan passed. Writing context block...\n` +
                   `[briefed] Executing atomic buffer exchange renameSync to avoid file contamination.\n` +
                   `[briefed] Released write lock. Sync finished successfully! ✅\n`;

    simTerminalPre.textContent = terminalLog;
  }

  // Initial simulator render
  renderSimulatorOutput();


  // ==========================================
  // 6. CONFIGURATION BOARD GRID WIDGETS
  // ==========================================

  // Dial Switch Widget (Panel 1: Target File)
  const targetDial = document.getElementById('target-dial');
  const targetReadout = document.getElementById('readout-target');
  const lblAuto = document.getElementById('lbl-auto');
  const lblClaude = document.getElementById('lbl-claude');
  const lblAgents = document.getElementById('lbl-agents');

  let targetState = 0; // 0 = AUTO, 1 = CLAUDE.md, 2 = AGENTS.md
  const degrees = [0, 120, 240];
  const targets = ['auto', 'CLAUDE.md', 'AGENTS.md'];
  const targetLabels = ['AUTO (Resolves target)', 'CLAUDE.md', 'AGENTS.md'];
  const lblElements = [lblAuto, lblClaude, lblAgents];

  // Active configurations state
  const currentConfig = {
    target: 'auto',
    backend: 'ollama',
    model: 'llama3',
    window: {
      days: 7,
      entries: 10
    },
    ignored: ['*.lock', 'dist/', 'node_modules/'],
    minDiffLines: 10,
    maxSummaryWords: 150
  };

  if (targetDial) {
    targetDial.addEventListener('click', () => {
      targetState = (targetState + 1) % 3;
      targetDial.style.transform = `rotate(${degrees[targetState]}deg)`;
      
      if (targetReadout) targetReadout.textContent = targetLabels[targetState];
      currentConfig.target = targets[targetState];

      lblElements.forEach((el, index) => {
        if (el) {
          if (index === targetState) {
            el.classList.add('active');
          } else {
            el.classList.remove('active');
          }
        }
      });
      syncConfigDashboard();
    });
  }

  // LLM Backend Selection Button Knobs (Panel 2: LLM Backend)
  const backendBtns = document.querySelectorAll('.knob-toggle-btn');
  const backendReadout = document.getElementById('readout-backend');

  backendBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      backendBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.id.replace('btn-', '');
      if (backendReadout) backendReadout.textContent = val;
      
      currentConfig.backend = val;
      if (val === 'gemini') {
        currentConfig.model = 'gemini-2.5-flash';
      } else if (val === 'anthropic') {
        currentConfig.model = 'claude-3-5-sonnet';
      } else if (val === 'none') {
        currentConfig.model = 'none';
      } else {
        currentConfig.model = 'llama3';
      }
      syncConfigDashboard();
    });
  });

  // Slider Limit Drag Fader handle (Panel 3: Rolling Window)
  const faderTrack = document.querySelector('.fader-track');
  const faderHandle = document.getElementById('fader-handle-days');
  const daysReadout = document.getElementById('readout-days');

  let isDraggingFader = false;

  if (faderHandle && faderTrack) {
    faderHandle.addEventListener('mousedown', () => {
      isDraggingFader = true;
    });

    document.addEventListener('mouseup', () => {
      isDraggingFader = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDraggingFader) return;

      const trackRect = faderTrack.getBoundingClientRect();
      let left = e.clientX - trackRect.left;
      left = Math.max(0, Math.min(left, trackRect.width));

      const pct = left / trackRect.width;
      faderHandle.style.left = `${pct * 95}%`;

      const days = Math.round(1 + pct * 29);
      if (daysReadout) daysReadout.textContent = `${days} Days`;
      currentConfig.window.days = days;
      syncConfigDashboard();
    });
  }

  // Skip Limit slider bar (Panel 4: Smart Skip)
  const minDiffSlider = document.getElementById('min-diff-slider');
  const linesReadout = document.getElementById('readout-lines');

  if (minDiffSlider) {
    minDiffSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (linesReadout) linesReadout.textContent = `${val} Lines`;
      currentConfig.minDiffLines = val;
      syncConfigDashboard();
    });
  }

  // Telemetry Tab Routing - JSON vs Shell outputs
  const btnTabJson = document.getElementById('btn-tab-json');
  const btnTabShell = document.getElementById('btn-tab-shell');
  const telemetryContentJson = document.getElementById('telemetry-content-json');
  const telemetryContentShell = document.getElementById('telemetry-content-shell');

  if (btnTabJson && btnTabShell) {
    btnTabJson.addEventListener('click', () => {
      btnTabJson.classList.add('active');
      btnTabShell.classList.remove('active');
      if (telemetryContentJson) telemetryContentJson.classList.add('active');
      if (telemetryContentShell) telemetryContentShell.classList.remove('active');
    });

    btnTabShell.addEventListener('click', () => {
      btnTabShell.classList.add('active');
      btnTabJson.classList.remove('active');
      if (telemetryContentShell) telemetryContentShell.classList.add('active');
      if (telemetryContentJson) telemetryContentJson.classList.remove('active');
    });
  }

  // Telemetry dynamic config synchronization
  const liveConfigPreview = document.getElementById('live-config-preview');
  const liveShellPreview = document.getElementById('live-shell-preview');

  function syncConfigDashboard() {
    if (!liveConfigPreview || !liveShellPreview) return;

    // Colorize JSON output
    const jsonString = JSON.stringify(currentConfig, null, 2);
    
    // Simple custom JSON formatter for syntax highlighting
    const highlightedJson = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        let cls = 'json-num';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-str';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-bool';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });

    liveConfigPreview.innerHTML = highlightedJson;

    // Simulate verbose terminal setup outputs
    const activeBackend = currentConfig.backend;
    let verboseShellLog = `[briefed] Resolving deep-merged configuration files...\n` +
                          `[briefed] 🛡️ Shield active: constructor and prototype keys scrubbed.\n` +
                          `[briefed] Target resolver configured to: <span class="term-success">"${currentConfig.target}"</span>\n` +
                          `[briefed] Selected backend: <span class="term-success">"${activeBackend}"</span> (model: "${currentConfig.model}")\n`;

    if (activeBackend === 'gemini') {
      verboseShellLog += `[briefed] Initializing cloud adapter: Google Gemini API client\n` +
                         `[briefed] Looking for active env variable GEMINI_API_KEY... Found.\n`;
    } else if (activeBackend === 'anthropic') {
      verboseShellLog += `[briefed] Initializing cloud adapter: Anthropic messages client\n` +
                         `[briefed] Looking for active env variable ANTHROPIC_API_KEY... Found.\n`;
    } else if (activeBackend === 'none') {
      verboseShellLog += `[briefed] Active backend set to mechanical. LLM queries bypassed.\n`;
    } else {
      verboseShellLog += `[briefed] Connecting to local Ollama server at http://localhost:11434...\n` +
                         `[briefed] Successfully checked connection to local Ollama endpoint.\n`;
    }

    verboseShellLog += `[briefed] Ignored globs registered: ${JSON.stringify(currentConfig.ignored)}\n` +
                       `[briefed] Rolling age pruning window set to: <span class="term-warn">${currentConfig.window.days} days</span>\n` +
                       `[briefed] Smart Skip threshold set to: <span class="term-warn">${currentConfig.minDiffLines} lines</span>\n` +
                       `[briefed] Max summary word cap: ${currentConfig.maxSummaryWords} words (truncation ready)\n` +
                       `[briefed] Configuration successfully compiled. Ready to sync. ✅`;

    liveShellPreview.innerHTML = verboseShellLog;

    // Keep preset simulation in sync with dashboard params
    renderSimulatorOutput();
  }

  // Initial dashboard setup
  syncConfigDashboard();


  // ==========================================
  // 7. FOOTER INTERACTIVE COMMAND CONSOLE
  // ==========================================
  const terminalInput = document.getElementById('footer-terminal-input');
  const terminalHistory = document.getElementById('footer-terminal-history');

  if (terminalInput && terminalHistory) {
    terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = terminalInput.value.trim();
        if (cmd) {
          executeTerminalCommand(cmd);
          terminalInput.value = '';
        }
      }
    });
  }

  function executeTerminalCommand(cmd) {
    let response = '';
    const cleanCmd = cmd.toLowerCase().trim();

    if (cleanCmd === 'help') {
      response = `Available subcommands:\n` +
                 `  help             - Show this helper guide.\n` +
                 `  briefed config   - Print the active deep-merged JSON configuration.\n` +
                 `  briefed status   - Read your active CLAUDE.md target file and show status.\n` +
                 `  briefed run      - Manually trigger post-merge diff checks and compile context.\n` +
                 `  briefed init     - Verify Git hook integrations in the active folder.\n` +
                 `  clear            - Clear command line terminal history.`;
    } else if (cleanCmd === 'briefed config') {
      response = JSON.stringify(currentConfig, null, 2);
    } else if (cleanCmd === 'briefed status') {
      const today = new Date().toISOString().split('T')[0];
      response = `Target File: CLAUDE.md (823 bytes)\n` +
                 `Last Entry Date: ${today}\n` +
                 `Last Commit:     c97f2ab (custom-diff-run)\n` +
                 `Status:          Context perfectly aligned with git history ✅`;
    } else if (cleanCmd === 'briefed run') {
      const limitLines = currentConfig.minDiffLines;
      response = `[briefed] Computing differences between ORIG_HEAD and HEAD...\n` +
                 `[briefed] Changed files detected: src/db.ts, package.json\n` +
                 `[briefed] Accumulating total code lines: +45 lines changed.\n` +
                 `[briefed] Smart Skip: 45 lines > skip limit (${limitLines}). Running LLM summary...\n` +
                 `[briefed] Client-side secure scrubber active. (0 exposed secrets found)\n` +
                 `[briefed] Sending to LLM backend (${currentConfig.backend}) using model: ${currentConfig.model}...\n` +
                 `[briefed] LLM response gathered. Writing atomic update to CLAUDE.md...\n` +
                 `[briefed] Released write lock. Sync finished successfully! ✅`;
    } else if (cleanCmd === 'briefed init') {
      response = `[briefed] Verifying local git repository directories...\n` +
                 `[briefed] Found .git/hooks directory.\n` +
                 `[briefed] Registering post-merge hook script inside .git/hooks/post-merge\n` +
                 `[briefed] Registering post-rewrite hook script inside .git/hooks/post-rewrite\n` +
                 `[briefed] ⚠ Forcing standard Unix LF line-endings on all hook scripts.\n` +
                 `[briefed] Init complete! Briefed background hooks successfully installed. ⚡`;
    } else if (cleanCmd === 'clear') {
      terminalHistory.innerHTML = '';
      return;
    } else {
      response = `sh: command not found: ${cmd}\nType 'help' to see list of valid Briefed subcommands.`;
    }

    // Append to terminal history log
    const histRow = document.createElement('div');
    histRow.className = 'term-hist-row';

    const cmdSpan = document.createElement('div');
    cmdSpan.className = 'term-hist-cmd';
    cmdSpan.textContent = `admin@briefed-shell:~$ ${cmd}`;

    const resSpan = document.createElement('pre');
    resSpan.className = 'term-hist-res';
    resSpan.textContent = response;

    histRow.appendChild(cmdSpan);
    histRow.appendChild(resSpan);

    terminalHistory.appendChild(histRow);
    terminalHistory.scrollTop = terminalHistory.scrollHeight;
  }

});
