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

// Shared by <triangle build> and <angle-plane build>: `gated` is an array of
// { el, stage } pairs collected while rendering. Adds a button that reveals
// one stage at a time (stage's max is whatever the diagram actually used --
// not a fixed number, since <triangle> needs 3 and <angle-plane> needs 2),
// cycling to "Reset" at the end.
function attachBuildControl(container, gated) {
  const maxStage = gated.reduce((m, g) => Math.max(m, g.stage), 0);
  let stage = 0;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn small triangle-build-btn';
  const applyStage = () => {
    gated.forEach(g => g.el.classList.toggle('triangle-build-pending', g.stage > stage));
    btn.textContent = stage >= maxStage ? '↺ Reset' : 'Build →';
  };
  btn.addEventListener('click', () => {
    stage = stage >= maxStage ? 0 : stage + 1;
    applyStage();
  });
  applyStage();
  container.appendChild(btn);
}

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

  if (buildMode) attachBuildControl(container, gated);

  el.replaceWith(container);
}

// <angle-plane angle="150" point-label="(x,y)" label-a="α = 150°" arc-b="-210" label-b="β = -210°" ray-label="terminal side">
// `point-label` (optional) marks the ray's endpoint, e.g. "(-12, -5)".
// A single ray from the origin at an arbitrary angle (not limited to 0-90°,
// unlike <triangle type="right">), with axes and up to two labeled rotation
// arcs back to the positive x-axis -- for "angle in standard position"
// diagrams that aren't a triangle at all. Reuses renderAxes/placeOverlay from
// the <triangle> implementation above.
//
// `arc-a` (defaults to `angle`) and `arc-b` (optional) are each swept from 0°
// to their own value and drawn at their own radius (arc-b slightly further
// out, so two arcs sharing a ray stay visually distinct rather than
// retracing the same circle) -- for showing two different rotations, e.g. a
// positive and negative coterminal angle, to the *same* terminal ray. Each
// arc's color follows its own sign automatically (blue = positive, red =
// negative, via the `--negative` token), not a hardcoded "a is blue, b is
// red" rule -- so a single-arc diagram with a negative `angle` also renders
// red with no extra attribute.
//
// Intentionally narrow beyond that: one ray, at most two arcs/labels, plus
// an optional ray-tip label. A more general multi-ray version can be built
// later if a lesson needs more than this.
//
// `build` (bare boolean): same staged-reveal mechanism as <triangle build>
// (shared via attachBuildControl below), just with 2 stages instead of 3 --
// stage 1 = the ray/point/arc(s)/angle label(s) ("graph the angle"), stage 2
// = point-label/ray-label ("here's the point we plotted").

// One labeled rotation: sweeps from 0° to `deg`, drawn at `radius`. Sign of
// `deg` drives color (the blue/red positive/negative convention) -- never
// hardcoded per-slot, so it applies the same way to arc-a and arc-b alike.
function buildArc(O, deg, radius) {
  const points = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = toRad((deg * i) / steps);
    points.push({ x: O.x + radius * Math.cos(t), y: O.y - radius * Math.sin(t) });
  }
  const bisectorRad = toRad(deg / 2);
  const labelAt = {
    x: O.x + (radius + 16) * Math.cos(bisectorRad),
    y: O.y - (radius + 16) * Math.sin(bisectorRad),
  };
  return { points, labelAt, isNegative: deg < 0 };
}

// Like buildArc, but swept between two arbitrary absolute angles rather than
// always starting at 0° -- used for <angle-plane drag>'s reference-angle arc,
// which runs from the ray to whichever x-axis it's nearest (not from the
// positive x-axis the way the main rotation arc always is).
function buildArcSpan(O, fromDeg, toDeg, radius) {
  const points = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = toRad(t);
    points.push({ x: O.x + radius * Math.cos(rad), y: O.y - radius * Math.sin(rad) });
  }
  const bisectorRad = toRad((fromDeg + toDeg) / 2);
  const labelAt = {
    x: O.x + (radius + 16) * Math.cos(bisectorRad),
    y: O.y - (radius + 16) * Math.sin(bisectorRad),
  };
  return { points, labelAt };
}

