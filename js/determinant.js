// Determinants (Linear Algebra 6.1). Two tags, plain DOM / SVG / canvas, no library, no CDN tags.
//
// <det-patterns matrix="1,2,3;4,5,6;7,8,10" editable swap sarrus nonzero|all presets="Name: r1;r2;.. | ...">
//   Definition 6.1.3 as something the instructor steps through. The matrix (n up to 6; rows separated by `;`) is
//   drawn with the current pattern circled, a line between every inverted pair (one entry to the right and above the
//   other), and a readout of prod P, the number of inversions, sgn P and the term (sgn P)(prod P). Next / Prev walk
//   through the patterns (lexicographic order of the chosen columns), a running sum builds det A, and the chips
//   underneath are clickable. Terms stay hidden until visited.
//   `nonzero` / `all`: list only the patterns with a nonzero product, or all n! of them (default: all for n <= 3,
//   nonzero for n >= 4; a button toggles). `editable` makes the entries inputs so any matrix can be typed in;
//   `swap` adds "swap columns / rows" buttons (alternating property); `sarrus` (3 x 3) adds a Patterns / Sarrus
//   switch, and Sarrus mode steps through the six diagonals of the extended matrix (Theorem 6.1.2). `presets` puts
//   matrices behind buttons.
//
// <det-3d u="2,0,0" v="0,2,0" w="1,1,2" box>
//   Definition 6.1.1 and Figure 1: A = [u v w], det A = u . (v x w). Draws the three column vectors, the plane
//   spanned by u and v, and the cross product v x w (perpendicular to v and w). Pick a vector and set its
//   components with the sliders; "Put w in the plane" makes u, v, w coplanar so v x w is perpendicular to u and
//   det A = 0; "Swap v and w" flips the sign (Example 4). Drag the picture to rotate it. `box` starts with the
//   parallelepiped spanned by u, v, w showing.

const BLUE = '#0f6ab4';
const RED = '#c0392b';
const GREEN = '#2e8b57';
const ORANGE = '#e07b00';
const GREY = '#4a5058';
const sub1 = ['₁', '₂', '₃', '₄', '₅', '₆'];

function fmt(v) {
  if (!Number.isFinite(v)) return '?';
  const r = Math.round(v * 1e6) / 1e6;
  return String(Object.is(r, -0) ? 0 : r).replace('-', '−');
}
const fmtP = (v) => (v < 0 ? `(${fmt(v)})` : fmt(v));
const signed = (v) => (v < 0 ? `−${fmt(-v)}` : `+${fmt(v)}`);

function parseMatrix(raw) {
  return raw.split(';').map((r) => r.split(',').map((t) => {
    const x = Number(t.trim());
    if (!Number.isFinite(x)) throw new Error(`bad entry "${t}"`);
    return x;
  }));
}

function permutations(n) {
  const out = [];
  const cur = []; const used = Array(n).fill(false);
  (function go() {
    if (cur.length === n) { out.push(cur.slice()); return; }
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      used[j] = true; cur.push(j); go(); cur.pop(); used[j] = false;
    }
  }());
  return out;
}

function inversionPairs(sigma) {
  const pairs = [];
  for (let i = 0; i < sigma.length; i++) for (let k = i + 1; k < sigma.length; k++) if (sigma[i] > sigma[k]) pairs.push([i, k]);
  return pairs;
}

function mkBtn(parent, label, on) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn'; b.textContent = label;
  b.addEventListener('pointerup', () => b.blur());
  b.addEventListener('click', () => on(b));
  parent.appendChild(b);
  return b;
}

