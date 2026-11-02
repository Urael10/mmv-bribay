// Progreso (entrega 8): 4 pilares, tests de referencia (D8), progresión y descarga (D11). Funciones puras.
// Los umbrales son criterios de diseño (orientativos): no son indicaciones médicas ni un plan individual.
import {sumaDias, lunes, repsTot, repsLado, e1rm, patron, claveCtx, marcarPorContexto, pct} from './stats.js'
import {cargaSesion} from './preparacion.js'
import {tendencia} from './cuerpo.js'
import {checkinHecho} from './checkin.js'

const r1 = x => Math.round(x * 10) / 10
const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const en = (f, d0, d1) => f >= d0 && f <= d1
const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const coma = n => String(n).replace('.', ',')
const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.id || 0) - (b.id || 0))
const dias = (d0, d1) => Math.round((new Date(d1 + 'T12:00:00') - new Date(d0 + 'T12:00:00')) / 864e5)

export const UMBRAL_E1 = 1 // % mínimo para decir que el 1RM estimado subió o bajó
const tono = d =>
  d === null
    ? {etiqueta: 'Sin datos suficientes', tono: ''}
    : d > 0
      ? {etiqueta: 'Subiendo', tono: 'up'}
      : d < 0
        ? {etiqueta: 'Bajando', tono: 'down'}
        : {etiqueta: 'Estable', tono: ''}

// Registros de un mismo ejercicio y contexto (tipo de bloque), ordenados por fecha.
export function porContexto(registros) {
  const g = {}
  for (const r of [...registros].sort(porFecha)) (g[claveCtx(r)] ||= []).push(r)
  return g
}

// ---- Progresión (D11) ----
const mejorE1 = (arr, d0, d1) => Math.max(0, ...arr.filter(r => en(r.fecha, d0, d1)).map(e1rm))
// Mejor 1RM estimado de los últimos 28 días contra los 28 anteriores. null si falta alguno de los dos.
export function tendenciaE1(arr, fecha) {
  const a = mejorE1(arr, sumaDias(fecha, -27), fecha),
    b = mejorE1(arr, sumaDias(fecha, -55), sumaDias(fecha, -28))
  if (!a || !b) return null
  const d = pct(a, b)
  return {actual: a, previo: b, pct: d, estado: d >= UMBRAL_E1 ? 'sube' : d <= -UMBRAL_E1 ? 'baja' : 'igual'}
}

// Qué hacer con la carga la próxima vez, comparando los dos últimos registros con carga (por lado en unilaterales).
export function sugerenciaCarga(arr) {
  const con = [...arr].sort(porFecha).filter(r => +r.kg > 0 && repsLado(r) > 0)
  if (con.length < 2) return {estado: 'sin-datos', texto: 'Hacen falta al menos 2 registros con carga.'}
  const a = con[con.length - 2],
    b = con[con.length - 1],
    kb = +b.kg,
    ra = repsLado(a),
    rb = repsLado(b)
  if (kb !== +a.kg)
    return {estado: 'consolidar', texto: 'Cambiaste la carga: repetila una vez más antes de volver a cambiarla.'}
  if (rb >= ra) {
    const kgSug = Math.max(kb + 0.5, Math.round(kb * 1.025 * 2) / 2)
    return {estado: 'subir', kgSug, texto: `Igualaste o superaste las reps con ${coma(kb)} kg: probá ${coma(kgSug)} kg.`}
  }
  return {
    estado: 'repetir',
    texto:
      rb < ra * 0.9
        ? 'Bajaron las reps con la misma carga: repetila antes de subir y mirá el sueño y el descanso.'
        : 'Buscá una repetición más con la misma carga.'
  }
}

// Ejercicios (por contexto) con sugerencia, de los más recientes a los más antiguos.
export function progresiones(registros, n = 6) {
  return Object.values(porContexto(registros))
    .map(arr => ({arr, s: sugerenciaCarga(arr)}))
    .filter(x => x.s.estado !== 'sin-datos')
    .map(({arr, s}) => {
      const u = arr[arr.length - 1]
      return {clave: claveCtx(u), nombre: String(u.nombre).replace(/[*?]/g, '').trim(), tipo: u.tipo, ultima: u.fecha, ...s}
    })
    .sort((a, b) => (a.ultima < b.ultima ? 1 : -1))
    .slice(0, n)
}

