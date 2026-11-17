// <surface-param x="cos(u)" y="sin(u)" z="v" umin="0" umax="2*pi" vmin="0" vmax="3" f="x+y*y" field="x;y;z" sum flip>
//
// Parametric surfaces and surface integrals (calculus3 "Surface Integrals", OpenStax 6.6). A canvas 3D picture, drag to
// rotate, same approach as <coord-3d> / <solid-3d>: plain canvas, own projection, painter's sort, no library.
//
// The surface is r(u, v) = <x, y, z>, each an expression in u and v (sin cos tan exp sqrt abs log pow pi in scope; write
// u*u or pow(u,2), not u^2). `vmin` / `vmax` may depend on u (a triangular parameter domain: vmax="u"). Angles in radians,
// `pi` allowed in the u/v limits. The picture always shows:
//   - the grid curves (u held constant in blue, v held constant in orange) that make the "skeleton" of the surface,
//   - a probe point r(u0, v0) (sliders u, v), the tangent vectors t_u (blue) and t_v (orange) there, the small
//     parallelogram spanned by du t_u and dv t_v (the tangent-plane piece that approximates a piece of surface), and the
//     normal t_u x t_v (green). There is no numeric readout (removed 2026-11-16): the pictures and sliders carry it.
// Optional:
//   f="expr in x,y,z"   a scalar function: the integrand of  \iint_S f dS (used by `sum`).
//   field="P;Q;R"       a vector field (expressions in x,y,z): arrows for F (orange) and for the unit normal N (green) at a
//                       set of points of the surface; `sum` uses F . (t_u x t_v). A "Flip orientation" button
//                       reverses N (and the sign of the flux). `flip` starts reversed.
//   plain               (static picture) only the grid curves of the surface: no probe, no tangent arrows, no sliders.
//   heat                (with f="...") colors the surface by the value of f (blue low, orange high); combine with plain.
//   boundary            draws the boundary curve C of the surface (the image of the edge of the parameter domain) as a thick dark
//                       curve with arrows in the positive direction: counterclockwise in the uv-plane, which is the orientation
//                       induced by N = t_u x t_v (Stokes: walking along C with your head along N, S is on your left). Degenerate
//                       edges (a pole, an apex) and seams that coincide (a cylinder's u = 0 and u = 2 pi) are skipped, so a closed
//                       surface draws no boundary. `flip` reverses N and C together.
//   cells               (Stokes, informal proof) the surface is cut into m x m small patches, each with its own counterclockwise
//                       loop. Button cycles: small loops, loops grown until neighbors touch (shared edges run in opposite
//                       directions), shared edges cancelled so only the outer boundary loop is left. Slider for m.
//   curl                (with field) draws curl F (purple, central differences) instead of F.
//   values              (with field) a button "Show both sides" reveals the two numbers of Stokes' theorem: the line integral of F
//                       around C and the surface integral of curl F over S (instructor predicts first, then reveals).
//   normals             (orientation pictures) only the grid curves and the unit normals N = t_u x t_v / ||t_u x t_v|| (green) at a
//                       set of points of the surface, plus a "Flip orientation" button; no probe, no sliders. On a surface that
//                       cannot be oriented (Moebius strip) the normals visibly reverse across the seam where u = umin meets umax.
//   sum                 a slider for m = n pieces: the parameter domain is cut into m x n pieces, one tangent parallelogram is
//                       drawn per piece, with the Riemann sum  sum g(P_ij) ||t_u x t_v|| du dv  (g = 1,
//                       f, or F . N; midpoint sample points) computed internally (not displayed).
//   uv                  (probe mode) a second picture beside the surface: the parameter domain in the uv-plane with the probe's
//                       du x dv rectangle. The image of that rectangle is drawn on the surface as a curved patch (with the
//                       tangent parallelogram on top). The piece
//                       is kept inside the parameter domain.
//   piece-size          starting size of the probe's du, dv as a fraction of the domain (default 0.12).
// Attributes az, el = starting view angles in degrees. Numeric attributes may use pi.

const TAU = 2 * Math.PI;
const BLUE_VAR = 'accent';
const ORANGE = '#e07b00';
const GREEN = '#2e8b57';
const RED = '#c0392b';

const SCOPE = 'const {sin,cos,tan,asin,acos,atan,exp,sqrt,abs,log,pow,PI:pi,E:e}=Math;';

