// <coord-3d mode="cyl|sph" r="2" theta="2*pi/3" z="1" surfaces wedge>
//
// Cylindrical and spherical coordinates (calculus3 "Cylindrical and Spherical Integrals", OpenStax 5.5).
// A canvas 3D picture, drag to rotate, same approach as <solid-3d> (js/solid.js): plain canvas, own projection,
// painter's sort, no library. Two jobs, chosen by attribute:
//   (default)  a point P with sliders for its three coordinates. The construction is drawn (r along the floor,
//              the angle theta from the +x axis, then up z; or rho from the origin, theta on the floor and phi
//              from the +z axis) and the readout converts to x, y, z.
//   surfaces   adds buttons "fix r / theta / z" (or rho / theta / phi): the surface through P where that one
//              coordinate is held constant is drawn, so "what surface is r = c?" is something you guess, then see.
//   wedge      the volume element: the small piece r..r+dr, theta..theta+dtheta, z..z+dz (or rho, theta, phi).
//              Its edge lengths are labeled and the readout compares the exact volume with r* dr dtheta dz
//              (or rho*^2 sin(phi*) drho dphi dtheta), which is where the Jacobian comes from.
// Attributes: mode (cyl default | sph), r / rho, theta, z / phi (starting values, angles in radians, "pi" ok),
//   d="0.5,30,0.5" (starting wedge sizes: lengths, and angles in DEGREES), az, el (view angles in degrees).
// Colors follow one rule on this tag: blue = r / rho, orange = theta, green = z / phi.

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const ORANGE = '#e07b00';
const GREEN = '#2e8b57';

const MODES = {
  cyl: {
    names: ['r', 'θ', 'z'],
    lo: [-3, -3, -2],
    hi: [3, 3, 3],
    range: [[0, 3], [0, TAU], [-2, 3]],
    start: [2, (2 * Math.PI) / 3, 1],
    step: [0.25, 15, 0.25],
    toXYZ: (r, t, z) => [r * Math.cos(t), r * Math.sin(t), z],
    startAttr: ['r', 'theta', 'z'],
    d: [0.5, 30, 0.5],
    dRange: [[0.1, 1, 0.05], [5, 60, 5], [0.1, 1, 0.05]],
    dNames: ['dr', 'dθ', 'dz'],
    edge: ['dr', 'r dθ', 'dz'],
  },
  sph: {
    names: ['ρ', 'θ', 'φ'],
    lo: [-3, -3, -3],
    hi: [3, 3, 3],
    range: [[0, 3], [0, TAU], [0, Math.PI]],
    start: [3, Math.PI / 3, Math.PI / 4],
    step: [0.5, 15, 15],
    toXYZ: (p, t, f) => [p * Math.sin(f) * Math.cos(t), p * Math.sin(f) * Math.sin(t), p * Math.cos(f)],
    startAttr: ['rho', 'theta', 'phi'],
    d: [0.5, 30, 30],
    dRange: [[0.1, 1, 0.05], [5, 60, 5], [5, 60, 5]],
    dNames: ['dρ', 'dθ', 'dφ'],
    edge: ['dρ', 'ρ sin φ dθ', 'ρ dφ'],
  },
};
const COLORS = ['accent', ORANGE, GREEN];

function numAttr(el, name, dflt) {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') return dflt;
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    const v = new Function('pi', `return (${raw});`)(Math.PI);
    return Number.isFinite(v) ? v : dflt;
  } catch (err) {
    console.error(`<coord-3d>: could not parse ${name}="${raw}"`, err);
    return dflt;
  }
}

