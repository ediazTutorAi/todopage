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
// Both modes start the glider at the circle's right (standard position,
// angle 0), sweeping counterclockwise -- the same convention as every other
// unit-circle diagram in this course. An earlier version instead started
// the cosine glider at the circle's TOP and quietly reused its y-coordinate
// (numerically valid, since cos(theta) = sin(theta + pi/2)), but that put
// the point exactly where a student reading standard position would expect
// angle = 90 deg, i.e. cos = 0 -- backwards from the 1 actually shown, and
// a real point of confusion once someone looked closely. Cosine mode now
// reads the glider's own x-coordinate instead, made visible via an actual
// projection: a dashed "stick" drops from the glider straight down to
// `foot` on the circle's own horizontal diameter, and that foot -- not the
// glider itself -- is what the dashed connector runs to the traced point,
// so the diagram shows the x-to-height conversion happening rather than
// asserting it.
//
// Negative `a` (reflection, e.g. Example 2's y = -3/2 cos x) can't be a
// circle's actual radius, so the circle is always drawn at radius |a|, and
// only the traced point's height gets sign-flipped to match -- algebraically
// exact for every glider position, not just the initial one. The background
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

  const startAngle = 0;
  const glider = board.create('glider', [cx + circleR, 0, circle], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, highlight: false,
  });
  board.create('segment', [center, glider], {
    strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
  });

  // Cosine's projection stick: a perpendicular dropped from the glider
  // straight down to `foot` on the circle's own horizontal diameter -- the
  // actual geometric reason the x-coordinate is "cosine," shown rather than
  // asserted. At theta=0 the glider already sits on the diameter, so the
  // stick starts at zero length and grows as the glider is dragged up.
  let foot = null;
  if (fn === 'cos') {
    foot = board.create('point', [() => glider.X(), () => center.Y()], {
      name: '', size: POINT_SIZE - 1, strokeColor: '#fff', fillColor: muted, strokeWidth: POINT_STROKE, highlight: false,
    });
    board.create('segment', [glider, foot], {
      strokeColor: line, strokeWidth: RADIUS_SEGMENT_STROKE, dash: 2, highlight: false,
    });
  }

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

  // theta, as measured for the CURVE, is just the circle's own standard
  // angle now -- both modes share it directly, since the glider's starting
  // position and rotation direction already match the unit circle
  // convention used everywhere else in this course.
  function thetaForCurve() {
    return cumulativeAngle;
  }

  // Not `trace: true` -- the full curve is already drawn statically below,
  // so a fading trail of past positions would only add clutter over a long
  // live-dragged demo (dragged back and forth many times across a lecture)
  // without showing anything the static curve doesn't already show.
  const tracePoint = board.create('point', [
    () => thetaForCurve() / bValue(),
    () => aSign() * (fn === 'cos' ? (glider.X() - cx) : glider.Y()),
  ], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE,
    highlight: false,
  });
  board.create('segment', [fn === 'cos' ? foot : glider, tracePoint], {
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

// <jsx-transform fn="sin" a="1" b="1" c="0" d="0" ...>
//
// The translation/transformation demo for y = a f(b(x + c)) + d (Lesson 12,
// Translating Sine and Cosine Graphs). One tag, four ways to drive it, all
// instructor-operated like every other jsx-* tag:
//
//   play="d c"     a "Play" button that tweens each listed parameter, IN THAT
//                  ORDER, from its parent value (a=1, b=1, c=0, d=0) to the
//                  value given by the a/b/c/d attributes. Bare `play` animates
//                  every non-identity parameter in a, b, c, d order. Parameters
//                  with a non-identity target that are NOT listed sit at their
//                  target from the start (a fixed baseline).
//   sliders="c d"  native range inputs for the listed parameters (ranges via
//                  `c-min`/`c-max`, etc.). Dragging one cancels any animation.
//   arrows         red arrows from each of the parent's 5 key points to where
//                  it lands on the transformed curve, like the workbook's
//                  hand-drawn red arrows. Only meaningful for pure shifts.
//   ghost          draws the FINAL curve as a thick faint underlay from the
//                  start, so Play visibly morphs the parent onto a given graph
//                  (the "write a rule for this graph" examples). `play-label`
//                  renames the button.
//   sketch         a different mode: a stage-by-stage "graph one period" build
//                  (sinusoidal axis, max/min lines, start point, quarter-period
//                  steps, key points popping in, curve drawing itself, dashed
//                  continuation) driven by a Next button. Uses a/b/c/d as the
//                  fixed final function; readout chips appear as each quantity
//                  is used.
//
// Other attributes: `form="raw"` (inner term is bx + c instead of b(x + c), to
// show why the shift is c/b), `tick-den` (x ticks every π/den, default 2),
// `xmin/xmax/ymin/ymax`, `eq` (static equation text overriding the live one),
// `start="final"`, `no-keypoints`, `no-readout`, `no-parent`. Numeric
// attributes accept `pi`, e.g. c="-pi/4".

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

// x as a reduced fraction of π with the given denominator grid, e.g. (5π/6).
function piFractionLabel(x, den) {
  const k = Math.round(x / (Math.PI / den));
  if (k === 0) return '0';
  const g = gcd(Math.abs(k), den);
  const n = k / g;
  const d = den / g;
  const sign = n < 0 ? '-' : '';
  const coeff = Math.abs(n) === 1 ? '' : String(Math.abs(n));
  return d === 1 ? `${sign}${coeff}π` : `${sign}${coeff}π/${d}`;
}

// v as a clean multiple of π (denominator up to 12), or null if it isn't one.
function fmtPiMultiple(v, tol = 1e-6) {
  const m = v / Math.PI;
  if (Math.abs(m) < tol) return '0';
  for (let den = 1; den <= 12; den++) {
    if (Math.abs(m * den - Math.round(m * den)) < tol * den) return piFractionLabel(v, den);
  }
  return null;
}

function fmtNum(v) {
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

const fmtAngle = (v) => fmtPiMultiple(v) ?? fmtNum(v);

function evalNumAttr(el, name, dflt, tag) {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') return dflt;
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    const v = new Function('pi', `return (${raw});`)(Math.PI);
    if (!Number.isFinite(v)) throw new Error('not a finite number');
    return v;
  } catch (err) {
    console.error(`<${tag}>: could not parse ${name}="${raw}"`, err);
    return dflt;
  }
}

const TRANSFORM_KEYS = ['a', 'b', 'c', 'd'];
const TRANSFORM_IDENT = { a: 1, b: 1, c: 0, d: 0 };
const TRANSFORM_CAPTION = {
  a: 'Vertical stretch (and flip): the multiplier out front',
  b: 'Horizontal squeeze or stretch: the multiplier on x',
  c: 'Horizontal shift: slide left or right',
  d: 'Vertical shift: slide up or down',
};

function renderJsxTransform(el) {
  const TAG = 'jsx-transform';
  if (typeof JXG === 'undefined') {
    console.error(
      `<${TAG}>: JXG is not defined. Add the JSXGraph <link>/<script> tags ` +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }

  const num = (name, dflt) => evalNumAttr(el, name, dflt, TAG);
  const fnName = el.getAttribute('fn') === 'cos' ? 'cos' : 'sin';
  const trig = fnName === 'cos' ? Math.cos : Math.sin;
  const raw = el.getAttribute('form') === 'raw';
  const sketch = el.hasAttribute('sketch');
  const ghost = el.hasAttribute('ghost');
  const arrows = el.hasAttribute('arrows');
  const showKeyPoints = !el.hasAttribute('no-keypoints');
  const showParent = !el.hasAttribute('no-parent') && !sketch;
  const showReadout = !el.hasAttribute('no-readout');
  const eqOverride = el.getAttribute('eq');
  const tickDen = Math.max(1, Math.round(num('tick-den', 2)));
  const xmin = num('xmin', -3.5);
  const xmax = num('xmax', 7.6);
  const ymin = num('ymin', -3);
  const ymax = num('ymax', 3);

  const target = {};
  TRANSFORM_KEYS.forEach((k) => { target[k] = num(k, TRANSFORM_IDENT[k]); });
  if (target.b <= 0) {
    console.error(`<${TAG}>: b must be positive (got ${target.b})`);
    return;
  }

  const sliderKeys = sketch ? [] : (el.getAttribute('sliders') || '')
    .split(/[\s,]+/).filter((k) => TRANSFORM_KEYS.includes(k));
  const hasPlay = el.hasAttribute('play') && !sketch;
  let playOrder = [];
  if (hasPlay) {
    const listed = (el.getAttribute('play') || '').split(/[\s,]+/).filter((k) => TRANSFORM_KEYS.includes(k));
    playOrder = listed.length ? listed : TRANSFORM_KEYS.filter((k) => target[k] !== TRANSFORM_IDENT[k]);
  }
  const playLabel = el.getAttribute('play-label') || '▶ Play';

  const RANGE = {
    a: [-3, 3, 0.25], b: [0.25, 3, 0.25], c: [-2 * Math.PI, 2 * Math.PI, Math.PI / 12], d: [-3, 3, 0.25],
  };
  const rangeOf = (k) => [num(`${k}-min`, RANGE[k][0]), num(`${k}-max`, RANGE[k][1]), RANGE[k][2]];

  // Live parameter state.
  const p = { ...TRANSFORM_IDENT };
  function baseline() {
    if (sketch || el.getAttribute('start') === 'final') return { ...target };
    const b = { ...TRANSFORM_IDENT };
    TRANSFORM_KEYS.forEach((k) => {
      if (!playOrder.includes(k) && !sliderKeys.includes(k)) b[k] = target[k];
    });
    return b;
  }
  Object.assign(p, baseline());

  const shiftOf = (q) => (raw ? -q.c / q.b : -q.c);
  const valueAt = (q, x) => q.a * trig(raw ? q.b * x + q.c : q.b * (x + q.c)) + q.d;

  // ---- DOM ----
  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--transform';

  let eqEl = null;
  let captionEl = null;
  const chipEls = {};
  if (showReadout) {
    const readout = document.createElement('div');
    readout.className = 'jsx-transform-readout';
    eqEl = document.createElement('div');
    eqEl.className = 'jsx-transform-eq';
    readout.appendChild(eqEl);
    const chips = document.createElement('div');
    chips.className = 'jsx-transform-chips';
    const CHIP_NAME = { a: 'Amplitude', b: 'Period', c: 'Horizontal shift', d: 'Vertical shift' };
    TRANSFORM_KEYS.forEach((k) => {
      const relevant = sliderKeys.includes(k) || target[k] !== TRANSFORM_IDENT[k];
      if (!relevant) return;
      const chip = document.createElement('span');
      chip.className = 'jsx-chip';
      chip.innerHTML = `<b>${CHIP_NAME[k]}</b> <span class="jsx-chip-val"></span>`;
      chips.appendChild(chip);
      chipEls[k] = chip;
    });
    readout.appendChild(chips);
    captionEl = document.createElement('div');
    captionEl.className = 'jsx-transform-caption';
    readout.appendChild(captionEl);
    container.appendChild(readout);
  }

  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--transform';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);

  if (ghost) {
    const legend = document.createElement('div');
    legend.className = 'jsx-legend';
    legend.innerHTML =
      '<span><i class="sw sw-ghost"></i>the given graph</span>' +
      `<span><i class="sw sw-parent"></i>y = ${fnName} x</span>` +
      '<span><i class="sw sw-curve"></i>your rule, so far</span>';
    container.appendChild(legend);
  }

  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  container.appendChild(controls);
  el.replaceWith(container);

  // ---- board ----
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
  const negative = cssVar('--negative') || '#c0392b';

  styleAxes(board, ink);
  const step = Math.PI / tickDen;
  board.defaultAxes.x.defaultTicks.setAttribute({ visible: false });
  const tickPositions = [];
  for (let k = Math.ceil(xmin / step); k <= Math.floor(xmax / step); k++) tickPositions.push(k * step);
  board.create('ticks', [board.defaultAxes.x, tickPositions], {
    drawLabels: true,
    minorTicks: 0,
    majorHeight: TICK_MAJOR_HEIGHT,
    strokeColor: ink,
    strokeWidth: AXIS_STROKE,
    label: { fontSize: TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
    generateLabelText: (tick) => piFractionLabel(tick.usrCoords[1], tickDen),
  });
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE, gridX: step });

  const K = [0, 1, 2, 3, 4].map((i) => (i * Math.PI) / 2);
  const finalFn = (x) => valueAt(target, x);
  const liveFn = (x) => valueAt(p, x);
  const hide = (o) => { if (o) o.setAttribute({ visible: false }); };
  const show = (o) => { if (o) o.setAttribute({ visible: true }); };

  if (ghost) {
    board.create('functiongraph', [finalFn], {
      strokeColor: accent, strokeOpacity: 0.2, strokeWidth: CURVE_STROKE + 10, highlight: false,
    });
  }

  // Sinusoidal axis. Live in transform mode, fixed at the target in sketch.
  const midline = board.create('line', [[0, () => p.d], [1, () => p.d]], {
    strokeColor: negative, strokeWidth: RADIUS_SEGMENT_STROKE + 0.5, dash: 2, highlight: false,
    visible: false, fixed: true,
  });
  const midLabel = board.create('text', [
    xmax - (xmax - xmin) * 0.015, () => p.d + (ymax - ymin) * 0.015,
    () => (sketch ? `sinusoidal axis: y = ${fmtNum(p.d)}` : `y = ${fmtNum(p.d)}`),
  ], {
    anchorX: 'right', anchorY: 'bottom', fontSize: READOUT_VALUE_FONT - 4, color: negative,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  });

  if (showParent) {
    board.create('functiongraph', [trig], {
      strokeColor: muted, strokeWidth: CURVE_STROKE, dash: 2, highlight: false,
    });
  }

  // Sketch mode draws the curve progressively via a moving right-hand domain
  // bound; transform mode just draws it whole.
  const x0 = shiftOf(target);
  const periodT = (2 * Math.PI) / target.b;
  let prog = 1;
  if (sketch) {
    prog = 0;
    board.create('functiongraph', [finalFn, xmin, xmax], {
      strokeColor: accent, strokeOpacity: 0.55, strokeWidth: CURVE_STROKE - 1, dash: 3,
      highlight: false, visible: false, name: 'continuation',
    });
  }
  const curve = board.create('functiongraph', sketch
    ? [finalFn, () => x0, () => x0 + periodT * prog]
    : [liveFn], { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });
  const continuation = sketch ? board.objectsList.find((o) => o.name === 'continuation') : null;

  // Key points: parent (muted) and image (accent), plus workbook-style arrows.
  const parentPts = K.map((t) => board.create('point', [t, trig(t)], {
    name: '', fixed: true, size: POINT_SIZE - 3, strokeColor: '#fff', fillColor: muted,
    strokeWidth: POINT_STROKE, highlight: false, visible: arrows,
  }));
  const imgX = (t) => t / p.b + shiftOf(p);
  const imgY = (t) => p.a * trig(t) + p.d;
  const imgPts = K.map((t) => board.create('point', [() => imgX(t), () => imgY(t)], {
    name: '', fixed: true, size: POINT_SIZE, strokeColor: '#fff', fillColor: accent,
    strokeWidth: POINT_STROKE, highlight: false, visible: !sketch && showKeyPoints,
  }));
  const arrowEls = arrows ? K.map((t, i) => board.create('arrow', [parentPts[i], imgPts[i]], {
    strokeColor: negative, strokeWidth: 3.5, lastArrow: { size: 8 }, highlight: false, fixed: true, visible: false,
  })) : [];

  // ---- readout ----
  function eqString() {
    const absA = Math.abs(p.a);
    const near = (v, t) => Math.abs(v - t) < 1e-9;
    const hasB = !near(p.b, 1);
    const hasC = !near(p.c, 0);
    const cAbs = fmtAngle(Math.abs(p.c));
    const sgn = p.c < 0 ? '−' : '+';
    let inner;
    if (raw) {
      inner = `${hasB ? fmtNum(p.b) : ''}x${hasC ? ` ${sgn} ${cAbs}` : ''}`;
    } else {
      const shifted = `x ${sgn} ${cAbs}`;
      if (hasB) inner = `${fmtNum(p.b)}${hasC ? `(${shifted})` : 'x'}`;
      else inner = hasC ? shifted : 'x';
    }
    const wrapped = (hasB || hasC) ? `(${inner})` : ` ${inner}`;
    const dTxt = near(p.d, 0) ? '' : ` ${p.d < 0 ? '−' : '+'} ${fmtNum(Math.abs(p.d))}`;
    return `y = ${p.a < 0 ? '−' : ''}${near(absA, 1) ? '' : fmtNum(absA)}${fnName}${wrapped}${dTxt}`;
  }

  const chipText = {
    a: () => `${fmtNum(Math.abs(p.a))}${p.a < 0 ? ' (reflected)' : ''}`,
    b: () => fmtAngle((2 * Math.PI) / p.b),
    c: () => {
      const s = shiftOf(p);
      return Math.abs(s) < 1e-9 ? 'none' : `${s > 0 ? 'right' : 'left'} ${fmtAngle(Math.abs(s))}`;
    },
    d: () => (Math.abs(p.d) < 1e-9 ? 'none' : `${p.d > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(p.d))}`),
  };
  let liveKey = null;
  let sketchStage = 0;
  const SKETCH_CHIP_STAGE = { d: 1, a: 2, c: 3, b: 4 };

  function updateReadout() {
    if (!showReadout) return;
    eqEl.textContent = eqOverride ?? eqString();
    TRANSFORM_KEYS.forEach((k) => {
      const chip = chipEls[k];
      if (!chip) return;
      chip.querySelector('.jsx-chip-val').textContent = chipText[k]();
      const changed = Math.abs(p[k] - TRANSFORM_IDENT[k]) > 1e-9;
      chip.classList.toggle('is-active', sketch ? true : changed);
      chip.classList.toggle('is-live', liveKey === k);
      chip.classList.toggle('is-hidden', sketch && sketchStage < SKETCH_CHIP_STAGE[k]);
    });
  }

  // ---- shared refresh ----
  let lastArrowState = [];
  function refresh() {
    updateReadout();
    if (!sketch) {
      const midOn = Math.abs(p.d) > 1e-9;
      if (midOn) { show(midline); show(midLabel); } else { hide(midline); hide(midLabel); }
    }
    arrowEls.forEach((arrow, i) => {
      const moved = Math.hypot(imgX(K[i]) - K[i], imgY(K[i]) - trig(K[i])) > 0.04;
      if (lastArrowState[i] !== moved) {
        lastArrowState[i] = moved;
        arrow.setAttribute({ visible: moved });
      }
    });
    sliderKeys.forEach((k) => {
      const input = controls.querySelector(`input[data-p="${k}"]`);
      if (input && Math.abs(parseFloat(input.value) - p[k]) > 1e-9) input.value = p[k];
      const out = controls.querySelector(`[data-out="${k}"]`);
      if (out) out.textContent = fmtAngle(p[k]);
    });
    board.update();
  }

  // ---- animation plumbing ----
  let raf = null;
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function stopAll() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    timers.forEach(clearTimeout);
    timers = [];
    liveKey = null;
  }
  function tween(ms, onStep, onDone) {
    const t0 = performance.now();
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2;
      onStep(e);
      if (u < 1) { raf = requestAnimationFrame(tick); } else { raf = null; if (onDone) onDone(); }
    };
    raf = requestAnimationFrame(tick);
  }
  const makeButton = (label, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    if (title) b.title = title;
    // Hand keyboard focus back so Space/arrows keep driving Slide Mode.
    b.addEventListener('pointerup', () => b.blur());
    controls.appendChild(b);
    return b;
  };

  // ---- transform mode: Play / Reset / sliders ----
  if (!sketch) {
    let playBtn = null;
    if (hasPlay) {
      playBtn = makeButton(playLabel);
      playBtn.addEventListener('click', () => {
        stopAll();
        Object.assign(p, baseline());
        playOrder.forEach((k) => { p[k] = TRANSFORM_IDENT[k]; });
        playBtn.textContent = '⏳ Playing';
        if (captionEl) captionEl.textContent = '';
        refresh();
        let i = 0;
        const next = () => {
          if (i >= playOrder.length) {
            liveKey = null;
            playBtn.textContent = '↺ Replay';
            if (captionEl) captionEl.textContent = '';
            refresh();
            return;
          }
          const k = playOrder[i++];
          liveKey = k;
          if (captionEl) captionEl.textContent = TRANSFORM_CAPTION[k];
          refresh();
          later(() => tween(1700, (e) => {
            p[k] = TRANSFORM_IDENT[k] + (target[k] - TRANSFORM_IDENT[k]) * e;
            refresh();
          }, () => {
            p[k] = target[k];
            refresh();
            later(next, 800);
          }), 600);
        };
        next();
      });
    }
    const resetBtn = makeButton('Reset', 'Back to the parent graph');
    resetBtn.addEventListener('click', () => {
      stopAll();
      Object.assign(p, baseline());
      if (playBtn) playBtn.textContent = playLabel;
      if (captionEl) captionEl.textContent = '';
      refresh();
    });
    const NAME = {
      a: 'a', b: 'b', c: raw ? 'c' : 'c', d: 'd',
    };
    const HINT = {
      a: 'stretch / flip', b: 'squeeze / stretch', c: raw ? 'inside term' : 'horizontal shift', d: 'vertical shift',
    };
    sliderKeys.forEach((k) => {
      const [lo, hi, st] = rangeOf(k);
      const row = document.createElement('label');
      row.className = 'jsx-slider-row';
      row.innerHTML =
        `<span class="jsx-slider-name">${NAME[k]} <small>${HINT[k]}</small></span>` +
        `<input type="range" data-p="${k}" min="${lo}" max="${hi}" step="${st}" value="${p[k]}">` +
        `<span class="jsx-slider-val" data-out="${k}"></span>`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        stopAll();
        if (playBtn) playBtn.textContent = playLabel;
        if (captionEl) captionEl.textContent = '';
        p[k] = parseFloat(input.value);
        refresh();
      });
      input.addEventListener('pointerup', () => input.blur());
      controls.appendChild(row);
    });
    refresh();
    return;
  }

  // ---- sketch mode: staged "graph one period" ----
  const range = ymax - ymin;
  const dashStyle = { strokeColor: muted, strokeWidth: 2, dash: 3, highlight: false, visible: false, fixed: true };
  const top = target.d + Math.abs(target.a);
  const bottom = target.d - Math.abs(target.a);
  const ampLines = [top, bottom].map((y) => board.create('line', [[0, y], [1, y]], dashStyle));
  const ampLabels = [[top, 'max'], [bottom, 'min']].map(([y, w], i) => board.create('text', [
    xmax - (xmax - xmin) * 0.015, y + range * (i === 0 ? 0.015 : -0.015), `${w}: y = ${fmtNum(y)}`,
  ], {
    anchorX: 'right', anchorY: i === 0 ? 'bottom' : 'top', fontSize: READOUT_VALUE_FONT - 4, color: muted,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  }));
  const stepXs = K.map((t) => t / target.b + x0);
  const stepLines = stepXs.map((x) => board.create('line', [[x, 0], [x, 1]], dashStyle));
  const stepLabel = board.create('text', [
    (stepXs[1] + stepXs[2]) / 2, ymin + range * 0.07, `step = ${fmtAngle(periodT / 4)}`,
  ], {
    anchorX: 'middle', fontSize: READOUT_VALUE_FONT - 4, color: negative,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  });

  const heightWord = (t) => {
    const y = target.a * trig(t);
    if (Math.abs(y) < 1e-9) return 'on the axis';
    return y > 0 ? 'max' : 'min';
  };
  const CAPTIONS = [
    'A blank grid. Press Start and we build the graph piece by piece.',
    `Vertical shift ${chipText.d()}: the sinusoidal axis is y = ${fmtNum(target.d)}.`,
    `Amplitude ${fmtNum(Math.abs(target.a))}: the curve reaches y = ${fmtNum(top)} and y = ${fmtNum(bottom)}.`,
    `Horizontal shift ${chipText.c()}: one cycle starts at x = ${fmtAngle(x0)}.`,
    `Period ${fmtAngle(periodT)}, so each step is period ÷ 4 = ${fmtAngle(periodT / 4)}.`,
    `Plot the five key points: ${K.map(heightWord).join(', ')}.`,
    'Connect them with one smooth curve.',
    'The pattern repeats in both directions.',
  ];
  const LAST = CAPTIONS.length - 1;

  const backBtn = makeButton('◀ Back');
  const nextBtn = makeButton('Start →');
  let ptsShown = 0;

  function applyStage() {
    updateReadout();
    if (captionEl) captionEl.textContent = CAPTIONS[sketchStage];
    const on = (cond, ...objs) => objs.flat().forEach((o) => (cond ? show(o) : hide(o)));
    on(sketchStage >= 1, midline);
    // With d = 0 the axis IS the x-axis; its label would sit on the tick labels.
    on(sketchStage >= 1 && Math.abs(target.d) > 1e-9, midLabel);
    on(sketchStage >= 2, ampLines, ampLabels);
    on(sketchStage >= 4, stepLines, stepLabel);
    imgPts.forEach((pt, i) => on(i < ptsShown, pt));
    on(sketchStage >= 7, continuation);
    backBtn.disabled = sketchStage === 0;
    nextBtn.textContent = sketchStage === 0 ? 'Start →' : sketchStage === LAST ? '↺ Reset' : 'Next →';
    board.update();
  }

  function gotoStage(n) {
    stopAll();
    sketchStage = n;
    ptsShown = n < 3 ? 0 : n < 5 ? 1 : 5;
    prog = n >= 7 ? 1 : 0;
    if (n === 5) {
      for (let i = 2; i <= 5; i++) later(() => { ptsShown = i; applyStage(); }, 550 * (i - 1));
    }
    if (n === 6) tween(2200, (e) => { prog = e; board.update(); }, () => { prog = 1; board.update(); });
    applyStage();
  }
  nextBtn.addEventListener('click', () => gotoStage(sketchStage >= LAST ? 0 : sketchStage + 1));
  backBtn.addEventListener('click', () => gotoStage(Math.max(0, sketchStage - 1)));
  gotoStage(0);
}

