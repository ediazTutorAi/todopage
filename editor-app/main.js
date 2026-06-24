const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const lectures = require('./lib/lectures');

// Serve the repo's parent directory so absolute paths like
// /todopage/css/base.css resolve exactly as they do on GitHub Pages
// (the published site is served from .../<user>.github.io/todopage/).
const SERVE_ROOT = path.dirname(lectures.REPO_ROOT);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

let serverPort = 0;

function startPreviewServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.normalize(path.join(SERVE_ROOT, urlPath));
      if (!filePath.startsWith(SERVE_ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

let previewWin = null;

function openPreviewWindow(url) {
  const fullUrl = `http://127.0.0.1:${serverPort}/todopage/${url}`;
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.loadURL(fullUrl);
    previewWin.focus();
    previewWin.webContents.openDevTools({ mode: 'right' });
    return;
  }
  previewWin = new BrowserWindow({ width: 1000, height: 800, title: 'Lecture Preview' });
  previewWin.loadURL(fullUrl);
  previewWin.webContents.openDevTools({ mode: 'right' });
  previewWin.on('closed', () => { previewWin = null; });
}

app.whenReady().then(async () => {
  await startPreviewServer();

  ipcMain.handle('lectures:list', () => lectures.listLectures());
  ipcMain.handle('lectures:create', (e, data) => lectures.createLecture(data));
  ipcMain.handle('lectures:isAppManaged', (e, url) => lectures.isAppManaged(url));
  ipcMain.handle('lectures:loadContent', (e, url) => lectures.loadContent(url));
  ipcMain.handle('lectures:saveContent', (e, url, data) => lectures.saveContent(url, data));
  ipcMain.handle('lectures:delete', (e, url) => lectures.deleteLecture(url));
  ipcMain.handle('preview:open', (e, url) => openPreviewWindow(url));

  createWindow();
});

app.on('window-all-closed', () => app.quit());
