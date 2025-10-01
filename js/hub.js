// ---- helpers ----
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmtDate = (iso) => new Date(iso+'T00:00:00')
  .toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'});
const groupBy = (arr, fn) => arr.reduce((m,x)=>{const k=fn(x);(m[k]??=[]).push(x);return m;}, {});
const favKey = (u) => `fav::${u}`;
const isFav  = (u) => localStorage.getItem(favKey(u)) === '1';
const toggleFav = (u) => { const k=favKey(u); const now = localStorage.getItem(k) !== '1';
  localStorage.setItem(k, now?'1':'0'); return now; };

// ---- state ----
let DATA = [];
let STATE = { course:"", semester:"", q:"", favs:false, recent:false };

function inferSemester(iso){
  const d = new Date(iso+'T00:00:00'); const y=d.getFullYear(), m=d.getMonth()+1;
  return (m<=5) ? `Spring ${y}` : (m<=7 ? `Summer ${y}` : `Fall ${y}`);
}

async function load(){
  const res = await fetch('/todopage/data/lectures.json');
  const json = await res.json();

  DATA = json.map(x=>({
    ...x,
    dateObj: new Date((x.date||'1970-01-01') + 'T12:00:00'),
    semester: x.semester || inferSemester(x.date||'1970-01-01')
  })).sort((a,b)=>b.dateObj - a.dateObj);

  hydrateFilters(DATA);
  render();
}

function hydrateFilters(data){
  const courses = [...new Set(data.map(x=>x.course))].sort();
  const semesters = [...new Set(data.map(x=>x.semester))].sort((a,b)=>a<b?1:-1);
  const courseSel = $('#filter-course');
  const semSel = $('#filter-semester');
  courses.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; courseSel.appendChild(o); });
  semesters.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; semSel.appendChild(o); });
}

function applyFilters(){
  let out = [...DATA];
  if(STATE.course)   out = out.filter(x=>x.course===STATE.course);
  if(STATE.semester) out = out.filter(x=>x.semester===STATE.semester);
  if(STATE.favs)     out = out.filter(x=>isFav(x.url));
  if(STATE.q){
    const q = STATE.q.toLowerCase();
    out = out.filter(x =>
      (x.title||'').toLowerCase().includes(q) ||
      (x.course||'').toLowerCase().includes(q) ||
      (x.subtitle||'').toLowerCase().includes(q) ||
      (x.description||'').toLowerCase().includes(q) ||
      (x.tags||[]).some(t=>t.toLowerCase().includes(q)) ||
      (x.date||'').includes(q)
    );
  }
  if(STATE.recent) out.sort((a,b)=>b.dateObj - a.dateObj);
  return out;
}

function render(){
  const list = applyFilters();
  const groupsEl = $('#groups'); groupsEl.innerHTML = '';

  const byCourse = groupBy(list, x=>x.course||'Other');
  for(const course of Object.keys(byCourse).sort()){
    const bySem = groupBy(byCourse[course], x=>x.semester);
    for(const sem of Object.keys(bySem).sort((a,b)=>a<b?1:-1)){
      const groupEl = $('#tpl-group').content.firstElementChild.cloneNode(true);
      groupEl.querySelector('.group-title').textContent = `${course} — ${sem}`;
      const cardsEl = groupEl.querySelector('.cards');
      bySem[sem].forEach(item => cardsEl.appendChild(cardFor(item)));
      groupsEl.appendChild(groupEl);
    }
  }
  if(!list.length){
    groupsEl.innerHTML = `<div class="group"><p class="desc">No matches. Clear filters or try another search.</p></div>`;
  }
}

function cardFor(x){
  const el = $('#tpl-card').content.firstElementChild.cloneNode(true);
  el.querySelector('.eyebrow').textContent = `${x.course} · ${x.date ? fmtDate(x.date) : 'No date'}`;
  el.querySelector('.title').textContent = x.title || '(Untitled lecture)';
  el.querySelector('.meta').textContent = x.subtitle || '';
  el.querySelector('.desc').textContent = x.description || '';
  const tagsEl = el.querySelector('.tags');
  (x.tags || []).forEach(t=>{
    const s=document.createElement('span'); s.className='tag'; s.textContent=t; tagsEl.appendChild(s);
  });
  el.querySelector('a.btn').href = x.url;

  const favBtn = el.querySelector('.fav');
  const syncFav = ()=> favBtn.classList.toggle('active', isFav(x.url));
  favBtn.addEventListener('click', ()=>{ toggleFav(x.url); syncFav(); });
  syncFav();

  return el;
}

// ---- controls ----
$('#filter-course').addEventListener('change', e=>{ STATE.course=e.target.value; render(); });
$('#filter-semester').addEventListener('change', e=>{ STATE.semester=e.target.value; render(); });
$('#toggle-favorites').addEventListener('change', e=>{ STATE.favs=e.target.checked; render(); });
$('#toggle-recent').addEventListener('change', e=>{ STATE.recent=e.target.checked; render(); });
$('#search').addEventListener('input', e=>{ STATE.q=e.target.value.trim(); render(); });

// Keyboard shortcuts: / focus search, Esc clear
window.addEventListener('keydown', (ev)=>{
  if(ev.key==='/' && document.activeElement!==$('#search')){ ev.preventDefault(); $('#search').focus(); }
  if(ev.key==='Escape'){ $('#search').value=''; STATE.q=''; render(); }
});

load();
