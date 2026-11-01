// Lógica pura de alimentos y comidas: sin React ni base de datos, así se prueba con `npm test`.
// Regla de oro: las cuentas (kcal, macros, totales) las hace SIEMPRE este código, nunca la IA.
export const MOMENTOS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack']
export const momentoPorHora = h =>
  h < 4 ? 'Snack' : h < 11 ? 'Desayuno' : h < 16 ? 'Almuerzo' : h < 19 ? 'Merienda' : 'Cena'

// ---- números ----
export const n0 = x => {
  x = +x
  return Number.isFinite(x) && x > 0 ? x : 0
} // número ≥ 0 (lo inválido pasa a 0)
export const gramos = x => Math.min(5000, n0(x))
const r1 = n => Math.round(n * 10) / 10
export const fmt = n => String(+(+n || 0).toFixed(1)).replace('.', ',')

// ---- nombres y búsqueda ----
const VACIAS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'con',
  'y',
  'al',
  'a',
  'en',
  'sin',
  'un',
  'una'
])
export const norm = s =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const claveAl = norm
const raiz = w => {
  if (w.length > 3) w = w.replace(/(es|s)$/, '')
  if (w.length > 4) w = w.replace(/[aoe]$/, '')
  return w
} // papas→papa, tomates→tomat, fritas→frit
const tokens = s =>
  norm(s)
    .split(' ')
    .filter(w => w && !VACIAS.has(w))
    .map(raiz)

// 0 a 1: cuánto del texto buscado está en el nombre del alimento (70%) y viceversa (30%).
export function puntaje(consulta, nombre) {
  const q = tokens(consulta),
    f = tokens(nombre)
  if (!q.length || !f.length) return 0
  const fs = new Set(f),
    qs = new Set(q)
  return (
    (0.7 * q.filter(t => fs.has(t)).length) / q.length +
    (0.3 * f.filter(t => qs.has(t)).length) / f.length
  )
}
// Alimento de la base que corresponde a un nombre leído por la IA (o null si no hay uno claramente igual).
// Ante empate gana el que empieza con la misma palabra ("huevo" → "Huevo entero", no "Clara de huevo") y luego el de nombre más corto.
export function emparejar(base, nombre, umbral = 0.75) {
  const h = tokens(nombre)[0]
  let mejor = null,
    mr = 0,
    mt = 99
  for (const a of base) {
    const ft = tokens(a.nombre),
      raw = puntaje(nombre, a.nombre),
      r = raw + (ft[0] === h ? 0.1 : 0)
    if (raw >= umbral && (r > mr + 1e-9 || (Math.abs(r - mr) < 1e-9 && ft.length < mt))) {
      mejor = a
      mr = r
      mt = ft.length
    }
  }
  return mejor
}
// Buscador del usuario: acepta texto parcial ("pech" encuentra "Pechuga de pollo").
export function buscar(base, texto, n = 8) {
  const q = norm(texto)
  if (!q) return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, n)
  const qw = q.split(' ')
  return base
    .map(a => {
      const nf = norm(a.nombre),
        fw = nf.split(' ')
      let s = puntaje(texto, a.nombre)
      if (qw.every(w => fw.some(x => x.startsWith(w))))
        s = Math.max(s, 0.5 + (nf.startsWith(q) ? 0.2 : 0))
      return {a, s}
    })
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s || x.a.nombre.localeCompare(y.a.nombre, 'es'))
    .slice(0, n)
    .map(x => x.a)
}

