# Lecture Editor

A local desktop app for authoring and editing lectures for the `todopage` site
without hand-writing HTML. It can open and modify any lecture in the repo,
including pre-existing hand-written ones.

## What it does

- **Scaffolds new lectures**: pick a course, date, and title, and it creates
  the folder (`<course>/fall2025/<date>-<slug>/`), writes `index.html`, and
  adds the matching entry to `data/lectures.json` — all in one step.
- **Tag-based content editor**: instead of a form with one box per field, you
  write the whole lecture as one document using bracket tags:

  ```html
  <theorem title="Theorem 3.3.7" subtitle="Rank-nullity theorem" ggb="123456">
  For any matrix $A$, the equation
  $$\dim(\text{Im}(A)) + \dim(\text{Ker}(A)) = m$$
  holds.
  </theorem>
  ```

  Supported tags: `<definition>`, `<theorem>`, `<example>`, `<summary>`,
  `<step>` (generic). Attributes: `title` (required), `subtitle` (optional),
  `ggb` (optional GeoGebra material id). Toolbar buttons insert an empty
  skeleton for each tag at the cursor.
- **LaTeX authoring helper**: press `` ` `` anywhere in the editor (or type
  `\(` / `\[` directly) to open a small popup — type LaTeX and see it
  live-rendered with KaTeX inline at your cursor as you type. Enter commits
  it, Escape cancels. The same popup works on a `title="..."` /
  `subtitle="..."` attribute value if your cursor is inside one. Inside the
  popup, Tab expands snippets (`\frac`, `\sqrt`, `\vec`, matrix environments,
  etc.) and jumps between placeholders.
- **Live preview**: the "⟳ Preview" button opens the generated lecture in a
  separate window, served by a local HTTP server so absolute paths like
  `/todopage/css/base.css` resolve exactly as they do on GitHub Pages.
- **Never touches git**: it only writes local files. Committing and pushing
  to GitHub stays a manual step, same as before.

## What it does not do

- It never runs `git` commands.

## Technical details

- **Stack**: Electron (main + renderer process), vanilla JS in the renderer
  (no framework), CodeMirror 5 for the text editor, KaTeX for LaTeX
  rendering.
- **Process split**:
  - `main.js` — creates the app window and a dedicated preview window, starts
    a local static file server rooted at the *parent* of the repo (so
    `/todopage/...` absolute paths resolve), and exposes lecture
    read/write/parse operations over IPC.
  - `preload.js` — exposes a narrow `window.lectureAPI` surface to the
    renderer via `contextBridge` (list/create/save/load/isAppManaged/
    openPreview).
  - `renderer/` — the UI: `index.html`/`styles.css` for layout,
    `editor.js` for the CodeMirror instance and math-popup key bindings,
    `tagSnippets.js` for the toolbar's tag-insertion skeletons,
    `mathPreview.js` + `latexSmartInput.js` for the backtick LaTeX popup,
    `renderer.js` wiring it all together.
- **Content format**: app-created lecture folders have a `content.json`
  sidecar (course/date/title/tags/steps) alongside the generated `index.html`.
  When opening a hand-written lecture that has no `content.json`, the app
  parses the existing `index.html` directly to populate the editor.
- **Tag parsing**: `lib/parseTags.js` converts the bracket-tag text into the
  step-object array (`parseSteps`) and back into editable tag text
  (`stepsToTagText`) for round-trip editing.
- **HTML generation**: `templates/lecture-template.js` renders a step array
  into the same `index.html` structure used across the existing site (KaTeX
  head, `.card`/`.step` markup, slide controls, GeoGebra float panel) — so
  published output is unaffected by how a lecture was authored.
- **Lecture scaffolding/data**: `lib/lectures.js` owns folder creation,
  `data/lectures.json` syncing, and date/duplicate validation.

## Running it

```
cd editor-app
npm install   # first time only
npm start
```
