// Cliente de Open Food Facts (OFF): búsqueda por nombre y por código de barras.
// Lógica sin React: el `fetch` y el reloj se pueden inyectar, así se prueba con `npm test` sin red.
// Reglas de oro: (1) el alimento se COPIA a tu base con su fuente anotada; (2) las cuentas las hace la app;
// (3) OFF es colaborativo y puede tener errores: se descartan datos imposibles y se avisa de los dudosos.
// Condiciones de uso (https://support.openfoodfacts.org): datos bajo ODbL → hay que atribuir la fuente.
import {claveAl, validarAlimento, coherente} from '../domain/alimentos.js'

export const FUENTE = 'Open Food Facts'
export const ATRIBUCION =
  'Datos de Open Food Facts (openfoodfacts.org), licencia ODbL. Los aporta la comunidad y pueden tener errores: revisalos.'
const BASE = 'https://world.openfoodfacts.org',
  ALT = 'https://search.openfoodfacts.org'
const CAMPOS =
  'code,product_name,product_name_es,generic_name,brands,quantity,serving_quantity,nutriments'
// OFF permite 10 búsquedas y 15 lecturas por minuto por IP: nos quedamos por debajo.
export const LIMITES = {busqueda: 8, lectura: 12, ventanaMs: 60000}
export const TIMEOUT_MS = 12000

// ---- límite de uso (compartido por toda la app mientras esté abierta) ----
const usos = {busqueda: [], lectura: []}
export function reiniciarLimites() {
  usos.busqueda.length = 0
  usos.lectura.length = 0
}
function cupo(tipo, ahora) {
  const a = usos[tipo],
    lim = LIMITES[tipo]
  while (a.length && ahora - a[0] >= LIMITES.ventanaMs) a.shift()
  if (a.length >= lim) {
    const s = Math.ceil((LIMITES.ventanaMs - (ahora - a[0])) / 1000)
    throw new ErrorOFF(
      'limite',
      `Open Food Facts permite pocas consultas por minuto. Probá de nuevo en ${s} s.`
    )
  }
  a.push(ahora)
}
export class ErrorOFF extends Error {
  constructor(tipo, msg, detalle) {
    super(detalle ? `${msg} (Detalle: ${detalle})` : msg)
    this.tipo = tipo
    this.base = msg
    this.detalle = detalle
  }
}
const host = u => {
  try {
    const x = new URL(u)
    return x.host + x.pathname
  } catch {
    return String(u)
  }
}

// ---- código de barras ----
export const soloDigitos = s => String(s ?? '').replace(/[\s-]/g, '')
export const esCodigo = s => /^\d{8,14}$/.test(soloDigitos(s))
// GTIN (EAN-8/UPC-A/EAN-13/GTIN-14): el último dígito es de control (módulo 10).
export function gtinValido(s) {
  const c = soloDigitos(s)
  if (![8, 12, 13, 14].includes(c.length) || !/^\d+$/.test(c)) return false
  const d = [...c].map(Number),
    ctl = d.pop()
  const suma = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (suma % 10)) % 10 === ctl
}

