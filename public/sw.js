const C='mv1'
self.addEventListener('install',()=>self.skipWaiting())
self.addEventListener('activate',e=>e.waitUntil(clients.claim()))
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin)||e.request.url.includes('version.json'))return
e.respondWith(caches.open(C).then(async c=>{const m=await c.match(e.request);const n=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>m);return m||n}))})
