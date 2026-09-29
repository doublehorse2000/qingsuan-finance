const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const build = { ...packageJson.build };
const architecture = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch;
if (process.platform === 'darwin') {
  build.mac = {
    ...(build.mac ?? {}),
    target: [{ target: 'dmg', arch: [architecture] }, { target: 'zip', arch: [architecture] }],
  };
}
if (process.platform === 'win32') {
  build.win = { ...(build.win ?? {}), target: [{ target: 'nsis', arch: [architecture] }, { target: 'zip', arch: [architecture] }] };
}
if (process.platform === 'linux') {
  build.linux = { ...(build.linux ?? {}), target: [{ target: 'AppImage', arch: [architecture] }, { target: 'deb', arch: [architecture] }] };
}
const configPath = path.join(__dirname, '..', `.electron-builder-${process.pid}.json`);
fs.writeFileSync(configPath, JSON.stringify(build));
const args = ['--publish', 'never', '--config', configPath, `--${architecture}`];
try {
  const result = spawnSync('electron-builder', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(result.status ?? 1);
} finally {
  fs.rmSync(configPath, { force: true });
}
