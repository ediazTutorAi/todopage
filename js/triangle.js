// <triangle type="right|isosceles|equilateral"> — renders a schematic SVG
// triangle diagram with static side/angle labels. Any <reveal slot="..."> child
// gets moved onto the matching side's anchor point instead of rendering inline
// where authored, so reveal.js's click handler picks it up with no extra wiring.
//
// type="scalene" (a general, non-symmetric triangle) is intentionally not
// implemented yet -- it needs real triangle-solving (law of sines/cosines)
// rather than a closed-form layout, and no current lesson needs it.
//
// `build` (bare boolean, type="right" only): instead of painting the finished
// figure immediately, reveal it in the same 3 stages the workbook's own
// "(a) graph theta / (b) construct the triangle / (c) find r" steps use,
// advanced by a button rather than by clicking the diagram itself (there's
// nothing visible to click before a line exists). Lets the instructor build
// the picture live instead of presenting it pre-drawn.

const PAD = 34;

function toRad(deg) { return (deg * Math.PI) / 180; }
function round(n) { return Math.round(n * 100) / 100; }
function mid(p1, p2) { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
function norm(v) { const len = Math.hypot(v.x, v.y) || 1; return { x: v.x / len, y: v.y / len }; }

// A point near `at`, pulled toward the interior of the angle formed by rays
// to b1/b2 -- used to place an angle label just inside its vertex.
function inset(at, b1, b2, dist) {
  const d1 = norm({ x: b1.x - at.x, y: b1.y - at.y });
  const d2 = norm({ x: b2.x - at.x, y: b2.y - at.y });
  const dir = norm({ x: d1.x + d2.x, y: d1.y + d2.y });
  return { x: at.x + dir.x * dist, y: at.y + dir.y * dist };
}

function layoutRight(el) {
  const angleDeg = parseFloat(el.getAttribute('angle') || '30');
  const labelA = el.getAttribute('label-a') || `${round(angleDeg)}°`;
  // label-c="" explicitly suppresses the complementary-angle label (vs. the
  // attribute being absent entirely, which falls back to the numeric default).
  const showLabelC = !(el.hasAttribute('label-c') && el.getAttribute('label-c') === '');
  const labelC = el.getAttribute('label-c') || `${round(90 - angleDeg)}°`;
  const pointLabel = el.getAttribute('point-label');
  const showAxes = el.hasAttribute('axes');
  const base = 220;
  const height = Math.max(50, Math.min(320, base * Math.tan(toRad(angleDeg))));

  // With axes, vertex A doubles as the plane's origin: give it room for a
  // negative-direction stub on both axes, and extra room past B/C for the
  // positive-direction arrowheads to overshoot the triangle.
  const AXIS_MARGIN = showAxes ? 28 : 0;
  const AXIS_OVERSHOOT = showAxes ? 26 : 0;
  const padLeft = PAD + AXIS_MARGIN, padTop = PAD + AXIS_OVERSHOOT;
  const padRight = PAD + AXIS_OVERSHOOT, padBottom = PAD + AXIS_MARGIN;
  const W = base + padLeft + padRight, H = height + padTop + padBottom;

  const A = { x: padLeft, y: padTop + height };       // reference angle vertex (== origin)
  const B = { x: padLeft + base, y: padTop + height }; // right-angle vertex
  const C = { x: padLeft + base, y: padTop };          // complementary angle vertex

  const layout = {
    viewBox: `0 0 ${W} ${H}`, W, H,
    vertices: { A, B, C },
    rightAngleAt: B,
    point: C,
    pointLabel,
    sides: {
      adjacent: { p1: A, p2: B, mid: mid(A, B), stage: 2 },
      opposite: { p1: B, p2: C, mid: mid(B, C), stage: 2 },
      hypotenuse: { p1: A, p2: C, mid: mid(A, C), stage: 1 },
    },
    angles: [
      { at: inset(A, B, C, 26), label: labelA, stage: 1 },
      ...(showLabelC ? [{ at: inset(C, A, B, 26), label: labelC, stage: 1 }] : []),
    ],
  };

  if (showAxes) {
    layout.axes = {
      xStart: { x: A.x - AXIS_MARGIN, y: A.y },
      xEnd: { x: B.x + AXIS_OVERSHOOT, y: A.y },
      yStart: { x: A.x, y: A.y + AXIS_MARGIN },
      yEnd: { x: A.x, y: C.y - AXIS_OVERSHOOT },
    };
  }

  return layout;
}

function layoutIsosceles(el) {
  const apexDeg = parseFloat(el.getAttribute('apex-angle') || '40');
  const halfBase = 110;
  const height = Math.max(60, Math.min(300, halfBase / Math.tan(toRad(apexDeg / 2))));
  const W = halfBase * 2 + PAD * 2, H = height + PAD * 2;

  const L = { x: PAD, y: PAD + height };
  const R = { x: PAD + halfBase * 2, y: PAD + height };
  const T = { x: PAD + halfBase, y: PAD };

  return {
    viewBox: `0 0 ${W} ${H}`, W, H,
    vertices: { L, R, T },
    sides: {
      base: { p1: L, p2: R, mid: mid(L, R) },
      leg1: { p1: L, p2: T, mid: mid(L, T) },
      leg2: { p1: R, p2: T, mid: mid(R, T) },
    },
    angles: [{ at: inset(T, L, R, 24), label: `${round(apexDeg)}°` }],
    ticks: [{ p1: L, p2: T }, { p1: R, p2: T }],
  };
}

function layoutEquilateral() {
  const side = 200;
  const height = side * Math.sin(toRad(60));
  const W = side + PAD * 2, H = height + PAD * 2;

  const L = { x: PAD, y: PAD + height };
  const R = { x: PAD + side, y: PAD + height };
  const T = { x: PAD + side / 2, y: PAD };

  return {
    viewBox: `0 0 ${W} ${H}`, W, H,
    vertices: { L, R, T },
    sides: {
      side1: { p1: L, p2: R, mid: mid(L, R) },
      side2: { p1: L, p2: T, mid: mid(L, T) },
      side3: { p1: R, p2: T, mid: mid(R, T) },
    },
    angles: [
      { at: inset(L, R, T, 22), label: '60°' },
      { at: inset(R, L, T, 22), label: '60°' },
      { at: inset(T, L, R, 22), label: '60°' },
    ],
    ticks: [{ p1: L, p2: R }, { p1: L, p2: T }, { p1: R, p2: T }],
  };
}

function layoutScalene() {
  console.error('<triangle type="scalene">: general triangle solving is not implemented yet.');
  return null;
}

const LAYOUTS = { right: layoutRight, isosceles: layoutIsosceles, equilateral: layoutEquilateral, scalene: layoutScalene };
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_BUILD_STAGE = 3;

function renderRightAngleTick(svg, at, size) {
  // Assumes layoutRight's fixed orientation: interior is up-and-left of `at`.
  const p = document.createElementNS(SVG_NS, 'polyline');
  p.setAttribute('points', `${at.x - size},${at.y} ${at.x - size},${at.y - size} ${at.x},${at.y - size}`);
  p.setAttribute('class', 'triangle-right-tick');
  svg.appendChild(p);
  return p;
}

function renderEqualTick(svg, p1, p2) {
  const m = mid(p1, p2);
  const dir = norm({ x: p2.x - p1.x, y: p2.y - p1.y });
  const perp = { x: -dir.y, y: dir.x };
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', m.x - perp.x * 6);
  line.setAttribute('y1', m.y - perp.y * 6);
  line.setAttribute('x2', m.x + perp.x * 6);
  line.setAttribute('y2', m.y + perp.y * 6);
  line.setAttribute('class', 'triangle-equal-tick');
  svg.appendChild(line);
}

let axisMarkerCounter = 0;

function renderAxes(svg, figure, axes, W, H) {
  const markerId = `triangle-axis-arrow-${++axisMarkerCounter}`;
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrowhead = document.createElementNS(SVG_NS, 'path');
  arrowhead.setAttribute('d', 'M0,0 L10,5 L0,10 z');
  arrowhead.setAttribute('class', 'triangle-axis-arrowhead');
  marker.appendChild(arrowhead);
  defs.appendChild(marker);
  svg.appendChild(defs);

  [[axes.xStart, axes.xEnd], [axes.yStart, axes.yEnd]].forEach(([start, end]) => {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.setAttribute('class', 'triangle-axis');
    line.setAttribute('marker-end', `url(#${markerId})`);
    svg.appendChild(line);
  });

  placeOverlay(figure, { x: axes.xEnd.x - 4, y: axes.xEnd.y - 14 }, W, H, 'triangle-axis-label', 'x');
  placeOverlay(figure, { x: axes.yEnd.x + 14, y: axes.yEnd.y + 2 }, W, H, 'triangle-axis-label', 'y');
}

function placeOverlay(figure, point, W, H, cls, text) {
  const span = document.createElement('span');
  span.className = `triangle-overlay ${cls}`;
  span.style.left = `${(point.x / W) * 100}%`;
  span.style.top = `${(point.y / H) * 100}%`;
  span.textContent = text;
  figure.appendChild(span);
  return span;
}

function renderTriangle(el) {
  const type = (el.getAttribute('type') || 'right').toLowerCase();
  const layoutFn = LAYOUTS[type];
  if (!layoutFn) { console.error(`<triangle>: unknown type "${type}"`); return; }
  const layout = layoutFn(el);
  if (!layout) return;

  const buildMode = type === 'right' && el.hasAttribute('build');
  const { vertices, sides, angles, rightAngleAt, ticks, axes, point, pointLabel, viewBox, W, H } = layout;
  const gated = []; // { el, stage } -- only consulted when buildMode is true
  const gate = (node, stage) => { if (buildMode && stage > 0) gated.push({ el: node, stage }); return node; };

  const container = document.createElement('div');
  container.className = 'triangle-diagram';

  const figure = document.createElement('div');
  figure.className = 'triangle-diagram-figure';
  figure.style.setProperty('--triangle-aspect', `${W} / ${H}`);
  container.appendChild(figure);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', 'triangle-diagram-svg');
  figure.appendChild(svg);

  if (axes) renderAxes(svg, figure, axes, W, H); // stage 0: the coordinate plane itself, always shown

  Object.values(sides).forEach(side => {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', side.p1.x);
    line.setAttribute('y1', side.p1.y);
    line.setAttribute('x2', side.p2.x);
    line.setAttribute('y2', side.p2.y);
    line.setAttribute('class', 'triangle-outline');
    svg.appendChild(line);
    gate(line, side.stage || 0);
  });

  if (point && axes) {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
    dot.setAttribute('r', 3.5);
    dot.setAttribute('class', 'triangle-point');
    svg.appendChild(dot);
    gate(dot, 1);

    if (pointLabel) {
      gate(
        placeOverlay(figure, { x: point.x + 14, y: point.y - 12 }, W, H, 'triangle-point-label', pointLabel),
        1
      );
    }
  }

  if (rightAngleAt) gate(renderRightAngleTick(svg, rightAngleAt, 16), 2);
  (ticks || []).forEach(t => renderEqualTick(svg, t.p1, t.p2));

  angles.forEach(a => gate(
    placeOverlay(figure, a.at, W, H, 'triangle-angle-label', a.label),
    a.stage || 0
  ));

  Object.entries(sides).forEach(([name, side]) => {
    const slotEl = el.querySelector(`reveal[slot="${name}"]`);
    const attrVal = el.getAttribute(name);
    let node;
    if (slotEl) {
      node = slotEl;
    } else if (attrVal) {
      node = document.createElement('span');
      node.textContent = attrVal;
    } else {
      return;
    }
    node.classList.add('triangle-overlay', 'triangle-side-label');
    node.style.left = `${(side.mid.x / W) * 100}%`;
    node.style.top = `${(side.mid.y / H) * 100}%`;
    figure.appendChild(node);
    // "finding r" (the hypotenuse label) is its own final stage; leg labels
    // land alongside the legs themselves in stage 2.
    gate(node, name === 'hypotenuse' ? 3 : (side.stage || 0));
  });

  if (buildMode) {
    let stage = 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small triangle-build-btn';
    const applyStage = () => {
      gated.forEach(g => g.el.classList.toggle('triangle-build-pending', g.stage > stage));
      btn.textContent = stage >= MAX_BUILD_STAGE ? '↺ Reset' : 'Build →';
    };
    btn.addEventListener('click', () => {
      stage = stage >= MAX_BUILD_STAGE ? 0 : stage + 1;
      applyStage();
    });
    applyStage();
    container.appendChild(btn);
  }

  el.replaceWith(container);
}

// <angle-plane angle="150" label-a="α = 150°" label-b="β = -210°" ray-label="terminal side">
// A single ray from the origin at an arbitrary angle (not limited to 0-90°,
// unlike <triangle type="right">), with axes and an arc back to the positive
// x-axis -- for "angle in standard position" diagrams that aren't a triangle
// at all. Reuses renderAxes/placeOverlay from the <triangle> implementation
// above. Intentionally narrow: one ray, up to two text labels (for showing
// two different rotations -- e.g. positive/negative coterminal -- to the
// same terminal side) plus an optional ray-tip label. A more general
// multi-ray version can be built later if a lesson needs more than this.

function layoutAnglePlane(el) {
  const angleDeg = parseFloat(el.getAttribute('angle') || '0');
  const R = 95, ARC_R = 34, AXIS_OVERSHOOT = 25;
  const size = R + AXIS_OVERSHOOT;
  const W = size * 2, H = size * 2;
  const O = { x: size, y: size };
  const rad = toRad(angleDeg);
  const tip = { x: O.x + R * Math.cos(rad), y: O.y - R * Math.sin(rad) };

  const arcPoints = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = toRad((angleDeg * i) / steps);
    arcPoints.push({ x: O.x + ARC_R * Math.cos(t), y: O.y - ARC_R * Math.sin(t) });
  }

  const bisectorRad = toRad(angleDeg / 2);
  const labelAAt = { x: O.x + (ARC_R + 16) * Math.cos(bisectorRad), y: O.y - (ARC_R + 16) * Math.sin(bisectorRad) };

  return {
    viewBox: `0 0 ${W} ${H}`, W, H, O, R,
    tip,
    arcPoints,
    labelA: el.getAttribute('label-a'),
    labelAAt,
    labelB: el.getAttribute('label-b'),
    labelBAt: { x: O.x + R * 0.55, y: O.y + 38 },
    rayLabel: el.getAttribute('ray-label'),
    rayLabelAt: { x: O.x + (R + 14) * Math.cos(rad), y: O.y - (R + 14) * Math.sin(rad) - 10 },
    axes: {
      xStart: { x: 0, y: O.y }, xEnd: { x: W, y: O.y },
      yStart: { x: O.x, y: H }, yEnd: { x: O.x, y: 0 },
    },
  };
}