// <jsx-trig-graph fn="tan|cot|sec|csc" a b c d ...>
//
// Graphs of the four "other" trigonometric functions (Lesson 13), with the same
// y = a f(b(x + c)) + d transformation model <jsx-transform> uses for sin/cos.
// Everything here is instructor-driven. Modes (combinable unless noted):
//
//   trace          (tan/cot only, separate renderer) unit circle on the left, graph on
//                  the right: a ray through the dragged angle meets the tangent line
//                  x = 1 (tan) or the line y = 1 (cot), and that height/offset is the
//                  value plotted. Slider + Play, curve draws itself as theta grows,
//                  asymptotes appear the moment the ray goes parallel to the line.
//   play="d c"     Play button tweening each listed parameter from its parent value to
//                  the a/b/c/d target, in order (same contract as <jsx-transform>).
//   sliders="a b"  native range inputs for the listed parameters.
//   ghost          final curve as a thick faint underlay (Play morphs onto it).
//                  `ghost-fn` + `ghost-a/b/c/d` make the underlay a *different*
//                  function (e.g. show that -cot x is tan(x + pi/2)).
//   arrows         red arrows from the parent's key points to their images.
//   sketch         staged "graph one period" builder driven by Next/Back. tan/cot:
//                  midline, center point, asymptotes + step, key points, branch.
//                  sec/csc: midline, related sin/cos guide, asymptotes where the guide
//                  crosses the midline, vertices at its extremes, branches.
//   probe          a draggable x with a live readout of the reciprocal/quotient
//                  (tan x = sin x / cos x = ...), special-angle snap buttons, Sweep.
//                  Use with the default a/b/c/d (identity).
//   switch="tan cot sec csc"   buttons that swap the function live.
//   mini           compact static board (no readout/controls) for matching grids.
//
// Other attributes: `tick-den` (x tick every pi/den, default 2), `grid-den`,
// `x-step` (numeric x ticks every x-step instead of pi fractions), `xmin/xmax/ymin/ymax`,
// `eq` (static equation text), `start="final"`, `no-keypoints`, `no-parent`,
// `no-guide`, `no-readout`, `play-label`, `probe-x`. Numeric attributes accept `pi`.
//
// Curves are drawn as one `curve` with NaN breaks at every asymptote (a plain
// functiongraph would join the two branches with a false vertical line), y clamped to
// just outside the viewport so branches leave the board steeply.

