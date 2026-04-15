// Start Vite and the Electron dev runner without relying on node_modules/.bin
// (often missing on Windows after Bun or partial installs) or shell chaining.

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronRunner = path.join(root, 'scripts', 'dev-electron.js');
const node = process.execPath;

let shuttingDown = false;
let viteProc = null;
let electronProc = null;

function killAll() {
  if (viteProc && !viteProc.killed) {
    viteProc.kill('SIGTERM');
    viteProc = null;
  }
  if (electronProc && !electronProc.killed) {
    electronProc.kill('SIGTERM');
    electronProc = null;
  }
}

function exitAll(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  killAll();
  process.exit(code === null || code === undefined ? 0 : code);
}

viteProc = spawn(node, [viteCli], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

viteProc.on('exit', (code, signal) => {
  if (shuttingDown) return;
  if (signal) exitAll(1);
  else exitAll(code === null ? 1 : code);
});

electronProc = spawn(node, [electronRunner], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

electronProc.on('exit', (code, signal) => {
  if (shuttingDown) return;
  if (signal) exitAll(1);
  else exitAll(code === null ? 1 : code);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => exitAll(0));
}
