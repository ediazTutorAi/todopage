const fs = require('fs');
const path = require('path');
const { renderLectureHtml } = require('../templates/lecture-template');
const { parseSteps, stepsToTagText } = require('./parseTags');
const { parseLegacySteps } = require('./importLegacy');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LECTURES_JSON = path.join(REPO_ROOT, 'data', 'lectures.json');

const COURSE_DIRS = {
  'Calculus III': 'calculus3',
  'Linear Algebra': 'linear-algebra'
};

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferSemester(dateIso) {
  const d = new Date(dateIso + 'T00:00:00');
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return (m <= 5) ? `Spring ${y}` : (m <= 7 ? `Summer ${y}` : `Fall ${y}`);
}

function isValidDate(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const d = new Date(dateIso + 'T00:00:00');
  return !Number.isNaN(d.getTime());
}

function readLecturesJson() {
  const raw = fs.readFileSync(LECTURES_JSON, 'utf8');
  return JSON.parse(raw);
}

function writeLecturesJson(data) {
  // Write atomically (temp file + rename) so a concurrent read or a crash
  // mid-write can never observe a truncated/empty lectures.json.
  const tmpPath = `${LECTURES_JSON}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, LECTURES_JSON);
}

function listLectures() {
  return readLecturesJson();
}

function courseDirFor(course) {
  return COURSE_DIRS[course] || slugify(course);
}

function lectureDirFromUrl(url) {
  // url is "<courseDir>/<year>/<slug>/index.html" relative to REPO_ROOT
  return path.join(REPO_ROOT, path.dirname(url));
}

function createLecture({ course, date, title, subtitle, description, tags, stepsText }) {
  if (!course) throw new Error('Course is required');
  if (!title || !title.trim()) throw new Error('Title is required');
  if (!isValidDate(date)) throw new Error(`Invalid date: "${date}" (expected YYYY-MM-DD)`);

  const steps = parseSteps(stepsText || '');

  const courseDir = courseDirFor(course);
  const yearDir = date.slice(0, 4);
  const slug = `${date}-${slugify(title)}`;
  const relDir = path.join(courseDir, yearDir, slug);
  const absDir = path.join(REPO_ROOT, relDir);

  if (fs.existsSync(absDir)) {
    throw new Error(`A lecture folder already exists at ${relDir}`);
  }

  const semester = inferSemester(date);
  const content = {
    course, semester, date, title,
    subtitle: subtitle || '',
    description: description || '',
    tags: tags || [],
    steps
  };

  fs.mkdirSync(absDir, { recursive: true });
  fs.writeFileSync(path.join(absDir, 'content.json'), JSON.stringify(content, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(absDir, 'index.html'), renderLectureHtml(content), 'utf8');

  const url = path.join(relDir, 'index.html').split(path.sep).join('/');
  const lectures = readLecturesJson();
  lectures.push({ course, semester, date, title, subtitle: content.subtitle, description: content.description, tags: content.tags, url });
  writeLecturesJson(lectures);

  return { url, ...content, stepsText: stepsToTagText(steps) };
}

function isAppManaged(url) {
  const dir = lectureDirFromUrl(url);
  return fs.existsSync(path.join(dir, 'content.json'));
}

function importLegacyContent(url) {
  const dir = lectureDirFromUrl(url);
  const htmlPath = path.join(dir, 'index.html');
  if (!fs.existsSync(htmlPath)) throw new Error(`No index.html found at ${url}`);

  const lectures = readLecturesJson();
  const entry = lectures.find(l => l.url === url) || {};
  const html = fs.readFileSync(htmlPath, 'utf8');
  const steps = parseLegacySteps(html);

  return {
    course: entry.course || '',
    semester: entry.semester || (entry.date ? inferSemester(entry.date) : ''),
    date: entry.date || '',
    title: entry.title || '',
    subtitle: entry.subtitle || '',
    description: entry.description || '',
    tags: entry.tags || [],
    steps
  };
}

function loadContent(url) {
  const dir = lectureDirFromUrl(url);
  const contentPath = path.join(dir, 'content.json');
  const content = fs.existsSync(contentPath)
    ? JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    : importLegacyContent(url);
  return { ...content, stepsText: stepsToTagText(content.steps) };
}

function saveContent(url, { title, subtitle, description, tags, stepsText }) {
  const dir = lectureDirFromUrl(url);
  const contentPath = path.join(dir, 'content.json');
  const prev = fs.existsSync(contentPath)
    ? JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    : importLegacyContent(url);

  const steps = stepsText === undefined ? prev.steps : parseSteps(stepsText);
  const content = {
    ...prev,
    title: title ?? prev.title,
    subtitle: subtitle ?? prev.subtitle,
    description: description ?? prev.description,
    tags: tags ?? prev.tags,
    steps
  };

  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), renderLectureHtml(content), 'utf8');

  const lectures = readLecturesJson();
  const idx = lectures.findIndex(l => l.url === url);
  if (idx >= 0) {
    lectures[idx] = {
      ...lectures[idx],
      title: content.title,
      subtitle: content.subtitle,
      description: content.description,
      tags: content.tags
    };
    writeLecturesJson(lectures);
  }

  return { url, ...content, stepsText: stepsToTagText(steps) };
}

function deleteLecture(url) {
  const dir = lectureDirFromUrl(url);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const lectures = readLecturesJson().filter(l => l.url !== url);
  writeLecturesJson(lectures);
}

module.exports = {
  REPO_ROOT,
  listLectures,
  createLecture,
  isAppManaged,
  loadContent,
  saveContent,
  deleteLecture
};