// ---- Descarga (D11): se sugiere con 2 o más señales ----
export function descarga({fecha, sesiones = [], habitos = []}) {
  const carga = h => sesiones.filter(s => en(s.fecha, sumaDias(h, -6), h)).reduce((a, s) => a + cargaSesion(s), 0)
  const act = carga(fecha),
    prev = [7, 14, 21].map(d => carga(sumaDias(fecha, -d))).filter(x => x > 0),
    senales = []
  if (act > 0 && prev.length >= 2 && act >= 1.2 * media(prev))
    senales.push('La carga de esta semana está 20 % o más por encima de tu promedio de las 3 anteriores.')
  const rp = sesiones
    .filter(s => en(s.fecha, sumaDias(fecha, -13), fecha))
    .map(s => +s.rpe || 0)
    .filter(x => x > 0)
  if (rp.length >= 3 && media(rp) >= 8) senales.push('RPE medio de 8 o más en las últimas 2 semanas.')
  const h7 = habitos.filter(h => en(h.fecha, sumaDias(fecha, -6), fecha))
  if (h7.filter(h => +h.dolor >= 4).length >= 3) senales.push('Dolor muscular de 4 o 5 en 3 días o más esta semana.')
  if (h7.filter(h => num(h.sueno) > 0 && num(h.sueno) < 6).length >= 3)
    senales.push('Menos de 6 h de sueño en 3 días o más esta semana.')
  return {
    sugerir: senales.length >= 2,
    senales,
    texto:
      'Semana de descarga: bajá el volumen cerca de un tercio o a la mitad, mantené la técnica y dejá una o dos repeticiones en reserva. Si el cansancio o el dolor siguen, consultá a un profesional.'
  }
}

// Carga (RPE × minutos) de las últimas `n` semanas, de la más antigua a la actual.
export function cargaSemanalSerie({fecha, sesiones = [], n = 8}) {
  const w = lunes(fecha),
    out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = sumaDias(w, -7 * i)
    out.push({
      desde: d,
      carga: Math.round(sesiones.filter(s => en(s.fecha, d, sumaDias(d, 6))).reduce((a, s) => a + cargaSesion(s), 0))
    })
  }
  return out
}

// ---- Tests de referencia (D8): cada 6–8 semanas, en condiciones parecidas ----
export const TESTS = [
  {k: 'dominadas', n: 'Dominadas máximas', u: 'reps', mejor: 'mas', pilar: 'fuerza'},
  {k: 'flexiones', n: 'Flexiones máximas', u: 'reps', mejor: 'mas', pilar: 'fuerza'},
  {k: 'plancha', n: 'Plancha máxima', u: 'seg', mejor: 'mas', pilar: 'fuerza'},
  {k: 'km1', n: '1 km lo más rápido posible (correr o remo)', u: 'seg', mejor: 'menos', pilar: 'resistencia'},
  {k: 'burpees5', n: 'Burpees en 5 minutos', u: 'reps', mejor: 'mas', pilar: 'resistencia'}
]
export const TEST_DIAS = {toca: 42, tarde: 56}

export function normalizarTest(raw, fecha) {
  return {fecha: raw?.fecha || fecha, clave: raw?.clave, valor: num(raw?.valor)}
}
export function validarTest(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t?.fecha || '')) return 'Falta la fecha.'
  if (!TESTS.some(x => x.k === t.clave)) return 'Test desconocido.'
  if (!(t.valor > 0 && t.valor <= 100000)) return 'Poné un número mayor que cero.'
  return null
}

// Por test: último y anterior resultado, días desde el último, estado y si mejoró.
export function estadoTests(tests, fecha) {
  return TESTS.map(def => {
    const hist = tests.filter(t => t.clave === def.k).sort(porFecha),
      ultimo = hist[hist.length - 1] || null,
      anterior = hist[hist.length - 2] || null,
      d = ultimo ? dias(ultimo.fecha, fecha) : null,
      delta = ultimo && anterior ? r1(ultimo.valor - anterior.valor) : null
    return {
      ...def,
      hist,
      ultimo,
      anterior,
      dias: d,
      estado: !ultimo ? 'nunca' : d < TEST_DIAS.toca ? 'al-dia' : d < TEST_DIAS.tarde ? 'toca' : 'atrasado',
      delta,
      mejoro: !delta ? null : def.mejor === 'mas' ? delta > 0 : delta < 0
    }
  })
}