// The reference-angle procedure from Lesson 06, as a pure function: normalize
// to [0,360), then walk toward whichever axis is nearest. Returns null for a
// quadrantal angle (no reference angle), otherwise { value, from, to } -- the
// numeric reference angle plus the absolute-degree span to sweep an arc over.
function referenceAngleDeg(deg) {
  const n = ((deg % 360) + 360) % 360;
  if (n === 0 || n === 90 || n === 180 || n === 270) return null;
  if (n < 90) return { value: n, from: 0, to: n };
  if (n < 180) return { value: 180 - n, from: n, to: 180 };
  if (n < 270) return { value: n - 180, from: 180, to: n };
  return { value: 360 - n, from: n, to: 360 };
}

const ANGLE_ARC_R = 34; // main rotation-arc radius, shared by layoutAnglePlane and <angle-plane drag>'s live redraw
const ANGLE_REF_ARC_R = 22; // reference-angle arc radius -- drawn inside the main arc so the two never coincide on-screen

function layoutAnglePlane(el) {
  const angleDeg = parseFloat(el.getAttribute('angle') || '0');
  const arcADeg = parseFloat(el.getAttribute('arc-a') || angleDeg);
  const arcBDeg = el.hasAttribute('arc-b') ? parseFloat(el.getAttribute('arc-b')) : null;
  const R = 95, ARC_R = ANGLE_ARC_R, AXIS_OVERSHOOT = 25;
  const size = R + AXIS_OVERSHOOT;
  const W = size * 2, H = size * 2;
  const O = { x: size, y: size };
  const rad = toRad(angleDeg);
  const dir = { x: Math.cos(rad), y: -Math.sin(rad) }; // unit vector along the ray, in SVG space
  const perp = { x: -dir.y, y: dir.x };
  const tip = { x: O.x + R * dir.x, y: O.y + R * dir.y };

  return {
    viewBox: `0 0 ${W} ${H}`, W, H, O, R,
    tip,
    pointLabel: el.getAttribute('point-label'),
    // Offset outward along the ray (away from the origin, past the dot) plus
    // a small perpendicular nudge -- a fixed screen-space offset would
    // overlap the ray whenever it points down/left instead of up/right.
    pointLabelAt: { x: tip.x + dir.x * 16 + perp.x * 11, y: tip.y + dir.y * 16 + perp.y * 11 },
    arcA: buildArc(O, arcADeg, ARC_R),
    labelA: el.getAttribute('label-a'),
    arcB: arcBDeg === null ? null : buildArc(O, arcBDeg, ARC_R + 12),
    labelB: el.getAttribute('label-b'),
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
  const { O, tip, pointLabel, pointLabelAt, arcA, labelA, arcB, labelB, rayLabel, rayLabelAt, axes, viewBox, W, H } = layout;

  // `drag` (bare boolean): the ray endpoint becomes a draggable handle (same
  // Pointer Events idiom as <sign-circle>) instead of a fixed diagram -- for
  // Lesson 06 Example 1, where the point *is* the exercise ("estimate theta,
  // then find its reference angle") rather than something to reveal an
  // answer for. Mutually exclusive with `build`: there's nothing to stage
  // toward once the diagram is already interactive.
  const dragMode = el.hasAttribute('drag');
  const buildMode = !dragMode && el.hasAttribute('build');
  const gated = []; // { el, stage } -- only consulted when buildMode is true
  const gate = (node, stage) => { if (buildMode) gated.push({ el: node, stage }); return node; };

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

  renderAxes(svg, figure, axes, W, H); // stage 0: the coordinate plane itself, always shown

  const arcAPoly = document.createElementNS(SVG_NS, 'polyline');
  arcAPoly.setAttribute('points', arcA.points.map(p => `${p.x},${p.y}`).join(' '));
  arcAPoly.setAttribute('class', `triangle-arc${arcA.isNegative ? ' is-negative' : ''}`);
  svg.appendChild(arcAPoly);
  gate(arcAPoly, 1);

  if (arcB) {
    const arcBPoly = document.createElementNS(SVG_NS, 'polyline');
    arcBPoly.setAttribute('points', arcB.points.map(p => `${p.x},${p.y}`).join(' '));
    arcBPoly.setAttribute('class', `triangle-arc${arcB.isNegative ? ' is-negative' : ''}`);
    svg.appendChild(arcBPoly);
    gate(arcBPoly, 1);
  }

  // Reference-angle arc + label exist only in drag mode -- update() below
  // keeps both live as the ray moves; buildArcSpan gives the arc no points
  // yet, so nothing is visible until the first update() call at the bottom.
  let refArcPoly = null, refLabelNode = null;
  if (dragMode) {
    refArcPoly = document.createElementNS(SVG_NS, 'polyline');
    refArcPoly.setAttribute('class', 'triangle-arc is-reference');
    svg.appendChild(refArcPoly);
    refLabelNode = placeOverlay(figure, arcA.labelAt, W, H, 'triangle-angle-label is-reference', '');
  }

  const ray = document.createElementNS(SVG_NS, 'line');
  ray.setAttribute('x1', O.x);
  ray.setAttribute('y1', O.y);
  ray.setAttribute('x2', tip.x);
  ray.setAttribute('y2', tip.y);
  ray.setAttribute('class', 'triangle-outline');
  svg.appendChild(ray);
  gate(ray, 1);

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', tip.x);
  dot.setAttribute('cy', tip.y);
  dot.setAttribute('r', dragMode ? 9 : 3.5);
  dot.setAttribute('class', dragMode ? 'triangle-point sign-circle-handle' : 'triangle-point');
  svg.appendChild(dot);
  gate(dot, 1);

  let pointLabelNode = null;
  if (pointLabel) {
    pointLabelNode = gate(placeOverlay(figure, pointLabelAt, W, H, 'triangle-point-label', pointLabel), 2);
  }

  // In drag mode, label-a is always shown (default "θ") as a live readout --
  // its author-supplied text (if any) is unused as static content, since the
  // whole point is that the number changes as the point is dragged.
  let labelANode = null;
  if (labelA && !dragMode) {
    const cls = `triangle-angle-label${arcA.isNegative ? ' is-negative' : ''}`;
    labelANode = gate(placeOverlay(figure, arcA.labelAt, W, H, cls, labelA), 1);
  } else if (dragMode) {
    labelANode = placeOverlay(figure, arcA.labelAt, W, H, 'triangle-angle-label', '');
  }
  if (labelB && arcB) {
    const cls = `triangle-angle-label${arcB.isNegative ? ' is-negative' : ''}`;
    gate(placeOverlay(figure, arcB.labelAt, W, H, cls, labelB), 1);
  }
  let rayLabelNode = null;
  if (rayLabel) rayLabelNode = gate(placeOverlay(figure, rayLabelAt, W, H, 'triangle-point-label', rayLabel), 2);

  if (buildMode) attachBuildControl(container, gated);

  if (dragMode) {
    const thetaPrefix = labelA || 'θ';

    function update(angleDeg) {
      const rad = toRad(angleDeg);
      const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
      const perp = { x: -dir.y, y: dir.x };
      const newTip = { x: O.x + layout.R * dir.x, y: O.y + layout.R * dir.y };

      ray.setAttribute('x2', newTip.x);
      ray.setAttribute('y2', newTip.y);
      dot.setAttribute('cx', newTip.x);
      dot.setAttribute('cy', newTip.y);

      const arc = buildArc(O, angleDeg, ANGLE_ARC_R);
      arcAPoly.setAttribute('points', arc.points.map(p => `${p.x},${p.y}`).join(' '));
      arcAPoly.classList.toggle('is-negative', arc.isNegative);

      labelANode.textContent = `${thetaPrefix} ≈ ${Math.round(angleDeg)}°`;
      labelANode.style.left = `${(arc.labelAt.x / W) * 100}%`;
      labelANode.style.top = `${(arc.labelAt.y / H) * 100}%`;
      labelANode.classList.toggle('is-negative', arc.isNegative);

      const ref = referenceAngleDeg(angleDeg);
      if (ref) {
        const refArc = buildArcSpan(O, ref.from, ref.to, ANGLE_REF_ARC_R);
        refArcPoly.setAttribute('points', refArc.points.map(p => `${p.x},${p.y}`).join(' '));
        refLabelNode.textContent = `θr ≈ ${Math.round(ref.value)}°`;
        refLabelNode.style.left = `${(refArc.labelAt.x / W) * 100}%`;
        refLabelNode.style.top = `${(refArc.labelAt.y / H) * 100}%`;
      } else {
        // Quadrantal angle -- no reference arc to bisect, so park the label
        // at a fixed spot near the origin rather than wherever the last real
        // arc happened to place it (which could land right under theta's
        // own label).
        refArcPoly.setAttribute('points', '');
        refLabelNode.textContent = 'θr: none (quadrantal)';
        refLabelNode.style.left = `${((O.x + 42) / W) * 100}%`;
        refLabelNode.style.top = `${((O.y + 20) / H) * 100}%`;
      }

      if (pointLabelNode) {
        const at = { x: newTip.x + dir.x * 16 + perp.x * 11, y: newTip.y + dir.y * 16 + perp.y * 11 };
        pointLabelNode.style.left = `${(at.x / W) * 100}%`;
        pointLabelNode.style.top = `${(at.y / H) * 100}%`;
      }
      if (rayLabelNode) {
        const at = { x: O.x + (layout.R + 14) * dir.x, y: O.y - (layout.R + 14) * Math.sin(rad) - 10 };
        rayLabelNode.style.left = `${(at.x / W) * 100}%`;
        rayLabelNode.style.top = `${(at.y / H) * 100}%`;
      }
    }

    function angleFromEvent(e) {
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      return (Math.atan2(-(p.y - O.y), p.x - O.x) * 180) / Math.PI;
    }

    let dragging = false;
    dot.addEventListener('pointerdown', (e) => {
      dragging = true;
      dot.setPointerCapture(e.pointerId);
      dot.classList.add('is-dragging');
      update(angleFromEvent(e));
      e.preventDefault();
    });
    dot.addEventListener('pointermove', (e) => { if (dragging) update(angleFromEvent(e)); });
    ['pointerup', 'pointercancel'].forEach(evt => dot.addEventListener(evt, () => {
      dragging = false;
      dot.classList.remove('is-dragging');
    }));

    update(parseFloat(el.getAttribute('angle') || '0'));
  }

  el.replaceWith(container);
}

// <sign-circle radius="2" start-angle="35">
// A point draggable around a circle (plain Pointer Events, no library --
// setPointerCapture on the handle keeps drag events targeting it even if the
// pointer outruns it mid-drag, and unifies mouse/touch/pen for free). Built
// for live lecture use: the instructor drags it in front of the class and
// narrates the x/y sign flip by quadrant *before* naming the ASTC mnemonic --
// not a student-facing exercise, so there's no reveal/build gating here, just
// a live x = ⟨value⟩ / y = ⟨value⟩ readout, colored via the same
// blue-positive/red-negative convention as <angle-plane>'s arcs.
//
// `radius` is a semantic value (what x/y are computed and displayed as,
// e.g. 2 → range [-2, 2]), independent of the diagram's fixed on-screen pixel
// size -- so the picture always reads clearly regardless of what radius is
// authored. Reuses renderAxes/placeOverlay from <triangle> above.

function toSvgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return pt.matrixTransform(ctm.inverse());
}