// ---------------------------------------------------------------------------------------------------------------------
function renderDetPatterns(el) {
  const TAG = 'det-patterns';
  let M; const presets = [];
  try {
    M = parseMatrix(el.getAttribute('matrix') || '1,2;3,4');
    (el.getAttribute('presets') || '').split('|').map((t) => t.trim()).filter(Boolean).forEach((t) => {
      const i = t.indexOf(':');
      presets.push({ name: t.slice(0, i).trim(), m: parseMatrix(t.slice(i + 1)) });
    });
  } catch (err) {
    console.error(`<${TAG}>: could not parse an attribute`, err);
    return;
  }
  const checkSq = (m) => m.length >= 1 && m.length <= 6 && m.every((r) => r.length === m.length);
  if (!checkSq(M) || presets.some((p) => !checkSq(p.m))) {
    console.error(`<${TAG}>: matrices must be square, 1 x 1 up to 6 x 6`);
    return;
  }
  const editable = el.hasAttribute('editable');
  const wantSwap = el.hasAttribute('swap');
  const wantSarrus = el.hasAttribute('sarrus');
  let nonzeroOnly = el.hasAttribute('nonzero') ? true : (el.hasAttribute('all') ? false : M.length >= 4);

  const st = { mode: 'patterns', idx: 0, items: [], total: 0, nPat: 0, nNonzero: 0, raf: 0 };

  const wrap = document.createElement('div');
  wrap.className = 'det-diagram';
  const top = document.createElement('div'); top.className = 'jsx-transform-controls';
  const row = document.createElement('div'); row.className = 'det-row';
  const matBox = document.createElement('div'); matBox.className = 'det-matwrap';
  const panel = document.createElement('div'); panel.className = 'det-panel';
  row.append(matBox, panel);
  const controls = document.createElement('div'); controls.className = 'jsx-transform-controls';
  const chips = document.createElement('div'); chips.className = 'det-chips';
  wrap.append(top, row, controls, chips);
  el.replaceWith(wrap);

  // ---- items ----
  function build() {
    const n = M.length;
    st.items = [];
    if (st.mode === 'sarrus') {
      const diag = (r0, c0, dr, sign) => {
        const cells = [0, 1, 2].map((k) => [r0 + dr * k, c0 + k]);
        const vals = cells.map(([r, c]) => M[r][c % 3]);
        return { cells, vals, sign, lines: [[cells[0], cells[2]]], prod: vals.reduce((a, b) => a * b, 1) };
      };
      [0, 1, 2].forEach((c) => st.items.push(diag(0, c, 1, 1)));
      [0, 1, 2].forEach((c) => st.items.push(diag(2, c, -1, -1)));
      st.items.forEach((it) => { it.term = it.sign * it.prod; it.inv = null; });
      st.nPat = 6; st.nNonzero = st.items.filter((it) => it.prod !== 0).length;
    } else {
      const all = permutations(n).map((sigma) => {
        const cells = sigma.map((c, r) => [r, c]);
        const vals = cells.map(([r, c]) => M[r][c]);
        const prod = vals.reduce((a, b) => a * b, 1);
        const pairs = inversionPairs(sigma);
        const sign = pairs.length % 2 ? -1 : 1;
        return { sigma, cells, vals, prod, inv: pairs.length, sign, term: sign * prod, lines: pairs.map(([i, k]) => [cells[i], cells[k]]) };
      });
      st.nPat = all.length; st.nNonzero = all.filter((it) => it.prod !== 0).length;
      st.items = nonzeroOnly ? all.filter((it) => it.prod !== 0) : all;
    }
    st.total = st.items.reduce((s, it) => s + it.term, 0);
    if (st.idx >= st.items.length) st.idx = Math.max(0, st.items.length - 1);
  }

  // ---- matrix drawing ----
  let cellEls = []; let svg = null; let inputs = [];
  function drawMatrix() {
    const n = M.length;
    const cols = st.mode === 'sarrus' ? n + 2 : n;
    matBox.innerHTML = '';
    matBox.style.setProperty('--cols', cols);
    matBox.style.setProperty('--n', n);
    const grid = document.createElement('div'); grid.className = 'det-matrix';
    cellEls = []; inputs = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < cols; c++) {
        const ghost = c >= n;
        const v = M[r][c % n];
        let cell;
        if (editable && !ghost) {
          cell = document.createElement('input');
          cell.type = 'text'; cell.inputMode = 'decimal'; cell.value = fmt(v).replace('−', '-');
          cell.className = 'det-cell det-cell-input';
          cell.addEventListener('input', () => {
            const x = Number(cell.value.trim().replace('−', '-'));
            if (cell.value.trim() === '' || !Number.isFinite(x)) { cell.classList.add('is-bad'); return; }
            cell.classList.remove('is-bad');
            M[r][c] = x; st.idx = 0; rebuild(false);
          });
          inputs.push(cell);
        } else {
          cell = document.createElement('div');
          cell.className = 'det-cell';
          cell.textContent = fmt(v);
        }
        if (ghost) cell.classList.add('is-ghost');
        if (c === n) cell.classList.add('is-sep');
        grid.appendChild(cell);
        cellEls.push(cell);
      }
    }
    matBox.appendChild(grid);
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'det-overlay');
    svg.setAttribute('viewBox', `0 0 ${cols * 100} ${n * 100}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    matBox.appendChild(svg);
  }

  function syncInputs() {
    const n = M.length;
    inputs.forEach((inp, k) => {
      const r = Math.floor(k / n); const c = k % n;
      if (document.activeElement !== inp) inp.value = fmt(M[r][c]).replace('−', '-');
    });
  }

  function drawOverlay() {
    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    if (!st.items.length) return;
    const it = st.items[st.idx];
    const ctr = ([r, c]) => [c * 100 + 50, r * 100 + 50];
    const col = st.mode === 'sarrus' ? (it.sign > 0 ? BLUE : RED) : (it.sign > 0 ? BLUE : RED);
    it.lines.forEach(([a, b]) => {
      const p = ctr(a); const q = ctr(b);
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', p[0]); l.setAttribute('y1', p[1]); l.setAttribute('x2', q[0]); l.setAttribute('y2', q[1]);
      l.setAttribute('stroke', st.mode === 'sarrus' ? col : GREY);
      l.setAttribute('stroke-width', st.mode === 'sarrus' ? 7 : 5);
      l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('opacity', st.mode === 'sarrus' ? 0.75 : 0.9);
      svg.appendChild(l);
    });
    it.cells.forEach((cell) => {
      const p = ctr(cell);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 40);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', 6);
      c.setAttribute('stroke-dasharray', '14 8');
      svg.appendChild(c);
    });
  }

  // ---- readout ----
  function drawPanel() {
    const n = M.length;
    const lines = [];
    if (!st.items.length) {
      lines.push('<div class="det-line det-main">Every pattern contains a 0, so every term is 0 and <b>det A = 0</b>.</div>');
    } else {
      const it = st.items[st.idx];
      const prodTxt = `${it.vals.map(fmtP).join(' · ')} = <b>${fmt(it.prod)}</b>`;
      if (st.mode === 'sarrus') {
        lines.push(`<div class="det-line">Diagonal ${st.idx + 1} of 6 (${it.sign > 0 ? 'down to the right, <b style="color:' + BLUE + '">+</b>' : 'up to the right, <b style="color:' + RED + '">−</b>'})</div>`);
        lines.push(`<div class="det-line">product = ${prodTxt}</div>`);
        lines.push(`<div class="det-line det-main" style="color:${it.sign > 0 ? BLUE : RED}">term = ${signed(it.term)}</div>`);
      } else {
        lines.push(`<div class="det-line">Pattern ${st.idx + 1} of ${st.items.length}: columns <b>${it.sigma.map((c) => c + 1).join(', ')}</b></div>`);
        lines.push(`<div class="det-line">prod P = ${prodTxt}</div>`);
        lines.push(`<div class="det-line">inversions: <b>${it.inv}</b>, so sgn P = (−1)<sup>${it.inv}</sup> = <b style="color:${it.sign > 0 ? BLUE : RED}">${it.sign > 0 ? '+1' : '−1'}</b></div>`);
        lines.push(`<div class="det-line det-main" style="color:${it.sign > 0 ? BLUE : RED}">(sgn P)(prod P) = ${signed(it.term)}</div>`);
      }
      const sum = st.items.slice(0, st.idx + 1).reduce((s, x) => s + x.term, 0);
      const done = st.idx === st.items.length - 1;
      lines.push(`<div class="det-line det-sum">${done ? 'det A' : 'sum so far'} = <b>${fmt(sum)}</b></div>`);
    }
    if (st.mode === 'patterns' && st.nPat !== st.items.length) lines.push(`<div class="det-line muted small">${st.nNonzero} of the ${n}! = ${st.nPat} patterns have a nonzero product.</div>`);
    panel.innerHTML = lines.join('');
  }

  function drawChips() {
    chips.innerHTML = '';
    if (st.items.length > 60) return;
    st.items.forEach((it, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      const seen = k <= st.idx;
      b.className = `det-chip${k === st.idx ? ' is-current' : ''}${seen ? ' is-seen' : ''}`;
      b.textContent = seen ? signed(it.term) : '?';
      if (seen && it.term !== 0) b.style.color = it.term > 0 ? BLUE : RED;
      b.addEventListener('click', () => { stopPlay(); st.idx = k; refresh(); });
      chips.appendChild(b);
    });
  }

  let prevBtn; let nextBtn; let playBtn;
  function refresh() {
    drawOverlay(); drawPanel(); drawChips();
    if (prevBtn) { prevBtn.disabled = st.idx <= 0; nextBtn.disabled = st.idx >= st.items.length - 1; }
  }
  function rebuild(redrawMatrix = true) {
    build();
    if (redrawMatrix) drawMatrix(); else syncInputs();
    refresh();
  }

  function stopPlay() { if (st.raf) { clearInterval(st.raf); st.raf = 0; } if (playBtn) playBtn.textContent = 'Play'; }

  // ---- controls ----
  prevBtn = mkBtn(controls, '◀ Prev', () => { stopPlay(); st.idx = Math.max(0, st.idx - 1); refresh(); });
  nextBtn = mkBtn(controls, 'Next ▶', () => { stopPlay(); st.idx = Math.min(st.items.length - 1, st.idx + 1); refresh(); });
  playBtn = mkBtn(controls, 'Play', () => {
    if (st.raf) { stopPlay(); return; }
    if (st.idx >= st.items.length - 1) st.idx = 0;
    playBtn.textContent = 'Pause'; refresh();
    st.raf = setInterval(() => {
      if (st.idx >= st.items.length - 1) { stopPlay(); return; }
      st.idx += 1; refresh();
    }, 1100);
  });
  mkBtn(controls, 'Show all', () => { stopPlay(); st.idx = Math.max(0, st.items.length - 1); refresh(); });
  mkBtn(controls, 'Reset', () => { stopPlay(); st.idx = 0; refresh(); });

  if (wantSarrus && M.length === 3) {
    const sw = [];
    const pick = (mode) => { stopPlay(); st.mode = mode; st.idx = 0; sw.forEach((b) => b.classList.toggle('is-on', b.dataset.m === mode)); rebuild(); };
    ['patterns', 'sarrus'].forEach((m) => {
      const b = mkBtn(top, m === 'patterns' ? 'Patterns' : "Sarrus's rule", () => pick(m));
      b.dataset.m = m; sw.push(b);
    });
    sw[0].classList.add('is-on');
  }
  if (M.length >= 3 || presets.length) {
    const tg = mkBtn(top, 'Only nonzero patterns', (b) => {
      nonzeroOnly = !nonzeroOnly; b.classList.toggle('is-on', nonzeroOnly); stopPlay(); st.idx = 0; rebuild(false);
    });
    tg.classList.toggle('is-on', nonzeroOnly);
    tg.classList.add('det-nz');
  }
  if (presets.length) {
    const pb = presets.map((p) => mkBtn(top, p.name, (b) => {
      stopPlay(); M = p.m.map((r) => r.slice()); st.idx = 0;
      pb.forEach((o) => o.classList.toggle('is-on', o === b));
      if (!el.hasAttribute('nonzero') && !el.hasAttribute('all')) {
        nonzeroOnly = M.length >= 4;
        const nz = top.querySelector('.det-nz'); if (nz) nz.classList.toggle('is-on', nonzeroOnly);
      }
      rebuild();
    }));
    pb[0].classList.add('is-on');
  }
  if (wantSwap) {
    mkBtn(controls, 'Swap columns 2 ↔ 3', () => { stopPlay(); const c = Math.min(2, M.length - 1); M.forEach((r) => { [r[c - 1], r[c]] = [r[c], r[c - 1]]; }); st.idx = 0; rebuild(); });
    mkBtn(controls, 'Swap rows 1 ↔ 2', () => { stopPlay(); [M[0], M[1]] = [M[1], M[0]]; st.idx = 0; rebuild(); });
  }
  if (editable) {
    const hint = document.createElement('span'); hint.className = 'muted small'; hint.textContent = 'Click an entry to change it.';
    controls.appendChild(hint);
  }

  rebuild();
}

// ---------------------------------------------------------------------------------------------------------------------
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, c) => [a[0] * c, a[1] * c, a[2] * c];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const vec3 = (a) => `⟨${a.map(fmt).join(', ')}⟩`;

function renderDet3d(el) {
  const TAG = 'det-3d';
  const get = (k, d) => {
    const raw = (el.getAttribute(k) || d).split(',').map((t) => Number(t.trim()));
    if (raw.length !== 3 || raw.some((x) => !Number.isFinite(x))) { console.error(`<${TAG}>: could not parse ${k}`); return null; }
    return raw;
  };
  const init = [get('u', '2,0,0'), get('v', '0,2,0'), get('w', '1,1,2')];
  if (init.some((x) => !x)) return;
  const cols = init.map((c) => c.slice());
  const names = ['u', 'v', 'w'];
  const colors = [BLUE, GREEN, ORANGE];
  const ext = 3.4;
  const state = { sel: 2, box: el.hasAttribute('box'), az: 0.7, el: 0.45 };

  const wrap = document.createElement('div');
  wrap.className = 'riemann-diagram gs-diagram';
  const readout = document.createElement('div'); readout.className = 'riemann-readout';
  const canvas = document.createElement('canvas'); canvas.className = 'riemann-canvas gs-canvas';
  const hint = document.createElement('div'); hint.className = 'muted small riemann-hint'; hint.textContent = 'Drag the picture to rotate it.';
  const pick = document.createElement('div'); pick.className = 'jsx-transform-controls';
  const sliders = document.createElement('div'); sliders.className = 'jsx-transform-controls';
  const controls = document.createElement('div'); controls.className = 'jsx-transform-controls';
  wrap.append(readout, canvas, hint, pick, sliders, controls);
  el.replaceWith(wrap);

  const pickBtns = names.map((nm, i) => mkBtn(pick, `Change ${nm}`, () => { state.sel = i; buildSliders(); syncPick(); }));
  function syncPick() { pickBtns.forEach((b, i) => { b.classList.toggle('is-on', i === state.sel); b.style.color = i === state.sel ? colors[i] : ''; }); }

  let sliderEls = [];
  function buildSliders() {
    sliders.innerHTML = ''; sliderEls = [];
    ['x', 'y', 'z'].forEach((ax, k) => {
      const row = document.createElement('label'); row.className = 'jsx-slider-row';
      row.innerHTML = `<span class="jsx-slider-name">${names[state.sel]}<sub>${ax}</sub></span><input type="range" min="-3" max="3" step="0.5"><span class="jsx-slider-val"></span>`;
      const inp = row.querySelector('input'); const val = row.querySelector('.jsx-slider-val');
      inp.value = String(cols[state.sel][k]); val.textContent = fmt(cols[state.sel][k]);
      inp.addEventListener('input', () => { cols[state.sel][k] = parseFloat(inp.value); val.textContent = fmt(cols[state.sel][k]); refresh(); });
      inp.addEventListener('pointerup', () => inp.blur());
      sliders.appendChild(row); sliderEls.push({ inp, val });
    });
  }
  const syncSliders = () => sliderEls.forEach((s, k) => { s.inp.value = String(cols[state.sel][k]); s.val.textContent = fmt(cols[state.sel][k]); });

  mkBtn(controls, 'Swap v ↔ w', () => { [cols[1], cols[2]] = [cols[2], cols[1]]; syncSliders(); refresh(); });
  mkBtn(controls, 'Put w in the plane of u, v', () => { cols[2] = add3(cols[0], cols[1]); state.sel = 2; buildSliders(); syncPick(); refresh(); });
  const boxBtn = mkBtn(controls, 'Box', () => { state.box = !state.box; boxBtn.classList.toggle('is-on', state.box); draw(); });
  boxBtn.classList.toggle('is-on', state.box);
  mkBtn(controls, 'Reset', () => { init.forEach((c, i) => { cols[i] = c.slice(); }); buildSliders(); refresh(); });

  let W = 1; let H = 1;
  function P(v) {
    const s = Math.min(W, H) * 0.46 / ext;
    const ca = Math.cos(state.az); const sa = Math.sin(state.az);
    const ce = Math.cos(state.el); const se = Math.sin(state.el);
    const u = v[0] * ca - v[1] * sa;
    const w = v[0] * sa + v[1] * ca;
    return [W / 2 + u * s, H / 2 - (v[2] * ce + w * se) * s];
  }
  function seg(ctx, a, b, color, width, dash) {
    const p = P(a); const q = P(b);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
  }
  function arrow(ctx, a, b, color, width) {
    const p = P(a); const q = P(b);
    const dx = q[0] - p[0]; const dy = q[1] - p[1]; const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const ux = dx / len; const uy = dy / len;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0] - ux * 9, q[1] - uy * 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(q[0], q[1]);
    ctx.lineTo(q[0] - ux * 17 + uy * 7, q[1] - uy * 17 - ux * 7); ctx.lineTo(q[0] - ux * 17 - uy * 7, q[1] - uy * 17 + ux * 7);
    ctx.closePath(); ctx.fill();
  }
  function label(ctx, at, text, color, dx = 10, dy = -10) {
    const p = P(at); ctx.fillStyle = color; ctx.font = '700 24px system-ui, sans-serif'; ctx.fillText(text, p[0] + dx, p[1] + dy);
  }

  const stats = () => {
    const [u, v, w] = cols;
    const vw = cross3(v, w);
    const det = dot3(u, vw);
    return { vw, det: Math.round(det * 1e9) / 1e9, zero: Math.abs(det) < 1e-9 };
  };

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth; const chh = canvas.clientHeight;
    if (!cw || !chh) return;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cw; H = chh; ctx.clearRect(0, 0, W, H);
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#151515';
    const zero = [0, 0, 0];
    ['x', 'y', 'z'].forEach((nm, k) => {
      const e = [0, 0, 0]; e[k] = ext;
      seg(ctx, mul3(e, -1), e, '#b9bec6', 2); label(ctx, e, nm, '#8b919a', 6, 4);
    });
    const [u, v, w] = cols;
    const { vw, zero: isZero } = stats();
    // plane V = span(u, v)
    if (len3(cross3(u, v)) > 1e-9) {
      const k = 1.25;
      const q = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, t]) => P(add3(mul3(u, s * k), mul3(v, t * k))));
      ctx.fillStyle = isZero ? 'rgba(192,57,43,0.14)' : 'rgba(15,106,180,0.12)';
      ctx.strokeStyle = isZero ? 'rgba(192,57,43,0.5)' : 'rgba(15,106,180,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (state.box) {
      const corners = [];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) corners.push([a, b, c]);
      const pt = ([a, b, c]) => add3(add3(mul3(u, a), mul3(v, b)), mul3(w, c));
      corners.forEach((p) => corners.forEach((q) => {
        const d = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
        if (d === 1 && (p[0] + 2 * p[1] + 4 * p[2]) < (q[0] + 2 * q[1] + 4 * q[2])) seg(ctx, pt(p), pt(q), '#9aa0a8', 2, [7, 6]);
      }));
    }
    // v x w, drawn at a readable length (its true value is in the readout)
    const L = len3(vw);
    if (L > 1e-9) {
      const shown = mul3(vw, Math.min(1, (ext * 0.95) / L));
      arrow(ctx, zero, shown, RED, 4.5);
      label(ctx, shown, 'v × w', RED, 8, -8);
    }
    [u, v, w].forEach((c, i) => { arrow(ctx, zero, c, colors[i], 5.5); label(ctx, c, names[i], colors[i], 8, -10); });
    const o = P(zero); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(o[0], o[1], 5, 0, 7); ctx.fill();
  }

  function updateReadout() {
    const { vw, det, zero } = stats();
    const [u] = cols;
    readout.innerHTML =
      `<span class="riemann-chip">v × w = <b>${vec3(vw)}</b></span>` +
      `<span class="riemann-chip riemann-main" style="color:${zero ? RED : BLUE}">det A = u · (v × w) = ${vec3(u)} · ${vec3(vw)} = <b style="color:inherit">${fmt(det)}</b></span>` +
      `<span class="riemann-chip" style="${zero ? `border-color:${RED};background:#fdecea;color:${RED}` : ''}">${zero ? 'u ⟂ v × w: u, v, w lie in one plane, A is NOT invertible' : 'A is invertible'}</span>`;
  }
  function refresh() { updateReadout(); draw(); }

  canvas.style.touchAction = 'none';
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.az = drag.az - (e.clientX - drag.x) * 0.008;
    state.el = Math.max(-1.45, Math.min(1.45, drag.el + (e.clientY - drag.y) * 0.006));
    draw();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  new ResizeObserver(draw).observe(canvas);
  buildSliders(); syncPick(); refresh();
}

// ---------------------------------------------------------------------------------------------------------------------
// Properties of the determinant (Linear Algebra 6.2). Three tags, exact rational arithmetic (no rounding in the readouts).
//
// <det-elim matrix="0,7,5,3;1,1,2,1;1,1,2,-1;1,1,1,2" editable presets="Name: r1;r2;.. | ...">
//   Theorem 6.2.3 and Algorithm 6.2.5. The instructor applies elementary row operations (swap two rows, divide a row by k,
//   add k times a row to another row) and a log keeps the bookkeeping: s swaps and the scalars k1, ..., kr. At every moment
//   det A = (-1)^s k1 k2 ... kr det B holds for the current matrix B, and the readout shows it. "Next step" performs the
//   next operation of Gaussian elimination to an upper triangular matrix (what the book does in Example 4); Undo and Reset
//   are always there. `det A` itself stays hidden (click the chip) so it can be predicted first, then checked.
//
// <det-product a="1,2;3,4" b="0,1;5,2" power="3" editable>
//   Theorems 6.2.1, 6.2.6, 6.2.8 for 2 x 2 or 3 x 3 matrices: shows AB, A^T, A^m and A^-1 and the matching determinants.
//   Each right-hand side (det A)(det B), (det A)^m, 1/det A is a chip that stays `?` until clicked.
//
// <det-laplace matrix="1,0,1,2;9,1,3,0;9,2,2,0;5,0,0,3" along="col 2">
//   Theorem 6.2.10. Pick a row or column (the signs follow the checkerboard shown in the corner of every entry); each term
//   a_ij det(A_ij) is a card with the minor drawn, and its value stays hidden until the card is clicked. "Expand this
//   minor" makes the minor the new matrix (Example 6 expands a 3 x 3 minor again), and Back returns.

const gcdI = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const Fr = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcdI(n, d); return { n: n / g, d: d / g }; };
const fAdd = (a, b) => Fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a, b) => Fr(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a, b) => Fr(a.n * b.n, a.d * b.d);
const fDiv = (a, b) => Fr(a.n * b.d, a.d * b.n);
const fZero = (a) => a.n === 0;
const fStr = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`).replace('-', '−');
const fNum = (a) => a.n / a.d;
function parseFr(t) {
  const s = String(t).trim().replace('−', '-');
  let m;
  if ((m = /^(-?\d+)$/.exec(s))) return Fr(parseInt(m[1], 10));
  if ((m = /^(-?\d+)\/(\d+)$/.exec(s)) && parseInt(m[2], 10) !== 0) return Fr(parseInt(m[1], 10), parseInt(m[2], 10));
  if (/^-?\d*\.\d+$/.test(s)) return Fr(Math.round(parseFloat(s) * 1e6), 1e6);
  return null;
}
const frMat = (M) => M.map((r) => r.map((x) => (typeof x === 'number' ? Fr(x) : x)));
const cloneM = (M) => M.map((r) => r.slice());

