// <staged-svg> wraps an inline <svg> whose pieces carry data-stage="1", "2", ...
// Pieces with no data-stage are always visible. The instructor reveals the stages one at a
// time with the Next button (or by clicking the diagram itself), Back undoes one, Reset clears.
// A piece may carry data-caption="..." (plain text); the caption of the latest revealed stage is
// shown under the diagram. Built for flow charts (arrow by arrow), but works for any figure drawn
// as inline SVG. Plain DOM, no library; independent of <reveal> and of slideMode's Next/Prev.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('staged-svg').forEach((el) => {
    const svg = el.querySelector('svg');
    if (!svg) { console.error('<staged-svg>: needs an inline <svg> child.'); return; }
    const pieces = [...svg.querySelectorAll('[data-stage]')];
    const max = Math.max(0, ...pieces.map((p) => parseInt(p.dataset.stage, 10)));
    let stage = 0;

    const wrap = document.createElement('div');
    wrap.className = 'staged-diagram';
    el.replaceWith(wrap);
    const frame = document.createElement('div');
    frame.className = 'staged-frame';
    frame.appendChild(svg);
    const caption = document.createElement('div');
    caption.className = 'staged-caption';
    const bar = document.createElement('div');
    bar.className = 'staged-controls';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.textContent = label;
      b.addEventListener('pointerup', () => b.blur());
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    };
    const back = mk('◀ Back', () => set(stage - 1));
    const next = mk('Next arrow ▶', () => set(stage + 1));
    mk('↺ Reset', () => set(0));
    const count = document.createElement('span');
    count.className = 'muted small';
    bar.appendChild(count);
    frame.addEventListener('click', () => set(stage + 1));
    wrap.append(frame, caption, bar);

    function set(n) {
      stage = Math.max(0, Math.min(max, n));
      pieces.forEach((p) => {
        const s = parseInt(p.dataset.stage, 10);
        p.classList.toggle('staged-hidden', s > stage);
        p.classList.toggle('staged-new', s === stage && stage > 0);
      });
      const cur = pieces.find((p) => parseInt(p.dataset.stage, 10) === stage && p.dataset.caption);
      caption.textContent = stage === 0 ? 'Click the diagram or press Next to follow the first arrow.' : (cur ? cur.dataset.caption : '');
      back.disabled = stage === 0;
      next.disabled = stage === max;
      count.textContent = `${stage} / ${max}`;
    }
    set(0);
  });
});