// ---- conversión de un producto de OFF a un alimento de tu base (valores por 100 g) ----
const N = v => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
const r1 = n => Math.round(n * 10) / 10
export function alimentoDesdeOFF(p) {
  const nu = p?.nutriments || {}
  const code = soloDigitos(p?.code)
  let nombre = String(p?.product_name || p?.product_name_es || p?.generic_name || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!nombre) return {ok: false, motivo: 'sin nombre'}
  const marca = String(p?.brands || '')
    .split(',')[0]
    .trim()
  if (marca && !nombre.toLowerCase().includes(marca.toLowerCase())) nombre += ` (${marca})`
  nombre = nombre.slice(0, 80)
  const pr = N(nu.proteins_100g),
    ca = N(nu.carbohydrates_100g),
    gr = N(nu.fat_100g),
    avisos = []
  let kcal = N(nu['energy-kcal_100g'])
  if (kcal === null) {
    const kj = N(nu['energy-kj_100g'] ?? nu.energy_100g)
    if (kj !== null) kcal = kj / 4.184
  } // energy_100g viene en kJ
  if (kcal === null && (pr !== null || ca !== null || gr !== null)) {
    kcal = 4 * (pr || 0) + 4 * (ca || 0) + 9 * (gr || 0)
    avisos.push('Sin calorías en OFF: las calculé con los macros.')
  }
  if (kcal === null) return {ok: false, motivo: 'sin datos nutricionales'}
  if (pr === null && ca === null && gr === null)
    avisos.push('OFF no trae proteínas, carbohidratos ni grasas para este producto.')
  const sv = N(p?.serving_quantity)
  const alimento = {
    nombre,
    clave: claveAl(nombre),
    kcal100: Math.round(kcal),
    p100: r1(pr || 0),
    c100: r1(ca || 0),
    g100: r1(gr || 0),
    porcion: sv > 0 && sv <= 2000 ? Math.round(sv) : 100,
    origen: 'web',
    fuente: FUENTE,
    fuenteId: code || undefined
  }
  if (validarAlimento(alimento)) return {ok: false, motivo: 'datos imposibles'}
  if (!coherente(alimento))
    avisos.push('Las calorías no cuadran con los macros (4·P + 4·C + 9·G): revisá los valores.')
  return {ok: true, alimento, avisos}
}

// ---- llamadas ----
async function pedirJSON(url, {pedir, ahora, tipo, nulo404 = false}) {
  cupo(tipo, ahora())
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null,
    t = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null
  let r
  try {
    r = await pedir(url, ctl ? {signal: ctl.signal} : undefined)
  } catch (e) {
    // sin cabeceras propias: así el navegador no hace consulta previa (CORS)
    const demora = e?.name === 'AbortError'
    throw new ErrorOFF(
      'red',
      demora
        ? `Open Food Facts tardó más de ${TIMEOUT_MS / 1000} s en responder. Probá de nuevo o cargalo a mano.`
        : 'No pude conectar con Open Food Facts (¿sin conexión?, ¿el sitio no lo permite desde la app?). Podés cargar el alimento a mano.',
      `${host(url)}: ${demora ? 'sin respuesta a tiempo' : 'fallo de red/CORS (' + (e?.name || 'Error') + ')'}`
    )
  } finally {
    if (t) clearTimeout(t)
  }
  if (nulo404 && r.status === 404) return null // para un código de barras, OFF responde 404 cuando el producto no existe
  if ([429, 503].includes(r.status))
    throw new ErrorOFF(
      'limite',
      'Open Food Facts está limitando las consultas o está ocupado. Probá de nuevo en un rato.',
      `${host(url)}: HTTP ${r.status}`
    )
  if (!r.ok)
    throw new ErrorOFF(
      'http',
      `Open Food Facts respondió con error (${r.status}). Probá más tarde.`,
      `${host(url)}: HTTP ${r.status}`
    )
  try {
    return await r.json()
  } catch {
    throw new ErrorOFF(
      'http',
      'Open Food Facts devolvió una respuesta que no pude leer.',
      `${host(url)}: respuesta no es JSON`
    )
  }
}
const q = o =>
  Object.entries(o)
    .map(([k, v]) => k + '=' + encodeURIComponent(v))
    .join('&')

