let slideMode = true;
let slideIndex = 0;

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
  } else {
    steps.forEach((s, idx) => s.classList.toggle('is-current', idx===slideIndex));
    if (!steps[slideIndex].classList.contains('is-visible')) steps[slideIndex].classList.add('is-visible');
    centerStep(steps[slideIndex]);
  }
  updateControls();
}
export function enterSlideMode(){ slideMode = true; document.body.classList.add('slide-mode'); setCurrent(slideIndex||0); }
export function exitSlideMode(){ slideMode = false; document.body.classList.remove('slide-mode'); document.querySelectorAll('.step.is-current').forEach(s=>s.classList.remove('is-current')); updateControls(); }
export function nextSlide(){ setCurrent(slideIndex+1); }
export function prevSlide(){ setCurrent(slideIndex-1); }

function updateControls(){
  const steps = allSteps();
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if (!btnPrev || !btnNext || !steps.length) return;
  btnPrev.disabled = (slideIndex <= 0);
  btnNext.disabled = (slideIndex >= steps.length - 1);
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