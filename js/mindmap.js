const mapFloat    = () => document.getElementById('map-float');
const mapBackdrop = () => document.getElementById('map-backdrop');
const mapOpenBtn  = () => document.getElementById('map-open');
const mapCloseBtn = () => document.getElementById('map-close');
const mapCollapseBtn = () => document.getElementById('map-collapse');

export function wireMapModal(){
  const mo = mapOpenBtn();   if (mo) mo.addEventListener('click', openMap);
  const mc = mapCloseBtn();  if (mc) mc.addEventListener('click', closeMap);
  const mcol = mapCollapseBtn(); if (mcol) mcol.addEventListener('click', closeMap);
  const mb = mapBackdrop();  if (mb) mb.addEventListener('click', closeMap);
}

export function openMap(){
  const m = mapFloat(); if (!m) return;
  m.setAttribute('aria-hidden','false');
  const b = mapBackdrop(); if (b) b.hidden = false;
  renderLarge();
}
export function closeMap(){
  const m = mapFloat(); if (!m) return;
  m.setAttribute('aria-hidden','true');
  const b = mapBackdrop(); if (b) b.hidden = true;
}

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
    if (L.label) { const tx=(a.x+b.x)/2, ty=(a.y+b.y)/2; const t=document.createElementNS(ns,'text');
      t.setAttribute('x',tx); t.setAttribute('y',ty-4); t.setAttribute('text-anchor','middle'); t.textContent=L.label; gL.appendChild(t); }
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
function renderLarge(){
  const data = window.__MAP_DATA__ || { concepts: [], links: [] };
  const nodes = data.concepts.map(c=>({id:c.id,label:c.label}));
  const links = data.links;
  const svg = document.getElementById('map-svg'); if (!svg) return;
  layoutCircle(nodes, 600, 380, 260);
  drawMap(svg, nodes, links);
}