function renderAnglePlane(el) {
  const layout = layoutAnglePlane(el);
  const { O, tip, arcPoints, labelA, labelAAt, labelB, labelBAt, rayLabel, rayLabelAt, axes, viewBox, W, H } = layout;

  const container = document.createElement('div');
  container.className = 'triangle-diagram';

  const figure = document.createElement('div');
  figure.className = 'triangle-diagram-figure';
  figure.style.setProperty('--triangle-aspect', `${W} / ${H}`);
  container.appendChild(figure);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', 'triangle-diagram-svg');
  figure.appendChild(svg);

  renderAxes(svg, figure, axes, W, H);

  const arc = document.createElementNS(SVG_NS, 'polyline');
  arc.setAttribute('points', arcPoints.map(p => `${p.x},${p.y}`).join(' '));
  arc.setAttribute('class', 'triangle-arc');
  svg.appendChild(arc);

  const ray = document.createElementNS(SVG_NS, 'line');
  ray.setAttribute('x1', O.x);
  ray.setAttribute('y1', O.y);
  ray.setAttribute('x2', tip.x);
  ray.setAttribute('y2', tip.y);
  ray.setAttribute('class', 'triangle-outline');
  svg.appendChild(ray);

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', tip.x);
  dot.setAttribute('cy', tip.y);
  dot.setAttribute('r', 3.5);
  dot.setAttribute('class', 'triangle-point');
  svg.appendChild(dot);

  if (labelA) placeOverlay(figure, labelAAt, W, H, 'triangle-angle-label', labelA);
  if (labelB) placeOverlay(figure, labelBAt, W, H, 'triangle-angle-label', labelB);
  if (rayLabel) placeOverlay(figure, rayLabelAt, W, H, 'triangle-point-label', rayLabel);

  el.replaceWith(container);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('triangle').forEach(renderTriangle);
  document.querySelectorAll('angle-plane').forEach(renderAnglePlane);
});
