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

// editing (optional): { tex, from, to } when re-opening an already-committed
// math span for revision, instead of inserting a brand-new one.
export function openLatexInputPopup(cm, closer, displayMode, editing) {
  const opener = closer === ')' ? '\\(' : '\\[';
  const cur = editing ? editing.from : cm.getCursor();

  const pop = document.createElement('div');
  pop.className = 'latex-popup';
  pop.style.visibility = 'hidden';

  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.cols = 48;
  if (editing) ta.value = editing.tex;
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
  if (editing) ta.select();

  let start, end;
  if (editing) {
    start = { ...editing.from };
    end = { ...editing.to };
  } else {
    cm.replaceRange(' ', cur);
    start = { ...cur };
    end = { line: cur.line, ch: cur.ch + 1 };
  }

  function commitSpan(tex) {
    const span = document.createElement('span');
    span.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode });
    const mark = cm.markText(start, end, { replacedWith: span, handleMouseEvents: true });
    span.addEventListener('click', () => {
      const range = mark.find();
      if (!range) return;
      mark.clear();
      openLatexInputPopup(cm, closer, displayMode, { tex, from: range.from, to: range.to });
    });
    return mark;
  }

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

  render(editing ? editing.tex : '');
  ta.addEventListener('input', () => render(ta.value.trim()));

  function cancel() {
    if (liveMark) { liveMark.clear(); liveMark = null; }
    if (editing) {
      commitSpan(editing.tex);
    } else {
      cm.replaceRange('', start, end);
    }
  }

  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const tex = ta.value.trim();
      if (liveMark) { liveMark.clear(); liveMark = null; }
      const finalText = `${opener}${tex}\\${closer}`;
      cm.replaceRange(finalText, start, end);
      end = { line: start.line, ch: start.ch + finalText.length };
      commitSpan(tex);
      pop.remove();
      cm.focus();
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cancel();
      pop.remove();
      cm.focus();
    }
  });

  ta.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(pop)) {
        cancel();
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