const TRIG = {
  tan: { f: Math.tan, period: Math.PI, asym0: Math.PI / 2, startU: -Math.PI / 2, spanU: Math.PI, keyU: [-Math.PI / 4, 0, Math.PI / 4], recip: false },
  cot: { f: (u) => 1 / Math.tan(u), period: Math.PI, asym0: 0, startU: 0, spanU: Math.PI, keyU: [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4], recip: false },
  sec: { f: (u) => 1 / Math.cos(u), period: 2 * Math.PI, asym0: Math.PI / 2, startU: Math.PI / 2, spanU: 2 * Math.PI, keyU: [Math.PI, 2 * Math.PI], recip: true, guide: Math.cos, guideName: 'cos' },
  csc: { f: (u) => 1 / Math.sin(u), period: 2 * Math.PI, asym0: 0, startU: 0, spanU: 2 * Math.PI, keyU: [Math.PI / 2, (3 * Math.PI) / 2], recip: true, guide: Math.sin, guideName: 'sin' },
};
const TRIG_IDENT = { a: 1, b: 1, c: 0, d: 0 };

function sampleTrig(fn, q, lo, hi, vmin, vmax) {
  const T = TRIG[fn];
  const xs = [];
  const ys = [];
  const n = 1600;
  const span = vmax - vmin;
  let lastK = null;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const u = q.b * (x + q.c);
    const k = Math.floor((u - T.asym0) / Math.PI);
    if (lastK !== null && k !== lastK) { xs.push(NaN); ys.push(NaN); }
    lastK = k;
    let y = q.a * T.f(u) + q.d;
    if (!Number.isFinite(y)) continue;
    y = Math.max(vmin - span, Math.min(vmax + span, y));
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

function makeDataCurve(board, getData, style) {
  const c = board.create('curve', [[0], [0]], style);
  c.updateDataArray = function updateDataArray() {
    const d = getData();
    this.dataX = d.xs;
    this.dataY = d.ys;
  };
  board.update();
  return c;
}

function renderJsxTrigTrace(el) {
  const TAG = 'jsx-trig-graph';
  const PI = Math.PI;
  const fnName = el.getAttribute('fn') === 'cot' ? 'cot' : 'tan';
  const isTan = fnName === 'tan';
  const xmin = -3.4;
  const xmax = 2 * PI + 0.55;
  const ymax = 2.55;
  const ymin = -ymax;
  const cx = -2;

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--transform';
  const readout = document.createElement('div');
  readout.className = 'jsx-trace-readout';
  container.appendChild(readout);
  const boardHost = document.createElement('div');
  boardHost.className = 'jsx-board jsx-board--trig-trace';
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  container.appendChild(controls);
  el.replaceWith(container);

  const board = JXG.JSXGraph.initBoard(boardHost.id, {
    boundingbox: [xmin, ymax, xmax, ymin],
    axis: true,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: true,
    pan: { enabled: false },
    zoom: { enabled: false },
    resize: { enabled: true, throttle: 100 },
  });
  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';
  const muted = cssVar('--muted') || '#6b7280';
  const negative = cssVar('--negative') || '#c0392b';
  styleAxes(board, ink);

  board.defaultAxes.x.defaultTicks.setAttribute({ visible: false });
  const half = PI / 2;
  const positions = [];
  for (let k = 1; k <= 4; k++) positions.push(k * half);
  board.create('ticks', [board.defaultAxes.x, positions], {
    drawLabels: true, minorTicks: 0, majorHeight: TICK_MAJOR_HEIGHT, strokeColor: ink, strokeWidth: AXIS_STROKE,
    label: { fontSize: TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
    generateLabelText: (tick) => piTickLabel(tick.usrCoords[1]),
  });
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE, gridX: half });

  // Circle panel.
  board.create('segment', [[cx, -1.35], [cx, 1.35]], { strokeColor: ink, strokeWidth: 2, highlight: false, fixed: true });
  board.create('circle', [[cx, 0], 1], { strokeColor: muted, strokeWidth: REF_CIRCLE_STROKE + 1, fixed: true, highlight: false, name: '' });
  const tanLine = isTan
    ? board.create('segment', [[cx + 1, -2.45], [cx + 1, 2.45]], { strokeColor: accent, strokeWidth: 3.5, highlight: false, fixed: true })
    : board.create('segment', [[cx - 1.35, 1], [cx + 1.35, 1]], { strokeColor: accent, strokeWidth: 3.5, highlight: false, fixed: true });
  board.create('text', isTan ? [cx + 0.92, 2.25, 'line x = 1'] : [cx - 1.3, 1.22, 'line y = 1'], {
    anchorX: isTan ? 'right' : 'left', fontSize: TICK_LABEL_FONT - 2, color: accent, fixed: true, cssStyle: 'font-weight:700',
  });

  let theta = 0.6;
  const gx = () => cx + Math.cos(theta);
  const gy = () => Math.sin(theta);
  const hitX = () => (isTan ? cx + 1 : cx + 1 / Math.tan(theta));
  const hitY = () => (isTan ? Math.tan(theta) : 1);
  const hitOn = () => {
    const v = isTan ? hitY() : hitX() - cx;
    const lim = isTan ? 2.4 : 1.35;
    return Number.isFinite(v) && Math.abs(v) < lim;
  };
  const curveVal = () => (isTan ? Math.tan(theta) : 1 / Math.tan(theta));

  const foot = board.create('point', [() => gx(), 0], { name: '', visible: false, fixed: true });
  board.create('segment', [[cx, 0], foot], { strokeColor: muted, strokeWidth: 4, highlight: false, fixed: true });
  board.create('segment', [foot, [gx, gy]], { strokeColor: muted, strokeWidth: 4, highlight: false, fixed: true });
  board.create('text', [() => (cx + gx()) / 2, () => (gy() >= 0 ? -0.2 : 0.2), 'x'], {
    anchorX: 'middle', anchorY: 'middle', fontSize: TICK_LABEL_FONT, color: muted, fixed: true, cssStyle: 'font-weight:700',
  });
  board.create('text', [() => gx() + (Math.cos(theta) >= 0 ? 0.12 : -0.12), () => gy() / 2, 'y'], {
    anchorX: () => (Math.cos(theta) >= 0 ? 'left' : 'right'), anchorY: 'middle', fontSize: TICK_LABEL_FONT, color: muted, fixed: true, cssStyle: 'font-weight:700',
  });
  board.create('segment', [[cx, 0], [gx, gy]], { strokeColor: ink, strokeWidth: RADIUS_SEGMENT_STROKE, highlight: false, fixed: true });
  const ray = board.create('segment', [[gx, gy], [hitX, hitY]], {
    strokeColor: negative, strokeWidth: 3.5, highlight: false, fixed: true,
  });
  const hit = board.create('point', [hitX, hitY], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: negative, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
  });
  makeDataCurve(board, () => {
    const t = Math.max(theta, 0.001);
    const xs = []; const ys = [];
    for (let i = 0; i <= 60; i++) { const a = (t * i) / 60; xs.push(cx + 0.3 * Math.cos(a)); ys.push(0.3 * Math.sin(a)); }
    return { xs, ys };
  }, { strokeColor: accent, strokeWidth: ARC_STROKE - 1, highlight: false });
  board.create('point', [gx, gy], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
  });

  // Graph panel.
  const asyms = [];
  for (let k = 0; k <= 4; k++) {
    const x = TRIG[fnName].asym0 + k * PI;
    if (x > 0.01 && x < 2 * PI + 0.02) {
      asyms.push({ x, el: board.create('line', [[x, 0], [x, 1]], {
        strokeColor: negative, strokeWidth: RADIUS_SEGMENT_STROKE + 0.5, dash: 2, highlight: false, fixed: true, visible: false,
      }) });
    }
  }
  makeDataCurve(board, () => sampleTrig(fnName, TRIG_IDENT, 0, Math.max(theta, 1e-6), ymin, ymax), {
    strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false,
  });
  const traceDot = board.create('point', [() => theta, curveVal], {
    name: '', size: POINT_SIZE, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
  });
  const connector = board.create('segment', [[hitX, hitY], [() => theta, curveVal]], {
    strokeColor: negative, strokeWidth: 2.5, dash: 2, highlight: false, fixed: true,
  });

  const fmt2 = (v) => fmtNum(v).replace('-', '−');
  function updateReadout() {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const num = isTan ? s : c;
    const den = isTan ? c : s;
    const nName = isTan ? 'y' : 'x';
    const dName = isTan ? 'x' : 'y';
    const und = Math.abs(den) < 1e-3;
    readout.innerHTML =
      `<span class="jsx-trace-chip">θ = <b>${fmtAngle(theta)}</b></span>` +
      `<span class="jsx-trace-chip">x = <b>${fmt2(c)}</b></span>` +
      `<span class="jsx-trace-chip">y = <b>${fmt2(s)}</b></span>` +
      `<span class="jsx-trace-chip jsx-trace-main ${und ? 'is-undef' : ''}">${fnName} θ = ${nName}/${dName} = ` +
      (und ? '<b>undefined</b>' : `<b>${fmt2(num / den)}</b>`) + '</span>';
  }
  function refresh() {
    const und = !Number.isFinite(curveVal()) || Math.abs(curveVal()) > 1e6;
    const on = hitOn();
    [ray, hit].forEach((o) => o.setAttribute({ visible: on }));
    const dotOn = !und && Math.abs(curveVal()) < ymax - 0.05;
    traceDot.setAttribute({ visible: dotOn });
    connector.setAttribute({ visible: on && dotOn });
    asyms.forEach((a) => a.el.setAttribute({ visible: theta >= a.x - 0.03 }));
    updateReadout();
    slider.value = theta;
    board.update();
  }

  // Controls.
  const row = document.createElement('label');
  row.className = 'jsx-slider-row';
  row.innerHTML = '<span class="jsx-slider-name">θ <small>drag the angle</small></span>' +
    `<input type="range" min="0" max="${2 * PI}" step="0.01" value="${theta}">`;
  const slider = row.querySelector('input');
  let raf = null;
  const playBtn = document.createElement('button');
  playBtn.type = 'button'; playBtn.className = 'btn'; playBtn.textContent = '▶ Play';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button'; resetBtn.className = 'btn'; resetBtn.textContent = 'Reset';
  [playBtn, resetBtn].forEach((b) => b.addEventListener('pointerup', () => b.blur()));
  controls.append(playBtn, resetBtn, row);
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = '▶ Play';
  }
  slider.addEventListener('input', () => { stop(); theta = parseFloat(slider.value); refresh(); });
  slider.addEventListener('pointerup', () => slider.blur());
  playBtn.addEventListener('click', () => {
    if (raf) { stop(); return; }
    if (theta >= 2 * PI - 0.02) theta = 0;
    playBtn.textContent = '⏸ Pause';
    let last = performance.now();
    const tick = (now) => {
      theta = Math.min(2 * PI, theta + ((now - last) / 1000) * (2 * PI / 14));
      last = now;
      refresh();
      if (theta < 2 * PI) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
  });
  resetBtn.addEventListener('click', () => { stop(); theta = 0; refresh(); });
  refresh();
  return TAG;
}

