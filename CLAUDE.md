# todopage — project overview

Static site of interactive math lecture slide-decks, organized by course
(`calculus-ii/`, `calculus3/`, `linear-algebra/`, `trigonometry/`, ...), each with dated
lesson folders containing a self-contained `index.html`. A hub page (`index.html` at the
repo root + `js/hub.js`) lists every lecture from `data/lectures.json`
(course/semester/date/title/subtitle/description/tags/url) with search/filter/favorites.

**`data/lectures.json` is the single source of truth for lesson discovery** — both the
hub page above *and* the editor-app's lesson list (`editor-app/lib/lectures.js`,
`listLectures()`) read from it exclusively; neither scans course folders on disk. A
lesson folder with a real `index.html` but no entry in `data/lectures.json` is invisible
to both the hub and the editor-app, even though the page itself works fine if you link to
it directly. **Whenever a new lesson folder is created by hand** (not through the
editor-app's "new lecture" flow, which writes this entry itself), add a matching object to
`data/lectures.json` in the same pass — copy the shape of a neighboring entry for that
course. This bit a hand-authored `linear-algebra` lesson on 2026-09-10: the folder and
`index.html` existed and rendered correctly, but with no `lectures.json` entry it simply
didn't show up in the editor-app, which looked like an app bug but wasn't.

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
pass still finds the math text). One primitive, five renderings:

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
5. **Block solution** — `<reveal class="solution">`, added 2026-09-10 for
   linear-algebra/calculus lessons whose worked examples are a full paragraph (several
   sentences, display matrices) rather than a short blank. Renders as a left-aligned card
   with a "▸ Click to reveal solution" prompt instead of a dashed underline (`css/steps.css`,
   `reveal.solution` rules). **Must be opted into via the `solution` class, never inferred
   structurally** (e.g. "reveal is the only element child of its `<p>`") — a short inline
   reveal like the SOH-CAH-TOA one in the trig lessons is *also* the sole element child of
   its `<p>`, so a structural selector would wrongly block-ify it too. Use this class only
   when the reveal content is genuinely paragraph-length; keep short-answer reveals on the
   plain inline form.

**Deliberately independent of** `data-reveal`/`reveal-inline` in `js/slideMode.js` — that
older system is sequential and Next/Prev-button-driven, used elsewhere in the codebase.
Do not conflate the two.

**List styling**: `css/steps.css` gives `.step-body ul/ol/li` real indent, inter-item
spacing, and an accent-colored `::marker` (added 2026-09-10 — plain `<ul>` inside a
step used to render as browser-default bullets with no spacing, which read as an
undifferentiated blob next to dense math). No action needed in lesson HTML — just author
normal `<ul><li>` and it picks this up automatically.

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

Also supports `build` (bare boolean), same staged-reveal idea as `<triangle build>` but
with **2** stages instead of 3 (there's less to construct — no legs, no right-angle tick):
stage 1 = the ray/point/arc(s)/angle label(s) ("graph the angle"), stage 2 =
`point-label`/`ray-label` ("here's the point we plotted"). The button/stage-cycling logic
(`attachBuildControl` in `js/triangle.js`) is now **shared** between `<triangle>` and
`<angle-plane>` — it computes the max stage from whatever pieces were actually gated
rather than a hardcoded number, so each tag's own stage count just falls out of how many
stages its pieces use.

`point-label`'s position is computed **radially outward along the ray** (past the
endpoint, plus a small perpendicular nudge), not a fixed screen-space offset — a fixed
offset (which is what `<triangle>`'s `point-label` uses, fine there since that tag's ray
is always oriented up-and-right) would overlap the ray line itself whenever the angle
points down or left, which `<angle-plane>` very much needs to support (that's the whole
point of not being limited to 0–90°).

### Lesson 03 Example 3 also converted to `build`

The 45-45-90 triangle didn't have axes/a plotted point to build up, but it still fit the
same idea: the workbook derives the hypotenuse via the Pythagorean theorem *after* the
legs are drawn, rather than giving it upfront. Now `<triangle type="right" angle="45"
adjacent="1" opposite="1" build>` with `<reveal slot="hypotenuse">\(\sqrt{2}\)</reveal>` —
2 stages (legs+angles, then the hypotenuse blank), no `axes` needed. Confirms `build`
doesn't require `axes` to be useful.