function renderSignCircle(el) {
  const radius = parseFloat(el.getAttribute('radius') || '2');
  const startAngle = parseFloat(el.getAttribute('start-angle') || '35');
  const PIXEL_R = 90, AXIS_OVERSHOOT = 25;
  const size = PIXEL_R + AXIS_OVERSHOOT;
  const W = size * 2, H = size * 2;
  const O = { x: size, y: size };

  const container = document.createElement('div');
  container.className = 'triangle-diagram';

  const figure = document.createElement('div');
  figure.className = 'triangle-diagram-figure';
  figure.style.setProperty('--triangle-aspect', `${W} / ${H}`);
  container.appendChild(figure);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'triangle-diagram-svg');
  figure.appendChild(svg);

  renderAxes(svg, figure, {
    xStart: { x: 0, y: O.y }, xEnd: { x: W, y: O.y },
    yStart: { x: O.x, y: H }, yEnd: { x: O.x, y: 0 },
  }, W, H);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', O.x);
  circle.setAttribute('cy', O.y);
  circle.setAttribute('r', PIXEL_R);
  circle.setAttribute('class', 'sign-circle-path');
  svg.appendChild(circle);

  const guideX = document.createElementNS(SVG_NS, 'line');
  guideX.setAttribute('class', 'sign-circle-guide');
  svg.appendChild(guideX);
  const guideY = document.createElementNS(SVG_NS, 'line');
  guideY.setAttribute('class', 'sign-circle-guide');
  svg.appendChild(guideY);

  const ARC_R = 26;
  const arc = document.createElementNS(SVG_NS, 'polyline');
  arc.setAttribute('class', 'triangle-arc');
  svg.appendChild(arc);

  const radiusLine = document.createElementNS(SVG_NS, 'line');
  radiusLine.setAttribute('x1', O.x);
  radiusLine.setAttribute('y1', O.y);
  radiusLine.setAttribute('class', 'sign-circle-radius');
  svg.appendChild(radiusLine);

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', 9);
  dot.setAttribute('class', 'sign-circle-handle');
  svg.appendChild(dot);

  const xLabel = placeOverlay(figure, { x: size * 0.32, y: H - 30 }, W, H, 'sign-circle-value', 'x = 0');
  const yLabel = placeOverlay(figure, { x: size * 0.32, y: H - 12 }, W, H, 'sign-circle-value', 'y = 0');

  function update(angleDeg) {
    const rad = toRad(angleDeg);
    const px = O.x + PIXEL_R * Math.cos(rad);
    const py = O.y - PIXEL_R * Math.sin(rad);
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', py);
    radiusLine.setAttribute('x2', px); radiusLine.setAttribute('y2', py);
    // Always swept as a positive (counterclockwise) rotation from the
    // positive x-axis -- this demo is about the sign of x/y by quadrant, not
    // about signed/coterminal angles (that's <angle-plane>'s job), so the arc
    // itself stays blue no matter which way the point was dragged.
    const arcDeg = ((angleDeg % 360) + 360) % 360;
    arc.setAttribute('points', buildArc(O, arcDeg, ARC_R).points.map(p => `${p.x},${p.y}`).join(' '));
    guideX.setAttribute('x1', px); guideX.setAttribute('y1', py);
    guideX.setAttribute('x2', px); guideX.setAttribute('y2', O.y);
    guideY.setAttribute('x1', px); guideY.setAttribute('y1', py);
    guideY.setAttribute('x2', O.x); guideY.setAttribute('y2', py);

    const xVal = round(radius * Math.cos(rad));
    const yVal = round(radius * Math.sin(rad));
    xLabel.textContent = `x = ${xVal}`;
    yLabel.textContent = `y = ${yVal}`;
    xLabel.classList.toggle('is-negative', xVal < 0);
    yLabel.classList.toggle('is-negative', yVal < 0);
  }

  function angleFromEvent(e) {
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    return (Math.atan2(-(p.y - O.y), p.x - O.x) * 180) / Math.PI;
  }

  let dragging = false;
  dot.addEventListener('pointerdown', (e) => {
    dragging = true;
    dot.setPointerCapture(e.pointerId);
    dot.classList.add('is-dragging');
    update(angleFromEvent(e));
    e.preventDefault();
  });
  dot.addEventListener('pointermove', (e) => { if (dragging) update(angleFromEvent(e)); });
  ['pointerup', 'pointercancel'].forEach(evt => dot.addEventListener(evt, () => {
    dragging = false;
    dot.classList.remove('is-dragging');
  }));

  update(startAngle);
  el.replaceWith(container);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('triangle').forEach(renderTriangle);
  document.querySelectorAll('angle-plane').forEach(renderAnglePlane);
  document.querySelectorAll('sign-circle').forEach(renderSignCircle);
});
