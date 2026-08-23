// Click-to-reveal primitive: <reveal>...</reveal> elements are hidden until
// clicked directly (toggle, any order), independent of slideMode.js's
// sequential data-reveal/reveal-inline system (which advances via Next/Prev).
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('reveal').forEach(el => {
    if (el.querySelector(':scope > .reveal-content')) return;
    const inner = document.createElement('span');
    inner.className = 'reveal-content';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('reveal');
    if (!el) return;
    el.classList.toggle('is-revealed');
  });
});
