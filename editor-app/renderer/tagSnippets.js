// Toolbar-button skeleton snippets for the lecture tag vocabulary.
// Clicking a button inserts a skeleton and places the cursor right after
// each snippet's `cursorAfter` marker, so you can start typing immediately.
const snippets = {
  definition: { tpl: '<definition title="">\n  \n</definition>', cursorAfter: 'title="' },
  theorem: { tpl: '<theorem title="">\n  \n</theorem>', cursorAfter: 'title="' },
  example: { tpl: '<example title="">\n  \n</example>', cursorAfter: 'title="' },
  summary: { tpl: '<summary title="">\n  \n</summary>', cursorAfter: 'title="' },
  step: { tpl: '<step title="">\n  \n</step>', cursorAfter: 'title="' },
  ul: { tpl: '<ul>\n  <li></li>\n</ul>', cursorAfter: '<li>' },
  ol: { tpl: '<ol>\n  <li></li>\n</ol>', cursorAfter: '<li>' }
};

export function insertSnippet(cm, tag) {
  const entry = snippets[tag];
  if (!entry) return;

  const cur = cm.getCursor();
  const sel = cm.getSelection();
  const text = sel
    ? (entry.cursorAfter === '<li>' ? `<${tag}>\n  <li>${sel}</li>\n</${tag}>` : `<${tag} title="">\n  ${sel}\n</${tag}>`)
    : entry.tpl;

  cm.replaceSelection(text);

  const startIdx = cm.indexFromPos(cur);
  const offset = text.indexOf(entry.cursorAfter) + entry.cursorAfter.length;
  const from = cm.posFromIndex(startIdx + offset);
  cm.setSelection(from, from);
}