**Bug found and fixed while doing this**: a `<reveal>` used as a diagram label sizes its
box (including the dashed placeholder border) to its *actual* content width even while
that content is hidden — fine inline in a sentence (a longer expected answer gets a
longer blank, which reads naturally), but on a diagram a long expression produced a
comically wide dashed line floating across the triangle, unrelated to where the label
actually anchors. First-pass content also used a full derivation
(`\sqrt{1^2+1^2}=\sqrt{2}`) as the reveal, which is both the direct cause here and
inconsistent with the existing convention elsewhere (Lesson 04 Example 6 only reveals the
plain answer, `\sqrt{34}`) — shortened to match. **Also fixed generally**, not just
patched for this instance: `reveal.triangle-overlay:not(.is-revealed) { max-width: 3em;
overflow: hidden; }` in `css/steps.css` caps any diagram-label reveal to a compact
placeholder pre-click regardless of content length, and lifts the cap once revealed so
long content still displays in full. Keep diagram-label reveal content short by
convention anyway (just the answer, not its derivation) — this CSS is a safety net, not a
license to put long expressions there.

### Second GeoGebra→native conversion: Lesson 04 Example 3

Same reasoning as Lesson 03 Example 6: the workbook's "draw an angle θ with terminal side
through (-12,-5)" is a static, fixed-point diagram — no dragging needed — so it's now
`<angle-plane angle="202.62" label-a="θ" point-label="(-12, -5)">` instead of
`<geogebra>`. `angle` is the point's standard-position angle in degrees
(`atan2(y,x)`, normalized to `[0,360)`: `atan2(-5,-12) ≈ -157.38° → 202.62°`).

**Example 5 converted too** (same reasoning, plus `build`): point (1,-3),
`angle="288.43"` (`atan2(-3,1) ≈ -71.57° → 288.43°`). With Example 3, the demo, and
Example 5 all off `<geogebra>`, nothing in Lesson 04 uses it anymore — its GeoGebra head
script was removed the same way Lesson 03's was.

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

### `<sign-circle radius="2" start-angle="35">` — the first genuinely interactive tag

Everything above (`<reveal>`, `<triangle>`, `<angle-plane>`, `build`) renders once and
reveals in discrete clicks. This is different: a point the **instructor drags live**
around a circle during the lecture, with `x = …` / `y = …` updating continuously and
colored by sign (same blue/red convention) — built so the class watches cos/sin's sign
flip by quadrant *before* the ASTC mnemonic names the pattern, rather than being told the
pattern first. Not a student-facing exercise (no reveal/build gating) — this project is
instructor-operated presentation software throughout; students watch, the instructor
drives every interaction, including this one.

**Implementation — plain Pointer Events, deliberately no library.** Considered D3
(`d3-drag`+`d3-selection`, ~10KB gzipped, the trusted choice for exactly this) but ruled
it out for scope: one point constrained to one circle is less code than wiring up D3 for
it, and it keeps the project dependency-free (KaTeX/GeoGebra via CDN are the only
external loads anywhere on these pages, and GeoGebra is now unused in both trig lessons).
Revisit D3 only if several more drag-based diagrams are wanted later.

- `dot.setPointerCapture(e.pointerId)` on `pointerdown` keeps `pointermove` targeting the
  handle even if the cursor outruns it mid-drag — the standard idiom for a draggable
  handle, and it unifies mouse/touch/pen for free (`touch-action: none` on the handle
  stops touch-scroll from fighting the drag).
- Pointer client coordinates are mapped into SVG user space via
  `svg.createSVGPoint().matrixTransform(svg.getScreenCTM().inverse())` — the correct way
  to convert screen pixels to SVG coordinates that stays right regardless of the
  responsive `viewBox` scaling `.triangle-diagram-figure` already relies on.
- `radius` is a **semantic** value (what `x`/`y` are computed and displayed as, e.g.
  `radius="2"` → values range `[-2, 2]`), independent of the diagram's fixed on-screen
  pixel size (`PIXEL_R = 90`, matching the scale of `<triangle>`/`<angle-plane>`) — so the
  picture reads clearly regardless of what radius number is authored.
- Reuses `renderAxes`/`placeOverlay` from `<triangle>` directly; x/y labels sit at a fixed
  corner spot rather than following the point, so they stay legible instead of jumping
  around or overlapping the point as it's dragged.

Placement: its own step ("Explore: Signs by Quadrant"), inserted immediately before the
existing ASTC step in `trigonometry/2026/2026-08-23-lesson-04-angles-in-the-coordinate-plane/index.html`
(now 14 steps total, renumbered sequentially).