function renderJsxTrigGraph(el) {
  const TAG = 'jsx-trig-graph';
  if (typeof JXG === 'undefined') {
    console.error(
      `<${TAG}>: JXG is not defined. Add the JSXGraph <link>/<script> tags ` +
      'to this lesson\'s <head> -- see the comment at the top of js/jsxgraph.js ' +
      'for the exact snippet.'
    );
    return;
  }
  if (el.hasAttribute('trace')) { renderJsxTrigTrace(el); return; }

  const PI = Math.PI;
  const num = (name, dflt) => evalNumAttr(el, name, dflt, TAG);
  const list = (name) => (el.getAttribute(name) || '').split(/[\s,]+/).filter(Boolean);
  let fnName = el.getAttribute('fn') || 'tan';
  if (!TRIG[fnName]) {
    console.error(`<${TAG}>: fn must be tan, cot, sec or csc (got "${fnName}")`);
    return;
  }
  const switchFns = list('switch').filter((f) => TRIG[f]);
  const sketch = el.hasAttribute('sketch');
  const probe = el.hasAttribute('probe');
  const ghost = el.hasAttribute('ghost');
  const arrows = el.hasAttribute('arrows');
  const mini = el.hasAttribute('mini');
  const showReadout = !el.hasAttribute('no-readout') && !mini;
  const showKeyPoints = !el.hasAttribute('no-keypoints') && !mini;
  const showParent = !el.hasAttribute('no-parent') && !sketch && !mini;
  const showGuide = !el.hasAttribute('no-guide');
  const eqOverride = el.getAttribute('eq');
  const tickDen = Math.max(1, Math.round(num('tick-den', 2)));
  const gridDen = Math.max(1, Math.round(num('grid-den', tickDen)));
  const xStep = num('x-step', 0);
  const xmin = num('xmin', -PI);
  const xmax = num('xmax', PI);
  const ymin = num('ymin', -4);
  const ymax = num('ymax', 4);
  const range = ymax - ymin;

  const KEYS = ['a', 'b', 'c', 'd'];
  const target = {};
  KEYS.forEach((k) => { target[k] = num(k, TRIG_IDENT[k]); });
  if (target.b <= 0) { console.error(`<${TAG}>: b must be positive (got ${target.b})`); return; }

  const sliderKeys = sketch || mini ? [] : list('sliders').filter((k) => KEYS.includes(k));
  const hasPlay = el.hasAttribute('play') && !sketch && !mini;
  let playOrder = [];
  if (hasPlay) {
    const listed = list('play').filter((k) => KEYS.includes(k));
    playOrder = listed.length ? listed : KEYS.filter((k) => target[k] !== TRIG_IDENT[k]);
  }
  const playLabel = el.getAttribute('play-label') || '▶ Play';
  const RANGE = { a: [-3, 3, 0.25], b: [0.25, 3, 0.25], c: [-PI, PI, PI / 12], d: [-3, 3, 0.25] };
  const rangeOf = (k) => [num(`${k}-min`, RANGE[k][0]), num(`${k}-max`, RANGE[k][1]), RANGE[k][2]];

  const p = { ...TRIG_IDENT };
  function baseline() {
    if (sketch || mini || el.getAttribute('start') === 'final') return { ...target };
    const b = { ...TRIG_IDENT };
    KEYS.forEach((k) => { if (!playOrder.includes(k) && !sliderKeys.includes(k)) b[k] = target[k]; });
    return b;
  }
  Object.assign(p, baseline());

  const T = () => TRIG[fnName];
  const valueAt = (q, x) => q.a * T().f(q.b * (x + q.c)) + q.d;
  const shiftOf = (q) => -q.c;
  const hasGhostFn = el.hasAttribute('ghost-fn');
  const ghostFn = hasGhostFn && TRIG[el.getAttribute('ghost-fn')] ? el.getAttribute('ghost-fn') : fnName;
  const ghostQ = hasGhostFn
    ? { a: num('ghost-a', 1), b: num('ghost-b', 1), c: num('ghost-c', 0), d: num('ghost-d', 0) }
    : target;

  // ---- DOM ----
  const container = document.createElement('div');
  container.className = `jsx-diagram jsx-diagram--transform${mini ? ' jsx-diagram--mini' : ''}`;
  let eqEl = null;
  let captionEl = null;
  const chipEls = {};
  if (showReadout) {
    const readout = document.createElement('div');
    readout.className = 'jsx-transform-readout';
    eqEl = document.createElement('div');
    eqEl.className = 'jsx-transform-eq';
    readout.appendChild(eqEl);
    const chips = document.createElement('div');
    chips.className = 'jsx-transform-chips';
    const CHIP_NAME = { a: 'Vertical stretch', b: 'Period', c: 'Horizontal shift', d: 'Vertical shift' };
    KEYS.forEach((k) => {
      if (!(sliderKeys.includes(k) || target[k] !== TRIG_IDENT[k] || (sketch && k === 'b'))) return;
      const chip = document.createElement('span');
      chip.className = 'jsx-chip';
      chip.innerHTML = `<b>${CHIP_NAME[k]}</b> <span class="jsx-chip-val"></span>`;
      chips.appendChild(chip);
      chipEls[k] = chip;
    });
    readout.appendChild(chips);
    captionEl = document.createElement('div');
    captionEl.className = 'jsx-transform-caption';
    readout.appendChild(captionEl);
    container.appendChild(readout);
  }
  const boardHost = document.createElement('div');
  boardHost.className = `jsx-board ${mini ? 'jsx-board--mini' : 'jsx-board--transform'}`;
  boardHost.id = `jsx-board-${++boardCounter}`;
  container.appendChild(boardHost);
  if (ghost && !mini) {
    const legend = document.createElement('div');
    legend.className = 'jsx-legend';
    legend.innerHTML =
      '<span><i class="sw sw-ghost"></i>the given graph</span>' +
      '<span><i class="sw sw-parent"></i>the parent graph</span>' +
      '<span><i class="sw sw-curve"></i>your rule, so far</span>';
    container.appendChild(legend);
  }
  let probeEl = null;
  if (probe) {
    probeEl = document.createElement('div');
    probeEl.className = 'jsx-probe-readout';
    container.appendChild(probeEl);
  }
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  if (!mini) container.appendChild(controls);
  el.replaceWith(container);

  // ---- board ----
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
  const negative = cssVar('--negative') || '#c0392b';
  styleAxes(board, ink);

  board.defaultAxes.x.defaultTicks.setAttribute({ visible: false });
  if (mini) board.defaultAxes.y.defaultTicks.setAttribute({ insertTicks: false, ticksDistance: 2 });
  const step = xStep > 0 ? xStep : PI / tickDen;
  const tickPositions = [];
  for (let k = Math.ceil(xmin / step - 1e-9); k <= Math.floor(xmax / step + 1e-9); k++) tickPositions.push(k * step);
  board.create('ticks', [board.defaultAxes.x, tickPositions], {
    drawLabels: true, minorTicks: 0, majorHeight: TICK_MAJOR_HEIGHT, strokeColor: ink, strokeWidth: AXIS_STROKE,
    label: { fontSize: mini ? TICK_LABEL_FONT - 3 : TICK_LABEL_FONT, cssStyle: 'font-weight:600' },
    generateLabelText: (tick) => (xStep > 0 ? fmtNum(tick.usrCoords[1]) : piFractionLabel(tick.usrCoords[1], tickDen)),
  });
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE, gridX: xStep > 0 ? xStep : PI / gridDen });

  const hide = (o) => { if (o) o.setAttribute({ visible: false }); };
  const show = (o) => { if (o) o.setAttribute({ visible: true }); };
  const setVis = (cond, ...objs) => objs.flat().forEach((o) => (cond ? show(o) : hide(o)));

  if (ghost) {
    makeDataCurve(board, () => sampleTrig(ghostFn, ghostQ, xmin, xmax, ymin, ymax), {
      strokeColor: accent, strokeOpacity: 0.2, strokeWidth: CURVE_STROKE + 10, highlight: false,
    });
  }

  // Sinusoidal midline (only when shifted vertically).
  const midline = board.create('line', [[0, () => p.d], [1, () => p.d]], {
    strokeColor: negative, strokeWidth: RADIUS_SEGMENT_STROKE + 0.5, dash: 2, highlight: false, visible: false, fixed: true,
  });
  const midLabel = board.create('text', [
    xmax - (xmax - xmin) * 0.015, () => p.d + range * 0.015, () => `y = ${fmtNum(p.d)}`,
  ], {
    anchorX: 'right', anchorY: 'bottom', fontSize: READOUT_VALUE_FONT - 4, color: negative,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  });

  const parentCurve = showParent
    ? makeDataCurve(board, () => sampleTrig(fnName, TRIG_IDENT, xmin, xmax, ymin, ymax), {
      strokeColor: muted, strokeWidth: CURVE_STROKE, dash: 2, highlight: false,
    })
    : null;
  // sec/csc: the related sin/cos curve (dashed), the thing students sketch first.
  const guideCurve = board.create('functiongraph', [(x) => (T().recip ? p.a * T().guide(p.b * (x + p.c)) + p.d : NaN)], {
    strokeColor: muted, strokeWidth: CURVE_STROKE - 1, dash: 3, highlight: false, visible: false,
  });

  // Asymptotes: a pool of vertical lines positioned from the current b, c.
  const bCeil = Math.max(target.b, sliderKeys.includes('b') ? rangeOf('b')[1] : 0, 1);
  const poolN = Math.min(80, Math.ceil(((xmax - xmin) * bCeil) / PI) + 3);
  const asymX = (i) => {
    const sp = PI / p.b;
    const first = T().asym0 / p.b - p.c;
    const k0 = Math.ceil((xmin - first) / sp - 1e-9);
    return first + (k0 + i) * sp;
  };
  const asymLines = [];
  for (let i = 0; i < poolN; i++) {
    asymLines.push(board.create('line', [[() => asymX(i), 0], [() => asymX(i), 1]], {
      strokeColor: negative, strokeWidth: RADIUS_SEGMENT_STROKE + 0.5, dash: 2, highlight: false, fixed: true,
      visible: !sketch,
    }));
  }

  // Sketch window: one period, starting at an asymptote.
  const winLo = () => (T().startU) / p.b - p.c;
  const winSpan = () => T().spanU / p.b;
  let prog = 1;
  let continuation = null;
  if (sketch) {
    prog = 0;
    continuation = makeDataCurve(board, () => sampleTrig(fnName, p, xmin, xmax, ymin, ymax), {
      strokeColor: accent, strokeOpacity: 0.55, strokeWidth: CURVE_STROKE - 1, dash: 3, highlight: false, visible: false,
    });
  }
  makeDataCurve(board, () => (sketch
    ? (prog <= 0 ? { xs: [NaN], ys: [NaN] } : sampleTrig(fnName, p, winLo(), winLo() + winSpan() * prog, ymin, ymax))
    : sampleTrig(fnName, p, xmin, xmax, ymin, ymax)), {
    strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false,
  });

  // Key points: parent (muted) and image (accent), with workbook-style arrows.
  const keyU = (i) => (i < T().keyU.length ? T().keyU[i] : NaN);
  const parentPts = [0, 1, 2].map((i) => board.create('point', [() => keyU(i), () => T().f(keyU(i))], {
    name: '', fixed: true, size: POINT_SIZE - 3, strokeColor: '#fff', fillColor: muted,
    strokeWidth: POINT_STROKE, highlight: false, visible: false,
  }));
  const imgX = (i) => keyU(i) / p.b - p.c;
  const imgY = (i) => p.a * T().f(keyU(i)) + p.d;
  const imgPts = [0, 1, 2].map((i) => board.create('point', [() => imgX(i), () => imgY(i)], {
    name: '', fixed: true, size: POINT_SIZE, strokeColor: '#fff', fillColor: accent,
    strokeWidth: POINT_STROKE, highlight: false, visible: false,
  }));
  const arrowEls = arrows ? [0, 1, 2].map((i) => board.create('arrow', [parentPts[i], imgPts[i]], {
    strokeColor: negative, strokeWidth: 3.5, lastArrow: { size: 8 }, highlight: false, fixed: true, visible: false,
  })) : [];

  // ---- probe ----
  let px = num('probe-x', 0.5);
  let probeLine = null;
  let probeDot = null;
  let probeGuideDot = null;
  if (probe) {
    probeLine = board.create('line', [[() => px, 0], [() => px, 1]], {
      strokeColor: ink, strokeWidth: 2.5, dash: 2, highlight: false, fixed: true,
    });
    probeGuideDot = board.create('point', [() => px, () => (T().recip ? T().guide(px) : NaN)], {
      name: '', fixed: true, size: POINT_SIZE, strokeColor: '#fff', fillColor: muted, strokeWidth: POINT_STROKE, highlight: false,
    });
    probeDot = board.create('point', [() => px, () => T().f(px)], {
      name: '', fixed: true, size: POINT_SIZE + 1, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, highlight: false,
    });
  }
  function probeHtml() {
    const s = Math.sin(px);
    const c = Math.cos(px);
    const f2 = (v) => fmtNum(v).replace('-', '−');
    const spec = {
      tan: ['sin x', s, 'cos x', c], cot: ['cos x', c, 'sin x', s], sec: ['1', 1, 'cos x', c], csc: ['1', 1, 'sin x', s],
    }[fnName];
    const [nName, nVal, dName, dVal] = spec;
    const head = `x = <b>${fmtPiMultiple(px) ?? f2(px)}</b> ≈ ${f2(px)}`;
    if (Math.abs(dVal) < 1e-3) {
      return `${head} &nbsp;→&nbsp; ${fnName} x = ${nName} / ${dName} = ${f2(nVal)} / 0 : <b class="is-undef">undefined, vertical asymptote</b>`;
    }
    const dDisplay = T().recip ? `${dName} = ${f2(dVal)},&nbsp; so ` : '';
    return `${head} &nbsp;→&nbsp; ${dDisplay}${fnName} x = ${nName} / ${dName} = ${f2(nVal)} / ${f2(dVal)} = <b>${f2(nVal / dVal)}</b>`;
  }

  // ---- readout ----
  function eqString() {
    const absA = Math.abs(p.a);
    const near = (v, t) => Math.abs(v - t) < 1e-9;
    const hasB = !near(p.b, 1);
    const hasC = !near(p.c, 0);
    const cAbs = fmtAngle(Math.abs(p.c));
    const sgn = p.c < 0 ? '−' : '+';
    const shifted = `x ${sgn} ${cAbs}`;
    let inner;
    if (hasB) inner = `${fmtNum(p.b)}${hasC ? `(${shifted})` : 'x'}`;
    else inner = hasC ? shifted : 'x';
    const wrapped = (hasB || hasC) ? `(${inner})` : ` ${inner}`;
    const dTxt = near(p.d, 0) ? '' : ` ${p.d < 0 ? '−' : '+'} ${fmtNum(Math.abs(p.d))}`;
    return `y = ${p.a < 0 ? '−' : ''}${near(absA, 1) ? '' : fmtNum(absA)}${fnName}${wrapped}${dTxt}`;
  }
  const chipText = {
    a: () => `${fmtNum(Math.abs(p.a))}${p.a < 0 ? ' (reflected)' : ''}`,
    b: () => fmtAngle(T().period / p.b),
    c: () => {
      const s = shiftOf(p);
      return Math.abs(s) < 1e-9 ? 'none' : `${s > 0 ? 'right' : 'left'} ${fmtAngle(Math.abs(s))}`;
    },
    d: () => (Math.abs(p.d) < 1e-9 ? 'none' : `${p.d > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(p.d))}`),
  };
  const CAPTION = {
    a: 'Vertical stretch (and flip): the multiplier out front',
    b: 'Horizontal squeeze or stretch: the multiplier on x',
    c: 'Horizontal shift: slide left or right',
    d: 'Vertical shift: slide up or down',
  };
  let liveKey = null;
  let sketchStage = 0;
  const sketchChipStage = () => (T().recip ? { d: 1, a: 2, c: 3, b: 3 } : { d: 1, c: 2, b: 3, a: 4 });

  function updateReadout() {
    if (!showReadout) return;
    eqEl.textContent = eqOverride ?? eqString();
    KEYS.forEach((k) => {
      const chip = chipEls[k];
      if (!chip) return;
      chip.querySelector('.jsx-chip-val').textContent = chipText[k]();
      const changed = Math.abs(p[k] - TRIG_IDENT[k]) > 1e-9;
      chip.classList.toggle('is-active', sketch ? true : changed);
      chip.classList.toggle('is-live', liveKey === k);
      chip.classList.toggle('is-hidden', sketch && sketchStage < sketchChipStage()[k]);
    });
  }

  let lastArrowState = [];
  function refresh() {
    updateReadout();
    const recip = T().recip;
    if (!sketch) {
      setVis(Math.abs(p.d) > 1e-9, midline);
      setVis(Math.abs(p.d) > 1e-9 && !mini, midLabel);
      if (parentCurve) setVis(!recip, parentCurve);
      setVis(recip && showGuide, guideCurve);
      const n = T().keyU.length;
      parentPts.forEach((pt, i) => setVis(arrows && i < n, pt));
      imgPts.forEach((pt, i) => setVis(showKeyPoints && i < n, pt));
    }
    arrowEls.forEach((arrow, i) => {
      const moved = i < T().keyU.length && Math.hypot(imgX(i) - keyU(i), imgY(i) - T().f(keyU(i))) > 0.04;
      if (lastArrowState[i] !== moved) { lastArrowState[i] = moved; arrow.setAttribute({ visible: moved }); }
    });
    sliderKeys.forEach((k) => {
      const input = controls.querySelector(`input[data-p="${k}"]`);
      if (input && Math.abs(parseFloat(input.value) - p[k]) > 1e-9) input.value = p[k];
      const out = controls.querySelector(`[data-out="${k}"]`);
      if (out) out.textContent = fmtAngle(p[k]);
    });
    if (probe) {
      probeEl.innerHTML = probeHtml();
      const v = T().f(px);
      setVis(Number.isFinite(v) && v > ymin - 0.2 && v < ymax + 0.2, probeDot);
      setVis(recip && Math.abs(T().guide(px)) <= ymax, probeGuideDot);
      const input = controls.querySelector('input[data-probe]');
      if (input && Math.abs(parseFloat(input.value) - px) > 1e-9) input.value = px;
    }
    board.update();
  }

  // ---- animation plumbing ----
  let raf = null;
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function stopAll() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    timers.forEach(clearTimeout);
    timers = [];
    liveKey = null;
    if (sweepBtn) sweepBtn.textContent = '▶ Sweep x';
  }
  function tween(ms, onStep, onDone) {
    const t0 = performance.now();
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2;
      onStep(e);
      if (u < 1) { raf = requestAnimationFrame(tick); } else { raf = null; if (onDone) onDone(); }
    };
    raf = requestAnimationFrame(tick);
  }
  const makeButton = (label, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('pointerup', () => b.blur());
    controls.appendChild(b);
    return b;
  };
  let sweepBtn = null;

  // Function switch buttons (live swap of tan/cot/sec/csc).
  if (switchFns.length > 1 && !sketch && !mini) {
    const group = document.createElement('div');
    group.className = 'jsx-switch';
    switchFns.forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.dataset.fn = f;
      b.textContent = f;
      b.addEventListener('pointerup', () => b.blur());
      b.addEventListener('click', () => { stopAll(); fnName = f; syncSwitch(); refresh(); });
      group.appendChild(b);
    });
    controls.appendChild(group);
  }
  function syncSwitch() {
    controls.querySelectorAll('.jsx-switch .btn').forEach((b) => b.classList.toggle('is-on', b.dataset.fn === fnName));
  }
  syncSwitch();

  if (probe) {
    const row = document.createElement('label');
    row.className = 'jsx-slider-row';
    row.innerHTML = '<span class="jsx-slider-name">x <small>drag the input</small></span>' +
      `<input type="range" data-probe min="${xmin}" max="${xmax}" step="0.01" value="${px}">`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => { stopAll(); px = parseFloat(input.value); refresh(); });
    input.addEventListener('pointerup', () => input.blur());
    sweepBtn = makeButton('▶ Sweep x');
    sweepBtn.addEventListener('click', () => {
      if (raf) { stopAll(); return; }
      if (px >= xmax - 0.02) px = xmin;
      sweepBtn.textContent = '⏸ Pause';
      let last = performance.now();
      const tick = (now) => {
        px = Math.min(xmax, px + ((now - last) / 1000) * ((xmax - xmin) / 14));
        last = now;
        refresh();
        if (px < xmax) raf = requestAnimationFrame(tick); else stopAll();
      };
      raf = requestAnimationFrame(tick);
    });
    const snaps = document.createElement('div');
    snaps.className = 'jsx-switch';
    [['0', 0], ['π/6', PI / 6], ['π/4', PI / 4], ['π/3', PI / 3], ['π/2', PI / 2], ['π', PI], ['3π/2', 1.5 * PI], ['−π/4', -PI / 4], ['−π/2', -PI / 2]]
      .filter(([, v]) => v >= xmin - 1e-9 && v <= xmax + 1e-9)
      .forEach(([label, v]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = label;
        b.addEventListener('pointerup', () => b.blur());
        b.addEventListener('click', () => { stopAll(); px = v; refresh(); });
        snaps.appendChild(b);
      });
    controls.appendChild(snaps);
    controls.appendChild(row);
  }

  // ---- transform mode: Play / Reset / sliders ----
  if (!sketch) {
    let playBtn = null;
    if (hasPlay) {
      playBtn = makeButton(playLabel);
      playBtn.addEventListener('click', () => {
        stopAll();
        Object.assign(p, baseline());
        playOrder.forEach((k) => { p[k] = TRIG_IDENT[k]; });
        playBtn.textContent = '⏳ Playing';
        if (captionEl) captionEl.textContent = '';
        refresh();
        let i = 0;
        const next = () => {
          if (i >= playOrder.length) {
            liveKey = null;
            playBtn.textContent = '↺ Replay';
            if (captionEl) captionEl.textContent = '';
            refresh();
            return;
          }
          const k = playOrder[i++];
          liveKey = k;
          if (captionEl) captionEl.textContent = CAPTION[k];
          refresh();
          later(() => tween(1700, (e) => {
            p[k] = TRIG_IDENT[k] + (target[k] - TRIG_IDENT[k]) * e;
            refresh();
          }, () => { p[k] = target[k]; refresh(); later(next, 800); }), 600);
        };
        next();
      });
    }
    if (hasPlay || sliderKeys.length) {
      const resetBtn = makeButton('Reset', 'Back to the parent graph');
      resetBtn.addEventListener('click', () => {
        stopAll();
        Object.assign(p, baseline());
        if (playBtn) playBtn.textContent = playLabel;
        if (captionEl) captionEl.textContent = '';
        refresh();
      });
    }
    const HINT = { a: 'stretch / flip', b: 'squeeze / stretch', c: 'horizontal shift', d: 'vertical shift' };
    sliderKeys.forEach((k) => {
      const [lo, hi, st] = rangeOf(k);
      const row = document.createElement('label');
      row.className = 'jsx-slider-row';
      row.innerHTML =
        `<span class="jsx-slider-name">${k} <small>${HINT[k]}</small></span>` +
        `<input type="range" data-p="${k}" min="${lo}" max="${hi}" step="${st}" value="${p[k]}">` +
        `<span class="jsx-slider-val" data-out="${k}"></span>`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        stopAll();
        if (playBtn) playBtn.textContent = playLabel;
        if (captionEl) captionEl.textContent = '';
        p[k] = parseFloat(input.value);
        refresh();
      });
      input.addEventListener('pointerup', () => input.blur());
      controls.appendChild(row);
    });
    refresh();
    return;
  }

  // ---- sketch mode: staged "graph one period" ----
  const dashStyle = { strokeColor: muted, strokeWidth: 2, dash: 3, highlight: false, visible: false, fixed: true };
  const top = target.d + Math.abs(target.a);
  const bottom = target.d - Math.abs(target.a);
  const ampLines = [top, bottom].map((y) => board.create('line', [[0, y], [1, y]], dashStyle));
  const ampLabels = [[top, 'max'], [bottom, 'min']].map(([y, w], i) => board.create('text', [
    xmax - (xmax - xmin) * 0.015, y + range * (i === 0 ? 0.015 : -0.015), `${w}: y = ${fmtNum(y)}`,
  ], {
    anchorX: 'right', anchorY: i === 0 ? 'bottom' : 'top', fontSize: READOUT_VALUE_FONT - 4, color: muted,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  }));
  const periodX = T().period / target.b;
  const xc = TRIG[fnName].keyU[TRIG[fnName].recip ? 0 : 1] / target.b - target.c;
  const stepX = periodX / 4;
  const stepXs = [-1, 1].map((s) => xc + s * stepX);
  const stepLines = stepXs.map((x) => board.create('line', [[x, 0], [x, 1]], dashStyle));
  const stepLabel = board.create('text', [xc + stepX / 2, ymin + range * 0.07, `step = ${fmtAngle(stepX)}`], {
    anchorX: 'middle', fontSize: READOUT_VALUE_FONT - 4, color: negative,
    fixed: true, cssStyle: 'font-weight:700', visible: false,
  });

  const recipKind = T().recip;
  const gName = recipKind ? T().guideName : '';
  const yAt = (x) => fmtNum(valueAt(target, x));
  const CAPTIONS = recipKind ? [
    'A blank grid. Press Start and we build the graph piece by piece.',
    `Vertical shift ${chipText.d()}: the midline is y = ${fmtNum(target.d)}.`,
    `Sketch the related ${gName} curve first (dashed). It runs from y = ${fmtNum(bottom)} to y = ${fmtNum(top)}.`,
    `Wherever the ${gName} curve crosses the midline, the reciprocal is undefined: draw a vertical asymptote.`,
    `Wherever the ${gName} curve peaks or bottoms out, the ${fnName} curve touches it: mark those vertices.`,
    'Each branch starts at a vertex and bends toward the asymptotes on either side.',
    `The pattern repeats every period, ${fmtAngle(periodX)}.`,
  ] : [
    'A blank grid. Press Start and we build the graph piece by piece.',
    `Vertical shift ${chipText.d()}: the midline is y = ${fmtNum(target.d)}.`,
    `Horizontal shift ${chipText.c()}: the graph crosses its midline at x = ${fmtAngle(xc)}.`,
    `Period ${fmtAngle(periodX)}: the asymptotes sit half a period either side of the center, and each step is period ÷ 4 = ${fmtAngle(stepX)}.`,
    `One step left of center the graph is at y = ${yAt(stepXs[0])}, one step right it is at y = ${yAt(stepXs[1])}.`,
    'Draw one branch through the three points, bending toward each asymptote without touching it.',
    `The pattern repeats every period, ${fmtAngle(periodX)}.`,
  ];
  const LAST = CAPTIONS.length - 1;

  const backBtn = makeButton('◀ Back');
  const nextBtn = makeButton('Start →');
  let ptsShown = 0;

  function applyStage() {
    updateReadout();
    if (captionEl) captionEl.textContent = CAPTIONS[sketchStage];
    setVis(sketchStage >= 1 && Math.abs(target.d) > 1e-9, midline);
    setVis(sketchStage >= 1 && Math.abs(target.d) > 1e-9, midLabel);
    asymLines.forEach((l) => setVis(sketchStage >= 3, l));
    if (recipKind) {
      setVis(sketchStage >= 2, guideCurve, ampLines, ampLabels);
      imgPts.forEach((pt, i) => setVis(sketchStage >= 4 && i < T().keyU.length, pt));
    } else {
      setVis(sketchStage >= 3, stepLines, stepLabel);
      imgPts.forEach((pt, i) => setVis((i === 1 && sketchStage >= 2) || sketchStage >= 4, pt));
    }
    setVis(sketchStage >= 6, continuation);
    backBtn.disabled = sketchStage === 0;
    nextBtn.textContent = sketchStage === 0 ? 'Start →' : sketchStage === LAST ? '↺ Reset' : 'Next →';
    board.update();
  }
  function gotoStage(n) {
    stopAll();
    sketchStage = n;
    prog = n >= 6 ? 1 : 0;
    if (n === 5) tween(2400, (e) => { prog = e; board.update(); }, () => { prog = 1; board.update(); });
    applyStage();
  }
  nextBtn.addEventListener('click', () => gotoStage(sketchStage >= LAST ? 0 : sketchStage + 1));
  backBtn.addEventListener('click', () => gotoStage(Math.max(0, sketchStage - 1)));
  gotoStage(0);
}

