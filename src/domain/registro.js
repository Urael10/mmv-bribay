// Registro rápido de comidas: recientes y frecuentes, porciones y comidas guardadas.
// Funciones puras (sin React ni base de datos). Las cuentas siguen haciéndolas alimentos.js.
import {claveAl, itemDesde, gramos, totales} from './alimentos.js'
import {sumaDias} from './stats.js'

export const MULTIPLOS = [
  [0.5, '½'],
  [1, '1'],
  [1.5, '1½'],
  [2, '2']
]
// Gramos de «m veces tu porción», redondeados a 0,1 g.
export const gramosPorcion = (porcion, m) => Math.round((gramos(porcion) || 100) * m * 10) / 10
export const multiploActual = (g, porcion) => {
  const m = MULTIPLOS.find(([x]) => Math.abs(+g - gramosPorcion(porcion, x)) < 0.5)
  return m ? m[0] : null
}

const mediana = a => {
  const s = [...a].filter(x => x > 0).sort((x, y) => x - y)
  if (!s.length) return 0
  const m = s.length >> 1
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}
export const porcionHabitual = mediana

// Alimentos que más cargás, ordenados para el momento del día. Puntaje = veces + 2 × veces en ese mismo momento
// + 1 si lo comiste en la última semana. `desde` limita la historia (por defecto, 90 días).
export function sugeridos(comidas, momento, {hoy, n = 8, dias = 90} = {}) {
  const desde = hoy ? sumaDias(hoy, -dias) : '',
    reciente = hoy ? sumaDias(hoy, -7) : '9999'
  const orden = [...comidas]
    .filter(c => !desde || c.fecha >= desde)
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
  const m = new Map()
  for (const c of orden)
    for (const it of c.items || []) {
      const nombre = String(it.nombre || '').trim(),
        cl = claveAl(nombre)
      if (!cl) continue
      const k = it.alimentoId != null ? 'a' + it.alimentoId : 'n' + cl
      const o = m.get(k) || {
        k,
        alimentoId: it.alimentoId ?? null,
        veces: 0,
        delMomento: 0,
        gs: [],
        ult: '',
        item: null,
        reciente: false
      }
      o.veces++
      o.gs.push(+it.g || 0)
      if (c.momento === momento) o.delMomento++
      if (c.fecha >= reciente) o.reciente = true
      o.ult = c.fecha + (c.hora || '')
      o.item = it
      m.set(k, o) // al estar ordenado, queda el último
    }
  return [...m.values()]
    .map(o => ({
      ...o,
      nombre: o.item.nombre,
      g: mediana(o.gs) || o.item.g || 100,
      puntaje: o.veces + 2 * o.delMomento + (o.reciente ? 1 : 0)
    }))
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        b.ult.localeCompare(a.ult) ||
        a.nombre.localeCompare(b.nombre, 'es')
    )
    .slice(0, n)
}
// Un sugerido pasa a ser un ítem del borrador. Si el alimento sigue en tu base se usan sus valores actuales.
export function itemDeSugerido(s, base) {
  const al = s.alimentoId != null ? base.find(a => a.id === s.alimentoId) : null
  if (al) return conPorcion(itemDesde(al, s.g, 'base'), al.porcion || s.g)
  return conPorcion(itemDesde({nombre: s.nombre, ...s.item.b}, s.g, s.item.origen || 'manual'), s.g)
}
// Cada ítem del borrador recuerda su «porción» (la base de los botones ½ · 1 · 1½ · 2).
export const conPorcion = (it, porcion) => ({...it, porcion: gramos(porcion) || it.g || 100})
export const porcionDe = (it, base) =>
  it.porcion ?? base.find(a => a.id === it.alimentoId)?.porcion ?? (it.g || 100)

