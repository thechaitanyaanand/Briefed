// App logic for Briefed Landing Page

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
    // Add smooth trail interpolation
    const ease = 0.2;
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
  const clickables = document.querySelectorAll('button, a, .floppy-card, .sim-switch-box, .rotary-dial, .brutal-slider, .fader-track');
  clickables.forEach(item => {
    item.addEventListener('mouseenter', () => {
      cursor.classList.add('hovering');
    });
    item.addEventListener('mouseleave', () => {
      cursor.classList.remove('hovering');
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
    { text: '✓ Hook capabilities resolved successfully.', type: 'success', delay: 400 },
    { text: '✓ Hook target resolved: CLAUDE.md', type: 'success', delay: 300 },
    { text: '  - Running post-merge and post-rewrite hook hooks...', type: 'gray', delay: 200 },
    { text: '✓ Installed post-merge hook script inside .git/hooks/', type: 'success', delay: 400 },
    { text: '✓ Installed post-rewrite hook script inside .git/hooks/', type: 'success', delay: 300 },
    { text: '  ⚠ Forcing Unix LF endings on hook scripts.', type: 'warn', delay: 200 },
    { text: '✓ Config saved to .briefed.json successfully!', type: 'success', delay: 400 },
    { text: '\nNext Steps:', type: 'white', delay: 200 },
    { text: '  1. Add CLAUDE.md to version control:', type: 'gray', delay: 100 },
    { text: '     git add CLAUDE.md .briefed.json', type: 'white', delay: 100 },
    { text: '  2. Run briefed run to manually sync context.', type: 'gray', delay: 100 },
    { text: '  3. Pull or merge changes — Briefed runs background updates!', type: 'gray', delay: 100 }
  ];

  function typeChar() {
    if (typeIndex < textToType.length) {
      typedSpan.textContent += textToType.charAt(typeIndex);
      typeIndex++;
      setTimeout(typeChar, 80 + Math.random() * 50);
    } else {
      // Done typing, hide blinking command prompt cursor on this line
      terminalCursor.style.display = 'none';
      setTimeout(triggerOutput, 300);
    }
  }

  let logIndex = 0;
  function triggerOutput() {
    if (logIndex < logs.length) {
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

  // Trigger typing after 1 second delay
  setTimeout(typeChar, 1000);


  // ==========================================
  // 3. COPY INSTALL COMMAND INTERACTION
  // ==========================================
  const installBtn = document.getElementById('install-copy-btn');
  const ctaBtn = document.getElementById('cta-install-btn');
  const tooltip = document.getElementById('copy-tooltip');

  function copyText() {
    const textToCopy = 'npm install -g briefed';
    navigator.clipboard.writeText(textToCopy).then(() => {
      tooltip.style.display = 'block';
      setTimeout(() => {
        tooltip.style.display = 'none';
      }, 2000);
    });
  }

  if (installBtn) installBtn.addEventListener('click', copyText);
  if (ctaBtn) ctaBtn.addEventListener('click', copyText);


  // ==========================================
  // 4. FLOOPY DISK SHUTTER SLIDE INTERACTION
  // ==========================================
  const floppyCards = document.querySelectorAll('.floppy-card');
  floppyCards.forEach(card => {
    const metalShutter = card.querySelector('.shutter-metal');
    
    card.addEventListener('mouseenter', () => {
      // Slide metal shutter to the right
      if (metalShutter) {
        metalShutter.style.transform = 'translateX(60px)';
        metalShutter.style.transition = 'transform 0.2s ease-out';
      }
    });

    card.addEventListener('mouseleave', () => {
      // Slide metal shutter back
      if (metalShutter) {
        metalShutter.style.transform = 'translateX(0px)';
      }
    });

    card.addEventListener('click', () => {
      // Toggles notch slide protection notch on click
      const protectNotch = card.querySelector('.notch-slider');
      if (protectNotch) {
        const isNotched = protectNotch.style.transform === 'translateY(-6px)';
        protectNotch.style.transform = isNotched ? 'translateY(0px)' : 'translateY(-6px)';
        protectNotch.style.transition = 'transform 0.1s ease';
      }
    });
  });


  // ==========================================
  // 5. LIVE SIMULATOR ENGINE (Toggles & Outputs)
  // ==========================================
  const toggleAuth = document.getElementById('toggle-auth');
  const toggleDeps = document.getElementById('toggle-deps');
  const toggleBugfix = document.getElementById('toggle-bugfix');
  const simOutput = document.getElementById('simulator-output-pre');

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

  function renderSimulatorOutput() {
    const isAuth = switches.find(s => s.id === 'auth').active;
    const isDeps = switches.find(s => s.id === 'deps').active;
    const isBugfix = switches.find(s => s.id === 'bugfix').active;

    let markdown = '';

    if (!isAuth && !isDeps && !isBugfix) {
      markdown = `admin@briefed-shell:~$ briefed run\n` + 
                 `· No new commits or changes detected. (Workspace context is fully up to date) ⚡`;
      simOutput.textContent = markdown;
      return;
    }

    // Dynamic state computation based on switches
    let files = [];
    let added = [];
    let removed = [];
    let deps = [];
    let hashes = [];
    let additionsTotal = 0;
    let deletionsTotal = 0;
    let commitName = 'Update';

    if (isAuth) {
      files.push('src/auth.ts', 'src/types.ts');
      added.push('OAuth2 login flow helper', 'OAuthTokenTypes interface');
      removed.push('Old insecure JWT legacy crypt.ts');
      hashes.push('abc123auth');
      additionsTotal += 145;
      deletionsTotal += 32;
      commitName = 'feature/auth-oauth2';
    }

    if (isDeps) {
      files.push('package.json', 'package-lock.json');
      added.push('Chalk utility library package');
      removed.push('Legacy terminal formatter package');
      hashes.push('789f21deps');
      additionsTotal += 22;
      deletionsTotal += 12;
      if (commitName === 'Update') commitName = 'patch/upgrade-packages';
    }

    if (isBugfix) {
      files.push('src/hook.ts');
      added.push('Unix LF line-endings formatter');
      removed.push('Windows CRLF carriage returns');
      hashes.push('de7410hook');
      additionsTotal += 12;
      deletionsTotal += 4;
      if (commitName === 'Update') commitName = 'hotfix/windows-crlf';
    }

    // Compose final printed markdown block
    const finalHash = hashes.join(', ');
    const displayFiles = files.join(', ');
    const displayAdded = added.join(', ');
    const displayRemoved = removed.join(', ');

    markdown = `# AI Context (Autogenerated Log)\n\n` +
               `<!-- BRIEFED_START -->\n` +
               `## [2026-06-02] ${hashes[0] || 'commit123'} (${commitName})\n` +
               `FILES: ${displayFiles}\n\n` +
               `ADDED: ${displayAdded}\n` +
               `REMOVED: ${displayRemoved}\n` +
               `DEPS: ${additionsTotal} insertions (+), ${deletionsTotal} deletions (-)\n` +
               `<!-- BRIEFED_END -->\n\n` +
               `# Project Context Continued...`;

    simOutput.textContent = markdown;
  }

  // Run initial render
  renderSimulatorOutput();


  // ==========================================
  // 6. CONFIGURATION GRID WIDGETS
  // ==========================================

  // Dial Switch Widget (Panel 1)
  const targetDial = document.getElementById('target-dial');
  const targetReadout = document.getElementById('readout-target');
  const lblAuto = document.getElementById('lbl-auto');
  const lblClaude = document.getElementById('lbl-claude');
  const lblAgents = document.getElementById('lbl-agents');

  let targetState = 0; // 0 = AUTO, 1 = CLAUDE.md, 2 = AGENTS.md
  const degrees = [0, 120, 240];
  const labels = ['AUTO (Resolves target)', 'CLAUDE.md', 'AGENTS.md'];
  const lblElements = [lblAuto, lblClaude, lblAgents];

  if (targetDial) {
    targetDial.addEventListener('click', () => {
      targetState = (targetState + 1) % 3;
      // Rotate dialpointer
      targetDial.style.transform = `rotate(${degrees[targetState]}deg)`;
      
      // Update readout text
      targetReadout.textContent = labels[targetState];

      // Update indicator dots active state
      lblElements.forEach((el, index) => {
        if (index === targetState) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    });
  }

  // LLM Backend Selection Button Knobs (Panel 2)
  const backendBtns = document.querySelectorAll('.knob-toggle-btn');
  const backendReadout = document.getElementById('readout-backend');

  backendBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      backendBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.id.replace('btn-', '');
      backendReadout.textContent = val;
    });
  });

  // Slider Limit Drag Fader handle (Panel 3)
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

      // Calculate percentage
      const pct = left / trackRect.width;
      faderHandle.style.left = `${pct * 95}%`; // limit handles boundaries

      // Map percentage to days limit (1 to 30 days)
      const days = Math.round(1 + pct * 29);
      daysReadout.textContent = `${days} Days`;
    });
  }

  // Skip Limit slider bar (Panel 4)
  const minDiffSlider = document.getElementById('min-diff-slider');
  const linesReadout = document.getElementById('readout-lines');

  if (minDiffSlider) {
    minDiffSlider.addEventListener('input', (e) => {
      linesReadout.textContent = `${e.target.value} Lines`;
    });
  }

});
