// <jsx-graph fn="Math.sin(x)" xmin="-7" xmax="7" ymin="-2" ymax="2"
//   fn2="Math.cos(x)" label="y = sin x" label2="y = cos x" pi-ticks>
//
// Second diagram engine, alongside triangle.js's hand-rolled SVG system
// (<triangle>/<angle-plane>/<sign-circle>/<mirror-angles>). That system stays
// exactly as-is -- every existing lesson keeps rendering the same way. This
// module is additive, for the one thing plain hand-coded SVG genuinely can't
// do well: plotting an arbitrary function curve. Anything a closed-form
// layout function already covers (a triangle, a ray in standard position, a
// point on a circle) has no reason to move to this engine.
//
// Naming: every tag this engine renders is prefixed `jsx-`, so it's never
// ambiguous in a lesson's HTML which of the two systems a diagram uses.
//
// Loading: unlike triangle.js, this module depends on the JSXGraph library
// itself (window.JXG), which is NOT loaded on every lesson page -- only
// lessons with a <jsx-*> tag should add it, in that lesson's own <head>,
// the same opt-in convention <geogebra> already uses for its own script:
//
//   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph@1.13.3/distrib/jsxgraph.css">
//   <script defer src="https://cdn.jsdelivr.net/npm/jsxgraph@1.13.3/distrib/jsxgraphcore.min.js"></script>
//
// boot.js still imports this module unconditionally (harmless on every other
// lesson, same reasoning as reveal.js/triangle.js needing no gating) -- but
// if a <jsx-*> tag exists on a page that forgot the library tags above, this
// throws a clear, visible console error naming the fix rather than quietly
// rendering an empty box. Silently no-op-ing here would just look like a
// broken diagram with no clue why.
//
// `pi-ticks`, `fn2`/`label`/`label2` added for Lesson 11 (Graphing Sine and
// Cosine), this tag's first real use in a lesson:
//
// `pi-ticks` (bare boolean): every graph in that lesson has a radian-scale
// x-axis, so the default axis's auto-generated decimal ticks (1.57, 3.14,
// ...) would be unreadable. Swaps them for major ticks at every multiple of
// π/2, labeled as reduced π-fractions ("π/2", "π", "3π/2", "2π", ...) via
// `piTickLabel` below, and aligns the background grid's vertical spacing to
// that same π/2 step so the grid lines actually land on the labeled ticks
// instead of an unrelated 1-unit grid crossing them at arbitrary points.
//
// `fn2`/`label`/`label2`: several examples graph two curves on the same axes
// for direct comparison (an amplitude- or period-scaled curve against its
// parent sine/cosine) -- one more function on the same board, not a second
// board, matches how the workbook itself draws them. `fn2` renders dashed in
// the site's muted gray, distinct from the primary curve's solid accent
// color; `label`/`label2` are optional plain-text captions (not KaTeX --
// consistent with every other dynamic jsx-* text) pinned near the top-left
// corner so the instructor doesn't have to say "the blue one" out loud.
function piTickLabel(x) {
  const half = Math.PI / 2;
  const k = Math.round(x / half);
  if (k === 0) return '0';
  let n = k;
  let d = 2;
  if (n % 2 === 0) { n = n / 2; d = 1; }
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  const coeff = n === 1 ? '' : String(n);
  return d === 1 ? `${sign}${coeff}π` : `${sign}${coeff}π/${d}`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let boardCounter = 0;

// Sizes tuned for classroom projection, not screen reading up close -- a
// student in the back row needs to make out a line or a number, not just a
// developer at arm's length from a laptop. Every stroke/point/font size in
// this file traces back to one of these constants so the whole engine stays
// legible the same way, and so future tuning is one edit, not a hunt through
// every render function.
const AXIS_STROKE = 2.5;
const AXIS_ARROW_SIZE = 12;
const TICK_MAJOR_HEIGHT = 12;
const TICK_LABEL_FONT = 18;
const GRID_STROKE = 1.5;
const CURVE_STROKE = 4;
const REF_CIRCLE_STROKE = 2;
const RADIUS_SEGMENT_STROKE = 2.5;
const ARC_STROKE = 5;
const POINT_SIZE = 8;
const POINT_STROKE = 3;
const READOUT_HEADING_FONT = 18;
const READOUT_VALUE_FONT = 22;

// JSXGraph's default axis ticks are full-board-spanning (majorHeight: -1)
// with 4 minor ticks between each major one -- a "graph paper" look that
// reads as visual noise against this site's plainer style. Trim to short,
// major-only tick marks with large, bold labels; a real grid (when wanted)
// is its own explicit `board.create('grid', ...)` call instead of
// piggybacking on tick styling. Also enlarges the arrowhead at each axis's
// positive end, which is otherwise easy to lose from the back of a room.
function styleAxes(board, ink) {
  [board.defaultAxes.x, board.defaultAxes.y].forEach((axis) => {
    axis.setAttribute({
      strokeColor: ink, strokeWidth: AXIS_STROKE, highlight: false,
      lastArrow: { size: AXIS_ARROW_SIZE, type: 1 },
    });
    axis.defaultTicks.setAttribute({
      minorTicks: 0,
      majorHeight: TICK_MAJOR_HEIGHT,
      label: { fontSize: TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
    });
  });
}

// Static function plot only, matching the rest of the site's interaction
// philosophy (instructor-driven, not a pan/zoom widget for students to
// explore unsupervised) -- pan/zoom/navigation UI is deliberately off.
function renderJsxGraph(el) {
  if (typeof JXG === 'undefined') {
    console.error(
      '<jsx-graph>: JXG is not defined. Add the JSXGraph <link>/<script> tags ' +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const fnAttr = el.getAttribute('fn') || 'x';
  const fn2Attr = el.getAttribute('fn2');
  const piTicks = el.hasAttribute('pi-ticks');
  const label = el.getAttribute('label');
  const label2 = el.getAttribute('label2');
  const xmin = parseFloat(el.getAttribute('xmin') || '-10');
  const xmax = parseFloat(el.getAttribute('xmax') || '10');
  const ymin = parseFloat(el.getAttribute('ymin') || '-10');
  const ymax = parseFloat(el.getAttribute('ymax') || '10');

  let f;
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    f = new Function('x', `return ${fnAttr};`);
  } catch (err) {
    console.error(`<jsx-graph>: could not parse fn="${fnAttr}"`, err);
    return;
  }

  let f2 = null;
  if (fn2Attr) {
    try {
      // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
      f2 = new Function('x', `return ${fn2Attr};`);
    } catch (err) {
      console.error(`<jsx-graph>: could not parse fn2="${fn2Attr}"`, err);
    }
  }

  const container = document.createElement('div');
  container.className = 'jsx-diagram';
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  el.replaceWith(container);

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [xmin, ymax, xmax, ymin],
    axis: true,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: false,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';
  const muted = cssVar('--muted') || '#6b7280';

  styleAxes(board, ink);

  if (piTicks) {
    // Replace the default axis's own auto numeric ticks with major ticks at
    // every π/2, labeled as reduced π-fractions -- see piTickLabel above.
    // A plain numeric `ticksDistance` (JSXGraph's [axis, distance] form) is
    // NOT enough here: with `insertTicks` off it silently falls back to
    // whole-number spacing instead of honoring a non-integer distance like
    // π/2, so the exact tick positions are computed by hand and passed as an
    // explicit array instead -- the one form of the second `ticks` parent
    // JSXGraph reliably places exactly where given.
    board.defaultAxes.x.defaultTicks.setAttribute({ visible: false });
    const half = Math.PI / 2;
    const kMin = Math.ceil(xmin / half);
    const kMax = Math.floor(xmax / half);
    const positions = [];
    for (let k = kMin; k <= kMax; k++) positions.push(k * half);
    board.create('ticks', [board.defaultAxes.x, positions], {
      drawLabels: true,
      minorTicks: 0,
      majorHeight: TICK_MAJOR_HEIGHT,
      strokeColor: ink,
      strokeWidth: AXIS_STROKE,
      label: { fontSize: TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
      generateLabelText: (tick) => piTickLabel(tick.usrCoords[1]),
    });
  }

  const gridAttrs = { strokeColor: line, strokeWidth: GRID_STROKE };
  if (piTicks) gridAttrs.gridX = Math.PI / 2;
  board.create('grid', [], gridAttrs);

  board.create('functiongraph', [f], { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });
  if (f2) {
    board.create('functiongraph', [f2], {
      strokeColor: muted, strokeWidth: CURVE_STROKE, dash: 2, highlight: false,
    });
  }

  // Fixed-position captions naming each curve, so the instructor doesn't
  // have to say "the blue one" out loud -- pinned near the top-left corner
  // of the plot area, but nudged right of x=0 and down from the very top
  // edge so they never sit on top of the y-axis's own tick-label column
  // (which JSXGraph draws just left of x=0) or the topmost y tick itself.
  const labelX = Math.max(xmin, 0) + (xmax - xmin) * 0.05;
  if (label) {
    board.create('text', [labelX, ymax - (ymax - ymin) * 0.13, label], {
      fontSize: READOUT_VALUE_FONT - 4, color: accent, fixed: true, cssStyle: 'font-weight:700',
    });
  }
  if (label2 && f2) {
    board.create('text', [labelX, ymax - (ymax - ymin) * 0.24, label2], {
      fontSize: READOUT_VALUE_FONT - 4, color: muted, fixed: true, cssStyle: 'font-weight:700',
    });
  }
}

// <jsx-radian-arc radius="5">
//
// A fixed unit circle plus a second circle of the given radius, each with its
// own draggable point (glider). Dragging updates a live angle (radians,
// standard position, normalized to [0, 2π) since a point's position on a
// circle can't itself distinguish coterminal turns) and arc-length readout
// per circle, so s = rθ (equivalently θ = s/r) is something a student watches
// update live rather than being told as a formula -- built for Radian
// Measure's own definition step, where the whole point is that comparison
// across two different radii.
//
// This needed true point-dragging plus a second, independent draggable
// point to compare against -- the closest existing SVG tag, <sign-circle> in
// triangle.js, drags one point around one circle but has no notion of arc
// length or a second circle, and extending it that way would already be most
// of the way to reimplementing JSXGraph's glider/arc primitives by hand.
//
// Both circles' dynamic elements (glider, radius segment, swept arc) share
// one accent color rather than being color-coded against each other --
// they never overlap on screen (different radii), each block of readout
// text already names its own circle, and a second ad hoc color would be a
// one-off meaning not shared by any other diagram in the codebase (unlike
// the deliberate blue/red sign convention on <angle-plane>, which is used
// consistently everywhere a value's sign matters).
function renderJsxRadianArc(el) {
  if (typeof JXG === 'undefined') {
    console.error(
      '<jsx-radian-arc>: JXG is not defined. Add the JSXGraph <link>/<script> tags ' +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const radius = parseFloat(el.getAttribute('radius') || '5');
  const pad = 1.5;
  const headroom = 3.4; // room for the live readout text above both circles
  const side = radius + pad;
  const top = radius + headroom;
  const bottom = -(radius + pad);

  const container = document.createElement('div');
  container.className = 'jsx-diagram';
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--square';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  el.replaceWith(container);

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [-side, top, side, bottom],
    axis: true,
    grid: false,
    keepaspectratio: true,
    showNavigation: false,
    showCopyright: false,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';

  styleAxes(board, ink);

  const center = board.create('point', [0, 0], { visible: false, fixed: true, name: '' });

  // One circle + its glider + its live angle()/arcLength() readers. `r`'s
  // own radius line segment is drawn too, so "radius" stays a visible length
  // on screen, not just a number in the formula.
  function addCircle(r) {
    const circle = board.create('circle', [center, r], {
      strokeColor: line, strokeWidth: REF_CIRCLE_STROKE, fixed: true, highlight: false, name: '',
    });
    const zero = board.create('point', [r, 0], { visible: false, fixed: true, name: '' });
    const glider = board.create('glider', [r, 0, circle], {
      name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, highlight: false,
    });
    board.create('segment', [center, glider], {
      strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
    });
    board.create('arc', [center, zero, glider], {
      strokeColor: accent, strokeWidth: ARC_STROKE, highlight: false,
    });

    function angle() {
      const a = Math.atan2(glider.Y(), glider.X());
      return a < 0 ? a + 2 * Math.PI : a;
    }
    return { angle, arcLength: () => r * angle() };
  }

  const unit = addCircle(1);
  const outer = addCircle(radius);

  // Fixed-position, live-updating readout blocks -- one per circle, each
  // naming its own circle so the shared accent color never has to carry
  // that distinction on its own.
  function addReadout(x, heading, reader, r) {
    const gap = Math.max(0.55, radius * 0.13);
    const valueOpts = { fontSize: READOUT_VALUE_FONT, color: accent, fixed: true, cssStyle: 'font-weight:700' };
    let y = top - 0.6;
    board.create('text', [x, y, () => heading], {
      fontSize: READOUT_HEADING_FONT, color: ink, fixed: true, cssStyle: 'font-weight:600',
    });
    y -= gap;
    board.create('text', [x, y, () => `θ = ${reader.angle().toFixed(2)} rad`], valueOpts);
    y -= gap;
    board.create('text', [x, y, () => `s = ${reader.arcLength().toFixed(2)}`], valueOpts);
    y -= gap;
    board.create('text', [x, y, () => `s / r = ${(reader.arcLength() / r).toFixed(2)}`], {
      fontSize: READOUT_VALUE_FONT, color: ink, fixed: true, cssStyle: 'font-weight:700',
    });
  }

  addReadout(-side + 0.2, 'Unit circle (r = 1)', unit, 1);
  addReadout(0.2, `Circle of radius ${radius}`, outer, radius);
}

// <jsx-chain-demo param="t" tmin="0" tmax="6.283185307"
//   var1-label="L" var1-fn="Math.cos(t)"
//   var2-label="M" var2-fn="Math.sin(t)"
//   var3-label="K" var3-fn="Math.cos(t) * Math.sin(t)">
//
// One draggable parameter slider (t) plus up to three read-only "driven"
// gauges (L, M, K by default) that move automatically as functions of t --
// built to make concrete, right after the one-independent-variable chain
// rule is stated (x=g(t), y=h(t), z=f(x,y)), what the theorem is actually
// saying: one independent variable moving drags every quantity that depends
// on it. Not a student exercise (no reveal/build gating, nothing but the
// master slider is draggable) -- matches this project's instructor-driven
// interaction philosophy, same as <sign-circle>/<jsx-radian-arc>: one thing
// to grab, everything else reacts.
//
// If none of var1-fn/var2-fn/var3-fn are given, all three default rows
// (L=cos t, M=sin t, K=cos t · sin t) render -- a working demo out of the
// box. Passing any var{n}-fn attribute replaces the whole set with exactly
// the rows given (1-3), so a lesson can demo a different composition without
// touching this file.
//
// Each driven row maps its own value domain (var{n}-lo/-hi, default [-1,1])
// onto one shared fixed-width on-screen track (GAUGE_TRACK_LEN board units)
// -- the same "semantic value, fixed screen size" split <sign-circle> uses
// for its radius -- so t's own domain (radians here, but caller-supplied)
// and L/M/K's differing ranges can share one visual layout without any row
// secretly meaning two different things on screen.
//
// Optional `combo-fn` (e.g. `combo-fn="L + M**2 + K**3 + 4"`, `combo-label`
// default "F") adds a 4th row that is a function OF the three driven rows
// instead of directly of t -- the second link in the chain, t -> (L,M,K) ->
// F, mirroring z=f(x,y) sitting on top of x(t)/y(t) in the theorem itself.
// Written using the rows' own labels so it reads like the math; requires
// exactly 3 var{n}-fn rows to name. Its gauge domain (`combo-lo`/`combo-hi`)
// auto-fits to the formula's actual min/max over [tmin,tmax] when omitted,
// since a combined quantity often lands on a different scale than the
// [-1,1]-ish rows feeding it.
const GAUGE_TRACK_LEN = 6;
const GAUGE_ROW_GAP = 1.3;

function renderJsxChainDemo(el) {
  if (typeof JXG === 'undefined') {
    console.error(
      '<jsx-chain-demo>: JXG is not defined. Add the JSXGraph <link>/<script> tags ' +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const paramLabel = el.getAttribute('param') || 't';
  const tmin = parseFloat(el.getAttribute('tmin') || '0');
  const tmax = parseFloat(el.getAttribute('tmax') || String(2 * Math.PI));
  const tstart = parseFloat(el.getAttribute('tstart') || String((tmin + tmax) / 2));

  const defaults = [
    { label: 'L', fn: 'Math.cos(t)', lo: -1, hi: 1 },
    { label: 'M', fn: 'Math.sin(t)', lo: -1, hi: 1 },
    { label: 'K', fn: 'Math.cos(t) * Math.sin(t)', lo: -0.6, hi: 0.6 },
  ];
  const explicit = [1, 2, 3]
    .filter((i) => el.hasAttribute(`var${i}-fn`))
    .map((i) => ({
      label: el.getAttribute(`var${i}-label`) || `v${i}`,
      fn: el.getAttribute(`var${i}-fn`),
      lo: parseFloat(el.getAttribute(`var${i}-lo`) || '-1'),
      hi: parseFloat(el.getAttribute(`var${i}-hi`) || '1'),
    }));
  const specs = explicit.length ? explicit : defaults;

  const rows = [];
  for (const spec of specs) {
    let f;
    try {
      // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
      f = new Function('t', `return ${spec.fn};`);
    } catch (err) {
      console.error(`<jsx-chain-demo>: could not parse fn="${spec.fn}"`, err);
      return;
    }
    // `fixed`/`frozenValue` back a per-row Fix toggle (added below, once the
    // board exists): freezing a row detaches it from t entirely, so dragging
    // t only moves the still-unfixed rows (and, through them, the combo row)
    // -- how you isolate one intermediate variable's effect on the combo
    // quantity, the way "hold y fixed" isolates partial-x in the chain rule.
    rows.push({ ...spec, f, fixed: false, frozenValue: null });
  }
  rows.forEach((row) => {
    row.value = (t) => (row.fixed ? row.frozenValue : row.f(t));
  });

  // Optional 4th row: a function OF the driven rows (L, M, K by default),
  // not directly of t -- shows the second link in the chain (t moves L/M/K,
  // then L/M/K move this combined quantity), mirroring z=f(x,y) sitting on
  // top of x(t)/y(t) in the theorem itself. Referenced by the rows' own
  // labels (e.g. combo-fn="L + M**2 + K**3 + 4") so the formula reads like
  // the math rather than needing separate generic parameter names -- this
  // only works when there are exactly 3 base rows to name, since combo-fn is
  // compiled with exactly 3 parameters.
  const comboFnAttr = el.getAttribute('combo-fn');
  if (comboFnAttr) {
    if (rows.length !== 3) {
      console.error(
        `<jsx-chain-demo>: combo-fn requires exactly 3 var{n}-fn rows to name (L, M, K by ` +
        `default), got ${rows.length}.`
      );
    } else {
      let comboF;
      try {
        // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
        comboF = new Function(rows[0].label, rows[1].label, rows[2].label, `return ${comboFnAttr};`);
      } catch (err) {
        console.error(`<jsx-chain-demo>: could not parse combo-fn="${comboFnAttr}"`, err);
        comboF = null;
      }
      if (comboF) {
        // Reads each base row's *effective* value (frozen or live) rather
        // than recomputing raw f(t) -- so fixing L and K, say, and then
        // dragging t moves only M and, through M alone, this combo row.
        const composed = (t) => comboF(rows[0].value(t), rows[1].value(t), rows[2].value(t));
        let lo = parseFloat(el.getAttribute('combo-lo'));
        let hi = parseFloat(el.getAttribute('combo-hi'));
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
          // Auto-fit the gauge to this formula's actual range over the full
          // parameter sweep (with nothing fixed), since a combined quantity
          // can land on a wholly different scale than the [-1,1]-ish rows
          // feeding it.
          const samples = 200;
          let min = Infinity;
          let max = -Infinity;
          for (let i = 0; i <= samples; i++) {
            const v = composed(tmin + (tmax - tmin) * (i / samples));
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const pad = Math.max((max - min) * 0.05, 1e-6);
          lo = min - pad;
          hi = max + pad;
        }
        // isCombo marks this row as never fixable (see the Fix-button loop
        // below) -- only the base rows it's built from can be frozen.
        rows.push({
          label: el.getAttribute('combo-label') || 'F', fn: comboFnAttr, lo, hi,
          f: composed, value: composed, fixed: false, isCombo: true,
        });
      }
    }
  }

  const container = document.createElement('div');
  container.className = 'jsx-diagram';
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--wide';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  el.replaceWith(container);

  const trackStart = 0;
  const trackEnd = GAUGE_TRACK_LEN;
  const leftLabelX = trackStart - 1.4;
  const readoutX = trackEnd + 0.6;
  const fixButtonX = readoutX + 2.6;
  const top = (1 + rows.length) * GAUGE_ROW_GAP + 0.9;
  const bottom = -0.5;

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [leftLabelX - 0.3, top, fixButtonX + 1.6, bottom],
    axis: false,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: false,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';

  board.create('text', [trackStart, top - 0.5, () => `Drag ${paramLabel} — watch every dependent quantity move with it`], {
    fontSize: READOUT_HEADING_FONT, color: ink, fixed: true, cssStyle: 'font-weight:600',
  });

  let y = top - GAUGE_ROW_GAP * 1.4;

  board.create('text', [leftLabelX, y, () => paramLabel], {
    fontSize: READOUT_VALUE_FONT, color: ink, fixed: true, cssStyle: 'font-weight:700',
  });
  const slider = board.create('slider', [[trackStart, y], [trackStart + trackEnd, y], [tmin, tstart, tmax]], {
    name: '',
    withLabel: false, // suppress JSXGraph's own "value" label -- our own readout text covers it
    snapWidth: 0.01,
    size: POINT_SIZE,
    strokeColor: accent, fillColor: accent, strokeWidth: POINT_STROKE,
    baseline: { strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, highlight: false },
    highlight: false,
  });
  board.create('text', [readoutX, y, () => `${paramLabel} = ${slider.Value().toFixed(2)}`], {
    fontSize: READOUT_VALUE_FONT, color: accent, fixed: true, cssStyle: 'font-weight:700',
  });

  rows.forEach((row) => {
    y -= GAUGE_ROW_GAP;

    board.create('text', [leftLabelX, y, () => row.label], {
      fontSize: READOUT_VALUE_FONT, color: ink, fixed: true, cssStyle: 'font-weight:700',
    });
    board.create('segment', [[trackStart, y], [trackStart + trackEnd, y]], {
      strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, fixed: true, highlight: false,
    });
    board.create('text', [trackStart, y - 0.4, () => row.lo.toFixed(1)], {
      fontSize: TICK_LABEL_FONT, color: ink, fixed: true,
    });
    board.create('text', [trackStart + trackEnd, y - 0.4, () => row.hi.toFixed(1)], {
      fontSize: TICK_LABEL_FONT, color: ink, fixed: true,
    });

    function mappedX() {
      const v = row.value(slider.Value());
      const clamped = Math.min(row.hi, Math.max(row.lo, v));
      return trackStart + trackEnd * (clamped - row.lo) / (row.hi - row.lo);
    }

    const dot = board.create('point', [mappedX, y], {
      name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent,
      strokeWidth: POINT_STROKE, fixed: true, highlight: false,
    });
    board.create('text', [readoutX, y, () => `${row.label} = ${row.value(slider.Value()).toFixed(2)}`], {
      fontSize: READOUT_VALUE_FONT, color: accent, fixed: true, cssStyle: 'font-weight:700',
    });

    // Fix toggle: freezes this row at whatever value it holds right now (t
    // stops moving it), so dragging t afterward isolates every *other*
    // still-unfixed row's contribution to the combo row. Locks in place
    // rather than becoming draggable itself -- to change a frozen value,
    // unfix, drag t to where the row shows the value you want, then fix
    // again. Not offered on the combo row itself (see `isCombo` above): only
    // the rows a combo formula is built from make sense to isolate.
    if (!row.isCombo) {
      board.create('button', [
        fixButtonX, y, () => (row.fixed ? 'Unfix' : 'Fix'),
        () => {
          row.fixed = !row.fixed;
          if (row.fixed) row.frozenValue = row.f(slider.Value());
          dot.setAttribute({ fillColor: row.fixed ? '#9aa0a6' : accent });
          board.update();
        },
      ], {
        fixed: true, cssStyle: `font-size:${TICK_LABEL_FONT}px; font-weight:600; padding:2px 10px; border-radius:6px;`,
      });
    }
  });
}

// <jsx-unit-circle start-angle="60" show-grid show-labels="all" coterminal
//   target-x="-0.5" target-y="-0.8660254,0.5">
//
// One flexible manipulative reused across every step of the Unit Circle
// lesson (construction, evaluating expressions, coterminal reduction, and
// "given one ratio find the rest"), rather than a one-off tag per exercise --
// same reasoning as <triangle>/<angle-plane> being general primitives instead
// of per-example diagrams. The draggable point is deliberately always
// SNAPPED to the circle's 16 conventional special angles (multiples of 30°
// and 45°) -- unlike <sign-circle>, which drags continuously because its
// whole point is watching a sign flip smoothly, this diagram's whole point
// *is* those 16 memorizable points, so free continuous dragging would just
// make it harder to land on the value being taught.
//
// Live readout text is plain Unicode ("θ = 60°  (π/3)", "sin θ = √3/2"), not
// KaTeX -- same convention <jsx-radian-arc>/<jsx-chain-demo> already use for
// their dynamic text, since a JSXGraph text element rewrites its own DOM
// node's content on every board update, which would immediately blow away
// any one-time KaTeX-rendered markup. Exact fraction strings only ever come
// from the SPECIAL_ANGLES table below (a fixed, hand-checked lookup), never
// computed at runtime -- there's no general decimal-to-exact-fraction logic
// here, just 16 known points.
//
// `coterminal` (bare boolean) lets the point's angle accumulate across
// multiple laps instead of resetting every revolution -- `start-angle` can
// then be an out-of-range value like "-690" or "900", and dragging the point
// around single-handedly demonstrates "add/subtract 360° until it lands in
// [0°, 360°)" instead of that being three lines of arithmetic on paper.
//
// `target-x`/`target-y` (each a comma-separated list of decimals) draw fixed
// dashed reference lines at those coordinates, colored by the site's
// existing blue/red sign convention -- for "given cos(θ) = -1/2, find θ"
// style problems, so the instructor drags the point to the line's
// intersections with the circle rather than the diagram giving the answer
// away.
const UNIT_CIRCLE_FOUR_COLOR = '#c2740c';
const UNIT_CIRCLE_RING_ANGLE = 1.32;
const UNIT_CIRCLE_RING_COORD = 1.7;
const UNIT_CIRCLE_HALF = 2.05;

// One row per special angle, hand-checked against the standard unit circle
// (reference angles 30°/45°/60°, signs by quadrant). `family` drives the
// blue/orange/black grouping from the workbook's own annotation convention
// (six-fold π/6 divisions vs. four-fold π/4 divisions vs. the axes) --
// deliberately a third, local color (UNIT_CIRCLE_FOUR_COLOR), not tied to
// --negative/--accent, since it marks a construction family, not a sign.
const SPECIAL_ANGLES = [
  { deg: 0, family: 'axis', rad: '0', cos: '1', sin: '0', tan: '0', csc: 'undefined', sec: '1', cot: 'undefined' },
  { deg: 30, family: 'six', rad: 'π/6', cos: '√3/2', sin: '1/2', tan: '√3/3', csc: '2', sec: '2√3/3', cot: '√3' },
  { deg: 45, family: 'four', rad: 'π/4', cos: '√2/2', sin: '√2/2', tan: '1', csc: '√2', sec: '√2', cot: '1' },
  { deg: 60, family: 'six', rad: 'π/3', cos: '1/2', sin: '√3/2', tan: '√3', csc: '2√3/3', sec: '2', cot: '√3/3' },
  { deg: 90, family: 'axis', rad: 'π/2', cos: '0', sin: '1', tan: 'undefined', csc: '1', sec: 'undefined', cot: '0' },
  { deg: 120, family: 'six', rad: '2π/3', cos: '-1/2', sin: '√3/2', tan: '-√3', csc: '2√3/3', sec: '-2', cot: '-√3/3' },
  { deg: 135, family: 'four', rad: '3π/4', cos: '-√2/2', sin: '√2/2', tan: '-1', csc: '√2', sec: '-√2', cot: '-1' },
  { deg: 150, family: 'six', rad: '5π/6', cos: '-√3/2', sin: '1/2', tan: '-√3/3', csc: '2', sec: '-2√3/3', cot: '-√3' },
  { deg: 180, family: 'axis', rad: 'π', cos: '-1', sin: '0', tan: '0', csc: 'undefined', sec: '-1', cot: 'undefined' },
  { deg: 210, family: 'six', rad: '7π/6', cos: '-√3/2', sin: '-1/2', tan: '√3/3', csc: '-2', sec: '-2√3/3', cot: '√3' },
  { deg: 225, family: 'four', rad: '5π/4', cos: '-√2/2', sin: '-√2/2', tan: '1', csc: '-√2', sec: '-√2', cot: '1' },
  { deg: 240, family: 'six', rad: '4π/3', cos: '-1/2', sin: '-√3/2', tan: '√3', csc: '-2√3/3', sec: '-2', cot: '√3/3' },
  { deg: 270, family: 'axis', rad: '3π/2', cos: '0', sin: '-1', tan: 'undefined', csc: '-1', sec: 'undefined', cot: '0' },
  { deg: 300, family: 'six', rad: '5π/3', cos: '1/2', sin: '-√3/2', tan: '-√3', csc: '-2√3/3', sec: '2', cot: '-√3/3' },
  { deg: 315, family: 'four', rad: '7π/4', cos: '√2/2', sin: '-√2/2', tan: '-1', csc: '-√2', sec: '√2', cot: '-1' },
  { deg: 330, family: 'six', rad: '11π/6', cos: '√3/2', sin: '-1/2', tan: '-√3/3', csc: '-2', sec: '2√3/3', cot: '-√3' },
];

function polarDeg(r, deg) {
  const rad = deg * Math.PI / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function nearestSpecialAngle(deg) {
  let best = SPECIAL_ANGLES[0];
  let bestDist = Infinity;
  for (const entry of SPECIAL_ANGLES) {
    const d = Math.min(Math.abs(deg - entry.deg), 360 - Math.abs(deg - entry.deg));
    if (d < bestDist) { bestDist = d; best = entry; }
  }
  return { entry: best, dist: bestDist };
}

function trigValueColor(str, accent, negative, muted) {
  if (str === 'undefined') return muted;
  return str.startsWith('-') ? negative : accent;
}

function renderJsxUnitCircle(el) {
  if (typeof JXG === 'undefined') {
    console.error(
      '<jsx-unit-circle>: JXG is not defined. Add the JSXGraph <link>/<script> tags ' +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const startAngle = parseFloat(el.getAttribute('start-angle') || '0');
  // `build` (bare boolean): instead of the caller picking one fixed
  // show-grid/show-labels combination, the diagram starts bare (axes + circle
  // only) and a button steps through the workbook's own four-stage
  // construction procedure in place, in a single diagram, exactly like
  // <triangle build> steps through constructing a triangle -- see the
  // BUILD_STAGE_* constants below for what each stage adds. Forces the grid
  // and label data to be built for every family/point (gridMode/labelsMode
  // 'all'); which pieces are actually *visible* is then a function of the
  // live `stage` variable instead of being decided once at creation time.
  const buildMode = el.hasAttribute('build');
  // A bare `show-grid` means "all"; `show-grid="six"`/`"four"` narrows to just
  // one construction family, so the workbook's own two-pass procedure (first
  // divide into 6, then separately into 4) can be two lecture steps instead
  // of dumping the finished grid on screen at once.
  const gridMode = buildMode ? 'all' : (el.hasAttribute('show-grid') ? (el.getAttribute('show-grid') || 'all') : null);
  const labelsMode = buildMode ? 'all' : el.getAttribute('show-labels'); // null | "q1" | "all"
  const coterminal = el.hasAttribute('coterminal');
  const targetXs = (el.getAttribute('target-x') || '').split(',').map(Number).filter(Number.isFinite);
  const targetYs = (el.getAttribute('target-y') || '').split(',').map(Number).filter(Number.isFinite);

  const half = UNIT_CIRCLE_HALF;
  const panelStart = half + 0.35;
  const panelWidth = 3.1;
  const rightX = panelStart + panelWidth;

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--circle';
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--unit-circle';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  el.replaceWith(container);

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [-half, half + 0.1, rightX, -(half + 0.1)],
    axis: false,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: true,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const lineColor = cssVar('--line') || '#e5e7eb';
  const negative = cssVar('--negative') || '#c0392b';
  const muted = cssVar('--muted') || '#6b7280';

  // Short, hand-drawn axes (not board axis:true) that stop before the label
  // ring / readout panel, rather than JSXGraph's default axis spanning the
  // full width of the board -- including the panel.
  board.create('segment', [[-1.15, 0], [1.15, 0]], {
    strokeColor: ink, strokeWidth: AXIS_STROKE, lastArrow: { size: AXIS_ARROW_SIZE, type: 1 }, fixed: true, highlight: false,
  });
  board.create('segment', [[0, -1.15], [0, 1.15]], {
    strokeColor: ink, strokeWidth: AXIS_STROKE, lastArrow: { size: AXIS_ARROW_SIZE, type: 1 }, fixed: true, highlight: false,
  });

  const center = board.create('point', [0, 0], { visible: false, fixed: true, name: '' });
  const circle = board.create('circle', [center, 1], {
    strokeColor: accent, strokeWidth: REF_CIRCLE_STROKE, fixed: true, highlight: false, name: '',
  });

  // `stage` only moves (via the Build/Reset button created near the bottom of
  // this function, once `buildMode` is confirmed) when `build` is set;
  // outside build mode every gated element below is just given `stage: null`
  // (always visible), so this declaration is harmless either way. Stages
  // mirror the workbook's own four-step procedure: 1 = six-fold division
  // (Steps 2-3), 2 = + four-fold division (Step 4), 3 = + Quadrant I
  // coordinate labels (Step 5), 4 = + the rest, by symmetry (Step 6).
  let stage = 0;
  const BUILD_MAX_STAGE = 4;
  function familyStage(family) { return family === 'six' ? 1 : family === 'four' ? 2 : 0; }

  function drawChord(deg, color, requiredStage) {
    const [x1, y1] = polarDeg(1, deg);
    const [x2, y2] = polarDeg(1, deg + 180);
    board.create('segment', [[x1, y1], [x2, y2]], {
      strokeColor: color, strokeWidth: REF_CIRCLE_STROKE, fixed: true, highlight: false,
      visible: requiredStage == null ? true : () => stage >= requiredStage,
    });
  }
  function drawDot(deg, color, requiredStage) {
    const [x, y] = polarDeg(1, deg);
    board.create('point', [x, y], {
      name: '', size: 4, strokeColor: '#fff', strokeWidth: 1, fillColor: color, fixed: true, highlight: false,
      visible: requiredStage == null ? true : () => stage >= requiredStage,
    });
  }
  function drawRingText(r, deg, str, color, fontSize, requiredStage) {
    const [x, y] = polarDeg(r, deg);
    board.create('text', [x, y, str], {
      fontSize, color, fixed: true, anchorX: 'middle', anchorY: 'middle', cssStyle: 'font-weight:600',
      visible: requiredStage == null ? true : () => stage >= requiredStage,
    });
  }

  // show-grid: the construction picture itself -- the four blue chords that
  // divide the circle into 6 (multiples of 30°), the two orange chords that
  // divide it into 4 (multiples of 45°), a dot at each of the 16 resulting
  // points, and each point's radian measure on the outer ring.
  if (gridMode) {
    if (gridMode === 'six' || gridMode === 'all') [30, 60, 120, 150].forEach((d) => drawChord(d, accent, buildMode ? 1 : null));
    if (gridMode === 'four' || gridMode === 'all') [45, 135].forEach((d) => drawChord(d, UNIT_CIRCLE_FOUR_COLOR, buildMode ? 2 : null));
    SPECIAL_ANGLES
      .filter((entry) => entry.family === 'axis' || gridMode === 'all' || entry.family === gridMode)
      .forEach((entry) => {
        const color = entry.family === 'four' ? UNIT_CIRCLE_FOUR_COLOR : entry.family === 'six' ? accent : ink;
        const required = buildMode ? familyStage(entry.family) : null;
        drawDot(entry.deg, color, required);
        drawRingText(UNIT_CIRCLE_RING_ANGLE, entry.deg, entry.rad, color, TICK_LABEL_FONT, required);
      });
  }

  // show-labels: the (cos θ, sin θ) coordinate pair at each point -- "q1"
  // mirrors the workbook's Step 5 (reason it out for Quadrant I via the
  // Quadrant I Chart), "all" mirrors the optional Step 6 (extend by
  // symmetry) -- two separate lecture slides, not one, matching the PDF.
  if (labelsMode) {
    SPECIAL_ANGLES
      .filter((entry) => labelsMode === 'all' || (entry.deg >= 0 && entry.deg <= 90))
      .forEach((entry) => {
        const isQ1 = entry.deg >= 0 && entry.deg <= 90;
        const required = buildMode ? (isQ1 ? 3 : 4) : null;
        drawRingText(UNIT_CIRCLE_RING_COORD, entry.deg, `(${entry.cos}, ${entry.sin})`, ink, TICK_LABEL_FONT - 3, required);
      });
  }

  targetXs.forEach((x) => {
    board.create('segment', [[x, -1.3], [x, 1.3]], {
      strokeColor: x < 0 ? negative : accent, strokeWidth: 2, dash: 2, fixed: true, highlight: false,
    });
  });
  targetYs.forEach((y) => {
    board.create('segment', [[-1.3, y], [1.3, y]], {
      strokeColor: y < 0 ? negative : accent, strokeWidth: 2, dash: 2, fixed: true, highlight: false,
    });
  });

  // `cumulative` is the raw, possibly out-of-[0,360) angle (what `coterminal`
  // mode displays and lets grow across laps); `lastPos` is the point's
  // current on-circle position in [0,360), used only to measure the
  // shortest-path delta on each drag step so multi-lap dragging accumulates
  // correctly instead of resetting every revolution.
  let cumulative = startAngle;
  let lastPos = ((startAngle % 360) + 360) % 360;

  const [gx, gy] = polarDeg(1, lastPos);
  const glider = board.create('glider', [gx, gy, circle], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, highlight: false,
  });
  board.create('segment', [center, glider], {
    strokeColor: lineColor, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
  });

  function snapGlider() {
    const raw = ((Math.atan2(glider.Y(), glider.X()) * 180 / Math.PI) + 360) % 360;
    const { entry } = nearestSpecialAngle(raw);
    let delta = entry.deg - lastPos;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    cumulative += delta;
    lastPos = entry.deg;
    const [sx, sy] = polarDeg(1, entry.deg);
    glider.setPosition(JXG.COORDS_BY_USER, [sx, sy]);
  }
  glider.on('drag', () => { snapGlider(); board.update(); });
  snapGlider(); // lock the initial position onto its nearest special angle

  function reducedDeg() { return ((cumulative % 360) + 360) % 360; }
  function currentEntry() { return nearestSpecialAngle(reducedDeg()).entry; }

  // Readout panel: dynamic Unicode text, one row per line, laid out with
  // even vertical spacing computed from however many rows this particular
  // configuration needs (coterminal mode adds one extra row) so the panel
  // always fills the same vertical space the circle itself uses.
  const rows = [];
  rows.push({
    text: () => {
      if (!coterminal) {
        const e = currentEntry();
        return `θ = ${reducedDeg().toFixed(0)}°  (${e.rad})`;
      }
      return `θ = ${cumulative.toFixed(0)}°`;
    },
    fontSize: READOUT_VALUE_FONT - 4,
    color: ink,
  });
  if (coterminal) {
    rows.push({
      text: () => {
        const rotations = Math.round((cumulative - reducedDeg()) / 360);
        const e = currentEntry();
        if (rotations === 0) return `already in [0°, 360°)`;
        const verb = rotations > 0 ? 'subtract' : 'add';
        return `${verb} 360° × ${Math.abs(rotations)} → ${reducedDeg().toFixed(0)}°  (${e.rad})`;
      },
      fontSize: TICK_LABEL_FONT - 2,
      color: muted,
    });
  }
  rows.push({
    text: () => { const e = currentEntry(); return `(cos θ, sin θ) = (${e.cos}, ${e.sin})`; },
    fontSize: READOUT_VALUE_FONT - 4,
    color: ink,
  });
  [
    ['sin θ', 'sin'], ['cos θ', 'cos'], ['tan θ', 'tan'],
    ['csc θ', 'csc'], ['sec θ', 'sec'], ['cot θ', 'cot'],
  ].forEach(([label, key]) => {
    rows.push({
      text: () => `${label} = ${currentEntry()[key]}`,
      fontSize: READOUT_VALUE_FONT - 6,
      color: () => trigValueColor(currentEntry()[key], accent, negative, muted),
    });
  });

  // Build/Reset button, only in build mode -- placed above the readout rows,
  // which then get laid out in whatever vertical space remains. Follows
  // <triangle build>'s own convention exactly: "Build →" while stages
  // remain, "↺ Reset" once the last stage is showing, single click either
  // advances one stage or (from the last stage) jumps straight back to 0.
  const buttonTop = half + 0.05;
  const rowsTop = buildMode ? buttonTop - 0.55 : buttonTop;
  if (buildMode) {
    board.create('button', [
      panelStart, buttonTop, () => (stage < BUILD_MAX_STAGE ? 'Build →' : '↺ Reset'),
      () => { stage = stage < BUILD_MAX_STAGE ? stage + 1 : 0; board.update(); },
    ], {
      fixed: true, cssStyle: `font-size:${TICK_LABEL_FONT}px; font-weight:600; padding:4px 14px; border-radius:6px;`,
    });
  }

  const bottomY = -(half + 0.05);
  const gap = (rowsTop - bottomY) / (rows.length + 1);
  rows.forEach((row, i) => {
    const y = rowsTop - gap * (i + 1);
    board.create('text', [panelStart, y, row.text], {
      fontSize: row.fontSize, color: row.color, fixed: true, anchorX: 'left', anchorY: 'middle', cssStyle: 'font-weight:700',
    });
  });
}

// <jsx-sine-trace fn="sin"|"cos" a="1" b="1" a-slider a-min="-3" a-max="3"
//   b-slider b-min="0.25" b-max="3" fn2="Math.cos(x)" label="y = cos x"
//   label2="y = -3/2 cos x" xmax="7.5" ymax="3.5">
//
// Added for Lesson 11 (Graphing Sine and Cosine), replacing several static
// <jsx-graph> diagrams with a genuinely dynamic one: a draggable point on a
// circle (radius = amplitude) on the left, wired to a live point tracing the
// matching sine/cosine curve on the right, connected by a dashed line at
// their shared height -- literally the mechanism Lesson 11's own intro step
// describes in words (angle in, y- or x-value from the circle out), made
// interactive instead of just narrated. Matches this project's established
// interaction philosophy: the instructor drags, nothing auto-plays, the same
// convention <sign-circle>/<jsx-radian-arc> already established.
//
// Optional `a-slider`/`b-slider` turn the SAME diagram into the amplitude or
// period demonstration, replacing what used to be 2-3 separate fixed
// comparison graphs each: dragging the slider live-rescales both the
// circle's radius and the background curve, while the draggable point still
// traces it -- one diagram instead of several, since the slider itself IS
// the comparison (and, for amplitude, dragging past 0 shows the reflection
// the Amplitude definition describes, for free).
//
// The two modes (sin/cos) share one mechanism instead of being two separate
// code paths: cos(theta) is just sin(theta - pi/2), so tracing a cosine
// curve is the exact same glider-on-a-circle geometry as sine -- only the
// angle used to place the traced point along the curve's x-axis is offset
// by pi/2 (and the glider starts at the circle's top, not its right, so the
// initial frame already sits at the cosine curve's own peak). The glider's
// own y-coordinate is always exactly the (sign-adjusted, see below) output
// value in both modes, so the connector line needs no special-casing.
//
// Negative `a` (reflection, e.g. Example 2's y = -3/2 cos x) can't be a
// circle's actual radius, so the circle is always drawn at radius |a|, and
// only the traced point's height gets sign-flipped to match -- algebraically
// exact for every glider position, not just the initial one (a = sign(a) *
// |a|, distributed through the angle-sum identity above). The background
// curve itself (a plain functiongraph reading a/b directly) already handles
// negative a correctly on its own, same as <jsx-graph>.
//
// `fn2` is a plain static comparison curve (dashed, muted, not wired to the
// trace) -- the same convention <jsx-graph>'s own fn2 already uses -- for
// the two "graph both on the same axes" examples (Example 2, Example 4),
// where the point traces the lesson's own function while the parent
// sine/cosine sits alongside for comparison, undragged. Not combined with
// a-slider/b-slider in this lesson (nothing stops it, but the two features
// answer different questions -- "how does this specific pair compare" vs.
// "watch this one curve change" -- so mixing them would just crowd one
// diagram with two demonstrations at once).
function renderJsxSineTrace(el) {
  if (typeof JXG === 'undefined') {
    console.error(
      '<jsx-sine-trace>: JXG is not defined. Add the JSXGraph <link>/<script> tags ' +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const fn = el.getAttribute('fn') === 'cos' ? 'cos' : 'sin';
  const aSliderOn = el.hasAttribute('a-slider');
  const bSliderOn = el.hasAttribute('b-slider');
  const aStart = parseFloat(el.getAttribute('a') || '1');
  const bStart = parseFloat(el.getAttribute('b') || '1');
  const aMin = parseFloat(el.getAttribute('a-min') || '-3');
  const aMax = parseFloat(el.getAttribute('a-max') || '3');
  const bMin = parseFloat(el.getAttribute('b-min') || '0.25');
  const bMax = parseFloat(el.getAttribute('b-max') || '3');
  const fn2Attr = el.getAttribute('fn2');
  const label = el.getAttribute('label');
  const label2 = el.getAttribute('label2');

  const aCeil = aSliderOn ? Math.max(Math.abs(aMin), Math.abs(aMax)) : Math.abs(aStart);
  const bFloor = bSliderOn ? bMin : bStart;
  const xmax = parseFloat(el.getAttribute('xmax') || String((2 * Math.PI) / bFloor + 1));
  const ymax = parseFloat(el.getAttribute('ymax') || String(aCeil + (aSliderOn || bSliderOn ? 1.6 : 0.6)));
  const ymin = -ymax;

  const circleR = aCeil;
  const cx = -(circleR + 0.9);
  const xmin = cx - circleR - 0.4;

  let f2 = null;
  if (fn2Attr) {
    try {
      // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
      f2 = new Function('x', `return ${fn2Attr};`);
    } catch (err) {
      console.error(`<jsx-sine-trace>: could not parse fn2="${fn2Attr}"`, err);
    }
  }

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--sine-trace';
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--sine-trace';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  el.replaceWith(container);

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [xmin, ymax, xmax, ymin],
    axis: true,
    showNavigation: false,
    showCopyright: false,
    // The circle panel needs true 1:1 x/y scaling to actually look like a
    // circle (a plain boundingbox stretches it into an ellipse whenever the
    // container's own aspect ratio -- 2.6:1 via .jsx-board--sine-trace --
    // doesn't happen to match this bounding box's own width:height ratio).
    keepaspectratio: true,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';
  const muted = cssVar('--muted') || '#6b7280';

  styleAxes(board, ink);

  // Only the curve panel (x >= 0) gets π-fraction ticks -- the circle panel
  // sits at x < 0 and has no numeric axis meaning of its own.
  board.defaultAxes.x.defaultTicks.setAttribute({ visible: false });
  const half = Math.PI / 2;
  const kMax = Math.floor(xmax / half);
  const positions = [];
  for (let k = 0; k <= kMax; k++) positions.push(k * half);
  board.create('ticks', [board.defaultAxes.x, positions], {
    drawLabels: true,
    minorTicks: 0,
    majorHeight: TICK_MAJOR_HEIGHT,
    strokeColor: ink,
    strokeWidth: AXIS_STROKE,
    label: { fontSize: TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
    generateLabelText: (tick) => piTickLabel(tick.usrCoords[1]),
  });
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE, gridX: half });

  // Optional sliders -- the same short-track pattern <jsx-chain-demo> uses.
  // The value readout sits just BELOW its track (not above): above would
  // crowd the board's own top edge, since the track itself already sits
  // close to ymax to clear the circle/curve underneath it.
  const sliderY = ymax - 0.5;
  let aSlider = null;
  let bSlider = null;
  if (aSliderOn) {
    aSlider = board.create('slider', [[cx - circleR, sliderY], [cx + circleR, sliderY], [aMin, aStart, aMax]], {
      name: '', withLabel: false, snapWidth: 0.05, size: POINT_SIZE,
      strokeColor: accent, fillColor: accent, strokeWidth: POINT_STROKE,
      baseline: { strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, highlight: false },
      highlight: false,
    });
    board.create('text', [cx - circleR, sliderY - 0.45, () => `a = ${aSlider.Value().toFixed(2)}`], {
      fontSize: READOUT_VALUE_FONT - 4, color: accent, fixed: true, cssStyle: 'font-weight:700',
    });
  }
  if (bSliderOn) {
    const bx0 = 0.4;
    const bx1 = Math.min(xmax - 0.4, bx0 + 4);
    bSlider = board.create('slider', [[bx0, sliderY], [bx1, sliderY], [bMin, bStart, bMax]], {
      name: '', withLabel: false, snapWidth: 0.05, size: POINT_SIZE,
      strokeColor: accent, fillColor: accent, strokeWidth: POINT_STROKE,
      baseline: { strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, highlight: false },
      highlight: false,
    });
    board.create('text', [bx0, sliderY - 0.45, () => `b = ${bSlider.Value().toFixed(2)}`], {
      fontSize: READOUT_VALUE_FONT - 4, color: accent, fixed: true, cssStyle: 'font-weight:700',
    });
  }

  const aValue = () => (aSlider ? aSlider.Value() : aStart);
  const bValue = () => (bSlider ? bSlider.Value() : bStart);
  const aRadius = () => Math.max(0.001, Math.abs(aValue()));
  const aSign = () => (aValue() < 0 ? -1 : 1);

  const center = board.create('point', [cx, 0], { visible: false, fixed: true, name: '' });
  const circle = board.create('circle', [center, aRadius], {
    strokeColor: line, strokeWidth: REF_CIRCLE_STROKE, fixed: true, highlight: false, name: '',
  });

  const startAngle = fn === 'cos' ? Math.PI / 2 : 0;
  const glider = board.create('glider', [cx + circleR * Math.cos(startAngle), circleR * Math.sin(startAngle), circle], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, highlight: false,
  });
  board.create('segment', [center, glider], {
    strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
  });

  // The angle used to place the traced point is tracked CUMULATIVELY, not
  // recomputed fresh from atan2 on every frame -- atan2 wraps at +-180°, so
  // a fresh reading jumps discontinuously from +pi to -pi the instant the
  // dragged point crosses the circle's leftmost point, which yanked the
  // traced point clear across the curve panel instead of continuing past
  // one edge of it. Fixed with the same technique <jsx-unit-circle>'s
  // coterminal mode already uses -- accumulate the shortest-path delta
  // between consecutive raw angles -- just applied continuously instead of
  // only at its 16 snapped special angles. glider.Y() itself (used for the
  // output height below) never had this problem: it's a plain geometric
  // coordinate, well-defined at any drag position with no seam to cross.
  function rawAngle() {
    return Math.atan2(glider.Y(), glider.X() - cx);
  }
  let cumulativeAngle = startAngle;
  let lastRawAngle = rawAngle();
  glider.on('drag', () => {
    const raw = rawAngle();
    let delta = raw - lastRawAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    cumulativeAngle += delta;
    lastRawAngle = raw;
  });

  // theta, as measured for the CURVE (not the circle): for cosine mode this
  // is the circle's own standard angle shifted by -pi/2 -- see the file
  // comment above for why that makes cos(theta) fall out of the same
  // glider.Y() reading sine already uses directly.
  function thetaForCurve() {
    return fn === 'cos' ? cumulativeAngle - Math.PI / 2 : cumulativeAngle;
  }

  // Not `trace: true` -- the full curve is already drawn statically below,
  // so a fading trail of past positions would only add clutter over a long
  // live-dragged demo (dragged back and forth many times across a lecture)
  // without showing anything the static curve doesn't already show.
  const tracePoint = board.create('point', [
    () => thetaForCurve() / bValue(),
    () => aSign() * glider.Y(),
  ], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE,
    highlight: false,
  });
  board.create('segment', [glider, tracePoint], {
    strokeColor: muted, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
  });

  board.create('functiongraph', [
    (x) => aValue() * (fn === 'cos' ? Math.cos(bValue() * x) : Math.sin(bValue() * x)),
    0, xmax,
  ], { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });

  if (f2) {
    board.create('functiongraph', [f2, 0, xmax], {
      strokeColor: muted, strokeWidth: CURVE_STROKE, dash: 2, highlight: false,
    });
  }

  const labelX = 0.3;
  if (label) {
    board.create('text', [labelX, ymax - (ymax - ymin) * 0.08, label], {
      fontSize: READOUT_VALUE_FONT - 4, color: accent, fixed: true, cssStyle: 'font-weight:700',
    });
  }
  if (label2 && f2) {
    board.create('text', [labelX, ymax - (ymax - ymin) * 0.16, label2], {
      fontSize: READOUT_VALUE_FONT - 4, color: muted, fixed: true, cssStyle: 'font-weight:700',
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('jsx-graph').forEach(renderJsxGraph);
  document.querySelectorAll('jsx-radian-arc').forEach(renderJsxRadianArc);
  document.querySelectorAll('jsx-chain-demo').forEach(renderJsxChainDemo);
  document.querySelectorAll('jsx-unit-circle').forEach(renderJsxUnitCircle);
  document.querySelectorAll('jsx-sine-trace').forEach(renderJsxSineTrace);
});
