// Generates a lecture index.html matching the structure used across the
// existing todopage lectures (post drawer/mindmap removal): KaTeX head,
// shared CSS, .card/.step markup, slide controls, GeoGebra float panel.

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stepHtml(step, index) {
  const ggbAttr = step.ggbId ? ` data-ggb-id="${escapeHtml(step.ggbId)}"` : '';
  return `        <div class="step is-visible" data-step="${index + 1}"${ggbAttr}>
          <div class="step-title">${escapeHtml(step.label)}</div>
          <div class="step-subtitle">${escapeHtml(step.subtitle || '')}</div>
          <div class="step-body">
            ${step.bodyHtml || ''}
          </div>
        </div>`;
}

function renderLectureHtml({ title, steps }) {
  const stepsHtml = steps.map(stepHtml).join('\n\n');
  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- KaTeX -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
  <script defer>
    window.addEventListener('load', function () {
      renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '\\\\[', right: '\\\\]', display: true},
          {left: '\\\\(', right: '\\\\)', display: false},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    });
  </script>

  <!-- CSS (split) -->
  <link rel="stylesheet" href="/todopage/css/base.css">
  <link rel="stylesheet" href="/todopage/css/steps.css">
  <link rel="stylesheet" href="/todopage/css/ggb-float.css">

</head>

<body>

  <header class="site-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta"></div>
  </header>

  <main class="container">
    <section class="single-col">
      <div class="card" id="left-card">

        <!-- STEPS -->
${stepsHtml}

        <!-- Controls -->
        <div class="reveal-controls" role="group" aria-label="Slide controls">
          <button id="btn-prev" type="button" class="btn" title="Previous (←)">◀ Prev</button>
          <button id="btn-next" type="button" class="btn" title="Next (Space/→)">Next ▶</button>
          <button id="btn-exit-slide" type="button" class="btn small" title="Exit Slide Mode">Exit</button>
        </div>
      </div>
    </section>
  </main>

  <!-- FLOATING GEO GEBRA WINDOW -->
  <div id="ggb-float" class="ggb-float" aria-hidden="true" role="dialog" aria-label="GeoGebra">
    <div class="ggb-float-header" id="ggb-float-drag">
      <span class="ggb-float-title">GeoGebra Applet</span>
      <div class="ggb-actions">
        <button id="ggb-expand" class="btn small" type="button" aria-expanded="false">↗ Expand</button>
        <button id="ggb-close" class="btn small" type="button">× Close</button>
      </div>
    </div>
    <div id="ggb-host" class="ggb-float-host">
      <div class="ggb-placeholder muted small">Open an applet with ▶</div>
    </div>
  </div>
  <div id="ggb-backdrop" class="ggb-backdrop" hidden></div>

  <!-- JS entry (ES modules) -->
  <script type="module" src="/todopage/js/boot.js"></script>

</body>

</html>
`;
}

module.exports = { renderLectureHtml };
