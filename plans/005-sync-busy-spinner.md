# 005 — Add a busy spinner to the cloud sync buttons

- **Status**: DONE
- **Commit**: 75bfaf5
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Feedback
- **Estimated scope**: 1 file (`styles.css`), 2 new rules + 1 new `@keyframes`

## Problem

"Connect & load" and "Sync now" (Backup & Sync view) trigger a network request (`pullFromCloud`/`pushToCloud` in `app.js`) that can take a perceptible amount of time, including timeouts. The only in-flight feedback today is a disabled button and an `aria-busy="true"` attribute with zero visual styling attached to it — a sighted user gets no indication a request is happening beyond the button looking slightly dimmer (default browser `:disabled` styling).

Current code:

```js
// app.js:687-692 — current, unaffected by this plan
function setCloudButtonsBusy(busy) {
  [els.connectCloud, els.syncCloudNow].forEach(button => {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  });
}
```

```html
<!-- index.html:264 — current, unaffected by this plan -->
<div class="button-row"><button class="btn btn-primary" id="connectCloud" type="button">Connect &amp; load</button><button class="btn btn-secondary" id="syncCloudNow" type="button">Sync now</button></div>
```

`aria-busy` is already being set on exactly the right elements at exactly the right times — this is a pure CSS gap, no JS change needed.

## Target

```css
/* target — add near the .btn rules, e.g. directly after styles.css:138 (.btn:active) */
[aria-busy="true"] {
  color: transparent;
  position: relative;
  pointer-events: none;
}

[aria-busy="true"]::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  border: 2px solid var(--surface);
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 700ms linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  [aria-busy="true"]::after {
    animation-duration: 1400ms !important;
  }
}
```

This hides the button's own label text (`color: transparent`) while busy and centers a small spinning ring in its place, sized to fit inside the existing 44px-min-height `.btn`. `border-right-color: transparent` is what makes the ring read as a spinner rather than a solid circle. The reduced-motion override slows the spin to a calmer 1400ms rather than freezing it entirely — unlike purely decorative motion, a busy spinner is communicating a real, ongoing async state, so it must keep moving even for reduced-motion users (this intentionally does not use the same "kill it" pattern as the app's default reduced-motion block at `styles.css:413-420`).

## Repo conventions to follow

- `[aria-busy="true"]` is already the exact attribute `setCloudButtonsBusy` (`app.js:687-692`) toggles — style off that attribute selector directly; do not add a new CSS class or touch the JS.
- `var(--surface)` (defined per-theme at the top of `styles.css`) is this repo's existing token for "the color that reads correctly against `--primary`/`--surface-2` button backgrounds" — reuse it for the spinner ring color rather than a new hardcoded color, so it stays correct in dark mode.
- This is the first `@keyframes` in the file — every other animated value in this repo is a `transition`. That's fine here specifically because a spinner is continuous/looping motion with no discrete start/end state to retarget between (the "constant motion → linear" case), which transitions can't express. Do not convert any existing `transition`-based rule elsewhere in the file to `@keyframes` as a side effect of this plan.

## Steps

1. Open `styles.css`. Directly after the `.btn:active { transform: scale(.96); transition-duration: 90ms; }` rule (currently line 138), insert the `[aria-busy="true"]` rule and the `[aria-busy="true"]::after` rule shown in **Target**.
2. Add the `@keyframes btn-spin { to { transform: rotate(360deg); } }` block immediately after those two rules.
3. Add the `@media (prefers-reduced-motion: reduce) { [aria-busy="true"]::after { animation-duration: 1400ms !important; } }` block immediately after the `@keyframes` block. This is a separate, new `@media (prefers-reduced-motion: reduce)` block — do not merge it into the existing one at `styles.css:413-420` (or into plan 001's new block, if that plan has already been applied); multiple such blocks are valid CSS and keeping this one adjacent to the spinner rule it modifies keeps the file readable.
4. Save. No JS or HTML changes.

## Boundaries

- Do NOT modify `app.js` — `setCloudButtonsBusy` already does everything JS needs to do.
- Do NOT modify `index.html` — no markup changes are needed; `::after` supplies the spinner.
- Do NOT apply this spinner treatment to any other button or attribute — scope strictly to `[aria-busy="true"]`, which today is only ever set on `#connectCloud` and `#syncCloudNow`.
- If `setCloudButtonsBusy` no longer sets `aria-busy` as a plain boolean-string attribute (e.g. it's been refactored to a data attribute or class) since commit `75bfaf5`, STOP and report instead of guessing the new selector.

## Implementation note (found during execution, verified with Playwright)

The Target as originally written had two bugs, caught by a functional check rather than static review:

1. **Specificity**: `[aria-busy="true"] { color: transparent; }` has the same specificity as `.btn-primary { color: white; }`, and the latter is declared later in the file — so it silently won, leaving the label visible instead of hidden. Fixed by scoping to `.btn[aria-busy="true"]` (two selectors, beats one).
2. **Contrast**: `border: 2px solid var(--surface);` renders a near-invisible spinner on `.btn-secondary` (`background: var(--surface-2)` — both tokens are close to the same near-white/near-black value depending on theme). Fixed by defaulting the spinner border to `var(--text)` (correct for `.btn-secondary`) and adding a `.btn-primary[aria-busy="true"]::after { border-color: white; border-right-color: transparent; }` override for the filled button.

The actual shipped CSS (`styles.css`, immediately after `.btn:active`):

```css
.btn[aria-busy="true"] {
  color: transparent;
  position: relative;
  pointer-events: none;
}

.btn[aria-busy="true"]::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  border: 2px solid var(--text);
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 700ms linear infinite;
}

.btn-primary[aria-busy="true"]::after {
  border-color: white;
  border-right-color: transparent;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .btn[aria-busy="true"]::after {
    animation-duration: 1400ms !important;
  }
}
```

Verified with Playwright: `getComputedStyle(button).color` is `rgba(0,0,0,0)` and the `::after` border resolves to white (on `#connectCloud`) / the dark text color (on `#syncCloudNow`) while `aria-busy="true"`.

## Verification

- **Mechanical**: none applicable (no build step). Confirm the file still parses as valid CSS.
- **Feel check**:
  1. Open Backup & Sync, enter any values in the JSONBin fields, click "Connect & load" (or throttle the network in DevTools first to make the busy window long enough to observe).
  2. Confirm the button's label disappears and a small spinning ring appears centered in the button, spinning smoothly, for the duration of the request.
  3. Confirm the button is unclickable while busy (already true via `disabled`, just re-confirm the spinner doesn't interfere with that).
  4. Confirm once the request resolves (success or failure), the label reappears and the spinner is removed, matching the existing `setCloudButtonsBusy(false)` call.
  5. Toggle `prefers-reduced-motion` (Rendering panel) and repeat step 1 — confirm the spinner is still visibly rotating, just slower (~1400ms per rotation) rather than frozen or imperceptibly fast.
  6. Check dark mode: confirm the spinner ring is visible against both `.btn-primary` (filled) and `.btn-secondary` (outlined) backgrounds in both themes.
- **Done when**: both cloud-sync buttons show a centered, continuously spinning ring in place of their label while `aria-busy="true"`, in both themes, and the spinner keeps moving (slower, not frozen) under reduced motion.
