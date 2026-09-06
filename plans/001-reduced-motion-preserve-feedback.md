# 001 — Preserve opacity feedback under prefers-reduced-motion

- **Status**: DONE
- **Commit**: 75bfaf5
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file (`styles.css`), ~8 new lines, 0 lines removed

## Problem

The global reduced-motion block zeroes the duration of every single transition and animation on the page, with no exceptions. This is the textbook "nukes all feedback" anti-pattern: it doesn't just remove movement (which is correct), it also removes the opacity fades that are the *only* signal a reduced-motion user gets that the dose-entry modal, the toast, or the mobile menu appeared or disappeared. Today, for a user with reduced motion enabled, those three surfaces just pop in and vanish with zero transition — the exact case the accessibility guidance warns against ("keep opacity/color, drop movement").

Current code:

```css
/* styles.css:413-420 — current */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

The three affected components and their normal (non-reduced-motion) transitions:

```css
/* styles.css:271-276 — .modal, current, unaffected by this plan */
.modal {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px;
  opacity: 0;
  transition: opacity .2s ease;
}
```

```css
/* styles.css:288-293 — .toast, current, unaffected by this plan */
.toast {
  position: fixed; left: 50%; bottom: 24px; z-index: 200; max-width: min(90vw, 420px); padding: 12px 16px; border-radius: 999px; background: var(--text); color: var(--surface); box-shadow: var(--shadow); font-size: 12px; font-weight: 700;
  opacity: 0;
  transform: translate(-50%, 12px) scale(.94);
  transition: opacity .2s ease, transform .28s var(--ease-spring);
}
```

```css
/* styles.css:107-113 — .mobile-menu, current, unaffected by this plan */
.mobile-menu {
  position: fixed; top: 68px; right: 14px; z-index: 80; width: min(240px, calc(100vw - 28px)); padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow);
  transform-origin: top right;
  opacity: 0;
  transform: scale(.92) translateY(-6px);
  transition: opacity .16s ease, transform .22s var(--ease-spring);
}
```

Note `.toast` and `.mobile-menu` each combine `opacity` and `transform` in one `transition` shorthand on the same element — the fix must split them apart under reduced motion so opacity keeps animating while transform is dropped (snaps instantly), not just shorten both together.

## Target

Keep the existing blanket zeroing rule exactly as-is (it correctly kills continuous/looping animations and pure-movement transforms app-wide — that part is correct). Add a second, more specific block directly after it that restores a short, real opacity transition on exactly the three overlay components, and removes `transform` from their transitioned properties so movement still snaps instantly:

```css
/* target — insert immediately after the existing block ending at styles.css:420 */
@media (prefers-reduced-motion: reduce) {
  /* These three components use opacity to signal appearing/disappearing — that
     feedback must survive reduced motion. Movement (transform) still snaps
     instantly; only the fade is restored. */
  .modal {
    transition: opacity 150ms ease !important;
  }
  .toast {
    transition: opacity 150ms ease !important;
  }
  .mobile-menu {
    transition: opacity 150ms ease !important;
  }
}
```

Because each override is a full `transition` shorthand (not just `transition-duration`), it replaces the property list entirely for that element under reduced motion: `opacity` keeps its 150ms fade, and `transform` is no longer a transitioned property at all, so any transform change (e.g. `.toast.is-visible`'s `scale(1)`) applies instantly with no animation — exactly "drop movement, keep opacity."

Do not touch `.modal-panel`'s own transform transition (`styles.css:278-285`) — it's a separate element/rule and is already correctly left at 0.01ms by the untouched blanket rule, since the sheet's slide/scale is pure movement.

## Repo conventions to follow

- The blanket reduced-motion reset lives at `styles.css:413-420` — add the new block as a second `@media (prefers-reduced-motion: reduce) { ... }` block directly after it (do not merge into the same block; keep the "always applies" rules and the "restores specific feedback" rules visually separate, each with its own comment explaining why).
- This repo writes overlay opacity transitions as bare `ease` at short durations (`.modal` uses `opacity .2s ease` normally) — the reduced-motion override reuses that same `ease` keyword and lands on 150ms, which is inside this repo's existing toast/menu duration range (160–220ms), not an invented value.

## Steps

1. Open `styles.css`. Locate the existing block at lines 413-420 (`@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { ... } }`). Leave it completely unchanged.
2. Immediately after that block's closing `}`, insert the new block shown in **Target** above verbatim (three rules: `.modal`, `.toast`, `.mobile-menu`, each `transition: opacity 150ms ease !important;`), preceded by the comment shown.
3. Save. No other file changes — `app.js` is untouched; the JS `revealOverlay`/`concealOverlay` helpers already just toggle a class, so no JS changes are needed for this fix to take effect.

## Boundaries

- Do NOT modify the existing blanket reduced-motion block at `styles.css:413-420` — it is correct for everything except these three components.
- Do NOT touch `.modal-panel`, `.switch-thumb`, `.switch-button span`, or any `:active` press-feedback rule — their transforms are pure movement and are correctly zeroed by the existing blanket rule.
- Do NOT add JavaScript (`matchMedia('(prefers-reduced-motion)')` branching) — this is a pure CSS fix.
- If `.modal`, `.toast`, or `.mobile-menu`'s base (non-reduced-motion) `transition` declaration has changed since commit `75bfaf5` (e.g. different properties or selector), STOP and report instead of guessing at the new shape.

## Verification

- **Mechanical**: none applicable (static CSS, no build/lint step in this repo). Open `index.html` directly or via a local static server and confirm the page still loads with no console errors.
- **Feel check**:
  1. In Chrome DevTools, open the Rendering panel (Cmd/Ctrl+Shift+P → "Show Rendering"), set "Emulate CSS media feature prefers-reduced-motion" to `reduce`.
  2. Click "Log dose" (or any `[data-open-dose]` trigger). Confirm the modal backdrop **fades in** over a perceptible ~150ms (not instant, not the full ~320ms normal-motion sweep) — but the sheet itself should **not** slide/scale into place; it should just appear at its final position the instant the fade starts.
  3. Close the modal. Confirm the same: an opacity fade-out, no slide.
  4. Trigger a toast (e.g. save the settings form). Confirm the toast **fades** in/out but does not slide up from `translate(-50%, 12px) scale(.94)` — it should sit at its final position throughout.
  5. On a narrow viewport, open the hamburger menu. Confirm it fades in/out without the scale/translate popover motion.
  6. Turn the emulation back to "No emulation" and repeat all four interactions — confirm normal motion (full fade + slide/scale) is unaffected.
- **Done when**: with `prefers-reduced-motion: reduce` emulated, the modal, toast, and mobile menu each show a visible ~150ms opacity fade on open and close, with zero transform/slide/scale movement — and with emulation off, all three behave exactly as before this change.