// exact determinant by elimination
function detFr(M) {
  const n = M.length; const A = cloneM(M); let det = Fr(1);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && fZero(A[p][c])) p++;
    if (p === n) return Fr(0);
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; det = fMul(det, Fr(-1)); }
    det = fMul(det, A[c][c]);
    for (let r = c + 1; r < n; r++) {
      const f = fDiv(A[r][c], A[c][c]);
      for (let k = c; k < n; k++) A[r][k] = fSub(A[r][k], fMul(f, A[c][k]));
    }
  }
  return det;
}
const mulMat = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, _x, k) => fAdd(s, fMul(A[i][k], B[k][j])), Fr(0))));
const transposeM = (A) => A[0].map((_, j) => A.map((r) => r[j]));
function invFr(M) {
  const n = M.length; const A = M.map((r, i) => [...r, ...r.map((_, j) => Fr(i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && fZero(A[p][c])) p++;
    if (p === n) return null;
    [A[p], A[c]] = [A[c], A[p]];
    const pv = A[c][c];
    A[c] = A[c].map((x) => fDiv(x, pv));
    for (let r = 0; r < n; r++) if (r !== c && !fZero(A[r][c])) { const f = A[r][c]; A[r] = A[r].map((x, k) => fSub(x, fMul(f, A[c][k]))); }
  }
  return A.map((r) => r.slice(n));
}
const minorOf = (M, i, j) => M.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));
const isUpper = (M) => M.every((r, i) => r.every((x, j) => j >= i || fZero(x)));

