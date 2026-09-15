// <jsx-graph fn="Math.sin(x)" xmin="-7" xmax="7" ymin="-2" ymax="2">
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

  styleAxes(board, ink);
  board.create('grid', [], { strokeColor: line, strokeWidth: GRID_STROKE });

  board.create('functiongraph', [f], { strokeColor: accent, strokeWidth: CURVE_STROKE, highlight: false });
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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('jsx-graph').forEach(renderJsxGraph);
  document.querySelectorAll('jsx-radian-arc').forEach(renderJsxRadianArc);
  document.querySelectorAll('jsx-chain-demo').forEach(renderJsxChainDemo);
});
