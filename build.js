import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy static entry and assets into public directory for Vercel
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(publicDir, 'index.html'));
if (fs.existsSync(path.join(__dirname, 'manifest.json'))) {
  fs.copyFileSync(path.join(__dirname, 'manifest.json'), path.join(publicDir, 'manifest.json'));
}
copyRecursive(path.join(__dirname, 'src'), path.join(publicDir, 'src'));
copyRecursive(path.join(__dirname, 'assets'), path.join(publicDir, 'assets'));

console.log('PULSE360 build complete: static assets prepared in public/');
