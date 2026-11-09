// Movimiento diario (Entrega 29): pasos, actividades registradas y rutas GPS juntos, SIN contar dos veces
// la misma salida. Lógica pura: no toca el navegador ni la base.
//
// Una salida puede existir como actividad Y como ruta (el GPS las guarda juntas y las enlaza con `rutaId`),
// o solo como ruta (un GPX importado, o una ruta sin actividad registrada). La regla es:
//   1. Una ruta enlazada por `rutaId` a una actividad ya cuenta en esa actividad.
//   2. Una ruta sin enlace que coincide con una actividad sin enlace (mismo día, mismo tipo y distancia o
//      duración parecidas) se considera la misma salida: cuenta una sola vez, como actividad.
//   3. El resto de las rutas cuenta aparte («rutas aparte»).
//
// Privacidad (D3): hacia la IA solo salen totales. Este módulo NO lee coordenadas, trazos, horas de inicio ni
// notas: trabaja con filas ya reducidas (`rutaSinTrazo`, `actividadSinNota`) y `actividadParaIA` elige
// campo por campo lo único que puede viajar (una prueba lo vigila).
import {resumenRutasParaIA} from './rutas.js'
import {sumaDias, pct} from './stats.js'

const r1 = n => Math.round(n * 10) / 10
const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const enSemana = (f, d) => f >= d && f <= sumaDias(d, 6)

// ---------- Filas reducidas (lo único que sale de la capa de datos) ----------

// De una ruta guardada se queda solo con lo agregable: nada de puntos, tramos, horas ni parciales.
export const rutaSinTrazo = r => ({
  id: r.id,
  fecha: r.fecha,
  tipo: r.tipo || 'otro',
  distM: +r.distM || 0,
  seg: +r.seg || 0,
  sube: +r.sube || 0,
  ritmo: r.ritmo > 0 ? +r.ritmo : null
})

// De una actividad se queda sin la nota (texto libre).
export const actividadSinNota = a => ({
  id: a.id,
  fecha: a.fecha,
  tipo: a.tipo || 'otro',
  minutos: +a.minutos || 0,
  km: +a.km || 0,
  rutaId: Number.isInteger(+a.rutaId) && +a.rutaId > 0 ? +a.rutaId : null
})

// ---------- Rutas que ya están en una actividad ----------

export const COINCIDE = {
  kmRel: 0.15, // diferencia relativa máxima de distancia
  kmMin: 0.3, // km: tolerancia mínima (en salidas cortas el GPS y la mano no coinciden al metro)
  minRel: 0.2, // diferencia relativa máxima de duración (solo si falta la distancia)
  minMin: 5 // min: tolerancia mínima de duración
}

// Qué tan parecidas son una actividad y una ruta del mismo día y tipo: 0 (idénticas) a 1; null si no coinciden
// o no hay con qué comparar.
function distancia(a, r) {
  const rKm = r.distM / 1000,
    rMin = r.seg / 60
  if (a.km > 0 && rKm > 0) {
    const d = Math.abs(a.km - rKm)
    return d <= Math.max(COINCIDE.kmMin, COINCIDE.kmRel * Math.max(a.km, rKm))
      ? d / Math.max(a.km, rKm)
      : null
  }
  if (a.minutos > 0 && rMin > 0) {
    const d = Math.abs(a.minutos - rMin)
    return d <= Math.max(COINCIDE.minMin, COINCIDE.minRel * Math.max(a.minutos, rMin))
      ? d / Math.max(a.minutos, rMin)
      : null
  }
  return null
}

// Separa las rutas en las que ya cuentan dentro de una actividad y las que cuentan aparte.
// Devuelve {aparte: [rutas], enActividad: [rutas]} (cada ruta, en una sola lista).
export function repartirRutas(rutas = [], actividades = []) {
  const enlazadas = new Set(actividades.map(a => a.rutaId).filter(Boolean))
  const cubiertas = new Set()
  for (const r of rutas) if (enlazadas.has(r.id)) cubiertas.add(r)
  // Emparejamiento uno a uno entre lo que quedó sin enlace: el más parecido primero, así dos salidas
  // el mismo día no se tapan entre sí.
  const libres = actividades.filter(a => !a.rutaId)
  const pares = []
  for (const r of rutas) {
    if (cubiertas.has(r)) continue
    for (const a of libres) {
      if (a.fecha !== r.fecha || a.tipo !== r.tipo) continue
      const d = distancia(a, r)
      if (d !== null) pares.push({a, r, d})
    }
  }
  pares.sort((x, y) => x.d - y.d || (x.r.id || 0) - (y.r.id || 0) || (x.a.id || 0) - (y.a.id || 0))
  const usadas = new Set()
  for (const {a, r} of pares) {
    if (usadas.has(a) || cubiertas.has(r)) continue
    usadas.add(a)
    cubiertas.add(r)
  }
  return {
    aparte: rutas.filter(r => !cubiertas.has(r)),
    enActividad: rutas.filter(r => cubiertas.has(r))
  }
}

export const rutasAparte = (rutas, actividades) => repartirRutas(rutas, actividades).aparte

// ---------- Carga de la actividad (para el puntaje de preparación) ----------

// Esfuerzo percibido típico por tipo (escala RPE 1–10). Es una propuesta de diseño, no sale de un estudio:
// sirve para sumar la actividad al mismo «RPE × minutos» que usan las sesiones de entreno.
export const RPE_ACTIVIDAD = {
  caminata: 2,
  bicicleta: 5,
  carrera: 6,
  natacion: 6,
  deporte: 6,
  otro: 4
}

