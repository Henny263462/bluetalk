// Wait for Vite, then start Electron. Pure Node — works on Windows/macOS/Linux
// (avoids `&&` in npm scripts, which breaks when npm uses PowerShell 5.x).

const http = require('http');
const { spawn } = require('child_process');
const electronPath = require('electron');

const URL = 'http://localhost:5173';
const TIMEOUT = 30000;
const INTERVAL = 500;

const start = Date.now();

function startElectron() {
  console.log('[dev-electron] Vite is ready, starting Electron…');
  const child = spawn(electronPath, ['.'], { stdio: 'inherit' });
  child.on('close', (code) => {
    process.exit(code === null ? 1 : code);
  });
}

function check() {
  http
    .get(URL, (res) => {
      if (res.statusCode === 200) startElectron();
      else retry();
    })
    .on('error', retry);
}

function retry() {
  if (Date.now() - start > TIMEOUT) {
    console.error('[dev-electron] Timed out waiting for Vite.');
    process.exit(1);
  }
  setTimeout(check, INTERVAL);
}

check();
