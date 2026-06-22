/* Tab-through templates for plain LaTeX, used inside the backtick math popup */
const PH = ""; // invisible placeholder char

const templates = {
  "\\frac"          : `\\frac{${PH}}{${PH}}`,
  "\\sqrt"          : `\\sqrt{${PH}}`,
  "^"               : `^{${PH}}`,
  "_"               : `_{${PH}}`,
  "\\vec"           : `\\vec{${PH}}`,
  "\\hat"           : `\\hat{${PH}}`,
  "\\overrightarrow": `\\overrightarrow{${PH}}`,
  "\\overline"      : `\\overline{${PH}}`,
  "\\pmatrix"  : `\\begin{pmatrix}${PH} & ${PH}\\\\${PH} & ${PH}\\end{pmatrix}`,
  "\\bmatrix"  : `\\begin{bmatrix}${PH} & ${PH}\\\\${PH} & ${PH}\\end{bmatrix}`,
  "\\vmatrix"  : `\\begin{vmatrix}${PH} & ${PH}\\\\${PH} & ${PH}\\end{vmatrix}`,
  "\\Vmatrix"  : `\\begin{Vmatrix}${PH} & ${PH}\\\\${PH} & ${PH}\\end{Vmatrix}`
};

export function enhanceLatexTextarea(ta) {
  ta.addEventListener("keydown", ev => {
    if (ev.key !== "Tab") return;

    const { value, selectionStart: s, selectionEnd: e } = ta;

    if (value[s] === PH) {
      ev.preventDefault();
      const next = value.indexOf(PH, s + 1);
      jump(ta, next !== -1 ? next : s);
      return;
    }

    const trigger = Object.keys(templates).find(t =>
      value.slice(s - t.length, s) === t && s === e
    );
    if (!trigger) return;

    ev.preventDefault();

    const tpl = templates[trigger];
    const before = value.slice(0, s - trigger.length);
    const after = value.slice(e);

    ta.value = before + tpl + after;

    const firstPH = before.length + tpl.indexOf(PH);
    jump(ta, firstPH);
  });
}

function jump(ta, idx) {
  if (idx < 0) return;
  ta.selectionStart = idx;
  ta.selectionEnd = idx + 1;
}
