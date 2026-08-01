/**
 * copy-zoom-lib.js
 *
 * Copies the Zoom Meeting SDK binary assets (WASM files, AV workers, language
 * packs) from node_modules into public/zoom-lib so CRA's dev server and
 * production build can serve them at /zoom-lib/*.
 *
 * The JS SDK itself is imported via npm (no CDN needed for the JS code).
 * Only the binary assets need to be served as static files.
 *
 * Run automatically via:
 *   npm run prestart   (before `react-scripts start`)
 *   npm run prebuild   (before `react-scripts build`)
 */

const { cpSync } = require('fs');
const { join } = require('path');

const src  = join(__dirname, '..', 'node_modules', '@zoom', 'meetingsdk', 'dist', 'lib');
const dest = join(__dirname, '..', 'public', 'zoom-lib');

try {
  cpSync(src, dest, { recursive: true, force: true });
  console.log('✓ Zoom SDK assets copied → public/zoom-lib');
} catch (err) {
  console.error('✗ Failed to copy Zoom SDK assets:', err.message);
  process.exit(1);
}
