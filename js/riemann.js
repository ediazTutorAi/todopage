// <riemann-boxes f="27 - 2*x*x - y*y" xmin="0" xmax="3" ymin="0" ymax="3" m="2" n="2" rule="mid">
//
// Double integral over a rectangle, as boxes (calculus3 "Double Integrals", OpenStax 5.1).
// A canvas 3D view of the surface z = f(x, y) over R = [xmin,xmax] x [ymin,ymax], split into
// m x n sub-rectangles, one box per sub-rectangle whose height is f at that box's sample
// point. Readout shows the Riemann sum, the exact value (a very fine midpoint sum), and the
// error, so students watch the sum close in on the integral. Drag the picture to rotate it.
//
// Plain canvas + Pointer Events, no library, like <sign-circle>: dependency-free, and it only
// needs a painter's-algorithm face sort (a few thousand faces) rather than a 3D engine.
//
// Attributes:
//   f            JS expression in x and y. sin, cos, exp, sqrt, abs, log, pi are in scope.
//   m, n         starting subdivisions in x and y (default 2 and 2).
//   rule         ul | ur | ll | lr | mid  (sample point in each sub-rectangle; default mid).
//   sliders      show m/n sliders (`square` makes one slider drive both).
//   rules        show the five sample-point buttons.
//   play         "Refine" button that steps the subdivisions up so the sum converges.
//   max          largest m or n (default 24).
//   zmin, zmax   z range for the picture (default: sampled from f, including 0).
//   az, el       starting view angles in degrees (default 35 and 28).
//   no-points    don't mark sample points.
//   no-surface   don't draw the translucent surface.

const RULE_NAME = {
  ul: 'upper left', ur: 'upper right', ll: 'lower left', lr: 'lower right', mid: 'midpoint',
};

function compileXY(expr, tag) {
  try {
    // eslint-disable-next-line no-new-func -- instructor-authored lesson content, not user input.
    return new Function('x', 'y',
      'const {sin,cos,tan,exp,sqrt,abs,log,pow,PI:pi}=Math; return (' + expr + ');');
  } catch (err) {
    console.error(`<${tag}>: could not parse f="${expr}"`, err);
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
    console.error(`<riemann-boxes>: could not parse ${name}="${raw}"`, err);
    return dflt;
  }
}

const fmt = (v, d = 2) => {
  const r = Number(v.toFixed(d));
  return (Object.is(r, -0) ? 0 : r).toString().replace('-', '−');
};

