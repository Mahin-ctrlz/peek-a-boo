// Peek — popup.js
// Reads/writes settings via chrome.storage.sync, talks to content.js via
// chrome.tabs.sendMessage. No network calls of any kind.

const DEFAULTS = {
  theme: 'sakura',
  blur: 12,
  mode: 'blur',
  autoHide: true,
  revealed: false, // per-session state, reset by background.js on nav
};

const MESSAGES = [
  "Ready when you are.",
  "One step at a time.",
  "Results don't define you.",
  "Take your time.",
  "Whatever happens, you'll be okay.",
  "You've already done the hard part.",
  "Breathe, then peek.",
  "No rush.",
  "You got this.",
  "Be proud of yourself.",
];

const $ = (id) => document.getElementById(id);

const els = {
  body: document.body,
  message: $('peek-message'),
  revealBtn: $('peek-reveal-btn'),
  revealLabel: $('peek-reveal-label'),
  hideBtn: $('peek-hide-btn'),
  toolsBtn: $('peek-tools-btn'),
  themeSelect: $('peek-theme-select'),
  blurSlider: $('peek-blur-slider'),
  modeSelect: $('peek-mode-select'),
  autoToggle: $('peek-auto-toggle'),
  sparkles: $('peek-sparkles'),
};

let state = { ...DEFAULTS };
let activeTabId = null;

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function applyTheme(theme) {
  els.body.setAttribute('data-peek-theme', theme);
}

function applyBlurVar(px) {
  els.body.style.setProperty('--peek-blur', `${px}px`);
}

function renderRevealState() {
  if (state.revealed) {
    els.revealLabel.textContent = 'Revealed';
    els.revealBtn.disabled = true;
    els.revealBtn.style.opacity = '0.6';
    els.revealBtn.style.cursor = 'default';
    els.hideBtn.hidden = false;
  } else {
    els.revealLabel.textContent = 'Reveal results';
    els.revealBtn.disabled = false;
    els.revealBtn.style.opacity = '1';
    els.revealBtn.style.cursor = 'pointer';
    els.hideBtn.hidden = true;
  }
}

function swapMessage(text) {
  els.message.textContent = text;
  els.message.classList.remove('peek-message-swap');
  // Force reflow so the animation can re-trigger.
  void els.message.offsetWidth;
  els.message.classList.add('peek-message-swap');
}

function spawnSparkles() {
  const positions = [
    { top: '4px', left: '2px' },
    { top: '10px', right: '0px' },
    { bottom: '6px', left: '18px' },
  ];
  positions.forEach((pos, i) => {
    const el = document.createElement('span');
    el.className = 'peek-sparkle';
    el.textContent = '✨';
    Object.assign(el.style, pos, { animationDelay: `${i * 80}ms` });
    els.sparkles.appendChild(el);
    setTimeout(() => el.remove(), 1000 + i * 80);
  });
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    state = { ...DEFAULTS, ...stored };
    els.themeSelect.value = state.theme;
    els.blurSlider.value = state.blur;
    els.modeSelect.value = state.mode;
    els.autoToggle.checked = state.autoHide;

    applyTheme(state.theme);
    applyBlurVar(state.blur);
    renderRevealState();
    els.message.textContent = pickMessage();
  });
}

function saveSettings(partial) {
  state = { ...state, ...partial };
  chrome.storage.sync.set(partial);
}

function sendToActiveTab(message) {
  if (activeTabId == null) return;
  chrome.tabs.sendMessage(activeTabId, message, () => {
    // Swallow "no receiver" errors — popup may be open on a non-UCAM tab.
    if (chrome.runtime.lastError) { /* no-op */ }
  });
}

// ---- Event wiring ----

els.themeSelect.addEventListener('change', (e) => {
  const theme = e.target.value;
  applyTheme(theme);
  saveSettings({ theme });
  sendToActiveTab({ type: 'PEEK_SET_THEME', theme });
});

els.blurSlider.addEventListener('input', (e) => {
  const blur = Number(e.target.value);
  applyBlurVar(blur);
  saveSettings({ blur });
  sendToActiveTab({ type: 'PEEK_SET_BLUR', blur });
});

els.modeSelect.addEventListener('change', (e) => {
  const mode = e.target.value;
  saveSettings({ mode });
  sendToActiveTab({ type: 'PEEK_SET_MODE', mode });
});

els.autoToggle.addEventListener('change', (e) => {
  saveSettings({ autoHide: e.target.checked });
});

els.revealBtn.addEventListener('click', () => {
  if (state.revealed) return;
  spawnSparkles();
  saveSettings({ revealed: true });
  renderRevealState();
  swapMessage("There you go. 🌸");
  sendToActiveTab({ type: 'PEEK_REVEAL' });
});

els.hideBtn.addEventListener('click', () => {
  saveSettings({ revealed: false });
  renderRevealState();
  swapMessage(pickMessage());
  sendToActiveTab({ type: 'PEEK_HIDE' });
});

els.toolsBtn.addEventListener('click', () => {
  sendToActiveTab({ type: 'PEEK_OPEN_TOOLS' });
  window.close(); // popup can't stay open while the page panel is used
});

// ---- Init ----

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) activeTabId = tabs[0].id;
  loadSettings();
});
