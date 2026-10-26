import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const root = path.resolve('out');
const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
// Generate opaque PNG icons without an image dependency.
function icon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = y * (size * 4 + 1) + 1 + x * 4;
      const nx = x / size, ny = y / size;
      const mark = ny > .25 && ny < .75 && ((nx > .25 && nx < .34) || (nx > .66 && nx < .75) ||
        (ny < .53 && Math.abs(ny - (.25 + Math.min(nx - .3, .7 - nx) * 1.2)) < .07 && nx > .3 && nx < .7));
      pixels.set(mark ? [255, 255, 255, 255] : [221, 44, 92, 255], p);
    }
  }
  function chunk(type, data) {
    const bytes = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4), footer = Buffer.alloc(4);
    header.writeUInt32BE(data.length); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, bytes, footer]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
for (const size of [192, 512]) await writeFile(path.join(root, `pwa-${size}.png`), icon(size));
await writeFile(path.join(root, 'manifest.webmanifest'), JSON.stringify({
  id: `${base}/`, name: 'Mermaid 에디터', short_name: 'Mermaid', lang: 'ko',
  description: '오프라인에서도 사용하는 다이어그램 보관함과 편집기',
  start_url: `${base}/`, scope: `${base}/`, display: 'standalone',
  background_color: '#ffffff', theme_color: '#dd2c5c',
  icons: [192, 512].map((size) => ({ src: `${base}/pwa-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' })),
}, null, 2));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const lists = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return lists.flat();
}
const files = (await walk(root)).filter((file) => !file.endsWith('/sw.js') && !file.endsWith('.map')).sort();
const hash = createHash('sha256').update(base);
for (const file of files) { hash.update(path.relative(root, file)); hash.update(await readFile(file)); }
const prefix = `mermaid-editor:${base || '/'}:`;
const cache = prefix + hash.digest('hex').slice(0, 16);
const urls = files.map((file) => `${base}/${path.relative(root, file).split(path.sep).join('/')}`);
urls.push(`${base}/`);
await writeFile(path.join(root, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const PREFIX = ${JSON.stringify(prefix)};
const ROOT = ${JSON.stringify(base + '/')};
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bound concurrent downloads on mobile networks. Activation only follows a complete cache.
    try {
      for (let i = 0; i < URLS.length; i += 12) await cache.addAll(URLS.slice(i, i + 12));
    } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Serve a consistent application version, including while a newer worker is waiting.
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match(ROOT)) || fetch(request);
    return fetch(request);
  })());
});
`);
console.log(`PWA: ${urls.length} resources cached; scope ${base || '/'}`);
