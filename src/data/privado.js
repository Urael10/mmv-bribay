// Registro privado «Bienestar»: acceso a la base. Todo lo que se guarda va cifrado; la clave solo vive en memoria.
import {db} from './db.js'
import {
  META,
  crearMeta,
  abrirMeta,
  cifrar,
  descifrar,
  bloqueVacio,
  bloqueVacioOk
} from '../domain/privado.js'

export const hayClave = async () => !!(await db.privado.get(META))

export async function crearClave(clave) {
  const {key, meta} = await crearMeta(clave)
  await db.privado.put(meta)
  return key
}
// Devuelve la clave derivada si es correcta; null si no.
export async function abrir(clave) {
  const meta = await db.privado.get(META)
  return meta ? abrirMeta(meta, clave) : null
}

export async function leerMes(key, mes) {
  const fila = await db.privado.get(mes)
  if (!fila) return bloqueVacio()
  const b = await descifrar(key, fila, mes)
  return {dias: b.dias || {}, ev: b.ev || []}
}
export async function guardarMes(key, mes, bloque) {
  if (bloqueVacioOk(bloque)) return db.privado.delete(mes)
  const c = await cifrar(key, bloque, mes)
  await db.privado.put({mes, ...c})
}
// Todos los meses descifrados: {'2026-11': bloque, …}
export async function leerTodo(key, ultimos = null) {
  const filas = (await db.privado.toArray()).filter(f => f.mes !== META)
  filas.sort((a, b) => b.mes.localeCompare(a.mes))
  const out = {}
  for (const f of ultimos ? filas.slice(0, ultimos) : filas) out[f.mes] = await leerMes(key, f.mes)
  return out
}

// Cambia la clave: descifra todo con la vieja, cifra con la nueva y recién ahí escribe (todo o nada).
export async function cambiarClave(keyVieja, claveNueva) {
  const filas = (await db.privado.toArray()).filter(f => f.mes !== META)
  const bloques = []
  for (const f of filas) bloques.push([f.mes, await descifrar(keyVieja, f, f.mes)])
  const {key, meta} = await crearMeta(claveNueva)
  const nuevas = []
  for (const [mes, b] of bloques) nuevas.push({mes, ...(await cifrar(key, b, mes))})
  await db.transaction('rw', db.privado, async () => {
    await db.privado.clear()
    await db.privado.bulkPut([meta, ...nuevas])
  })
  return key
}
// Olvidaste la clave (o querés empezar de cero): borra TODO el registro privado. No se puede deshacer.
export const borrarTodo = () => db.privado.clear()
