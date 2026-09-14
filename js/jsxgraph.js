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

  [board.defaultAxes.x, board.defaultAxes.y].forEach((axis) => {
    axis.setAttribute({ strokeColor: ink, strokeWidth: 1.5, highlight: false });
  });
  board.create('grid', [], { strokeColor: line, strokeWidth: 1 });

  board.create('functiongraph', [f], { strokeColor: accent, strokeWidth: 2, highlight: false });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('jsx-graph').forEach(renderJsxGraph);
});
