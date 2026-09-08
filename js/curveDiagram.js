// <curve-diagram variant="derivative|tangent|corollary|arclength|parameterization|curvature|tnb|motion">
// Small static illustrative sketches for the conceptual (definition/theorem) steps
// of a vector-calculus lecture -- unlike <triangle>/<angle-plane>, these are NOT
// computed from a specific r(t) given as attributes; they're generic "textbook
// sketch" diagrams meant to sit next to a definition, all built from one shared
// reference curve (a cubic Bezier) so the visual language stays consistent from
// step to step. Reuses the .triangle-diagram*/.triangle-outline/.triangle-arc/
// .triangle-point* CSS classes and color tokens already defined for <triangle>/
// <angle-plane> (css/steps.css) instead of introducing new styling.
//
// Color convention (already baked into those classes, just reused here): ink
// (.triangle-outline / .triangle-point-label) for the curve itself and whatever
// vector/point a diagram's step has already introduced earlier in the lecture;
// accent (.triangle-arc / .triangle-angle-label) for whatever vector or idea is
// newly introduced by that step -- e.g. the tangent line is ink in the derivative
// sketch (it's just "the curve, locally"), but T(t) is accent in the Tangent
// Vectors sketch (that's the new object the step is defining).

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 260, H = 170;

// Shared reference curve, an S-shaped cubic Bezier.
const P0 = { x: 20, y: 150 }, P1 = { x: 70, y: 20 }, P2 = { x: 170, y: 20 }, P3 = { x: 240, y: 110 };

function toRad(deg) { return (deg * Math.PI) / 180; }

function bezierPoint(t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * P0.x + 3 * mt * mt * t * P1.x + 3 * mt * t * t * P2.x + t ** 3 * P3.x,
    y: mt ** 3 * P0.y + 3 * mt * mt * t * P1.y + 3 * mt * t * t * P2.y + t ** 3 * P3.y,
  };
}

// Unit tangent direction at parameter t (screen-space, not normalized to a "speed").
function bezierTangent(t) {
  const mt = 1 - t;
  const dx = 3 * mt * mt * (P1.x - P0.x) + 6 * mt * t * (P2.x - P1.x) + 3 * t * t * (P3.x - P2.x);
  const dy = 3 * mt * mt * (P1.y - P0.y) + 6 * mt * t * (P2.y - P1.y) + 3 * t * t * (P3.y - P2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function placeLabel(figure, point, cls, text) {
  const span = document.createElement('span');
  span.className = `triangle-overlay ${cls}`;
  span.style.left = `${(point.x / W) * 100}%`;
  span.style.top = `${(point.y / H) * 100}%`;
  span.textContent = text;
  figure.appendChild(span);
  return span;
}

let arrowCounter = 0;
function addArrowMarker(svg) {
  const id = `curve-diagram-arrow-${++arrowCounter}`;
  const defs = svgEl('defs', {});
  const marker = svgEl('marker', {
    id, viewBox: '0 0 10 10', refX: '8', refY: '5',
    markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
  });
  marker.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'triangle-axis-arrowhead' }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  return id;
}

function arrow(svg, from, to, cls, markerId) {
  svg.appendChild(svgEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: cls, 'marker-end': `url(#${markerId})` }));
}

function segment(svg, from, to, cls) {
  svg.appendChild(svgEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: cls }));
}

function baseCurve(svg) {
  svg.appendChild(svgEl('path', {
    d: `M ${P0.x},${P0.y} C ${P1.x},${P1.y} ${P2.x},${P2.y} ${P3.x},${P3.y}`,
    class: 'triangle-outline', fill: 'none',
  }));
}

function dot(svg, p, cls = 'triangle-point') {
  svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 3.5, class: cls }));
}

function makeFigure(container) {
  const figure = document.createElement('div');
  figure.className = 'triangle-diagram-figure';
  figure.style.setProperty('--triangle-aspect', `${W} / ${H}`);
  container.appendChild(figure);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'triangle-diagram-svg' });
  figure.appendChild(svg);
  return { figure, svg };
}

