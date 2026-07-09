// Peek — background.js (Manifest V3 service worker)
//
// Two jobs:
// 1. Reset the "revealed" flag on fresh navigations to a UCAM results page,
//    so results start hidden again next visit (per the "Hide on page load"
//    setting) rather than staying revealed forever after the first peek.
// 2. Relay keyboard shortcuts to the active tab's content script.
//
// No network requests are made anywhere in this file.

const UCAM_MATCH = /:\/\/ucam\.uap-bd\.edu\//;

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // top frame only
  if (!UCAM_MATCH.test(details.url)) return;

  chrome.storage.sync.get({ autoHide: true }, ({ autoHide }) => {
    if (autoHide) {
      chrome.storage.sync.set({ revealed: false });
    }
  });
});

chrome.commands?.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;

    const send = (type) => chrome.tabs.sendMessage(tab.id, { type }, () => {
      if (chrome.runtime.lastError) { /* content script not on this page — ignore */ }
    });

    if (command === 'peek-reveal') {
      chrome.storage.sync.set({ revealed: true });
      send('PEEK_REVEAL');
    } else if (command === 'peek-hide') {
      chrome.storage.sync.set({ revealed: false });
      send('PEEK_HIDE');
    } else if (command === 'peek-toggle') {
      chrome.storage.sync.get({ revealed: false }, ({ revealed }) => {
        const next = !revealed;
        chrome.storage.sync.set({ revealed: next });
        send(next ? 'PEEK_REVEAL' : 'PEEK_HIDE');
      });
    }
  });
});
