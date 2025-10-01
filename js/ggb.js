// Build a GeoGebra iframe URL from a material id (same flags as your working version)
export function ggbUrl(id) {
  return `https://www.geogebra.org/material/iframe/id/${id}` +
         `/width/960/height/600/border/888888/rc/true/ai/true/sdz/true`;
}

// Inject or swap the GeoGebra iframe in #ggb-host (plain, no handlers)
export function loadGeoGebra(id) {
  const host = document.getElementById('ggb-host');
  if (!host || !id) return;

  host.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.className = 'ggb-frame';
  iframe.src = ggbUrl(id);
  iframe.title = 'GeoGebra Applet';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.style.border = '0';

  host.appendChild(iframe);
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
  if (!willExpand) closeFloat();
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