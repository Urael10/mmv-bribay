// Entrega 35 · Modo bolsillo (lógica pura): señal de GPS con caducidad, ritmo «ahora», pausa y reloj.
// El dibujo está en src/features/actividad/VistaBolsillo.jsx. Este módulo no toca el trazo ni la ubicación.
import {GPS_CFG} from './actividad.js'
import {estadoConteo} from './metaPasos.js'
import {textoAnillo} from './anillo.js'

export const BOLSILLO_CFG = {
  caducaSeg: 15, // sin puntos de GPS por más tiempo que esto: «sin señal»
  ventanaSeg: 60, // el ritmo «ahora» mira el último minuto
  ritmoMinSeg: 30, // y necesita al menos 30 s…
  ritmoMinM: 30, // …y 30 m para no inventar un número
  ritmoMaxSegKm: 1800, // más lento que 30 min/km es estar casi parado: se muestra «—»
  ritmoFrescoSeg: 20, // la última muestra no puede ser más vieja que esto
  muestrasMax: 120,
  cierreMinSeg: 10, // app cerrada por menos que esto: no se cuenta como pausa
  mantenerPausaMs: 600
}

// Patrones de vibración (ms). Pausar: una corta. Reanudar y salir: doble.
export const VIBRA = {pausar: [40], reanudar: [40, 60, 40], salir: [40, 60, 40]}

// ---------- Señal de GPS ----------
// precision: metros del último punto (null si todavía no llegó ninguno); edadSeg: segundos desde ese punto.
// barras: 0 a 4 (se dibujan con texto al lado: nunca solo color).
export function nivelSenal(
  {usar = true, permiso = true, precision = null, edadSeg = null} = {},
  cfg = BOLSILLO_CFG
) {
  if (!usar) return null
  if (!permiso) return {id: 'sinpermiso', barras: 0, texto: 'GPS sin permiso'}
  if (!Number.isFinite(precision) || precision <= 0)
    return {id: 'buscando', barras: 0, texto: 'Buscando señal de GPS'}
  if (Number.isFinite(edadSeg) && edadSeg > cfg.caducaSeg)
    return {id: 'sinsenal', barras: 0, texto: 'GPS sin señal'}
  const m = Math.round(precision)
  if (precision > GPS_CFG.precisionMax)
    return {id: 'debil', barras: 1, texto: `GPS débil · ±${m} m`}
  const barras = precision <= 8 ? 4 : precision <= 15 ? 3 : 2
  return {id: 'buena', barras, texto: `GPS buena · ±${m} m`}
}

// ---------- Ritmo «ahora» ----------
// Muestras {t (ms), m (metros acumulados)} del último minuto. No muta.
export function agregarMuestra(buf = [], t, m, cfg = BOLSILLO_CFG) {
  if (!Number.isFinite(t) || !Number.isFinite(m)) return buf
  const ult = buf[buf.length - 1]
  if (ult && t <= ult.t) return buf
  const desde = t - cfg.ventanaSeg * 1000
  const nuevo = [...buf, {t, m}].filter(x => x.t >= desde)
  return nuevo.length > cfg.muestrasMax ? nuevo.slice(-cfg.muestrasMax) : nuevo
}

// Segundos por km del último minuto, o null si no hay datos suficientes o frescos.
export function ritmoAhoraSegKm(buf = [], ahora = null, cfg = BOLSILLO_CFG) {
  if (buf.length < 2) return null
  const a = buf[0],
    b = buf[buf.length - 1]
  if (Number.isFinite(ahora) && ahora - b.t > cfg.ritmoFrescoSeg * 1000) return null
  const dt = (b.t - a.t) / 1000,
    dm = b.m - a.m
  if (dt < cfg.ritmoMinSeg || dm < cfg.ritmoMinM) return null
  const r = Math.round(dt / (dm / 1000))
  return r > cfg.ritmoMaxSegKm ? null : r
}

const dos = n => String(n).padStart(2, '0')

// «15:51» (min/km) o «—».
export function formatoRitmoMin(seg) {
  if (!Number.isFinite(seg) || seg <= 0) return '—'
  let m = Math.floor(seg / 60),
    s = Math.round(seg % 60)
  if (s === 60) {
    m += 1
    s = 0
  }
  return `${m}:${dos(s)}`
}

