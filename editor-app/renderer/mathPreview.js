import { enhanceLatexTextarea } from './latexSmartInput.js';

const MARGIN = 10;

// Positions a fixed-position popup near a CodeMirror text position, flipping
// above/below and clamping horizontally so it never runs off-screen and
// prefers whichever side of the cursor's line has enough room to avoid
// covering it.
function positionPopupNearCursor(cm, pop, pos) {
  const coords = cm.cursorCoords(pos, 'window');
  const rect = pop.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  const spaceBelow = viewportH - coords.bottom;
  const spaceAbove = coords.top;
  const placeBelow = spaceBelow >= rect.height + MARGIN || spaceBelow >= spaceAbove;

  const top = placeBelow
    ? Math.min(coords.bottom + MARGIN, viewportH - rect.height - MARGIN)
    : Math.max(coords.top - rect.height - MARGIN, MARGIN);

  const left = Math.min(
    Math.max(coords.left - rect.width / 2, MARGIN),
    viewportW - rect.width - MARGIN
  );

  pop.style.top = `${Math.max(top, MARGIN)}px`;
  pop.style.left = `${left}px`;
}

export function openLatexInputPopup(cm, closer, displayMode) {
  const cur = cm.getCursor();

  const pop = document.createElement('div');
  pop.className = 'latex-popup';
  pop.style.visibility = 'hidden';

  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.cols = 48;
  pop.appendChild(ta);

  const hint = document.createElement('span');
  hint.className = 'latex-popup-hint';
  hint.textContent = 'Tab expands snippets (\\frac, \\sqrt, ^, _, …) — Enter to insert, Esc to cancel';
  pop.appendChild(hint);

  document.body.appendChild(pop);
  positionPopupNearCursor(cm, pop, cur);
  pop.style.visibility = 'visible';
  enhanceLatexTextarea(ta);
  ta.focus();

  cm.replaceRange(' ', cur);
  const start = { ...cur };
  const end = { line: cur.line, ch: cur.ch + 1 };

  let liveMark = null;

  function render(tex) {
    if (liveMark) { liveMark.clear(); liveMark = null; }
    if (!tex) {
      liveMark = cm.markText(start, end, { replacedWith: document.createTextNode('⏳') });
      return;
    }
    try {
      const span = document.createElement('span');
      span.innerHTML = katex.renderToString(tex, { throwOnError: true, displayMode });
      liveMark = cm.markText(start, end, { replacedWith: span, handleMouseEvents: true });
    } catch {
      liveMark = cm.markText(start, end, { replacedWith: document.createTextNode('⏳') });
    }
  }

  render('');
  ta.addEventListener('input', () => render(ta.value.trim()));

  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const tex = ta.value.trim();
      const opener = closer === ')' ? '\\(' : '\\[';
      const finalText = `${opener}${tex}\\${closer}`;
      cm.replaceRange(finalText, start, end);
      const newEnd = { line: start.line, ch: start.ch + finalText.length };
      const span = document.createElement('span');
      span.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode });
      cm.markText(start, newEnd, { replacedWith: span, handleMouseEvents: true });
      pop.remove();
      cm.focus();
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (liveMark) liveMark.clear();
      cm.replaceRange('', start, end);
      pop.remove();
      cm.focus();
    }
  });

  ta.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(pop)) {
        if (liveMark) liveMark.clear();
        cm.replaceRange('', start, end);
        pop.remove();
      }
    }, 0);
  });
}

export function openLatexAttributePopup(cm, from, to, initialValue) {
  const pop = document.createElement('div');
  pop.className = 'latex-popup';
  pop.style.visibility = 'hidden';

  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.cols = 48;
  ta.value = initialValue || '';
  pop.appendChild(ta);

  const preview = document.createElement('span');
  preview.className = 'latex-popup-preview';
  pop.appendChild(preview);

  const hint = document.createElement('span');
  hint.className = 'latex-popup-hint';
  hint.textContent = 'Editing attribute LaTeX — Tab expands snippets — Enter to insert, Esc to cancel';
  pop.appendChild(hint);

  document.body.appendChild(pop);
  positionPopupNearCursor(cm, pop, from);
  pop.style.visibility = 'visible';
  enhanceLatexTextarea(ta);
  ta.focus();
  ta.select();

  function renderPreview(tex) {
    if (!tex) { preview.innerHTML = ''; return; }
    try {
      preview.innerHTML = katex.renderToString(tex, { throwOnError: true });
    } catch {
      preview.innerHTML = '⏳';
    }
  }

  renderPreview(ta.value.trim());
  ta.addEventListener('input', () => renderPreview(ta.value.trim()));

  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      cm.replaceRange(ta.value.trim(), from, to);
      pop.remove();
      cm.focus();
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      pop.remove();
      cm.focus();
    }
  });

  ta.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(pop)) pop.remove();
    }, 0);
  });
}