// r(t), r(t+Δt), the secant vector between them, and the tangent line at r(t)
// the secant approaches as Δt → 0.
function renderDerivative(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);
  const markerId = addArrowMarker(svg);
  const t1 = 0.3, t2 = 0.62;
  const p = bezierPoint(t1), q = bezierPoint(t2);
  arrow(svg, p, q, 'triangle-arc is-reference', markerId);
  const dir = bezierTangent(t1);
  segment(svg, { x: p.x - dir.x * 24, y: p.y - dir.y * 24 }, p, 'triangle-outline');
  const tanTip = { x: p.x + dir.x * 34, y: p.y + dir.y * 34 };
  arrow(svg, p, tanTip, 'triangle-outline', markerId);
  dot(svg, p); dot(svg, q);
  const secantDir = { x: (q.x - p.x) / Math.hypot(q.x - p.x, q.y - p.y), y: (q.y - p.y) / Math.hypot(q.x - p.x, q.y - p.y) };
  const perp = { x: -secantDir.y, y: secantDir.x };
  placeLabel(figure, { x: p.x - 12, y: p.y + 16 }, 'triangle-point-label', 'r(t)');
  placeLabel(figure, { x: q.x + secantDir.x * 20 + perp.x * 10, y: q.y + secantDir.y * 20 + perp.y * 10 }, 'triangle-point-label', 'r(t+Δt)');
  placeLabel(figure, { x: (p.x + q.x) / 2 + perp.x * 20, y: (p.y + q.y) / 2 + perp.y * 20 }, 'triangle-angle-label is-reference', 'secant');
  placeLabel(figure, { x: tanTip.x + dir.x * 14 - perp.x * 14, y: tanTip.y + dir.y * 14 - perp.y * 14 }, 'triangle-point-label', "r'(t)");
}

// A single point with its unit tangent vector T(t0) drawn as the newly-defined object.
function renderTangent(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);
  const markerId = addArrowMarker(svg);
  const t0 = 0.45;
  const p = bezierPoint(t0);
  const dir = bezierTangent(t0);
  const tip = { x: p.x + dir.x * 55, y: p.y + dir.y * 55 };
  arrow(svg, p, tip, 'triangle-arc', markerId);
  dot(svg, p);
  placeLabel(figure, { x: p.x - 8, y: p.y + 14 }, 'triangle-point-label', 'r(t₀)');
  placeLabel(figure, { x: tip.x + dir.x * 12, y: tip.y + dir.y * 12 }, 'triangle-angle-label', 'T(t₀)');
}

// A circle traced at constant radius: r(t) (radial, ink) is always perpendicular
// to r'(t) (tangential, accent) -- the corollary's geometric content.
function renderCorollary(container) {
  const { figure, svg } = makeFigure(container);
  const O = { x: W / 2, y: H / 2 };
  const R = 58;
  svg.appendChild(svgEl('circle', { cx: O.x, cy: O.y, r: R, class: 'triangle-outline', fill: 'none' }));
  const markerId = addArrowMarker(svg);
  const theta = toRad(50);
  const p = { x: O.x + R * Math.cos(theta), y: O.y - R * Math.sin(theta) };
  const radial = { x: (p.x - O.x) / R, y: (p.y - O.y) / R };
  const tangentDir = { x: -radial.y, y: radial.x };
  arrow(svg, O, p, 'triangle-outline', markerId);
  const vTip = { x: p.x + tangentDir.x * 46, y: p.y + tangentDir.y * 46 };
  arrow(svg, p, vTip, 'triangle-arc', markerId);
  dot(svg, p);
  placeLabel(figure, { x: (O.x + p.x) / 2 - 10, y: (O.y + p.y) / 2 - 4 }, 'triangle-point-label', 'r(t)');
  placeLabel(figure, { x: vTip.x + 8, y: vTip.y - 6 }, 'triangle-angle-label', "r'(t)");
}

