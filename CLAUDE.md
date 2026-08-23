# todopage — project overview

Static site of interactive math lecture slide-decks, organized by course
(`calculus-ii/`, `calculus3/`, `linear-algebra/`, `trigonometry/`, ...), each with dated
lesson folders containing a self-contained `index.html`. A hub page (`index.html` at the
repo root + `js/hub.js`) lists every lecture from `data/lectures.json`
(course/semester/date/title/subtitle/description/tags/url) with search/filter/favorites.

## Runtime architecture

- Each lesson is a step/slide deck: `.step` divs (`data-step`, optional
  `data-reveal="true"` for the older sequential Next/Prev-driven reveal), rendered by
  `js/slideMode.js`, booted by `js/boot.js` (imported as an ES module on every lesson
  page: `<script type="module" src="/todopage/js/boot.js">`).
- Math is KaTeX, auto-rendered once on `window` `load` over `document.body`
  (`$...$`/`\(...\)`/`$$...$$`/`\[...\]` delimiters all registered).
- `<geogebra>` — existing custom tag for dynamic GeoGebra applets (drag points, live
  updates). Command-list variant is parsed by an inline script in the lesson's own
  `<head>` (see any lesson using `<geogebra>` for the exact snippet); a separate
  material-id variant (`data-ggb-id` on a `.step`) opens in a floating panel via
  `js/ggb.js`.
- `editor-app/` — a separate Electron desktop GUI for authoring/editing lessons via a
  `content.json` sidecar that gets rendered to `index.html` by
  `editor-app/templates/lecture-template.js`. Many lesson folders predate this tool and
  are hand-authored `index.html` with no `content.json` — both are valid; the app
  reverse-parses legacy `index.html` files it doesn't manage yet.

## General-purpose interactive tags (added 2026-08-23)

Two new tags, usable in **any** course's lesson, not just trigonometry — implemented as
plain shared modules imported unconditionally by `js/boot.js` (`js/reveal.js`,
`js/triangle.js`), styled in `css/steps.css`. No changes were needed to
`editor-app/templates/lecture-template.js` as a result — any lesson page that already
includes `boot.js` (all of them) gets these tags for free.

### Background

Built for a trigonometry course taught from a workbook PDF with handwritten annotations,
previously projected via document camera. The goal was to recreate workbook sections as
interactive lecture pages, with tags general enough to reuse across every future trig
section (and beyond) rather than one-off per-lesson hacks.

Interaction philosophy, decided explicitly: the instructor runs discussion live, then
reveals — not typed/auto-graded answers, not drag-and-drop. Every tag below follows one
rule: **hidden content, revealed by directly clicking the content itself** (not a
separate "reveal all" button, not sequential Next/Prev), after live discussion.

### `<reveal>...</reveal>`

Click-to-toggle hidden content (`js/reveal.js`: click toggles `.is-revealed`; wraps
content in `.reveal-content` on `DOMContentLoaded` so KaTeX's later `load`-time render
pass still finds the math text). One primitive, four renderings:

