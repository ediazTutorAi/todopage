import { loadGeoGebra, openFloat, closeFloat, toggleFloatExpand, enableGgbDrag } from './ggb.js';
import { injectStepIcons, enterSlideMode, exitSlideMode, nextSlide, prevSlide, setCurrent } from './slideMode.js';
import { openDrawer, closeDrawer, toggleDrawer, drawerHandle, drawerClose, loadKnowledgeAndRender } from './drawer.js';
import { wireMapModal, closeMap } from './mindmap.js';

document.addEventListener('DOMContentLoaded', () => {
  // add ▶ buttons next to steps with data-ggb-id
  injectStepIcons((ggbId, stepEl) => {
    if (ggbId) loadGeoGebra(ggbId);
    openFloat(window.event && (window.event.ctrlKey || window.event.metaKey)); // Cmd/Ctrl opens expanded
    // jump to that step as current
    if (stepEl) {
      const steps = Array.from(document.querySelectorAll('.step'));
      const idx = steps.indexOf(stepEl);
      if (idx >= 0) setCurrent(idx);
    }
  });

  // slide controls
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnExit = document.getElementById('btn-exit-slide');
  if (btnPrev) btnPrev.addEventListener('click', prevSlide);
  if (btnNext) btnNext.addEventListener('click', nextSlide);
  if (btnExit) btnExit.addEventListener('click', exitSlideMode);

// ggb floating window controls
const exp = document.getElementById('ggb-expand'); if (exp) exp.addEventListener('click', toggleFloatExpand);
const cls = document.getElementById('ggb-close');  if (cls) cls.addEventListener('click', closeFloat);
const b   = document.getElementById('ggb-backdrop'); if (b) b.addEventListener('click', closeFloat);
enableGgbDrag();

  // left drawer
  const h = drawerHandle(); if (h) h.addEventListener('click', toggleDrawer);
  const dc = drawerClose(); if (dc) dc.addEventListener('click', closeDrawer);

  // mind map modal
  wireMapModal();

  // keyboard: Esc closes map → ggb → drawer → exit slide
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const map = document.getElementById('map-float');
      if (map && map.getAttribute('aria-hidden') === 'false') { closeMap(); return; }
      const ggb = document.getElementById('ggb-float');
      if (ggb && ggb.getAttribute('aria-hidden') === 'false') { closeFloat(); return; }
      const dr = document.getElementById('left-drawer');
      if (dr && dr.classList.contains('open')) { closeDrawer(); return; }
      if (document.body.classList.contains('slide-mode')) { e.preventDefault(); exitSlideMode(); }
      return;
    }
    if (!document.body.classList.contains('slide-mode')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
  });

  // load vocab/concepts
  loadKnowledgeAndRender();

  // start in Slide Mode
  enterSlideMode();
});