// a matrix drawn with the existing .det-matwrap / .det-matrix / .det-cell styles
function matGrid(M, opts = {}) {
  const { cell = 3.6, font = 1.5, edit = null } = opts;
  const n = M.length; const m = M[0].length;
  const wrap = document.createElement('div');
  wrap.className = 'det-matwrap';
  wrap.style.setProperty('--cols', String(m)); wrap.style.setProperty('--cell', `${cell}rem`);
  const grid = document.createElement('div');
  grid.className = 'det-matrix';
  const cells = [];
  for (let i = 0; i < n; i++) {
    cells.push([]);
    for (let j = 0; j < m; j++) {
      const c = document.createElement('div');
      c.className = 'det-cell'; c.style.fontSize = `${font}rem`;
      if (edit) {
        const inp = document.createElement('input');
        inp.className = 'det-cell-input'; inp.style.fontSize = `${font}rem`; inp.value = fStr(M[i][j]).replace('−', '-');
        inp.addEventListener('change', () => edit(i, j, inp));
        inp.addEventListener('focus', () => inp.select());
        c.appendChild(inp);
      } else c.textContent = fStr(M[i][j]);
      grid.appendChild(c); cells[i].push(c);
    }
  }
  wrap.appendChild(grid);
  return { wrap, grid, cells };
}
function labelled(txt, node) {
  const box = document.createElement('div');
  box.style.textAlign = 'center';
  const cap = document.createElement('div');
  cap.className = 'muted small'; cap.textContent = txt;
  box.append(cap, node);
  return box;
}
function chip(html, cls = '') {
  const s = document.createElement('span');
  s.className = `riemann-chip ${cls}`; s.innerHTML = html;
  return s;
}
// a chip whose value is `?` until clicked
function hiddenChip(label, valueHtml, ok = null) {
  const s = document.createElement('button');
  s.type = 'button'; s.className = 'riemann-chip det-hidden-chip';
  let open = false;
  const paint = () => { s.innerHTML = `${label} <b>${open ? valueHtml : '?'}</b>`; s.classList.toggle('is-open', open); };
  s.addEventListener('click', () => { open = !open; paint(); });
  s.addEventListener('pointerup', () => s.blur());
  paint();
  void ok;
  return s;
}
const sel = (n, label, val = 0) => {
  const s = document.createElement('select'); s.className = 'det-select';
  for (let i = 0; i < n; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = `${label} ${i + 1}`; s.appendChild(o); }
  s.value = String(val);
  return s;
};

