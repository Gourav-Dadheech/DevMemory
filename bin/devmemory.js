#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target scan path is wherever the user ran the command from
const targetScanPath = process.cwd();
process.env.DEVMEMORY_SCAN_PATH = targetScanPath;

const PORT = process.env.PORT || 5005;

console.log(`\n======================================================`);
console.log(`🧠 DevMemory - Living Project Brain & Visualizer`);
console.log(`📁 Scanning Folder: ${targetScanPath}`);
console.log(`🚀 Starting at: http://localhost:${PORT}`);
console.log(`======================================================\n`);

// Import the server directly
import('../server/server.js').then(() => {
  // Automatically open default browser
  const url = `http://localhost:${PORT}`;
  const startCmd = process.platform === 'win32' ? `start ${url}` :
                   process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  
  setTimeout(() => {
    exec(startCmd, () => {});
  }, 1000);
}).catch(err => {
  console.error('Failed to start DevMemory:', err);
});
