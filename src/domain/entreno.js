// Entreno ágil (entrega 9): repetir sesión, plantillas, RPE por bloque, serie pesada y video. Funciones puras.
// Las plantillas y «repetir» copian la ESTRUCTURA (tipo, minutos, ejercicios y tiempos del reloj),
// nunca lo que anotaste: ningún peso ni repetición se guarda como hecho sin que lo cargues vos.
import {claveAl} from './alimentos.js'
import {sumaDias} from './stats.js'

const CAMPOS_ESTRUCTURA = ['tipo', 'nombre', 'minutos', 'ejercicios', 'intervalo', 'trab', 'desc', 'rond']
const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Copia solo la estructura de un bloque (sin registros, rondas, tiempo, RPE ni video).
export function estructuraBloque(b) {
  const o = {}
  for (const k of CAMPOS_ESTRUCTURA) if (b?.[k] !== undefined && b[k] !== '' && b[k] !== null) o[k] = b[k]
  o.tipo = o.tipo || 'amrap'
  o.ejercicios = (Array.isArray(o.ejercicios) ? o.ejercicios : []).map(e => String(e))
  return o
}
export const estructuraSesion = bloques => ({bloques: (bloques || []).map(estructuraBloque)})

// ---- Repetir sesión ----
// La última sesión guardada (por fecha; a igual fecha, la de mayor id) que tenga al menos un bloque con ejercicios.
export function ultimaSesion(sesiones) {
  const con = (sesiones || []).filter(s => (s.bloques || []).some(b => (b.ejercicios || []).some(e => String(e).trim())))
  con.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.id || 0) - (a.id || 0)))
  return con[0] || null
}
export const sesionDesdeUltima = s => estructuraSesion(s?.bloques)
export const resumenSesion = s => {
  const b = s?.bloques || [],
    n = b.reduce((a, x) => a + (x.ejercicios || []).filter(e => String(e).trim()).length, 0)
  return `${b.length} ${b.length === 1 ? 'bloque' : 'bloques'} · ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`
}

// ---- Plantillas (tabla «rutinas») ----
export function rutinaDesdeSesion(nombre, bloques) {
  const n = String(nombre || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  if (!n) throw new Error('Poné un nombre para la plantilla.')
  const est = estructuraSesion(bloques).bloques.filter(b => b.ejercicios.some(e => e.trim()))
  if (!est.length) throw new Error('La sesión no tiene ejercicios para guardar.')
  return {nombre: n, clave: claveAl(n), bloques: est, creado: new Date().toISOString()}
}
export const sesionDesdeRutina = r => estructuraSesion(r?.bloques)
// Si ya existe una plantilla con ese nombre, se actualiza (conserva id y fecha de creación).
export const fusionarRutina = (nueva, existente) =>
  existente ? {...nueva, id: existente.id, creado: existente.creado || nueva.creado} : nueva

// ---- RPE por bloque ----
// Promedio ponderado por minutos de los RPE cargados por bloque (1–10). null si ninguno tiene RPE.
export function rpeSugerido(bloques) {
  let suma = 0,
    peso = 0
  for (const b of bloques || []) {
    const r = num(b.rpe)
    if (!(r >= 1 && r <= 10)) continue
    const w = num(b.minutos) > 0 ? num(b.minutos) : 1
    suma += r * w
    peso += w
  }
  return peso ? Math.min(10, Math.max(1, Math.round(suma / peso))) : null
}

// ---- Serie pesada ----
// La serie pesada es la serie más cargada del ejercicio: pkg (kg) y preps (repeticiones). Se usa solo para
// estimar mejor el 1RM; el volumen sigue saliendo del resumen kg × reps del ejercicio.
export function seriePesada(x) {
  const kg = num(x?.pkg),
    reps = num(x?.preps)
  return kg > 0 && reps > 0 ? {kg, reps} : null
}
export function validarSeriePesada(x) {
  const hayKg = num(x?.pkg) > 0,
    hayReps = num(x?.preps) > 0
  if (!hayKg && !hayReps && !x?.pkg && !x?.preps) return null // sin serie pesada: es válido
  if (!hayKg || !hayReps) return 'La serie pesada necesita kg y repeticiones.'
  if (num(x.preps) !== Math.round(num(x.preps))) return 'Las repeticiones de la serie pesada son un número entero.'
  return null
}

// ---- Video grabado ----
export const llevaVideo = e => String(e || '').includes('*')
export const bloqueConVideo = b => (b?.ejercicios || []).some(llevaVideo)
// Ejercicios con asterisco de las sesiones de los últimos `dias` días cuyo bloque no tiene el video grabado.
export function videosPendientes(sesiones, fecha, dias = 14) {
  const desde = sumaDias(fecha, -(dias - 1)),
    out = []
  for (const s of sesiones || [])
    if (s.fecha >= desde && s.fecha <= fecha)
      for (const b of s.bloques || [])
        if (!b.video)
          for (const e of b.ejercicios || [])
            if (llevaVideo(e)) out.push({fecha: s.fecha, nombre: String(e).replace(/[*?]/g, '').trim()})
  return out
}