function compile(args, text, attr) {
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    const fn = new Function(...args, `${SCOPE} return (${text});`);
    fn(...args.map(() => 0.5));
    return fn;
  } catch (err) {
    console.error(`<surface-param>: could not read ${attr}="${text}"`, err);
    return null;
  }
}

const fmt = (v) => {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  const r = Number(v.toPrecision(5));
  return (Object.is(r, -0) || r === 0 ? 0 : r).toString().replace('-', '−');
};
const vec = (a) => `⟨${a.map(fmt).join(', ')}⟩`;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, s = 1) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]];

function renderSurface(el) {
  const TAG = 'surface-param';
  const getNum = (name, dflt) => {
    const raw = el.getAttribute(name);
    if (raw === null || raw.trim() === '') return dflt;
    const f = compile(['u'], raw, name);
    return f ? f(0) : dflt;
  };
  const fx = compile(['u', 'v'], el.getAttribute('x') || '0', 'x');
  const fy = compile(['u', 'v'], el.getAttribute('y') || '0', 'y');
  const fz = compile(['u', 'v'], el.getAttribute('z') || '0', 'z');
  if (!fx || !fy || !fz) return;
  const umin = getNum('umin', 0); const umax = getNum('umax', 1);
  const vlo = compile(['u'], el.getAttribute('vmin') || '0', 'vmin');
  const vhi = compile(['u'], el.getAttribute('vmax') || '1', 'vmax');
  if (!vlo || !vhi) return;
  const fScalar = el.getAttribute('f') ? compile(['x', 'y', 'z'], el.getAttribute('f'), 'f') : null;
  let fField = null;
  if (el.getAttribute('field')) {
    const parts = el.getAttribute('field').split(';');
    const fs = parts.map((t, i) => compile(['x', 'y', 'z'], t, `field[${i}]`));
    if (parts.length === 3 && fs.every(Boolean)) fField = (x, y, z) => fs.map((g) => g(x, y, z));
    else console.error(`<${TAG}>: field="P;Q;R" needs three expressions`);
  }
  const hasSum = el.hasAttribute('sum');
  const hasUV = el.hasAttribute('uv') && !hasSum;
  const hasPlain = el.hasAttribute('plain') && !hasSum && !hasUV;
  const showN = el.hasAttribute('normals') && !hasSum && !hasUV;
  const hasCells = el.hasAttribute('cells') && !hasSum && !hasUV;
  const isStatic = hasPlain || showN || hasCells;
  const hasHeat = el.hasAttribute('heat') && !!fScalar;
  const wantArrows = showN || (!!fField && !hasPlain && !hasCells);
  const hasBoundary = el.hasAttribute('boundary') && !hasUV;
  const hasCurl = el.hasAttribute('curl') && !!fField;
  const hasValues = el.hasAttribute('values') && !!fField;
  const R = (u, v) => [fx(u, v), fy(u, v), fz(u, v)];
  const H = 1e-5;
  const tu = (u, v) => { const a = R(u + H, v); const b = R(u - H, v); return [0, 1, 2].map((k) => (a[k] - b[k]) / (2 * H)); };
  const tv = (u, v) => { const a = R(u, v + H); const b = R(u, v - H); return [0, 1, 2].map((k) => (a[k] - b[k]) / (2 * H)); };

  const st = {
    u: (umin + umax) / 2, s: 0.5, size: getNum('piece-size', 0.12), m: el.hasAttribute('cells') ? 4 : 3, stage: 0, showValues: false, flip: el.hasAttribute('flip') ? -1 : 1,
    az: (getNum('az', 35) * Math.PI) / 180, el: (getNum('el', 25) * Math.PI) / 180,
  };
  const vAt = (u, s) => { const a = vlo(u); const b = vhi(u); return a + s * (b - a); };
  // the probe piece [pu, pu + dU] x [pv, pv + dV] (in uv mode it is kept inside the parameter domain)
  const geom = () => {
    const dU = (umax - umin) * st.size;
    const pu = hasUV ? Math.min(st.u, umax - dU) : st.u;
    const dV = (vhi(pu) - vlo(pu)) * st.size;
    let pv = vAt(pu, st.s);
    if (hasUV) pv = Math.min(pv, vhi(pu) - dV);
    return { dU, dV, pu, pv };
  };
  // the boundary of the parameter domain, counterclockwise in the uv-plane: bottom, right, top (reversed), left (reversed)
  const edgePts = (n = 80) => [
    Array.from({ length: n + 1 }, (_, k) => { const u = umin + ((umax - umin) * k) / n; return R(u, vlo(u)); }),
    Array.from({ length: n + 1 }, (_, k) => R(umax, vlo(umax) + ((vhi(umax) - vlo(umax)) * k) / n)),
    Array.from({ length: n + 1 }, (_, k) => { const u = umax - ((umax - umin) * k) / n; return R(u, vhi(u)); }),
    Array.from({ length: n + 1 }, (_, k) => R(umin, vhi(umin) + ((vlo(umin) - vhi(umin)) * k) / n)),
  ];
  const edgeLen = (e) => e.reduce((a, q, k) => (k ? a + norm(add(q, e[k - 1], -1)) : 0), 0);
  const sameCurve = (a, b) => a.every((q, k) => norm(add(q, b[b.length - 1 - k], -1)) < 1e-6 * big);
  const boundaryEdges = () => {
    const E = edgePts(); const keep = E.map((e) => edgeLen(e) > 1e-6 * big);
    if (keep[0] && keep[2] && sameCurve(E[0], E[2])) { keep[0] = false; keep[2] = false; }
    if (keep[1] && keep[3] && sameCurve(E[1], E[3])) { keep[1] = false; keep[3] = false; }
    return E.filter((_, i) => keep[i]).map((e) => (st.flip < 0 ? e.slice().reverse() : e));
  };
  const HC = 1e-4;
  const curlAt = (x, y, z) => {
    const d = (i, axis) => {
      const a = [x, y, z]; const b = [x, y, z]; a[axis] += HC; b[axis] -= HC;
      return (fField(...a)[i] - fField(...b)[i]) / (2 * HC);
    };
    return [d(2, 1) - d(1, 2), d(0, 2) - d(2, 0), d(1, 0) - d(0, 1)];
  };
  const lineIntegralC = () => {
    let total = 0;
    edgePts(400).forEach((e) => { for (let k = 0; k < e.length - 1; k++) { const mid = add(e[k], e[k + 1]).map((c) => c / 2); total += dot(fField(...mid), add(e[k + 1], e[k], -1)); } });
    return st.flip * total;
  };
  const surfaceIntegralCurl = () => {
    const N = 220; let total = 0; const du = (umax - umin) / N;
    for (let i = 0; i < N; i++) {
      const u = umin + (i + 0.5) * du; const a = vlo(u); const dv = (vhi(u) - a) / N;
      for (let j = 0; j < N; j++) { const v = a + (j + 0.5) * dv; total += dot(curlAt(...R(u, v)), cross(tu(u, v), tv(u, v))) * du * dv; }
    }
    return st.flip * total;
  };
  // integrand g(u, v) = (1 | f(r) | F(r) . N-sign) * ||t_u x t_v||  (flux: F . (t_u x t_v), signed)
  const integrand = (u, v) => {
    const r = R(u, v); const n = cross(tu(u, v), tv(u, v));
    if (fField) return st.flip * dot(fField(...r), n);
    return (fScalar ? fScalar(...r) : 1) * norm(n);
  };
  // fine-grid value of the integral
  function exactValue() {
    const N = 140; let total = 0; const du = (umax - umin) / N;
    for (let i = 0; i < N; i++) {
      const u = umin + (i + 0.5) * du; const a = vlo(u); const b = vhi(u); const dv = (b - a) / N;
      for (let j = 0; j < N; j++) total += integrand(u, a + (j + 0.5) * dv) * du * dv;
    }
    return total;
  }
  let exactCache = null; let exactKey = '';
  const exact = () => {
    const key = `${st.flip}`;
    if (exactCache === null || exactKey !== key) { exactCache = exactValue(); exactKey = key; }
    return exactCache;
  };
  function riemann(m) {
    let total = 0; const du = (umax - umin) / m;
    for (let i = 0; i < m; i++) {
      const u = umin + (i + 0.5) * du; const a = vlo(u); const b = vhi(u); const dv = (b - a) / m;
      for (let j = 0; j < m; j++) total += integrand(u, a + (j + 0.5) * dv) * du * dv;
    }
    return total;
  }

  // ---- bounding box of the surface (for the view) ----
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i <= 24; i++) {
    const u = umin + ((umax - umin) * i) / 24;
    for (let j = 0; j <= 24; j++) {
      const p = R(u, vAt(u, j / 24));
      p.forEach((c, k) => { if (Number.isFinite(c)) { lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); } });
    }
  }
  const padBox = 0.12 * Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-6);
  for (let k = 0; k < 3; k++) { lo[k] -= padBox; hi[k] += padBox; }
  const big = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);

  // f range over the surface, for the optional heat coloring
  let fLo = Infinity; let fHi = -Infinity;
  if (hasHeat) {
    for (let i = 0; i <= 24; i++) {
      const u = umin + ((umax - umin) * i) / 24;
      for (let j = 0; j <= 24; j++) { const fv = fScalar(...R(u, vAt(u, j / 24))); if (Number.isFinite(fv)) { fLo = Math.min(fLo, fv); fHi = Math.max(fHi, fv); } }
    }
  }
  const heatColor = (fv) => {
    const t = fHi > fLo ? Math.max(0, Math.min(1, (fv - fLo) / (fHi - fLo))) : 0.5;
    const a = [47, 111, 176]; const b = [224, 123, 0];
    return `rgb(${a.map((c, k) => Math.round(c + t * (b[k] - c))).join(',')})`;
  };

  // ---- DOM ----
  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas solid-tall';
  let uvCanvas = null; let uvBox = null;
  if (hasUV) {
    uvCanvas = document.createElement('canvas');
    uvCanvas.className = 'riemann-canvas';
    uvCanvas.style.cursor = 'default'; uvCanvas.style.aspectRatio = '1 / 1';
    canvas.style.aspectRatio = '1 / 1';
    uvBox = document.createElement('div');
    uvBox.className = 'jsx-fubini-grid';
    uvBox.append(uvCanvas, canvas);
  }
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = isStatic ? `Drag the picture to rotate it.${showN ? ' Green arrows: the unit normal N.' : ''}${showN && fField && !hasCurl ? ' Orange arrows: F.' : ''}${hasCurl ? ' Purple arrows: curl F.' : ''}${hasBoundary ? ' Black curve: the boundary C, with its positive direction.' : ''}${hasHeat ? ' Color shows f on S (blue low, orange high).' : ''}` : 'Drag the picture to rotate it. Blue: t_u (and the curves u = constant held fixed along v). Orange: t_v. Green: normal t_u × t_v.';
  const valuesBox = document.createElement('div');
  valuesBox.className = 'riemann-readout';
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  wrap.append(uvBox || canvas, ...(hasValues ? [valuesBox] : []), hint, controls);
  el.replaceWith(wrap);

  function project(x, y, z) {
    const X = (x - mid[0]) / big; const Y = (y - mid[1]) / big; const Z = (z - mid[2]) / big;
    const ca = Math.cos(st.az); const sa = Math.sin(st.az);
    const ce = Math.cos(st.el); const se = Math.sin(st.el);
    const uu = X * ca - Y * sa; const w = X * sa + Y * ca;
    return { u: uu, v: Z * ce + w * se, d: w * ce - Z * se };
  }
  const css = (name, dflt) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || dflt;

  const NU = 30; const NV = 22;
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
    const ink = css('--ink', '#151515'); const muted = css('--muted', '#6b7280'); const accent = css('--accent', '#0f6ab4');

    let umn = Infinity; let umx = -Infinity; let vmn = Infinity; let vmx = -Infinity;
    [lo[0], hi[0]].forEach((x) => [lo[1], hi[1]].forEach((y) => [lo[2], hi[2]].forEach((z) => {
      const p = project(x, y, z);
      umn = Math.min(umn, p.u); umx = Math.max(umx, p.u); vmn = Math.min(vmn, p.v); vmx = Math.max(vmx, p.v);
    })));
    const pad = 30;
    const sc = Math.min((cw - 2 * pad) / (umx - umn || 1), (ch - 2 * pad) / (vmx - vmn || 1));
    const cu = (umn + umx) / 2; const cv = (vmn + vmx) / 2;
    const S = (p) => { const q = project(p[0], p[1], p[2]); return [cw / 2 + (q.u - cu) * sc, ch / 2 - (q.v - cv) * sc, q.d]; };

    const faces = [];
    const quad = (pts, fill, stroke, alpha, lw) => {
      const sp = pts.map(S);
      faces.push({ sp, d: sp.reduce((a, q) => a + q[2], 0) / sp.length, fill, stroke, alpha, lw });
    };
    const poly = (pts, color, lw, dash) => {
      const sp = pts.map(S);
      ctx.beginPath();
      sp.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.setLineDash(dash || []);
      ctx.stroke(); ctx.setLineDash([]);
    };
    const arrow = (p, d, color, lw = 4) => {
      const a = S(p); const b = S(add(p, d));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const hl = 5 + lw * 2;
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hl * Math.cos(ang - 0.4), b[1] - hl * Math.sin(ang - 0.4));
      ctx.lineTo(b[0] - hl * Math.cos(ang + 0.4), b[1] - hl * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    const dotAt = (p, color, rad) => {
      const q = S(p);
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    };

    // the surface as a light mesh
    for (let i = 0; i < NU; i++) {
      const u0 = umin + ((umax - umin) * i) / NU; const u1 = umin + ((umax - umin) * (i + 1)) / NU;
      for (let j = 0; j < NV; j++) {
        const p00 = R(u0, vAt(u0, j / NV)); const p01 = R(u0, vAt(u0, (j + 1) / NV));
        const p10 = R(u1, vAt(u1, j / NV)); const p11 = R(u1, vAt(u1, (j + 1) / NV));
        if (hasHeat) {
          const mu = (u0 + u1) / 2; const pc = R(mu, vAt(mu, (j + 0.5) / NV));
          quad([p00, p10, p11, p01], heatColor(fScalar(...pc)), 'rgba(60,70,90,0.25)', 0.85, 0.6);
        } else quad([p00, p10, p11, p01], accent, 'rgba(60,70,90,0.18)', 0.13, 0.8);
      }
    }

    // pieces and their tangent parallelograms
    const du0 = (umax - umin) * st.size;
    const gm = geom();
    const probeU = gm.pu; const probeV = gm.pv;
    if (hasSum) {
      const m = st.m; const dU = (umax - umin) / m;
      for (let i = 0; i <= m; i++) {
        const u = umin + i * dU;
        poly(Array.from({ length: 41 }, (_, k) => R(u, vAt(u, k / 40))), ink, 2.2);
      }
      for (let j = 0; j <= m; j++) {
        poly(Array.from({ length: 41 }, (_, k) => { const u = umin + (dU * m * k) / 40; return R(u, vAt(u, j / m)); }), ink, 2.2);
      }
      for (let i = 0; i < m; i++) {
        const u = umin + (i + 0.5) * dU; const a = vlo(u); const b = vhi(u); const dV = (b - a) / m;
        for (let j = 0; j < m; j++) {
          const v = a + (j + 0.5) * dV; const P = R(u, v); const a1 = tu(u, v); const b1 = tv(u, v);
          const c = [add(add(P, a1, -dU / 2), b1, -dV / 2), add(add(P, a1, dU / 2), b1, -dV / 2), add(add(P, a1, dU / 2), b1, dV / 2), add(add(P, a1, -dU / 2), b1, dV / 2)];
          quad(c, ORANGE, 'rgba(120,60,0,0.8)', 0.5, 1.5);
        }
      }
    } else {
      // grid curves
      if (!hasCells) {
        for (let i = 0; i <= 8; i++) {
          const u = umin + ((umax - umin) * i) / 8;
          poly(Array.from({ length: 41 }, (_, k) => R(u, vAt(u, k / 40))), accent, 1.6);
        }
        for (let j = 0; j <= 6; j++) {
          poly(Array.from({ length: 61 }, (_, k) => { const u = umin + ((umax - umin) * k) / 60; return R(u, vAt(u, j / 6)); }), ORANGE, 1.6);
        }
      }
      // the probe's parallelogram du t_u x dv t_v
      const P = R(probeU, probeV); const a1 = tu(probeU, probeV); const b1 = tv(probeU, probeV);
      const dU = du0; const dV = gm.dV;
      if (!isStatic) {
      if (hasUV) {
        const n = 8; const Q = (i, j) => R(probeU + (dU * i) / n, probeV + (dV * j) / n);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) quad([Q(i, j), Q(i + 1, j), Q(i + 1, j + 1), Q(i, j + 1)], accent, 'rgba(15,60,120,0.5)', 0.55, 1);
        for (const [a, b] of [[[0, 0], [n, 0]], [[n, 0], [n, n]], [[n, n], [0, n]], [[0, n], [0, 0]]]) {
          poly(Array.from({ length: 13 }, (_, k) => Q(a[0] + ((b[0] - a[0]) * k) / 12, a[1] + ((b[1] - a[1]) * k) / 12)), ink, 3);
        }
      }
      quad([P, add(P, a1, dU), add(add(P, a1, dU), b1, dV), add(P, b1, dV)], ORANGE, 'rgba(120,60,0,0.9)', hasUV ? 0.35 : 0.55, 2);
      }
    }

    // vector field and unit normals at a set of points
    if (wantArrows) {
      const nu = 6; const nv = 5; const pts = [];
      let maxF = 1e-9;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = umin + ((umax - umin) * (i + 0.5)) / nu; const v = vAt(u, (j + 0.5) / nv);
        const r = R(u, v); const F = fField ? (hasCurl ? curlAt(...r) : fField(...r)) : [0, 0, 0]; maxF = Math.max(maxF, norm(F));
        pts.push({ r, F, N: cross(tu(u, v), tv(u, v)) });
      }
      pts.forEach(({ r, F, N }) => {
        const nn = norm(N) || 1; const len = 0.11 * big;
        arrow(r, N.map((c) => (st.flip * c * len) / nn), GREEN, 3);
        if (fField) arrow(r, F.map((c) => (c * 0.16 * big) / maxF), hasCurl ? '#7b3fa0' : ORANGE, 3);
      });
    }

    faces.sort((p, q) => q.d - p.d);
    faces.forEach((fc) => {
      ctx.beginPath();
      fc.sp.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.globalAlpha = fc.alpha; ctx.fillStyle = fc.fill; ctx.fill();
      ctx.globalAlpha = 1;
      if (fc.lw) { ctx.lineWidth = fc.lw; ctx.strokeStyle = fc.stroke; ctx.stroke(); }
    });

    // small loops that cancel on shared edges (cells mode)
    if (hasCells) {
      const m = st.m; const inset = st.stage === 0 ? 0.74 : 1;
      const corner = (i, j) => { const u = umin + ((umax - umin) * i) / m; return R(u, vAt(u, j / m)); };
      const drawEdge = (a, b, color, lw) => { const dd = add(b, a, -1); if (norm(dd) > 1e-6 * big) arrow(a, dd, color, lw); };
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
        const c = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
        const ctr = c.reduce((a, q) => add(a, q), [0, 0, 0]).map((x) => x / 4);
        let pts = c.map((q) => add(ctr, add(q, ctr, -1), inset));
        if (st.flip < 0) pts = pts.slice().reverse();
        const isB = [j === 0, i === m - 1, j === m - 1, i === 0];
        for (let k = 0; k < 4; k++) {
          const a = pts[k]; const b = pts[(k + 1) % 4];
          const bk = st.flip < 0 ? [isB[2], isB[1], isB[0], isB[3]][k] : isB[k];
          if (st.stage === 2) { if (bk) drawEdge(a, b, ink, 5); } else drawEdge(a, b, accent, 2.5);
        }
      }
    }
    // the boundary curve C with arrows in its positive direction
    if (hasBoundary) {
      boundaryEdges().forEach((e) => {
        poly(e, ink, 6);
        const n = e.length - 1;
        for (const f of [0.12, 0.37, 0.62, 0.87]) {
          const k = Math.min(n - 1, Math.floor(f * n)); const dd = add(e[k + 1], e[k], -1); const dl = norm(dd) || 1;
          arrow(add(e[k], dd, -0.5 * 0.1 * big / dl), dd.map((c) => (c * 0.1 * big) / dl), ink, 6);
        }
      });
    }

    // axes through the origin when it lies in the box
    ctx.fillStyle = muted;
    ['x', 'y', 'z'].forEach((nm, k) => {
      const a = [0, 0, 0]; const b = [0, 0, 0];
      a[k] = Math.min(lo[k], 0); b[k] = Math.max(hi[k], 0) * 1.1 + 0.001;
      poly([a, b], muted, 2);
      ctx.font = '700 20px system-ui, sans-serif';
      const q = S(b); ctx.fillText(nm, q[0] + 5, q[1] + 5);
    });

    // probe, tangent vectors and normal (single-piece mode only)
    if (!hasSum && !isStatic) {
      const P = R(probeU, probeV); const a1 = tu(probeU, probeV); const b1 = tv(probeU, probeV);
      const n = cross(a1, b1); const nn = norm(n) || 1;
      const sc1 = 0.2 * big / Math.max(norm(a1), norm(b1), 1e-9);
      arrow(P, a1.map((c) => c * sc1), accent, 5);
      arrow(P, b1.map((c) => c * sc1), ORANGE, 5);
      arrow(P, n.map((c) => (st.flip * c * 0.2 * big) / nn), GREEN, 5);
      dotAt(P, ink, 7);
    }
  }

  // ---- the parameter domain in the uv-plane (uv mode) ----
  function drawUV() {
    if (!uvCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = uvCanvas.clientWidth; const ch = uvCanvas.clientHeight;
    if (!cw || !ch) return;
    if (uvCanvas.width !== Math.round(cw * dpr) || uvCanvas.height !== Math.round(ch * dpr)) {
      uvCanvas.width = Math.round(cw * dpr); uvCanvas.height = Math.round(ch * dpr);
    }
    const ctx = uvCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const ink = css('--ink', '#151515'); const muted = css('--muted', '#6b7280'); const accent = css('--accent', '#0f6ab4');
    const line = css('--line', '#d0d5dd');
    let vmin = Infinity; let vmax = -Infinity;
    for (let i = 0; i <= 40; i++) { const u = umin + ((umax - umin) * i) / 40; vmin = Math.min(vmin, vlo(u), vhi(u)); vmax = Math.max(vmax, vlo(u), vhi(u)); }
    const padL = 56; const padR = 24; const padT = 34; const padB = 50;
    const sx = (cw - padL - padR) / (umax - umin); const sy = (ch - padT - padB) / (vmax - vmin);
    const X = (u) => padL + (u - umin) * sx; const Y = (v) => ch - padB - (v - vmin) * sy;
    const path = (pts) => { ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b)))); };
    // domain
    const edge = [];
    for (let i = 0; i <= 40; i++) { const u = umin + ((umax - umin) * i) / 40; edge.push([u, vlo(u)]); }
    for (let i = 40; i >= 0; i--) { const u = umin + ((umax - umin) * i) / 40; edge.push([u, vhi(u)]); }
    path(edge); ctx.closePath(); ctx.globalAlpha = 0.07; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 1; ctx.strokeStyle = line;
    for (let i = 0; i <= 8; i++) { const u = umin + ((umax - umin) * i) / 8; path([[u, vlo(u)], [u, vhi(u)]]); ctx.stroke(); }
    for (let j = 0; j <= 6; j++) { path(Array.from({ length: 41 }, (_, k) => { const u = umin + ((umax - umin) * k) / 40; return [u, vAt(u, j / 6)]; })); ctx.stroke(); }
    path(edge); ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = muted; ctx.stroke();
    // the probe's rectangle
    const g = geom();
    path([[g.pu, g.pv], [g.pu + g.dU, g.pv], [g.pu + g.dU, g.pv + g.dV], [g.pu, g.pv + g.dV]]); ctx.closePath();
    ctx.globalAlpha = 0.5; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
    const arr = (x0, y0, x1, y1, color) => {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 12 * Math.cos(ang - 0.4), y1 - 12 * Math.sin(ang - 0.4));
      ctx.lineTo(x1 - 12 * Math.cos(ang + 0.4), y1 - 12 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    arr(X(g.pu), Y(g.pv), X(g.pu + g.dU), Y(g.pv), accent);
    arr(X(g.pu), Y(g.pv), X(g.pu), Y(g.pv + g.dV), ORANGE);
    ctx.beginPath(); ctx.arc(X(g.pu), Y(g.pv), 6, 0, TAU); ctx.fillStyle = ink; ctx.fill();
    // labels
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = accent; ctx.fillText('Δu', X(g.pu + g.dU / 2) - 10, Y(g.pv) + 24);
    ctx.fillStyle = ORANGE; ctx.fillText('Δv', X(g.pu) - 34, Y(g.pv + g.dV / 2) + 6);
    ctx.fillStyle = muted; ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('u', cw - padR - 8, ch - padB + 38); ctx.fillText('v', padL - 30, padT - 12);
    ctx.textAlign = 'center';
    ctx.fillText(fmt(umin), X(umin), ch - padB + 24); ctx.fillText(fmt(umax), X(umax), ch - padB + 24);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(vmin), padL - 8, Y(vmin) + 5); ctx.fillText(fmt(vmax), padL - 8, Y(vmax) + 5);
    ctx.textAlign = 'left';
    ctx.font = '700 16px system-ui, sans-serif'; ctx.fillStyle = ink;
    ctx.fillText('parameter domain (uv-plane)', padL, 20);
  }

  // ---- controls ----
  const sliders = [];
  const makeSlider = (label, min, max, step, get, set, color) => {
    const row = document.createElement('label');
    row.className = 'jsx-slider-row';
    row.innerHTML = `<span class="jsx-slider-name" style="color:${color || 'inherit'}">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="jsx-slider-val"></span>`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => { set(parseFloat(input.value)); refresh(); });
    input.addEventListener('pointerup', () => input.blur());
    controls.appendChild(row);
    sliders.push({ row, input, get });
  };
  const addBtn = (text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = text;
    b.addEventListener('pointerup', () => b.blur());
    b.addEventListener('click', () => onClick(b));
    controls.appendChild(b);
    return b;
  };
  if (hasSum || hasCells) {
    makeSlider('pieces m (m × m)', hasCells ? 2 : 1, hasCells ? 10 : 12, 1, () => st.m, (v) => { st.m = v; }, ORANGE);
  } else if (!isStatic) {
    makeSlider('u', umin, umax, (umax - umin) / 200, () => st.u, (v) => { st.u = v; }, 'var(--accent)');
    makeSlider('v (fraction of its range)', 0, 1, 0.005, () => st.s, (v) => { st.s = v; }, ORANGE);
    makeSlider('piece size du, dv', 0.02, 0.4, 0.01, () => st.size, (v) => { st.size = v; });
  }
  if (wantArrows || (hasBoundary && !hasCells)) addBtn('Flip orientation', () => { st.flip = -st.flip; refresh(); });
  const STAGE_LABELS = ['Grow the loops ▶', 'Cancel the shared edges ▶', '↺ Start over'];
  const STAGE_HINTS = [
    'Each small patch has its own counterclockwise loop.',
    'The loops grow until neighbors touch: along every shared edge the two loops run in opposite directions.',
    'The shared edges cancel in pairs. Only the outer boundary remains: the circulation around C.',
  ];
  let stageBtn = null;
  if (hasCells) stageBtn = addBtn(STAGE_LABELS[0], () => { st.stage = (st.stage + 1) % 3; refresh(); });
  let valuesBtn = null;
  if (hasValues) valuesBtn = addBtn('Show both sides', () => { st.showValues = !st.showValues; refresh(); });
  function syncControls() {
    sliders.forEach(({ row, input, get }) => {
      const v = get();
      if (parseFloat(input.value) !== v) input.value = v;
      row.querySelector('.jsx-slider-val').textContent = fmt(v);
    });
  }
  const fmtPi = (v) => { const q = v / Math.PI; const r4 = Math.round(q * 4) / 4; return Math.abs(q - r4) < 2e-3 && Math.abs(q) > 1e-9 ? `${fmt(r4)}π` : fmt(v); };
  const refresh = () => {
    if (hasCells) { stageBtn.textContent = STAGE_LABELS[st.stage]; hint.textContent = STAGE_HINTS[st.stage]; }
    if (hasValues) {
      valuesBtn.textContent = st.showValues ? 'Hide' : 'Show both sides';
      if (st.showValues) {
        const lhs = lineIntegralC(); const rhs = surfaceIntegralCurl();
        valuesBox.innerHTML = `<span class="riemann-chip">∮<sub>C</sub> F · dr = <b>${fmtPi(lhs)}</b></span><span class="riemann-chip">∬<sub>S</sub> curl F · dS = <b>${fmtPi(rhs)}</b></span>`;
      } else valuesBox.innerHTML = '';
    }
    draw(); drawUV(); syncControls();
  };

  // ---- drag to rotate ----
  let drag = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, az: st.az, el: st.el };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    st.az = drag.az - (e.clientX - drag.x) * 0.008;
    st.el = Math.max(-1.45, Math.min(1.45, drag.el + (e.clientY - drag.y) * 0.006));
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  new ResizeObserver(draw).observe(canvas);
  if (uvCanvas) new ResizeObserver(drawUV).observe(uvCanvas);

  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('surface-param').forEach(renderSurface);
});