// ---------------------------------------------------------------------------------------------------------------------
function renderDetElim(el) {
  const TAG = 'det-elim';
  let first; const presets = [];
  try {
    first = frMat(parseMatrix(el.getAttribute('matrix') || '1,2;3,4'));
    (el.getAttribute('presets') || '').split('|').map((t) => t.trim()).filter(Boolean).forEach((t) => {
      const i = t.indexOf(':'); presets.push({ name: t.slice(0, i).trim(), m: frMat(parseMatrix(t.slice(i + 1))) });
    });
  } catch (err) { console.error(`<${TAG}>: could not parse an attribute`, err); return; }
  const editable = el.hasAttribute('editable');
  const st = { orig: cloneM(first), M: cloneM(first), log: [], s: 0, ks: [], hist: [] };

  const wrap = document.createElement('div'); wrap.className = 'det-diagram';
  const top = document.createElement('div'); top.className = 'jsx-transform-controls';
  const row = document.createElement('div'); row.className = 'det-row';
  const matBox = document.createElement('div'); matBox.style.position = 'relative'; matBox.style.marginLeft = '2.6rem';
  const panel = document.createElement('div'); panel.className = 'det-panel';
  row.append(matBox, panel);
  const ops = document.createElement('div'); ops.className = 'jsx-transform-controls';
  const ops2 = document.createElement('div'); ops2.className = 'jsx-transform-controls';
  const chips = document.createElement('div'); chips.className = 'jsx-trace-readout';
  wrap.append(top, row, ops, ops2, chips);
  el.replaceWith(wrap);
  const n0 = () => st.M.length;

  const snapshot = () => st.hist.push({ M: cloneM(st.M), log: st.log.slice(), s: st.s, ks: st.ks.slice() });
  const R = (i) => `R${'₁₂₃₄₅₆'[i]}`;
  function apply(kind, i, j, k) {
    snapshot();
    const M = st.M;
    if (kind === 'swap') { [M[i], M[j]] = [M[j], M[i]]; st.s++; st.log.push(`${R(i)} ↔ ${R(j)}   (swap: det changes sign)`); }
    if (kind === 'div') { M[i] = M[i].map((x) => fDiv(x, k)); st.ks.push(k); st.log.push(`${R(i)} ÷ ${fStr(k)} → ${R(i)}   (det B = (1/${fStr(k)}) det A)`); }
    if (kind === 'add') { M[j] = M[j].map((x, c) => fAdd(x, fMul(k, M[i][c]))); st.log.push(`${R(j)} ${fNum(k) < 0 ? '−' : '+'} ${fStr(Fr(Math.abs(k.n), k.d))}·${R(i)} → ${R(j)}   (det unchanged)`); }
    render();
  }
  function nextStep() {
    const M = st.M; const n = M.length;
    for (let c = 0; c < n - 1; c++) {
      if (fZero(M[c][c])) {
        const p = M.findIndex((r, i) => i > c && !fZero(r[c]));
        if (p > c) { apply('swap', c, p); return; }
        continue;
      }
      const r = M.findIndex((rw, i) => i > c && !fZero(rw[c]));
      if (r > c) { apply('add', c, r, fSub(Fr(0), fDiv(M[r][c], M[c][c]))); return; }
    }
  }

  function render() {
    const n = n0();
    matBox.textContent = '';
    const g = matGrid(st.M, {
      cell: n > 4 ? 3.2 : 3.6,
      edit: editable ? (i, j, inp) => {
        const v = parseFr(inp.value);
        if (!v) { inp.classList.add('is-bad'); return; }
        inp.classList.remove('is-bad');
        st.orig[i][j] = v; st.M = cloneM(st.orig); st.log = []; st.s = 0; st.ks = []; st.hist = []; render();
      } : null,
    });
    const labels = document.createElement('div');
    labels.style.cssText = 'position:absolute;left:-2.4rem;top:0.3rem;bottom:0.3rem;width:2.2rem;display:flex;flex-direction:column;';
    for (let i = 0; i < n; i++) { const l = document.createElement('span'); l.textContent = R(i); l.className = 'muted'; l.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:flex-end;font-size:1.1rem;'; labels.appendChild(l); }
    matBox.append(labels, g.wrap);

    panel.textContent = '';
    const log = document.createElement('div'); log.className = 'det-line muted small';
    log.innerHTML = st.log.length ? st.log.slice(-7).map((l) => `<div>${l}</div>`).join('') : 'Choose a row operation below, or press Next step.';
    panel.appendChild(log);

    const sign = st.s % 2 ? -1 : 1;
    let K = Fr(1); st.ks.forEach((k) => { K = fMul(K, k); });
    const detB = detFr(st.M); const detA = detFr(st.orig);
    const kTxt = st.ks.length ? st.ks.map((k) => `(${fStr(k)})`).join('') : '1';
    const book = document.createElement('div'); book.className = 'det-sum';
    book.innerHTML = `det A = (−1)<sup>${st.s}</sup> · ${kTxt} · det B`;
    panel.appendChild(book);

    chips.textContent = '';
    chips.appendChild(chip(`swaps s = <b>${st.s}</b>`));
    chips.appendChild(chip(`scalars k = <b>${st.ks.length ? st.ks.map(fStr).join(', ') : 'none'}</b>`));
    chips.appendChild(chip(`det B = <b>${fStr(detB)}</b>${isUpper(st.M) ? ' (B is upper triangular: the product of its diagonal entries, ' + st.M.map((r, i) => (fNum(r[i]) < 0 ? `(${fStr(r[i])})` : fStr(r[i]))).join(' · ') + ')' : ''}`));
    chips.appendChild(chip(`(−1)<sup>s</sup> k₁⋯k<sub>r</sub> · det B = <b>${fStr(fMul(fMul(Fr(sign), K), detB))}</b>`, 'riemann-main'));
    chips.appendChild(hiddenChip('det A computed directly:', fStr(detA)));
    undoBtn.disabled = st.hist.length === 0;
  }

  // controls
  presets.forEach((p, i) => {
    const b = mkBtn(top, p.name, () => { st.orig = cloneM(p.m); st.M = cloneM(p.m); st.log = []; st.s = 0; st.ks = []; st.hist = []; render(); [...top.children].forEach((o, k) => o.classList.toggle('is-on', k === i)); });
    if (i === 0) b.classList.add('is-on');
  });
  const n = first.length;
  mkBtn(ops, 'Next step ▶', () => nextStep());
  const undoBtn = mkBtn(ops, '↶ Undo', () => { const h = st.hist.pop(); if (h) { st.M = h.M; st.log = h.log; st.s = h.s; st.ks = h.ks; render(); } });
  mkBtn(ops, '↺ Reset', () => { st.M = cloneM(st.orig); st.log = []; st.s = 0; st.ks = []; st.hist = []; render(); });
  // manual operations
  const si = sel(n, 'row', 0); const sj = sel(n, 'row', 1);
  mkBtn(ops2, 'Swap', () => { if (si.value !== sj.value) apply('swap', +si.value, +sj.value); });
  ops2.append(si, document.createTextNode('↔'), sj);
  const di = sel(n, 'row', 0); const dk = document.createElement('input'); dk.value = '2'; dk.className = 'det-kinput';
  const gap = () => { const s = document.createElement('span'); s.style.width = '1rem'; return s; };
  ops2.append(gap());
  mkBtn(ops2, 'Divide', () => { const k = parseFr(dk.value); if (k && !fZero(k)) apply('div', +di.value, 0, k); });
  ops2.append(di, document.createTextNode('by'), dk);
  ops2.append(gap());
  const ak = document.createElement('input'); ak.value = '-1'; ak.className = 'det-kinput';
  const ai = sel(n, 'row', 0); const aj = sel(n, 'row', 1);
  mkBtn(ops2, 'Add', () => { const k = parseFr(ak.value); if (k && ai.value !== aj.value) apply('add', +ai.value, +aj.value, k); });
  ops2.append(ak, document.createTextNode('×'), ai, document.createTextNode('to'), aj);
  render();
}

// ---------------------------------------------------------------------------------------------------------------------
function renderDetProduct(el) {
  const TAG = 'det-product';
  let A; let B;
  try { A = frMat(parseMatrix(el.getAttribute('a') || '1,2;3,4')); B = frMat(parseMatrix(el.getAttribute('b') || '0,1;5,2')); } catch (err) { console.error(`<${TAG}>: could not parse a or b`, err); return; }
  const n = A.length;
  if (n < 2 || n > 3 || B.length !== n) { console.error(`<${TAG}>: a and b must both be 2 x 2 or 3 x 3`); return; }
  const editable = el.hasAttribute('editable');
  let m = Math.max(2, Math.min(6, Math.round(Number(el.getAttribute('power')) || 3)));
  const wrap = document.createElement('div'); wrap.className = 'det-diagram';
  const row1 = document.createElement('div'); row1.className = 'det-row';
  const row2 = document.createElement('div'); row2.className = 'det-row';
  const chips = document.createElement('div'); chips.className = 'jsx-trace-readout';
  wrap.append(row1, row2, chips);
  el.replaceWith(wrap);
  const cell = n === 3 ? 4.6 : 4.2; const font = 1.2;

  function render() {
    row1.textContent = ''; row2.textContent = ''; chips.textContent = '';
    const ed = (M) => (i, j, inp) => { const v = parseFr(inp.value); if (!v) { inp.classList.add('is-bad'); return; } M[i][j] = v; render(); };
    row1.append(
      labelled('A', matGrid(A, { cell, font, edit: editable ? ed(A) : null }).wrap),
      labelled('B', matGrid(B, { cell, font, edit: editable ? ed(B) : null }).wrap),
    );
    const AB = mulMat(A, B); const At = transposeM(A); const inv = invFr(A);
    let Am = A; for (let k = 1; k < m; k++) Am = mulMat(Am, A);
    row2.append(labelled('AB', matGrid(AB, { cell, font }).wrap), labelled('Aᵀ', matGrid(At, { cell, font }).wrap),
      labelled(`A${'²³⁴⁵⁶'[m - 2]}`, matGrid(Am, { cell, font }).wrap));
    if (inv) row2.append(labelled('A⁻¹', matGrid(inv, { cell, font }).wrap));
    else { const nb = document.createElement('div'); nb.className = 'muted'; nb.textContent = 'A is not invertible: no A⁻¹'; row2.append(nb); }

    const dA = detFr(A); const dB = detFr(B);
    const pair = (lhs, rhsLabel, rhs) => { chips.append(chip(lhs, 'riemann-main'), hiddenChip(rhsLabel, rhs)); };
    pair(`det A = <b>${fStr(dA)}</b>, det B = <b>${fStr(dB)}</b>, det(AB) = <b>${fStr(detFr(AB))}</b>`, '(det A)(det B) =', fStr(fMul(dA, dB)));
    pair(`det(Aᵀ) = <b>${fStr(detFr(At))}</b>`, 'det A =', fStr(dA));
    let pw = Fr(1); for (let k = 0; k < m; k++) pw = fMul(pw, dA);
    pair(`det(A${'²³⁴⁵⁶'[m - 2]}) = <b>${fStr(detFr(Am))}</b>`, `(det A)<sup>${m}</sup> =`, fStr(pw));
    if (inv) pair(`det(A⁻¹) = <b>${fStr(detFr(inv))}</b>`, '1 / det A =', fStr(fDiv(Fr(1), dA)));
    else chips.append(chip(`det A = 0, and A is not invertible (Theorem 6.2.4)`, 'is-undef'));
  }
  const ctl = document.createElement('div'); ctl.className = 'jsx-transform-controls';
  mkBtn(ctl, 'Power m: change', () => { m = m >= 6 ? 2 : m + 1; render(); });
  wrap.append(ctl);
  render();
}

// ---------------------------------------------------------------------------------------------------------------------
function renderDetLaplace(el) {
  const TAG = 'det-laplace';
  let M0;
  try { M0 = frMat(parseMatrix(el.getAttribute('matrix') || '1,2,3;4,5,6;7,8,10')); } catch (err) { console.error(`<${TAG}>: could not parse matrix`, err); return; }
  const bestLine = (M) => {
    let best = { z: -1, type: 'col', k: 0 };
    M.forEach((r, i) => { const z = r.filter(fZero).length; if (z > best.z) best = { z, type: 'row', k: i }; });
    for (let j = 0; j < M.length; j++) { const z = M.filter((r) => fZero(r[j])).length; if (z > best.z) best = { z, type: 'col', k: j }; }
    return best;
  };
  const st = { M: M0, stack: [], line: null, open: new Set(), focus: -1 };
  const along = /^(row|col)\w*\s+(\d+)$/i.exec(el.getAttribute('along') || '');
  st.line = along ? { type: along[1].toLowerCase(), k: parseInt(along[2], 10) - 1 } : bestLine(st.M);

  const wrap = document.createElement('div'); wrap.className = 'det-diagram';
  const top = document.createElement('div'); top.className = 'jsx-transform-controls';
  const row = document.createElement('div'); row.className = 'det-row'; row.style.alignItems = 'flex-start';
  const matBox = document.createElement('div');
  const panel = document.createElement('div'); panel.className = 'det-panel'; panel.style.flex = '2 1 22rem';
  row.append(matBox, panel);
  const ctl = document.createElement('div'); ctl.className = 'jsx-transform-controls';
  const sumBox = document.createElement('div'); sumBox.className = 'jsx-trace-readout';
  wrap.append(top, row, sumBox, ctl);
  el.replaceWith(wrap);

  const terms = () => {
    const n = st.M.length; const out = [];
    for (let t = 0; t < n; t++) {
      const i = st.line.type === 'col' ? t : st.line.k; const j = st.line.type === 'col' ? st.line.k : t;
      const a = st.M[i][j]; const sign = (i + j) % 2 ? -1 : 1;
      const mn = n > 1 ? minorOf(st.M, i, j) : null;
      const dm = mn ? detFr(mn) : Fr(1);
      out.push({ i, j, a, sign, mn, dm, val: fMul(fMul(Fr(sign), a), dm) });
    }
    return out;
  };

  function render() {
    const n = st.M.length; const T = terms();
    top.textContent = '';
    for (let k = 0; k < n; k++) {
      const b = mkBtn(top, `Row ${k + 1}`, () => { st.line = { type: 'row', k }; st.open = new Set(); st.focus = -1; render(); });
      b.classList.toggle('is-on', st.line.type === 'row' && st.line.k === k);
    }
    for (let k = 0; k < n; k++) {
      const b = mkBtn(top, `Column ${k + 1}`, () => { st.line = { type: 'col', k }; st.open = new Set(); st.focus = -1; render(); });
      b.classList.toggle('is-on', st.line.type === 'col' && st.line.k === k);
    }

    matBox.textContent = '';
    const g = matGrid(st.M, { cell: n > 4 ? 3.2 : 3.6 });
    const foc = st.focus >= 0 ? T[st.focus] : null;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = g.cells[i][j];
      c.style.position = 'relative';
      const tag = document.createElement('span');
      tag.textContent = (i + j) % 2 ? '−' : '+';
      tag.style.cssText = 'position:absolute;top:2px;right:6px;font-size:0.9rem;font-weight:800;color:' + ((i + j) % 2 ? '#c0392b' : '#2e8b57') + ';opacity:.8';
      c.appendChild(tag);
      const inLine = st.line.type === 'col' ? j === st.line.k : i === st.line.k;
      if (inLine) c.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)';
      if (foc && (i === foc.i || j === foc.j)) { c.style.opacity = '0.35'; c.style.textDecoration = 'line-through'; }
      if (foc && i === foc.i && j === foc.j) { c.style.opacity = '1'; c.style.textDecoration = 'none'; c.style.outline = '3px solid var(--accent)'; c.style.borderRadius = '10px'; }
    }
    matBox.appendChild(g.wrap);

    panel.textContent = '';
    const head = document.createElement('div'); head.className = 'det-line muted small';
    head.textContent = `Expansion ${st.line.type === 'col' ? 'down column' : 'along row'} ${st.line.k + 1}. Click a term to see its minor's determinant.`;
    panel.appendChild(head);
    const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.6rem;';
    T.forEach((t, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'border:2px solid var(--line);border-radius:12px;padding:0.4rem 0.7rem;min-width:9rem;cursor:pointer;' + (idx === st.focus ? 'border-color:var(--accent);background:#eaf3fb;' : '');
      const sg = t.sign > 0 ? '+' : '−';
      const open = st.open.has(idx);
      const title = document.createElement('div'); title.style.cssText = 'font-weight:800;font-size:1.2rem;';
      title.innerHTML = `${sg} a<sub>${t.i + 1}${t.j + 1}</sub> det(A<sub>${t.i + 1}${t.j + 1}</sub>) &nbsp;<span class="muted small">a = ${fStr(t.a)}</span>`;
      card.appendChild(title);
      if (fZero(t.a)) {
        const z = document.createElement('div'); z.className = 'muted'; z.textContent = 'a = 0: the term is 0, no minor needed';
        card.appendChild(z);
      } else if (t.mn) {
        card.appendChild(matGrid(t.mn, { cell: 2.2, font: 1.05 }).wrap);
      }
      const val = document.createElement('div'); val.style.cssText = 'font-weight:700;font-size:1.15rem;min-height:1.6rem;';
      val.innerHTML = open ? (fZero(t.a) ? '= 0' : `det = ${fStr(t.dm)}, term = <b>${fStr(t.val)}</b>`) : '?';
      card.appendChild(val);
      if (t.mn && t.mn.length >= 2 && !fZero(t.a)) {
        const eb = mkBtn(card, 'Expand this minor', () => { st.stack.push({ M: st.M, line: st.line }); st.M = t.mn; st.line = bestLine(st.M); st.open = new Set(); st.focus = -1; render(); });
        eb.classList.add('small'); eb.addEventListener('click', (e) => e.stopPropagation());
      }
      card.addEventListener('click', () => { if (st.open.has(idx)) { st.open.delete(idx); } else { st.open.add(idx); } st.focus = idx; render(); });
      list.appendChild(card);
    });
    panel.appendChild(list);

    sumBox.textContent = '';
    const shown = T.filter((_, idx) => st.open.has(idx));
    const partial = shown.reduce((s, t) => fAdd(s, t.val), Fr(0));
    const all = shown.length === T.length;
    sumBox.appendChild(chip(`det = Σ (−1)<sup>i+j</sup> a<sub>ij</sub> det(A<sub>ij</sub>): <b>${all ? fStr(partial) : (shown.length ? fStr(partial) + ' so far' : '?')}</b>`, 'riemann-main'));
    if (all) sumBox.appendChild(chip(`checked directly: det = <b>${fStr(detFr(st.M))}</b>`));

    ctl.textContent = '';
    mkBtn(ctl, 'Reveal all terms', () => { T.forEach((_, i) => st.open.add(i)); render(); });
    const back = mkBtn(ctl, '◀ Back to the bigger matrix', () => { const s = st.stack.pop(); if (s) { st.M = s.M; st.line = s.line; st.open = new Set(); st.focus = -1; render(); } });
    back.disabled = st.stack.length === 0;
  }
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('det-patterns').forEach(renderDetPatterns);
  document.querySelectorAll('det-3d').forEach(renderDet3d);
  document.querySelectorAll('det-elim').forEach(renderDetElim);
  document.querySelectorAll('det-product').forEach(renderDetProduct);
  document.querySelectorAll('det-laplace').forEach(renderDetLaplace);
});
