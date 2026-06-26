import { openLatexInputPopup, openLatexAttributePopup, renderMathMarks } from './mathPreview.js';

function getAttributeRange(cm, cur) {
  const line = cm.getLine(cur.line);
  const re = /(?:title|subtitle)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line))) {
    const valueStart = m.index + m[0].indexOf('"') + 1;
    const valueEnd = valueStart + m[1].length;
    if (cur.ch >= valueStart && cur.ch <= valueEnd) {
      return {
        from: { line: cur.line, ch: valueStart },
        to: { line: cur.line, ch: valueEnd },
        value: m[1]
      };
    }
  }
  return null;
}

export function initEditor(container) {
  const cm = CodeMirror(container, {
    mode: 'xml',
    theme: 'eclipse',
    lineNumbers: true,
    lineWrapping: true,
    autoCloseTags: true,
    matchBrackets: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
  });

  cm.on('keydown', (cmInstance, event) => {
    if (event.key === '`') {
      event.preventDefault();
      const attrRange = getAttributeRange(cmInstance, cmInstance.getCursor());
      if (attrRange) {
        openLatexAttributePopup(cmInstance, attrRange.from, attrRange.to, attrRange.value);
      } else {
        openLatexInputPopup(cmInstance, ')', false);
      }
      return;
    }

    if (event.key !== '(' && event.key !== '[') return;

    const cur = cmInstance.getCursor();
    const line = cmInstance.getLine(cur.line);
    const charBefore = line.charAt(cur.ch - 1);
    if (charBefore !== '\\') return;

    event.preventDefault();
    cmInstance.replaceRange('', { line: cur.line, ch: cur.ch - 1 }, cur);

    const closer = event.key === '(' ? ')' : ']';
    const displayMode = event.key === '[';
    openLatexInputPopup(cmInstance, closer, displayMode);
  });

  cm.renderMathMarks = () => renderMathMarks(cm);
  return cm;
}
