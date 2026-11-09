// GPX 1.1 (Entrega 27): exportar rutas y leer archivos GPX de otras apps. Lógica pura, sin DOM:
// se lee con expresiones regulares para poder probarla en Node y no depender de DOMParser.
//
// Privacidad: un GPX lleva coordenadas. Lo que se exporta es el trazo guardado (que ya tiene recortados
// los primeros y últimos metros si esa opción estaba activa). El archivo lo maneja la persona: MMV no lo envía.
import {
  RUTA_CFG,
  armarRuta,
  compactar,
  descompactar,
  distanciaRutaM,
  limitarPuntos,
  ritmoSegKm,
  totalPuntos
} from './rutas.js'

export const GPX_CFG = {
  puntosMax: 300000, // tope de puntos leídos de un archivo
  bytesMax: 10 * 1024 * 1024, // tope de tamaño que acepta la pantalla
  distMaxM: 1e6 // sanidad de los datos propios (1000 km)
}

const NS_MMV = 'https://mmv-bribay.pages.dev/gpx'
const NOMBRES = {
  caminata: 'Caminata',
  carrera: 'Carrera',
  bicicleta: 'Bicicleta',
  natacion: 'Natación',
  deporte: 'Deporte',
  otro: 'Actividad'
}

const escapar = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[c]
  )
const desescapar = s =>
  String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(+n, 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff))
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const dos = n => String(n).padStart(2, '0')
export const fechaLocal = ms => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

// ---------- Exportar ----------

export const nombreDeRuta = r => `${NOMBRES[r.tipo] || NOMBRES.otro} ${r.fecha}`

function trk(r) {
  const segs = descompactar(r.puntos, r.inicio)
  const attrs = [
    `inicio="${Math.round(r.inicio)}"`,
    `distM="${Math.round(r.distM)}"`,
    `seg="${Math.round(r.seg)}"`
  ]
  if (r.sube != null)
    attrs.push(`sube="${Math.round(r.sube)}"`, `baja="${Math.round(r.baja || 0)}"`)
  if (r.recortada) attrs.push('recortada="1"')
  if (r.parciales?.length) attrs.push(`parciales="${r.parciales.join(',')}"`)
  const pts = g =>
    g
      .map(p => {
        const hijos =
          (Number.isFinite(p.alt) ? `<ele>${p.alt}</ele>` : '') +
          (r.sinTiempo ? '' : `<time>${new Date(p.t).toISOString()}</time>`)
        const base = `<trkpt lat="${p.lat.toFixed(5)}" lon="${p.lon.toFixed(5)}"`
        return hijos ? `${base}>${hijos}</trkpt>` : `${base}/>`
      })
      .join('\n')
  return [
    '<trk>',
    `<name>${escapar(r.nombre || nombreDeRuta(r))}</name>`,
    `<type>${escapar(r.tipo || 'otro')}</type>`,
    `<extensions><mmv:ruta ${attrs.join(' ')}/></extensions>`,
    ...segs.map(g => `<trkseg>\n${pts(g)}\n</trkseg>`),
    '</trk>'
  ].join('\n')
}

// Un archivo GPX con una <trk> por ruta. Devuelve '' si no hay rutas.
export function rutasAGpx(lista = []) {
  const rutas = lista.filter(r => r && Array.isArray(r.puntos) && r.puntos.length)
  if (!rutas.length) return ''
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="MMV" xmlns="http://www.topografix.com/GPX/1/1" xmlns:mmv="${NS_MMV}">`,
    ...rutas.map(trk),
    '</gpx>'
  ].join('\n')
}

export const nombreArchivoGpx = (lista, hoyTxt) =>
  lista.length === 1 ? `mmv-ruta-${lista[0].fecha}.gpx` : `mmv-rutas-${hoyTxt}.gpx`

// ---------- Leer ----------

const nums = s => (s == null ? NaN : Number(String(s).trim()))
const atributo = (txt, nombre) => {
  const m = new RegExp(`\\b${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(txt)
  return m ? (m[1] ?? m[2]) : null
}
const hijo = (txt, tag) => {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(txt)
  return m ? desescapar(m[1]).trim() : null
}

function puntos(bloque, tag) {
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'gi')
  const out = []
  let m
  while ((m = re.exec(bloque))) {
    const lat = nums(atributo(m[1], 'lat')),
      lon = nums(atributo(m[1], 'lon'))
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180) || !Number.isFinite(lat + lon)) continue
    const p = {lat, lon}
    const interior = m[2] || ''
    const ele = nums(hijo(interior, 'ele'))
    if (Number.isFinite(ele) && Math.abs(ele) < 10000) p.alt = Math.round(ele)
    const t = Date.parse(hijo(interior, 'time') || '')
    if (Number.isFinite(t)) p.t = t
    out.push(p)
    if (out.length > GPX_CFG.puntosMax) break
  }
  return out
}

