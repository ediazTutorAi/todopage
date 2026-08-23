# Trigonometry lessons — tag brainstorm

## Context

This course is taught from a workbook (annotated PDF, handwritten by the instructor
during class). The instructor wants to stop projecting the PDF via document camera and
instead recreate workbook sections as interactive lecture pages in this project, reusing
and extending the existing tag system so the same tags work across *all* trig sections,
not just one lesson.

Source workbook analyzed so far:
`todopage/trigonometry/Lesson 03 – Introduction to Right Triangle Trigonometry Instructor Annotations.pdf`
(Lesson 03: right-triangle ratios, SOH-CAH-TOA, special angles table, reciprocal ratios,
intro to standard position / coordinate-plane triangles.)

**Status: implemented.** The "revealable" primitive and `<triangle>` tag described below
are built and live (see "Implementation status" section near the end). This file remains
the design record/rationale for *why* they work the way they do; treat the "Open threads"
section as the only genuinely unbuilt part.

## Existing project architecture (reference, not new)

- Lessons are step/slide decks: `.step` divs with `data-reveal="true"` for whole-step
  reveal, driven by `js/slideMode.js`.
- Math is rendered with KaTeX (`css/`, auto-render in the page head).
- `<geogebra>` is an existing custom tag (see `editor-app/templates/lecture-template.js`)
  for embedding dynamic GeoGebra applets driven by command lists. It opens in a floating
  panel (`ggb-float`, `js/ggb.js`) that can be expanded/dragged/closed.
- No answer-checking, drag-and-drop, or fill-in-blank tags exist yet — this brainstorm is
  about adding that layer.

## Interaction philosophy (decided)

The instructor runs discussion live, then reveals — not typed/auto-graded answers, not
drag-and-drop. Every tag idea below follows one interaction rule:

> Hidden content, revealed by directly clicking the content itself (not a separate
> "reveal all" button), after a live discussion with the class.

This came out of explicitly comparing options for the vocabulary blanks and choosing
per-item click-to-reveal over a grouped button, then confirming the same choice for
ratio answers and pattern-table cells.

## Core primitive: "revealable"

One interactive concept, reused everywhere via different renderings:

1. **Inline word** — vocabulary blanks sitting in a sentence (e.g. the intro paragraph's
   "the side opposite is the ______", or the "SOH-CAH-TOA" acronym blank). Renders as a
   dashed underline; click swaps it for the word.
2. **Inline math** — hidden KaTeX expression for computed answers (e.g. `sin(60°) = ___`
   → click reveals `√3/2` properly typeset, not plain text). Covers Examples 1, 2, 3, 5,
   6, 7 in Lesson 03 and the equivalent "evaluate this ratio" exercises in other sections.
3. **Pinned-to-diagram** — hidden label anchored to a specific x/y point on a triangle
   picture: a side length, an angle measure, or a side name (hyp/opp/adj). Same
   click-to-reveal behavior, positioned over a diagram instead of inline in text.
4. **Grid cell** — same primitive laid out inside a table (the special-angles table in
   Example 4: sin/cos/tan rows × 0°/30°/45°/60°/90° columns). Confirmed **per-cell**
   granularity (not per-row) so the instructor can pause on trickier values like `√2/2`.

All four are the same underlying "hidden until clicked" mechanism with different
placement/rendering — not four separate tags to build. Conceptually a finer-grained
sibling of the existing `data-reveal` step mechanism.

## New diagram tag: `<triangle>`

Static (non-draggable) triangle diagrams, auto-generated as SVG rather than screenshotted
or hand-drawn per instance, so that:

- It's reusable across every triangle exercise in every section (not one-off images).
- The tag computes vertex/side/angle positions itself, giving the "pinned-to-diagram"
  revealable labels precise anchor points without manual coordinate math per diagram.

Decided to **generalize beyond right triangles**: originally scoped as `<right-triangle>`,
extended to a general `<triangle>` tag since later sections (law of sines/cosines,
oblique triangles) need the same picture-generation machinery. The right angle becomes
a *detected property* (draws the small square corner-marker automatically) rather than a
separate tag or required flag.

Open implementation note (not yet solved, just flagged): laying out vertices for an
arbitrary triangle requires actually solving the triangle's geometry from whatever's
given (two angles + a side, three sides via law of cosines, etc.), unlike a right
triangle which can use a fixed base/height layout. The workbook's own triangle diagrams
aren't drawn strictly to scale either (Examples 1, 5, 7) — schematic-but-labeled is the
actual bar, which makes this easier than pixel-perfect proportional rendering.

## Reused for dynamic diagrams: existing `<geogebra>` tag

Anything that needs to move (drag a point, angle sliders, live-updating dependent values)
stays on the existing GeoGebra integration rather than the static `<triangle>` tag.
Earmarked specifically for:

