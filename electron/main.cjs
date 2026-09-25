const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let mainWindow;

const extensionFilters = {
  '.csv': [{ name: 'CSV 文件', extensions: ['csv'] }],
  '.json': [{ name: 'JSON 文件', extensions: ['json'] }],
  '.md': [{ name: 'Markdown 文件', extensions: ['md'] }],
  '.txt': [{ name: '文本文件', extensions: ['txt'] }],
};

ipcMain.handle('qingsuan:save-file', async (_event, request) => {
  if (!request || typeof request.filename !== 'string' || typeof request.content !== 'string') {
    throw new Error('Invalid save request');
  }

  const filename = path.basename(request.filename) || 'qingsuan-export.txt';
  const extension = path.extname(filename).toLowerCase();
  const result = await dialog.showSaveDialog({
    title: '导出清算数据',
    defaultPath: path.join(app.getPath('downloads'), filename),
    filters: extensionFilters[extension] ?? [{ name: '所有文件', extensions: ['*'] }],
  });

  if (result.canceled || !result.filePath) return { saved: false };
  await fs.writeFile(result.filePath, request.content, 'utf8');
  return { saved: true, path: result.filePath };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    title: '清算 · 个人财务',
    backgroundColor: '#f5f7f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.ELECTRON_DEV === '1') {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
