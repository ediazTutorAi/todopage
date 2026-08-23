// <triangle type="right|isosceles|equilateral"> — renders a schematic SVG
// triangle diagram with static side/angle labels. Any <reveal slot="..."> child
// gets moved onto the matching side's anchor point instead of rendering inline
// where authored, so reveal.js's click handler picks it up with no extra wiring.
//
// type="scalene" (a general, non-symmetric triangle) is intentionally not
// implemented yet -- it needs real triangle-solving (law of sines/cosines)
// rather than a closed-form layout, and no current lesson needs it.

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
  const labelC = el.getAttribute('label-c') || `${round(90 - angleDeg)}°`;
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
    sides: {
      adjacent: { mid: mid(A, B) },
      opposite: { mid: mid(B, C) },
      hypotenuse: { mid: mid(A, C) },
    },
    angles: [
      { at: inset(A, B, C, 26), label: labelA },
      { at: inset(C, A, B, 26), label: labelC },
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
      base: { mid: mid(L, R) },
      leg1: { mid: mid(L, T) },
      leg2: { mid: mid(R, T) },
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
      side1: { mid: mid(L, R) },
      side2: { mid: mid(L, T) },
      side3: { mid: mid(R, T) },
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

function renderRightAngleTick(svg, at, size) {
  // Assumes layoutRight's fixed orientation: interior is up-and-left of `at`.
  const p = document.createElementNS(SVG_NS, 'polyline');
  p.setAttribute('points', `${at.x - size},${at.y} ${at.x - size},${at.y - size} ${at.x},${at.y - size}`);
  p.setAttribute('class', 'triangle-right-tick');
  svg.appendChild(p);
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

function renderAxes(svg, container, axes, W, H) {
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

  placeOverlay(container, { x: axes.xEnd.x - 4, y: axes.xEnd.y - 14 }, W, H, 'triangle-axis-label', 'x');
  placeOverlay(container, { x: axes.yEnd.x + 14, y: axes.yEnd.y + 2 }, W, H, 'triangle-axis-label', 'y');
}

function placeOverlay(container, point, W, H, cls, text) {
  const span = document.createElement('span');
  span.className = `triangle-overlay ${cls}`;
  span.style.left = `${(point.x / W) * 100}%`;
  span.style.top = `${(point.y / H) * 100}%`;
  span.textContent = text;
  container.appendChild(span);
  return span;
}

function renderTriangle(el) {
  const type = (el.getAttribute('type') || 'right').toLowerCase();
  const layoutFn = LAYOUTS[type];
  if (!layoutFn) { console.error(`<triangle>: unknown type "${type}"`); return; }
  const layout = layoutFn(el);
  if (!layout) return;

  const { vertices, sides, angles, rightAngleAt, ticks, axes, viewBox, W, H } = layout;

  const container = document.createElement('div');
  container.className = 'triangle-diagram';
  container.style.setProperty('--triangle-aspect', `${W} / ${H}`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', 'triangle-diagram-svg');

  if (axes) renderAxes(svg, container, axes, W, H);

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', Object.values(vertices).map(v => `${v.x},${v.y}`).join(' '));
  poly.setAttribute('class', 'triangle-outline');
  svg.appendChild(poly);

  if (rightAngleAt) renderRightAngleTick(svg, rightAngleAt, 16);
  (ticks || []).forEach(t => renderEqualTick(svg, t.p1, t.p2));

  container.appendChild(svg);

  angles.forEach(a => placeOverlay(container, a.at, W, H, 'triangle-angle-label', a.label));

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
    container.appendChild(node);
  });

  el.replaceWith(container);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('triangle').forEach(renderTriangle);
});
