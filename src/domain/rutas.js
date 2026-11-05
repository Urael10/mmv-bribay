// Lógica pura de rutas GPS (Entrega 26): arma el recorrido, lo simplifica, calcula ritmo, parciales y
// desnivel, lo proyecta a un trazo SVG y agrupa el historial. No toca el navegador ni la base.
//
// Privacidad: el recorrido (coordenadas) vive SOLO en el teléfono. Hacia la IA solo salen agregados:
// `resumenRutasParaIA` nunca devuelve coordenadas ni puntos (una prueba lo vigila).
import {distanciaM, sugerirActividad} from './actividad.js'

export const RUTA_CFG = {
  distMin: 100, // m: menos que esto no se guarda como ruta
  segMin: 60, // s: ídem (coincide con la actividad sugerida)
  puntosMax: 800, // tope de puntos que se guardan por ruta
  enCursoMax: 3000, // tope en memoria mientras se graba (si se pasa, se adelgaza)
  epsilonM: 4, // m: tolerancia base de la simplificación (Douglas-Peucker)
  ocultarM: 150, // m: tramo inicial y final que se oculta del trazo guardado
  desnivelUmbralM: 4, // m: variación mínima de altura para contarla (filtra el ruido del GPS)
  altPrecisionMax: 15 // m: peor precisión de altura aceptada
}

const RADIO_TIERRA_M = 6371008.8
const rad = g => (g * Math.PI) / 180

// ---------- Recorrido en curso ----------
// ruta = {segs: [[{lat, lon, t, alt?}, …], …]}. Cada tramo sin señal (hueco) abre un segmento nuevo,
// así el trazo no dibuja una línea recta a través del hueco.

export const rutaNueva = () => ({segs: []})

export const totalPuntos = segs => segs.reduce((s, g) => s + g.length, 0)

const puntoDeRuta = p => {
  const o = {lat: p.lat, lon: p.lon, t: p.t}
  if (
    Number.isFinite(p.alt) &&
    Number.isFinite(p.altPrecision) &&
    p.altPrecision > 0 &&
    p.altPrecision <= RUTA_CFG.altPrecisionMax
  )
    o.alt = Math.round(p.alt)
  return o
}

// Suma un punto ya procesado por procesarPuntoGps. `motivo` es el que devolvió esa función.
// Solo guardan punto: 'inicio', 'hueco' (abren segmento) y 'movimiento' (lo prolongan). No muta.
export function agregarPuntoRuta(ruta, p, motivo) {
  if (motivo !== 'inicio' && motivo !== 'hueco' && motivo !== 'movimiento') return ruta
  const pt = puntoDeRuta(p)
  const segs = ruta.segs
  let nuevas
  if (motivo === 'movimiento' && segs.length)
    nuevas = [...segs.slice(0, -1), [...segs[segs.length - 1], pt]]
  else nuevas = [...segs, [pt]]
  if (totalPuntos(nuevas) > RUTA_CFG.enCursoMax)
    nuevas = limitarPuntos(nuevas, Math.round(RUTA_CFG.enCursoMax / 2)).segs
  return {segs: nuevas}
}

// ---------- Geometría ----------

// Proyección local plana (metros) alrededor de un punto de referencia.
function proyectar(puntos, ref) {
  const k = Math.cos(rad(ref.lat)) * RADIO_TIERRA_M
  return puntos.map(p => ({x: rad(p.lon - ref.lon) * k, y: rad(p.lat - ref.lat) * RADIO_TIERRA_M}))
}

function distPuntoSegmento(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// Douglas-Peucker iterativo (sin recursión: una ruta larga no desborda la pila).
export function simplificar(puntos, epsilonM = RUTA_CFG.epsilonM) {
  const n = puntos.length
  if (n <= 2 || !(epsilonM > 0)) return puntos.slice()
  const xy = proyectar(puntos, puntos[0])
  const queda = new Uint8Array(n)
  queda[0] = queda[n - 1] = 1
  const pila = [[0, n - 1]]
  while (pila.length) {
    const [a, b] = pila.pop()
    let max = -1,
      idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = distPuntoSegmento(xy[i], xy[a], xy[b])
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > epsilonM) {
      queda[idx] = 1
      pila.push([a, idx], [idx, b])
    }
  }
  return puntos.filter((_, i) => queda[i])
}

// Simplifica cada segmento; si igual hay más de `max` puntos sube la tolerancia (y, como último
// recurso, toma puntos parejos). Devuelve {segs, epsilon}.
export function limitarPuntos(segs, max = RUTA_CFG.puntosMax) {
  let eps = RUTA_CFG.epsilonM
  let actual = segs.map(g => simplificar(g, eps))
  for (let i = 0; i < 8 && totalPuntos(actual) > max; i++) {
    eps *= 2
    actual = segs.map(g => simplificar(g, eps))
  }
  if (totalPuntos(actual) > max) {
    const paso = Math.ceil(totalPuntos(actual) / max)
    actual = actual.map(g => g.filter((_, i) => i % paso === 0 || i === g.length - 1))
  }
  return {segs: actual, epsilon: eps}
}

