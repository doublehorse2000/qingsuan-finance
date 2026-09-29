const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qingsuanDesktop', {
  saveFile: (request) => ipcRenderer.invoke('qingsuan:save-file', request),
  convertPdf: (request) => ipcRenderer.invoke('qingsuan:convert-pdf', request),
});
