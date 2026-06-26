import { initEditor } from './editor.js';
import { insertSnippet } from './tagSnippets.js';

const els = {
  lectureList: document.getElementById('lecture-list'),
  btnNew: document.getElementById('btn-new'),
  course: document.getElementById('f-course'),
  date: document.getElementById('f-date'),
  title: document.getElementById('f-title'),
  subtitle: document.getElementById('f-subtitle'),
  tags: document.getElementById('f-tags'),
  description: document.getElementById('f-description'),
  notes: document.getElementById('f-notes'),
  addButtons: document.querySelectorAll('.step-add-buttons button'),
  btnSave: document.getElementById('btn-save'),
  statusMsg: document.getElementById('status-msg'),
  btnRefresh: document.getElementById('btn-refresh-preview'),
  courseOptions: document.getElementById('course-options'),
  metaToggle: document.getElementById('meta-toggle'),
  metaBody: document.getElementById('meta-body'),
  metaChevron: document.querySelector('#meta-toggle .meta-chevron'),
  metaSummary: document.getElementById('meta-summary')
};

const cm = initEditor(document.getElementById('tag-editor'));

let currentUrl = null; // null = new, unsaved lecture
const expandedCourses = new Set();
let cachedLectures = [];

function updateMetaSummary() {
  const parts = [els.course.value, els.date.value, els.title.value].filter(Boolean);
  els.metaSummary.textContent = parts.length ? parts.join(' · ') : 'New lecture';
}

function setMetaExpanded(expanded) {
  els.metaBody.hidden = !expanded;
  els.metaChevron.textContent = expanded ? '▾' : '▸';
  if (!expanded) updateMetaSummary();
}

function notesRawText() {
  return els.notes.dataset.raw ?? els.notes.textContent;
}

function renderNotesKatex() {
  const text = els.notes.textContent;
  els.notes.dataset.raw = text;
  const html = text.replace(/\$\$(.+?)\$\$/gs, (_, t) => {
    try { return katex.renderToString(t, { displayMode: true }); } catch { return `$$${t}$$`; }
  }).replace(/\$(.+?)\$/g, (_, t) => {
    try { return katex.renderToString(t, { displayMode: false }); } catch { return `$${t}$`; }
  });
  els.notes.innerHTML = html;
}

els.notes.addEventListener('focus', () => {
  els.notes.textContent = notesRawText();
});
els.notes.addEventListener('blur', renderNotesKatex);

els.metaToggle.addEventListener('click', () => {
  setMetaExpanded(els.metaBody.hidden);
});

els.addButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    insertSnippet(cm, btn.dataset.tag);
    cm.focus();
  });
});

function clearForm() {
  currentUrl = null;
  els.course.value = 'Calculus III';
  els.date.value = new Date().toISOString().slice(0, 10);
  els.title.value = '';
  els.subtitle.value = '';
  els.tags.value = '';
  els.description.value = '';
  els.notes.textContent = '';
  delete els.notes.dataset.raw;
  cm.setValue('');
  els.statusMsg.textContent = '';
  setMetaExpanded(true);
  highlightActiveLecture();
}

function fillForm(content) {
  els.course.value = content.course;
  els.date.value = content.date;
  els.title.value = content.title;
  els.subtitle.value = content.subtitle || '';
  els.tags.value = (content.tags || []).join(', ');
  els.description.value = content.description || '';
  els.notes.textContent = content.notes || '';
  delete els.notes.dataset.raw;
  if (content.notes) renderNotesKatex();
  cm.setValue(content.stepsText || '');
  cm.renderMathMarks();
  els.statusMsg.textContent = '';
  setMetaExpanded(false);
}

async function selectLecture(lecture) {
  const content = await window.lectureAPI.loadContent(lecture.url);
  currentUrl = lecture.url;
  expandedCourses.add(lecture.course || '(No course)');
  fillForm(content);
  highlightActiveLecture();
  cm.refresh();
  els.statusMsg.textContent = lecture.managed ? '' : 'Imported from existing HTML — saving will regenerate this lecture\'s index.html.';
}

function highlightActiveLecture() {
  els.lectureList.querySelectorAll('.lecture-item').forEach(it => {
    it.classList.toggle('active', it.dataset.url === currentUrl);
  });
}

async function deleteLecture(lec) {
  const ok = window.confirm(`Delete "${lec.title}"?\n\nThis removes its folder from disk and cannot be undone unless it's already committed to git.`);
  if (!ok) return;
  await window.lectureAPI.deleteLecture(lec.url);
  if (currentUrl === lec.url) clearForm();
  await refreshLectureList();
}

async function refreshLectureList() {
  cachedLectures = await window.lectureAPI.list();
  renderLectureList();
}

function renderLectureList() {
  els.lectureList.innerHTML = '';

  const courseNames = [...new Set(cachedLectures.map(l => l.course).filter(Boolean))].sort();
  els.courseOptions.innerHTML = courseNames.map(c => `<option value="${c}"></option>`).join('');

  const byCourse = new Map();
  for (const lec of cachedLectures) {
    const key = lec.course || '(No course)';
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(lec);
  }

  for (const course of [...byCourse.keys()].sort()) {
    const lecs = byCourse.get(course).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const isOpen = expandedCourses.has(course);

    const header = document.createElement('div');
    header.className = 'course-group-header';
    header.innerHTML = `<span class="course-chevron">${isOpen ? '▾' : '▸'}</span> ${course} <span class="course-count">${lecs.length}</span>`;
    header.addEventListener('click', () => {
      if (expandedCourses.has(course)) expandedCourses.delete(course);
      else expandedCourses.add(course);
      renderLectureList();
    });
    els.lectureList.appendChild(header);

    if (!isOpen) continue;

    for (const lec of lecs) {
      const item = document.createElement('div');
      item.className = 'lecture-item';
      item.dataset.url = lec.url;
      item.innerHTML = `
        <div class="lecture-item-main">
          <div>${lec.title}</div>
          <div class="l-date">${lec.date}${lec.managed ? '' : ' ⤓'}</div>
        </div>
        <button type="button" class="lecture-delete" title="Delete lecture">🗑</button>`;
      item.addEventListener('click', () => selectLecture(lec));
      item.querySelector('.lecture-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLecture(lec);
      });
      els.lectureList.appendChild(item);
    }
  }
  highlightActiveLecture();
}

els.btnRefresh.addEventListener('click', () => {
  if (!currentUrl) {
    els.statusMsg.textContent = 'Save the lecture first to preview it.';
    return;
  }
  window.lectureAPI.openPreview(currentUrl);
});
els.btnNew.addEventListener('click', clearForm);

els.btnSave.addEventListener('click', async () => {
  const data = {
    course: els.course.value,
    date: els.date.value,
    title: els.title.value.trim(),
    subtitle: els.subtitle.value.trim(),
    description: els.description.value.trim(),
    notes: notesRawText().trim(),
    tags: els.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    stepsText: cm.getValue()
  };

  try {
    let result;
    if (currentUrl) {
      result = await window.lectureAPI.saveContent(currentUrl, data);
      els.statusMsg.textContent = `Saved "${result.title}".`;
    } else {
      result = await window.lectureAPI.create(data);
      currentUrl = result.url;
      expandedCourses.add(result.course || '(No course)');
      els.statusMsg.textContent = `Created "${result.title}".`;
    }
    els.btnSave.classList.add('btn-saved');
    setTimeout(() => els.btnSave.classList.remove('btn-saved'), 2000);
    await refreshLectureList();
  } catch (err) {
    els.statusMsg.textContent = `Error: ${err.message}`;
  }
});

clearForm();
refreshLectureList();
