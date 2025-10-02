export const leftDrawer   = () => document.getElementById('left-drawer');
export const drawerHandle = () => document.getElementById('drawer-handle');
export const drawerClose  = () => document.getElementById('drawer-close');

export function openDrawer(){ const d=leftDrawer(); if(!d) return; d.classList.add('open'); d.setAttribute('aria-hidden','false'); const h=drawerHandle(); if(h) h.setAttribute('aria-expanded','true'); }
export function closeDrawer(){ const d=leftDrawer(); if(!d) return; d.classList.remove('open'); d.setAttribute('aria-hidden','true'); const h=drawerHandle(); if(h) h.setAttribute('aria-expanded','false'); }
export function toggleDrawer(){ const d=leftDrawer(); if(!d) return; d.classList.contains('open')?closeDrawer():openDrawer(); }

export async function loadKnowledgeAndRender() {
  try {
    const res = await fetch('/todopage/data/knowledge.json', { cache: 'no-cache' });
    const data = await res.json();
    const vocab = data.vocabulary || [];
    const concepts = data.concepts || [];
    const links = data.links || [];

    const vList = document.getElementById('vocab-list');
    const cList = document.getElementById('concepts-list');
    if (vList) { vList.innerHTML=''; vocab.forEach(w=>{ const li=document.createElement('li'); li.textContent=w; vList.appendChild(li); }); }
    if (cList) { cList.innerHTML=''; concepts.forEach(c=>{ const li=document.createElement('li'); li.textContent=c.label||c.id; cList.appendChild(li); }); }

    // tiny preview
    const svg = document.getElementById('map-preview-svg');
    if (svg) renderPreview(svg, concepts, links);
    // stash for modal
    window.__MAP_DATA__ = { concepts, links };
  } catch (e) { console.warn('knowledge.json load failed', e); }
}

// simple circular layout + draw (preview)
function layoutCircle(nodes, cx, cy, r){
  const n = nodes.length || 1;
  nodes.forEach((node,i)=>{ const t=(i/n)*Math.PI*2; node.x=cx+r*Math.cos(t); node.y=cy+r*Math.sin(t); });
}
function drawMap(svg, nodes, links){
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = 'http://www.w3.org/2000/svg';
  const gL = document.createElementNS(ns,'g');
  links.forEach(L=>{
    const a=nodes.find(n=>n.id===L.from), b=nodes.find(n=>n.id===L.to); if(!a||!b) return;
    const line=document.createElementNS(ns,'line');
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y); line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
    line.setAttribute('class','map-link'); gL.appendChild(line);
  });
  svg.appendChild(gL);
  const gN=document.createElementNS(ns,'g');
  nodes.forEach(N=>{
    const g=document.createElementNS(ns,'g'); g.setAttribute('class','map-node');
    const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',N.x); c.setAttribute('cy',N.y); c.setAttribute('r',24);
    const t=document.createElementNS(ns,'text'); t.setAttribute('x',N.x); t.setAttribute('y',N.y+4); t.setAttribute('text-anchor','middle'); t.textContent=N.label||N.id;
    g.appendChild(c); g.appendChild(t); gN.appendChild(g);
  });
  svg.appendChild(gN);
}
function renderPreview(svg, concepts, links){
  const nodes = concepts.map(c=>({id:c.id,label:c.label}));
  layoutCircle(nodes, 210, 130, 90);
  drawMap(svg, nodes, links);
}