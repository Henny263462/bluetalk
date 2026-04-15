// Wait for Vite dev server to be ready before launching Electron.
// Pure Node.js — no dependencies, works on Windows/macOS/Linux.

const http = require('http');

const URL = 'http://localhost:5173';
const TIMEOUT = 30000; // 30s max wait
const INTERVAL = 500;

const start = Date.now();

function check() {
  http
    .get(URL, (res) => {
      if (res.statusCode === 200) {
        console.log('[wait-vite] Vite is ready.');
        process.exit(0);
      } else {
        retry();
      }
    })
    .on('error', retry);
}

function retry() {
  if (Date.now() - start > TIMEOUT) {
    console.error('[wait-vite] Timed out waiting for Vite.');
    process.exit(1);
  }
  setTimeout(check, INTERVAL);
}

check();
