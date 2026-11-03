// Entreno ágil (entrega 9) y pizarra simple (entrega 11): repetir sesión, plantillas, RPE por bloque, serie pesada, video,
// revisión de la lectura de la pizarra e «igual que la última». Funciones puras.
// Las plantillas y «repetir» copian la ESTRUCTURA (tipo, minutos, ejercicios y tiempos del reloj),
// nunca lo que anotaste: ningún peso ni repetición se guarda como hecho sin que lo cargues vos.
import {claveAl} from './alimentos.js'
import {sumaDias} from './stats.js'
import {TIPOS} from './temporizador.js'

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

// ======================= Entrega 11: pizarra simple =======================
// ---- Clave de un ejercicio (sin números, * ni ?): enlaza «Última», récords y 1RM con tu historial ----
export const claveEjercicio = s =>
  String(s ?? '')
    .replace(/[\d*?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// ---- Qué bloques piden kg y reps ----
// Movilidad y warm up son de tiempo (p. ej. 40 s, 2 rondas): no piden cargas; se pueden anotar aparte, si querés.
export const SIN_CARGAS = ['movilidad', 'warmup']
export const pideCargas = b => !SIN_CARGAS.includes(b?.tipo)

// ---- Lectura de la pizarra ----
const SINONIMOS = {
  movilidad: 'movilidad',
  warmup: 'warmup',
  calentamiento: 'warmup',
  emom: 'emom',
  amrap: 'amrap',
  tabata: 'tabata',
  fortime: 'forTime'
}
const normTipo = t => SINONIMOS[String(t ?? '').toLowerCase().replace(/[\s_-]/g, '')] || 'amrap'
// Convierte lo que devolvió la IA en una sesión válida (nunca rompe aunque venga mal armada).
export function lecturaASesion(r) {
  const lista = Array.isArray(r?.bloques) ? r.bloques : Array.isArray(r) ? r : []
  const bloques = lista
    .filter(b => b && typeof b === 'object')
    .map(b => {
      const m = num(b.minutos),
        o = estructuraBloque({...b, tipo: normTipo(b.tipo), minutos: m > 0 ? m : undefined})
      o.ejercicios = o.ejercicios.map(e => e.trim()).filter(Boolean)
      return o
    })
  return {bloques}
}
const limpio = e => String(e ?? '').replace(/[*?]/g, '').replace(/\s+/g, ' ').trim()
// Lo que se muestra en la pantalla de revisión: texto limpio, dudas (?) y videos (*).
export function revisionLectura(bloques) {
  let nEjercicios = 0,
    nDudas = 0,
    nVideos = 0
  const out = (bloques || []).map(b => {
    const ejercicios = (b?.ejercicios || [])
      .filter(e => String(e ?? '').trim())
      .map(e => {
        const duda = String(e).includes('?'),
          video = llevaVideo(e)
        nEjercicios++
        if (duda) nDudas++
        if (video) nVideos++
        return {texto: limpio(e), duda, video}
      })
    return {tipo: b?.tipo, minutos: num(b?.minutos) > 0 ? num(b.minutos) : 0, ejercicios}
  })
  return {bloques: out, nEjercicios, nDudas, nVideos, vacia: nEjercicios === 0}
}
// «Está bien»: las lecturas dudosas quedan confirmadas, se les saca el «?» (el «*» se conserva).
export const confirmarLectura = bloques =>
  (bloques || []).map(b => ({
    ...b,
    ejercicios: (b?.ejercicios || []).map(e => String(e ?? '').replace(/\?/g, '').replace(/\s+/g, ' ').trim())
  }))

// ---- «Igual que la última» ----
export const hayCarga = x => !!x && (num(x.kg) > 0 || num(x.reps) > 0 || num(x.repsL) > 0 || num(x.repsR) > 0)
export const textoUltima = u =>
  u ? `${num(u.kg) || 0} kg × ${u.uni ? `${num(u.repsL) || 0}/${num(u.repsR) || 0}` : num(u.reps) || 0}` : ''
export const valoresDeUltima = u => ({kg: u.kg, reps: u.reps, repsL: u.repsL, repsR: u.repsR, uni: u.uni})
// De los registros de un ejercicio: el último del mismo tipo de bloque o, si no hay, el último de todos.
export function elegirUltima(registros, tipo) {
  const a = [...(registros || [])].sort((x, y) =>
    x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : (x.id || 0) - (y.id || 0)
  )
  return [...a].reverse().find(r => r.tipo === tipo) || a[a.length - 1] || null
}
// Completa SOLO lo que falta con la última vez (mapa: clave → registro). Lo que ya cargaste no se toca,
// salvo que pidas sobrescribir. Devuelve el nuevo `reg` y cuántos ejercicios se completaron.
export function aplicarUltimas(b, mapa, clave = claveEjercicio, sobrescribir = false) {
  const reg = {...(b?.reg || {})}
  let n = 0
  ;(b?.ejercicios || []).forEach((e, j) => {
    const k = String(e ?? '').trim() ? clave(e) : '',
      u = k ? mapa?.[k] : null
    if (!u || (!sobrescribir && hayCarga(reg[j]))) return
    reg[j] = {...reg[j], ...valoresDeUltima(u)}
    n++
  })
  return {reg, n}
}

// ---- Sesión manual con tus 5 bloques (entrega 15, PZ10) ----
// La estructura de tu clase: movilidad, warm up, EMOM de 12 min con 6 ejercicios, For time de 10 min y Tabata 20/10.
// Los ejercicios vienen en blanco (solo los espacios para escribirlos): ningún nombre, peso ni repetición se inventa.
// Los tiempos del reloj usan los valores de siempre (40 s × 2 vueltas, EMOM cada 60 s, Tabata 20/10 × 8 rondas).
const hueco = n => Array.from({length: n}, () => '')
export const sesionManual5 = () => ({
  bloques: [
    {tipo: 'movilidad', minutos: 4, ejercicios: hueco(3)},
    {tipo: 'warmup', minutos: 4, ejercicios: hueco(3)},
    {tipo: 'emom', minutos: 12, ejercicios: hueco(6)},
    {tipo: 'forTime', minutos: 10, ejercicios: hueco(3)},
    {tipo: 'tabata', minutos: 4, ejercicios: hueco(2)}
  ]
})
const tieneTexto = b => (b?.ejercicios || []).some(e => String(e ?? '').trim())
const tieneResultado = b => ['rondas', 'extra', 'minOk', 'tiempo', 'rpe'].some(k => num(b?.[k]) > 0)
// Al guardar la sesión: se van los bloques que quedaron sin ejercicios ni resultados (por ejemplo un Tabata que ese día no hubo)
// y los espacios en blanco del final de cada lista. Los espacios del medio se conservan: los registros se indexan por posición.
export function podarBloquesVacios(bloques) {
  return (bloques || [])
    .filter(b => tieneTexto(b) || tieneResultado(b))
    .map(b => {
      const ej = [...(b.ejercicios || [])]
      while (ej.length && !String(ej[ej.length - 1] ?? '').trim()) ej.pop()
      return {...b, ejercicios: ej}
    })
}

// ---- Orden de los ejercicios (entrega 17) ----
// Mueve el ejercicio `i` una posición (d = -1 sube, +1 baja). Lo anotado (`reg`) viaja con su ejercicio, porque los
// registros se asocian por posición. Devuelve un bloque nuevo; si no se puede mover, devuelve el mismo bloque.
export function moverEjercicio(b, i, d) {
  const ej = [...(b?.ejercicios || [])],
    j = i + d
  if (!Number.isInteger(i) || (d !== -1 && d !== 1) || i < 0 || i >= ej.length || j < 0 || j >= ej.length) return b
  ;[ej[i], ej[j]] = [ej[j], ej[i]]
  const out = {...b, ejercicios: ej}
  if (b.reg) {
    const reg = {...b.reg}
    ;[reg[i], reg[j]] = [b.reg[j], b.reg[i]]
    for (const k of [i, j]) if (reg[k] === undefined) delete reg[k]
    out.reg = reg
  }
  return out
}

// ---- Entrada a Entreno: el método que usaste la última vez va primero (por defecto, la pizarra) ----
const ENTRADAS = ['pizarra', 'ultima', 'plantillas']
export function ordenEntrada(ultimo) {
  const u = ultimo === 'manual' ? 'pizarra' : ultimo === 'plantilla' ? 'plantillas' : ultimo
  return ENTRADAS.includes(u) ? [u, ...ENTRADAS.filter(x => x !== u)] : [...ENTRADAS]
}

// ---- Sesión en curso (guardada como texto en el navegador) ----
// Antes, al terminar o descartar se guardaba el texto «null» y Hoy seguía diciendo «CONTINUAR ENTRENO».
export function haySesionEnCurso(raw) {
  if (!raw) return false
  try {
    const s = JSON.parse(raw)
    return !!s && typeof s === 'object' && Array.isArray(s.bloques)
  } catch {
    return false
  }
}
