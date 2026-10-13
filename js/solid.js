// <solid-3d axes="xyz" xmin="0" xmax="1" g1="0" g2="1-x" u1="0" u2="1-x-y" f="5*x-3*y" sweep="z">
//
// Triple integrals (calculus3 "Triple Integrals", OpenStax 5.4). A canvas 3D picture of a solid E,
// with three instructor-driven modes that can be combined with the shape attributes:
//   cells   E is cut into l x m x n small boxes dV; the triple Riemann sum of f is compared with
//           the exact integral (the definition, Eq. 5.10).
//   sweep   a plane x, y or z = t slides through E. The cross-section is shaded and the readout
//           gives A(t) = the integral of f over the slice, plus the amount collected so far, so
//           "triple integral = single integral of the slice integrals" is something you watch.
//   column  a vertical (or any-direction) pillar over a point (a, b) of the projection D: the
//           inner integral over h, from u1(a,b) to u2(a,b), which Theorem 5.10 then integrates over D.
// Plain canvas + Pointer Events, no library, same approach as <riemann-boxes> (js/riemann.js).
//
// Shape (a general "Type I" solid, written in the real variable names):
//   axes   three letters, e.g. "xyz" (default). The first two name the projection D, the third is the
//          variable that runs between the surfaces. "xzy" projects onto the xz-plane and runs in y.
//   <A>min, <A>max   range of the first variable (xmin/xmax when axes starts with x).
//   g1, g2           limits of the second variable, expressions in the first one.
//   u1, u2           limits of the third variable, expressions in the first two.
//   f                integrand in x, y, z (default 1, so the integral is the volume).
//   sin cos tan exp sqrt abs log pow min max cbrt pi are in scope (same convention as <riemann-boxes>).
// Modes and controls:
//   grid="3,3,3"     enable cells with the starting l,m,n.   sliders / square / play / max="12"
//   sweep="x|y|z"    enable the sweeping plane, starting on that axis.   axis-buttons   play
//   column           enable the pillar and its two sliders.
//   avg              also show V(E) and the average value of f.
//   az, el           starting view angles in degrees (default 35 and 24).   tall: a taller canvas.
//   no-surface       don't draw the translucent boundary of E.

const SCOPE = 'const {sin,cos,tan,exp,sqrt,abs,log,pow,min,max,cbrt,PI:pi}=Math;';
const AXIS_NAME = ['x', 'y', 'z'];

function compile(args, expr, attr) {
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    return new Function(...args, `${SCOPE} return (${expr});`);
  } catch (err) {
    console.error(`<solid-3d>: could not parse ${attr}="${expr}"`, err);
    return null;
  }
}

function numAttr(el, name, dflt) {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') return dflt;
  try {
    // eslint-disable-next-line no-new-func
    const v = new Function('pi', `return (${raw});`)(Math.PI);
    return Number.isFinite(v) ? v : dflt;
  } catch (err) {
    console.error(`<solid-3d>: could not parse ${name}="${raw}"`, err);
    return dflt;
  }
}

// four significant digits, trailing zeros dropped, proper minus sign.
const fmt = (v) => {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  const r = Number(v.toPrecision(4));
  return (Object.is(r, -0) || r === 0 ? 0 : r).toString().replace('-', '−');
};

