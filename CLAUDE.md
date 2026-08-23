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
  numeric `"30°"`-style angle label with e.g. `"α"`/`"β"` for named-angle diagrams).
- `type="scalene"` (a general, non-symmetric triangle) is a **deliberate stub**
  (`layoutScalene`, logs a console error) — general triangle-solving (law of
  sines/cosines) isn't built, since nothing needs it yet. Build it when a lesson actually
  requires a non-symmetric triangle diagram.

Anything that needs to *move* (drag a point, angle sliders, live-updating dependent
values) stays on the existing `<geogebra>` tag instead — `<triangle>` is static only.

### Reference builds

- `trigonometry/2026/2026-08-23-lesson-03-right-triangle-trigonometry/index.html` — first
  page built with these tags: intro blanks, a side-naming exercise with two `<triangle>`
  diagrams, several worked examples with ratio reveals, a special-angles table with
  per-cell reveals, and one example on the existing `<geogebra>` tag.
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