1. **Inline word** — vocabulary blanks in a sentence (e.g. "the side opposite is the
   `<reveal>opposite</reveal>` side"). Renders as a dashed underline; click swaps it for
   the word.
2. **Inline math** — hidden KaTeX expression for computed answers (e.g.
   `sin(60°) = <reveal>\(\sqrt{3}/2\)</reveal>`).
3. **Pinned-to-diagram** — `<reveal slot="...">` as a child of `<triangle>` (see below),
   moved onto a computed anchor point instead of rendering inline where authored — a side
   length, an angle measure, or a side name (hyp/opp/adj).
4. **Grid cell** — same primitive inside a `<table>` cell, per-cell granularity (not
   per-row), so the instructor can pause on trickier values mid-table.

**Deliberately independent of** `data-reveal`/`reveal-inline` in `js/slideMode.js` — that
older system is sequential and Next/Prev-button-driven, used elsewhere in the codebase.
Do not conflate the two.

### `<triangle type="right"|"isosceles"|"equilateral">`

Auto-generated inline SVG triangle diagram (`js/triangle.js`) rather than a screenshotted
or hand-drawn image per instance, so diagrams are reusable and the tag itself computes
precise anchor points for `<reveal slot>` labels (no manual coordinate math per diagram).

Each type has its own closed-form layout function (`layoutRight`/`layoutIsosceles`/
`layoutEquilateral`); renders inline SVG (outline, right-angle tick, equal-side ticks)
plus percentage-positioned HTML overlay labels (side lengths, angle measures, moved
`<reveal slot>` children) so KaTeX renders into the labels normally. The right angle is a
*detected property* (auto square corner-marker), not a separate tag.

- `type="right"` attributes: `angle` (reference angle, also controls the rendered aspect
  ratio), `adjacent`/`opposite`/`hypotenuse` (static side labels — omit to leave blank or
  supply a `<reveal slot="...">` child instead), `label-a`/`label-c` (override the default
  numeric `"30°"`-style angle label with e.g. `"α"`/`"β"` for named-angle diagrams —
  `label-c=""` explicitly, an empty string rather than the attribute being absent,
  suppresses the complementary-angle label entirely when it isn't meaningful),
  `point-label` (text/KaTeX shown next to the plotted point, e.g. `"\((x_1, y_1)\)"` —
  only rendered when `axes` is also set, same stage as the point itself), `axes`
  (bare boolean attribute — draws x/y axes with arrowheads through vertex A, so the
  triangle reads as sitting in the coordinate plane, e.g. for "angle in standard position"
  diagrams. Pure SVG, no GeoGebra — use this instead of `<geogebra>` whenever the diagram
  is static/illustrative rather than needing a draggable point).
- `type="scalene"` (a general, non-symmetric triangle) is a **deliberate stub**
  (`layoutScalene`, logs a console error) — general triangle-solving (law of
  sines/cosines) isn't built, since nothing needs it yet. Build it when a lesson actually
  requires a non-symmetric triangle diagram.
- `build` (bare boolean, `type="right"` only): don't paint the finished figure — reveal it
  in 3 stages via a **button** (not click-the-diagram, since there's nothing visible to
  click before a line exists), matching a "(a) graph θ / (b) construct the triangle /
  (c) find r" style exercise: stage 1 = hypotenuse + point + angle label(s); stage 2 =
  the two legs + right-angle tick + their labels; stage 3 = the hypotenuse's own label
  (e.g. `r`). Axes (if `axes` is also set) are stage 0 — always shown, since they're the
  "graph paper," not something being constructed. Button reads "Build →" then cycles to
  "↺ Reset" at the final stage. This exists because presenting the whole diagram at once
  defeats an exercise that's explicitly asking the class to construct it step by step —
  use `build` whenever the workbook phrases a diagram as "graph/plot/construct," not just
  "here is the triangle." Implemented as a `stage` tag on each SVG/overlay piece in
  `renderTriangle` (`js/triangle.js`), toggled via a `.triangle-build-pending` CSS class —
  no effect at all when `build` isn't set, so every earlier diagram is unchanged.

Anything that needs to *move* (drag a point, angle sliders, live-updating dependent
values) stays on the existing `<geogebra>` tag instead — `<triangle>` is static only.

### `<angle-plane angle="…" label-a="…" arc-b="…" label-b="…" ray-label="…">`

A single ray from the origin at an *arbitrary* angle (not limited to 0–90° like
`type="right"` — its height formula breaks down past 90°, and there's no triangle here at
all, just axes + a ray + up to two arcs). For "angle in standard position" diagrams: axes,
one ray, and up to two labeled rotation arcs — `arc-a` (defaults to `angle`) and the
optional `arc-b`, each swept from 0° to its own value and drawn at its own radius (`arc-b`
slightly further out, so two arcs sharing one ray stay visually distinct rather than
retracing the same circle). Built for showing two different rotations — e.g. a positive
and a negative coterminal angle — to the *same* physical ray, plus an optional
`ray-label` at the ray's tip. Implemented in `js/triangle.js` alongside `<triangle>`,
reusing its `renderAxes`/`placeOverlay` helpers directly rather than duplicating them —
no new module, no new CSS file. No `build` support (not asked for; this is a presented
illustration, not a construct-it-yourself exercise like `<triangle build>`).

**Sign convention (blue = positive, red = negative):** each arc's color follows its own
sign automatically — negative sweep → `var(--negative)` (a new token in `css/base.css`,
`#c0392b`), non-negative → the existing `--accent` blue already used for angle labels
elsewhere. This is driven by the arc's numeric value, not a hardcoded "arc-a is blue,
arc-b is red" rule, so a single-arc diagram with a negative `angle` also renders red with
no extra attribute. Scoped deliberately narrow: this convention lives on `.triangle-arc`/
`.triangle-angle-label` only (sign-bearing diagram elements), **not** a repaint of the
site's general `--accent` — that color is used pervasively for non-sign UI (reveal
underlines, axis labels, etc.) and redefining what it means would be a much bigger, far
riskier change than this warrants. Color is always a reinforcing cue alongside a
minus-sign already present in the text label, never the only signal (colorblind
accessibility). Extend `--negative` to other sign-bearing diagram elements (coordinate
signs, quadrant charts) the same way if/when a lesson needs it.

Deliberately narrow: exactly one ray, at most two arcs/labels near it, an optional
`point-label` at the ray's endpoint, no `reveal` slots. If a lesson later needs multiple
independent rays, quadrant shading, or a general "any number of angles" version, extend
this rather than writing a third diagram tag — the shared axis/arrow/label plumbing
already lives here.

`point-label`'s position is computed **radially outward along the ray** (past the
endpoint, plus a small perpendicular nudge), not a fixed screen-space offset — a fixed
offset (which is what `<triangle>`'s `point-label` uses, fine there since that tag's ray
is always oriented up-and-right) would overlap the ray line itself whenever the angle
points down or left, which `<angle-plane>` very much needs to support (that's the whole
point of not being limited to 0–90°).