export const cargaActividad = ({tipo, minutos}) => {
  const min = Math.min(1440, Math.max(0, +minutos || 0))
  return Math.round(min * (RPE_ACTIVIDAD[tipo] ?? RPE_ACTIVIDAD.otro))
}

// Todo lo que cuenta como esfuerzo fuera del entreno: las actividades y las rutas que no están en ninguna.
// Devuelve [{fecha, carga, minutos}].
export function cargasExternas(actividades = [], rutas = []) {
  const deActividad = actividades.map(a => ({
    fecha: a.fecha,
    carga: cargaActividad(a),
    minutos: Math.max(0, +a.minutos || 0)
  }))
  const deRuta = rutasAparte(rutas, actividades).map(r => {
    const minutos = Math.round(r.seg / 60)
    return {fecha: r.fecha, carga: cargaActividad({tipo: r.tipo, minutos}), minutos}
  })
  return [...deActividad, ...deRuta].filter(x => x.fecha)
}

// ---------- Pasos ----------

const pasosDe = h => (+h?.pasos > 0 ? +h.pasos : 0)

// Pasos de ayer contra el promedio de los 28 días anteriores (solo días con dato). null si no hay pasos de ayer.
export function pasosContexto(habitos = [], fecha) {
  if (!fecha) return null
  const ayer = habitos.find(h => h.fecha === sumaDias(fecha, -1))
  if (!(pasosDe(ayer) > 0)) return null
  const d0 = sumaDias(fecha, -28),
    previos = habitos
      .filter(h => h.fecha >= d0 && h.fecha < sumaDias(fecha, -1))
      .map(pasosDe)
      .filter(x => x > 0)
  return {
    ayer: pasosDe(ayer),
    habitual: previos.length >= 5 ? Math.round(media(previos)) : null
  }
}

// ---------- Semana ----------

const resumenPorTipo = lista => {
  const porTipo = {}
  for (const a of lista) {
    const t = a.tipo || 'otro'
    porTipo[t] ??= {cantidad: 0, minutos: 0, km: 0}
    porTipo[t].cantidad++
    porTipo[t].minutos += a.minutos
    porTipo[t].km = r1(porTipo[t].km + a.km)
  }
  return porTipo
}

// Resumen de una semana (lunes a domingo). `habitos`, `actividades` y `rutas` pueden traer más días: acá se filtran.
// Las rutas deben venir sin trazo (`rutaSinTrazo`); aun así, lo que sale solo tiene totales.
export function movimientoSemana({desde, habitos = [], actividades = [], rutas = []}) {
  const hs = habitos.filter(h => enSemana(h.fecha, desde)),
    ant = habitos.filter(h => enSemana(h.fecha, sumaDias(desde, -7)))
  const ps = hs.map(pasosDe).filter(x => x > 0),
    psAnt = ant.map(pasosDe).filter(x => x > 0)
  const medios = ps.length ? Math.round(media(ps)) : null,
    mediosAnt = psAnt.length ? Math.round(media(psAnt)) : null
  const acts = actividades.filter(a => enSemana(a.fecha, desde))
  const rs = rutas.filter(r => enSemana(r.fecha, desde))
  const {aparte, enActividad} = repartirRutas(rs, acts)
  const minutos = acts.reduce((s, a) => s + a.minutos, 0),
    km = r1(acts.reduce((s, a) => s + a.km, 0))
  const sueltas = resumenRutasParaIA(aparte)
  return {
    pasos: {
      diasConDato: ps.length,
      medios,
      total: ps.reduce((s, x) => s + x, 0),
      // solo se compara si ambas semanas tienen pasos
      vsAnterior: medios !== null && mediosAnt !== null ? pct(medios, mediosAnt) : null
    },
    actividades: {cantidad: acts.length, minutos, km, porTipo: resumenPorTipo(acts)},
    rutasAparte: sueltas,
    rutasEnActividades: enActividad.length, // solo para mostrar en pantalla; no viaja a la IA
    total: {
      minutos: minutos + sueltas.minutos,
      km: r1(km + sueltas.km)
    }
  }
}

export const hayMovimiento = m =>
  !!m && (m.pasos.diasConDato > 0 || m.actividades.cantidad > 0 || m.rutasAparte.rutas > 0)

// Lo ÚNICO de la semana que puede viajar a la IA: totales, elegidos campo por campo (nunca un volcado del
// objeto, para que un campo nuevo no se cuele sin querer).
export function movimientoParaIA(m) {
  if (!m) return null
  const t = {}
  for (const [k, v] of Object.entries(m.actividades.porTipo || {}))
    t[k] = {cantidad: v.cantidad, minutos: v.minutos, km: v.km}
  const s = m.rutasAparte
  return {
    pasos: {
      diasConDato: m.pasos.diasConDato,
      medios: m.pasos.medios,
      vsAnteriorPct: m.pasos.vsAnterior
    },
    actividades: {
      cantidad: m.actividades.cantidad,
      minutos: m.actividades.minutos,
      km: m.actividades.km,
      porTipo: t
    },
    rutasAparte: {
      rutas: s.rutas,
      km: s.km,
      minutos: s.minutos,
      desnivelSubeM: s.desnivelSubeM,
      kmMasLarga: s.kmMasLarga,
      ritmoMedioSegKm: s.ritmoMedioSegKm
    },
    total: {minutos: m.total.minutos, km: m.total.km}
  }
}
