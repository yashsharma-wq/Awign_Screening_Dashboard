import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '..', 'dist-pm-analytics');
const oldFile = path.join(distPath, 'index-pm-analytics.html');
const newFile = path.join(distPath, 'index.html');

if (fs.existsSync(oldFile)) {
  fs.copyFileSync(oldFile, newFile);
  console.log('✓ Created index.html from index-pm-analytics.html');
} else {
  console.log('⚠ index-pm-analytics.html not found');
}