function extensionMmv(bloque) {
  const m = /<mmv:ruta\b([^>]*?)\/?>/i.exec(bloque)
  if (!m) return null
  const inicio = nums(atributo(m[1], 'inicio')),
    distM = nums(atributo(m[1], 'distM')),
    seg = nums(atributo(m[1], 'seg'))
  if (!(inicio > 0) || !(distM > 0 && distM <= GPX_CFG.distMaxM) || !(seg >= 0 && seg < 1e6))
    return null
  const sube = nums(atributo(m[1], 'sube')),
    baja = nums(atributo(m[1], 'baja'))
  const parciales = (atributo(m[1], 'parciales') || '')
    .split(',')
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0 && n < 1e5)
    .slice(0, 500)
  return {
    inicio,
    distM,
    seg,
    parciales,
    recortada: atributo(m[1], 'recortada') === '1',
    ...(Number.isFinite(sube) && sube >= 0
      ? {sube, baja: Number.isFinite(baja) && baja >= 0 ? baja : 0}
      : {})
  }
}

// Devuelve {pistas: [{nombre, tipo, segs, mmv}]} o {error}. No valida contra reglas de MMV: eso lo hace rutaDesdeGpx.
export function leerGpx(texto) {
  if (typeof texto !== 'string' || !/<gpx\b/i.test(texto))
    return {error: 'No parece un archivo GPX.'}
  const limpio = texto
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, s) => escapar(s))
  let total = 0
  const pistas = []
  const trks = [...limpio.matchAll(/<trk\b[^>]*>([\s\S]*?)<\/trk>/gi)].map(m => m[1])
  for (const b of trks) {
    const segs = [...b.matchAll(/<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi)]
      .map(m => puntos(m[1], 'trkpt'))
      .filter(g => g.length)
    total += totalPuntos(segs)
    const fuera = b.replace(/<trkseg\b[\s\S]*?<\/trkseg>/gi, '')
    if (segs.length)
      pistas.push({
        nombre: hijo(fuera, 'name'),
        tipo: hijo(fuera, 'type'),
        segs,
        mmv: extensionMmv(fuera)
      })
    if (total > GPX_CFG.puntosMax) return {error: 'El archivo tiene demasiados puntos.'}
  }
  if (!pistas.length)
    for (const m of limpio.matchAll(/<rte\b[^>]*>([\s\S]*?)<\/rte>/gi)) {
      const g = puntos(m[1], 'rtept')
      total += g.length
      if (g.length)
        pistas.push({
          nombre: hijo(m[1].replace(/<rtept\b[\s\S]*?(?:<\/rtept>|\/>)/gi, ''), 'name'),
          tipo: null,
          segs: [g],
          mmv: null
        })
      if (total > GPX_CFG.puntosMax) return {error: 'El archivo tiene demasiados puntos.'}
    }
  if (!pistas.length)
    return {error: 'El archivo no tiene recorridos con puntos (solo se leen trazos y rutas).'}
  return {pistas}
}

export function tipoDeGpx(txt) {
  const s = String(txt || '').toLowerCase()
  if (/run|carrera|jog|correr/.test(s)) return 'carrera'
  if (/cycl|bik|ride|bici|ciclis/.test(s)) return 'bicicleta'
  if (/walk|hik|camin|trek|senderis/.test(s)) return 'caminata'
  if (/swim|nata/.test(s)) return 'natacion'
  return null
}