- Example 6 (Lesson 03): plot (5,3) on a grid, auto-construct the right triangle down to
  the x-axis, angle θ updates live, connects to sin θ / tan θ and the line's slope.
- Future sections: angle sliders, unit circle exploration.

## Open threads (floated, not yet designed in detail)

- **linked-pair** — visual connector between reciprocal relationships (sin↔csc, cos↔sec,
  tan↔cot per Example 7's hand-drawn arrows) and other paired concepts like
  "tan θ = slope" in Example 6c. Click one side, the paired concept highlights.
- ~~**example-box**~~ — dropped. Each workbook Example maps to its own slide/step in the
  deck, so the step boundary itself already provides the visual separation the box gave
  in the PDF. No separate container tag needed.
- **formula drawer** — floating reference panel (reusing the existing `ggb-float`
  drag/expand/close pattern) pinned to the side, holding SOH-CAH-TOA / the six ratio
  definitions / reciprocal pairs, so they don't need to be re-shown or scrolled back to
  every time a later example needs them.
- **discussion-prompt** — lightweight tag for conceptual asides that aren't
  fill-in-the-blank, e.g. the "(Why are there always two acute angles in a right
  triangle?)" aside in the intro paragraph.

## Implementation status

Built 2026-08-23. Full implementation plan/rationale:
`~/.claude/plans/playful-bubbling-dewdrop.md` (local to the machine that built this, not
part of the repo).

- **`<reveal>...</reveal>`** — `js/reveal.js` (click toggles `.is-revealed`; wraps content
  in `.reveal-content` on `DOMContentLoaded` so KaTeX's later `load`-time render pass
  still finds the math text). Styling in `css/steps.css`. Used inline in text, inline in
  math, as `<reveal slot="...">` children of `<triangle>` (moved onto a computed anchor
  point), and inside `<table>` cells — all four renderings from one implementation, as
  designed. **Deliberately independent of** `data-reveal`/`reveal-inline` in
  `js/slideMode.js` (that's the older sequential, Next/Prev-button-driven reveal used
  elsewhere in the codebase — do not conflate the two).
- **`<triangle type="right"|"isosceles"|"equilateral">`** — `js/triangle.js`. Each type
  has its own closed-form layout function (`layoutRight`/`layoutIsosceles`/
  `layoutEquilateral`); renders inline SVG (outline, right-angle tick, equal-side ticks)
  plus percentage-positioned HTML overlay labels (side lengths, angle measures, moved
  `<reveal slot>` children) so KaTeX can render into the labels normally.
  `type="scalene"` is a deliberate stub (`layoutScalene`, logs a console error) — general
  triangle-solving (law of sines/cosines) isn't built, since nothing needs it yet.
  - `type="right"` attributes: `angle` (reference angle, also controls the rendered
    aspect ratio), `adjacent`/`opposite`/`hypotenuse` (static side labels, omit to leave
    blank or supply a `<reveal slot="...">` child instead), `label-a`/`label-c` (override
    the default numeric `"30°"`-style angle label with e.g. `"α"`/`"β"` — needed for
    Example 5/7 where the workbook names angles rather than giving degrees).
  - Both `js/reveal.js` and `js/triangle.js` are plain modules imported unconditionally
    by `js/boot.js` (not the geogebra-style "only inject if the page uses it" pattern —
    they're cheap first-party files, so every page gets them for free just by including
    `boot.js`, which all lesson pages already do). **No changes were needed to
    `editor-app/templates/lecture-template.js`** as a result.
- First real page built with these: `trigonometry/2026/2026-08-23-lesson-03-right-triangle-trigonometry/index.html`,
  covering the full lesson (intro blanks, the p.1 side-ID exercise, Examples 1–7, the
  special-angles table, and Example 6 on the existing `<geogebra>` tag unchanged).
  Registered in `data/lectures.json` under course "Trigonometry".
- Verified with a headless-Chromium script (Playwright) driving every step: all reveal
  counts matched expectations, click/re-click toggling worked, both triangles and all
  Example diagrams rendered with correct labels, the special-angles table's 15 cells
  revealed correctly, and the GeoGebra applet in Example 6 still loaded live with no
  console errors — confirming the `boot.js` import changes didn't regress the existing
  GeoGebra path.

## Next steps when resuming this work

1. Pick up one of the "Open threads" above (linked-pair, formula drawer,
   discussion-prompt) and run it through the same decide-the-interaction-model
   brainstorm used for the primitives above, before writing code.
2. `type="scalene"` general triangle-solving — build when a later section's diagram
   actually needs a non-symmetric triangle (see `layoutScalene` in `js/triangle.js`).
3. New lessons: hand-author `index.html` following the pattern in the Lesson 03 file
   above (or wire through the `editor-app` Electron GUI / `content.json` pipeline if
   preferred — both produce compatible output, since the new tags live in shared `js/`
   files rather than the per-file generator template).
