/**
 * Creates the uploadable Staffbase plugin ZIP after the webpack build.
 *
 * Output: dist/kroger-division-video-plugin.zip
 *   ├── manifest.json
 *   └── kroger-video-widget.js
 *
 * Run via:  npm run package
 */

const archiver = require('archiver');
const fs       = require('fs');
const path     = require('path');

const distDir    = path.resolve(__dirname, '..', 'dist');
const outputFile = path.join(distDir, 'kroger-division-video-plugin.zip');

const requiredFiles = [
  path.join(distDir, 'manifest.json'),
  path.join(distDir, 'kroger-video-widget.js'),
];

for (const f of requiredFiles) {
  if (!fs.existsSync(f)) {
    console.error(`    Missing required file: ${f}`);
    console.error('    Run "npm run build" first.');
    process.exit(1);
  }
}

const output  = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') console.warn('Warning:', err.message);
  else throw err;
});
archive.on('error', (err) => { throw err; });

archive.pipe(output);
archive.file(path.join(distDir, 'manifest.json'),           { name: 'manifest.json'           });
archive.file(path.join(distDir, 'kroger-video-widget.js'),  { name: 'kroger-video-widget.js'  });
archive.finalize();

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`✅  Plugin package created: dist/kroger-division-video-plugin.zip  (${kb} KB)`);
  console.log('    Upload this ZIP in Staffbase Admin → Settings → Plugins → Upload Plugin');
});
