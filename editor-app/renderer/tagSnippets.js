// Toolbar-button skeleton snippets for the lecture tag vocabulary.
// Clicking a button inserts a skeleton and selects the title="" value
// so you can type the label immediately.
const PH = ''; // placeholder marker (zero-width, found by index)

const snippets = {
  definition: `<definition title="${PH}">\n  \n</definition>`,
  theorem: `<theorem title="${PH}">\n  \n</theorem>`,
  example: `<example title="${PH}">\n  \n</example>`,
  summary: `<summary title="${PH}">\n  \n</summary>`,
  step: `<step title="${PH}">\n  \n</step>`
};

export function insertSnippet(cm, tag) {
  const tpl = snippets[tag];
  if (!tpl) return;

  const cur = cm.getCursor();
  const sel = cm.getSelection();
  const text = sel ? `<${tag} title="${PH}">\n  ${sel}\n</${tag}>` : tpl;

  cm.replaceSelection(text);

  const startIdx = cm.indexFromPos(cur);
  const phOffset = text.indexOf('title="') + 'title="'.length;
  const from = cm.posFromIndex(startIdx + phOffset);
  cm.setSelection(from, from);
}
