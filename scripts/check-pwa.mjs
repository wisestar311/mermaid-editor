import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
const manifest = JSON.parse(await readFile('out/manifest.webmanifest', 'utf8'));
assert.equal(manifest.scope, `${base}/`);
assert.equal(manifest.start_url, `${base}/`);
const handlers = {};
const stores = new Map();
let claimed = false;
const context = vm.createContext({
  URL,
  self: {
    location: { origin: 'https://example.test' },
    addEventListener(name, handler) { handlers[name] = handler; },
    clients: { async claim() { claimed = true; } },
    skipWaiting() {},
  },
  caches: {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) {
            assert.ok(url.startsWith(`${base}/`));
            const relative = url.slice(base.length + 1) || 'index.html';
            await access(`out/${relative}`);
            store.set(url, { url });
          }
        },
        async match(request, options) {
          const url = new URL(typeof request === 'string' ? request : request.url, 'https://example.test');
          return store.get(url.pathname + (options?.ignoreSearch ? '' : url.search));
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); },
  },
  fetch() { throw new Error('offline'); },
});
vm.runInContext(await readFile('out/sw.js', 'utf8'), context);
let pending;
handlers.install({ waitUntil(value) { pending = value; } });
await pending;
const prefix = vm.runInContext('PREFIX', context);
stores.set(`${prefix}old`, new Map());
stores.set('unrelated-app-cache', new Map());
handlers.activate({ waitUntil(value) { pending = value; } });
await pending;
assert.equal(claimed, true);
assert.equal(stores.has(`${prefix}old`), false);
assert.equal(stores.has('unrelated-app-cache'), true);
let response;
handlers.fetch({ request: { url: `https://example.test${base}/?offline=1`, method: 'GET', mode: 'navigate' }, respondWith(value) { response = value; } });
assert.equal((await response).url, `${base}/`);
handlers.fetch({ request: { url: 'https://external.test/file.js', method: 'GET' }, respondWith() { assert.fail('외부 요청을 가로채면 안 됩니다'); } });
if (base) handlers.fetch({ request: { url: 'https://example.test/other-app/', method: 'GET' }, respondWith() { assert.fail('다른 앱의 경로를 가로채면 안 됩니다'); } });
console.log('PWA 검증 통과: 리소스·설치·캐시 격리·오프라인 탐색');
