const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fsSync = require('node:fs');
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

const runPdfParser = (request, pdfPath, outputPath, parserPath) => new Promise((resolve, reject) => {
  const useConfiguredPython = process.env.QINGSUAN_PYTHON;
  const bundledParser = parserPath && fsSync.existsSync(parserPath) ? parserPath : null;
  const command = bundledParser || useConfiguredPython || 'conda';
  const args = bundledParser
    ? [pdfPath, '--output', outputPath]
    : useConfiguredPython
      ? [parserPath, pdfPath, '--output', outputPath]
      : ['run', '-n', 'qingsuan-pdf', 'python', parserPath, pdfPath, '--output', outputPath];
  args.push('--classify', '--llm-provider', request.provider, '--llm-model', request.model, '--llm-url', request.url, '--llm-timeout', String(request.timeout));
  const childEnv = { ...process.env };
  if (request.apiKey) childEnv.QINGSUAN_LLM_API_KEY = request.apiKey;
  else delete childEnv.QINGSUAN_LLM_API_KEY;
  const child = spawn(command, args, { env: childEnv });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (error) => reject(new Error(`无法启动 PDF 解析器：${error.message}。请重新安装包含独立解析器的桌面版。`)));
  child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || stdout.trim() || `PDF 解析失败（退出码 ${code}）`)));
});

ipcMain.handle('qingsuan:convert-pdf', async (_event, request) => {
  if (!request || !['ollama', 'openai'].includes(request.provider) || typeof request.url !== 'string' || typeof request.model !== 'string') {
    throw new Error('AI 接口配置不完整');
  }
  const selection = await dialog.showOpenDialog({
    title: '选择招商银行流水 PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
  });
  if (selection.canceled || !selection.filePaths[0]) throw new Error('已取消选择 PDF');
  const tempDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'qingsuan-pdf-'));
  const outputPath = path.join(tempDirectory, 'transactions.csv');
  const appRoot = app.getAppPath();
  const parserRoot = app.isPackaged ? path.join(process.resourcesPath, 'parser') : path.join(appRoot, 'build', 'parser');
  const parserName = process.platform === 'win32' ? 'qingsuan-pdf.exe' : 'qingsuan-pdf';
  const parserPath = path.join(parserRoot, `${process.platform}-${process.arch}`, parserName);
  const scriptRoot = appRoot.endsWith('.asar') ? path.join(process.resourcesPath, 'app.asar.unpacked') : appRoot;
  const scriptPath = path.join(scriptRoot, 'tool', 'parse_cmb_pdf.py');
  if (app.isPackaged && !fsSync.existsSync(parserPath)) {
    throw new Error('当前安装包没有包含独立 PDF 解析器，请重新下载最新版桌面安装包。');
  }
  try {
    await runPdfParser(request, selection.filePaths[0], outputPath, fsSync.existsSync(parserPath) ? parserPath : scriptPath);
    const csv = await fs.readFile(outputPath, 'utf8');
    return { csv, filename: path.basename(selection.filePaths[0]).replace(/\.pdf$/i, '.csv') };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
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
