// Menú privado «Bienestar»: cifrado y reglas de los datos (lógica pura, sin base de datos ni pantallas).
// Los datos viajan siempre cifrados (AES-GCM, clave derivada con PBKDF2). La clave del usuario NUNCA se guarda:
// solo vive en memoria mientras el menú está abierto.
// Nada de este archivo debe importarse desde la IA, el informe, el coach ni la preparación (hay una prueba que lo vigila).

export const ITER = 250000 // vueltas de PBKDF2; se guarda en el registro de la clave, así se puede subir más adelante
export const BLOQUEO_SEG = 60 // autobloqueo en segundo plano (H7)
export const CLAVE_MIN = 4
export const CLAVE_BUENA = 8
export const TOQUES = 5 // gesto de acceso (H1): 5 toques en la versión del encabezado
export const VENTANA_TOQUES = 3000
export const CONTEXTOS = ['pareja', 'solo']

const enc = new TextEncoder()
const dec = new TextDecoder()

export const aB64 = u8 => {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}
export const deB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
const aleatorio = n => globalThis.crypto.getRandomValues(new Uint8Array(n))

export async function derivar(clave, salt, iter = ITER) {
  const base = await globalThis.crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, [
    'deriveKey'
  ])
  return globalThis.crypto.subtle.deriveKey(
    {name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256'},
    base,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt']
  )
}

// `aad` ata cada bloque a su nombre (mes): no se puede cambiar un bloque de lugar sin que falle el descifrado.
export async function cifrar(key, objeto, aad) {
  const iv = aleatorio(12)
  const ct = await globalThis.crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: enc.encode(aad)},
    key,
    enc.encode(JSON.stringify(objeto))
  )
  return {iv: aB64(iv), ct: aB64(new Uint8Array(ct))}
}
export async function descifrar(key, {iv, ct}, aad) {
  const claro = await globalThis.crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: deB64(iv), additionalData: enc.encode(aad)},
    key,
    deB64(ct)
  )
  return JSON.parse(dec.decode(claro))
}

export const META = '_meta' // fila especial: sal, vueltas y una verificación para saber si la clave es correcta
const VERIF = 'MMV-privado-ok'

export async function crearMeta(clave, iter = ITER) {
  const salt = aleatorio(16)
  const key = await derivar(clave, salt, iter)
  const v = await cifrar(key, VERIF, META)
  return {key, meta: {mes: META, v: 1, iter, salt: aB64(salt), iv: v.iv, ct: v.ct}}
}
// Devuelve la clave derivada si la clave escrita es correcta; si no, null.
export async function abrirMeta(meta, clave) {
  try {
    const key = await derivar(clave, deB64(meta.salt), meta.iter)
    return (await descifrar(key, meta, META)) === VERIF ? key : null
  } catch {
    return null
  }
}

export function validarClave(clave, repetir) {
  if (typeof clave !== 'string' || clave.length < CLAVE_MIN)
    return `La clave necesita al menos ${CLAVE_MIN} caracteres.`
  if (clave !== repetir) return 'Las dos claves no coinciden.'
  return null
}
export const claveDebil = clave => clave.length < CLAVE_BUENA

// ---- Bloque de un mes: {dias: {'2026-11-02': {man, dur, lib}}, ev: [{id, t, ctx}]} ----
export const bloqueVacio = () => ({dias: {}, ev: []})
export const mesDe = fecha => String(fecha).slice(0, 7)
export const esFecha = f => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(Date.parse(f))
export const fechaLocal = iso => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
}
const entre = (n, a, b) => Number.isInteger(n) && n >= a && n <= b

// Devuelve el día normalizado o null si quedó vacío. Dureza (1-4) solo si hubo erección; libido (1-5) siempre.
export function normalizarDia(d) {
  const o = {}
  if (d?.man === true || d?.man === false) o.man = d.man
  if (o.man === true && entre(d.dur, 1, 4)) o.dur = d.dur
  if (entre(d?.lib, 1, 5)) o.lib = d.lib
  return Object.keys(o).length ? o : null
}
// Aplica un cambio a un día. Un valor null borra ese campo.
export function ponerDia(bloque, fecha, parche) {
  if (!esFecha(fecha)) throw new Error('Fecha inválida')
  const dias = {...bloque.dias}
  const nuevo = normalizarDia({...dias[fecha], ...parche})
  if (nuevo) dias[fecha] = nuevo
  else delete dias[fecha]
  return {...bloque, dias}
}
export const quitarDia = (bloque, fecha) => {
  const dias = {...bloque.dias}
  delete dias[fecha]
  return {...bloque, dias}
}

const idEv = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export function normalizarEv(e) {
  if (!e || !Number.isFinite(Date.parse(e.t))) return null
  const o = {id: e.id || idEv(), t: new Date(e.t).toISOString()}
  if (CONTEXTOS.includes(e.ctx)) o.ctx = e.ctx
  return o
}
export const agregarEv = (bloque, e) => {
  const n = normalizarEv(e)
  if (!n) throw new Error('Hora inválida')
  return {...bloque, ev: [...bloque.ev, n].sort((a, b) => a.t.localeCompare(b.t))}
}
export const quitarEv = (bloque, id) => ({...bloque, ev: bloque.ev.filter(e => e.id !== id)})
export const bloqueVacioOk = b => !Object.keys(b.dias).length && !b.ev.length

// Un evento cambia de mes si se edita su hora: se separa en «quitar del mes viejo» y «agregar al nuevo».
export const mesDeEv = e => mesDe(fechaLocal(e.t))

// Historial de varios meses (más nuevo primero): [{tipo:'dia', fecha, ...} | {tipo:'ev', fecha, t, id, ctx}]
export function historial(bloques, limite = 120) {
  const filas = []
  for (const b of Object.values(bloques)) {
    for (const [fecha, d] of Object.entries(b.dias || {})) filas.push({tipo: 'dia', fecha, orden: fecha + 'T00', ...d})
    for (const e of b.ev || []) filas.push({tipo: 'ev', fecha: fechaLocal(e.t), orden: e.t, ...e})
  }
  return filas.sort((a, b) => b.orden.localeCompare(a.orden)).slice(0, limite)
}

// Gesto de acceso: registra un toque y dice si ya fueron TOQUES dentro de la ventana.
export function registrarToque(toques, ahora, {n = TOQUES, ventana = VENTANA_TOQUES} = {}) {
  const t = [...toques.filter(x => ahora - x <= ventana), ahora]
  return t.length >= n ? {toques: [], abre: true} : {toques: t, abre: false}
}

// Autobloqueo: ¿pasó el tiempo permitido desde que la app quedó en segundo plano?
export const debeBloquear = (ocultoDesde, ahora, seg = BLOQUEO_SEG) =>
  ocultoDesde !== null && ahora - ocultoDesde >= seg * 1000

// Restauración de un backup: las filas cifradas solo sirven si la clave del backup es la misma que la de este equipo
// (o si este equipo todavía no tiene menú privado). Si no, se omiten para no dejar bloques ilegibles.
export function planRestaurarPrivado(local, filasBackup) {
  const mb = filasBackup.find(f => f.mes === META)
  if (!mb) return {importar: [], omitidas: filasBackup.length}
  if (!local || local.salt === mb.salt) return {importar: filasBackup, omitidas: 0}
  return {importar: [], omitidas: filasBackup.length}
}
