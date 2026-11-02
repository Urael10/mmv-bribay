// Estadísticas de MMV (funciones puras, sin acceso a la base)
export const PATRONES = [
  'Empuje',
  'Tirón',
  'Rodilla',
  'Cadera',
  'Core',
  'Cardio',
  'Movilidad',
  'Otro'
]

const sin = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Reglas por palabra clave. El orden importa: la primera que coincide gana.
const REGLAS = [
  [
    'Cardio',
    /\b(assault|bici|bike|ergo\w*|ski|soga|cuerda|salto\w*|burpee\w*|jumping|trote|correr|carrera|double ?under|remo (en )?(maquina|ergo\w*|c2))\b/
  ],
  [
    'Core',
    /(plancha|plank|\bcore\b|abdom\w*|hollow|dead ?bug|v-?up|russian|pallof|crunch|toes? to bar|\bttb\b|sit-?up|leg raise|elevacion(es)? de piernas)/
  ],
  ['Movilidad', /(movilidad|estir\w*|stretch|cat ?cow|\bgato\b|90\/90|foam|rodillo)/],
  [
    'Cadera',
    /(leg ?curl|curl (femoral|de piernas)|peso muerto|deadlift|\bdl\b|\brdl\b|hip ?thrust|puente|glute|gluteo\w*|swing|buen\w* dias|good ?morning|isquio\w*|femoral|hiperextension\w*|clean|snatch|arranque|cargada)/
  ],
  [
    'Rodilla',
    /(sentadilla|squat|\bsq\b|goblet|zancada|estocada|lunge|step ?-?up|bulgara|prensa|wall ?ball|thruster|cuadriceps|pistol|box jump)/
  ],
  [
    'Tirón',
    /(remo|\brow\b|dominada|pull ?-?up|\bchin\b|jalon|dorsal|biceps|\bcurl\b|face ?pull|colgad\w*)/
  ],
  [
    'Empuje',
    /(lagartija|flexion(es)? de brazos|push ?-?up|press|banca|bench|fondos?|\bdip\b|triceps|hombro|jerk|handstand|\bpino\b|vuelos|elevacion(es)? (lat\w*|frontal\w*))/
  ]
]

// Patrón de un ejercicio: 1) el que el usuario fijó a mano, 2) bloque de movilidad, 3) palabras clave.
export function patron(nombre, tipo, manual) {
  if (manual && PATRONES.includes(manual)) return manual
  if (tipo === 'movilidad') return 'Movilidad'
  const n = sin(nombre)
  for (const [p, re] of REGLAS) if (re.test(n)) return p
  return 'Otro'
}

// Repeticiones: en MMV se anotan como resumen por ejercicio (total del bloque).
export const repsTot = r => (r.uni ? (+r.repsL || 0) + (+r.repsR || 0) : +r.reps || 0)
export const repsLado = r =>
  r.uni ? Math.round(((+r.repsL || 0) + (+r.repsR || 0)) / 2) : +r.reps || 0
export const volumen = r => (+r.kg || 0) * repsTot(r)

// Epley: 1RM ≈ kg × (1 + reps/30). Solo confiable con series cortas (≤12 reps).
export const EPLEY_MAX = 12
export const epley = (kg, reps) => {
  kg = +kg || 0
  reps = +reps || 0
  return kg > 0 && reps > 0 && reps <= EPLEY_MAX ? +(kg * (1 + reps / 30)).toFixed(1) : 0
}
// Serie pesada (entrega 9): si el registro trae la serie más cargada (pkg × preps), el 1RM estimado toma la mejor de las dos.
export const e1rm = r => Math.max(epley(r.kg, repsLado(r)), epley(r.pkg, r.preps))
// Carga más alta del registro (la del resumen o la de la serie pesada).
export const kgMax = r => Math.max(+r.kg || 0, +r.pkg || 0)

// Fechas (YYYY-MM-DD, hora local)
const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const sumaDias = (f, n) => {
  const d = new Date(f + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const lunes = f => {
  const d = new Date(f + 'T12:00:00')
  return sumaDias(f, -((d.getDay() + 6) % 7))
}

// Compara cada registro con los anteriores del mismo ejercicio.
// Devuelve {[id]: {ult, flags}}: ult = registro anterior, flags = récords superados.
export function marcar(registros) {
  const orden = [...registros].sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.id || 0) - (b.id || 0)
  )
  const mejor = new Map(),
    out = {}
  for (const r of orden) {
    const v = {
      kg: kgMax(r),
      e1: e1rm(r),
      vol: volumen(r),
      reps: (+r.kg || 0) > 0 ? 0 : repsTot(r)
    }
    const p = mejor.get(r.clave),
      flags = []
    if (p) {
      if (v.kg > p.kg) flags.push('carga')
      if (v.e1 > p.e1) flags.push('1RM est.')
      if (v.vol > p.vol && v.kg > 0) flags.push('volumen')
      if (v.reps > p.reps) flags.push('reps')
    }
    out[r.id] = {ult: p?.ult, flags}
    mejor.set(r.clave, {
      kg: Math.max(v.kg, p?.kg || 0),
      e1: Math.max(v.e1, p?.e1 || 0),
      vol: Math.max(v.vol, p?.vol || 0),
      reps: Math.max(v.reps, p?.reps || 0),
      ult: r
    })
  }
  return out
}

// Volumen de una semana (lunes a domingo) por patrón: {Patrón:{reps,ton}}
export function volumenSemana(registros, manual, desde) {
  const hasta = sumaDias(desde, 6),
    o = {}
  for (const r of registros) {
    if (r.fecha < desde || r.fecha > hasta) continue
    const p = patron(r.nombre, r.tipo, manual[r.clave]),
      a = o[p] || (o[p] = {reps: 0, ton: 0})
    a.reps += repsTot(r)
    a.ton += volumen(r)
  }
  return o
}

// Mejores marcas de una lista de registros de un mismo ejercicio (ya ordenados por fecha)
export function mejores(arr) {
  const top = fn =>
    arr.reduce((b, r) => {
      const v = fn(r)
      return v > (b?.v || 0) ? {v, r} : b
    }, null)
  return {
    carga: top(kgMax),
    e1: top(e1rm),
    vol: top(volumen),
    reps: top(r => ((+r.kg || 0) > 0 ? 0 : repsTot(r)))
  }
}

export const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null)
export const sg = n => (n > 0 ? '+' : '') + n

// Récords por contexto (D11): el mismo ejercicio hecho en otro tipo de bloque (EMOM, AMRAP, For time…) no se compara.
export const claveCtx = r => `${r.clave}|${r.tipo || ''}`
export const marcarPorContexto = registros => marcar(registros.map(r => ({...r, clave: claveCtx(r)})))
