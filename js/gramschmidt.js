// <gram-schmidt v1="3,1" v2="2,3" [v3="..."] drag matrices az el>
//
// The Gram-Schmidt process and QR factorization (Linear Algebra 5.2) as a staged picture, in the order of the
// textbook's Figures 1 to 4. Plain canvas, no library (same approach as <coord-3d> / <solid-3d>).
//
// Vectors are given as comma-separated components, 2 of them (a plane picture) or 3 (a 3D picture, drag to rotate),
// and there may be 1 to 3 vectors. Next / Back steps through the process:
//   first vector:   u1 = v1 / ||v1||                                (Figure 1)
//   each later one: split v_j into its part in span(u1..u_{j-1}) and the perpendicular part (the right-angle mark),
//                   slide the perpendicular part to the origin, then divide by its length    (Figures 2, 3, 4)
// Colors: grey = given v_j, orange = the parallel part, red = the perpendicular part, blue = the new unit vector u_j.
// `matrices` adds M = Q R underneath, filled in entry by entry as the stages reach it (r_ij = u_i . v_j, r_jj = ||v_j-perp||).
// `drag` (2D only) makes the tips of the given vectors draggable so the whole picture, and R, update live.
// Attributes: v1, v2, v3; drag; matrices; az, el (3D view, degrees); range (half-width of the picture).

const BLUE = '#0f6ab4';
const RED = '#c0392b';
const ORANGE = '#e07b00';
const GREY = '#4a5058';

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, c) => a.map((x) => x * c);
const norm = (a) => Math.sqrt(dot(a, a));