function renderSolid(el) {
  const axes = (el.getAttribute('axes') || 'xyz').trim();
  if (!/^[xyz]{3}$/.test(axes) || new Set(axes).size !== 3) {
    console.error(`<solid-3d>: axes="${axes}" must be a permutation of x, y, z`);
    return;
  }
  const [LA, LB, LH] = axes;
  const [ia, ib, ih] = [...axes].map((ch) => AXIS_NAME.indexOf(ch));

  const fAttr = (el.getAttribute('f') || '1').trim();
  const unitF = fAttr === '1';
  const f = compile(['x', 'y', 'z'], fAttr, 'f');
  const g1 = compile([LA], el.getAttribute('g1'), 'g1');
  const g2 = compile([LA], el.getAttribute('g2'), 'g2');
  const u1 = compile([LA, LB], el.getAttribute('u1'), 'u1');
  const u2 = compile([LA, LB], el.getAttribute('u2'), 'u2');
  if (!f || !g1 || !g2 || !u1 || !u2) {
    console.error('<solid-3d>: needs g1, g2, u1, u2 (and a parseable f)');
    return;
  }
  const a0 = numAttr(el, `${LA}min`, 0);
  const a1 = numAttr(el, `${LA}max`, 1);

  const P = (a, b, h) => { const p = [0, 0, 0]; p[ia] = a; p[ib] = b; p[ih] = h; return p; };
  const inside = (p) => {
    const a = p[ia]; const b = p[ib]; const h = p[ih];
    if (!(a >= a0 && a <= a1)) return false;
    if (!(b >= g1(a) && b <= g2(a))) return false;
    return h >= u1(a, b) && h <= u2(a, b);
  };

  // bounding box in real x, y, z
  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  lo[ia] = a0; hi[ia] = a1;
  {
    let bl = Infinity; let bh = -Infinity; let hl = Infinity; let hh = -Infinity;
    for (let i = 0; i <= 40; i++) {
      const a = a0 + ((a1 - a0) * i) / 40;
      const l = g1(a); const r = g2(a);
      if (!Number.isFinite(l) || !Number.isFinite(r)) continue;
      bl = Math.min(bl, l); bh = Math.max(bh, r);
      for (let j = 0; j <= 24; j++) {
        const b = l + ((r - l) * j) / 24;
        const v1 = u1(a, b); const v2 = u2(a, b);
        if (Number.isFinite(v1)) hl = Math.min(hl, v1);
        if (Number.isFinite(v2)) hh = Math.max(hh, v2);
      }
    }
    lo[ib] = bl; hi[ib] = bh; lo[ih] = hl; hi[ih] = hh;
  }
  if (![...lo, ...hi].every(Number.isFinite)) {
    console.error('<solid-3d>: the limits did not evaluate to numbers over the given range');
    return;
  }

  // exact values: iterated midpoint sums using the true limits (fast, and no boundary error).
  function iterate(useF) {
    const NA = 240; const NB = 100; const NH = 40;
    const da = (a1 - a0) / NA;
    let sum = 0;
    const p = [0, 0, 0];
    for (let i = 0; i < NA; i++) {
      const a = a0 + (i + 0.5) * da;
      const l = g1(a); const r = g2(a);
      const db = (r - l) / NB;
      for (let j = 0; j < NB; j++) {
        const b = l + (j + 0.5) * db;
        const h0 = u1(a, b); const h1 = u2(a, b);
        if (!(h1 > h0)) continue;
        let inner;
        if (useF) {
          const dh = (h1 - h0) / NH;
          inner = 0;
          p[ia] = a; p[ib] = b;
          for (let k = 0; k < NH; k++) { p[ih] = h0 + (k + 0.5) * dh; inner += f(p[0], p[1], p[2]); }
          inner *= dh;
        } else inner = h1 - h0;
        sum += inner * db * da;
      }
    }
    return sum;
  }
  const volume = iterate(false);
  const exact = unitF ? volume : iterate(true);

  const sweepAttr = el.getAttribute('sweep');
  const hasSweep = sweepAttr !== null;
  const hasCells = el.hasAttribute('grid');
  const hasColumn = el.hasAttribute('column');
  const showAvg = el.hasAttribute('avg');
  const showSurface = !el.hasAttribute('no-surface');
  const maxN = Math.max(2, Math.round(numAttr(el, 'max', 12)));
  const gridInit = (el.getAttribute('grid') || '3,3,3').split(',').map((s) => Math.max(1, parseInt(s, 10) || 3));
  const state = {
    n: [gridInit[0], gridInit[1] ?? gridInit[0], gridInit[2] ?? gridInit[0]],
    axis: AXIS_NAME.indexOf((sweepAttr || '').trim()) >= 0 ? AXIS_NAME.indexOf(sweepAttr.trim()) : 2,
    tt: 0,
    colA: 0.5,
    colS: 0.5,
    az: (numAttr(el, 'az', 35) * Math.PI) / 180,
    el: (numAttr(el, 'el', 24) * Math.PI) / 180,
  };

  // ---- DOM ----
  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram';
  const readout = document.createElement('div');
  readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas' + (el.hasAttribute('tall') ? ' solid-tall' : '');
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = 'Drag the picture to rotate it.';
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  wrap.append(readout, canvas, hint, controls);
  el.replaceWith(wrap);

  // ---- projection (equal scale on all three axes, z up on screen) ----
  const big = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-9);
  const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  function project(x, y, z) {
    const X = (x - mid[0]) / big;
    const Y = (y - mid[1]) / big;
    const Z = (z - mid[2]) / big;
    const ca = Math.cos(state.az); const sa = Math.sin(state.az);
    const ce = Math.cos(state.el); const se = Math.sin(state.el);
    const u = X * ca - Y * sa;
    const w = X * sa + Y * ca;
    return { u, v: Z * ce + w * se, d: w * ce - Z * se };
  }
  const css = (name, dflt) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || dflt;

  // ---- static boundary surface of E (actual-coordinate quads) ----
  const surfQuads = [];
  {
    const SA = 14; const SS = 9;
    const bOf = (a, s) => g1(a) + (g2(a) - g1(a)) * s;
    const add = (...pts) => { if (pts.every((q) => q.every(Number.isFinite))) surfQuads.push(pts); };
    for (let i = 0; i < SA; i++) {
      const aa = a0 + ((a1 - a0) * i) / SA; const ab = a0 + ((a1 - a0) * (i + 1)) / SA;
      for (let j = 0; j < SS; j++) {
        const s0 = j / SS; const s1 = (j + 1) / SS;
        const c = [[aa, bOf(aa, s0)], [ab, bOf(ab, s0)], [ab, bOf(ab, s1)], [aa, bOf(aa, s1)]];
        add(...c.map(([a, b]) => P(a, b, u2(a, b))));
        add(...c.map(([a, b]) => P(a, b, u1(a, b))));
      }
      [g1, g2].forEach((g) => {
        const b0 = g(aa); const b1 = g(ab);
        add(P(aa, b0, u1(aa, b0)), P(ab, b1, u1(ab, b1)), P(ab, b1, u2(ab, b1)), P(aa, b0, u2(aa, b0)));
      });
    }
    [a0, a1].forEach((a) => {
      for (let j = 0; j < SS; j++) {
        const b0 = bOf(a, j / SS); const b1 = bOf(a, (j + 1) / SS);
        add(P(a, b0, u1(a, b0)), P(a, b1, u1(a, b1)), P(a, b1, u2(a, b1)), P(a, b0, u2(a, b0)));
      }
    });
  }

  // ---- slices ----
  const others = (ax) => [0, 1, 2].filter((k) => k !== ax);
  const tOf = (ax) => lo[ax] + state.tt * (hi[ax] - lo[ax]);

  // Integral of f (and area) over the slice plane ax = t. Rows are scanned along q; every entry/exit
  // point of E on a row is refined by bisection, so straight and curved edges are located exactly and
  // the only discretization error left is across rows.
  function sliceStats(ax, t, R, C) {
    const [p, q] = others(ax);
    const dp = (hi[p] - lo[p]) / R; const dq = (hi[q] - lo[q]) / C;
    const pt = [0, 0, 0];
    pt[ax] = t;
    const at = (qq) => { pt[q] = qq; return inside(pt); };
    const edge = (outQ, inQ) => {
      let o = outQ; let i = inQ;
      for (let k = 0; k < 24; k++) { const m = (o + i) / 2; if (at(m)) i = m; else o = m; }
      return i;
    };
    let area = 0; let integral = 0;
    for (let i = 0; i < R; i++) {
      pt[p] = lo[p] + (i + 0.5) * dp;
      let start = null;
      for (let j = 0; j <= C; j++) {
        const qj = lo[q] + (j + 0.5) * dq;
        const ok = j < C && at(qj);
        if (ok && start === null) start = j === 0 ? lo[q] : edge(qj - dq, qj);
        if (!ok && start !== null) {
          const stop = edge(qj, qj - dq);
          area += (stop - start) * dp;
          if (!unitF) {
            const M = 8; const w = (stop - start) / M;
            for (let k = 0; k < M; k++) { pt[q] = start + (k + 0.5) * w; integral += f(pt[0], pt[1], pt[2]) * w * dp; }
          }
          start = null;
        }
      }
    }
    return { area, integral: unitF ? area : integral };
  }

  const stacks = {};
  function stackFor(ax) {
    if (stacks[ax]) return stacks[ax];
    const K = 40;
    const dt = (hi[ax] - lo[ax]) / K;
    const A = []; const cum = [0];
    for (let k = 0; k < K; k++) {
      const s = sliceStats(ax, lo[ax] + (k + 0.5) * dt, 120, 48);
      A.push(s.integral);
      cum.push(cum[k] + s.integral * dt);
    }
    // sum of the sampled slices differs from the exact iterated value only by grid error;
    // rescale so "collected" ends exactly at the total.
    const norm = cum[K] > 0 || cum[K] < 0 ? exact / cum[K] : 1;
    stacks[ax] = { K, dt, A, cum, norm };
    return stacks[ax];
  }
  function collected(ax, t) {
    const st = stackFor(ax);
    const x = Math.min(Math.max((t - lo[ax]) / st.dt, 0), st.K);
    const k = Math.min(Math.floor(x), st.K - 1);
    return (st.cum[k] + st.A[k] * (x - k) * st.dt) * st.norm;
  }

  // shaded runs of a slice: [p0, p1, q0, q1] rectangles in the slice plane
  function sliceRuns(ax, t, N) {
    const [p, q] = others(ax);
    const dp = (hi[p] - lo[p]) / N; const dq = (hi[q] - lo[q]) / N;
    const pt = [0, 0, 0];
    pt[ax] = t;
    const runs = [];
    for (let j = 0; j < N; j++) {
      pt[q] = lo[q] + (j + 0.5) * dq;
      let start = -1;
      for (let i = 0; i <= N; i++) {
        let ok = false;
        if (i < N) { pt[p] = lo[p] + (i + 0.5) * dp; ok = inside(pt); }
        if (ok && start < 0) start = i;
        if (!ok && start >= 0) {
          runs.push([lo[p] + start * dp, lo[p] + i * dp, lo[q] + j * dq, lo[q] + (j + 1) * dq]);
          start = -1;
        }
      }
    }
    return runs;
  }

  // ---- cells ----
  function cellData() {
    const [L, M, N] = state.n;
    const cnt = [L, M, N];
    const d = [0, 1, 2].map((k) => (hi[k] - lo[k]) / cnt[k]);
    const inc = new Uint8Array(L * M * N);
    const idx = (i, j, k) => (i * M + j) * N + k;
    let sum = 0; let num = 0;
    const c = [0, 0, 0];
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < M; j++) {
        for (let k = 0; k < N; k++) {
          c[0] = lo[0] + (i + 0.5) * d[0]; c[1] = lo[1] + (j + 0.5) * d[1]; c[2] = lo[2] + (k + 0.5) * d[2];
          if (inside(c)) { inc[idx(i, j, k)] = 1; num++; sum += f(c[0], c[1], c[2]); }
        }
      }
    }
    return { L, M, N, d, inc, idx, num, sum: sum * d[0] * d[1] * d[2], dV: d[0] * d[1] * d[2] };
  }

  // ---- drawing ----
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth; const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const accent = css('--accent', '#0f6ab4');
    const neg = css('--negative', '#c0392b');
    const ink = css('--ink', '#151515');
    const muted = css('--muted', '#6b7280');

    let umin = Infinity; let umax = -Infinity; let vmin = Infinity; let vmax = -Infinity;
    [lo[0], hi[0]].forEach((x) => [lo[1], hi[1]].forEach((y) => [lo[2], hi[2]].forEach((z) => {
      const p = project(x, y, z);
      umin = Math.min(umin, p.u); umax = Math.max(umax, p.u); vmin = Math.min(vmin, p.v); vmax = Math.max(vmax, p.v);
    })));
    const pad = 30;
    const sc = Math.min((cw - 2 * pad) / (umax - umin || 1), (ch - 2 * pad) / (vmax - vmin || 1));
    const cu = (umin + umax) / 2; const cv = (vmin + vmax) / 2;
    const toScreen = (p) => {
      const q = project(p[0], p[1], p[2]);
      return [cw / 2 + (q.u - cu) * sc, ch / 2 - (q.v - cv) * sc, q.d];
    };
    const back = []; const front = [];
    const quad = (list, pts, fill, stroke, alpha, lw = 1) => {
      const sp = pts.map(toScreen);
      list.push({ sp, d: sp.reduce((a, q) => a + q[2], 0) / sp.length, fill, stroke, alpha, lw });
    };
    const box = (list, x0, x1, y0, y1, z0, z1, fill, stroke, alpha) => {
      const v = (x, y, z) => [x, y, z];
      quad(list, [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)], fill, stroke, alpha);
      quad(list, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], fill, stroke, alpha);
      quad(list, [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], fill, stroke, alpha);
      quad(list, [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], fill, stroke, alpha);
      quad(list, [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)], fill, stroke, alpha);
      quad(list, [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], fill, stroke, alpha);
    };

    if (showSurface && !hasCells) {
      surfQuads.forEach((qd) => quad(back, qd, '#9aa0a6', 'rgba(90,98,110,0.22)', 0.14));
    }

    // column mode: the shadow D on the floor, and the pillar
    let colInfo = null;
    if (hasColumn) {
      const a = a0 + state.colA * (a1 - a0);
      const b = g1(a) + (g2(a) - g1(a)) * state.colS;
      const h0 = u1(a, b); const h1 = u2(a, b);
      colInfo = { a, b, h0, h1 };
      const SA = 22; const SS = 12;
      const bOf = (aa, s) => g1(aa) + (g2(aa) - g1(aa)) * s;
      for (let i = 0; i < SA; i++) {
        const aa = a0 + ((a1 - a0) * i) / SA; const ab = a0 + ((a1 - a0) * (i + 1)) / SA;
        for (let j = 0; j < SS; j++) {
          const pts = [[aa, j / SS], [ab, j / SS], [ab, (j + 1) / SS], [aa, (j + 1) / SS]]
            .map(([x, s]) => P(x, bOf(x, s), lo[ih]));
          if (pts.every((q) => q.every(Number.isFinite))) quad(back, pts, '#d9a400', 'rgba(150,110,0,0.25)', 0.28);
        }
      }
      const e = (a1 - a0) / 45;
      const be = Math.max(hi[ib] - lo[ib], 1e-9) / 45;
      const mk = (aa, bb, hh) => P(aa, bb, hh);
      // pillar: four side faces + top, built through P so the axes mapping applies
      const sides = [
        [mk(a - e, b - be, h0), mk(a + e, b - be, h0), mk(a + e, b - be, h1), mk(a - e, b - be, h1)],
        [mk(a - e, b + be, h0), mk(a + e, b + be, h0), mk(a + e, b + be, h1), mk(a - e, b + be, h1)],
        [mk(a - e, b - be, h0), mk(a - e, b + be, h0), mk(a - e, b + be, h1), mk(a - e, b - be, h1)],
        [mk(a + e, b - be, h0), mk(a + e, b + be, h0), mk(a + e, b + be, h1), mk(a + e, b - be, h1)],
        [mk(a - e, b - be, h1), mk(a + e, b - be, h1), mk(a + e, b + be, h1), mk(a - e, b + be, h1)],
        [mk(a - e, b - be, h0), mk(a + e, b - be, h0), mk(a + e, b + be, h0), mk(a - e, b + be, h0)],
      ];
      if (sides.every((s) => s.every((q) => q.every(Number.isFinite)))) {
        sides.forEach((s) => quad(front, s, neg, 'rgba(255,255,255,0.8)', 0.85, 1.5));
        // dashed drop line to the floor
        colInfo.drop = [toScreen(mk(a, b, h0)), toScreen(mk(a, b, lo[ih]))];
      }
    }

    // cells
    if (hasCells) {
      const cd = cellData();
      const { L, M, N, d, inc, idx } = cd;
      const has = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < L && j < M && k < N && inc[idx(i, j, k)];
      const c = [0, 0, 0];
      for (let i = 0; i < L; i++) {
        for (let j = 0; j < M; j++) {
          for (let k = 0; k < N; k++) {
            if (!inc[idx(i, j, k)]) continue;
            c[0] = lo[0] + (i + 0.5) * d[0]; c[1] = lo[1] + (j + 0.5) * d[1]; c[2] = lo[2] + (k + 0.5) * d[2];
            const col = unitF || f(c[0], c[1], c[2]) >= 0 ? accent : neg;
            const x0 = lo[0] + i * d[0]; const y0 = lo[1] + j * d[1]; const z0 = lo[2] + k * d[2];
            const x1 = x0 + d[0]; const y1 = y0 + d[1]; const z1 = z0 + d[2];
            const st = 'rgba(255,255,255,0.8)';
            const v = (x, y, z) => [x, y, z];
            if (!has(i, j, k - 1)) quad(front, [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)], col, st, 0.5);
            if (!has(i, j, k + 1)) quad(front, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], col, st, 0.62);
            if (!has(i, j - 1, k)) quad(front, [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], col, st, 0.5);
            if (!has(i, j + 1, k)) quad(front, [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], col, st, 0.5);
            if (!has(i - 1, j, k)) quad(front, [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)], col, st, 0.5);
            if (!has(i + 1, j, k)) quad(front, [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], col, st, 0.5);
          }
        }
      }
    }

    // sweeping plane
    let plane = null;
    if (hasSweep) {
      const ax = state.axis;
      const t = tOf(ax);
      const [p, q] = others(ax);
      // already-swept slices, faint, then the current one
      const stackN = 9;
      for (let s = 0; s < stackN; s++) {
        const ts = lo[ax] + ((t - lo[ax]) * (s + 0.5)) / stackN;
        if (t - lo[ax] < 1e-9) break;
        sliceRuns(ax, ts, 22).forEach(([p0, p1, q0, q1]) => {
          const mkp = (pp, qq) => { const r = [0, 0, 0]; r[ax] = ts; r[p] = pp; r[q] = qq; return r; };
          quad(front, [mkp(p0, q0), mkp(p1, q0), mkp(p1, q1), mkp(p0, q1)], neg, 'rgba(0,0,0,0)', 0.12, 0);
        });
      }
      sliceRuns(ax, t, 56).forEach(([p0, p1, q0, q1]) => {
        const mkp = (pp, qq) => { const r = [0, 0, 0]; r[ax] = t; r[p] = pp; r[q] = qq; return r; };
        quad(front, [mkp(p0, q0), mkp(p1, q0), mkp(p1, q1), mkp(p0, q1)], accent, 'rgba(0,0,0,0)', 0.7, 0);
      });
      const corner = (pp, qq) => { const r = [0, 0, 0]; r[ax] = t; r[p] = pp; r[q] = qq; return r; };
      plane = [corner(lo[p], lo[q]), corner(hi[p], lo[q]), corner(hi[p], hi[q]), corner(lo[p], hi[q])].map(toScreen);
    }

    const paint = (list) => {
      list.sort((p, q) => q.d - p.d);
      list.forEach((fc) => {
        ctx.beginPath();
        fc.sp.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.globalAlpha = fc.alpha;
        ctx.fillStyle = fc.fill;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (fc.lw) { ctx.lineWidth = fc.lw; ctx.strokeStyle = fc.stroke; ctx.stroke(); }
      });
    };
    paint(back);
    paint(front);

    if (plane) {
      ctx.beginPath();
      plane.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.globalAlpha = 0.08; ctx.fillStyle = accent; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = accent; ctx.stroke();
    }
    if (colInfo && colInfo.drop) {
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = neg;
      ctx.beginPath(); ctx.moveTo(colInfo.drop[0][0], colInfo.drop[0][1]); ctx.lineTo(colInfo.drop[1][0], colInfo.drop[1][1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(colInfo.drop[1][0], colInfo.drop[1][1], 6, 0, 2 * Math.PI);
      ctx.fillStyle = neg; ctx.fill();
    }

    // coordinate axes from the low corner
    ctx.lineWidth = 2.5; ctx.strokeStyle = muted; ctx.fillStyle = muted;
    ctx.font = '700 18px system-ui, sans-serif';
    [0, 1, 2].forEach((k) => {
      const s = [lo[0], lo[1], lo[2]]; const e = [lo[0], lo[1], lo[2]];
      e[k] = hi[k] + (hi[k] - lo[k]) * 0.12;
      const sp = toScreen(s); const ep = toScreen(e);
      ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(ep[0], ep[1]); ctx.stroke();
      ctx.fillText(AXIS_NAME[k], ep[0] + 6, ep[1] + 5);
    });
  }

  // ---- readout ----
  const chip = (html, cls = '') => `<span class="riemann-chip ${cls}">${html}</span>`;
  function updateReadout() {
    const parts = [];
    if (hasCells) {
      const cd = cellData();
      const err = cd.sum - exact;
      parts.push(chip(`${state.n[0]} × ${state.n[1]} × ${state.n[2]} grid, <b>${cd.num}</b> cell${cd.num === 1 ? '' : 's'} in E`));
      parts.push(chip(`ΔV = ${fmt(cd.dV)}`));
      parts.push(chip(`Riemann sum = <b>${fmt(cd.sum)}</b>`, 'riemann-main'));
      parts.push(chip(`exact ∭ ${unitF ? '' : 'f '}dV = <b>${fmt(exact)}</b>`));
      parts.push(chip(`error = ${err >= 0 ? '+' : ''}${fmt(err)}`, Math.abs(err) < 0.01 * Math.max(Math.abs(exact), 1e-9) ? 'is-close' : ''));
    }
    if (hasSweep) {
      const ax = state.axis;
      const L = AXIS_NAME[ax];
      const t = tOf(ax);
      const s = sliceStats(ax, t, 800, 48);
      const [p, q] = others(ax).map((k) => AXIS_NAME[k]);
      parts.push(chip(`${L} = <b>${fmt(t)}</b>`));
      parts.push(chip(unitF ? `A(${L}) = area of slice = <b>${fmt(s.area)}</b>` : `A(${L}) = ∬ f d${p}d${q} = <b>${fmt(s.integral)}</b>`, 'riemann-main'));
      parts.push(chip(`collected so far = <b>${fmt(collected(ax, t))}</b>`));
      parts.push(chip(`total ${unitF ? 'volume' : '∭ f dV'} = <b>${fmt(exact)}</b>`, Math.abs(state.tt - 1) < 1e-6 ? 'is-close' : ''));
    }
    if (hasColumn) {
      const a = a0 + state.colA * (a1 - a0);
      const b = g1(a) + (g2(a) - g1(a)) * state.colS;
      const h0 = u1(a, b); const h1 = u2(a, b);
      let inner = 0;
      const NH = 400; const dh = (h1 - h0) / NH;
      const pt = P(a, b, 0);
      for (let k = 0; k < NH; k++) { pt[ih] = h0 + (k + 0.5) * dh; inner += unitF ? 1 : f(pt[0], pt[1], pt[2]); }
      inner *= dh;
      parts.push(chip(`(${LA}, ${LB}) = (<b>${fmt(a)}</b>, <b>${fmt(b)}</b>)`));
      parts.push(chip(`${LH} from <b>${fmt(h0)}</b> to <b>${fmt(h1)}</b>`));
      parts.push(chip(`inner ∫ ${unitF ? '' : 'f '}d${LH} = <b>${fmt(inner)}</b>`, 'riemann-main'));
    }
    if (showAvg) {
      parts.push(chip(`V(E) = <b>${fmt(volume)}</b>`));
      parts.push(chip(`f<sub>ave</sub> = ∭f dV / V = <b>${fmt(exact / volume)}</b>`));
    }
    readout.innerHTML = parts.join('');
  }

  // ---- controls ----
  let rafId = null;
  let timerId = null;
  let playBtn = null;
  const stopPlay = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) clearTimeout(timerId);
    rafId = null;
    timerId = null;
    if (playBtn) playBtn.textContent = hasSweep ? '▶ Sweep' : '▶ Refine';
  };
  const refresh = () => { updateReadout(); draw(); syncControls(); };

  const sliders = {};
  const makeSlider = (key, label, min, max, step, get, set) => {
    const row = document.createElement('label');
    row.className = 'jsx-slider-row';
    row.innerHTML = `<span class="jsx-slider-name">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="jsx-slider-val"></span>`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => { stopPlay(); set(parseFloat(input.value)); refresh(); });
    input.addEventListener('pointerup', () => input.blur());
    controls.appendChild(row);
    sliders[key] = { row, input, get };
  };
  const addBtn = (parent, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = text;
    b.addEventListener('pointerup', () => b.blur());
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  };

  const axisBtns = [];
  if (hasSweep) {
    if (el.hasAttribute('axis-buttons')) {
      const group = document.createElement('div');
      group.className = 'jsx-switch';
      [0, 1, 2].forEach((k) => {
        const [p, q] = others(k).map((j) => AXIS_NAME[j]);
        axisBtns[k] = addBtn(group, `slice at fixed ${AXIS_NAME[k]} (d${AXIS_NAME[k]} outside, d${p}d${q} inside)`, () => { stopPlay(); state.axis = k; refresh(); });
      });
      controls.appendChild(group);
    }
    makeSlider('t', 'slice', 0, 1, 0.005, () => state.tt, (v) => { state.tt = v; });
    playBtn = addBtn(controls, '▶ Sweep', () => {
      if (rafId) { stopPlay(); return; }
      if (state.tt >= 0.999) state.tt = 0;
      playBtn.textContent = '⏸ Pause';
      let last = null;
      const tick = (now) => {
        if (last === null) last = now;
        state.tt = Math.min(1, state.tt + (now - last) / 5000);
        last = now;
        refresh();
        if (state.tt < 1) rafId = requestAnimationFrame(tick); else { rafId = null; playBtn.textContent = '↺ Sweep again'; }
      };
      rafId = requestAnimationFrame(tick);
    });
    addBtn(controls, 'Reset', () => { stopPlay(); state.tt = 0; refresh(); });
  }
  if (hasCells) {
    const sq = el.hasAttribute('square');
    if (el.hasAttribute('sliders')) {
      if (sq) makeSlider('n', 'l = m = n', 1, maxN, 1, () => state.n[0], (v) => { state.n = [v, v, v]; });
      else [0, 1, 2].forEach((k) => makeSlider(`n${k}`, `${AXIS_NAME[k]} cuts`, 1, maxN, 1, () => state.n[k], (v) => { state.n[k] = v; }));
    }
    if (el.hasAttribute('play')) {
      const start = [...state.n];
      playBtn = addBtn(controls, '▶ Refine', () => {
        if (timerId) { stopPlay(); return; }
        let k = 1;
        playBtn.textContent = '⏸ Pause';
        const step = () => {
          state.n = [k, k, k];
          refresh();
          if (k < maxN) { k += k < 6 ? 1 : 2; k = Math.min(k, maxN); timerId = setTimeout(step, 750); } else { timerId = null; playBtn.textContent = '↺ Refine again'; }
        };
        step();
      });
      addBtn(controls, 'Reset', () => { stopPlay(); state.n = [...start]; refresh(); });
    }
  }
  if (hasColumn) {
    makeSlider('colA', LA, 0, 1, 0.005, () => state.colA, (v) => { state.colA = v; });
    makeSlider('colS', LB, 0, 1, 0.005, () => state.colS, (v) => { state.colS = v; });
  }
  function syncControls() {
    Object.values(sliders).forEach(({ row, input, get }) => {
      const v = get();
      if (parseFloat(input.value) !== v) input.value = v;
      row.querySelector('.jsx-slider-val').textContent = Number.isInteger(v) ? v : '';
    });
    axisBtns.forEach((b, k) => b && b.classList.toggle('is-on', k === state.axis));
  }

  // ---- drag to rotate ----
  let drag = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.az = drag.az - (e.clientX - drag.x) * 0.008;
    state.el = Math.max(-1.45, Math.min(1.45, drag.el + (e.clientY - drag.y) * 0.006));
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // a canvas inside a hidden step has no size until the step is shown
  new ResizeObserver(draw).observe(canvas);

  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('solid-3d').forEach(renderSolid);
});