// ---------------------------------------------------------------------------
// Calculus III tags (Lagrange multipliers, double integrals). Expressions are plain JS
// with sin, cos, tan, exp, sqrt, abs, log, pow and pi in scope.
function compileMath(args, expr, tag, attr) {
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    return new Function(...args, 'const {sin,cos,tan,exp,sqrt,abs,log,pow,PI:pi}=Math; return (' + expr + ');');
  } catch (err) {
    console.error(`<${tag}>: could not parse ${attr}="${expr}"`, err);
    return null;
  }
}

// <jsx-lagrange f="x*y" g="x*x+y*y-8" curve-x="sqrt(8)*cos(t)" curve-y="sqrt(8)*sin(t)"
//   tmin="0" tmax="2*pi" t="0.3" xmin="-5" xmax="5" ymin="-3" ymax="3"
//   levels="-4 -2 2 4" crit="0.785 2.356">
//
// Constrained optimization picture: contours of f, the constraint curve g = 0, and a point P
// the instructor slides along the constraint. Shows the gradients of f and g at P as unit
// direction arrows, the live contour of f through P, and (strip below) f restricted to the
// constraint as a function of the parameter t. At an extremum the contour through P just
// touches the constraint, the arrows line up, and the strip graph flattens: that is the
// Lagrange condition grad f = lambda grad g made visible.
//
// `curve-x`/`curve-y` parametrize g = 0 in t (t in [tmin, tmax]). `xmin/xmax` set the width;
// the height follows from the board's fixed aspect ratio (keepaspectratio, so perpendicular
// really looks perpendicular) around the midpoint of ymin/ymax. `crit` lists t values for the
// "jump to a critical point" buttons. `levels` draws faint contours. `no-strip` hides the
// restricted-f graph.
const LAGRANGE_ASPECT = 1.7;