// «38:12» o «1:02:05».
export function formatoReloj(seg) {
  const t = Math.max(0, Math.round(Number(seg) || 0))
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`
}

// «2,41» (km, con coma).
export const formatoKm = m => (Math.max(0, Number(m) || 0) / 1000).toFixed(2).replace('.', ',')

// ---------- Pausa y reloj ----------
// Dos fuentes: manual (la persona) y oculto (MMV no está visible). Hay pausa mientras haya alguna activa;
// `desde` es el inicio del tramo de pausa en curso y `acum` lo ya cerrado, en segundos.
export const pausaNueva = () => ({acum: 0, desde: 0, manual: false, oculto: false})
export const estaPausado = p => !!(p && (p.manual || p.oculto))

// Cambia una fuente. Devuelve el mismo objeto si no hay cambio (sirve para evitar renders).
export function cambiarPausa(p, fuente, activa, ahora) {
  if (fuente !== 'manual' && fuente !== 'oculto') return p
  if (!!p[fuente] === !!activa) return p
  const antes = estaPausado(p)
  const n = {...p, [fuente]: !!activa}
  const despues = estaPausado(n)
  if (!antes && despues) n.desde = ahora
  if (antes && !despues) {
    n.acum = p.acum + Math.max(0, Math.round((ahora - p.desde) / 1000))
    n.desde = 0
  }
  return n
}

// Segundos del tramo de pausa en curso (0 si no hay).
export const segPausaActual = (p, ahora) =>
  p && p.desde ? Math.max(0, Math.round((ahora - p.desde) / 1000)) : 0

// Total de pausa de la caminata: lo cerrado más el tramo en curso.
export const pausaTotalSeg = (p, ahora) => (p ? p.acum : 0) + segPausaActual(p, ahora)

// Tiempo en marcha: desde el inicio, sin las pausas.
export function tiempoActivoSeg({inicio, ahora, pausa}) {
  if (!Number.isFinite(inicio) || inicio <= 0 || !Number.isFinite(ahora)) return 0
  return Math.max(0, Math.round((ahora - inicio) / 1000 - pausaTotalSeg(pausa, ahora)))
}

// Para guardar la caminata en curso en el teléfono. `visto` = última vez que la app estuvo abierta.
export const relojParaGuardar = ({inicio, pausa, visto}) =>
  JSON.stringify({
    i: Math.round(inicio) || 0,
    a: Math.round(pausa.acum) || 0,
    d: pausa.manual ? Math.round(pausa.desde) || 0 : 0,
    m: pausa.manual ? 1 : 0,
    v: Math.round(visto) || 0
  })

// Recupera lo guardado. Si la app estuvo cerrada más de `cierreMinSeg`, ese tiempo cuenta como pausa
// (salvo que ya estuviera en pausa manual: esa sigue corriendo desde donde empezó). Devuelve null si no sirve.
export function relojDesdeGuardado(texto, ahora, cfg = BOLSILLO_CFG) {
  let o
  try {
    o = JSON.parse(texto)
  } catch {
    return null
  }
  if (!o || !Number.isFinite(o.i) || o.i <= 0 || o.i > ahora) return null
  const manual = !!o.m && Number.isFinite(o.d) && o.d > 0
  const pausa = {
    acum: Number.isFinite(o.a) && o.a > 0 ? o.a : 0,
    desde: manual ? o.d : 0,
    manual,
    oculto: false
  }
  if (!manual && Number.isFinite(o.v) && o.v > 0 && ahora - o.v > cfg.cierreMinSeg * 1000)
    pausa.acum += Math.round((ahora - o.v) / 1000)
  return {inicio: o.i, pausa}
}

// ---------- Textos ----------
// Estado para mostrar con ícono + texto. Suma la pausa manual al de metaPasos.estadoConteo.
export function estadoVista({
  activo,
  visible = true,
  manual = false,
  usarGps = false,
  senal = '',
  sesion = 0
} = {}) {
  if (!activo) return null
  if (manual) return {id: 'pausa', icono: 'pausa', texto: 'En pausa'}
  return estadoConteo({activo, visible, usarGps, senal, sesion})
}

export const textoPausaVista = seg => `Pausa · ${formatoReloj(seg)} · no se cuenta nada`

// Texto para lectores de pantalla (el número grande no se anuncia en vivo).
export function resumenBolsillo({
  pasosHoy = 0,
  meta = 0,
  sesion = 0,
  km = '0,00',
  tiempo = '0:00',
  ritmo = '—',
  pausada = false
} = {}) {
  const base = meta > 0 ? textoAnillo('Pasos de hoy', pasosHoy, meta) : `Pasos de hoy: ${pasosHoy}`
  const r = ritmo === '—' ? 'ritmo sin datos' : `ritmo ${ritmo} minutos por kilómetro`
  return `${base}. Esta caminata: ${sesion} pasos. ${km} kilómetros, tiempo ${tiempo}, ${r}.${pausada ? ' En pausa.' : ''}`
}
