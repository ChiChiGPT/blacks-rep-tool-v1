import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const cataloguePaths = new Set(['/catalogue.json', '/core-catalogue.json', '/practitioner-catalogue.json'])

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat()
}

const assetFiles = await files(dist)
const assets = assetFiles
  .map(file => ({ file, url: '/' + relative(dist, file).replaceAll('\\', '/') }))
  .filter(({ url }) => url !== '/sw.js')
const version = createHash('sha256')
  .update((await Promise.all(assets.map(async ({ file, url }) => `${url}:${createHash('sha256').update(await readFile(file)).digest('hex')}`))).join('\n'))
  .digest('hex')
  .slice(0, 16)
const urls = assets.map(({ url }) => url)

const content = `const CACHE = 'blacks-rep-v1-${version}';
const ASSETS = ${JSON.stringify(urls)};
const CATALOGUE_PATHS = new Set(${JSON.stringify([...cataloguePaths])});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallback) return caches.match(fallback);
    throw new Error('Offline and no cached response is available.');
  }
}

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS))
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('blacks-rep-v1-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }
  if (CATALOGUE_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
    if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone());
    return response;
  })));
});
`

await writeFile(join(dist, 'sw.js'), content)
console.log(`Service worker precaches ${urls.length} build assets with cache version ${version}.`)
