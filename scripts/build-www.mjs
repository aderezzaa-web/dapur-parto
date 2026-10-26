// Menyalin file web ke www/ (folder yang dibungkus Capacitor) dan
// menyegarkan vendor/ (library + font lokal, juga dipakai GitHub Pages).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = p => join(root, 'node_modules', p);
const vendor = [
  ['@supabase/supabase-js/dist/umd/supabase.js', 'vendor/supabase.js'],
  ['html2canvas/dist/html2canvas.min.js', 'vendor/html2canvas.min.js'],
  ['@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'vendor/fonts/geist.woff2'],
  ['@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2', 'vendor/fonts/geist-mono.woff2'],
  ['@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2', 'vendor/fonts/baloo-2-800.woff2'],
];
for (const [from, to] of vendor) {
  if (!existsSync(nm(from))) { console.error('Hilang: ' + from + ' (jalankan npm install)'); process.exit(1); }
  mkdirSync(dirname(join(root, to)), { recursive: true });
  cpSync(nm(from), join(root, to));
}

const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const f of ['index.html', 'auth.js', 'app-native.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'mascot.png', 'leaf.png', 'vendor']) {
  cpSync(join(root, f), join(www, f), { recursive: true });
}
console.log('www/ siap.');
