[![Made with Claude](https://shields.io)](https://anthropic.com)
# 🌸 Peek

A calm, minimal Chrome extension that hides your UCAM results behind a
gentle overlay until you're ready to look — plus a built-in CGPA toolkit
for when you are ready. It never uploads or transmits your grades anywhere;
everything happens locally in your own browser.

## Install (unpacked, for now)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `peek-extension` folder
5. Visit UCAM — results should hide automatically. Click the Peek icon in
   your toolbar and hit **Reveal results** to peek, or **Hide again** to
   re-hide.

## ✅ Detection is confirmed against the live page

Earlier drafts of this extension guessed at UCAM's markup. That's no longer
true — the selectors in `content.js` were tuned against the actual rendered
HTML from `StudentCourseHistoryView.aspx` (ASP.NET WebForms controls like
`lblObtainedGrade`, `lblObtainedGradePoint`, `lblCourseCredit`), so hiding
now correctly covers Credit, Grade, and Grade Point columns without also
sweeping in unrelated columns like Course Name or Course Status.

If your university ever changes its page layout, or something looks off:
- Open `content.js`, find `KEYWORD_SELECTORS`
- Right-click the field on UCAM → Inspect → note its real `id`
- Add a matching `[id*="..." i]` pattern

## 🧮 CGPA Tools (new)

Click **📊 Open CGPA tools** in the popup to open a panel with four tabs. This panel is **fully
manual** — it never reads anything from the UCAM page and never saves
anything between visits. Every time you open it, it starts blank, and you
type in your own course info.

- **Calculator** — add each course with its semester (optional label),
  credit hours, and letter grade. Peek computes your real CGPA live from
  whatever you've typed in.
- **Target** — using the courses you entered in Calculator, tell it a
  target CGPA and how many credits you have left; it works out the
  average grade you'd need across those remaining credits, and tells you
  plainly if that target isn't mathematically reachable.
- **Trend** — compares GPA across semesters, grouped by whatever semester
  label you gave each course in Calculator (e.g. "Fall 2025" vs
  "Spring 2026"). This is a within-session comparison of what you've typed
  in, not a saved history — nothing about your grades is ever stored.
- **Share** — generates a small downloadable image card from your entered
  CGPA/grades, with toggles for whether to include the CGPA number and/or
  individual grades, so you control exactly what you're sharing.

Since nothing carries over between visits, closing the panel (or the
page) clears everything you typed — that's intentional, not a bug.

The grade-point scale used (`GRADE_SCALE` in `grades.js`) is the standard
Bangladesh UGC-style 4.00 scale: A+ = 4.00, A = 3.75, A- = 3.50, B+ = 3.25,
B = 3.00, B- = 2.75, C+ = 2.50, C = 2.25, D = 2.00, F = 0.00. `I`/`W`/`R`
grades are correctly excluded from GPA math, matching how CGPA is actually
computed. If your university uses slightly different values, that one
table in `grades.js` is the only place to edit — everything else derives
from it automatically.

The Tools panel works independently of whether "Hide automatically" is
switched on — even if you've turned hiding off, the calculator still works.

## What's inside

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 config, permissions, keyboard shortcuts |
| `popup.html/css/js` | The toolbar popup — theme, blur, mode, reveal/hide, tools shortcut |
| `content.js/css` | Runs on the UCAM page — finds/hides results, hosts the Tools panel |
| `grades.js` | Grade-point scale + pure CGPA/GPA/target math, no DOM or storage |
| `panel.js/css` | The floating Tools panel — calculator, target, trend, share |
| `background.js` | Resets "revealed" state on fresh page loads; handles shortcuts |
| `assets/themes/tokens.css` | All 5 themes as CSS custom properties |

## Themes

Sakura 🌸 · Matcha 🍵 · Ocean 🌊 · Lavender 💜 · Dark 🌙 — switch anytime
from the popup, applies instantly to both the hidden results and the Tools
panel.

## Keyboard shortcuts

- `Alt+Shift+R` — Reveal
- `Alt+Shift+H` — Hide
- `Alt+Shift+T` — Toggle

(Chrome may ask you to confirm these at `chrome://extensions/shortcuts` the
first time, since it doesn't always auto-bind on load.)

## Privacy

Peek never uploads, stores remotely, or transmits your grades. No network
requests are made anywhere in the codebase — check for yourself, there's no
`fetch`, `XMLHttpRequest`, or remote URL in any file. The Tools panel goes
a step further: it never reads anything from the page at all, and none of
the course/grade data you type into it is saved anywhere — closing the
panel clears it. The only thing Peek stores locally is your theme/blur/
mode preference (`chrome.storage.sync`) — never grades, never courses.

The Share tab is the one place Peek generates an image — that image is
only ever offered to you as a local download; nothing is uploaded or sent
anywhere automatically.
