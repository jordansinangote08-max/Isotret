# 002 — Animate the progress line with transform instead of width

- **Status**: TODO
- **Commit**: 75bfaf5
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files (`styles.css`, `app.js`), 1 rule + 1 line changed

## Problem

The home-screen progress bar fill animates the `width` property, which is a layout-triggering property (forces layout + paint + composite on every frame), instead of `transform`, which is compositor-only. It also uses a bare `ease` curve for what is a "moving/morphing on screen" element, where this repo's own decision tree calls for a stronger curve.

Current code:

```css
/* styles.css:171-172 — current */
.progress-line { margin: 22px 0; height: 9px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
.progress-line span { display: block; height: 100%; width: 0; background: var(--primary); border-radius: inherit; transition: width .35s ease; }
```

```js
// app.js:345 — current
els.progressLineFill.style.width = `${stats.progress}%`;
```

```html
<!-- index.html:151 — current, unaffected by this plan -->
<div class="progress-line" aria-hidden="true"><span id="progressLineFill"></span></div>
```

## Target

Make the inner `<span>` full width at all times and represent the fill percentage as a horizontal scale from the left edge instead:

```css
/* target */
.progress-line { margin: 22px 0; height: 9px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
.progress-line span {
  display: block;
  height: 100%;
  width: 100%;
  background: var(--primary);
  border-radius: inherit;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 280ms var(--ease-spring);
}
```

```js
// target — app.js:345
els.progressLineFill.style.transform = `scaleX(${stats.progress / 100})`;
```

`.progress-line`'s `overflow: hidden` (unchanged) still clips the scaled span to the rounded track, so the visual result is pixel-identical to the width-based version — only the animated property changes.

## Repo conventions to follow

- This repo's shared easing tokens are defined at `styles.css:28-30`. `--ease-spring: cubic-bezier(0.32, 0.72, 0, 1)` is this repo's strong entrance/settle curve, already used for the modal panel, toast, and every `:active` press transform (e.g. `styles.css:281`, `styles.css:292`) — reuse it here instead of bare `ease`.
- Every other transform-based transition in this file stays under the 300ms UI ceiling (e.g. `.modal-panel` at 320ms is the app's slowest; most are 120-220ms) — 280ms keeps this fill consistent with that range rather than the original 350ms.
- `els.progressLineFill.style.<prop> = ...` (direct inline style assignment from JS) is this repo's existing pattern for driving this specific element — do not refactor it into a CSS class toggle; just change which property is assigned.

## Steps

1. Open `styles.css`. Replace the single line at line 172 (`.progress-line span { display: block; height: 100%; width: 0; background: var(--primary); border-radius: inherit; transition: width .35s ease; }`) with the multi-line rule shown in **Target** above (`width: 100%`, `transform: scaleX(0)`, `transform-origin: left`, `transition: transform 280ms var(--ease-spring)`).
2. Open `app.js`. On line 345, replace `els.progressLineFill.style.width = \`${stats.progress}%\`;` with `els.progressLineFill.style.transform = \`scaleX(${stats.progress / 100})\`;`.
3. Save both files.

## Boundaries

- Do NOT change `.progress-line`'s own rule (the outer track) — only the inner `span`.
- Do NOT touch the conic-gradient `.ring` progress indicator (`styles.css:165`, `app.js:342-344`) — that's a separate, unrelated element (tracked in plan 004 if selected).
- Do NOT add a new easing token — reuse `--ease-spring`.
- If `app.js:345` no longer reads `els.progressLineFill.style.width = ...` verbatim (e.g. the property name or template literal has changed since commit `75bfaf5`), STOP and report instead of guessing at the new shape.

## Verification

- **Mechanical**: none applicable (no build step). Open the app, confirm no console errors on load.
- **Feel check**:
  1. Load the Home screen with existing dose data (or log a new dose to change `stats.progress`). Confirm the horizontal bar fills to the same visual length and position as before this change (pixel comparison against a screenshot taken before the edit, if unsure).
  2. In DevTools Elements panel, inspect `#progressLineFill` and confirm it now has `transform: scaleX(...)` and no inline `width` style.
  3. In DevTools Performance panel (or the Rendering panel's "Layout Shift Regions"), trigger a progress change (log a dose) and confirm no layout/reflow is attributed to `#progressLineFill` — only compositing.
  4. Set DevTools Animations panel playback to 10% and confirm the fill grows smoothly from its previous length to the new one (not from zero) when progress increases incrementally — i.e. it's a `transition`, so it retargets from the current scale rather than restarting.
  5. Toggle `prefers-reduced-motion` (Rendering panel) and confirm the fill still ends at the correct length, just without the animated sweep (this repo's existing blanket reduced-motion rule at `styles.css:413-420` already zeros this transition's duration — no plan-specific reduced-motion work needed here).
- **Done when**: the bar visually fills identically to before, the animated property is `transform` (verified in DevTools, not `width`), and the easing/duration match `280ms var(--ease-spring)`.