function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
function num(v) {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-7) {
      const g = gcd(n, d);
      return (d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`).replace('-', '−');
    }
  }
  return String(Math.round(v * 1000) / 1000).replace('-', '−');
}
const vec = (a) => `(${a.map(num).join(', ')})`;
const sub1 = ['₁', '₂', '₃'];

function parseVec(el, name) {
  const raw = el.getAttribute(name);
  if (raw === null) return null;
  const v = raw.split(',').map((t) => Number(t.trim()));
  if (v.length < 2 || v.length > 3 || v.some((x) => !Number.isFinite(x))) {
    console.error(`<gram-schmidt>: could not parse ${name}="${raw}" (give 2 or 3 numbers)`);
    return null;
  }
  return v;
}

// Gram-Schmidt on the columns, recording everything the pictures need.
function process(vs) {
  const n = vs.length;
  const us = []; const par = []; const perp = [];
  const r = Array.from({ length: n }, () => Array(n).fill(0));
  let ok = true;
  for (let j = 0; j < n && ok; j++) {
    let p = vs[j].map(() => 0);
    for (let i = 0; i < j; i++) { r[i][j] = dot(us[i], vs[j]); p = add(p, mul(us[i], r[i][j])); }
    const q = sub(vs[j], p);
    const len = norm(q);
    if (len < 1e-9) { ok = false; break; }
    r[j][j] = len; par.push(p); perp.push(q); us.push(mul(q, 1 / len));
  }
  return { us, par, perp, r, ok, done: us.length };
}

function renderGramSchmidt(el) {
  const vs = [1, 2, 3].map((k) => parseVec(el, `v${k}`)).filter(Boolean);
  if (vs.length < 1 || vs.some((v) => v.length !== vs[0].length)) {
    console.error('<gram-schmidt>: give v1, v2 (and v3) with the same number of components (2 or 3)');
    return;
  }
  const dim = vs[0].length; const m = vs.length;
  if (m > dim) { console.error('<gram-schmidt>: more vectors than dimensions'); return; }
  const wantDrag = el.hasAttribute('drag') && dim === 2;
  const showMats = el.hasAttribute('matrices');
  const maxAbs = Math.max(...vs.flat().map(Math.abs), 1);
  const ext = el.hasAttribute('range') ? Number(el.getAttribute('range')) : Math.max(3, maxAbs * 1.05);
  const state = {
    stage: 0,
    az: (Number(el.getAttribute('az') || 35) * Math.PI) / 180,
    el: (Number(el.getAttribute('el') || 22) * Math.PI) / 180,
  };

  // stages: 0 = the given vectors; then u1; then split, move, normalize for each later vector
  const stages = [{ k: 'given', j: -1 }, { k: 'u', j: 0 }];
  for (let j = 1; j < m; j++) stages.push({ k: 'split', j }, { k: 'move', j }, { k: 'u', j });

  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram gs-diagram';
  const readout = document.createElement('div');
  readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas gs-canvas';
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = dim === 3 ? 'Drag the picture to rotate it.' : (wantDrag ? 'Drag the tips of v to change the vectors.' : '');
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  const mats = document.createElement('div');
  mats.className = 'gs-mats';
  wrap.append(readout, canvas, hint, controls);
  if (showMats) wrap.appendChild(mats);
  el.replaceWith(wrap);

  const mkBtn = (label, on) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = label;
    b.addEventListener('pointerup', () => b.blur());
    b.addEventListener('click', on);
    controls.appendChild(b);
    return b;
  };
  const back = mkBtn('◀ Back', () => { state.stage = Math.max(0, state.stage - 1); refresh(); });
  const next = mkBtn('Next ▶', () => { state.stage = Math.min(stages.length - 1, state.stage + 1); refresh(); });
  mkBtn('Reset', () => { state.stage = 0; refresh(); });

  // ---- projection ----
  let W = 1; let H = 1;
  function P(v) {
    const s = Math.min(W, H) * 0.46 / ext;
    if (dim === 2) return [W / 2 + v[0] * s, H / 2 - v[1] * s];
    const ca = Math.cos(state.az); const sa = Math.sin(state.az);
    const ce = Math.cos(state.el); const se = Math.sin(state.el);
    const u = v[0] * ca - v[1] * sa;
    const w = v[0] * sa + v[1] * ca;
    return [W / 2 + u * s, H / 2 - (v[2] * ce + w * se) * s];
  }

  function arrow(ctx, a, b, color, width, dash) {
    const p = P(a); const q = P(b);
    const dx = q[0] - p[0]; const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0] - (dx / len) * 9, q[1] - (dy / len) * 9); ctx.stroke();
    ctx.setLineDash([]);
    const ux = dx / len; const uy = dy / len;
    ctx.beginPath(); ctx.moveTo(q[0], q[1]);
    ctx.lineTo(q[0] - ux * 17 + uy * 7, q[1] - uy * 17 - ux * 7);
    ctx.lineTo(q[0] - ux * 17 - uy * 7, q[1] - uy * 17 + ux * 7);
    ctx.closePath(); ctx.fill();
  }
  function seg(ctx, a, b, color, width, dash) {
    const p = P(a); const q = P(b);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
  }
  function label(ctx, at, text, color, dx = 10, dy = -10) {
    const p = P(at);
    ctx.fillStyle = color; ctx.font = '700 24px system-ui, sans-serif'; ctx.fillText(text, p[0] + dx, p[1] + dy);
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth; const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cw; H = ch;
    ctx.clearRect(0, 0, W, H);
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#151515';
    const zero = Array(dim).fill(0);
    const e = (k, c = ext) => zero.map((_, i) => (i === k ? c : 0));
    // axes
    ['x', 'y', 'z'].slice(0, dim).forEach((nm, k) => {
      seg(ctx, mul(e(k), -1), e(k), '#b9bec6', 2);
      label(ctx, e(k), nm, '#8b919a', 6, 4);
    });

    const g = process(vs);
    const st = stages[state.stage];
    const j = st.j;
    // span of the earlier u's: a line (one vector) or a patch (two vectors)
    if (st.k === 'split' || st.k === 'move') {
      if (j === 1 && dim === 3) seg(ctx, mul(g.us[0], -ext), mul(g.us[0], ext), BLUE, 2, [8, 6]);
      if (j === 1 && dim === 2) seg(ctx, mul(g.us[0], -ext * 1.3), mul(g.us[0], ext * 1.3), BLUE, 2, [8, 6]);
      if (j === 2) {
        const a = mul(g.us[0], ext * 0.9); const b = mul(g.us[1], ext * 0.9);
        const pts = [add(a, b), sub(a, b), sub(mul(a, -1), b), add(mul(a, -1), b)].map(P);
        ctx.fillStyle = 'rgba(15,106,180,0.13)'; ctx.strokeStyle = 'rgba(15,106,180,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // given vectors (muted once they have been used)
    vs.forEach((v, i) => {
      const used = stages.findIndex((s) => s.k === 'u' && s.j === i) <= state.stage;
      arrow(ctx, zero, v, used ? '#b3b8c0' : GREY, used ? 3 : 4.5, used ? [10, 6] : null);
      label(ctx, v, `v${sub1[i]}`, used ? '#9aa0a8' : GREY);
    });
    // finished u's
    for (let i = 0; i < m; i++) {
      if (stages.findIndex((s) => s.k === 'u' && s.j === i) <= state.stage && i < g.done) {
        arrow(ctx, zero, g.us[i], BLUE, 5);
        label(ctx, g.us[i], `u${sub1[i]}`, BLUE, -6, -14);
      }
    }
    // the current split
    if (j >= 1 && j < g.done && (st.k === 'split' || st.k === 'move')) {
      const par = g.par[j]; const perp = g.perp[j];
      if (st.k === 'split') {
        arrow(ctx, zero, par, ORANGE, 4.5);
        label(ctx, mul(par, 0.5), `v${sub1[j]}∥`, ORANGE, 8, 26);
        arrow(ctx, par, vs[j], RED, 4.5);
        label(ctx, add(par, mul(perp, 0.5)), `v${sub1[j]}⊥`, RED, 10, 4);
        const s = 0.1 * ext;
        const a = norm(par) > 1e-9 ? mul(par, -1 / norm(par)) : g.us[0];
        const b = mul(perp, 1 / norm(perp));
        const pts = [add(par, mul(a, s)), add(add(par, mul(a, s)), mul(b, s)), add(par, mul(b, s))].map(P);
        ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
      } else {
        seg(ctx, par, vs[j], '#d9a7a0', 2, [6, 6]);
        arrow(ctx, zero, perp, RED, 5);
        label(ctx, perp, `v${sub1[j]}⊥`, RED);
        const s = 0.1 * ext; const b = mul(perp, 1 / norm(perp));
        const a = g.us[0];
        const pts = [mul(a, s), add(mul(a, s), mul(b, s)), mul(b, s)].map(P);
        ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
      }
    }
    // the perpendicular part, once normalized
    if (st.k === 'u' && j >= 1 && j < g.done) {
      arrow(ctx, zero, g.perp[j], 'rgba(192,57,43,0.55)', 3);
      label(ctx, g.perp[j], `v${sub1[j]}⊥`, 'rgba(192,57,43,0.8)');
    }
    // origin dot, drag handles
    const o = P(zero); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(o[0], o[1], 5, 0, 7); ctx.fill();
    if (wantDrag && state.stage === 0) {
      vs.forEach((v) => { const p = P(v); ctx.strokeStyle = GREY; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, 7); ctx.fill(); ctx.stroke(); });
    }
  }

  function known() {
    // which entries of Q and R the stages reached so far
    const q = Array(m).fill(false); const r = Array.from({ length: m }, () => Array(m).fill(false));
    stages.slice(0, state.stage + 1).forEach((s) => {
      if (s.k === 'u') { q[s.j] = true; r[s.j][s.j] = true; }
      if (s.k === 'split') for (let i = 0; i < s.j; i++) r[i][s.j] = true;
    });
    return { q, r };
  }

  function updateReadout() {
    const g = process(vs);
    const st = stages[state.stage];
    const j = st.j; const chips = [];
    const nm = (k) => `v${sub1[k]}`;
    if (!g.ok) chips.push(`<span class="riemann-chip is-close" style="border-color:${RED};background:#fdecea">the vectors are dependent: ${g.done + 1 > m ? '' : 'v' + sub1[g.done] + ' lies in the span of the earlier ones'}</span>`);
    else if (st.k === 'given') chips.push('<span class="riemann-chip riemann-main">a basis v₁' + (m > 1 ? ', …, v' + sub1[m - 1] : '') + '</span>');
    else if (st.k === 'u') {
      const len = g.r[j][j];
      chips.push(j === 0
        ? `<span class="riemann-chip riemann-main">r₁₁ = ‖v₁‖ = <b>${num(len)}</b></span><span class="riemann-chip">u₁ = v₁ / r₁₁ = <b>${vec(g.us[0])}</b></span>`
        : `<span class="riemann-chip riemann-main">r${sub1[j]}${sub1[j]} = ‖${nm(j)}⊥‖ = <b>${num(len)}</b></span><span class="riemann-chip">u${sub1[j]} = ${nm(j)}⊥ / r${sub1[j]}${sub1[j]} = <b>${vec(g.us[j])}</b></span>`);
    } else if (st.k === 'split') {
      const rs = Array.from({ length: j }, (_, i) => `r${sub1[i]}${sub1[j]} = u${sub1[i]}·${nm(j)} = <b>${num(g.r[i][j])}</b>`).join(',  ');
      chips.push(`<span class="riemann-chip riemann-main">${rs}</span><span class="riemann-chip">${nm(j)}∥ = ${vec(g.par[j])}</span>`);
    } else chips.push(`<span class="riemann-chip riemann-main">${nm(j)}⊥ = ${nm(j)} − ${nm(j)}∥ = <b>${vec(g.perp[j])}</b></span>`);
    readout.innerHTML = chips.join('');
    back.disabled = state.stage === 0; next.disabled = state.stage === stages.length - 1;
  }

  function updateMats() {
    if (!showMats) return;
    const g = process(vs); const k = known();
    const cell = (txt, on) => `<td class="${on ? 'is-known' : ''}">${on ? txt : '·'}</td>`;
    const table = (rows) => `<table class="gs-mat">${rows.map((r) => `<tr>${r}</tr>`).join('')}</table>`;
    const M = table(Array.from({ length: dim }, (_, i) => vs.map((v) => `<td class="is-known">${num(v[i])}</td>`).join('')));
    const Q = table(Array.from({ length: dim }, (_, i) => vs.map((_, c) => cell(g.ok || c < g.done ? num(g.us[c] ? g.us[c][i] : NaN) : '?', k.q[c] && c < g.done)).join('')));
    const R = table(Array.from({ length: m }, (_, i) => vs.map((_, c) => (c < i ? '<td class="gs-zero">0</td>' : cell(c < g.done ? num(g.r[i][c]) : '?', k.r[i][c] && c < g.done))).join('')));
    mats.innerHTML = `<div><div class="gs-cap">M</div>${M}</div><div class="gs-eq">=</div><div><div class="gs-cap">Q</div>${Q}</div><div><div class="gs-cap">R</div>${R}</div>`;
  }

  function refresh() { updateReadout(); updateMats(); draw(); }

  // ---- pointer: drag a tip (2D) or rotate (3D) ----
  canvas.style.touchAction = 'none';
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rc = canvas.getBoundingClientRect(); const x = e.clientX - rc.left; const y = e.clientY - rc.top;
    if (wantDrag && state.stage === 0) {
      const hit = vs.findIndex((v) => { const p = P(v); return Math.hypot(p[0] - x, p[1] - y) < 22; });
      if (hit >= 0) { canvas.setPointerCapture(e.pointerId); drag = { tip: hit }; return; }
    }
    if (dim === 3) { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el }; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.tip !== undefined) {
      const rc = canvas.getBoundingClientRect(); const s = Math.min(W, H) * 0.46 / ext;
      const wx = ((e.clientX - rc.left) - W / 2) / s; const wy = -((e.clientY - rc.top) - H / 2) / s;
      const snap = (t) => Math.max(-ext * 0.95, Math.min(ext * 0.95, Math.round(t * 2) / 2));
      vs[drag.tip] = [snap(wx), snap(wy)];
      refresh();
    } else {
      state.az = drag.az - (e.clientX - drag.x) * 0.008;
      state.el = Math.max(-1.45, Math.min(1.45, drag.el + (e.clientY - drag.y) * 0.006));
      draw();
    }
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  new ResizeObserver(draw).observe(canvas);
  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('gram-schmidt').forEach(renderGramSchmidt);
});