// The stretch of curve between t=a and t=b whose length L the arc-length formula
// measures, picked out in accent against the rest of the (ink) curve.
function renderArcLength(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);
  const a = 0.12, b = 0.85;
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) pts.push(bezierPoint(a + (b - a) * (i / N)));
  const poly = svgEl('polyline', { points: pts.map(p => `${p.x},${p.y}`).join(' '), class: 'triangle-arc', fill: 'none' });
  poly.setAttribute('stroke-width', '3');
  svg.appendChild(poly);
  const A = bezierPoint(a), B = bezierPoint(b);
  dot(svg, A); dot(svg, B);
  placeLabel(figure, { x: A.x - 4, y: A.y + 14 }, 'triangle-point-label', 't = a');
  placeLabel(figure, { x: B.x + 6, y: B.y - 10 }, 'triangle-point-label', 't = b');
  const mid = (a + b) / 2;
  const midPt = bezierPoint(mid), dir = bezierTangent(mid);
  const perp = { x: -dir.y, y: dir.x };
  placeLabel(figure, { x: midPt.x + perp.x * 20, y: midPt.y + perp.y * 20 }, 'triangle-angle-label', 'L');
}

// A circle re-parametrized by arc length: s measures distance traveled from a
// start point, shown as a dashed arc (distinct from the circle itself) ending at r(s).
function renderParameterization(container) {
  const { figure, svg } = makeFigure(container);
  const O = { x: W / 2, y: H / 2 + 8 };
  const R = 58;
  svg.appendChild(svgEl('circle', { cx: O.x, cy: O.y, r: R, class: 'triangle-outline', fill: 'none' }));
  const startDeg = 90, endDeg = -50;
  const arcR = R - 16;
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const d = startDeg + (endDeg - startDeg) * (i / N);
    const rad = toRad(d);
    pts.push({ x: O.x + arcR * Math.cos(rad), y: O.y - arcR * Math.sin(rad) });
  }
  svg.appendChild(svgEl('polyline', { points: pts.map(p => `${p.x},${p.y}`).join(' '), class: 'triangle-arc is-reference', fill: 'none' }));
  const startPt = { x: O.x + R * Math.cos(toRad(startDeg)), y: O.y - R * Math.sin(toRad(startDeg)) };
  const endPt = { x: O.x + R * Math.cos(toRad(endDeg)), y: O.y - R * Math.sin(toRad(endDeg)) };
  dot(svg, startPt); dot(svg, endPt);
  placeLabel(figure, { x: startPt.x - 4, y: startPt.y - 12 }, 'triangle-point-label', 's = 0');
  placeLabel(figure, { x: endPt.x + 10, y: endPt.y + 4 }, 'triangle-point-label', 'r(s)');
  placeLabel(figure, pts[Math.floor(N * 0.55)], 'triangle-angle-label is-reference', 's');
}

// Curvature as "1/radius of the best-fit circle": a small, tight osculating
// circle where the curve bends sharply vs. a large, loose one where it's gentle.
function renderCurvature(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);

  const t1 = 0.42, r1 = 20;
  const p1 = bezierPoint(t1), dir1 = bezierTangent(t1);
  const n1 = { x: -dir1.y, y: dir1.x };
  const c1 = { x: p1.x + n1.x * r1, y: p1.y + n1.y * r1 };
  svg.appendChild(svgEl('circle', { cx: c1.x, cy: c1.y, r: r1, class: 'triangle-arc is-reference', fill: 'none' }));
  dot(svg, p1);

  const t2 = 0.8, r2 = 34;
  const p2 = bezierPoint(t2), dir2 = bezierTangent(t2);
  const n2 = { x: -dir2.y, y: dir2.x };
  const c2 = { x: p2.x - n2.x * r2, y: p2.y - n2.y * r2 };
  svg.appendChild(svgEl('circle', { cx: c2.x, cy: c2.y, r: r2, class: 'triangle-arc is-reference', fill: 'none' }));
  dot(svg, p2);

  placeLabel(figure, { x: p1.x - 4, y: p1.y - 34 }, 'triangle-angle-label', 'large κ');
  placeLabel(figure, { x: p2.x - 10, y: p2.y + 16 }, 'triangle-angle-label', 'small κ');
}