// ---- Los 4 pilares: lo que cambió en 28 días contra los 28 anteriores ----
export function pilares({fecha, registros = [], sesiones = [], habitos = [], comidas = [], medidas = [], tests = [], manual = {}, metaAgua = 2500}) {
  const d0 = sumaDias(fecha, -27),
    p1 = sumaDias(fecha, -28),
    p0 = sumaDias(fecha, -55)
  // Fuerza: 1RM estimado por ejercicio y contexto
  let suben = 0,
    igual = 0,
    bajan = 0
  for (const arr of Object.values(porContexto(registros))) {
    const t = tendenciaE1(arr, fecha)
    if (t) t.estado === 'sube' ? suben++ : t.estado === 'baja' ? bajan++ : igual++
  }
  const M = marcarPorContexto(registros),
    n = suben + igual + bajan
  const fuerza = {
    comparables: n,
    suben,
    igual,
    bajan,
    records: registros.filter(r => en(r.fecha, d0, fecha) && M[r.id]?.flags.some(f => f === 'carga' || f === '1RM est.')).length,
    ...tono(n ? suben - bajan : null)
  }
  // Resistencia: repeticiones de patrón Cardio + tests de resistencia
  const cardio = (a, b) =>
    registros
      .filter(r => en(r.fecha, a, b) && patron(r.nombre, r.tipo, manual[r.clave]) === 'Cardio')
      .reduce((s, r) => s + repsTot(r), 0)
  const rAct = cardio(d0, fecha),
    rAnt = cardio(p0, p1),
    dp = pct(rAct, rAnt),
    tr = estadoTests(tests, fecha).filter(t => t.pilar === 'resistencia' && t.mejoro !== null)
  const senal = (dp !== null && Math.abs(dp) >= 5 ? Math.sign(dp) : 0) + tr.reduce((s, t) => s + (t.mejoro ? 1 : -1), 0)
  const resistencia = {
    repsCardio: rAct,
    repsCardioAnt: rAnt,
    deltaPct: dp,
    sesionesPorSemana: r1(sesiones.filter(s => en(s.fecha, d0, fecha)).length / 4),
    testsMejoraron: tr.filter(t => t.mejoro).length,
    testsComparados: tr.length,
    ...tono(rAct + rAnt === 0 && !tr.length ? null : senal)
  }
  // Composición: el sentido bueno depende de tu objetivo, por eso no se juzga
  const tp = tendencia(medidas, fecha, 'peso')
  const composicion = {
    peso: tp,
    grasa: tendencia(medidas, fecha, 'grasa'),
    musculo: tendencia(medidas, fecha, 'musculo'),
    etiqueta: tp.delta !== null ? 'Con tendencia' : 'Sin datos suficientes',
    tono: ''
  }
  // Hábitos: constancia de los últimos 7 días
  const s7 = sumaDias(fecha, -6),
    h7 = habitos.filter(h => en(h.fecha, s7, fecha))
  const dd = {
    checkin: h7.filter(checkinHecho).length,
    sueno: h7.filter(h => num(h.sueno) > 0).length,
    agua: h7.filter(h => +h.agua >= metaAgua).length,
    comida: new Set(comidas.filter(c => en(c.fecha, s7, fecha)).map(c => c.fecha)).size,
    entrenos: new Set(sesiones.filter(s => en(s.fecha, s7, fecha)).map(s => s.fecha)).size
  }
  const suma = dd.checkin + dd.sueno + dd.agua + dd.comida,
    cumplimiento = Math.round((suma / 28) * 100)
  const habitosP = {
    ...dd,
    cumplimiento,
    ...(suma === 0
      ? {etiqueta: 'Sin datos suficientes', tono: ''}
      : cumplimiento >= 70
        ? {etiqueta: 'Constante', tono: 'up'}
        : cumplimiento >= 40
          ? {etiqueta: 'Irregular', tono: ''}
          : {etiqueta: 'Poca constancia', tono: 'down'})
  }
  return {fuerza, resistencia, composicion, habitos: habitosP}
}
