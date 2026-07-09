// Peek — content.js
//
// Detects likely "result" content on the page and visually hides it until
// the user reveals it. This ONLY changes local rendering (CSS/DOM display)
// — it never edits, reads into storage, or transmits any grade data.
//
// IMPORTANT — detection is heuristic:
// I haven't loaded the real page (ucam.uap-bd.edu/Module/Student/
// StudentCourseHistoryView.aspx), so the selectors below are informed
// best guesses, not verified ones. The .aspx extension tells me this is
// ASP.NET WebForms, which usually renders tables with generated IDs like
// "ctl00_ContentPlaceHolder1_GridView1" or "..._gvCourseHistory" — I've
// added a pattern for that alongside the generic guesses. Once you can
// test against the live page, open "SELECTORS TO TUNE" below and swap in
// the table's real id/class for full reliability.

(() => {
  const STORAGE_DEFAULTS = {
    theme: 'sakura',
    blur: 12,
    mode: 'blur',
    autoHide: true,
    revealed: false,
  };

  const SWAP_TEXT = {
    dots: '••••••••',
    emoji: '🌸🌸🌸🌸🌸',
    mystery: '???',
    encouragement: 'You\'ve got this 💛',
  };

  let settings = { ...STORAGE_DEFAULTS };
  let hiddenEls = [];

  // ---------------------------------------------------------------------
  // SELECTORS TO TUNE — replace/extend once tested against the real page.
  // ---------------------------------------------------------------------
  // Selectors whose id/class ALREADY names the field (e.g. "lblObtainedGrade").
  // These are trustworthy on their own — no need to also sniff the node's
  // rendered text, which matters because a letter grade's actual text ("A",
  // "B+", "I") will never contain the word "grade" or match a GPA-shaped
  // decimal. Requiring a text-content match on TOP of an id/class match is
  // what silently dropped the Grade column even after its selector matched.
  //
  // Deliberately narrow: only the specific result fields (grade, gpa, cgpa,
  // credit, marks). Earlier versions also included broad catch-alls like
  // `[id*="lbl" i]` (every ASP.NET label on the page — Student Name, Course
  // Name, everything) and a bare `table` / gridview-container selector
  // (which, once it passed the text sniff, swallowed the ENTIRE table as
  // one unit via the "keep outermost" rule below). Both over-hid unrelated
  // columns. Only field-specific keywords belong here.
  const KEYWORD_SELECTORS = [
    '[class*="grade" i]',
    '[id*="grade" i]',            // confirmed live: <span id="..._lblObtainedGrade"> has NO class,
                                   // only an id — class-only matching missed it entirely
    '[class*="gpa" i]',
    '[id*="gpa" i]',
    '[class*="cgpa" i]',
    '[id*="cgpa" i]',
    '[class*="marks" i]',
    '[id*="marks" i]',
    '[class*="credit" i]',
    '[id*="credit" i]',          // confirmed live: <span id="..._lblCourseCredit"> — "credit"
                                  // isn't covered by any of the keywords above, and its value
                                  // (e.g. "3.00") doesn't reliably read as a result on its own
  ];

  // No structural (whole-table) selectors — hiding is scoped to the
  // individual result-field elements matched above, not their containers.
  const STRUCTURAL_SELECTORS = [];

  const TEXT_HINTS = /\b(cgpa|gpa|grade|marks?|result|credits?|course\s*history)\b/i;
  const GPA_NUMBER = /\b[0-4]\.\d{1,2}\b/; // e.g. 3.75, common GPA format

  // Browsers flatten adjacent cell text with no separating whitespace
  // (e.g. two <td> cells "Grade" and "GPA" collapse to "GradeGPA" in
  // .textContent), which silently defeats \b word-boundary matching.
  // Walk the tree and join each element's own text with spaces so
  // TEXT_HINTS/GPA_NUMBER can actually see cell boundaries.
  function spacedText(node) {
    const parts = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) {
      const trimmed = current.textContent.trim();
      if (trimmed) parts.push(trimmed);
    }
    return parts.join(' ');
  }

  function looksLikeResultNode(node, requireTextMatch) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.closest('#peek-overlay-root')) return false; // never hide our own UI
    const rawText = node.textContent || '';
    // A full course-history table (many semesters x many courses) can
    // legitimately exceed a small character cap — that's not the same as
    // "this is the whole page." Scale the cap by row count for <table>
    // nodes so a genuinely large result table doesn't get silently
    // rejected here and fall back to only some of its individual cells
    // matching narrower selectors (which is how you can end up with some
    // columns hidden and others, like "Grade", left fully visible).
    const rowCount = node.tagName === 'TABLE' ? node.querySelectorAll('tr').length : 0;
    const cap = rowCount > 0 ? Math.max(4000, rowCount * 300) : 4000;
    if (rawText.length > cap) return false; // likely a whole-page container, too broad
    if (!requireTextMatch) return true; // id/class already told us what this is
    const text = spacedText(node);
    return TEXT_HINTS.test(text) || GPA_NUMBER.test(text);
  }

  function findResultNodes() {
    const seen = new Set();
    const candidates = [];

    const collect = (selectors, requireTextMatch) => {
      for (const sel of selectors) {
        let found;
        try {
          found = document.querySelectorAll(sel);
        } catch {
          continue;
        }
        found.forEach((node) => {
          if (seen.has(node)) return;
          if (looksLikeResultNode(node, requireTextMatch)) {
            seen.add(node);
            candidates.push(node);
          }
        });
      }
    };

    collect(KEYWORD_SELECTORS, false);   // id/class already identifies the field — trust it
    collect(STRUCTURAL_SELECTORS, true); // bare <table> needs the text-content sniff

    // Drop any candidate that is itself a DESCENDANT of another candidate —
    // hiding both a table and its wrapping <div> double-applies the effect
    // and can duplicate the swap-text overlay. Keep the OUTERMOST match.
    //
    // This direction matters: a result table often matches via a broad
    // selector like `table` or `[id*="gridview" i]`, while only SOME of
    // its cells (e.g. a "Grade Point" <td>) additionally match a narrower
    // selector like `[class*="grade" i]`. If we kept the innermost match
    // instead, we'd drop the whole table (since it "contains" those cells)
    // and hide only the scattered cells that happened to match a narrower
    // pattern — leaving other columns (e.g. "Grade") fully visible. Keeping
    // the outermost match ensures the whole result table/row is hidden as
    // one unit instead of a patchwork of individual cells.
    return candidates.filter((node) =>
      !candidates.some((other) => other !== node && other.contains(node))
    );
  }

  // ---------------------------------------------------------------------
  // Apply / remove hidden styling
  // ---------------------------------------------------------------------

  function applyHiddenMode(node) {
    node.classList.remove('peek-hidden-blur', 'peek-hidden-swap', 'peek-revealed');
    if (settings.mode === 'blur') {
      node.classList.add('peek-hidden-blur');
    } else {
      const swapText = SWAP_TEXT[settings.mode] || SWAP_TEXT.dots;
      node.setAttribute('data-peek-swap-text', swapText);
      node.classList.add('peek-hidden-swap');
    }
  }

  function hideAll() {
    hiddenEls = findResultNodes();
    hiddenEls.forEach(applyHiddenMode);
  }

  function revealAll() {
    hiddenEls.forEach((node) => node.classList.add('peek-revealed'));
  }

  function reHideAll() {
    hiddenEls.forEach((node) => {
      node.classList.remove('peek-revealed');
      applyHiddenMode(node);
    });
  }

  function setBlurVar(px) {
    document.documentElement.style.setProperty('--peek-blur', `${px}px`);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-peek-theme', theme);
  }

  // ---------------------------------------------------------------------
  // Messages from popup.js
  // ---------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'PEEK_REVEAL':
        settings.revealed = true;
        revealAll();
        break;
      case 'PEEK_HIDE':
        settings.revealed = false;
        reHideAll();
        break;
      case 'PEEK_SET_THEME':
        settings.theme = msg.theme;
        setTheme(msg.theme);
        break;
      case 'PEEK_SET_BLUR':
        settings.blur = msg.blur;
        setBlurVar(msg.blur);
        break;
      case 'PEEK_SET_MODE':
        settings.mode = msg.mode;
        if (!settings.revealed) reHideAll();
        break;
      case 'PEEK_OPEN_TOOLS':
        window.PeekPanel?.toggle();
        break;
    }
  });

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------

  chrome.storage.sync.get(STORAGE_DEFAULTS, (stored) => {
    settings = { ...STORAGE_DEFAULTS, ...stored };
    setTheme(settings.theme);
    setBlurVar(settings.blur);

    if (settings.autoHide) {
      hideAll();
      if (settings.revealed) revealAll();
    }
  });

  // Result tables on academic portals often render after an async fetch.
  // Watch for late-arriving nodes for a short window after load, then stop
  // observing so we don't pay a perf cost for the life of the page.
  const observer = new MutationObserver(() => {
    if (settings.autoHide && !settings.revealed) {
      const fresh = findResultNodes().filter((n) => !hiddenEls.includes(n));
      if (fresh.length) {
        fresh.forEach((n) => { applyHiddenMode(n); hiddenEls.push(n); });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 8000);
})();