const puntoValido = p => p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180

// Una pista leída → fila para la tabla `rutas`, o null si no alcanza (menos de 100 m o sin puntos).
// Sin horarios: se guarda con la fecha de hoy, sin ritmo ni parciales (`sinTiempo`).
// Pista exportada por MMV (lleva la extensión mmv:ruta): se respetan sus estadísticas completas y
// NO se vuelve a recortar, para que exportar e importar no la achique cada vez.
export function rutaDesdeGpx(pista, {ocultarM = RUTA_CFG.ocultarM, ahora = Date.now()} = {}) {
  const segs = (pista?.segs || []).map(g => g.filter(puntoValido)).filter(g => g.length)
  if (totalPuntos(segs) < 2) return null
  const todos = segs.flat()
  const conTiempo = todos.every(p => Number.isFinite(p.t)) && todos.at(-1).t > todos[0].t
  const propia = pista.mmv || null
  const inicio = propia?.inicio ?? (conTiempo ? todos[0].t : ahora)
  const con = conTiempo ? segs : segs.map(g => g.map(p => ({...p, t: inicio})))
  const fecha = fechaLocal(inicio)
  const tipo = tipoDeGpx(pista.tipo) || tipoDeGpx(pista.nombre)
  const marcas = {
    origen: 'gpx',
    ...(pista.nombre ? {nombre: pista.nombre.slice(0, 80)} : {}),
    ...(conTiempo || propia?.seg > 0 ? {} : {sinTiempo: true})
  }
  if (propia) {
    const lim = limitarPuntos(con).segs
    return {
      fecha,
      inicio,
      tipo: tipo ?? 'caminata',
      distM: Math.round(propia.distM),
      seg: Math.round(propia.seg),
      ritmo: ritmoSegKm(propia.distM, propia.seg),
      parciales: propia.parciales,
      ...(propia.sube != null ? {sube: propia.sube, baja: propia.baja} : {}),
      recortada: propia.recortada,
      puntos: compactar(lim, inicio),
      nPuntos: totalPuntos(lim),
      ...marcas
    }
  }
  const seg = conTiempo ? Math.round((todos.at(-1).t - todos[0].t) / 1000) : 0
  const fila = armarRuta({
    fecha,
    distM: distanciaRutaM(con),
    seg,
    segs: con,
    ocultarM,
    exigirTiempo: false
  })
  if (!fila) return null
  return {...fila, ...(tipo ? {tipo} : {}), ...marcas}
}

// Todas las pistas de un texto → {filas, invalidas} o {error}.
export function filasDeGpx(texto, opciones) {
  const r = leerGpx(texto)
  if (r.error) return {error: r.error}
  const filas = []
  let invalidas = 0
  for (const p of r.pistas) {
    const f = rutaDesdeGpx(p, opciones)
    if (f) filas.push(f)
    else invalidas++
  }
  if (!filas.length) return {error: 'Ningún recorrido llega a 100 m: no se importó nada.'}
  return {filas, invalidas}
}

// Misma salida (mismo inicio y casi la misma distancia) o, sin horario, misma fecha y distancia exacta.
export const esRutaRepetida = (f, existentes) =>
  existentes.some(e =>
    f.sinTiempo
      ? e.sinTiempo && e.fecha === f.fecha && e.distM === f.distM
      : e.fecha === f.fecha &&
        Math.abs((e.inicio || 0) - f.inicio) <= 60000 &&
        Math.abs((e.distM || 0) - f.distM) <= Math.max(30, f.distM * 0.01)
  )

// Separa las filas nuevas de las que ya estaban (también las repetidas dentro del mismo archivo).
export function sinRepetidas(filas, existentes = []) {
  const vistas = [...existentes]
  const nuevas = []
  let repetidas = 0
  for (const f of filas) {
    if (esRutaRepetida(f, vistas)) repetidas++
    else {
      nuevas.push(f)
      vistas.push(f)
    }
  }
  return {nuevas, repetidas}
}
