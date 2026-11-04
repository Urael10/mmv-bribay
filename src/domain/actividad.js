// Lógica pura de actividad física: pasos (acelerómetro), distancia (GPS), calibración y actividades.
// No toca el navegador ni la base: el componente le pasa los datos y guarda los resultados.

export const MAX_PASOS = 200000

export const TIPOS = {
  bicicleta: '🚲 Bicicleta',
  caminata: '🚶 Caminata',
  carrera: '🏃 Carrera',
  natacion: '🏊 Natación',
  deporte: '🏅 Deporte',
  otro: 'Actividad'
}

// ---------- Pasos cargados a mano ----------

// '' borra el valor (null). Solo enteros positivos hasta MAX_PASOS.
export function parsearPasos(valor) {
  if (valor === '' || valor == null) return {ok: true, pasos: null}
  if (!/^\d+$/.test(String(valor)) || +valor > MAX_PASOS) return {ok: false, pasos: null}
  return {ok: true, pasos: +valor}
}

export function sumarPasos(actual, suma) {
  const a = Math.max(0, Math.floor(+actual) || 0)
  const s = Math.max(0, Math.floor(+suma) || 0)
  return Math.min(MAX_PASOS, a + s)
}

// ---------- Acelerómetro ----------

export const UMBRAL_SUBE = 1.0 // m/s² sobre el nivel estable para marcar un paso
export const UMBRAL_BAJA = 0.3 // m/s² por debajo del cual se rearma el detector
export const INTERVALO_MIN_MS = 280 // ningún humano da dos pasos en menos de esto

// Magnitud de la aceleración de un evento devicemotion. Prefiere la lineal (sin gravedad).
export function magnitudAceleracion(ev) {
  const completo = a => a && [a.x, a.y, a.z].every(v => v != null && Number.isFinite(+v))
  const a = completo(ev?.acceleration) ? ev.acceleration : ev?.accelerationIncludingGravity
  if (!completo(a)) return null
  return Math.hypot(+a.x, +a.y, +a.z)
}

export const detectorNuevo = (ultimo = 0) => ({base: null, arriba: false, ultimo})

// Filtro de nivel estable + detección de picos. No muta: devuelve {detector, paso}.
export function procesarMuestra(d, magnitud, ahora) {
  if (!Number.isFinite(magnitud)) return {detector: d, paso: false}
  if (d.base == null) return {detector: {...d, base: magnitud}, paso: false}
  const base = d.base * 0.9 + magnitud * 0.1
  const senal = magnitud - base
  if (senal > UMBRAL_SUBE && !d.arriba && ahora - d.ultimo >= INTERVALO_MIN_MS)
    return {detector: {base, arriba: true, ultimo: ahora}, paso: true}
  if (senal < UMBRAL_BAJA) return {detector: {...d, base, arriba: false}, paso: false}
  return {detector: {...d, base}, paso: false}
}

// ---------- GPS ----------

export const GPS_CFG = {
  precisionMax: 25, // m: peor precisión aceptada para un punto
  velMax: 12, // m/s (43 km/h): más rápido que esto es un salto de señal, no una persona a pie
  huecoMax: 60, // s: si no llegan puntos por más tiempo, se vuelve a anclar sin sumar el tramo
  quietoMin: 3 // m: movimientos menores (o menores que la mitad de la precisión) se ignoran
}

const RADIO_TIERRA_M = 6371008.8
const rad = g => (g * Math.PI) / 180

