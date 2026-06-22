const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lectureAPI', {
  list: () => ipcRenderer.invoke('lectures:list'),
  create: (data) => ipcRenderer.invoke('lectures:create', data),
  isAppManaged: (url) => ipcRenderer.invoke('lectures:isAppManaged', url),
  loadContent: (url) => ipcRenderer.invoke('lectures:loadContent', url),
  saveContent: (url, data) => ipcRenderer.invoke('lectures:saveContent', url, data),
  deleteLecture: (url) => ipcRenderer.invoke('lectures:delete', url),
  openPreview: (url) => ipcRenderer.invoke('preview:open', url)
});