// ---- comidas guardadas («mi desayuno de siempre») ----
export function plantillaDesdeItems(nombre, momento, items) {
  const n = String(nombre || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  const its = (items || [])
    .filter(i => i.nombre && +i.g > 0)
    .map(i => ({
      alimentoId: i.alimentoId ?? null,
      nombre: String(i.nombre).trim(),
      g: gramos(i.g),
      b: {kcal100: i.b?.kcal100, p100: i.b?.p100, c100: i.b?.c100, g100: i.b?.g100},
      origen: i.origen || 'manual'
    }))
  if (!n) throw new Error('Poné un nombre para la comida guardada.')
  if (!its.length) throw new Error('La comida no tiene alimentos con gramos.')
  return {nombre: n, clave: claveAl(n), momento, items: its, creado: new Date().toISOString()}
}
// Ítems de una comida guardada, con los valores ACTUALES de tu base si el alimento sigue existiendo.
export function itemsDePlantilla(pl, base) {
  return (pl.items || []).map(i => {
    const al = i.alimentoId != null ? base.find(a => a.id === i.alimentoId) : null
    return al
      ? conPorcion(itemDesde(al, i.g, 'base'), al.porcion || i.g)
      : conPorcion(itemDesde({nombre: i.nombre, ...i.b}, i.g, i.origen || 'manual'), i.g)
  })
}

// ---- Modo rápido (entrega 10): «comí algo parecido a…» y estimación sin alimentos ----
// Identifica una comida por sus alimentos (no por los gramos): dos desayunos con los mismos alimentos son «la misma comida».
export const firmaComida = c =>
  (c?.items || [])
    .map(i => (i.alimentoId != null ? 'a' + i.alimentoId : 'n' + claveAl(i.nombre || '')))
    .filter(k => k.length > 1)
    .sort()
    .join('|')

// Comidas completas que más repetís, ordenadas para el momento del día (veces + 2 × veces en ese momento + 1 si fue esta semana).
// Devuelve la ocurrencia más reciente de cada una, con su nombre corto y sus totales.
export function comidasParecidas(comidas, momento, {hoy, n = 5, dias = 90} = {}) {
  const desde = hoy ? sumaDias(hoy, -dias) : '',
    reciente = hoy ? sumaDias(hoy, -7) : '9999'
  const orden = [...(comidas || [])]
    .filter(c => (!desde || c.fecha >= desde) && firmaComida(c))
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
  const m = new Map()
  for (const c of orden) {
    const k = firmaComida(c),
      o = m.get(k) || {k, veces: 0, delMomento: 0, reciente: false}
    o.veces++
    if (c.momento === momento) o.delMomento++
    if (c.fecha >= reciente) o.reciente = true
    o.comida = c // al estar ordenado, queda la última
    m.set(k, o)
  }
  return [...m.values()]
    .map(o => {
      const nombres = o.comida.items.map(i => String(i.nombre || '').trim()).filter(Boolean),
        t = totales(o.comida.items)
      return {
        k: o.k,
        comida: o.comida,
        veces: o.veces,
        nombre: nombres.slice(0, 2).join(' + ') + (nombres.length > 2 ? ` +${nombres.length - 2}` : ''),
        kcal: t.kcal,
        p: t.p,
        puntaje: o.veces + 2 * o.delMomento + (o.reciente ? 1 : 0)
      }
    })
    .sort((a, b) => b.puntaje - a.puntaje || b.comida.fecha.localeCompare(a.comida.fecha))
    .slice(0, n)
}
// Ítems de una comida anterior para el borrador (con los valores ACTUALES de tu base si el alimento sigue existiendo).
export const itemsDeComida = (c, base) => itemsDePlantilla({items: c?.items}, base)

const numero = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
// Estimación rápida: solo calorías y proteína (opcional). Se guarda como un ítem de 100 g con esos valores.
export function itemRapido({nombre, kcal, p} = {}) {
  const k = numero(kcal),
    pr = p === '' || p === undefined || p === null ? 0 : numero(p)
  if (!(k > 0) || k > 5000) throw new Error('Poné las calorías estimadas (entre 1 y 5000).')
  if (pr === null || pr < 0 || pr > 300) throw new Error('La proteína tiene que estar entre 0 y 300 g.')
  const n = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Estimado rápido'
  return conPorcion(
    itemDesde({nombre: n, kcal100: k, p100: pr, c100: 0, g100: 0}, 100, 'manual', {estimado: true}),
    100
  )
}

// Lo que falta para la meta de proteína (null sin meta).
export function faltaProteina(p, meta) {
  const m = numero(meta)
  if (!(m > 0)) return null
  const v = numero(p) || 0
  return {falta: Math.max(0, Math.round(m - v)), pct: Math.min(100, Math.round((v / m) * 100)), cumplida: v >= m}
}