// Búsqueda por nombre (solo cuando el usuario la pide; OFF no admite búsqueda mientras se escribe).
// Primero la búsqueda clásica; si la conexión o el servidor fallan, prueba la nueva (search-a-licious).
export async function buscarOFF(
  texto,
  {pedir = (...a) => fetch(...a), ahora = Date.now, max = 10} = {}
) {
  const t = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  if (t.length < 2) throw new ErrorOFF('texto', 'Escribí al menos 2 letras para buscar.')
  const urls = [
    `${BASE}/cgi/search.pl?` +
      q({
        search_terms: t,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 20,
        sort_by: 'unique_scans_n',
        lc: 'es',
        fields: CAMPOS
      }),
    `${ALT}/search?` + q({q: t, page_size: 20, langs: 'es', fields: CAMPOS})
  ]
  let j, fallo
  const detalles = []
  for (const u of urls) {
    try {
      j = await pedirJSON(u, {pedir, ahora, tipo: 'busqueda'})
      break
    } catch (e) {
      fallo = e
      if (e.tipo === 'limite') throw e
      if (e.detalle) detalles.push(e.detalle)
    }
  }
  if (!j)
    throw new ErrorOFF(fallo.tipo, fallo.base || fallo.message, detalles.join(' · ') || undefined) // se probaron las dos direcciones: el detalle dice cuál falló y por qué
  const lista = Array.isArray(j.products) ? j.products : Array.isArray(j.hits) ? j.hits : []
  const vistos = new Set(),
    items = []
  let descartados = 0
  for (const p of lista) {
    const r = alimentoDesdeOFF(p)
    if (!r.ok) {
      descartados++
      continue
    }
    const k = r.alimento.fuenteId || r.alimento.clave
    if (vistos.has(k)) continue
    vistos.add(k)
    items.push(r)
  }
  items.sort((a, b) => a.avisos.length - b.avisos.length) // primero los de datos completos y coherentes (el orden por popularidad se mantiene)
  return {items: items.slice(0, max), descartados, total: lista.length}
}

// Búsqueda por código de barras (tipeado).
export async function buscarCodigoOFF(
  codigo,
  {pedir = (...a) => fetch(...a), ahora = Date.now} = {}
) {
  const c = soloDigitos(codigo)
  if (!esCodigo(c)) throw new ErrorOFF('texto', 'El código tiene que tener entre 8 y 14 números.')
  if (!gtinValido(c))
    throw new ErrorOFF(
      'texto',
      'El código no parece válido (el último dígito no coincide). Revisá que esté bien tipeado.'
    )
  // OFF guarda UPC-A (12) como EAN-13 con un 0 adelante, pero hay fichas viejas con cualquiera de las dos formas:
  // se prueban las variantes (la normalizada primero) y, si ninguna aparece, la API anterior (v0).
  const cc = c.length === 12 ? '0' + c : c
  const vars = [...new Set([cc, c, ...(cc.length === 13 && cc[0] === '0' ? [cc.slice(1)] : [])])]
  const hallado = j => j && j.status !== 0 && j.product
  let j = null
  for (const v of vars) {
    const x = await pedirJSON(`${BASE}/api/v2/product/${v}.json?` + q({fields: CAMPOS}), {
      pedir,
      ahora,
      tipo: 'lectura',
      nulo404: true
    })
    if (hallado(x)) {
      j = x
      break
    }
  }
  if (!j) {
    const x = await pedirJSON(`${BASE}/api/v0/product/${cc}.json?` + q({fields: CAMPOS}), {
      pedir,
      ahora,
      tipo: 'lectura',
      nulo404: true
    })
    if (hallado(x)) {
      j = x
    }
  }
  if (!j)
    throw new ErrorOFF(
      'no',
      'No encontré ese código en Open Food Facts. Podés cargarlo a mano (se guarda el código para escanearlo la próxima vez) o con la foto de la etiqueta.',
      `probé ${vars.join(', ')}`
    )
  const r = alimentoDesdeOFF({...j.product, code: cc}) // se guarda siempre el código normalizado: así el próximo escaneo lo encuentra en tu base
  if (!r.ok)
    throw new ErrorOFF(
      'no',
      `Encontré el producto, pero no sirve: ${r.motivo}. Cargalo con la foto de la etiqueta o a mano.`
    )
  return r
}