## Second diagram engine: JSXGraph (added 2026-09-16)

Everything above (`<triangle>`, `<angle-plane>`, `<sign-circle>`, `<mirror-angles>`) is a
hand-rolled SVG system (`js/triangle.js`) and **stays exactly as it is** — no existing
lesson gets touched or migrated. JSXGraph (`js/jsxgraph.js`) is a second engine added
alongside it, for the one thing plain hand-coded SVG genuinely doesn't do well: plotting
an arbitrary function curve. Anything a closed-form layout function already covers (a
triangle, a ray in standard position, a point on a circle) has no reason to move to this
engine — this was a deliberate "general capability" addition, not driven by a specific
lesson that needed it yet.

**Naming**: every tag this engine renders is prefixed `jsx-` (`<jsx-graph>`,
`<jsx-radian-arc>`), so it's never ambiguous in a lesson's HTML which of the two systems a
diagram uses. Future JSXGraph-backed tags should keep this prefix.

**Loading is opt-in per lesson**, not global. Unlike KaTeX (loaded unconditionally on
every lesson), the JSXGraph library itself is only added to the `<head>` of lessons that
actually use a `<jsx-*>` tag — the same convention `<geogebra>`'s own head script already
uses. `js/boot.js` imports `js/jsxgraph.js` unconditionally (harmless on every other
lesson, same reasoning `reveal.js`/`triangle.js` already rely on), but the actual library
load is manual, per lesson:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph@1.13.3/distrib/jsxgraph.css">
<script defer src="https://cdn.jsdelivr.net/npm/jsxgraph@1.13.3/distrib/jsxgraphcore.min.js"></script>
```

**No error suppression**: if a `<jsx-*>` tag exists on a page that forgot the library
tags above, `js/jsxgraph.js` throws a clear, visible `console.error` naming the exact fix
rather than silently rendering an empty box — a blank diagram with no explanation would
be far more confusing to debug than a loud error. This matches the project's general
"don't suppress benign console errors" preference.

**Styling**: boards are initialized with `showNavigation:false, showCopyright:false,
pan:{enabled:false}, zoom:{enabled:false}` so a plotted function reads as a static
diagram consistent with every other tag's interaction philosophy (instructor-driven,
not a pan/zoom widget for students to explore unsupervised), not as a foreign embedded
widget. Axes are recolored from JSXGraph's defaults to the site's own `--ink`/`--accent`/
`--line` tokens (read via `getComputedStyle` at render time, since JSXGraph needs a
literal color string, not a live `var(--x)` reference) so a `<jsx-*>` diagram matches the
rest of the page rather than looking dropped-in from elsewhere.

**Legibility is tuned for classroom projection, not screen reading** (added
2026-09-16, same day) — these lessons are projected for a room, not read up close, so
every stroke width, point size, and font size in `js/jsxgraph.js` traces back to one
named constant near the top of the file (`AXIS_STROKE`, `CURVE_STROKE`, `POINT_SIZE`,
`READOUT_VALUE_FONT`, etc.) rather than being tuned ad hoc per tag — one edit re-tunes the
whole engine instead of a hunt through every render function. Two JSXGraph defaults
needed overriding to get there, both non-obvious enough to be worth naming: (1) a
default axis's ticks are full-board-spanning (`majorHeight: -1`) with 4 minor ticks
between each major one — a "graph paper" look read as noise here, fixed by the shared
`styleAxes()` helper setting `minorTicks: 0` and a finite `majorHeight`; (2) tick label
font size isn't a board- or axis-level attribute — it's set via
`axis.defaultTicks.setAttribute({ label: { fontSize, cssStyle } })` on the ticks
sub-object specifically. `styleAxes()` also enlarges each axis's `lastArrow`, otherwise
easy to lose from the back of a room. Container width (`.jsx-diagram` in
`css/steps.css`) is 720px, wider than `.triangle-diagram`'s 420px on the same reasoning.

**`<jsx-graph fn="…" xmin="…" xmax="…" ymin="…" ymax="…">`**: `fn` is a JS expression in
`x` (e.g. `fn="Math.sin(x)"`, `fn="x*x - 3"`), built into a real function via `new
Function('x', ...)` — safe here since lesson content is instructor-authored, not
untrusted input, the same trust level as any other inline script already on these pages.
Bounding box defaults to `[-10, 10]` on both axes if omitted; always pass explicit bounds
for anything trig-scale (e.g. `xmin="-7" xmax="7"` for a period-`2π`-ish curve) since the
generic default won't frame it usefully.

**`<jsx-radian-arc radius="5">`** (added 2026-09-16, for Radian Measure's own
definition step): a fixed unit circle plus a second circle of the given radius, each with
its own independently-draggable point (a JSXGraph glider, not a click-to-reveal). Both
points start at angle \(0\) (the outer one literally at `(radius, 0)`), and dragging
either live-updates that circle's own angle (radians, standard position, normalized to
\([0, 2\pi)\) since a point's position on a circle can't itself distinguish coterminal
turns), arc length \(s = r\theta\), and \(s/r\), so the relationship is something a
student watches update rather than being told as a formula. This needed true
point-dragging plus a second independent point to compare against — the closest existing
SVG tag, `<sign-circle>` in `triangle.js`, drags one point around one circle but has no
notion of arc length or a second circle, and extending it that way would already be most
of the way to reimplementing JSXGraph's glider/arc primitives by hand. Both circles'
dynamic elements (glider, radius segment, swept arc) deliberately share one accent color
rather than being color-coded against each other — they never overlap on screen
(different radii), each readout block already names its own circle, and a second ad hoc
color would be a one-off meaning not shared by any other diagram in the codebase (unlike
the deliberate blue/red sign convention on `<angle-plane>`, used consistently everywhere
a value's sign matters). Uses the `.jsx-board--square` CSS modifier (aspect-ratio 1/1)
since `keepaspectratio: true` is required just to keep the circles round, and the
default 3:2 container would otherwise letterbox them.

**No editor-app changes needed**, same reasoning as the original general-purpose tags:
`boot.js`'s unconditional import is inert with no `<jsx-*>` tags present, so
`editor-app/templates/lecture-template.js` needed no updates. Hand-authors just need to
remember the CDN snippet above in a new lesson's own `<head>`, the same manual step
`<geogebra>` already requires.

### `<jsx-chain-demo>`: instructor-driven parameter cascade (added 2026-09-15)

`<jsx-chain-demo param="t" tmin="0" tmax="6.283185307" var1-label="L" var1-fn="Math.cos(t)"
var2-label="M" var2-fn="Math.sin(t)" var3-label="K" var3-fn="Math.cos(t) * Math.sin(t)">`
(`renderJsxChainDemo` in `js/jsxgraph.js`). Built for right after the "From One Variable
to Several: Motivating the Chain Rule" step (one independent variable: `x=g(t)`,
`y=h(t)`, `z=f(x,y)`) in
`calculus3/fall2025/2025-02-11-partial-derivatives/index.html`, so the dependency that
step motivates in words is something a student watches happen before the theorem states
it as a formula. One draggable
JSXGraph `slider` (the parameter, named via `param`) sits above up to three read-only
"driven" gauges (`var1`/`var2`/`var3`, each with its own `-label`, a JS `-fn` expression
in the parameter, and an optional `-lo`/`-hi` domain override, default `[-1, 1]`). Only
the parameter slider is draggable: the driven rows are plain fixed points whose position
is a function of the slider's current value, matching this project's instructor-driven
interaction philosophy (same as `<sign-circle>`/`<jsx-radian-arc>`: one thing to grab,
everything else reacts). No `var{n}-fn` attributes at all renders a working default
(L = cos t, M = sin t, K = cos t times sin t); passing any `var{n}-fn` replaces the whole
set with exactly the rows given (1 to 3), so a different lesson can demo a different
composition without touching `js/jsxgraph.js`.

Each driven row maps its own semantic domain onto one shared fixed-width on-screen track
(`GAUGE_TRACK_LEN`), the same "semantic value, fixed screen size" split `<sign-circle>`'s
`radius` attribute already relies on, so the parameter's own domain (radians here, but
caller-supplied via `tmin`/`tmax`) and the driven rows' differing ranges can share one
visual layout without any row secretly meaning two different things on screen.

**`combo-fn` (added the same day, right after the tag itself): a 4th row that is a
function OF the driven rows, not of t directly** (e.g. `combo-label="F"
combo-fn="L + M**2 + K**3 + 4"`), for the second link in the chain: t moves L/M/K, then
L/M/K move this combined quantity, mirroring z=f(x,y) sitting on top of x(t)/y(t) in the
theorem itself rather than depending on t directly. Written using the three driven rows'
own labels as the formula's parameter names (`new Function(rows[0].label, rows[1].label,
rows[2].label, ...)`), so it reads like the math on the page instead of needing separate
generic variable names; only works when there are exactly 3 `var{n}-fn` rows to name (a
clear `console.error` otherwise, this project's usual no-suppression convention). Its
gauge domain (`combo-lo`/`combo-hi`) auto-fits to the formula's real min/max sampled over
`[tmin, tmax]` (200 samples, 5% padding) when not given explicitly, since a combined
quantity routinely lands on a different scale than the `[-1,1]`-ish rows feeding it (the
default demo's F ranges about 2.9 to 5.5, nothing like L/M/K's own ranges).

**Per-row Fix button (added the same day, after `combo-fn`)**: every base row (not the
combo row itself, since isolating a row's contribution only makes sense for the rows a
combo formula is built from) gets a JSXGraph `button` element that toggles `row.fixed`.
Fixing a row freezes it at whatever value it holds the instant you click Fix (`row.frozenValue
= row.f(slider.Value())`) and greys out its dot (`fillColor: '#9aa0a6'`); dragging t
afterward no longer moves that row at all, only the still-unfixed ones (and, through
them, the combo row) -- this is how the tag demonstrates holding every other variable
constant to isolate one intermediate's contribution to the combo quantity, the visual
equivalent of a partial derivative. **Deliberately not draggable once fixed**: it just
locks in place at that snapshot; to get a different frozen value, unfix, drag t until the
row shows the value you want, then fix again. Every row's rendering (`mappedX`, its own
readout text, and the combo row's own formula) reads `row.value(t)` -- `row.fixed ?
row.frozenValue : row.f(t)` -- uniformly, rather than special-casing fixed vs. live rows
at each call site.

Implementation note on the button label: JSXGraph's `button` element is built internally
on top of a `text` element (`i.create("text", ..., l)`, per its own source), and its
label argument goes through that same `text` element's `setText`, so passing a function
(`() => (row.fixed ? 'Unfix' : 'Fix')`) as the label re-evaluates it on every
`board.update()` exactly like any other dynamic text -- no manual DOM manipulation of the
button's rendered node needed to flip the label.

One JSXGraph quirk found and fixed while building this: a `slider` shows its own
"name = value" label near the handle by default, even with `name: ''` set (it still
prints the bare value), which collided visually with this tag's own readout text placed
to the right of the track. `withLabel: false` on the slider's own `create()` call turns
that default label off entirely, leaving just this tag's own readout.

New CSS modifier: `.jsx-board--wide` (aspect-ratio 2.4/1, `css/steps.css`), since this tag
stacks a slider plus a few gauge rows: short and wide, not a 2D plot, so the default 3:2
`.jsx-board` box would waste vertical space.

Verified end-to-end with a headless-Chromium (Playwright) script: loaded the lesson,
advanced Slide Mode to the new step, dragged the parameter slider's actual on-screen
handle, and confirmed every driven row's readout updates to the correct value with no
console errors. Also verified the Fix mechanic specifically: fixed M and K's buttons
(both flipped to "Unfix," both dots greyed out), dragged t from π to 2π, and confirmed
only L and F changed (L: -1.00 to 1.00, F: 3.00 to 5.00) while M and K's readouts stayed
exactly put, matching L + 0² + 0³ + 4 at both ends.

### Reference build

- `trigonometry/2026/2026-09-16-lesson-08-radian-measure/index.html` — first lesson using
  this engine. Step 2 (Definition: The Radian) uses `<jsx-radian-arc radius="5">` right
  where the radian is first defined, so the arc-length/radius relationship is explored
  live before the degree-radian conversion procedure two steps later gives it a formula.
- `calculus3/fall2025/2025-02-11-partial-derivatives/index.html` — second lesson, and
  first use of `<jsx-chain-demo>`. Inserted as its own step ("Explore: Watching the Chain
  Rule in Motion") right after "From One Variable to Several: Motivating the Chain Rule",
  before the one-independent-variable theorem. Uses the tag's `combo-fn` row too:
  `F = L + M² + K³ + 4`, so the step shows both links in the chain, t driving L/M/K and
  L/M/K driving F, not just the first one. Has an app-managed `content.json` sidecar; the
  step was mirrored into it by hand.

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
