// Datos de la versión cargada (los inyecta vite.config.js al compilar)
export const INFO =
  typeof __APP_INFO__ !== 'undefined'
    ? __APP_INFO__
    : {version: 'dev', entrega: 'dev', build: new Date().toISOString()}
export const fechaBuild = (b = INFO.build) =>
  new Date(b).toLocaleString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
export const etiqueta = `v${INFO.version} · ${INFO.entrega}`
// Consulta la versión publicada (sin caché). Devuelve {nueva, remota} o null si no hay conexión.
export async function buscarActualizacion() {
  try {
    const r = await fetch('./version.json?' + Date.now(), {cache: 'no-store'})
    if (!r.ok) return null
    const remota = await r.json()
    return {nueva: remota.build !== INFO.build, remota}
  } catch {
    return null
  }
}
// Borra la caché del service worker y recarga: carga la versión nueva sin abrir la app dos veces.
export async function actualizarAhora() {
  try {
    const ks = await caches.keys()
    await Promise.all(ks.map(k => caches.delete(k)))
  } catch {}
  try {
    const rs = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((rs || []).map(r => r.update()))
  } catch {}
  location.reload()
}
