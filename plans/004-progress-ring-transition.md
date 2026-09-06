# 004 — Animate the progress ring's fill instead of snapping

- **Status**: TODO
- **Commit**: 75bfaf5
- **Severity**: MEDIUM
- **Category**: Missed opportunity / State indication
- **Estimated scope**: 2 files (`styles.css`, `app.js`), 1 new at-rule + 1 rule + 1 JS line

## Problem

The Home screen's conic-gradient progress ring — the single most prominent visual metric in the app — jumps instantly to its new fill level every time it updates (logging a dose, editing/deleting an entry, saving settings, or a cloud sync pulling new data). CSS custom properties don't interpolate by default, so even though the ring's `background` is a `conic-gradient()` driven by `--progress`, changing that variable causes an instant repaint rather than a sweep.

Current code:

```css
/* styles.css:165 — current */
.ring { --progress: 0; width: 112px; height: 112px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--primary) calc(var(--progress) * 1%), var(--surface-3) 0); position: relative; flex: none; }
```

```js
// app.js:342 — current
els.progressRing.style.setProperty("--progress", stats.progress.toFixed(2));
```

```js
// app.js:859-866 — current, the app's single startup entry point
function init() {
  loadLocal();
  loadCloudConfig();
  setGreeting();
  bindEvents();
  showView("home");
  renderAll();
  if (navigator.onLine && cloudConfig.apiKey && cloudConfig.binId) pullFromCloud();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
```

## Target

Register `--progress` as an animatable custom property via `@property`, then transition it — but only after the very first render, so the ring doesn't sweep up from 0% on every page load (it should just show the correct value immediately on first paint, and only animate on *subsequent* updates within the same session).

```css
/* target — insert immediately before the existing .ring rule at styles.css:165 */
@property --progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.ring.ring--animated {
  transition: --progress 480ms var(--ease-spring);
}
```

```css
/* target — styles.css:165, unchanged */
.ring { --progress: 0; width: 112px; height: 112px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--primary) calc(var(--progress) * 1%), var(--surface-3) 0); position: relative; flex: none; }
```

```js
// target — app.js:865, add one line immediately after the first renderAll() call
function init() {
  loadLocal();
  loadCloudConfig();
  setGreeting();
  bindEvents();
  showView("home");
  renderAll();
  els.progressRing.classList.add("ring--animated");
  if (navigator.onLine && cloudConfig.apiKey && cloudConfig.binId) pullFromCloud();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
```

`app.js:342` (`els.progressRing.style.setProperty("--progress", ...)`) does not need to change — it keeps setting the same custom property; the transition is now driven purely by the `ring--animated` class being present on the element for every render after the first.

## Repo conventions to follow

- `--ease-spring: cubic-bezier(0.32, 0.72, 0, 1)` (`styles.css:28`) is this repo's settle/entrance curve, already used for the modal panel and toast — reuse it here rather than inventing a new curve.
- This repo's existing overlay helpers (`revealOverlay`/`concealOverlay` in `app.js`) use the same pattern of "add a class to enable a CSS transition that was suppressed on initial state" — this plan follows that same shape (a modifier class gating a transition), just applied once at startup instead of per-interaction.
- `els.progressRing` is already defined in the `els` lookup table (`app.js:64`) — reuse it, don't re-query the DOM.

## Steps

1. Open `styles.css`. Immediately before the `.ring { ... }` rule (currently at line 165), insert the `@property --progress { syntax: '<number>'; inherits: false; initial-value: 0; }` block shown in **Target**.
2. Directly after it (still before or after `.ring`, either is fine, but keep it adjacent for readability), add the new rule `.ring.ring--animated { transition: --progress 480ms var(--ease-spring); }`.
3. Open `app.js`. In `init()` (starting at line 859), add `els.progressRing.classList.add("ring--animated");` as a new line immediately after the existing `renderAll();` call (currently line 865), before the `if (navigator.onLine && ...)` line.
4. Save both files. Do not modify `app.js:342` (the `setProperty` call) or `renderHome()` in any other way.

## Boundaries

- Do NOT add the `ring--animated` class in the HTML markup or in `renderHome()` — it must be added exactly once, in `init()`, after the first `renderAll()` call, so the ring's very first paint is instant and only later updates animate.
- Do NOT change the `--progress` custom property's usage inside the `conic-gradient()` expression.
- Do NOT touch `.progress-line`/`#progressLineFill` (the separate horizontal bar) — that's tracked in plan 002.
- If `init()` no longer contains a single unconditional `renderAll();` call in the shape shown above (e.g. it's been wrapped in a conditional or moved) since commit `75bfaf5`, STOP and report instead of guessing where to add the class-add line.

## Verification

- **Mechanical**: none applicable (no build step). Confirm `@property` doesn't produce a console warning on load (Chrome/Edge/Safari all support it; if testing in a browser without support, the ring simply won't animate the fill — it will still render the correct final value every time, since `conic-gradient` itself doesn't require the property registration to work, only the transition does).
- **Feel check**:
  1. Load the app fresh (hard refresh). Confirm the ring shows the correct progress percentage **immediately**, with no visible sweep-from-zero on page load.
  2. Log a new dose (or edit an existing one) so `stats.progress` changes. Confirm the ring's fill now **sweeps** smoothly from the old percentage to the new one over roughly half a second, rather than snapping.
  3. In DevTools Elements panel, confirm `#progressRing` (or whatever element `els.progressRing` resolves to) has class `ring--animated` after the first render.
  4. Set DevTools Animations panel playback to 10% and log another dose — confirm the conic-gradient sweep is smooth and continuous, not stepped.
  5. Toggle `prefers-reduced-motion` (Rendering panel) and log a dose again — confirm the existing blanket reduced-motion rule (`styles.css:413-420`) zeroes this transition's duration too (it applies to `transition-duration` on all elements, `.ring.ring--animated` included), so the ring snaps instantly for reduced-motion users. No plan-specific reduced-motion work is needed here since custom-property transitions are covered by the same blanket rule.
- **Done when**: the ring never animates on initial page load, but visibly sweeps to the new value on every subsequent progress change, using `480ms` and `var(--ease-spring)`.