// The TNB frame at a point: T (already-familiar tangent, ink) and the two
// newly-introduced vectors N (accent, in-plane) and B (accent, drawn as the
// conventional "circled dot" for a vector pointing out of the page).
function renderTNB(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);
  const markerId = addArrowMarker(svg);
  const t0 = 0.55;
  const p = bezierPoint(t0);
  const dir = bezierTangent(t0);
  const normal = { x: -dir.y, y: dir.x };
  const tTip = { x: p.x + dir.x * 44, y: p.y + dir.y * 44 };
  const nTip = { x: p.x + normal.x * 38, y: p.y + normal.y * 38 };
  arrow(svg, p, tTip, 'triangle-outline', markerId);
  arrow(svg, p, nTip, 'triangle-arc', markerId);
  const bPos = { x: p.x - dir.x * 8 - normal.x * 26, y: p.y - dir.y * 8 - normal.y * 26 };
  svg.appendChild(svgEl('circle', { cx: bPos.x, cy: bPos.y, r: 7, class: 'triangle-arc', fill: 'none' }));
  svg.appendChild(svgEl('circle', { cx: bPos.x, cy: bPos.y, r: 1.8, class: 'triangle-point' }));
  dot(svg, p);
  placeLabel(figure, { x: tTip.x + 8, y: tTip.y }, 'triangle-point-label', 'T');
  placeLabel(figure, { x: nTip.x, y: nTip.y - 10 }, 'triangle-angle-label', 'N');
  placeLabel(figure, { x: bPos.x, y: bPos.y - 16 }, 'triangle-angle-label', 'B');
}

// A moving particle's path: velocity v(t) (ink -- it's just the tangent, already
// familiar) vs. acceleration a(t) (accent, the newly-introduced vector), drawn
// pointing off the tangent line to show a(t) need not point along the path.
function renderMotion(container) {
  const { figure, svg } = makeFigure(container);
  baseCurve(svg);
  const markerId = addArrowMarker(svg);
  const t0 = 0.5;
  const p = bezierPoint(t0);
  const dir = bezierTangent(t0);
  const vTip = { x: p.x + dir.x * 55, y: p.y + dir.y * 55 };
  arrow(svg, p, vTip, 'triangle-outline', markerId);
  const angle = Math.atan2(dir.y, dir.x) + toRad(55);
  const aDir = { x: Math.cos(angle), y: Math.sin(angle) };
  const aTip = { x: p.x + aDir.x * 42, y: p.y + aDir.y * 42 };
  arrow(svg, p, aTip, 'triangle-arc', markerId);
  dot(svg, p);
  placeLabel(figure, { x: p.x - 10, y: p.y + 14 }, 'triangle-point-label', 'r(t)');
  placeLabel(figure, { x: vTip.x + dir.x * 14, y: vTip.y + dir.y * 14 }, 'triangle-point-label', 'v(t)');
  placeLabel(figure, { x: aTip.x + aDir.x * 16, y: aTip.y + aDir.y * 16 }, 'triangle-angle-label', 'a(t)');
}

const VARIANTS = {
  derivative: renderDerivative,
  tangent: renderTangent,
  corollary: renderCorollary,
  arclength: renderArcLength,
  parameterization: renderParameterization,
  curvature: renderCurvature,
  tnb: renderTNB,
  motion: renderMotion,
};

function renderCurveDiagram(el) {
  const variant = el.getAttribute('variant');
  const fn = VARIANTS[variant];
  if (!fn) { console.error(`<curve-diagram>: unknown variant "${variant}"`); return; }
  const container = document.createElement('div');
  container.className = 'triangle-diagram';
  fn(container);
  el.replaceWith(container);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('curve-diagram').forEach(renderCurveDiagram);
});
