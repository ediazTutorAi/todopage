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

// JSXGraph's default axis ticks are full-board-spanning (majorHeight: -1)
// with 4 minor ticks between each major one -- a "graph paper" look that
// reads as visual noise against this site's plainer style. Trim to short,
// major-only tick marks; a real grid (when wanted) is its own explicit
// `board.create('grid', ...)` call instead of piggybacking on tick styling.
function styleAxes(board, ink) {
  [board.defaultAxes.x, board.defaultAxes.y].forEach((axis) => {
    axis.setAttribute({ strokeColor: ink, strokeWidth: 1.5, highlight: false });
    axis.defaultTicks.setAttribute({ minorTicks: 0, majorHeight: 10 });
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
  board.create('grid', [], { strokeColor: line, strokeWidth: 1 });

  board.create('functiongraph', [f], { strokeColor: accent, strokeWidth: 2, highlight: false });
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
  const headroom = 2.6; // room for the live readout text above both circles
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
      strokeColor: line, strokeWidth: 1.5, fixed: true, highlight: false, name: '',
    });
    const zero = board.create('point', [r, 0], { visible: false, fixed: true, name: '' });
    const glider = board.create('glider', [r, 0, circle], {
      name: '', size: 5, strokeColor: '#fff', fillColor: accent, strokeWidth: 2, highlight: false,
    });
    board.create('segment', [center, glider], {
      strokeColor: line, strokeWidth: 1, dash: 2, highlight: false,
    });
    board.create('arc', [center, zero, glider], {
      strokeColor: accent, strokeWidth: 3, highlight: false,
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
    const gap = Math.max(0.4, radius * 0.1);
    let y = top - 0.5;
    board.create('text', [x, y, () => heading], { fontSize: 14, color: ink, fixed: true });
    y -= gap;
    board.create('text', [x, y, () => `θ = ${reader.angle().toFixed(2)} rad`], { fontSize: 15, color: accent, fixed: true });
    y -= gap;
    board.create('text', [x, y, () => `s = ${reader.arcLength().toFixed(2)}`], { fontSize: 15, color: accent, fixed: true });
    y -= gap;
    board.create('text', [x, y, () => `s / r = ${(reader.arcLength() / r).toFixed(2)}`], { fontSize: 15, color: ink, fixed: true });
  }

  addReadout(-side + 0.2, 'Unit circle (r = 1)', unit, 1);
  addReadout(0.2, `Circle of radius ${radius}`, outer, radius);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('jsx-graph').forEach(renderJsxGraph);
  document.querySelectorAll('jsx-radian-arc').forEach(renderJsxRadianArc);
});
