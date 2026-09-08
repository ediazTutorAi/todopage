// Load a material into #ggb-host via GGBApplet (deployggb.js) rather than the
// old `/material/iframe/id/<id>` embed URL -- GeoGebra retired that endpoint
// (it now 410s for every material id, old and new alike, not just this one),
// so GGBApplet + a `material_id` param is the current supported way to embed
// a saved material. Same deployggb.js script the command-list <geogebra> tag
// already loads per-lesson (see any lesson using <geogebra>), just loaded
// once here on demand instead of via a per-lesson <head> script, since
// data-ggb-id steps exist across many lessons that never had that script tag.
let deployReady = null;
function loadDeployScript() {
  if (deployReady) return deployReady;
  deployReady = new Promise((resolve, reject) => {
    if (window.GGBApplet) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://www.geogebra.org/apps/deployggb.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load deployggb.js'));
    document.head.appendChild(script);
  });
  return deployReady;
}

// Unlike the old iframe (which resized for free via CSS width/height:100%),
// an injected GGBApplet renders at a fixed pixel size and needs an explicit
// setSize() call whenever its container's real size changes (e.g. the
// Expand/Collapse toggle below) -- ggbApi holds the live Application API
// object (passed into appletOnLoad) so resizeGeoGebra() can call it.
let ggbApi = null;

// Inject or swap the GeoGebra applet in #ggb-host (plain, no handlers)
export function loadGeoGebra(id) {
  const host = document.getElementById('ggb-host');
  if (!host || !id) return;

  ggbApi = null;
  host.innerHTML = '';
  const container = document.createElement('div');
  container.id = 'ggb-host-applet';
  container.className = 'ggb-frame';
  host.appendChild(container);

  loadDeployScript().then(() => {
    const applet = new window.GGBApplet({
      material_id: id,
      width: host.clientWidth || 480,
      height: host.clientHeight || 360,
      showToolBar: true,
      showMenuBar: false,
      showAlgebraInput: true,
      showResetIcon: true,
      appName: 'classic',
      appletOnLoad: (api) => { ggbApi = api; },
    }, true);
    applet.inject(container.id);
  }).catch(err => console.error('[ggb]', err));
}

// Call after the floating panel's size changes (expand/collapse) so the
// applet actually fills its new container instead of staying at whatever
// size it was first injected at.
export function resizeGeoGebra() {
  const host = document.getElementById('ggb-host');
  if (!host || !ggbApi) return;
  ggbApi.setSize(host.clientWidth, host.clientHeight);
}

// Floating window controls (unchanged)
const floatWin  = () => document.getElementById('ggb-float');
const backdrop  = () => document.getElementById('ggb-backdrop');
const expandBtn = () => document.getElementById('ggb-expand');
const closeBtn  = () => document.getElementById('ggb-close');
const dragBar   = () => document.getElementById('ggb-float-drag');

export function openFloat(expanded = false) {
  const f = floatWin(); if (!f) return;
  f.setAttribute('aria-hidden', 'false');
  f.classList.toggle('expanded', !!expanded);
  const b = backdrop(); if (b) b.hidden = !expanded;
  const eb = expandBtn(); if (eb) {
    eb.textContent = expanded ? '↙ Collapse' : '↗ Expand';
    eb.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  resizeGeoGebra();
}
export function closeFloat() {
  const f = floatWin(); if (!f) return;
  f.setAttribute('aria-hidden', 'true');
  f.classList.remove('expanded');
  f.style.left = ''; f.style.top = ''; f.style.right = ''; f.style.bottom = '';
  const b = backdrop(); if (b) b.hidden = true;
  const eb = expandBtn(); if (eb) {
    eb.textContent = '↗ Expand';
    eb.setAttribute('aria-expanded', 'false');
  }
}
export function toggleFloatExpand() {
  const f = floatWin(); if (!f) return;
  const willExpand = !f.classList.contains('expanded');
  f.classList.toggle('expanded', willExpand);
  const b = backdrop(); if (b) b.hidden = !willExpand;
  const eb = expandBtn(); if (eb) {
    eb.textContent = willExpand ? '↙ Collapse' : '↗ Expand';
    eb.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
  }
  if (!willExpand) { closeFloat(); return; }
  resizeGeoGebra();
}

// Drag when not expanded (same as your working version)
export function enableGgbDrag() {
  const f = floatWin(); const bar = dragBar();
  if (!f || !bar) return;
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

  function onDown(e) {
    if (f.classList.contains('expanded') || f.getAttribute('aria-hidden') === 'true') return;
    dragging = true;
    const rect = f.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    startX = e.clientX; startY = e.clientY;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    f.style.left = `${startLeft + dx}px`;
    f.style.top  = `${startTop + dy}px`;
    f.style.right = 'auto';
    f.style.bottom = 'auto';
  }
  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  bar.addEventListener('mousedown', onDown);
}