function renderRiemann(el) {
  const f = compileXY(el.getAttribute('f') || '0', 'riemann-boxes');
  if (!f) return;
  const x0 = numAttr(el, 'xmin', 0);
  const x1 = numAttr(el, 'xmax', 1);
  const y0 = numAttr(el, 'ymin', 0);
  const y1 = numAttr(el, 'ymax', 1);
  const maxN = Math.max(2, Math.round(numAttr(el, 'max', 24)));
  const square = el.hasAttribute('square');
  const state = {
    m: Math.max(1, Math.round(numAttr(el, 'm', 2))),
    n: Math.max(1, Math.round(numAttr(el, 'n', 2))),
    rule: RULE_NAME[el.getAttribute('rule')] ? el.getAttribute('rule') : 'mid',
    az: (numAttr(el, 'az', 35) * Math.PI) / 180,
    el: (numAttr(el, 'el', 28) * Math.PI) / 180,
  };
  const showPoints = !el.hasAttribute('no-points');
  const showSurface = !el.hasAttribute('no-surface');

  // z range from a coarse sample of f (always includes the base plane z = 0).
  let zlo = 0;
  let zhi = 0;
  for (let i = 0; i <= 20; i++) {
    for (let j = 0; j <= 20; j++) {
      const z = f(x0 + ((x1 - x0) * i) / 20, y0 + ((y1 - y0) * j) / 20);
      if (Number.isFinite(z)) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
    }
  }
  const zmin = numAttr(el, 'zmin', zlo);
  const zmax = numAttr(el, 'zmax', zhi);

  // exact value: a very fine midpoint sum.
  let exact = 0;
  {
    const N = 400;
    const hx = (x1 - x0) / N;
    const hy = (y1 - y0) / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) exact += f(x0 + (i + 0.5) * hx, y0 + (j + 0.5) * hy);
    exact *= hx * hy;
  }

  // ---- DOM ----
  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram';
  const readout = document.createElement('div');
  readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas');
  canvas.className = 'riemann-canvas';
  const hint = document.createElement('div');
  hint.className = 'muted small riemann-hint';
  hint.textContent = 'Drag the picture to rotate it.';
  const controls = document.createElement('div');
  controls.className = 'jsx-transform-controls';
  wrap.append(readout, canvas, hint, controls);
  el.replaceWith(wrap);

  // ---- projection ----
  const xr = x1 - x0;
  const yr = y1 - y0;
  const big = Math.max(xr, yr);
  const zr = Math.max(1e-9, zmax - zmin);
  const nx = (x) => (x - (x0 + x1) / 2) / big;
  const ny = (y) => (y - (y0 + y1) / 2) / big;
  const nz = (z) => ((z - (zmin + zmax) / 2) / zr) * 0.62;
  function project(x, y, z) {
    const X = nx(x);
    const Y = ny(y);
    const Z = nz(z);
    const ca = Math.cos(state.az);
    const sa = Math.sin(state.az);
    const ce = Math.cos(state.el);
    const se = Math.sin(state.el);
    const u = X * ca - Y * sa;
    const w = X * sa + Y * ca;
    return { u, v: Z * ce + w * se, d: w * ce - Z * se };
  }

  const css = (name, dflt) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || dflt;

  function sampleAt(i, j, m, n, rule) {
    const dx = xr / m;
    const dy = yr / n;
    const fx = rule === 'mid' ? 0.5 : (rule === 'ul' || rule === 'll' ? 0 : 1);
    const fy = rule === 'mid' ? 0.5 : (rule === 'll' || rule === 'lr' ? 0 : 1);
    return [x0 + (i + fx) * dx, y0 + (j + fy) * dy];
  }

  function riemannSum() {
    const { m, n, rule } = state;
    let s = 0;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const [sx, sy] = sampleAt(i, j, m, n, rule);
        s += f(sx, sy);
      }
    }
    return s * (xr / m) * (yr / n);
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const accent = css('--accent', '#0f6ab4');
    const neg = css('--negative', '#c0392b');
    const ink = css('--ink', '#151515');
    const muted = css('--muted', '#6b7280');

    // fit: project the bounding box corners.
    let umin = Infinity; let umax = -Infinity; let vmin = Infinity; let vmax = -Infinity;
    [x0, x1].forEach((x) => [y0, y1].forEach((y) => [zmin, zmax].forEach((z) => {
      const p = project(x, y, z);
      umin = Math.min(umin, p.u); umax = Math.max(umax, p.u); vmin = Math.min(vmin, p.v); vmax = Math.max(vmax, p.v);
    })));
    const pad = 28;
    const sc = Math.min((cw - 2 * pad) / (umax - umin), (ch - 2 * pad) / (vmax - vmin));
    const cu = (umin + umax) / 2;
    const cv = (vmin + vmax) / 2;
    const toScreen = (x, y, z) => {
      const p = project(x, y, z);
      return [cw / 2 + (p.u - cu) * sc, ch / 2 - (p.v - cv) * sc, p.d];
    };

    const { m, n, rule } = state;
    const dx = xr / m;
    const dy = yr / n;
    const faces = [];
    const quad = (pts, fill, stroke, alpha) => {
      const sp = pts.map((q) => toScreen(q[0], q[1], q[2]));
      faces.push({ sp, d: sp.reduce((a, q) => a + q[2], 0) / sp.length, fill, stroke, alpha });
    };

    // translucent surface mesh
    if (showSurface) {
      const S = 22;
      for (let i = 0; i < S; i++) {
        for (let j = 0; j < S; j++) {
          const a = x0 + (xr * i) / S; const b = x0 + (xr * (i + 1)) / S;
          const c = y0 + (yr * j) / S; const e = y0 + (yr * (j + 1)) / S;
          quad([[a, c, f(a, c)], [b, c, f(b, c)], [b, e, f(b, e)], [a, e, f(a, e)]], '#9aa0a6', 'rgba(90,98,110,0.35)', 0.18);
        }
      }
    }
    // boxes
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const [sx, sy] = sampleAt(i, j, m, n, rule);
        const h = f(sx, sy);
        const a = x0 + i * dx; const b = a + dx; const c = y0 + j * dy; const e = c + dy;
        const col = h >= 0 ? accent : neg;
        const st = 'rgba(255,255,255,0.85)';
        quad([[a, c, h], [b, c, h], [b, e, h], [a, e, h]], col, st, 0.62);
        quad([[a, c, 0], [b, c, 0], [b, c, h], [a, c, h]], col, st, 0.45);
        quad([[a, e, 0], [b, e, 0], [b, e, h], [a, e, h]], col, st, 0.45);
        quad([[a, c, 0], [a, e, 0], [a, e, h], [a, c, h]], col, st, 0.45);
        quad([[b, c, 0], [b, e, 0], [b, e, h], [b, c, h]], col, st, 0.45);
      }
    }
    faces.sort((p, q) => q.d - p.d);

    // base rectangle and its grid
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(90,98,110,0.5)';
    const baseLine = (ax, ay, bx, by) => {
      const p = toScreen(ax, ay, 0); const q = toScreen(bx, by, 0);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    };
    for (let i = 0; i <= m; i++) baseLine(x0 + i * dx, y0, x0 + i * dx, y1);
    for (let j = 0; j <= n; j++) baseLine(x0, y0 + j * dy, x1, y0 + j * dy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    baseLine(x0, y0, x1, y0); baseLine(x1, y0, x1, y1); baseLine(x1, y1, x0, y1); baseLine(x0, y1, x0, y0);

    faces.forEach((fc) => {
      ctx.beginPath();
      fc.sp.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.globalAlpha = fc.alpha;
      ctx.fillStyle = fc.fill;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = fc.stroke;
      ctx.stroke();
    });

    // sample points on the box tops
    if (showPoints && m * n <= 100) {
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          const [sx, sy] = sampleAt(i, j, m, n, rule);
          const p = toScreen(sx, sy, f(sx, sy));
          ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
        }
      }
    }

    // axes labels at the base corner
    ctx.fillStyle = muted;
    ctx.font = '700 17px system-ui, sans-serif';
    const lab = (txt, x, y, z) => { const p = toScreen(x, y, z); ctx.fillText(txt, p[0] + 6, p[1] + 4); };
    lab('x', x1, y0, 0);
    lab('y', x0, y1, 0);
    lab('z', x0, y0, zmax);
    ctx.strokeStyle = muted; ctx.lineWidth = 2;
    const zA = toScreen(x0, y0, Math.min(0, zmin)); const zB = toScreen(x0, y0, zmax);
    ctx.beginPath(); ctx.moveTo(zA[0], zA[1]); ctx.lineTo(zB[0], zB[1]); ctx.stroke();
  }

  function updateReadout() {
    const { m, n, rule } = state;
    const S = riemannSum();
    const err = S - exact;
    readout.innerHTML =
      `<span class="riemann-chip">${m} × ${n} = <b>${m * n}</b> box${m * n === 1 ? '' : 'es'}</span>` +
      `<span class="riemann-chip">ΔA = ${fmt((xr / m) * (yr / n), 4)}</span>` +
      `<span class="riemann-chip">sample: ${RULE_NAME[rule]}</span>` +
      `<span class="riemann-chip riemann-main">Riemann sum = <b>${fmt(S)}</b></span>` +
      `<span class="riemann-chip">exact ∬ f dA = <b>${fmt(exact)}</b></span>` +
      `<span class="riemann-chip ${Math.abs(err) < 0.005 * Math.max(1, Math.abs(exact)) ? 'is-close' : ''}">error = ${err >= 0 ? '+' : ''}${fmt(err)}</span>`;
  }

  function refresh() {
    updateReadout();
    draw();
    syncControls();
  }

  // ---- controls ----
  const sliderRows = {};
  const makeSlider = (key, label) => {
    const row = document.createElement('label');
    row.className = 'jsx-slider-row';
    row.innerHTML = `<span class="jsx-slider-name">${label}</span>` +
      `<input type="range" min="1" max="${maxN}" step="1" value="${state[key === 'both' ? 'm' : key]}">` +
      '<span class="jsx-slider-val"></span>';
    const input = row.querySelector('input');
    input.addEventListener('input', () => {
      stopPlay();
      const v = parseInt(input.value, 10);
      if (key === 'both') { state.m = v; state.n = v; } else state[key] = v;
      refresh();
    });
    input.addEventListener('pointerup', () => input.blur());
    controls.appendChild(row);
    sliderRows[key] = row;
  };
  if (el.hasAttribute('sliders')) {
    if (square) makeSlider('both', 'm = n <small>subdivisions</small>');
    else { makeSlider('m', 'm <small>in x</small>'); makeSlider('n', 'n <small>in y</small>'); }
  }
  const ruleBtns = {};
  if (el.hasAttribute('rules')) {
    const group = document.createElement('div');
    group.className = 'jsx-switch';
    ['ul', 'ur', 'll', 'lr', 'mid'].forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.textContent = RULE_NAME[r];
      b.addEventListener('pointerup', () => b.blur());
      b.addEventListener('click', () => { stopPlay(); state.rule = r; refresh(); });
      group.appendChild(b);
      ruleBtns[r] = b;
    });
    controls.appendChild(group);
  }
  let timer = null;
  let playBtn = null;
  function stopPlay() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (playBtn) playBtn.textContent = '▶ Refine';
  }
  if (el.hasAttribute('play')) {
    playBtn = document.createElement('button');
    playBtn.type = 'button'; playBtn.className = 'btn'; playBtn.textContent = '▶ Refine';
    playBtn.addEventListener('pointerup', () => playBtn.blur());
    const startM = state.m;
    const startN = state.n;
    playBtn.addEventListener('click', () => {
      if (timer) { stopPlay(); return; }
      let k = 1;
      playBtn.textContent = '⏸ Pause';
      const tick = () => {
        state.m = k; state.n = k;
        refresh();
        if (k < maxN) { k += k < 6 ? 1 : (k < 12 ? 2 : 4); k = Math.min(k, maxN); timer = setTimeout(tick, 700); } else { timer = null; playBtn.textContent = '↺ Refine again'; }
      };
      tick();
    });
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset';
    reset.addEventListener('pointerup', () => reset.blur());
    reset.addEventListener('click', () => { stopPlay(); state.m = startM; state.n = startN; refresh(); });
    controls.append(playBtn, reset);
  }
  function syncControls() {
    Object.entries(sliderRows).forEach(([k, row]) => {
      const v = state[k === 'both' ? 'm' : k];
      const input = row.querySelector('input');
      if (parseInt(input.value, 10) !== v) input.value = v;
      row.querySelector('.jsx-slider-val').textContent = v;
    });
    Object.entries(ruleBtns).forEach(([r, b]) => b.classList.toggle('is-on', r === state.rule));
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
    state.el = Math.max(0.08, Math.min(1.45, drag.el + (e.clientY - drag.y) * 0.006));
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  window.addEventListener('resize', draw);

  refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('riemann-boxes').forEach(renderRiemann);
});
