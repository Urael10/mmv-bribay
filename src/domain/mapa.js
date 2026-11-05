// Mapa OSM opcional (Entrega 27): matemática de teselas ("slippy map"), sin red, sin librerías y sin DOM.
// Solo calcula qué teselas cubren un trazo y dónde dibujarlo; el componente visual hace el resto.
//
// Privacidad: pedir una tesela le dice al servidor de OpenStreetMap qué zona estás mirando. Por eso el
// mapa es opcional (apagado por defecto, se activa en Ajustes) y solo se pide al tocar «Ver sobre el
// mapa». Esta es la ÚNICA ubicación del código que conoce la dirección del servidor de teselas.
import {descompactar} from './rutas.js'

export const MAPA_CFG = {
  tile: 256, // px por tesela
  zMin: 3,
  zMax: 17,
  margen: 24, // px libres alrededor del trazo
  teselasMax: 16 // tope de pedidos por vista
}

export const CLAVE_MAPA = 'mapa_osm' // preferencia local (cfg): '1' = el mapa está permitido; apagado por defecto

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const ATRIBUCION = {texto: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright'}

const LAT_MAX = 85.0511287798 // límite de la proyección Web Mercator

const rad = g => (g * Math.PI) / 180
const clampLat = lat => Math.max(-LAT_MAX, Math.min(LAT_MAX, lat))

// Píxel del "mundo" (0 … 256·2^z) para una coordenada.
export function lonLatAPixel(lat, lon, z) {
  const tam = MAPA_CFG.tile * 2 ** z
  const s = Math.sin(rad(clampLat(lat)))
  return {
    x: ((lon + 180) / 360) * tam,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * tam
  }
}

// Inverso: píxel del mundo → coordenada.
export function pixelALonLat(x, y, z) {
  const tam = MAPA_CFG.tile * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / tam
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lon: (x / tam) * 360 - 180
  }
}

export const urlTesela = (z, x, y) => TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)

// Vista que encuadra todo el trazo en un recuadro ancho×alto (px lógicos).
// Devuelve {ancho, alto, z, teselas, paths, inicio, fin} o null si no hay puntos.
//  - teselas: [{x, y, z, url, left, top}] con left/top en px del recuadro (la tesela mide MAPA_CFG.tile).
//  - paths / inicio / fin: el trazo en px del mismo recuadro (mismo sistema que las teselas).
export function vistaMapa(segs, {ancho = 320, alto = 220, margen = MAPA_CFG.margen} = {}) {
  const todos = (segs || []).flat().filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
  if (!todos.length) return null
  const {tile, zMin, zMax, teselasMax} = MAPA_CFG

  // Caja del trazo en píxeles del nivel 0; escala por 2^z para cualquier nivel.
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity
  for (const p of todos) {
    const q = lonLatAPixel(p.lat, p.lon, 0)
    x0 = Math.min(x0, q.x)
    x1 = Math.max(x1, q.x)
    y0 = Math.min(y0, q.y)
    y1 = Math.max(y1, q.y)
  }
  const dispX = Math.max(1, ancho - 2 * margen),
    dispY = Math.max(1, alto - 2 * margen)
  const spanX = x1 - x0,
    spanY = y1 - y0

  // Mayor zoom (entero) en el que el trazo entra en el recuadro útil y no se piden demasiadas teselas.
  let z = zMin
  for (let c = zMax; c >= zMin; c--) {
    const k = 2 ** c
    if (spanX * k <= dispX && spanY * k <= dispY) {
      z = c
      break
    }
  }
  const k = 2 ** z
  const cx = ((x0 + x1) / 2) * k,
    cy = ((y0 + y1) / 2) * k
  const izq = cx - ancho / 2,
    arr = cy - alto / 2
  const n = 2 ** z

  const tx0 = Math.floor(izq / tile),
    tx1 = Math.floor((izq + ancho - 1e-6) / tile)
  const ty0 = Math.max(0, Math.floor(arr / tile)),
    ty1 = Math.min(n - 1, Math.floor((arr + alto - 1e-6) / tile))
  const teselas = []
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      if (teselas.length >= teselasMax) break
      const xw = ((tx % n) + n) % n // el mapa da la vuelta al mundo
      teselas.push({
        x: xw,
        y: ty,
        z,
        url: urlTesela(z, xw, ty),
        left: Math.round((tx * tile - izq) * 100) / 100,
        top: Math.round((ty * tile - arr) * 100) / 100
      })
    }

  const r1 = v => Math.round(v * 10) / 10
  const xy = p => {
    const q = lonLatAPixel(p.lat, p.lon, z)
    return {x: r1(q.x - izq), y: r1(q.y - arr)}
  }
  const paths = segs
    .filter(g => g.length)
    .map(g => {
      const q = g.map(xy)
      return q.length === 1 ? `M${q[0].x} ${q[0].y}h0` : 'M' + q.map(c => `${c.x} ${c.y}`).join('L')
    })
  const ultimo = segs.filter(g => g.length).at(-1)
  return {
    ancho,
    alto,
    viewBox: `0 0 ${ancho} ${alto}`,
    z,
    teselas,
    paths,
    inicio: xy(todos[0]),
    fin: xy(ultimo[ultimo.length - 1])
  }
}

// Atajo para una fila de la tabla `rutas`.
export const vistaMapaDeRuta = (ruta, medidas) =>
  vistaMapa(descompactar(ruta?.puntos, ruta?.inicio), medidas)
