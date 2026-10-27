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
// Install downloads only what the start page references; the rest is cached on use or on request.
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const referenced = new Set([...html.matchAll(new RegExp(`${escaped}/_next/static/[^"'\\\\\\s)]+`, 'g'))].map((match) => match[0]));
const core = urls.filter((url) => referenced.has(url) || !url.slice(base.length + 1).startsWith('_next/') && !url.endsWith('.txt'));
await writeFile(path.join(root, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const PREFIX = ${JSON.stringify(prefix)};
const ROOT = ${JSON.stringify(base + '/')};
const URLS = ${JSON.stringify(urls)};
const CORE = ${JSON.stringify(core)};
const KNOWN = new Set(URLS);
// Hashed build files keep their name only while their content is unchanged, so they survive updates.
const IMMUTABLE = ROOT + '_next/static/';

async function addInBatches(cache, urls, onProgress) {
  for (let i = 0; i < urls.length; i += 12) {
    await cache.addAll(urls.slice(i, i + 12));
    onProgress?.(Math.min(i + 12, urls.length));
  }
}
async function missing(cache) {
  const cached = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  return URLS.filter((url) => !cached.has(url));
}
async function reportStatus(client) {
  const cache = await caches.open(CACHE);
  const left = await missing(cache);
  client?.postMessage({ type: 'OFFLINE_STATUS', cached: URLS.length - left.length, total: URLS.length });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      for (const key of await caches.keys()) {
        if (!key.startsWith(PREFIX) || key === CACHE) continue;
        const old = await caches.open(key);
        for (const request of await old.keys()) {
          const pathname = new URL(request.url).pathname;
          const response = pathname.startsWith(IMMUTABLE) && KNOWN.has(pathname) && await old.match(request);
          if (response) await cache.put(pathname, response);
        }
      }
      // Bound concurrent downloads on mobile networks. Activation only follows a complete core.
      await addInBatches(cache, (await missing(cache)).filter((url) => CORE.includes(url)));
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
  const data = event.data;
  if (data === 'ACTIVATE_UPDATE') self.skipWaiting();
  else if (data?.type === 'STATUS') event.waitUntil(reportStatus(event.source));
  else if (data?.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    // Files the page loaded before this worker controlled it.
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const left = new Set(await missing(cache));
      await Promise.all(data.urls.filter((url) => left.has(url)).map((url) => cache.add(url).catch(() => {})));
      await reportStatus(event.source);
    })());
  } else if (data?.type === 'CACHE_ALL') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const left = await missing(cache);
      const done = URLS.length - left.length;
      try {
        await addInBatches(cache, left, (count) =>
          event.source?.postMessage({ type: 'OFFLINE_STATUS', cached: done + count, total: URLS.length }));
      } catch {
        event.source?.postMessage({ type: 'OFFLINE_ERROR' });
      }
      await reportStatus(event.source);
    })());
  }
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      // The page comes from the network while online, so it never names build files a newer deploy removed.
      // The cached page, whose files are cached with it, is the offline fallback.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(request, { signal: controller.signal });
        if (response.ok) return response;
      } catch {
        // Offline or too slow: use the cached page below.
      } finally {
        clearTimeout(timer);
      }
      return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(ROOT)) || fetch(request);
    }
    // Build files have content-hashed names, so a cached copy is always the right one.
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && KNOWN.has(url.pathname) && !url.search) {
      const copy = response.clone();
      event.waitUntil(cache.put(url.pathname, copy));
    }
    return response;
  })());
});
`);
console.log(`PWA: ${core.length}/${urls.length} resources precached; scope ${base || '/'}`);
