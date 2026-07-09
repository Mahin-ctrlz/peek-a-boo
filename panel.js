// Peek — panel.js
//
// The floating "Tools" panel. Fully manual: the student types in their own
// courses (semester, credit, grade) and Peek computes CGPA from that —
// nothing is scraped from the page, and nothing is saved between visits.
// Target, Trend, and Share all read from this same typed-in course list.
// No network calls, nothing leaves the browser, nothing persists.

(() => {
  let panelRoot = null;
  let activeTab = 'calc';

  // The single source of truth for the whole panel: courses the student
  // has typed in. Cleared every time the panel is opened fresh (per
  // design — Peek never saves grades between visits).
  // Shape: { semester: string, credit: number, grade: string }
  let courses = [];

  const GRADE_OPTIONS = window.PeekGrades.GRADE_SCALE.map((g) => g.letter);

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function fmt(n, digits = 2) {
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  }

  function newCourseRow() {
    return { semester: '', credit: 3, grade: 'A' };
  }

  function parsedCourses() {
    return courses
      .map((c) => ({ ...window.PeekGrades.parseCourse(c.credit, c.grade), semester: c.semester || 'Unlabeled' }))
      .filter((c) => c.credit > 0);
  }

  function currentSummary() {
    return window.PeekGrades.summarize(parsedCourses());
  }

  // -----------------------------------------------------------------------
  // Panel shell
  // -----------------------------------------------------------------------

  function ensureRoot() {
    if (panelRoot) return panelRoot;
    panelRoot = document.createElement('div');
    panelRoot.id = 'peek-panel-root';
    document.documentElement.appendChild(panelRoot);
    return panelRoot;
  }

  function render() {
    const root = ensureRoot();
    root.innerHTML = '';

    const panel = el('div', 'peek-panel');

    const header = el('div', 'peek-panel-header');
    header.appendChild(el('h2', 'peek-panel-title', '📊 CGPA Tools'));
    const closeBtn = el('button', 'peek-panel-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const tabs = el('div', 'peek-panel-tabs');
    const tabDefs = [
      ['calc', 'Calculator'],
      ['target', 'Target'],
      ['trend', 'Trend'],
      ['share', 'Share'],
    ];
    tabDefs.forEach(([key, label]) => {
      const btn = el('button', 'peek-tab-btn' + (activeTab === key ? ' active' : ''), label);
      btn.type = 'button';
      btn.addEventListener('click', () => { activeTab = key; render(); });
      tabs.appendChild(btn);
    });
    panel.appendChild(tabs);

    const body = el('div', 'peek-panel-body');
    body.appendChild(renderTab(activeTab));
    panel.appendChild(body);

    root.appendChild(panel);
  }

  function renderTab(tab) {
    switch (tab) {
      case 'calc': return renderCalculator();
      case 'target': return renderTarget();
      case 'trend': return renderTrend();
      case 'share': return renderShare();
      default: return el('div');
    }
  }

  function toggle() {
    if (panelRoot) {
      close();
    } else {
      activeTab = 'calc';
      courses = []; // start blank every time, per design — nothing persists
      render();
    }
  }

  function close() {
    panelRoot?.remove();
    panelRoot = null;
  }

  // -----------------------------------------------------------------------
  // Calculator tab — manual course entry, computes real CGPA
  // -----------------------------------------------------------------------

  function renderCalculator() {
    const wrap = el('div');

    wrap.appendChild(el('p', 'peek-panel-section-title', 'Enter your courses'));
    const note = el('p', 'peek-empty-note',
      "Nothing here is saved or read from the page — type in each course's semester, credit hours, and grade.");
    note.style.textAlign = 'left';
    note.style.padding = '0 0 8px';
    wrap.appendChild(note);

    const listWrap = el('div');
    listWrap.id = 'peek-course-list';
    if (courses.length === 0) {
      listWrap.appendChild(el('p', 'peek-empty-note', 'No courses added yet.'));
    } else {
      courses.forEach((c, i) => listWrap.appendChild(renderCourseRow(c, i)));
    }
    wrap.appendChild(listWrap);

    const addBtn = el('button', 'peek-add-btn', '+ Add a course');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => {
      courses.push(newCourseRow());
      render(); // structural change (new row) — full re-render is fine here
    });
    wrap.appendChild(addBtn);

    const resultSlot = el('div');
    resultSlot.id = 'peek-calc-result-slot';
    resultSlot.appendChild(buildCalcResult());
    wrap.appendChild(resultSlot);

    return wrap;
  }

  function buildCalcResult() {
    const summary = currentSummary();
    const validCount = parsedCourses().length;
    if (validCount === 0) return el('div');

    const banner = el('div', 'peek-projection-banner');
    banner.appendChild(el('div', 'peek-stat-label', 'Your CGPA'));
    banner.appendChild(el('div', 'peek-projection-number', fmt(summary.cgpa)));
    banner.appendChild(el('div', 'peek-projection-delta flat',
      `from ${validCount} course${validCount === 1 ? '' : 's'}, ${fmt(summary.creditSum, 1)} credits`));
    return banner;
  }

  // Re-renders ONLY the result banner, so typing a credit value doesn't
  // rebuild the whole panel and steal focus mid-keystroke.
  function refreshCalcResult() {
    const slot = document.getElementById('peek-calc-result-slot');
    if (!slot) return;
    slot.innerHTML = '';
    slot.appendChild(buildCalcResult());
  }

  function renderCourseRow(c, index) {
    const row = el('div', 'peek-course-row');

    const semesterInput = el('input');
    semesterInput.className = 'peek-input';
    semesterInput.type = 'text';
    semesterInput.value = c.semester;
    semesterInput.placeholder = 'Semester (optional)';
    semesterInput.addEventListener('input', (e) => {
      courses[index].semester = e.target.value;
      // Label-only change — no need to touch the CGPA result, but Trend
      // groups by this label, so nothing else to refresh here.
    });

    const creditInput = el('input');
    creditInput.className = 'peek-input';
    creditInput.type = 'number';
    creditInput.min = '0';
    creditInput.step = '0.5';
    creditInput.value = c.credit;
    creditInput.placeholder = 'Credits';
    creditInput.addEventListener('input', (e) => {
      courses[index].credit = Number(e.target.value) || 0;
      refreshCalcResult(); // partial update — keeps typing focus in this field
    });

    const gradeSelect = el('select');
    GRADE_OPTIONS.forEach((g) => {
      const opt = el('option', null, g);
      opt.value = g;
      if (g === c.grade) opt.selected = true;
      gradeSelect.appendChild(opt);
    });
    gradeSelect.addEventListener('change', (e) => {
      courses[index].grade = e.target.value;
      refreshCalcResult();
    });

    const removeBtn = el('button', 'peek-remove-btn', '✕');
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      courses.splice(index, 1);
      render(); // structural change (row removed) — full re-render is fine
    });

    row.appendChild(semesterInput);
    row.appendChild(creditInput);
    row.appendChild(gradeSelect);
    row.appendChild(removeBtn);
    return row;
  }

  // -----------------------------------------------------------------------
  // Target tab — "what average grade do I need?"
  // -----------------------------------------------------------------------

  let targetState = { targetCgpa: 3.5, remainingCredits: 12 };

  function renderTarget() {
    const wrap = el('div');

    const summary = currentSummary();
    if (parsedCourses().length === 0) {
      wrap.appendChild(el('p', 'peek-empty-note',
        'Add your courses in the Calculator tab first — Target uses your current CGPA and credits from there.'));
      return wrap;
    }

    const currentRow = el('div', 'peek-stat-row');
    currentRow.appendChild(el('span', 'peek-stat-label', 'Current CGPA'));
    currentRow.appendChild(el('span', 'peek-stat-value', fmt(summary.cgpa)));
    wrap.appendChild(currentRow);

    wrap.appendChild(el('p', 'peek-panel-section-title', 'Set your goal'));

    const row1 = el('div', 'peek-hyp-row');
    row1.style.gridTemplateColumns = '1fr 1fr';
    const targetInput = el('input');
    targetInput.className = 'peek-input';
    targetInput.type = 'number';
    targetInput.min = '0';
    targetInput.max = '4';
    targetInput.step = '0.01';
    targetInput.value = targetState.targetCgpa;
    targetInput.placeholder = 'Target CGPA';
    targetInput.addEventListener('input', (e) => {
      targetState.targetCgpa = Number(e.target.value) || 0;
      refreshTarget();
    });

    const creditsInput = el('input');
    creditsInput.className = 'peek-input';
    creditsInput.type = 'number';
    creditsInput.min = '0';
    creditsInput.step = '0.5';
    creditsInput.value = targetState.remainingCredits;
    creditsInput.placeholder = 'Remaining credits';
    creditsInput.addEventListener('input', (e) => {
      targetState.remainingCredits = Number(e.target.value) || 0;
      refreshTarget();
    });

    row1.appendChild(targetInput);
    row1.appendChild(creditsInput);
    wrap.appendChild(row1);

    const labelsRow = el('div', 'peek-hyp-row');
    labelsRow.style.gridTemplateColumns = '1fr 1fr';
    labelsRow.style.marginTop = '-2px';
    labelsRow.appendChild(el('span', 'peek-empty-note', 'Target CGPA'));
    labelsRow.appendChild(el('span', 'peek-empty-note', 'Credits left'));
    wrap.appendChild(labelsRow);

    const resultSlot = el('div');
    resultSlot.id = 'peek-target-result-slot';
    resultSlot.appendChild(buildTargetResult());
    wrap.appendChild(resultSlot);

    return wrap;
  }

  function buildTargetResult() {
    const summary = currentSummary();
    const container = el('div');
    const required = window.PeekGrades.requiredAveragePoint(
      summary.qualityPoints,
      summary.creditSum,
      targetState.remainingCredits,
      targetState.targetCgpa
    );
    const status = window.PeekGrades.feasibility(required);

    const banner = el('div', 'peek-projection-banner');
    banner.appendChild(el('div', 'peek-stat-label', 'You need an average of'));
    if (status === 'already-met') {
      banner.appendChild(el('div', 'peek-projection-number', '✓'));
    } else {
      banner.appendChild(el('div', 'peek-projection-number', fmt(Math.max(0, required))));
      banner.appendChild(el('div', 'peek-projection-delta flat',
        `≈ ${window.PeekGrades.letterForPoint(Math.max(0, Math.min(4, required)))} or better`));
    }
    container.appendChild(banner);

    const feasibilityEl = el('div', `peek-feasibility ${status}`);
    feasibilityEl.textContent =
      status === 'impossible'
        ? `That target isn't reachable in ${targetState.remainingCredits} remaining credits — even straight A+ won't get there. Try more credits or a lower target.`
        : status === 'already-met'
        ? "You're already there — keep doing what you're doing. 🌸"
        : `Averaging a ${window.PeekGrades.letterForPoint(Math.max(0, Math.min(4, required)))} across your remaining courses would get you to your target.`;
    container.appendChild(feasibilityEl);

    return container;
  }

  // Re-renders ONLY the target-result slot, so typing in the target/credits
  // inputs doesn't rebuild the whole panel and steal focus mid-keystroke.
  function refreshTarget() {
    const slot = document.getElementById('peek-target-result-slot');
    if (!slot) return;
    slot.innerHTML = '';
    slot.appendChild(buildTargetResult());
  }

  // -----------------------------------------------------------------------
  // Trend tab — semester-by-semester GPA, computed live from typed courses
  // -----------------------------------------------------------------------
  //
  // Since nothing is scraped or saved between visits, a cross-session CGPA
  // history isn't available here. Instead: group the courses you've typed
  // in by their Semester label (from the Calculator tab) and show each
  // semester's GPA side by side, so you can compare your own semesters
  // within this one sitting.

  function renderTrend() {
    const wrap = el('div');
    wrap.appendChild(el('p', 'peek-panel-section-title', 'GPA by semester'));

    const valid = parsedCourses();
    if (valid.length === 0) {
      wrap.appendChild(el('p', 'peek-empty-note',
        'Add your courses in the Calculator tab first, with a semester label on each (e.g. "Fall 2025"), to compare semesters here.'));
      return wrap;
    }

    const bySemester = new Map();
    valid.forEach((c) => {
      const key = c.semester || 'Unlabeled';
      if (!bySemester.has(key)) bySemester.set(key, []);
      bySemester.get(key).push(c);
    });

    if (bySemester.size < 2) {
      wrap.appendChild(el('p', 'peek-empty-note',
        'Give at least two courses different semester labels in the Calculator tab (e.g. "Fall 2025" and "Spring 2026") to see a comparison here.'));
      return wrap;
    }

    const points = Array.from(bySemester.entries()).map(([semester, list]) => ({
      semester,
      gpa: window.PeekGrades.summarize(list).cgpa,
    }));

    wrap.appendChild(buildTrendSvg(points));

    const listEl = el('div');
    points.forEach((p) => {
      const row = el('div', 'peek-stat-row');
      row.appendChild(el('span', 'peek-stat-label', p.semester));
      row.appendChild(el('span', 'peek-stat-value', fmt(p.gpa)));
      listEl.appendChild(row);
    });
    wrap.appendChild(listEl);

    return wrap;
  }

  function buildTrendSvg(points) {
    const width = 320, height = 140, padX = 24, padY = 18;
    const values = points.map((p) => p.gpa);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 4);
    const xStep = (width - padX * 2) / Math.max(1, points.length - 1);

    const xy = (i, v) => {
      const x = padX + i * xStep;
      const y = height - padY - ((v - min) / (max - min || 1)) * (height - padY * 2);
      return [x, y];
    };

    const pathD = points.map((p, i) => {
      const [x, y] = xy(i, p.gpa);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const dots = points.map((p, i) => {
      const [x, y] = xy(i, p.gpa);
      return `<circle class="peek-trend-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"></circle>`;
    }).join('');

    const labels = points.map((p, i) => {
      const [x] = xy(i, p.gpa);
      return `<text class="peek-trend-label" x="${x.toFixed(1)}" y="${height - 4}" text-anchor="middle">${escapeXml(p.semester.slice(0, 10))}</text>`;
    }).join('');

    const svgWrap = el('div');
    svgWrap.innerHTML = `
      <svg class="peek-trend-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <line class="peek-trend-axis" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
        <path class="peek-trend-line" d="${pathD}"></path>
        ${dots}
        ${labels}
      </svg>
    `;
    return svgWrap.firstElementChild;
  }

  function escapeXml(str) {
    return str.replace(/[<>&"']/g, (c) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
    }[c]));
  }

  // -----------------------------------------------------------------------
  // Share tab — canvas-rendered result card, downloadable as PNG
  // -----------------------------------------------------------------------

  let shareOptions = { includeCgpa: true, includeGrades: false };

  function renderShare() {
    const wrap = el('div');

    if (parsedCourses().length === 0) {
      wrap.appendChild(el('p', 'peek-empty-note',
        'Add your courses in the Calculator tab first — Share uses your CGPA and grades from there.'));
      return wrap;
    }

    wrap.appendChild(el('p', 'peek-panel-section-title', 'Shareable card'));

    const toggleRow1 = el('label', 'peek-share-toggle-row');
    toggleRow1.innerHTML = `<span>Show CGPA number</span>`;
    const cb1 = el('input');
    cb1.type = 'checkbox';
    cb1.checked = shareOptions.includeCgpa;
    cb1.addEventListener('change', (e) => { shareOptions.includeCgpa = e.target.checked; render(); });
    toggleRow1.appendChild(cb1);

    const toggleRow2 = el('label', 'peek-share-toggle-row');
    toggleRow2.innerHTML = `<span>Show individual grades</span>`;
    const cb2 = el('input');
    cb2.type = 'checkbox';
    cb2.checked = shareOptions.includeGrades;
    cb2.addEventListener('change', (e) => { shareOptions.includeGrades = e.target.checked; render(); });
    toggleRow2.appendChild(cb2);

    wrap.appendChild(toggleRow1);
    wrap.appendChild(toggleRow2);

    const previewWrap = el('div', 'peek-share-preview-wrap');
    const canvas = document.createElement('canvas');
    canvas.id = 'peek-share-canvas';
    canvas.width = 480;
    canvas.height = 320;
    previewWrap.appendChild(canvas);
    wrap.appendChild(previewWrap);

    drawShareCard(canvas, shareOptions);

    const downloadBtn = el('button', 'peek-primary-btn', '⬇ Download image');
    downloadBtn.type = 'button';
    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = 'my-results.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
    wrap.appendChild(downloadBtn);

    return wrap;
  }

  function themeColor(varName, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }

  function drawShareCard(canvas, options) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const summary = currentSummary();
    const valid = parsedCourses();

    const bg = themeColor('--peek-bg', '#FFF8FB');
    const primary = themeColor('--peek-primary', '#FF8FB8');
    const ink = themeColor('--peek-primary-ink', '#7A2E4C');
    const text = themeColor('--peek-text', '#3D3D3D');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Soft accent circle, decorative
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(w - 40, 40, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = ink;
    ctx.font = '600 22px Quicksand, sans-serif';
    ctx.fillText('🌸 My Results', 28, 50);

    ctx.fillStyle = text;
    ctx.font = '600 13px Quicksand, sans-serif';
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillText(dateStr, 28, 74);

    let y = 130;
    if (options.includeCgpa) {
      ctx.fillStyle = ink;
      ctx.font = '700 48px Quicksand, sans-serif';
      ctx.fillText(fmt(summary.cgpa), 28, y + 20);
      ctx.fillStyle = text;
      ctx.font = '600 13px Quicksand, sans-serif';
      ctx.fillText('CGPA', 28, y + 44);
      y += 90;
    } else {
      ctx.fillStyle = ink;
      ctx.font = '600 20px Quicksand, sans-serif';
      ctx.fillText('Results revealed ✨', 28, y + 20);
      y += 50;
    }

    if (options.includeGrades) {
      ctx.font = '600 12px Quicksand, sans-serif';
      ctx.fillStyle = text;
      const perLine = 6;
      valid.slice(0, 12).forEach((c, i) => {
        const col = i % perLine;
        const row = Math.floor(i / perLine);
        const x = 28 + col * 72;
        const cy = y + row * 26;
        ctx.fillStyle = primary;
        ctx.fillRect(x, cy - 14, 60, 20);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(c.grade || '—', x + 30, cy);
        ctx.textAlign = 'left';
      });
    }

    ctx.fillStyle = text;
    ctx.globalAlpha = 0.6;
    ctx.font = '600 11px Quicksand, sans-serif';
    ctx.fillText('Made with Peek 🌸', 28, h - 20);
    ctx.globalAlpha = 1;
  }

  window.PeekPanel = { toggle, close };
})();