### Second GeoGebra→native conversion: Lesson 04 Example 3

Same reasoning as Lesson 03 Example 6: the workbook's "draw an angle θ with terminal side
through (-12,-5)" is a static, fixed-point diagram — no dragging needed — so it's now
`<angle-plane angle="202.62" label-a="θ" point-label="(-12, -5)">` instead of
`<geogebra>`. `angle` is the point's standard-position angle in degrees
(`atan2(y,x)`, normalized to `[0,360)`: `atan2(-5,-12) ≈ -157.38° → 202.62°`). Lesson 04's
Example 5 still legitimately uses `<geogebra>` (its own point, same conversion could apply
later if wanted), so that page's GeoGebra head script stays.

### Reference builds

- `trigonometry/2026/2026-08-23-lesson-03-right-triangle-trigonometry/index.html` — first
  page built with these tags: intro blanks, a side-naming exercise with two `<triangle>`
  diagrams, several worked examples with ratio reveals, and a special-angles table with
  per-cell reveals. Example 6 originally used `<geogebra>` (plot (5,3), build the
  triangle, find r) but was converted to `<triangle type="right" axes build>` once `build`
  existed — it's a static, fixed-point diagram, not something needing GeoGebra's
  draggability, and the workbook phrases it as "construct," which `build` matches
  directly. The `<geogebra>` head script was removed from this page entirely once nothing
  in it used `<geogebra>` anymore. **Has an app-managed `content.json` sidecar** (created
  once the editor-app GUI opened this lesson) — kept in sync by hand when index.html is
  hand-edited, so a future editor-app save doesn't clobber this content.