export function distanciaRutaM(segs) {
  let m = 0
  for (const g of segs) for (let i = 1; i < g.length; i++) m += distanciaM(g[i - 1], g[i])
  return m
}

// Oculta los primeros y últimos `metros` del recorrido (típicamente la casa). En una ruta corta
// recorta a lo sumo un cuarto de su largo por punta, para que siempre quede algo para mostrar.
export function recortarExtremos(segs, metros = RUTA_CFG.ocultarM) {
  const total = distanciaRutaM(segs)
  const m = Math.min(Math.max(0, +metros || 0), total / 4)
  if (!(m > 0) || !(total > 0)) return segs.map(g => g.slice())
  const desde = m,
    hasta = total - m
  let acum = 0
  const salida = []
  for (const g of segs) {
    const tramo = []
    for (let i = 0; i < g.length; i++) {
      if (i > 0) acum += distanciaM(g[i - 1], g[i])
      if (acum >= desde && acum <= hasta) tramo.push(g[i])
    }
    if (tramo.length) salida.push(tramo)
  }
  return salida
}

// ---------- Estadísticas ----------

// Segundos por km de cada kilómetro completo (el tiempo de los huecos sin señal no cuenta).
export function parciales(segs) {
  const out = []
  let d = 0,
    tm = 0,
    ultimo = 0,
    prox = 1000
  for (const g of segs) {
    for (let i = 1; i < g.length; i++) {
      const dd = distanciaM(g[i - 1], g[i])
      const dt = (g[i].t - g[i - 1].t) / 1000
      if (!(dd > 0) || !(dt > 0)) continue
      while (prox <= d + dd) {
        const f = (prox - d) / dd
        const tKm = tm + f * dt
        out.push(Math.round(tKm - ultimo))
        ultimo = tKm
        prox += 1000
      }
      d += dd
      tm += dt
    }
  }
  return out
}

// Desnivel acumulado con histéresis: una subida o bajada cuenta recién cuando supera el umbral.
// Devuelve {sube, baja} en metros enteros, o null si no hay alturas suficientes.
export function desnivel(segs, umbral = RUTA_CFG.desnivelUmbralM) {
  const alturas = segs.flatMap(g => g.filter(p => Number.isFinite(p.alt)).map(p => p.alt))
  if (alturas.length < 2) return null
  let ref = alturas[0],
    sube = 0,
    baja = 0
  for (const a of alturas) {
    if (a - ref >= umbral) {
      sube += a - ref
      ref = a
    } else if (ref - a >= umbral) {
      baja += ref - a
      ref = a
    }
  }
  return {sube: Math.round(sube), baja: Math.round(baja)}
}

// Segundos por km, o null si no hay datos suficientes.
export const ritmoSegKm = (distM, seg) =>
  distM >= 50 && seg > 0 ? Math.round(seg / (distM / 1000)) : null

