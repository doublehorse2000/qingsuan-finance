const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const target = `${process.platform}-${process.arch}`;
const outputRoot = path.join(projectRoot, 'build', 'parser', target);
const workRoot = path.join(projectRoot, '.build-parser', target);
const pythonCandidates = process.env.QINGSUAN_PYTHON
  ? [process.env.QINGSUAN_PYTHON]
  : process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

const run = (command, args) => spawnSync(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, PYINSTALLER_CONFIG_DIR: workRoot },
});

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.mkdirSync(workRoot, { recursive: true });

let python;
for (const candidate of pythonCandidates) {
  const result = spawnSync(candidate, ['-m', 'PyInstaller', '--version'], { cwd: projectRoot, stdio: 'ignore' });
  if (result.status === 0) {
    python = candidate;
    break;
  }
}

if (!python) {
  console.error('未找到 PyInstaller。请先在构建机安装：python3 -m pip install -r tool/requirements-build.txt');
  process.exit(1);
}

const result = run(python, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onefile',
  '--name', 'qingsuan-pdf',
  '--distpath', outputRoot,
  '--workpath', workRoot,
  '--specpath', workRoot,
  '--collect-all', 'pdfplumber',
  '--collect-all', 'pdfminer',
  '--collect-all', 'pypdfium2',
  path.join(projectRoot, 'tool', 'parse_cmb_pdf.py'),
]);

if (result.status !== 0) process.exit(result.status ?? 1);

const executable = process.platform === 'win32' ? path.join(outputRoot, 'qingsuan-pdf.exe') : path.join(outputRoot, 'qingsuan-pdf');
if (!fs.existsSync(executable)) {
  console.error(`PyInstaller 没有生成预期文件：${executable}`);
  process.exit(1);
}
if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
console.log(`已生成独立 PDF 解析器：${executable}`);
