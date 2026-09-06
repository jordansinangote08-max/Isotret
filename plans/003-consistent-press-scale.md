# 003 — Bring outlier press-feedback scales into this repo's subtle range

- **Status**: TODO
- **Commit**: 75bfaf5
- **Severity**: LOW
- **Category**: Physicality & Cohesion
- **Estimated scope**: 1 file (`styles.css`), 4 values changed

## Problem

This repo's `:active` press-feedback scale values are inconsistent across peer circular tap targets, and four of them fall outside the subtle 0.95–0.98 range this repo otherwise follows everywhere else:

```css
/* styles.css:83 — current, already correct, cited for comparison */
.nav-item:active { transform: scale(.97); transition-duration: 80ms; }
```

```css
/* styles.css:105 — current, outlier */
.icon-button:active, .avatar-button:active { transform: scale(.92); transition-duration: 80ms; }
```

```css
/* styles.css:118 — current, already correct, cited for comparison */
.mobile-menu button:active { transform: scale(.97); transition-duration: 80ms; }
```

```css
/* styles.css:138 — current, already correct, cited for comparison */
.btn:active { transform: scale(.96); transition-duration: 90ms; }
```

```css
/* styles.css:187 — current, outlier */
.calendar-arrow:active { transform: scale(.9); transition-duration: 80ms; }
```

```css
/* styles.css:216 — current, already correct, cited for comparison */
.history-day:active { transform: scale(.96); transition-duration: 80ms; }
```

```css
/* styles.css:268-269 — current, outliers */
.bottom-nav-item:active { transform: scale(.92); transition-duration: 80ms; }
.bottom-add:active { transform: scale(.9); transition-duration: 80ms; }
```

`.icon-button`/`.avatar-button` (.92), `.calendar-arrow` (.9), `.bottom-nav-item` (.92), and `.bottom-add` (.9) squish noticeably more than every other pressable element in the app, and more than the 0.95–0.98 "keep it subtle" range. These are also all similarly-weighted circular icon-style controls (the hamburger/avatar icon buttons, the calendar prev/next arrows, the bottom-nav tab buttons, and the floating add button) — there's no reason they should feel punchier than a full-width `.btn` or a nav row.

## Target

```css
/* target — styles.css:105 */
.icon-button:active, .avatar-button:active { transform: scale(.96); transition-duration: 80ms; }
```

```css
/* target — styles.css:187 */
.calendar-arrow:active { transform: scale(.96); transition-duration: 80ms; }
```

```css
/* target — styles.css:268-269 */
.bottom-nav-item:active { transform: scale(.96); transition-duration: 80ms; }
.bottom-add:active { transform: scale(.96); transition-duration: 80ms; }
```

Only the numeric scale factor changes on these four declarations. `transition-duration: 80ms` on all four is unchanged and already correct (within the 100-160ms-or-under press-feedback budget, and consistent with every other `:active` rule in the file).

## Repo conventions to follow

- `.btn:active` (`styles.css:138`) and `.history-day:active` (`styles.css:216`) both already use `scale(.96)` — that's the value to standardize on, not the AUDIT.md midpoint or any other number.
- Keep each declaration on its own existing line/selector; do not merge selectors together or introduce a shared class — this repo writes press feedback per-component, not via a shared utility class.

## Steps

1. Open `styles.css`. On line 105, change `.icon-button:active, .avatar-button:active { transform: scale(.92); transition-duration: 80ms; }` to use `scale(.96)` in place of `scale(.92)`.
2. On line 187, change `.calendar-arrow:active { transform: scale(.9); transition-duration: 80ms; }` to use `scale(.96)` in place of `scale(.9)`.
3. On lines 268-269, change both `.bottom-nav-item:active { transform: scale(.92); ... }` and `.bottom-add:active { transform: scale(.9); ... }` to use `scale(.96)`.
4. Save. Do not change `transition-duration` on any of these four rules — only the `scale()` argument.

## Boundaries

- Do NOT change `.nav-item:active`, `.mobile-menu button:active`, `.btn:active`, or `.history-day:active` — they're already correct and are the exemplars this plan standardizes toward.
- Do NOT change any `transition-duration` value in this file.
- Do NOT touch the `@media (hover: none)` block's `:active { opacity: .72; }` rules (`styles.css:543-549`) — that's a separate, intentional touch-device dimming effect layered on top of these transforms, not part of this finding.
- If any of the four cited selectors no longer match the current-code excerpts above (different scale value, different selector grouping) since commit `75bfaf5`, STOP and report instead of guessing which value to change.

## Verification

- **Mechanical**: none applicable (no build step). Confirm the file still parses as valid CSS (no stray braces) by loading the app and checking DevTools shows no CSS parse warnings for `styles.css`.
- **Feel check**:
  1. Press-and-hold (mouse down, don't release) each of: the hamburger menu button, the avatar button (if visible), a calendar prev/next arrow, a bottom-nav tab, and the bottom "+" add button. In DevTools, inspect each element while held down and confirm `transform: scale(0.96)` is applied to all of them.
  2. Compare the visual squish against `.btn:active` (e.g. "Log dose" button) and `.history-day:active` (tap a calendar day) — all six should now feel like the same weight of press, not noticeably different.
  3. Set DevTools Animations panel playback to 10% and step through a press on `.bottom-add` — confirm it still feels crisp at 80ms, just less aggressive in depth.
- **Done when**: all four previously-outlier selectors read `scale(.96)` in the stylesheet, and pressing any circular icon-style control in the app produces the same visual squish depth as pressing `.btn` or a `.history-day` cell.