// Distancia en metros entre dos puntos {lat, lon} (haversine).
export function distanciaM(a, b) {
  const dLat = rad(b.lat - a.lat),
    dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ancla: último punto que se usó para medir; t: hora (ms) del último punto procesado.
export const gpsNuevo = () => ({ancla: null, t: null, m: 0, seg: 0, puntos: 0})

const puntoValido = p =>
  p &&
  Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 &&
  Number.isFinite(p.precision) && p.precision > 0 &&
  Number.isFinite(p.t)

// Procesa un punto {lat, lon, precision (m), t (ms)}. No muta: devuelve {estado, motivo}.
// motivo: 'inicio' | 'movimiento' | 'hueco' | 'quieto' | 'precision' | 'salto' | 'tiempo' | 'invalido'
export function procesarPuntoGps(est, p, cfg = GPS_CFG) {
  if (!puntoValido(p)) return {estado: est, motivo: 'invalido'}
  if (p.precision > cfg.precisionMax) return {estado: est, motivo: 'precision'}
  if (!est.ancla || est.t == null)
    return {estado: {...est, ancla: p, t: p.t, puntos: est.puntos + 1}, motivo: 'inicio'}
  const dtFix = (p.t - est.t) / 1000
  if (dtFix <= 0) return {estado: est, motivo: 'tiempo'}
  if (dtFix > cfg.huecoMax)
    return {estado: {...est, ancla: p, t: p.t, puntos: est.puntos + 1}, motivo: 'hueco'}
  const d = distanciaM(est.ancla, p)
  if (d < Math.max(cfg.quietoMin, p.precision / 2))
    return {estado: {...est, t: p.t, seg: est.seg + dtFix}, motivo: 'quieto'}
  const dtAncla = (p.t - est.ancla.t) / 1000
  if (dtAncla > 0 && d / dtAncla > cfg.velMax) return {estado: est, motivo: 'salto'}
  return {
    estado: {ancla: p, t: p.t, m: est.m + d, seg: est.seg + dtFix, puntos: est.puntos + 1},
    motivo: 'movimiento'
  }
}

// Para guardar un conteo en curso (sin el ancla: al retomar se vuelve a anclar).
export const gpsParaGuardar = est => JSON.stringify({m: Math.round(est.m * 10) / 10, seg: Math.round(est.seg), puntos: est.puntos})

export function gpsDesdeGuardado(texto) {
  try {
    const o = JSON.parse(texto)
    const m = +o?.m, seg = +o?.seg, puntos = +o?.puntos
    if (!(m >= 0) || !(seg >= 0) || !Number.isFinite(m) || !Number.isFinite(seg)) return gpsNuevo()
    return {...gpsNuevo(), m, seg, puntos: Number.isFinite(puntos) && puntos > 0 ? Math.floor(puntos) : 0}
  } catch {
    return gpsNuevo()
  }
}

// ---------- Largo de paso, combinación sensor + GPS ----------

export const LARGO_PASO_INICIAL = 0.72 // m
export const LARGO_MIN = 0.4
export const LARGO_MAX = 1.3
export const GPS_DISTANCIA_MIN = 50 // m: menos que esto no alcanza para corregir nada
// Si la distancia por paso que sale de sensor + GPS supera esto, el sensor perdió pasos (un trote largo rara vez pasa de 1,5 m).
export const LARGO_PERDIDO_MIN = 1.6

export function normalizarLargoPaso(v) {
  const n = +v
  if (v === '' || v == null || !Number.isFinite(n)) return LARGO_PASO_INICIAL
  return Math.round(Math.min(LARGO_MAX, Math.max(LARGO_MIN, n)) * 100) / 100
}

export const pasosPorDistancia = (m, largo = LARGO_PASO_INICIAL) =>
  m > 0 ? Math.round(m / normalizarLargoPaso(largo)) : 0

// Decide cuántos pasos sumar. El sensor manda; el GPS solo lo reemplaza cuando el sensor
// claramente se perdió pasos (teléfono en la mochila, pantalla bloqueada, permiso denegado).
// Si el GPS midió menos de lo que dice el sensor no se corrige: adentro de un edificio el GPS pierde distancia.
export function combinarPasos({sensor = 0, distM = 0, largo = LARGO_PASO_INICIAL}) {
  const s = Math.max(0, Math.floor(+sensor) || 0)
  const l = normalizarLargoPaso(largo)
  if (!(distM >= GPS_DISTANCIA_MIN)) return {pasos: s, fuente: s > 0 ? 'sensor' : 'ninguna'}
  const porGps = pasosPorDistancia(distM, l)
  if (s === 0) return {pasos: porGps, fuente: 'gps'}
  const largoMedido = distM / s
  if (largoMedido > Math.max(LARGO_PERDIDO_MIN, l * 1.5)) return {pasos: porGps, fuente: 'gps'}
  return {pasos: s, fuente: 'sensor'}
}

// Si el sensor y el GPS coinciden razonablemente, afina el largo de paso (promedio suave).
// Devuelve el largo nuevo o null si no hay datos para aprender.
export function calibrarLargoPaso({sensor = 0, distM = 0, actual = LARGO_PASO_INICIAL}) {
  if (!(sensor >= 200) || !(distM >= 200)) return null
  const l = normalizarLargoPaso(actual)
  const medido = distM / sensor
  const razon = medido / l
  if (razon < 0.7 || razon > 1.5) return null
  return normalizarLargoPaso(l * 0.7 + medido * 0.3)
}

// Arma una actividad sugerida a partir de lo medido con GPS, o null si es muy poco.
export function sugerirActividad({distM = 0, seg = 0}) {
  if (!(distM >= 100) || !(seg >= 60)) return null
  const kmh = (distM / seg) * 3.6
  return {
    tipo: kmh < 7 ? 'caminata' : kmh <= 18 ? 'carrera' : 'bicicleta',
    minutos: Math.max(1, Math.round(seg / 60)),
    km: Math.round((distM / 1000) * 100) / 100
  }
}

// Todo junto al terminar un conteo.
export function cerrarConteo({sensor = 0, distM = 0, seg = 0, largo = LARGO_PASO_INICIAL}) {
  const l = normalizarLargoPaso(largo)
  return {
    ...combinarPasos({sensor, distM, largo: l}),
    largoNuevo: calibrarLargoPaso({sensor, distM, actual: l}),
    actividad: sugerirActividad({distM, seg})
  }
}

// ---------- Actividades registradas ----------

// Valida y arma el registro. Devuelve null si algo no es válido.
export function armarActividad({fecha, tipo, minutos, km, nota}) {
  const duracion = Math.floor(+minutos || 0),
    distancia = +km || 0
  if (!fecha || duracion < 1 || duracion > 1440 || distancia < 0 || distancia > 1000) return null
  const texto = String(nota ?? '').trim().slice(0, 100)
  return {
    fecha,
    tipo: tipo in TIPOS ? tipo : 'otro',
    minutos: duracion,
    ...(distancia > 0 ? {km: +distancia.toFixed(2)} : {}),
    ...(texto ? {nota: texto} : {})
  }
}

export function resumenActividades(lista = []) {
  return {
    cantidad: lista.length,
    minutos: lista.reduce((s, a) => s + (+a.minutos || 0), 0),
    km: lista.reduce((s, a) => s + (+a.km || 0), 0)
  }
}
