// Converts between the editor's bracket-tag authoring format and the
// step-object shape used by templates/lecture-template.js.
//
// Format:
//   <theorem title="Theorem 3.3.7" subtitle="Rank-nullity theorem" ggb="123">
//   body text, supports HTML + LaTeX ($...$, $$...$$)
//   </theorem>

const TAG_NAMES = ['definition', 'theorem', 'example', 'summary', 'step'];
const TAG_RE = new RegExp(`<(${TAG_NAMES.join('|')})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'g');
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

function unescapeAttr(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function parseSteps(text) {
  const steps = [];
  let match;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(text)) !== null) {
    const [, tag, attrsStr, body] = match;
    const attrs = {};
    let a;
    ATTR_RE.lastIndex = 0;
    while ((a = ATTR_RE.exec(attrsStr)) !== null) {
      attrs[a[1]] = unescapeAttr(a[2]);
    }
    steps.push({
      tag,
      label: attrs.title || '',
      subtitle: attrs.subtitle || '',
      ggbId: attrs.ggb || '',
      reveal: /\breveal\b/.test(attrsStr),
      bodyHtml: body.trim()
    });
  }
  if (!steps.length && text.trim()) {
    throw new Error('No valid step tags found (expected <theorem>, <definition>, <example>, <summary>, or <step>)');
  }
  return steps;
}

function stepsToTagText(steps) {
  return (steps || []).map(step => {
    const tag = step.tag || 'step';
    let openTag = `<${tag} title="${escapeAttr(step.label)}"`;
    if (step.subtitle) openTag += ` subtitle="${escapeAttr(step.subtitle)}"`;
    if (step.ggbId) openTag += ` ggb="${escapeAttr(step.ggbId)}"`;
    if (step.reveal) openTag += ` reveal`;
    openTag += '>';
    return `${openTag}\n${step.bodyHtml || ''}\n</${tag}>`;
  }).join('\n\n');
}

module.exports = { parseSteps, stepsToTagText, TAG_NAMES };