// ---- cálculo ----
const per100 = b => ({
  kcal100: n0(b?.kcal100),
  p100: n0(b?.p100),
  c100: n0(b?.c100),
  g100: n0(b?.g100)
})
export const porGramos = (b, g) => {
  b = per100(b)
  g = gramos(g)
  return {
    kcal: Math.round((b.kcal100 * g) / 100),
    p: r1((b.p100 * g) / 100),
    c: r1((b.c100 * g) / 100),
    gr: r1((b.g100 * g) / 100)
  }
}
export function itemDesde(al, g, origen = 'base', extra = {}) {
  const b = per100(al)
  return {
    alimentoId: al.id ?? null,
    nombre: al.nombre,
    g: gramos(g),
    b,
    ...porGramos(b, g),
    origen,
    ...extra
  }
}
// Cambia los gramos (acepta lo que el usuario está tipeando) y recalcula.
export const recalcular = (it, g) => ({...it, g, ...porGramos(it.b, g)})
// Versión final para guardar en la base: números limpios y sin campos temporales.
export function cerrar(it) {
  const b = per100(it.b),
    g = gramos(it.g)
  return {
    alimentoId: it.alimentoId ?? null,
    nombre: String(it.nombre || '').trim(),
    g,
    b,
    ...porGramos(b, g),
    origen: it.origen || 'manual'
  }
}
export function totales(items) {
  const t = (items || []).reduce(
    (a, i) => ({
      kcal: a.kcal + (+i.kcal || 0),
      p: a.p + (+i.p || 0),
      c: a.c + (+i.c || 0),
      gr: a.gr + (+i.gr || 0)
    }),
    {kcal: 0, p: 0, c: 0, gr: 0}
  )
  return {kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), gr: r1(t.gr)}
}
// ¿Las calorías cuadran con los macros (4·P + 4·C + 9·G)? Sirve para detectar valores mal leídos o mal cargados.
export function coherente(b) {
  b = per100(b)
  const e = 4 * b.p100 + 4 * b.c100 + 9 * b.g100
  if (b.kcal100 < 30 && e < 30) return true
  return Math.abs(e - b.kcal100) <= Math.max(30, 0.3 * b.kcal100)
}
export function validarAlimento(a) {
  if (!String(a?.nombre ?? '').trim()) return 'Poné un nombre.'
  for (const k of ['kcal100', 'p100', 'c100', 'g100'])
    if (!Number.isFinite(+a[k]) || +a[k] < 0)
      return 'Los valores no pueden ser negativos ni estar vacíos.'
  if (+a.kcal100 > 900) return 'Más de 900 kcal cada 100 g no es posible. Revisá las calorías.'
  if (+a.p100 + +a.c100 + +a.g100 > 100.5)
    return 'Proteínas + carbohidratos + grasas no pueden superar 100 g cada 100 g.'
  return ''
}

// ---- lo que devuelve la IA ----
const conf = c => (['alta', 'media', 'baja'].includes(c) ? c : 'media')
// Foto de plato → ítems. Si el alimento está en la base se usan SUS valores; si no, los estimados por la IA.
export function itemsDesdeEscaneo(r, base) {
  const out = []
  for (const a of (Array.isArray(r?.alimentos) ? r.alimentos : []).slice(0, 20)) {
    const nombre = String(a?.nombre ?? '')
        .trim()
        .slice(0, 80),
      g = gramos(a?.gramos)
    if (!nombre || g <= 0) continue
    const m = emparejar(base, nombre)
    if (m) {
      out.push(itemDesde(m, g, 'base', {confianza: conf(a.confianza), leido: nombre}))
      continue
    }
    const p = n0(a.p100),
      c = n0(a.c100),
      gr = n0(a.g100)
    out.push(
      itemDesde(
        {
          nombre,
          kcal100: n0(a.kcal100) || Math.round(4 * p + 4 * c + 9 * gr),
          p100: p,
          c100: c,
          g100: gr
        },
        g,
        'ia',
        {confianza: conf(a.confianza), leido: nombre}
      )
    )
  }
  return out
}
// Foto de etiqueta nutricional → alimento por 100 g.
export function alimentoDesdeEtiqueta(r) {
  const base = n0(r?.base_g)
  if (!base) throw new Error('No pude ver a cuántos gramos se refieren los valores de la etiqueta.')
  const f = 100 / base,
    kcal = n0(r.kcal) * f
  if (!(kcal > 0)) throw new Error('No encontré las calorías en la etiqueta.')
  return {
    nombre: String(r?.nombre ?? '')
      .trim()
      .slice(0, 80),
    kcal100: Math.round(kcal),
    p100: r1(n0(r.p) * f),
    c100: r1(n0(r.c) * f),
    g100: r1(n0(r.g) * f),
    porcion: Math.round(n0(r.porcion_g)) || 100,
    origen: 'etiqueta'
  }
}
