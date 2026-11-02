// Cuerpo: peso y composición (funciones puras, sin React ni base de datos).
// Los datos de bioimpedancia varían con la hidratación, la comida y la hora: sirven para ver la TENDENCIA,
// no para tomar decisiones con un número suelto. Todo lo que no sea el peso es opcional.
import {sumaDias} from './stats.js'

const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const r1 = x => Math.round(x * 10) / 10
const r2 = x => Math.round(x * 100) / 100

// Campos que puede dar una báscula. `min`/`max` solo atajan errores de tipeo; no son valores "normales".
export const CAMPOS = [
  {k: 'peso', n: 'Peso', u: 'kg', min: 20, max: 400, req: true},
  {k: 'grasa', n: 'Grasa corporal', u: '%', min: 2, max: 70},
  {k: 'musculo', n: 'Masa muscular', u: 'kg', min: 5, max: 150},
  {k: 'agua', n: 'Agua corporal', u: '%', min: 20, max: 80},
  {k: 'visceral', n: 'Grasa visceral', u: 'nivel', min: 1, max: 59},
  {k: 'bmr', n: 'Metabolismo basal', u: 'kcal', min: 500, max: 5000},
  {k: 'oseo', n: 'Masa ósea', u: 'kg', min: 0.5, max: 8}
]
export const PROT_KG = 1.6 // g de proteína por kg de peso (orientación; el rango habitual en deporte es ~1,4–2,0)

// Convierte lo que se escribió (texto, con coma) en una medida limpia. Los campos vacíos no se guardan.
export function normalizarMedida(raw, fecha) {
  const m = {fecha: raw?.fecha || fecha, estandar: raw?.estandar !== false}
  for (const c of CAMPOS) {
    const n = num(raw?.[c.k])
    if (n !== null) m[c.k] = c.k === 'bmr' ? Math.round(n) : r2(n)
  }
  return m
}

// Devuelve el mensaje de error o null si está bien.
export function validarMedida(m) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m?.fecha || '')) return 'Falta la fecha.'
  if (!(m.peso > 0)) return 'Poné al menos el peso.'
  for (const c of CAMPOS) {
    if (m[c.k] === undefined) continue
    if (!(m[c.k] >= c.min && m[c.k] <= c.max))
      return `${c.n}: ${m[c.k]} ${c.u} no parece correcto (entre ${c.min} y ${c.max}).`
  }
  return null
}

// Promedio de un campo en los `dias` que terminan en `hasta` (inclusive). Para composición solo cuentan
// las medidas hechas en tus condiciones habituales (`estandar`); el peso cuenta todas.
export function promedioVentana(medidas, hasta, campo = 'peso', dias = 7) {
  const d0 = sumaDias(hasta, -(dias - 1))
  const xs = medidas
    .filter(m => m.fecha >= d0 && m.fecha <= hasta && m[campo] > 0)
    .filter(m => campo === 'peso' || m.estandar !== false)
    .map(m => m[campo])
  return xs.length ? {v: r1(xs.reduce((s, x) => s + x, 0) / xs.length), n: xs.length} : null
}

// Tendencia: promedio de los últimos 7 días contra el de hace 4 semanas.
export function tendencia(medidas, fecha, campo = 'peso') {
  const act = promedioVentana(medidas, fecha, campo, 7),
    ant = promedioVentana(medidas, sumaDias(fecha, -28), campo, 7)
  return {
    actual: act?.v ?? null,
    hace4: ant?.v ?? null,
    delta: act && ant ? r1(act.v - ant.v) : null,
    porSemana: act && ant ? r2((act.v - ant.v) / 4) : null
  }
}

export const ultima = (medidas, campo = 'peso') =>
  [...medidas].filter(m => m[campo] > 0).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null

const dias = (d0, d1) =>
  Math.round((new Date(d1 + 'T12:00:00') - new Date(d0 + 'T12:00:00')) / 864e5)

// Objetivo de peso con fecha. `ritmo` en kg/semana (negativo = bajar). Aviso si el ritmo necesario es muy exigente
// (más de 1 % del peso por semana; orientación general, no una norma).
export function objetivo({pesoObj, fechaObj, medidas = [], fecha}) {
  const po = num(pesoObj),
    u = ultima(medidas, 'peso')
  if (!(po > 0) || !u) return null
  const f = fechaObj && /^\d{4}-\d{2}-\d{2}$/.test(fechaObj) ? fechaObj : null
  const faltan = r1(po - u.peso),
    sem = f ? dias(fecha, f) / 7 : null,
    nec = f && sem > 0 ? r2(faltan / sem) : null
  const tend = tendencia(medidas, fecha)
  const out = {
    pesoActual: u.peso,
    pesoObj: po,
    faltan,
    semanas: sem === null ? null : r1(sem),
    ritmoNecesario: nec,
    ritmoActual: tend.porSemana,
    vencido: f !== null && sem <= 0 && faltan !== 0,
    exigente: nec !== null && Math.abs(nec) > 0.01 * u.peso,
    alcanzado: Math.abs(faltan) < 0.3
  }
  return out
}

// Proteína diaria orientativa según el peso (redondeada a 5 g). null si no hay peso.
export function proteinaObjetivo(peso, factor = PROT_KG) {
  const p = num(peso),
    f = num(factor)
  if (!(p > 0) || !(f > 0)) return null
  return Math.round((p * f) / 5) * 5
}

export const edadDe = (anio, hoyIso) => {
  const a = parseInt(anio, 10),
    y = parseInt(String(hoyIso).slice(0, 4), 10)
  return a >= 1900 && a <= y ? y - a : null
}

export const AVISO_BIA =
  'La bioimpedancia cambia con la hidratación, la comida y la hora. Conviene medirte siempre igual (mañana, en ayunas, después de ir al baño) y mirar la tendencia de varias semanas, no un número suelto.'
