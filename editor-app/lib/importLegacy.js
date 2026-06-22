// Parses the .step markup out of a hand-written lecture's index.html so it
// can be opened/edited in the app, even though it wasn't created by it.
//
// Uses a depth-counting scan (not a naive regex) to find each step's true
// closing </div>, since step bodies can contain arbitrary nested HTML.

const KNOWN_TAGS = ['definition', 'theorem', 'example', 'summary'];
const STEP_OPEN_RE = /<div class="step[^"]*"\s+data-step="\d+"(?:\s+data-ggb-id="([^"]*)")?>/g;

function matchBalancedDiv(html, startIdx, openTagLength) {
  let pos = startIdx + openTagLength;
  let depth = 1;
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = pos;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) depth--; else depth++;
    if (depth === 0) {
      return { innerHtml: html.slice(pos, m.index), endIdx: m.index + m[0].length };
    }
  }
  return null; // unbalanced markup (e.g. a missing closing </div> in the source)
}

function inferTag(label) {
  const firstWord = (label || '').trim().split(/\s+/)[0]?.toLowerCase();
  return KNOWN_TAGS.includes(firstWord) ? firstWord : 'step';
}

function extractFirst(html, re) {
  const m = re.exec(html);
  return m ? m[1].trim() : '';
}

function parseLegacySteps(html) {
  const steps = [];
  STEP_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = STEP_OPEN_RE.exec(html)) !== null) {
    const ggbId = m[1] || '';
    const openTagLength = m[0].length;
    let result = matchBalancedDiv(html, m.index, openTagLength);

    if (!result) {
      // Recover from malformed source (e.g. a missing closing </div>) by
      // stopping at the next sibling step or the controls block.
      const rest = html.slice(m.index + openTagLength);
      const nextBoundary = rest.search(/<div class="step[^"]*"\s+data-step="\d+"|<!--\s*Controls/);
      const innerHtml = nextBoundary >= 0 ? rest.slice(0, nextBoundary) : rest;
      result = { innerHtml, endIdx: m.index + openTagLength + innerHtml.length };
    }

    const label = extractFirst(result.innerHtml, /<div class="step-title">([\s\S]*?)<\/div>/);
    const subtitle = extractFirst(result.innerHtml, /<div class="step-subtitle">([\s\S]*?)<\/div>/);

    const bodyOpenMatch = /<div class="step-body">/.exec(result.innerHtml);
    let bodyHtml = '';
    if (bodyOpenMatch) {
      const bodyResult = matchBalancedDiv(result.innerHtml, bodyOpenMatch.index, bodyOpenMatch[0].length);
      bodyHtml = (bodyResult ? bodyResult.innerHtml : result.innerHtml.slice(bodyOpenMatch.index + bodyOpenMatch[0].length)).trim();
    }

    steps.push({ tag: inferTag(label), label, subtitle, ggbId, bodyHtml });
    STEP_OPEN_RE.lastIndex = result.endIdx;
  }
  return steps;
}

module.exports = { parseLegacySteps };
