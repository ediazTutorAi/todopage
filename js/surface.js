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
//     normal t_u x t_v (green). Readout: t_u, t_v, t_u x t_v, ||t_u x t_v|| and the area of the parallelogram.
// Optional:
//   f="expr in x,y,z"   a scalar function: the probe readout adds f(r) ||t_u x t_v||, the integrand of  \iint_S f dS.
//   field="P;Q;R"       a vector field (expressions in x,y,z): arrows for F (orange) and for the unit normal N (green) at a
//                       set of points of the surface, and the readout adds F . (t_u x t_v). A "Flip orientation" button
//                       reverses N (and the sign of the flux). `flip` starts reversed.
//   sum                 a slider for m = n pieces: the parameter domain is cut into m x n pieces, one tangent parallelogram is
//                       drawn per piece, and the readout compares the Riemann sum  sum g(P_ij) ||t_u x t_v|| du dv  (g = 1,
//                       f, or F . N; midpoint sample points) with the value of the integral from a fine grid.
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
  const R = (u, v) => [fx(u, v), fy(u, v), fz(u, v)];
  const H = 1e-5;
  const tu = (u, v) => { const a = R(u + H, v); const b = R(u - H, v); return [0, 1, 2].map((k) => (a[k] - b[k]) / (2 * H)); };
  const tv = (u, v) => { const a = R(u, v + H); const b = R(u, v - H); return [0, 1, 2].map((k) => (a[k] - b[k]) / (2 * H)); };

  const st = {
    u: (umin + umax) / 2, s: 0.5, size: getNum('piece-size', 0.12), m: 3, flip: el.hasAttribute('flip') ? -1 : 1,
    az: (getNum('az', 35) * Math.PI) / 180, el: (getNum('el', 25) * Math.PI) / 180,
  };
  const vAt = (u, s) => { const a = vlo(u); const b = vhi(u); return a + s * (b - a); };

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

  // ---- DOM ----
  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram';
  const readout = document.createElement('div');
  readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas solid-tall';
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = 'Drag the picture to rotate it. Blue: t_u (and the curves u = constant held fixed along v). Orange: t_v. Green: normal t_u × t_v.';
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  wrap.append(readout, canvas, hint, controls);
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
        quad([p00, p10, p11, p01], accent, 'rgba(60,70,90,0.18)', 0.13, 0.8);
      }
    }

    // pieces and their tangent parallelograms
    const du0 = (umax - umin) * st.size;
    const probeU = st.u; const probeV = vAt(st.u, st.s);
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
      for (let i = 0; i <= 8; i++) {
        const u = umin + ((umax - umin) * i) / 8;
        poly(Array.from({ length: 41 }, (_, k) => R(u, vAt(u, k / 40))), accent, 1.6);
      }
      for (let j = 0; j <= 6; j++) {
        poly(Array.from({ length: 61 }, (_, k) => { const u = umin + ((umax - umin) * k) / 60; return R(u, vAt(u, j / 6)); }), ORANGE, 1.6);
      }
      // the probe's parallelogram du t_u x dv t_v
      const P = R(probeU, probeV); const a1 = tu(probeU, probeV); const b1 = tv(probeU, probeV);
      const dU = du0; const dV = (vhi(probeU) - vlo(probeU)) * st.size;
      quad([P, add(P, a1, dU), add(add(P, a1, dU), b1, dV), add(P, b1, dV)], ORANGE, 'rgba(120,60,0,0.9)', 0.55, 2);
    }

    // vector field and unit normals at a set of points
    if (fField) {
      const nu = 6; const nv = 5; const pts = [];
      let maxF = 1e-9;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = umin + ((umax - umin) * (i + 0.5)) / nu; const v = vAt(u, (j + 0.5) / nv);
        const r = R(u, v); const F = fField(...r); maxF = Math.max(maxF, norm(F));
        pts.push({ r, F, N: cross(tu(u, v), tv(u, v)) });
      }
      pts.forEach(({ r, F, N }) => {
        const nn = norm(N) || 1; const len = 0.11 * big;
        arrow(r, N.map((c) => (st.flip * c * len) / nn), GREEN, 3);
        arrow(r, F.map((c) => (c * 0.16 * big) / maxF), ORANGE, 3);
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
    if (!hasSum) {
      const P = R(probeU, probeV); const a1 = tu(probeU, probeV); const b1 = tv(probeU, probeV);
      const n = cross(a1, b1); const nn = norm(n) || 1;
      const sc1 = 0.2 * big / Math.max(norm(a1), norm(b1), 1e-9);
      arrow(P, a1.map((c) => c * sc1), accent, 5);
      arrow(P, b1.map((c) => c * sc1), ORANGE, 5);
      arrow(P, n.map((c) => (st.flip * c * 0.2 * big) / nn), GREEN, 5);
      dotAt(P, ink, 7);
    }
  }

  // ---- readout ----
  const chip = (html, color) => `<span class="riemann-chip"${color ? ` style="border-color:${color}"` : ''}>${html}</span>`;
  const what = fField ? 'flux  ∬ F·N dS' : fScalar ? '∬ f dS' : 'surface area';
  function updateReadout() {
    const parts = [];
    if (!hasSum) {
      const u = st.u; const v = vAt(u, st.s);
      const a = tu(u, v); const b = tv(u, v); const n = cross(a, b); const m = norm(n);
      const r = R(u, v);
      parts.push(chip(`(u, v) = (<b>${fmt(u)}</b>, <b>${fmt(v)}</b>)`));
      parts.push(chip(`r(u, v) = <b>${vec(r)}</b>`));
      parts.push(chip(`t<sub>u</sub> = <b>${vec(a)}</b>`, 'var(--accent)'));
      parts.push(chip(`t<sub>v</sub> = <b>${vec(b)}</b>`, ORANGE));
      parts.push(chip(`t<sub>u</sub> × t<sub>v</sub> = <b>${vec(n)}</b>`, GREEN));
      parts.push(chip(`‖t<sub>u</sub> × t<sub>v</sub>‖ = <b>${fmt(m)}</b>`));
      if (m < 1e-6) parts.push(chip('t<sub>u</sub> × t<sub>v</sub> = 0 here: not smooth at this point', RED));
      if (fScalar) parts.push(chip(`f(r) ‖t<sub>u</sub> × t<sub>v</sub>‖ = <b>${fmt(fScalar(...r) * m)}</b>`));
      if (fField) parts.push(chip(`F(r) · (t<sub>u</sub> × t<sub>v</sub>) = <b>${fmt(st.flip * dot(fField(...r), n))}</b>`));
    } else {
      const val = riemann(st.m); const ex = exact();
      parts.push(chip(`<b>${st.m}</b> × <b>${st.m}</b> = <b>${st.m * st.m}</b> pieces`));
      parts.push(chip(`Riemann sum (${what}) = <b>${fmt(val)}</b>`, ORANGE));
      parts.push(chip(`integral ≈ <b>${fmt(ex)}</b>`, GREEN));
      const rel = Math.abs(ex) > 1e-9 ? Math.abs(val - ex) / Math.abs(ex) : Math.abs(val - ex);
      parts.push(`<span class="riemann-chip${rel < 0.01 ? ' is-close' : ''}">error <b>${(rel * 100).toFixed(2)}%</b></span>`);
    }
    readout.innerHTML = parts.join('');
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
  if (hasSum) {
    makeSlider('pieces m (m × m)', 1, 12, 1, () => st.m, (v) => { st.m = v; }, ORANGE);
  } else {
    makeSlider('u', umin, umax, (umax - umin) / 200, () => st.u, (v) => { st.u = v; }, 'var(--accent)');
    makeSlider('v (fraction of its range)', 0, 1, 0.005, () => st.s, (v) => { st.s = v; }, ORANGE);
    makeSlider('piece size du, dv', 0.02, 0.4, 0.01, () => st.size, (v) => { st.size = v; });
  }
  if (fField) addBtn('Flip orientation', () => { st.flip = -st.flip; refresh(); });
  function syncControls() {
    sliders.forEach(({ row, input, get }) => {
      const v = get();
      if (parseFloat(input.value) !== v) input.value = v;
      row.querySelector('.jsx-slider-val').textContent = fmt(v);
    });
  }
  const refresh = () => { updateReadout(); draw(); syncControls(); };

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

  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('surface-param').forEach(renderSurface);
});
