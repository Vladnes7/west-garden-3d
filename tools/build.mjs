// Builds a single self-contained HTML (works offline, opens by double-click)
// and a Vercel-ready dist/ folder (same page + PWA manifest + icons).
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // decodes spaces in the path
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });

// 1) bundle all JS (three.js, n8ao, postprocessing, app) into one ES module
const res = await build({
  entryPoints: [path.join(root, 'js/main.js')],
  bundle: true, format: 'esm', minify: true, write: false, target: 'es2020',
  legalComments: 'none', logLevel: 'warning',
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// 2) embed fonts (latin + cyrillic subsets) so the file needs no internet
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
let fontCss = '';
try {
  const cssURL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@600&family=Roboto+Condensed:wght@300;400;500&family=Roboto:wght@400;500&display=swap';
  const css = await (await fetch(cssURL, { headers: { 'User-Agent': UA } })).text();
  const blocks = css.split('/*').slice(1).map((b) => '/*' + b);
  for (const b of blocks) {
    const subset = b.slice(2, b.indexOf('*/')).trim();
    if (subset !== 'latin' && subset !== 'cyrillic') continue;
    const url = (b.match(/url\((https:[^)]+)\)/) || [])[1];
    if (!url) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fontCss += b.replace(url, 'data:font/woff2;base64,' + buf.toString('base64')) + '\n';
  }
} catch (e) { console.warn('fonts not embedded:', e.message); }

// 3) assemble HTML
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="preconnect"[^>]*>\n/g, '').replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, '');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '');
html = html.replace('<style>', '<style>\n' + fontCss);
const icon = (await readFile(path.join(root, 'public/apple-touch-icon.png'))).toString('base64');
const page = (manifest) => html
  .replace('<!--MANIFEST-->', manifest)
  .replace('<script type="module" src="./js/main.js"></script>', () => '<script type="module">\n' + js + '\n</script>');

const offline = page(`<link rel="apple-touch-icon" href="data:image/png;base64,${icon}">\n<link rel="icon" href="data:image/png;base64,${icon}">`);
const web = page('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<link rel="icon" href="icon-192.png">');

await writeFile(path.join(dist, 'index.html'), web);
await writeFile(path.join(dist, 'Квартира-43м2.html'), offline);
for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) await copyFile(path.join(root, 'public', f), path.join(dist, f));
await writeFile(path.join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: 'West Garden 43 м²', short_name: 'West Garden', start_url: '.', display: 'fullscreen', orientation: 'any',
  background_color: '#1e3a28', theme_color: '#1e3a28', lang: 'ru',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
}, null, 2));
let desk = '(skipped on CI)';
if (!process.env.VERCEL && !process.env.CI) {
  try { desk = path.join(root, '..', 'Квартира-43м2.html'); /* next to the project folder (Desktop/West Garden) */ await writeFile(desk, offline); } catch (e) { desk = 'not written: ' + e.message; }
}
console.log('built', (offline.length / 1048576).toFixed(2) + ' MB', 'fonts:', fontCss ? 'embedded' : 'none', '\n ->', desk);
