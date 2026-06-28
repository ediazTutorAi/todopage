let slideMode = true;
let slideIndex = 0;
let revealIndex = 0;
let revealUnits = null;

function buildRevealUnits(stepEl) {
  if (!stepEl || !stepEl.dataset.reveal) return null;
  const body = stepEl.querySelector('.step-body');
  if (!body) return null;
  const units = [];
  for (const child of body.children) {
    if (child.hasAttribute('reveal-inline')) {
      for (const span of child.children) units.push(span);
    } else {
      units.push(child);
    }
  }
  return units;
}

function resetReveal(stepEl) {
  revealUnits = buildRevealUnits(stepEl);
  if (!revealUnits) return;
  const body = stepEl.querySelector('.step-body');
  for (const child of body.children) {
    if (child.hasAttribute('reveal-inline')) {
      Array.from(child.children).forEach(s => s.classList.add('reveal-hidden'));
    } else {
      child.classList.add('reveal-hidden');
    }
  }
  revealIndex = 0;
}

function showNextRevealChild() {
  if (!revealUnits || revealIndex >= revealUnits.length) return;
  revealUnits[revealIndex].classList.remove('reveal-hidden');
  revealIndex++;
}

function hideLastRevealChild() {
  if (!revealUnits || revealIndex <= 0) return;
  revealIndex--;
  revealUnits[revealIndex].classList.add('reveal-hidden');
}

const allSteps = () => Array.from(document.querySelectorAll('.step'));

function centerStep(stepEl) {
  if (!stepEl) return;
  requestAnimationFrame(() => {
    const card = stepEl.closest('.card'); if (!card || slideMode) return;
    const cardRect = card.getBoundingClientRect(); const stepRect = stepEl.getBoundingClientRect();
    const delta = (stepRect.top + stepRect.height/2) - (cardRect.top + cardRect.height/2);
    card.scrollBy({ top: delta, behavior: 'smooth' });
  });
}

export function setCurrent(i) {
  const steps = allSteps(); if (!steps.length) return;
  slideIndex = Math.max(0, Math.min(i, steps.length - 1));
  if (slideMode) {
    steps.forEach((s, idx) => { s.classList.toggle('is-visible', idx===slideIndex); s.classList.toggle('is-current', idx===slideIndex); });
    resetReveal(steps[slideIndex]);
    if (typeof window._initGgbInStep === 'function') window._initGgbInStep(steps[slideIndex]);
  } else {
    steps.forEach((s, idx) => s.classList.toggle('is-current', idx===slideIndex));
    if (!steps[slideIndex].classList.contains('is-visible')) steps[slideIndex].classList.add('is-visible');
    centerStep(steps[slideIndex]);
  }
  updateControls();
}
export function enterSlideMode(){ slideMode = true; document.body.classList.add('slide-mode'); setCurrent(slideIndex||0); }
export function exitSlideMode(){ slideMode = false; document.body.classList.remove('slide-mode'); document.querySelectorAll('.step.is-current').forEach(s=>s.classList.remove('is-current')); updateControls(); }
export function nextSlide() {
  if (revealUnits && revealIndex < revealUnits.length) {
    showNextRevealChild();
    updateControls();
  } else {
    setCurrent(slideIndex + 1);
  }
}

export function prevSlide() {
  if (revealUnits && revealIndex > 0) {
    hideLastRevealChild();
    updateControls();
  } else {
    setCurrent(slideIndex - 1);
  }
}

function updateControls(){
  const steps = allSteps();
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if (!btnPrev || !btnNext || !steps.length) return;
  btnPrev.disabled = slideIndex <= 0 && (!revealUnits || revealIndex <= 0);
  btnNext.disabled = slideIndex >= steps.length - 1 && (!revealUnits || revealIndex >= revealUnits.length);
  document.querySelectorAll('.slide-dot').forEach((dot, i) => dot.classList.toggle('active', i === slideIndex));
}

export function injectSlideDots() {
  const steps = allSteps();
  const controls = document.querySelector('.reveal-controls');
  if (!controls || !steps.length) return;
  const bar = document.createElement('div');
  bar.className = 'slide-dots';
  steps.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slide-dot';
    dot.type = 'button';
    dot.title = `Slide ${i + 1}`;
    dot.addEventListener('click', () => setCurrent(i));
    bar.appendChild(dot);
  });
  controls.insertBefore(bar, controls.firstChild);
}

export function injectStepIcons(onClick){
  document.querySelectorAll('.step[data-ggb-id]').forEach(step => {
    const id = step.dataset.ggbId; if (!id) return;
    const titleEl = step.querySelector('.step-title') || step;
    const btn = document.createElement('button');
    btn.className = 'step-icon'; btn.type='button'; btn.title='Open GeoGebra'; btn.dataset.ggbId = id;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7-11-7z" fill="currentColor"/></svg>`;
    btn.style.marginLeft = '0.4rem'; titleEl.appendChild(btn);
  });
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.step-icon'); if (!btn) return;
    onClick(btn.dataset.ggbId, btn.closest('.step'));
  });
}