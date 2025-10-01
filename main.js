// Build a GeoGebra iframe URL from a material id
function ggbUrl(id) {
  return `https://www.geogebra.org/material/iframe/id/${id}/width/960/height/600/border/888888/rc/true/ai/true/sdz/true`;
}

// Inject or swap the GeoGebra iframe in #ggb-host
function loadGeoGebra(id) {
  const host = document.getElementById('ggb-host');
  if (!host || !id) return;
  const iframe = document.createElement('iframe');
  iframe.className = 'ggb-frame';
  iframe.src = ggbUrl(id);
  iframe.title = 'GeoGebra Applet';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  //iframe.style.width = '100%';
  //iframe.style.height = '100%';
  iframe.style.border = '0';
  host.innerHTML = '';
  host.appendChild(iframe);
}

/* ==============================
   Floating GeoGebra Window
   ============================== */
const floatWin  = () => document.getElementById('ggb-float');
const backdrop  = () => document.getElementById('ggb-backdrop');
const expandBtn = () => document.getElementById('ggb-expand');
const closeBtn  = () => document.getElementById('ggb-close');
const dragBar   = () => document.getElementById('ggb-float-drag');

function openFloat(expanded = false) {
  const f = floatWin(); if (!f) return;
  f.setAttribute('aria-hidden', 'false');
  f.classList.toggle('expanded', !!expanded);
  const b = backdrop(); if (b) b.hidden = !expanded;
  const eb = expandBtn(); if (eb) {
    eb.textContent = expanded ? '↙ Collapse' : '↗ Expand';
    eb.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function closeFloat() {
  const f = floatWin(); if (!f) return;
  f.setAttribute('aria-hidden', 'true');
  f.classList.remove('expanded');
  // reset any manual positioning so it returns to default next time
  f.style.left = ''; f.style.top = ''; f.style.right = ''; f.style.bottom = '';
  const b = backdrop(); if (b) b.hidden = true;
  const eb = expandBtn(); if (eb) {
    eb.textContent = '↗ Expand';
    eb.setAttribute('aria-expanded', 'false');
  }
}

function toggleFloatExpand() {
  const f = floatWin(); if (!f) return;
  const willExpand = !f.classList.contains('expanded');
  f.classList.toggle('expanded', willExpand);
  const b = backdrop(); if (b) b.hidden = !willExpand;
  const eb = expandBtn(); if (eb) {
    eb.textContent = willExpand ? '↙ Collapse' : '↗ Expand';
    eb.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
  }
  // When collapsing from expanded, fully hide (per spec)
  if (!willExpand) closeFloat();
}

/* Optional: simple dragging when not expanded */
(function enableDrag() {
  const f = floatWin(); const bar = dragBar();
  if (!f || !bar) return;
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

  function onDown(e) {
    const expanded = f.classList.contains('expanded');
    if (expanded || f.getAttribute('aria-hidden') === 'true') return; // no drag when expanded or hidden
    dragging = true;
    const rect = f.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    startX = e.clientX; startY = e.clientY;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    f.style.left = `${startLeft + dx}px`;
    f.style.top  = `${startTop + dy}px`;
    f.style.right = 'auto';
    f.style.bottom = 'auto';
  }
  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  bar.addEventListener('mousedown', onDown);
})();

/* ==============================
   Steps / Slide Mode
   ============================== */
let slideMode = true;
let slideIndex = 0;

const allSteps = () => Array.from(document.querySelectorAll('.step'));

function centerStep(stepEl) {
  if (!stepEl) return;
  requestAnimationFrame(() => {
    const card = stepEl.closest('.card');
    if (!card) return;
    if (!slideMode) {
      const cardRect = card.getBoundingClientRect();
      const stepRect = stepEl.getBoundingClientRect();
      const delta = (stepRect.top + stepRect.height / 2) - (cardRect.top + cardRect.height / 2);
      card.scrollBy({ top: delta, behavior: 'smooth' });
    }
  });
}

function setCurrent(i) {
  const steps = allSteps();
  if (!steps.length) return;
  slideIndex = Math.max(0, Math.min(i, steps.length - 1));

  if (slideMode) {
    steps.forEach((s, idx) => {
      s.classList.toggle('is-visible', idx === slideIndex);
      s.classList.toggle('is-current', idx === slideIndex);
    });
  } else {
    steps.forEach((s, idx) => s.classList.toggle('is-current', idx === slideIndex));
    if (!steps[slideIndex].classList.contains('is-visible')) {
      steps[slideIndex].classList.add('is-visible');
    }
    centerStep(steps[slideIndex]);
  }

  updateControls();
}

function enterSlideMode() {
  slideMode = true;
  document.body.classList.add('slide-mode');
  setCurrent(slideIndex || 0);
}
function exitSlideMode() {
  slideMode = false;
  document.body.classList.remove('slide-mode');
  document.querySelectorAll('.step.is-current').forEach(s => s.classList.remove('is-current'));
  updateControls();
}

function nextSlide() { setCurrent(slideIndex + 1); }
function prevSlide() { setCurrent(slideIndex - 1); }

function updateControls() {
  const steps = allSteps();
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if (!btnPrev || !btnNext || !steps.length) return;
  btnPrev.disabled = (slideIndex <= 0);
  btnNext.disabled = (slideIndex >= steps.length - 1);
}

/* ==============================
   Boot
   ============================== */
document.addEventListener('DOMContentLoaded', () => {
  // Put a ▶ icon next to each step title that has a GeoGebra id
  document.querySelectorAll('.step[data-ggb-id]').forEach(step => {
    const id = step.dataset.ggbId;
    if (!id) return;
    const titleEl = step.querySelector('.step-title') || step;
    const btn = document.createElement('button');
    btn.className = 'step-icon';
    btn.type = 'button';
    btn.title = 'Open GeoGebra';
    btn.setAttribute('aria-label', 'Open GeoGebra');
    btn.dataset.ggbId = id;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M8 5v14l11-7-11-7z" fill="currentColor"/></svg>`;
    btn.style.marginLeft = '0.4rem';
    titleEl.appendChild(btn);
  });

  // Wire slide controls
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnExit = document.getElementById('btn-exit-slide');
  if (btnPrev) btnPrev.addEventListener('click', prevSlide);
  if (btnNext) btnNext.addEventListener('click', nextSlide);
  if (btnExit) btnExit.addEventListener('click', exitSlideMode);

  // ▶ click → open floating window + load applet (Cmd/Ctrl = open expanded)
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.step-icon');
    if (!btn) return;
    const id = btn.dataset.ggbId;
    if (id) loadGeoGebra(id);

    // if Ctrl/Cmd pressed → start expanded (80% centered), else small floating
    openFloat(e.ctrlKey || e.metaKey);

    // jump to that step in Slide Mode too
    const step = btn.closest('.step');
    if (!step) return;
    const steps = allSteps();
    const idx = steps.indexOf(step);
    if (idx >= 0) setCurrent(idx);
  });

  // Floating window controls
  const exp = expandBtn(); if (exp) exp.addEventListener('click', toggleFloatExpand);
  const cls = closeBtn();  if (cls) cls.addEventListener('click', closeFloat);
  const b   = backdrop();  if (b)   b.addEventListener('click', () => closeFloat());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const f = floatWin();
      if (f && f.getAttribute('aria-hidden') === 'false') { closeFloat(); return; }
      if (slideMode) { e.preventDefault(); exitSlideMode(); }
      return;
    }
    if (!slideMode) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
  });

  // Start in Slide Mode (centered single-step)
  enterSlideMode();
});