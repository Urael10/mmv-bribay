// Entrega 33 · Meta de pasos y estado del conteo (lógica pura). El dibujo está en src/ui/Anillo.jsx.
import {sumaDias} from './stats.js'

export const META_MIN = 1000
export const META_MAX = 100000
export const PROMEDIO_DIAS = 28
export const PROMEDIO_MIN_DIAS = 3 // días con pasos para usar tu propio promedio como referencia

const pasosDe = h => (+h?.pasos > 0 ? +h.pasos : 0)
const miles = n => Math.round(n).toLocaleString('es-AR')

// Texto del campo «Meta diaria» → {ok, meta}. Vacío es válido (sin meta propia: se usa tu promedio).
export function parsearMeta(txt) {
  const t = String(txt ?? '').trim().replace(/[.\s]/g, '')
  if (t === '') return {ok: true, meta: null}
  if (!/^\d+$/.test(t)) return {ok: false, meta: null}
  const n = Number(t)
  if (n < META_MIN || n > META_MAX) return {ok: false, meta: null}
  return {ok: true, meta: n}
}

// Promedio de pasos de los 28 días anteriores a `fecha` (sin contarla), solo días con pasos.
// null si hay menos de PROMEDIO_MIN_DIAS días con dato.
export function promedioPasos(habitos = [], fecha) {
  const desde = sumaDias(fecha, -PROMEDIO_DIAS),
    hasta = sumaDias(fecha, -1)
  const ps = habitos.filter(h => h.fecha >= desde && h.fecha <= hasta).map(pasosDe).filter(x => x > 0)
  if (ps.length < PROMEDIO_MIN_DIAS) return null
  return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)
}

// Meta que usa el anillo: la propia si la hay; si no, tu promedio; si no hay ninguna, sin meta (anillo vacío).
export function metaEfectiva({meta, promedio} = {}) {
  if (meta > 0) return {valor: Math.round(meta), origen: 'propia'}
  if (promedio > 0) return {valor: Math.round(promedio), origen: 'promedio'}
  return {valor: 0, origen: null}
}

export function textoMetaPasos(ef) {
  if (ef.origen === 'propia') return `de ${miles(ef.valor)} · tu meta`
  if (ef.origen === 'promedio') return `de ${miles(ef.valor)} · tu promedio de ${PROMEDIO_DIAS} días`
  return 'Sin meta · definila en «Ajustes del conteo»'
}

// Pasos del día para el centro del anillo: lo ya guardado más lo que va contando el sensor (solo hoy).
export function pasosEnVivo({total, sesion, activo, esHoy}) {
  const base = Math.max(0, Math.round(Number(total) || 0)),
    extra = activo && esHoy ? Math.max(0, Math.round(Number(sesion) || 0)) : 0
  return base + extra
}

// Estado del conteo para mostrar con ícono + texto (nunca solo color).
export function estadoConteo({activo, visible = true, usarGps = false, senal = '', sesion = 0} = {}) {
  if (!activo) return null
  if (!visible) return {id: 'pausa', icono: 'pausa', texto: 'En pausa · MMV no está visible'}
  if (usarGps && senal === 'buscando' && !(sesion > 0))
    return {id: 'buscando', icono: 'ubicacion', texto: 'Buscando señal de GPS'}
  return {id: 'contando', icono: 'punto', texto: usarGps ? 'Contando · sensor y GPS' : 'Contando · sensor'}
}

// «3 min 12 s» para el tiempo que MMV estuvo oculto (el sensor web no cuenta en segundo plano).
export function textoPausa(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0))
  if (s < 1) return ''
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60),
    r = s % 60
  if (m < 60) return r ? `${m} min ${r} s` : `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}
