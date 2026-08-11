import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const dist = new URL('../dist/', import.meta.url).pathname;
async function files(dir) { const entries = await readdir(dir, {withFileTypes:true}); return (await Promise.all(entries.map(async e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]))).flat(); }
const urls = (await files(dist)).map(f => '/' + relative(dist,f).replaceAll('\\\\','/')).filter(u => u !== '/sw.js');
const content = `const CACHE='blacks-rep-v1'; const ASSETS=${JSON.stringify(urls)};\nself.addEventListener('install', event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener('activate', event=>event.waitUntil(self.clients.claim()));\nself.addEventListener('fetch', event=>{if(event.request.method!=='GET') return; event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return response;}).catch(()=>caches.match('/index.html'))));});`;
await writeFile(join(dist,'sw.js'),content);
console.log(`Service worker precaches ${urls.length} build assets.`);
