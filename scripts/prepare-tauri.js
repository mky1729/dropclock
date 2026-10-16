const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tauri-web');
const assets = [
  'index.html',
  'manifest-v2.webmanifest',
  'icon-dropclock-192.png',
  'icon-dropclock-512.png',
  'apple-touch-icon.png',
  'files/favicon.ico',
  'files/icon-dropclock-maskable-512.png'
];

fs.mkdirSync(output, { recursive: true });
for (const asset of assets) {
  const destination = path.join(output, asset);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, asset), destination);
}
console.log(`Prepared ${assets.length} web assets for Tauri.`);