function renderJsxLagrange(el) {
  const TAG = 'jsx-lagrange';
  if (typeof JXG === 'undefined') {
    console.error(`<${TAG}>: JXG is not defined. Add the JSXGraph <link>/<script> tags to this lesson's <head>.`);
    return;
  }
  const f = compileMath(['x', 'y'], el.getAttribute('f') || '0', TAG, 'f');
  const g = compileMath(['x', 'y'], el.getAttribute('g') || '0', TAG, 'g');
  const cxF = compileMath(['t'], el.getAttribute('curve-x') || 't', TAG, 'curve-x');
  const cyF = compileMath(['t'], el.getAttribute('curve-y') || '0', TAG, 'curve-y');
  if (!f || !g || !cxF || !cyF) return;
  const num = (n, d) => evalNumAttr(el, n, d, TAG);
  const tmin = num('tmin', 0);
  const tmax = num('tmax', 1);
  let tcur = num('t', (tmin + tmax) / 2);
  const xmin = num('xmin', -5);
  const xmax = num('xmax', 5);
  const ymid = (num('ymin', -3) + num('ymax', 3)) / 2;
  const yhalf = (xmax - xmin) / LAGRANGE_ASPECT / 2;
  const levels = (el.getAttribute('levels') || '').split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  const crit = (el.getAttribute('crit') || '').split(/[\s,]+/).filter(Boolean).map((s) => evalNumAttr({ getAttribute: () => s }, 'x', NaN, TAG)).filter(Number.isFinite);
  const showStrip = !el.hasAttribute('no-strip');

  const px = () => cxF(tcur);
  const py = () => cyF(tcur);
  const H = 1e-5;
  const grad = (fn, x, y) => [(fn(x + H, y) - fn(x - H, y)) / (2 * H), (fn(x, y + H) - fn(x, y - H)) / (2 * H)];
  const fOnCurve = (t) => f(cxF(t), cyF(t));

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--transform';
  const readout = document.createElement('div');
  readout.className = 'jsx-trace-readout';
  const host = document.createElement('div');
  host.className = 'jsx-board jsx-board--lagrange';
  host.id = `jsx-board-${++boardCounter}`;
  container.append(readout, host);
  let stripHost = null;
  if (showStrip) {
    const cap = document.createElement('div');
    cap.className = 'muted small jsx-strip-cap';
    cap.textContent = 'f along the constraint, as the point moves (horizontal axis: t)';
    stripHost = document.createElement('div');
    stripHost.className = 'jsx-board jsx-board--strip';
    stripHost.id = `jsx-board-${++boardCounter}`;
    container.append(cap, stripHost);
  }
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  container.appendChild(controls);
  el.replaceWith(container);

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';
  const muted = cssVar('--muted') || '#6b7280';
  const negative = cssVar('--negative') || '#c0392b';

  const board = JXG.JSXGraph.initBoard(host.id, {
    boundingbox: [xmin, ymid + yhalf, xmax, ymid - yhalf],
    axis: true, showNavigation: false, showCopyright: false, keepaspectratio: true,
    pan: { enabled: false }, zoom: { enabled: false }, resize: { enabled: true, throttle: 100 },
  });
  styleAxes(board, ink);
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE });

  levels.forEach((c) => {
    board.create('implicitcurve', [(x, y) => f(x, y) - c], {
      strokeColor: muted, strokeOpacity: 0.55, strokeWidth: 2, highlight: false, fixed: true,
    });
  });
  board.create('curve', [(t) => cxF(t), (t) => cyF(t), tmin, tmax], {
    strokeColor: ink, strokeWidth: CURVE_STROKE, highlight: false, fixed: true,
  });
  board.create('implicitcurve', [(x, y) => f(x, y) - f(px(), py())], {
    strokeColor: accent, strokeWidth: CURVE_STROKE - 1, highlight: false, fixed: true,
  });

  const unit = (v) => { const L = Math.hypot(v[0], v[1]); return L < 1e-9 ? [0, 0] : [v[0] / L, v[1] / L]; };
  const ARROW = (xmax - xmin) * 0.1;
  const tail = board.create('point', [px, py], { visible: false, fixed: true, name: '' });
  const tipOf = (fn, i, k) => () => px() + k * ARROW * unit(grad(fn, px(), py()))[i];
  const tipOfY = (fn, k) => () => py() + k * ARROW * unit(grad(fn, px(), py()))[1];
  const tipF = board.create('point', [tipOf(f, 0, 1), tipOfY(f, 1)], { visible: false, fixed: true, name: '' });
  const tipG = board.create('point', [tipOf(g, 0, 0.7), tipOfY(g, 0.7)], { visible: false, fixed: true, name: '' });
  board.create('arrow', [tail, tipF], { strokeColor: accent, strokeWidth: 5, lastArrow: { size: 9 }, highlight: false, fixed: true });
  board.create('arrow', [tail, tipG], { strokeColor: negative, strokeWidth: 5, lastArrow: { size: 9 }, highlight: false, fixed: true });
  board.create('text', [() => tipF.X() + ARROW * 0.12, () => tipF.Y() + ARROW * 0.12, '∇f'], {
    fontSize: READOUT_VALUE_FONT - 2, color: accent, fixed: true, cssStyle: 'font-weight:800',
  });
  board.create('text', [() => tipG.X() + ARROW * 0.12, () => tipG.Y() - ARROW * 0.25, '∇g'], {
    fontSize: READOUT_VALUE_FONT - 2, color: negative, fixed: true, cssStyle: 'font-weight:800',
  });
  board.create('point', [px, py], {
    name: '', size: POINT_SIZE + 1, strokeColor: '#fff', fillColor: ink, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
  });

  // strip: f restricted to the constraint
  let strip = null;
  if (showStrip) {
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const v = fOnCurve(tmin + ((tmax - tmin) * i) / 400);
      if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    const pad = (hi - lo) * 0.18 || 1;
    strip = JXG.JSXGraph.initBoard(stripHost.id, {
      boundingbox: [tmin - (tmax - tmin) * 0.04, hi + pad, tmax + (tmax - tmin) * 0.04, lo - pad],
      axis: false, showNavigation: false, showCopyright: false, keepaspectratio: false,
      pan: { enabled: false }, zoom: { enabled: false }, resize: { enabled: true, throttle: 100 },
    });
    strip.create('functiongraph', [fOnCurve, tmin, tmax], { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });
    strip.create('line', [[() => tcur, 0], [() => tcur, 1]], { strokeColor: muted, strokeWidth: 2, dash: 2, highlight: false, fixed: true });
    strip.create('line', [[0, () => fOnCurve(tcur)], [1, () => fOnCurve(tcur)]], { strokeColor: negative, strokeWidth: 2.5, dash: 2, highlight: false, fixed: true });
    strip.create('point', [() => tcur, () => fOnCurve(tcur)], {
      name: '', size: POINT_SIZE + 1, strokeColor: '#fff', fillColor: accent, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
    });
    strip.create('text', [tmin, hi + pad * 0.6, () => `f = ${fmtNum(fOnCurve(tcur))}`], {
      fontSize: READOUT_VALUE_FONT - 2, color: accent, fixed: true, cssStyle: 'font-weight:800',
    });
  }

  const f2 = (v) => fmtNum(v).replace('-', '−');
  function updateReadout() {
    const x = px(); const y = py();
    const a = grad(f, x, y); const b = grad(g, x, y);
    const la = Math.hypot(a[0], a[1]); const lb = Math.hypot(b[0], b[1]);
    const cross = a[0] * b[1] - a[1] * b[0];
    const sinA = la * lb < 1e-9 ? 0 : Math.abs(cross) / (la * lb);
    const parallel = sinA < 0.02;
    let lam = '';
    if (parallel && lb > 1e-9) lam = ` &nbsp; λ = ${f2((a[0] * b[0] + a[1] * b[1]) / (lb * lb))}`;
    readout.innerHTML =
      `<span class="jsx-trace-chip">P = (<b>${f2(x)}</b>, <b>${f2(y)}</b>)</span>` +
      `<span class="jsx-trace-chip">f(P) = <b>${f2(f(x, y))}</b></span>` +
      `<span class="jsx-trace-chip" style="color:${accent}">∇f = ⟨${f2(a[0])}, ${f2(a[1])}⟩</span>` +
      `<span class="jsx-trace-chip" style="color:${negative}">∇g = ⟨${f2(b[0])}, ${f2(b[1])}⟩</span>` +
      (parallel
        ? `<span class="jsx-trace-chip jsx-trace-main is-parallel">∇f ∥ ∇g${lam}</span>`
        : `<span class="jsx-trace-chip">not parallel (∇f × ∇g = ${f2(cross)})</span>`);
  }
  function refresh() {
    updateReadout();
    const input = controls.querySelector('input');
    if (input && Math.abs(parseFloat(input.value) - tcur) > 1e-9) input.value = tcur;
    board.update();
    if (strip) strip.update();
  }

  // controls
  const row = document.createElement('label');
  row.className = 'jsx-slider-row';
  row.innerHTML = '<span class="jsx-slider-name">t <small>slide along the constraint</small></span>' +
    `<input type="range" min="${tmin}" max="${tmax}" step="${(tmax - tmin) / 800}" value="${tcur}">`;
  const input = row.querySelector('input');
  let raf = null;
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; playBtn.textContent = '▶ Sweep'; };
  input.addEventListener('input', () => { stop(); tcur = parseFloat(input.value); refresh(); });
  input.addEventListener('pointerup', () => input.blur());
  const playBtn = document.createElement('button');
  playBtn.type = 'button'; playBtn.className = 'btn'; playBtn.textContent = '▶ Sweep';
  playBtn.addEventListener('pointerup', () => playBtn.blur());
  playBtn.addEventListener('click', () => {
    if (raf) { stop(); return; }
    if (tcur >= tmax - 1e-6) tcur = tmin;
    playBtn.textContent = '⏸ Pause';
    let last = performance.now();
    const tick = (now) => {
      tcur = Math.min(tmax, tcur + ((now - last) / 1000) * ((tmax - tmin) / 16));
      last = now;
      refresh();
      if (tcur < tmax) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
  });
  controls.appendChild(playBtn);
  if (crit.length) {
    const group = document.createElement('div');
    group.className = 'jsx-switch';
    crit.forEach((tc, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn';
      b.textContent = `Jump to candidate ${i + 1}`;
      b.addEventListener('pointerup', () => b.blur());
      b.addEventListener('click', () => { stop(); tcur = tc; refresh(); });
      group.appendChild(b);
    });
    controls.appendChild(group);
  }
  controls.appendChild(row);
  refresh();
}