const fmt = (v) => {
  if (!Number.isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  const r = Number(v.toPrecision(4));
  return (Object.is(r, -0) || r === 0 ? 0 : r).toString().replace('-', '−');
};
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// an angle as a fraction of pi when it is a multiple of 15 degrees, else degrees
function angStr(rad) {
  const deg = Math.round(((rad / DEG) * 1000)) / 1000;
  if (Math.abs(deg) < 1e-9) return '0';
  const k = deg / 15;
  if (Math.abs(k - Math.round(k)) < 1e-9) {
    let n = Math.round(k); let d = 12;
    const g = gcd(Math.abs(n), d);
    n /= g; d /= g;
    return `${n === 1 ? '' : n === -1 ? '−' : n}π${d > 1 ? `/${d}` : ''}`;
  }
  return `${fmt(deg)}°`;
}

function renderCoord(el) {
  const modeName = (el.getAttribute('mode') || 'cyl').trim();
  const cfg = MODES[modeName];
  if (!cfg) {
    console.error(`<coord-3d>: mode="${modeName}" must be "cyl" or "sph"`);
    return;
  }
  const isWedge = el.hasAttribute('wedge');
  const hasSurfaces = el.hasAttribute('surfaces');
  const { names, lo, hi, range, toXYZ } = cfg;
  const isAngle = (k) => names[k] === 'θ' || names[k] === 'φ';

  const state = {
    p: cfg.start.map((v, k) => numAttr(el, cfg.startAttr[k], v)),
    d: (el.getAttribute('d') ? el.getAttribute('d').split(',').map(Number) : cfg.d).map((v, k) => (isAngle(k) ? v * DEG : v)),
    fix: -1,
    az: (numAttr(el, 'az', 35) * Math.PI) / 180,
    el: (numAttr(el, 'el', 24) * Math.PI) / 180,
  };
  if (state.d.length !== 3 || state.d.some((v) => !Number.isFinite(v))) state.d = cfg.d.map((v, k) => (isAngle(k) ? v * DEG : v));

  // ---- DOM ----
  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram';
  const readout = document.createElement('div');
  readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas solid-tall';
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = 'Drag the picture to rotate it.';
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  wrap.append(readout, canvas, hint, controls);
  el.replaceWith(wrap);

  // ---- projection (equal scale, z up on screen) ----
  const big = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  function project(x, y, z) {
    const X = (x - mid[0]) / big; const Y = (y - mid[1]) / big; const Z = (z - mid[2]) / big;
    const ca = Math.cos(state.az); const sa = Math.sin(state.az);
    const ce = Math.cos(state.el); const se = Math.sin(state.el);
    const u = X * ca - Y * sa;
    const w = X * sa + Y * ca;
    return { u, v: Z * ce + w * se, d: w * ce - Z * se };
  }
  const css = (name, dflt) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || dflt;
  const colorOf = (k) => (COLORS[k] === 'accent' ? css('--accent', '#0f6ab4') : COLORS[k]);

  // grid of quads over the two free parameters while parameter k is held at value v (or spans [v, v + width])
  function patch(k, v, pLo, pHi, nLin, nAng) {
    const [i, j] = [0, 1, 2].filter((m) => m !== k);
    const Ni = isAngle(i) ? nAng : nLin;
    const Nj = isAngle(j) ? nAng : nLin;
    const at = (a, b) => {
      const p = [0, 0, 0];
      p[k] = v; p[i] = pLo[i] + ((pHi[i] - pLo[i]) * a) / Ni; p[j] = pLo[j] + ((pHi[j] - pLo[j]) * b) / Nj;
      return toXYZ(...p);
    };
    const out = [];
    for (let a = 0; a < Ni; a++) for (let b = 0; b < Nj; b++) out.push([at(a, b), at(a + 1, b), at(a + 1, b + 1), at(a, b + 1)]);
    return out;
  }
  const fullLo = range.map((r) => r[0]);
  const fullHi = range.map((r) => r[1]);

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
    const ink = css('--ink', '#151515');
    const muted = css('--muted', '#6b7280');
    const line = css('--line', '#d5dbe3');

    // the view fits the whole coordinate box, or (wedge mode) a close-up of the small piece so its edges are legible
    let fitLo = lo; let fitHi = hi;
    if (isWedge) {
      const pts = [];
      for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) {
        pts.push(toXYZ(state.p[0] + (state.d[0] * a) / 2, state.p[1] + (state.d[1] * b) / 2, state.p[2] + (state.d[2] * c) / 2));
      }
      const padW = 0.35;
      fitLo = [0, 1, 2].map((k) => Math.min(...pts.map((q) => q[k])) - padW);
      fitHi = [0, 1, 2].map((k) => Math.max(...pts.map((q) => q[k])) + padW);
    }
    let umin = Infinity; let umax = -Infinity; let vmin = Infinity; let vmax = -Infinity;
    [fitLo[0], fitHi[0]].forEach((x) => [fitLo[1], fitHi[1]].forEach((y) => [fitLo[2], fitHi[2]].forEach((z) => {
      const p = project(x, y, z);
      umin = Math.min(umin, p.u); umax = Math.max(umax, p.u); vmin = Math.min(vmin, p.v); vmax = Math.max(vmax, p.v);
    })));
    const pad = 34;
    const sc = Math.min((cw - 2 * pad) / (umax - umin || 1), (ch - 2 * pad) / (vmax - vmin || 1));
    const cu = (umin + umax) / 2; const cv = (vmin + vmax) / 2;
    const S = (p) => { const q = project(p[0], p[1], p[2]); return [cw / 2 + (q.u - cu) * sc, ch / 2 - (q.v - cv) * sc, q.d]; };

    const faces = [];
    const quad = (pts, fill, stroke, alpha, lw = 1) => {
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
    const label = (p, text, color, dx = 8, dy = -8) => {
      const q = S(p);
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(text, q[0] + dx, q[1] + dy);
      ctx.fillStyle = color; ctx.fillText(text, q[0] + dx, q[1] + dy);
    };
    const dot = (p, color, rad) => {
      const q = S(p);
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    };
    const arc = (fn, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, i) => fn(a0 + ((a1 - a0) * i) / n));

    // floor: rings and spokes in the xy-plane
    const floor = [];
    for (let r = 1; r <= 3; r++) floor.push(arc((t) => [r * Math.cos(t), r * Math.sin(t), 0], 0, TAU, 60));
    for (let a = 0; a < 12; a++) floor.push([[0, 0, 0], [3 * Math.cos(a * 30 * DEG), 3 * Math.sin(a * 30 * DEG), 0]]);
    floor.forEach((pl) => poly(pl, line, 1.5));

    // the surface through P where one coordinate is held constant
    if (hasSurfaces && state.fix >= 0 && !isWedge) {
      const k = state.fix;
      const col = colorOf(k);
      patch(k, state.p[k], fullLo, fullHi, 6, k === 1 ? 12 : 36).forEach((qd) => quad(qd, col, 'rgba(60,70,90,0.28)', 0.2, 1));
    }

    // wedge faces
    const w = state.p; const dd = state.d;
    if (isWedge) {
      const wLo = [...w];
      const wHi = w.map((v, k) => v + dd[k]);
      [0, 1, 2].forEach((k) => {
        [wLo[k], wHi[k]].forEach((v, side) => {
          patch(k, v, wLo, wHi, 1, 8).forEach((qd) => quad(qd, colorOf(k), 'rgba(20,30,50,0.7)', side ? 0.5 : 0.38, 1.5));
        });
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

    // coordinate axes through the origin
    ctx.fillStyle = muted;
    ['x', 'y', 'z'].forEach((nm, k) => {
      const a = [0, 0, 0]; const b = [0, 0, 0];
      a[k] = lo[k]; b[k] = hi[k] * 1.12;
      poly([a, b], muted, 2.5);
      ctx.font = '700 20px system-ui, sans-serif';
      const q = S(b); ctx.fillText(nm, q[0] + 6, q[1] + 6);
    });

    if (isWedge) {
      // three edges leaving the corner, in the three coordinate colors, with their lengths
      const c0 = [...w];
      const edgeAt = (k) => arc((s) => { const p = [...c0]; p[k] = s; return toXYZ(...p); }, w[k], w[k] + dd[k], 16);
      [0, 1, 2].forEach((k) => poly(edgeAt(k), colorOf(k), 5));
      dot(toXYZ(...c0), ink, 6);
      const pm = (k) => { const p = [...c0]; p[k] += dd[k] / 2; return toXYZ(...p); };
      [0, 1, 2].forEach((k) => label(pm(k), cfg.edge[k], colorOf(k), 10, -10));
    } else {
      const P3 = toXYZ(...w);
      const [x, y, z] = P3;
      const Fp = [x, y, 0];
      const O = [0, 0, 0];
      const c0 = colorOf(0);
      if (modeName === 'cyl') {
        poly([O, Fp], c0, 5);
        poly([Fp, P3], GREEN, 5);
        poly([[x, y, 0], [x, 0, 0], [0, 0, 0]], line, 2, [6, 5]);
        if (w[0] > 0.05) {
          const ra = Math.min(0.9, w[0] * 0.5);
          if (w[1] > 0.02) poly(arc((t) => [ra * Math.cos(t), ra * Math.sin(t), 0], 0, w[1], 40), ORANGE, 5);
          label([ra * Math.cos(w[1] / 2), ra * Math.sin(w[1] / 2), 0], 'θ', ORANGE, 6, -4);
          label([x / 2, y / 2, 0], 'r', c0, 8, 20);
        }
        label([x, y, z / 2], 'z', GREEN, 10, 4);
        dot(Fp, muted, 5);
      } else {
        poly([O, P3], c0, 5);
        poly([P3, Fp], line, 2.5, [6, 5]);
        poly([O, Fp], line, 2.5, [6, 5]);
        const rf = Math.min(1.0, w[0] * 0.45 + 0.2);
        if (w[1] > 0.02) poly(arc((t) => [rf * Math.sin(w[2]) * Math.cos(t), rf * Math.sin(w[2]) * Math.sin(t), 0], 0, w[1], 40), ORANGE, 5);
        label([rf * Math.sin(w[2]) * Math.cos(w[1] / 2), rf * Math.sin(w[2]) * Math.sin(w[1] / 2), 0], 'θ', ORANGE, 6, 22);
        const rp = Math.min(1.3, w[0] * 0.6 + 0.1);
        if (w[2] > 0.02) poly(arc((f) => toXYZ(rp, w[1], f), 0, w[2], 40), GREEN, 5);
        label(toXYZ(rp * 1.18, w[1], w[2] / 2), 'φ', GREEN, 6, -2);
        label(toXYZ(w[0] / 2, w[1], w[2]), 'ρ', c0, 10, -6);
        dot(Fp, muted, 5);
      }
      dot(P3, ink, 8);
    }
  }

  // ---- readout ----
  const chip = (html, color) => `<span class="riemann-chip"${color ? ` style="border-color:${color}"` : ''}>${html}</span>`;
  function updateReadout() {
    const w = state.p; const dd = state.d;
    const parts = [];
    if (isWedge) {
      if (modeName === 'cyl') {
        const r = w[0]; const [dr, dt, dz] = dd;
        const rs = r + dr / 2;
        const exact = 0.5 * ((r + dr) ** 2 - r ** 2) * dt * dz;
        parts.push(chip(`dr = <b>${fmt(dr)}</b>`, colorOf(0)));
        parts.push(chip(`arc r dθ = <b>${fmt(r * dt)}</b>`, ORANGE));
        parts.push(chip(`dz = <b>${fmt(dz)}</b>`, GREEN));
        parts.push(chip(`exact ΔV = <b>${fmt(exact)}</b>`));
        parts.push(chip(`r* dr dθ dz = <b>${fmt(rs * dr * dt * dz)}</b> (r* = ${fmt(rs)}, the middle radius)`));
        parts.push(chip(`naive dr dθ dz = <b>${fmt(dr * dt * dz)}</b>`, 'var(--negative, #c0392b)'));
      } else {
        const [p, , f] = w; const [dp, dt, df] = dd;
        const ps = p + dp / 2; const fs = f + df / 2;
        const exact = ((((p + dp) ** 3 - p ** 3) / 3) * (Math.cos(f) - Math.cos(f + df)) * dt);
        parts.push(chip(`dρ = <b>${fmt(dp)}</b>`, colorOf(0)));
        parts.push(chip(`arc ρ sin φ dθ = <b>${fmt(p * Math.sin(f) * dt)}</b>`, ORANGE));
        parts.push(chip(`arc ρ dφ = <b>${fmt(p * df)}</b>`, GREEN));
        parts.push(chip(`exact ΔV = <b>${fmt(exact)}</b>`));
        parts.push(chip(`ρ*² sin φ* dρ dφ dθ = <b>${fmt(ps * ps * Math.sin(fs) * dp * df * dt)}</b>`));
        parts.push(chip(`naive dρ dφ dθ = <b>${fmt(dp * df * dt)}</b>`, 'var(--negative, #c0392b)'));
      }
    } else {
      const [x, y, z] = toXYZ(...w);
      if (modeName === 'cyl') {
        parts.push(chip(`(r, θ, z) = (<b>${fmt(w[0])}</b>, <b>${angStr(w[1])}</b>, <b>${fmt(w[2])}</b>)`));
        parts.push(chip(`x = r cos θ = <b>${fmt(x)}</b>`));
        parts.push(chip(`y = r sin θ = <b>${fmt(y)}</b>`));
        parts.push(chip(`(x, y, z) = (<b>${fmt(x)}</b>, <b>${fmt(y)}</b>, <b>${fmt(z)}</b>)`));
      } else {
        parts.push(chip(`(ρ, θ, φ) = (<b>${fmt(w[0])}</b>, <b>${angStr(w[1])}</b>, <b>${angStr(w[2])}</b>)`));
        parts.push(chip(`x = ρ sin φ cos θ = <b>${fmt(x)}</b>`));
        parts.push(chip(`y = ρ sin φ sin θ = <b>${fmt(y)}</b>`));
        parts.push(chip(`z = ρ cos φ = <b>${fmt(z)}</b>`));
        parts.push(chip(`r = ρ sin φ = <b>${fmt(Math.hypot(x, y))}</b>`));
      }
      if (hasSurfaces && state.fix >= 0) {
        const k = state.fix;
        parts.push(chip(`holding ${names[k]} = <b>${isAngle(k) ? angStr(w[k]) : fmt(w[k])}</b>`, colorOf(k)));
      }
    }
    readout.innerHTML = parts.join('');
  }

  // ---- controls ----
  const sliders = [];
  const makeSlider = (label, min, max, step, get, set, color) => {
    const row = document.createElement('label');
    row.className = 'jsx-slider-row';
    row.innerHTML = `<span class="jsx-slider-name" style="color:${color}">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="jsx-slider-val"></span>`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => { set(parseFloat(input.value)); refresh(); });
    input.addEventListener('pointerup', () => input.blur());
    controls.appendChild(row);
    sliders.push({ row, input, get });
  };
  const addBtn = (parent, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = text;
    b.addEventListener('pointerup', () => b.blur());
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  };
  const fixBtns = [];
  if (hasSurfaces && !isWedge) {
    const group = document.createElement('div');
    group.className = 'jsx-switch';
    [0, 1, 2].forEach((k) => {
      fixBtns[k] = addBtn(group, `fix ${names[k]}`, () => { state.fix = state.fix === k ? -1 : k; refresh(); });
    });
    controls.appendChild(group);
  }
  [0, 1, 2].forEach((k) => {
    const ang = isAngle(k);
    const [a, b] = ang ? [0, ang && names[k] === 'θ' ? 360 : 180] : range[k];
    makeSlider(names[k], a, b, cfg.step[k], () => (ang ? state.p[k] / DEG : state.p[k]), (v) => { state.p[k] = ang ? v * DEG : v; }, colorOf(k));
  });
  if (isWedge) {
    [0, 1, 2].forEach((k) => {
      const [a, b, s] = cfg.dRange[k];
      const ang = isAngle(k);
      makeSlider(cfg.dNames[k], a, b, s, () => (ang ? state.d[k] / DEG : state.d[k]), (v) => { state.d[k] = ang ? v * DEG : v; }, colorOf(k));
    });
  }
  function syncControls() {
    sliders.forEach(({ row, input, get }, idx) => {
      const v = get();
      if (parseFloat(input.value) !== v) input.value = v;
      const k = idx % 3;
      const ang = isAngle(k);
      row.querySelector('.jsx-slider-val').textContent = ang ? angStr(v * DEG) : fmt(v);
    });
    fixBtns.forEach((b, k) => b && b.classList.toggle('is-on', k === state.fix));
  }
  const refresh = () => { updateReadout(); draw(); syncControls(); };

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
  document.querySelectorAll('coord-3d').forEach(renderCoord);
});