- `trigonometry/2026/2026-08-23-lesson-04-angles-in-the-coordinate-plane/index.html` —
  second page; confirmed `<reveal>`/`<triangle>` need no changes to cover a lesson outside
  right-triangle-only content (angles in any quadrant, sign/quadrant reasoning). Uses
  `<triangle type="right">` even for a *symbolic* triangle (labels like `x_1`, `y_1`, `r`
  instead of numbers — the side-label attributes accept any text) and `<geogebra>` for
  points/rays outside QI.
  - **Found and fixed a real bug while building it**: `SetCoordSystem(...)` as a
    `<geogebra>` command-list line throws "Unknown command" — it's a GeoGebra Apps *API*
    method, not an `evalCommand`-able string. Fix applied to both lesson pages' own inline
    geogebra-init `<head>` scripts: added a `view="xmin,xmax,ymin,ymax"` attribute on
    `<geogebra>`, applied via `api.setCoordSystem(...)` (the real API call) before running
    the command list — use this pattern (not a `SetCoordSystem` command line) whenever a
    diagram needs a non-default zoom/view (e.g. a point far from the origin).

Both verified end-to-end with a headless-Chromium (Playwright) script driving every step —
reveal/re-hide, diagram label positions, table/cell reveals, and GeoGebra applets all
confirmed working with no console errors.

### Open ideas (floated, not yet designed or built)

- **linked-pair** — visual connector between reciprocal relationships (sin↔csc, cos↔sec,
  tan↔cot) or other paired concepts (e.g. "tan θ = slope"). Click one side, the paired
  concept highlights.
- **formula drawer** — floating reference panel (reusing the existing `ggb-float`
  drag/expand/close pattern) pinned to the side, holding standing definitions so they
  don't need to be re-shown every time a later example needs them.
- **discussion-prompt** — lightweight tag for conceptual asides that aren't
  fill-in-the-blank (e.g. "(Why is that always true?)" asides).
- An **`example-box`** container tag was considered and dropped — each workbook example
  maps to its own slide/step, so the step boundary already provides that separation.

When picking one of these up: run it through the same
decide-the-interaction-model-first approach used above before writing code.

## editor-app: Electron install gotcha

`npm start` in `editor-app/` can fail one of two ways:

- `.../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron exited with signal SIGKILL`
- `Error: spawn .../Electron ENOENT` (the binary is simply missing)

Both share one root cause: `node_modules/electron/dist/` either never finished
downloading/extracting `Electron.app`, or the extracted app was incomplete. This has
happened more than once on this machine — it's an environment/download-reliability issue,
not a bug in this project's code.

**Fix (already applied):** `editor-app/package.json`'s `devDependencies.electron` was a
caret range (`^31.0.0`), which lets npm resolve to a different, freshly-downloaded
Electron build on every clean install — and those downloads/extractions proved unreliable
here. It's now pinned to an **exact** version with no caret: `"electron": "41.7.0"`.
`41.7.0` was chosen because it's the exact version already running reliably in the sibling
project `~/Desktop/tutorAI/electronEditorPreview` on this machine — its download is
cached at `~/Library/Caches/electron/` and verified good (checksum-matched), so
reinstalling this exact version reuses that cache instead of re-downloading.

**If this breaks again:**

1. Confirm the binary is actually missing/broken:
   `ls -la editor-app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` —
   should be a real Mach-O executable, and
   `du -sh editor-app/node_modules/electron/dist/Electron.app` should be roughly 270–280M
   total. (The main `Electron` binary itself is normally tiny, ~34KB — that's expected,
   it's a thin loader stub; the bulk of the size is in
   `Electron Framework.framework` inside the bundle. A small main-binary size alone is
   **not** a sign of corruption.)
2. Reinstall pinned to the same known-good version:
   ```
   cd editor-app
   rm -rf node_modules/electron
   npm install electron@41.7.0 --save-exact
   ```
3. Verify it survives an actual launch (not just sitting on disk — the disappearing
   behavior seen before showed up specifically after the app was spawned, not while idle):
   ```
   npm start &
   sleep 5 && pgrep -f "Electron.app/Contents/MacOS/Electron"   # should print a PID
   ```
4. If `41.7.0` itself ever becomes unavailable/broken, check
   `~/Library/Caches/electron/*/` for other cached, checksummed zip versions, and prefer
   pinning to whichever version is already proven-stable in a sibling project on this
   machine over pulling a fresh/latest build.

Do **not** switch back to a caret/range version for `electron` in `editor-app` without a
good reason — the exact pin is what makes installs there reliable.
