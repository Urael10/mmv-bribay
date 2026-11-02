// v0.15.1: caché 'mv2' (borra las anteriores, que pudieron quedar con archivos rotos).
// Páginas: primero la red (así siempre ves la versión publicada); archivos: caché primero.
// Nunca se guarda como archivo una respuesta HTML (Cloudflare la devuelve cuando falta un archivo).
const C='mv2'
self.addEventListener('install',()=>self.skipWaiting())
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>clients.claim())))
self.addEventListener('fetch',e=>{
const r=e.request,u=new URL(r.url)
if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.endsWith('version.json'))return
const nav=r.mode==='navigate'
e.respondWith((async()=>{
const c=await caches.open(C)
const m=await c.match(r)
if(!nav&&m)return m
try{
const n=await fetch(r)
const tipo=n.headers.get('content-type')||''
if(n.ok&&(nav||!tipo.includes('text/html')))c.put(r,n.clone())
return n
}catch{
return m||(nav?await c.match('./'):undefined)||Response.error()
}
})())})