export function formatoRitmo(segPorKm) {
  if (!Number.isFinite(segPorKm) || segPorKm <= 0) return '—'
  const m = Math.floor(segPorKm / 60),
    s = Math.round(segPorKm % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatoDuracion(seg) {
  if (!Number.isFinite(seg) || seg < 0) return '—'
  const t = Math.round(seg)
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60
  const dos = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`
}

// ---------- Guardado compacto ----------
// Punto → [lat×1e5, lon×1e5, segundos desde el inicio, altura?] (≈1 m de resolución).

export function compactar(segs, t0) {
  return segs.map(g =>
    g.map(p => {
      const a = [Math.round(p.lat * 1e5), Math.round(p.lon * 1e5), Math.round((p.t - t0) / 1000)]
      if (Number.isFinite(p.alt)) a.push(p.alt)
      return a
    })
  )
}

export function descompactar(c, t0) {
  if (!Array.isArray(c)) return []
  const segs = []
  for (const g of c) {
    if (!Array.isArray(g)) continue
    const tramo = []
    for (const a of g) {
      if (!Array.isArray(a) || a.length < 3 || !a.slice(0, 3).every(Number.isFinite)) continue
      const p = {lat: a[0] / 1e5, lon: a[1] / 1e5, t: t0 + a[2] * 1000}
      if (a.length > 3 && Number.isFinite(a[3])) p.alt = a[3]
      tramo.push(p)
    }
    if (tramo.length) segs.push(tramo)
  }
  return segs
}

// Para retomar una ruta en curso si la app se cierra (se guarda en el teléfono mientras se graba).
export function rutaParaGuardar(ruta) {
  const t0 = ruta.segs[0]?.[0]?.t ?? 0
  return JSON.stringify({t0, s: compactar(ruta.segs, t0)})
}

export function rutaDesdeGuardado(texto) {
  try {
    const o = JSON.parse(texto)
    if (!o || !Number.isFinite(o.t0)) return rutaNueva()
    return {segs: descompactar(o.s, o.t0)}
  } catch {
    return rutaNueva()
  }
}

// ---------- Ruta terminada ----------

// Arma la fila que se guarda en la tabla `rutas`, o null si el recorrido es muy corto.
// Las estadísticas salen del recorrido completo; el trazo guardado se recorta (privacidad) y se simplifica.
export function armarRuta({fecha, distM = 0, seg = 0, segs = [], ocultarM = RUTA_CFG.ocultarM}) {
  const limpios = segs.filter(g => g.length)
  if (!fecha || totalPuntos(limpios) < 2) return null
  if (!(distM >= RUTA_CFG.distMin) || !(seg >= RUTA_CFG.segMin)) return null
  const inicio = limpios[0][0].t
  const sug = sugerirActividad({distM, seg})
  const desn = desnivel(limpios)
  const visible = limitarPuntos(recortarExtremos(limpios, ocultarM)).segs
  return {
    fecha,
    inicio,
    tipo: sug?.tipo ?? 'caminata',
    distM: Math.round(distM),
    seg: Math.round(seg),
    ritmo: ritmoSegKm(distM, seg),
    parciales: parciales(limpios),
    ...(desn ? {sube: desn.sube, baja: desn.baja} : {}),
    recortada: Math.min(Math.max(0, +ocultarM || 0), distanciaRutaM(limpios) / 4) > 0,
    puntos: compactar(visible, inicio),
    nPuntos: totalPuntos(visible)
  }
}

export const segsDeRuta = r => descompactar(r?.puntos, r?.inicio)

// ---------- Trazo SVG (sin mapa ni conexión) ----------

// Proyecta el recorrido a un recuadro ancho×alto conservando la proporción real (norte arriba).
// Devuelve {ancho, alto, viewBox, paths, inicio, fin} o null si no hay puntos.
export function trazoSvg(segs, {ancho = 300, alto = 180, margen = 12} = {}) {
  const todos = segs.flat()
  if (!todos.length) return null
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity
  for (const p of todos) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  const k = Math.cos(rad((minLat + maxLat) / 2))
  const spanX = (maxLon - minLon) * k,
    spanY = maxLat - minLat
  const dispX = ancho - 2 * margen,
    dispY = alto - 2 * margen
  const escala =
    spanX > 0 || spanY > 0
      ? Math.min(spanX > 0 ? dispX / spanX : Infinity, spanY > 0 ? dispY / spanY : Infinity)
      : 1
  const offX = margen + (dispX - spanX * escala) / 2,
    offY = margen + (dispY - spanY * escala) / 2
  const r1 = n => Math.round(n * 10) / 10
  const xy = p => ({
    x: r1(offX + (p.lon - minLon) * k * escala),
    y: r1(offY + (maxLat - p.lat) * escala)
  })
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
    paths,
    inicio: xy(todos[0]),
    fin: xy(ultimo[ultimo.length - 1])
  }
}

// ---------- Historial ----------

export function resumenRutas(lista = []) {
  return {
    cantidad: lista.length,
    km: lista.reduce((s, r) => s + (+r.distM || 0), 0) / 1000,
    seg: lista.reduce((s, r) => s + (+r.seg || 0), 0),
    sube: lista.reduce((s, r) => s + (+r.sube || 0), 0)
  }
}

// Agrupa por mes (más reciente primero); dentro de cada mes, la más nueva arriba.
export function agruparPorMes(lista = []) {
  const meses = new Map()
  for (const r of lista) {
    const mes = String(r.fecha || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(mes)) continue
    if (!meses.has(mes)) meses.set(mes, [])
    meses.get(mes).push(r)
  }
  return [...meses.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([mes, rutas]) => {
      rutas.sort((a, b) => (b.inicio || 0) - (a.inicio || 0) || (b.id || 0) - (a.id || 0))
      return {mes, rutas, ...resumenRutas(rutas)}
    })
}

// ---------- Para la IA: solo agregados ----------
// Sin coordenadas, sin puntos y sin horas exactas. Pensado para el informe, la preparación y el coach.

const r1 = n => Math.round(n * 10) / 10

export function resumenRutasParaIA(lista = []) {
  const total = resumenRutas(lista)
  const porTipo = {}
  for (const r of lista) {
    const t = r.tipo || 'otro'
    porTipo[t] ??= {rutas: 0, km: 0}
    porTipo[t].rutas++
    porTipo[t].km = r1(porTipo[t].km + (+r.distM || 0) / 1000)
  }
  const conRitmo = lista.filter(r => r.ritmo > 0)
  const larga = lista.reduce((m, r) => Math.max(m, +r.distM || 0), 0)
  return {
    rutas: total.cantidad,
    km: r1(total.km),
    minutos: Math.round(total.seg / 60),
    desnivelSubeM: Math.round(total.sube),
    kmMasLarga: r1(larga / 1000),
    ritmoMedioSegKm: conRitmo.length
      ? Math.round(conRitmo.reduce((s, r) => s + r.ritmo, 0) / conRitmo.length)
      : null,
    porTipo
  }
}