// <jsx-fubini f="3*x*x - y" xmin="0" xmax="2" ymin="0" ymax="3">
//
// Fubini's theorem, animated. Slice the solid at a fixed x (left): the cross-section is the
// area under z = f(x, y), A(x) = integral of f dy. Then A(x) itself is plotted as x moves
// (right) and the area accumulated so far is shaded: its final value is the double integral.
// The order button swaps the roles of x and y (integrate dx first, slice at fixed y), and the
// total comes out the same. Instructor-driven: slider, Sweep, order toggle.
function renderJsxFubini(el) {
  const TAG = 'jsx-fubini';
  if (typeof JXG === 'undefined') {
    console.error(`<${TAG}>: JXG is not defined. Add the JSXGraph <link>/<script> tags to this lesson's <head>.`);
    return;
  }
  const f = compileMath(['x', 'y'], el.getAttribute('f') || '0', TAG, 'f');
  if (!f) return;
  const num = (n, d) => evalNumAttr(el, n, d, TAG);
  const lim = { x: [num('xmin', 0), num('xmax', 1)], y: [num('ymin', 0), num('ymax', 1)] };
  const state = { outer: el.getAttribute('order') === 'yx' ? 'y' : 'x', s: null };
  const inner = () => (state.outer === 'x' ? 'y' : 'x');
  const fv = (o, i, u, w) => (o === 'x' ? f(u, w) : f(w, u)); // outer value u, inner value w

  // cached A(u) tables for each order
  const cache = {};
  function table(o) {
    if (cache[o]) return cache[o];
    const i = o === 'x' ? 'y' : 'x';
    const [ol, oh] = lim[o]; const [il, ih] = lim[i];
    const N = 240; const M = 240;
    const us = []; const As = [];
    for (let a = 0; a <= N; a++) {
      const u = ol + ((oh - ol) * a) / N;
      let s = 0;
      for (let b = 0; b < M; b++) s += fv(o, i, u, il + ((ih - il) * (b + 0.5)) / M);
      us.push(u); As.push(s * ((ih - il) / M));
    }
    let tot = 0;
    for (let a = 0; a < N; a++) tot += ((As[a] + As[a + 1]) / 2) * ((oh - ol) / N);
    cache[o] = { us, As, tot, lo: Math.min(0, ...As), hi: Math.max(0, ...As) };
    return cache[o];
  }
  const Aat = (o, u) => {
    const T = table(o); const [ol, oh] = lim[o];
    const k = Math.max(0, Math.min(T.us.length - 1, ((u - ol) / (oh - ol)) * (T.us.length - 1)));
    const k0 = Math.floor(k); const k1 = Math.min(T.us.length - 1, k0 + 1);
    return T.As[k0] + (T.As[k1] - T.As[k0]) * (k - k0);
  };
  const accum = (o, s) => {
    const T = table(o); let tot = 0; const [ol, oh] = lim[o];
    const h = (oh - ol) / (T.us.length - 1);
    for (let a = 0; a < T.us.length - 1; a++) {
      const u0 = T.us[a]; const u1 = T.us[a + 1];
      if (u0 >= s) break;
      const w = Math.min(u1, s) - u0;
      const A1 = T.As[a]; const A2 = Aat(o, Math.min(u1, s));
      tot += ((A1 + A2) / 2) * w; void h;
    }
    return tot;
  };
  let zlo = 0; let zhi = 0;
  for (let a = 0; a <= 30; a++) for (let b = 0; b <= 30; b++) {
    const v = f(lim.x[0] + ((lim.x[1] - lim.x[0]) * a) / 30, lim.y[0] + ((lim.y[1] - lim.y[0]) * b) / 30);
    if (Number.isFinite(v)) { zlo = Math.min(zlo, v); zhi = Math.max(zhi, v); }
  }
  state.s = lim[state.outer][0] + (lim[state.outer][1] - lim[state.outer][0]) * 0.35;

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--transform';
  const readout = document.createElement('div');
  readout.className = 'jsx-trace-readout';
  const grid = document.createElement('div');
  grid.className = 'jsx-fubini-grid';
  const mk = (cap) => {
    const box = document.createElement('div');
    const c = document.createElement('div');
    c.className = 'muted small jsx-strip-cap';
    const h = document.createElement('div');
    h.className = 'jsx-board jsx-board--fubini';
    h.id = `jsx-board-${++boardCounter}`;
    box.append(c, h);
    grid.appendChild(box);
    return { cap: c, host: h, set: cap };
  };
  const L = mk(); const R = mk();
  const view3d = document.createElement('div');
  const cap3d = document.createElement('div');
  cap3d.className = 'muted small jsx-strip-cap';
  const canvas = document.createElement('canvas');
  canvas.className = 'jsx-fubini-canvas';
  view3d.append(cap3d, canvas);
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  container.append(readout, view3d, grid, controls);
  el.replaceWith(container);

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const muted = cssVar('--muted') || '#6b7280';
  const negative = cssVar('--negative') || '#c0392b';
  const opts = (bb) => ({
    boundingbox: bb, axis: true, showNavigation: false, showCopyright: false, keepaspectratio: false,
    pan: { enabled: false }, zoom: { enabled: false }, resize: { enabled: true, throttle: 100 },
  });
  const bbLeft = () => { const [a, b] = lim[inner()]; const p = (b - a) * 0.06; return [a - p, zhi + (zhi - zlo) * 0.15 + 0.001, b + p, zlo - (zhi - zlo) * 0.12 - 0.001]; };
  const bbRight = () => { const T = table(state.outer); const [a, b] = lim[state.outer]; const p = (b - a) * 0.06; const r = (T.hi - T.lo) || 1; return [a - p, T.hi + r * 0.18, b + p, T.lo - r * 0.12]; };
  const bl = JXG.JSXGraph.initBoard(L.host.id, opts(bbLeft()));
  const br = JXG.JSXGraph.initBoard(R.host.id, opts(bbRight()));
  [bl, br].forEach((b) => styleAxes(b, ink));

  const sliceData = () => {
    const o = state.outer; const i = inner(); const [il, ih] = lim[i];
    const xs = []; const ys = [];
    for (let a = 0; a <= 160; a++) { const w = il + ((ih - il) * a) / 160; xs.push(w); ys.push(fv(o, i, state.s, w)); }
    return { xs, ys };
  };
  const sliceFill = () => {
    const d = sliceData(); const [il, ih] = lim[inner()];
    return { xs: [...d.xs, ih, il], ys: [...d.ys, 0, 0] };
  };
  const makeCurve = (b, get, style) => { const c = b.create('curve', [[0], [0]], style); c.updateDataArray = function u() { const d = get(); this.dataX = d.xs; this.dataY = d.ys; }; b.update(); return c; };
  makeCurve(bl, sliceFill, { strokeWidth: 0, fillColor: accent, fillOpacity: 0.28, highlight: false });
  makeCurve(bl, sliceData, { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });
  bl.create('text', [() => bbLeft()[0] + (bbLeft()[2] - bbLeft()[0]) * 0.1, () => bbLeft()[1] - (bbLeft()[1] - bbLeft()[3]) * 0.1,
    () => `z = f at ${state.outer} = ${fmtNum(state.s)}`], { fontSize: READOUT_VALUE_FONT - 4, color: accent, fixed: true, cssStyle: 'font-weight:800' });
  bl.create('text', [() => bbLeft()[2] - (bbLeft()[2] - bbLeft()[0]) * 0.03, () => (zlo < 0 ? zlo * 0.15 : -(zhi - zlo) * 0.1), () => inner()],
    { anchorX: 'right', fontSize: READOUT_VALUE_FONT - 2, color: ink, fixed: true, cssStyle: 'font-weight:800' });

  const curveR = () => { const T = table(state.outer); return { xs: T.us, ys: T.As }; };
  const fillR = () => {
    const T = table(state.outer); const [ol] = lim[state.outer];
    const xs = []; const ys = [];
    T.us.forEach((u, a) => { if (u <= state.s) { xs.push(u); ys.push(T.As[a]); } });
    xs.push(state.s, state.s, ol); ys.push(Aat(state.outer, state.s), 0, 0);
    return { xs, ys };
  };
  makeCurve(br, curveR, { strokeColor: muted, strokeWidth: CURVE_STROKE - 1, highlight: false });
  makeCurve(br, fillR, { strokeWidth: 0, fillColor: negative, fillOpacity: 0.3, highlight: false });
  br.create('point', [() => state.s, () => Aat(state.outer, state.s)], {
    name: '', size: POINT_SIZE + 1, strokeColor: '#fff', fillColor: negative, strokeWidth: POINT_STROKE, fixed: true, highlight: false,
  });
  br.create('text', [() => bbRight()[0] + (bbRight()[2] - bbRight()[0]) * 0.1, () => bbRight()[1] - (bbRight()[1] - bbRight()[3]) * 0.1,
    () => `A(${state.outer}) = ∫ f d${inner()}`], { fontSize: READOUT_VALUE_FONT - 4, color: negative, fixed: true, cssStyle: 'font-weight:800' });
  br.create('text', [() => bbRight()[2] - (bbRight()[2] - bbRight()[0]) * 0.03, () => -(bbRight()[1] - bbRight()[3]) * 0.1, () => state.outer],
    { anchorX: 'right', fontSize: READOUT_VALUE_FONT - 2, color: ink, fixed: true, cssStyle: 'font-weight:800' });

  // ---- 3D view: the surface, the slicing plane, and the cross-section cut out of the solid ----
  const view = { az: 0.62, el: 0.5 };
  function draw3d() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth; const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const [x0, x1] = lim.x; const [y0, y1] = lim.y;
    const big = Math.max(x1 - x0, y1 - y0); const zr = Math.max(1e-9, zhi - zlo);
    const ca = Math.cos(view.az); const sa = Math.sin(view.az);
    const ce = Math.cos(view.el); const se = Math.sin(view.el);
    const proj = (x, y, z) => {
      const X = (x - (x0 + x1) / 2) / big; const Y = (y - (y0 + y1) / 2) / big;
      const Z = ((z - (zlo + zhi) / 2) / zr) * 0.95;
      const u = X * ca - Y * sa; const w = X * sa + Y * ca;
      return { u, v: Z * ce + w * se, d: w * ce - Z * se };
    };
    let umin = Infinity; let umax = -Infinity; let vmin = Infinity; let vmax = -Infinity;
    [x0, x1].forEach((x) => [y0, y1].forEach((y) => [zlo, zhi].forEach((z) => {
      const p = proj(x, y, z);
      umin = Math.min(umin, p.u); umax = Math.max(umax, p.u); vmin = Math.min(vmin, p.v); vmax = Math.max(vmax, p.v);
    })));
    const pad = 16;
    const sc = Math.min((cw - 2 * pad) / (umax - umin), (ch - 2 * pad) / (vmax - vmin));
    const cu = (umin + umax) / 2; const cv = (vmin + vmax) / 2;
    const scr = (x, y, z) => { const p = proj(x, y, z); return [cw / 2 + (p.u - cu) * sc, ch / 2 - (p.v - cv) * sc, p.d]; };
    const o = state.outer; const i = inner();
    const at = (u, w) => (o === 'x' ? [u, w] : [w, u]); // (outer, inner) -> (x, y)
    const P = (u, w, z) => { const [x, y] = at(u, w); return scr(x, y, z); };
    const [ol, oh] = lim[o]; const [il, ih] = lim[i];

    const faces = [];
    const quad = (pts, fill, stroke, alpha) => { faces.push({ sp: pts, d: pts.reduce((a, q) => a + q[2], 0) / pts.length, fill, stroke, alpha }); };
    const S = 26;
    for (let a = 0; a < S; a++) {
      for (let b = 0; b < S; b++) {
        const xa = x0 + ((x1 - x0) * a) / S; const xb = x0 + ((x1 - x0) * (a + 1)) / S;
        const ya = y0 + ((y1 - y0) * b) / S; const yb = y0 + ((y1 - y0) * (b + 1)) / S;
        const mid = o === 'x' ? (xa + xb) / 2 : (ya + yb) / 2;
        const swept = mid <= state.s;
        quad([scr(xa, ya, f(xa, ya)), scr(xb, ya, f(xb, ya)), scr(xb, yb, f(xb, yb)), scr(xa, yb, f(xa, yb))],
          swept ? negative : '#9aa0a6', swept ? 'rgba(192,57,43,0.35)' : 'rgba(90,98,110,0.3)', swept ? 0.34 : 0.2);
      }
    }
    quad([P(state.s, il, zlo), P(state.s, ih, zlo), P(state.s, ih, zhi), P(state.s, il, zhi)], accent, accent, 0.1);
    faces.sort((p, q) => q.d - p.d);

    // base rectangle
    ctx.lineWidth = 2.5; ctx.strokeStyle = ink;
    ctx.beginPath();
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], k) => { const p = scr(x, y, 0); if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
    faces.forEach((fc) => {
      ctx.beginPath();
      fc.sp.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.globalAlpha = fc.alpha; ctx.fillStyle = fc.fill; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.strokeStyle = fc.stroke; ctx.stroke();
    });
    // plane outline
    ctx.lineWidth = 2.5; ctx.strokeStyle = accent;
    ctx.beginPath();
    [[il, zlo], [ih, zlo], [ih, zhi], [il, zhi]].forEach(([w, z], k) => { const p = P(state.s, w, z); if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.stroke();
    // cross-section: the region between the plane's cut of the surface and z = 0
    const N = 120; const cut = [];
    for (let a = 0; a <= N; a++) { const w = il + ((ih - il) * a) / N; cut.push(P(state.s, w, fv(o, i, state.s, w))); }
    ctx.beginPath();
    cut.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    const e1 = P(state.s, ih, 0); const e0 = P(state.s, il, 0);
    ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e0[0], e0[1]); ctx.closePath();
    ctx.globalAlpha = 0.6; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath();
    cut.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.lineWidth = 4; ctx.strokeStyle = accent; ctx.stroke();
    // axis labels
    ctx.fillStyle = muted; ctx.font = '700 18px system-ui, sans-serif';
    const lab = (t, x, y, z) => { const p = scr(x, y, z); ctx.fillText(t, p[0] + 6, p[1] + 4); };
    lab('x', x1, y0, 0); lab('y', x0, y1, 0); lab('z', x0, y0, zhi);
  }
  let rot = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); rot = { x: e.clientX, y: e.clientY, az: view.az, el: view.el }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!rot) return;
    view.az = rot.az - (e.clientX - rot.x) * 0.008;
    view.el = Math.max(0.08, Math.min(1.45, rot.el + (e.clientY - rot.y) * 0.006));
    draw3d();
  });
  canvas.addEventListener('pointerup', () => { rot = null; });
  canvas.addEventListener('pointercancel', () => { rot = null; });
  window.addEventListener('resize', draw3d);

  const f2 = (v) => fmtNum(v).replace('-', '−');
  function refresh() {
    const o = state.outer; const i = inner();
    const T = table(o);
    L.cap.textContent = `Slice at a fixed ${o}: the area under the curve is A(${o})`;
    R.cap.textContent = `A(${o}) as ${o} moves; shaded = area collected so far`;
    const done = state.s >= lim[o][1] - 1e-6;
    readout.innerHTML =
      `<span class="jsx-trace-chip">∬ f d${i} d${o}: &nbsp;${o} = <b>${f2(state.s)}</b></span>` +
      `<span class="jsx-trace-chip">A(${o}) = <b>${f2(Aat(o, state.s))}</b></span>` +
      `<span class="jsx-trace-chip">collected = <b>${f2(accum(o, state.s))}</b></span>` +
      `<span class="jsx-trace-chip ${done ? 'jsx-trace-main' : ''}">total = <b>${f2(T.tot)}</b></span>`;
    bl.setBoundingBox(bbLeft(), false);
    br.setBoundingBox(bbRight(), false);
    bl.update(); br.update();
    cap3d.textContent = state.outer === 'x'
      ? 'The plane x = constant (parallel to the yz-plane) cuts the solid. Drag the picture to rotate it.'
      : 'The plane y = constant (parallel to the xz-plane) cuts the solid. Drag the picture to rotate it.';
    draw3d();
    const input = controls.querySelector('input');
    if (input) { input.min = lim[o][0]; input.max = lim[o][1]; input.step = (lim[o][1] - lim[o][0]) / 400; if (Math.abs(parseFloat(input.value) - state.s) > 1e-9) input.value = state.s; }
    controls.querySelectorAll('.jsx-switch .btn').forEach((b) => b.classList.toggle('is-on', b.dataset.o === o));
  }

  const row = document.createElement('label');
  row.className = 'jsx-slider-row';
  row.innerHTML = '<span class="jsx-slider-name">slice <small>drag it</small></span><input type="range" min="0" max="1" step="0.01">';
  const input = row.querySelector('input');
  let raf = null;
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; sweep.textContent = '▶ Sweep'; };
  input.addEventListener('input', () => { stop(); state.s = parseFloat(input.value); refresh(); });
  input.addEventListener('pointerup', () => input.blur());
  const sweep = document.createElement('button');
  sweep.type = 'button'; sweep.className = 'btn'; sweep.textContent = '▶ Sweep';
  sweep.addEventListener('pointerup', () => sweep.blur());
  sweep.addEventListener('click', () => {
    if (raf) { stop(); return; }
    const [ol, oh] = lim[state.outer];
    if (state.s >= oh - 1e-6) state.s = ol;
    sweep.textContent = '⏸ Pause';
    let last = performance.now();
    const tick = (now) => {
      state.s = Math.min(oh, state.s + ((now - last) / 1000) * ((oh - ol) / 9));
      last = now;
      refresh();
      if (state.s < oh) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
  });
  const sw = document.createElement('div');
  sw.className = 'jsx-switch';
  [['x', '∫∫ f dy dx'], ['y', '∫∫ f dx dy']].forEach(([o, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.dataset.o = o; b.textContent = label;
    b.addEventListener('pointerup', () => b.blur());
    b.addEventListener('click', () => {
      stop();
      const frac = (state.s - lim[state.outer][0]) / (lim[state.outer][1] - lim[state.outer][0]);
      state.outer = o;
      state.s = lim[o][0] + frac * (lim[o][1] - lim[o][0]);
      refresh();
    });
    sw.appendChild(b);
  });
  controls.append(sweep, sw, row);
  refresh();
}

// <jsx-basis v1="3,1" v2="-1,3" x="10,10" a="0.9,0.3;0.3,0.1" drag-basis snap-c>
//
// Coordinates with respect to a basis B = (v1, v2) of R^2 (Linear Algebra 3.4). Draws the standard
// grid, the B-grid (lines parallel to v1 and v2, so the c1-c2 "address" of every point is visible),
// the vectors v1 and v2, and a draggable vector x with the path c1*v1 then c2*v2 that reaches it.
// The readout gives x, [x]_B, and the equation x = c1 v1 + c2 v2.
//
//   a="a,b;c,d"   standard matrix A of a linear transformation T(x) = Ax. Adds T(x) (purple arrow),
//                 its coordinates [T(x)]_B, and the B-matrix B = S^-1 A S (live). When B is diagonal
//                 the readout says so (Theorem 3.4.7).
//   drag-basis    v1 and v2 become draggable (snapped to integer points), so B can be watched
//                 changing as the basis changes.
//   snap-c        x snaps to half-integer B-coordinates while dragging.
//   no-grid       hide the B-grid.
// `xmin/xmax` set the width; height follows from a fixed aspect ratio around the midpoint of
// ymin/ymax (keepaspectratio, so the oblique axes keep their true angles).
const BASIS_ASPECT = 1.6;

function parseNumList(s) {
  // eslint-disable-next-line no-new-func -- instructor-authored lesson content.
  return s.split(',').map((t) => new Function(`return (${t});`)());
}
function parseMatrix(s) {
  const rows = s.split(';').map(parseNumList);
  return rows;
}

function renderJsxBasis(el) {
  const TAG = 'jsx-basis';
  if (typeof JXG === 'undefined') {
    console.error(`<${TAG}>: JXG is not defined. Add the JSXGraph <link>/<script> tags to this lesson's <head>.`);
    return;
  }
  let V1; let V2; let X0; let A = null;
  try {
    V1 = parseNumList(el.getAttribute('v1') || '1,0');
    V2 = parseNumList(el.getAttribute('v2') || '0,1');
    X0 = parseNumList(el.getAttribute('x') || '2,1');
    if (el.getAttribute('a')) A = parseMatrix(el.getAttribute('a'));
  } catch (err) {
    console.error(`<${TAG}>: could not parse an attribute`, err);
    return;
  }
  const num = (n, d) => evalNumAttr(el, n, d, TAG);
  const dragBasis = el.hasAttribute('drag-basis');
  const snapC = el.hasAttribute('snap-c');
  const showGrid = !el.hasAttribute('no-grid');
  const xmin = num('xmin', -8);
  const xmax = num('xmax', 8);
  const ymid = (num('ymin', -5) + num('ymax', 5)) / 2;
  const yhalf = (xmax - xmin) / BASIS_ASPECT / 2;

  const container = document.createElement('div');
  container.className = 'jsx-diagram jsx-diagram--transform';
  const readout = document.createElement('div');
  readout.className = 'jsx-trace-readout';
  const host = document.createElement('div');
  host.className = 'jsx-board jsx-board--basis';
  host.id = `jsx-board-${++boardCounter}`;
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  container.append(readout, host, controls);
  el.replaceWith(container);

  const ink = cssVar('--ink') || '#151515';
  const accent = cssVar('--accent') || '#0f6ab4';
  const line = cssVar('--line') || '#e5e7eb';
  const negative = cssVar('--negative') || '#c0392b';
  const green = '#2e8b57';
  const purple = '#7d3c98';

  const board = JXG.JSXGraph.initBoard(host.id, {
    boundingbox: [xmin, ymid + yhalf, xmax, ymid - yhalf],
    axis: true, showNavigation: false, showCopyright: false, keepaspectratio: true,
    pan: { enabled: false }, zoom: { enabled: false }, resize: { enabled: true, throttle: 100 },
  });
  styleAxes(board, ink);
  board.defaultAxes.x.setAttribute({ strokeOpacity: 0.45 });
  board.defaultAxes.y.setAttribute({ strokeOpacity: 0.45 });
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE });

  const pt = (opts) => ({ name: '', size: POINT_SIZE + 1, strokeColor: '#fff', strokeWidth: POINT_STROKE, highlight: false, ...opts });
  const p1 = board.create('point', [...V1], pt({ fillColor: accent, fixed: !dragBasis, snapToGrid: dragBasis, snapSizeX: 1, snapSizeY: 1, size: POINT_SIZE + 2 }));
  const p2 = board.create('point', [...V2], pt({ fillColor: green, fixed: !dragBasis, snapToGrid: dragBasis, snapSizeX: 1, snapSizeY: 1, size: POINT_SIZE + 2 }));
  const O = board.create('point', [0, 0], { visible: false, fixed: true, name: '' });
  const P = board.create('point', [...X0], pt({ fillColor: ink, size: POINT_SIZE + 2 }));

  const S = () => [[p1.X(), p2.X()], [p1.Y(), p2.Y()]];
  const det = () => p1.X() * p2.Y() - p2.X() * p1.Y();
  const inv = () => { const d = det(); return [[p2.Y() / d, -p2.X() / d], [-p1.Y() / d, p1.X() / d]]; };
  const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];
  const ok = () => Math.abs(det()) > 1e-6;
  const coords = (v) => (ok() ? mv(inv(), v) : [NaN, NaN]);
  const cP = () => coords([P.X(), P.Y()]);

  // B-grid: lines parallel to v1 (c2 = k) and to v2 (c1 = k).
  if (showGrid) {
    const N = 14;
    for (let k = -N; k <= N; k++) {
      const major = k === 0;
      board.create('line', [[() => k * p2.X(), () => k * p2.Y()], [() => k * p2.X() + p1.X(), () => k * p2.Y() + p1.Y()]], {
        strokeColor: accent, strokeOpacity: major ? 0.8 : 0.32, strokeWidth: major ? 3 : 1.5, highlight: false, fixed: true, straightFirst: true, straightLast: true,
      });
      board.create('line', [[() => k * p1.X(), () => k * p1.Y()], [() => k * p1.X() + p2.X(), () => k * p1.Y() + p2.Y()]], {
        strokeColor: green, strokeOpacity: major ? 0.8 : 0.32, strokeWidth: major ? 3 : 1.5, highlight: false, fixed: true, straightFirst: true, straightLast: true,
      });
    }
  }
  board.create('arrow', [O, p1], { strokeColor: accent, strokeWidth: 5, lastArrow: { size: 9 }, highlight: false, fixed: true });
  board.create('arrow', [O, p2], { strokeColor: green, strokeWidth: 5, lastArrow: { size: 9 }, highlight: false, fixed: true });
  const lab = (p, txt, color) => board.create('text', [() => p.X() + 0.25, () => p.Y() + 0.35, txt], {
    fontSize: READOUT_VALUE_FONT, color, fixed: true, cssStyle: 'font-weight:800',
  });
  lab(p1, 'v₁', accent);
  lab(p2, 'v₂', green);

  // path c1*v1 then c2*v2 reaching x
  const mid = board.create('point', [() => cP()[0] * p1.X(), () => cP()[0] * p1.Y()], { visible: false, fixed: true, name: '' });
  board.create('segment', [O, mid], { strokeColor: accent, strokeWidth: 4, dash: 2, highlight: false, fixed: true });
  board.create('segment', [mid, P], { strokeColor: green, strokeWidth: 4, dash: 2, highlight: false, fixed: true });
  board.create('text', [() => P.X() + 0.25, () => P.Y() + 0.35, 'x'], { fontSize: READOUT_VALUE_FONT, color: ink, fixed: true, cssStyle: 'font-weight:800' });

  let TP = null;
  if (A) {
    const tx = () => mv(A, [P.X(), P.Y()]);
    TP = board.create('point', [() => tx()[0], () => tx()[1]], pt({ fillColor: purple, fixed: true, size: POINT_SIZE + 2 }));
    board.create('arrow', [O, TP], { strokeColor: purple, strokeWidth: 5, lastArrow: { size: 9 }, highlight: false, fixed: true });
    board.create('segment', [P, TP], { strokeColor: purple, strokeWidth: 2.5, dash: 3, highlight: false, fixed: true });
    board.create('text', [() => TP.X() + 0.25, () => TP.Y() + 0.35, 'T(x)'], { fontSize: READOUT_VALUE_FONT, color: purple, fixed: true, cssStyle: 'font-weight:800' });
  }

  const f2 = (v) => (Number.isFinite(v) ? fmtNum(v).replace('-', '−') : '?');
  const matHtml = (M) => `<span class="la-mat"><span>${f2(M[0][0])}</span><span>${f2(M[0][1])}</span><span>${f2(M[1][0])}</span><span>${f2(M[1][1])}</span></span>`;
  const vecHtml = (v) => `<span class="la-mat la-vec"><span>${f2(v[0])}</span><span>${f2(v[1])}</span></span>`;

  function updateReadout() {
    if (!ok()) {
      readout.innerHTML = '<span class="jsx-trace-chip jsx-trace-main is-undef">v₁ and v₂ are parallel: they do not form a basis</span>';
      return;
    }
    const c = cP();
    let html =
      `<span class="jsx-trace-chip">x = ${vecHtml([P.X(), P.Y()])}</span>` +
      `<span class="jsx-trace-chip jsx-trace-main">[x]<sub>𝔅</sub> = ${vecHtml(c)}</span>` +
      `<span class="jsx-trace-chip">x = <b>${f2(c[0])}</b>·v₁ + <b>${f2(c[1])}</b>·v₂</span>`;
    if (A) {
      const T = mv(A, [P.X(), P.Y()]);
      const cT = coords(T);
      const B = (() => { const AS = [mv(A, [p1.X(), p1.Y()]), mv(A, [p2.X(), p2.Y()])]; const col = (v) => coords(v); const c1 = col(AS[0]); const c2 = col(AS[1]); return [[c1[0], c2[0]], [c1[1], c2[1]]]; })();
      const diag = Math.abs(B[0][1]) < 0.02 && Math.abs(B[1][0]) < 0.02;
      html += `<span class="jsx-trace-chip" style="color:${purple}">T(x) = ${vecHtml(T)}</span>` +
        `<span class="jsx-trace-chip" style="color:${purple}">[T(x)]<sub>𝔅</sub> = ${vecHtml(cT)}</span>` +
        `<span class="jsx-trace-chip ${diag ? 'jsx-trace-main is-parallel' : ''}">B = ${matHtml(B)}${diag ? ' &nbsp;diagonal!' : ''}</span>`;
    }
    readout.innerHTML = html;
  }
  function refresh() { updateReadout(); board.update(); }

  P.on('drag', () => {
    if (snapC && ok()) {
      const c = cP();
      const r = [Math.round(c[0] * 2) / 2, Math.round(c[1] * 2) / 2];
      const m = mv(S(), r);
      P.moveTo(m);
    }
    refresh();
  });
  p1.on('drag', refresh);
  p2.on('drag', refresh);

  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset';
  reset.addEventListener('pointerup', () => reset.blur());
  reset.addEventListener('click', () => { p1.moveTo(V1); p2.moveTo(V2); P.moveTo(X0); refresh(); });
  controls.appendChild(reset);
  const hint = document.createElement('span');
  hint.className = 'muted small';
  hint.textContent = dragBasis ? 'Drag x, or drag the tips of v₁ and v₂.' : 'Drag x.';
  controls.appendChild(hint);
  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('jsx-graph').forEach(renderJsxGraph);
  document.querySelectorAll('jsx-radian-arc').forEach(renderJsxRadianArc);
  document.querySelectorAll('jsx-chain-demo').forEach(renderJsxChainDemo);
  document.querySelectorAll('jsx-unit-circle').forEach(renderJsxUnitCircle);
  document.querySelectorAll('jsx-sine-trace').forEach(renderJsxSineTrace);
  document.querySelectorAll('jsx-transform').forEach(renderJsxTransform);
  document.querySelectorAll('jsx-trig-graph').forEach(renderJsxTrigGraph);
  document.querySelectorAll('jsx-lagrange').forEach(renderJsxLagrange);
  document.querySelectorAll('jsx-fubini').forEach(renderJsxFubini);
  document.querySelectorAll('jsx-basis').forEach(renderJsxBasis);
});
