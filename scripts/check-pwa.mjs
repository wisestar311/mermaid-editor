import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
const origin = 'https://example.test';
const manifest = JSON.parse(await readFile('out/manifest.webmanifest', 'utf8'));
assert.equal(manifest.scope, `${base}/`);
assert.equal(manifest.start_url, `${base}/`);
const handlers = {};
const stores = new Map();
let claimed = false;
let skipped = false;
let online = true;
const pathOf = (request) => new URL(typeof request === 'string' ? request : request.url, origin);
async function fetchFile(request) {
  if (!online) throw new Error('offline');
  const url = pathOf(request);
  assert.ok(url.pathname.startsWith(`${base}/`));
  const relative = url.pathname.slice(base.length + 1) || 'index.html';
  await access(`out/${relative}`);
  return { ok: true, url: url.pathname, clone() { return this; } };
}
function storeFor(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const store = stores.get(name);
  return {
    async add(url) { store.set(pathOf(url).pathname, await fetchFile(url)); },
    async addAll(urls) { for (const url of urls) await this.add(url); },
    async put(url, response) { store.set(pathOf(url).pathname, response); },
    async keys() { return [...store.keys()].map((key) => ({ url: origin + key })); },
    async match(request, options) {
      const url = pathOf(request);
      return store.get(url.pathname + (options?.ignoreSearch ? '' : url.search));
    },
  };
}
const context = vm.createContext({
  URL,
  Set,
  AbortController,
  setTimeout,
  clearTimeout,
  self: {
    location: { origin },
    addEventListener(name, handler) { handlers[name] = handler; },
    clients: { async claim() { claimed = true; } },
    async skipWaiting() { skipped = true; },
  },
  caches: {
    async open(name) { return storeFor(name); },
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); },
  },
  fetch: fetchFile,
});
vm.runInContext(await readFile('out/sw.js', 'utf8'), context);
const [prefix, cacheName, urls, core] = ['PREFIX', 'CACHE', 'URLS', 'CORE'].map((name) => vm.runInContext(name, context));
assert.ok(core.length < urls.length, '설치 시 모든 리소스를 내려받으면 안 됩니다');
assert.ok(core.includes(`${base}/`));
assert.ok(core.some((url) => url.endsWith('.css')));

// A hashed file from the previous version is carried over instead of downloaded again.
const immutable = urls.find((url) => url.includes('/_next/static/') && !core.includes(url));
stores.set(`${prefix}old`, new Map([[immutable, { ok: true, url: immutable, carried: true }]]));
stores.set('unrelated-app-cache', new Map());
let pending;
handlers.install({ waitUntil(value) { pending = value; } });
await pending;
assert.equal(stores.get(cacheName).size, core.length + 1);
assert.equal(stores.get(cacheName).get(immutable).carried, true);
assert.equal(skipped, true, '새 워커는 기다리지 않고 바로 교체돼야 합니다');
handlers.activate({ waitUntil(value) { pending = value; } });
await pending;
assert.equal(claimed, true);
assert.equal(stores.has(`${prefix}old`), false);
assert.equal(stores.has('unrelated-app-cache'), true);

// Files fetched while online are cached for later offline use.
const lazy = urls.find((url) => url.includes('/_next/static/') && !stores.get(cacheName).has(url));
let response;
handlers.fetch({ request: { url: origin + lazy, method: 'GET' }, respondWith(value) { response = value; }, waitUntil(value) { pending = value; } });
await response; await pending;
assert.ok(stores.get(cacheName).has(lazy));

// "Download everything" fills the cache and reports progress.
const messages = [];
handlers.message({ data: { type: 'CACHE_ALL' }, source: { postMessage(message) { messages.push(message); } }, waitUntil(value) { pending = value; } });
await pending;
assert.equal(stores.get(cacheName).size, urls.length);
assert.deepEqual({ ...messages.at(-1) }, { type: 'OFFLINE_STATUS', cached: urls.length, total: urls.length });

// Online navigation goes to the network so the page matches the deployed build files.
let networkPages = 0;
const fetchOnline = context.fetch;
context.fetch = async () => { networkPages++; return { ok: true, url: 'network' }; };
handlers.fetch({ request: { url: `${origin}${base}/`, method: 'GET', mode: 'navigate' }, respondWith(value) { response = value; } });
assert.equal((await response).url, 'network');
assert.equal(networkPages, 1);
context.fetch = fetchOnline;

online = false;
handlers.fetch({ request: { url: `${origin}${base}/?offline=1`, method: 'GET', mode: 'navigate' }, respondWith(value) { response = value; } });
assert.equal((await response).url, `${base}/`);
handlers.fetch({ request: { url: 'https://external.test/file.js', method: 'GET' }, respondWith() { assert.fail('외부 요청을 가로채면 안 됩니다'); } });
if (base) handlers.fetch({ request: { url: `${origin}/other-app/`, method: 'GET' }, respondWith() { assert.fail('다른 앱의 경로를 가로채면 안 됩니다'); } });
console.log(`PWA 검증 통과: 핵심 ${core.length}/${urls.length}개 사전 캐시·이전 버전 재사용·사용 시 캐시·전체 다운로드·오프라인 탐색`);
