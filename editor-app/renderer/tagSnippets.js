// Toolbar-button skeleton snippets for the lecture tag vocabulary.
// Clicking a button inserts a skeleton and places the cursor right after
// each snippet's `cursorAfter` marker, so you can start typing immediately.
// `wrap` (optional) builds an alternate snippet that wraps a text selection
// instead of inserting an empty skeleton.
const wrapAsTitleTag = (sel, tag) => `<${tag} title="">\n  ${sel}\n</${tag}>`;
const wrapAsListItem = (sel, tag) => `<${tag}>\n  <li>${sel}</li>\n</${tag}>`;

const snippets = {
  definition: { tpl: '<definition title="">\n  \n</definition>', cursorAfter: 'title="', wrap: wrapAsTitleTag },
  theorem: { tpl: '<theorem title="">\n  \n</theorem>', cursorAfter: 'title="', wrap: wrapAsTitleTag },
  example: { tpl: '<example title="">\n  \n</example>', cursorAfter: 'title="', wrap: wrapAsTitleTag },
  summary: { tpl: '<summary title="">\n  \n</summary>', cursorAfter: 'title="', wrap: wrapAsTitleTag },
  step: { tpl: '<step title="">\n  \n</step>', cursorAfter: 'title="', wrap: wrapAsTitleTag },
  ul: { tpl: '<ul>\n  <li></li>\n</ul>', cursorAfter: '<li>', wrap: wrapAsListItem },
  ol: { tpl: '<ol>\n  <li></li>\n</ol>', cursorAfter: '<li>', wrap: wrapAsListItem },
  geogebra: {
    tpl: '<geogebra perspective="2D">\n  \n</geogebra>',
    cursorAfter: 'perspective="2D">',
    wrap: null
  }
};

export function insertSnippet(cm, tag) {
  const entry = snippets[tag];
  if (!entry) return;

  const cur = cm.getCursor();
  const sel = cm.getSelection();
  const text = (sel && entry.wrap) ? entry.wrap(sel, tag) : entry.tpl;

  cm.replaceSelection(text);

  const startIdx = cm.indexFromPos(cur);
  const offset = text.indexOf(entry.cursorAfter) + entry.cursorAfter.length;
  const from = cm.posFromIndex(startIdx + offset);
  cm.setSelection(from, from);
}
