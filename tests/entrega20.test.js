import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_PASOS, TIPOS, LARGO_PASO_INICIAL, GPS_CFG,
  parsearPasos, sumarPasos, magnitudAceleracion, detectorNuevo, procesarMuestra,
  distanciaM, gpsNuevo, procesarPuntoGps, gpsParaGuardar, gpsDesdeGuardado,
  normalizarLargoPaso, pasosPorDistancia, combinarPasos, calibrarLargoPaso,
  sugerirActividad, cerrarConteo, armarActividad, resumenActividades
} from '../src/domain/actividad.js'

// ---------- pasos a mano ----------
test('parsearPasos: vacío borra, enteros válidos, rechaza el resto', () => {
  assert.deepEqual(parsearPasos(''), {ok: true, pasos: null})
  assert.deepEqual(parsearPasos('6500'), {ok: true, pasos: 6500})
  assert.deepEqual(parsearPasos(String(MAX_PASOS)), {ok: true, pasos: MAX_PASOS})
  for (const malo of ['-1', '1.5', 'abc', String(MAX_PASOS + 1), '1e3'])
    assert.equal(parsearPasos(malo).ok, false, malo)
})

test('sumarPasos: suma, tope de 200 000 y entradas raras', () => {
  assert.equal(sumarPasos(1000, 500), 1500)
  assert.equal(sumarPasos(undefined, 300), 300)
  assert.equal(sumarPasos(null, null), 0)
  assert.equal(sumarPasos(199900, 500), MAX_PASOS)
  assert.equal(sumarPasos(100, -50), 100)
  assert.equal(sumarPasos('1200', 3.9), 1203)
})

// ---------- acelerómetro ----------
test('magnitudAceleracion: prefiere la lineal y cae a la que incluye gravedad', () => {
  assert.equal(magnitudAceleracion({acceleration: {x: 3, y: 4, z: 0}}), 5)
  assert.equal(
    magnitudAceleracion({acceleration: {x: null, y: 1, z: 1}, accelerationIncludingGravity: {x: 0, y: 3, z: 4}}),
    5
  )
  assert.equal(magnitudAceleracion({accelerationIncludingGravity: {x: 0, y: 0, z: 9.8}}), 9.8)
  assert.equal(magnitudAceleracion({}), null)
  assert.equal(magnitudAceleracion(null), null)
  assert.equal(magnitudAceleracion({acceleration: {x: 1, y: 1, z: undefined}}), null)
})

// Simula un teléfono muestreado a 50 Hz con un paso cada `periodoMs`.
function simular(segundos, periodoMs, amplitud) {
  let d = detectorNuevo(), pasos = 0
  for (let t = 0; t < segundos * 1000; t += 20) {
    const m = 9.8 + (amplitud ? amplitud * Math.sin((2 * Math.PI * t) / periodoMs) : 0)
    const r = procesarMuestra(d, m, t + 1000)
    d = r.detector
    if (r.paso) pasos++
  }
  return pasos
}

test('detector: caminar a 2 pasos por segundo cuenta cerca de lo esperado', () => {
  const n = simular(30, 500, 3)
  assert.ok(n >= 55 && n <= 65, `contó ${n}, esperaba ~60`)
})

test('detector: teléfono quieto o con gravedad constante no cuenta', () => {
  assert.equal(simular(30, 500, 0), 0)
})

test('detector: temblor muy rápido no supera un paso cada 280 ms', () => {
  const n = simular(10, 100, 5)
  assert.ok(n <= Math.floor(10000 / 280) + 1, `contó ${n}`)
})

test('detector: no muta el estado que recibe y ignora muestras inválidas', () => {
  const d = detectorNuevo(5)
  const r = procesarMuestra(d, 9.8, 100)
  assert.equal(d.base, null)
  assert.equal(r.detector.base, 9.8)
  assert.equal(r.detector.ultimo, 5)
  assert.deepEqual(procesarMuestra(r.detector, NaN, 200), {detector: r.detector, paso: false})
})

// ---------- distancia ----------
test('distanciaM: un grado de latitud ≈ 111,2 km; mismo punto = 0', () => {
  const d = distanciaM({lat: 0, lon: 0}, {lat: 1, lon: 0})
  assert.ok(Math.abs(d - 111195) < 100, String(d))
  assert.equal(distanciaM({lat: -34.6, lon: -58.4}, {lat: -34.6, lon: -58.4}), 0)
})

test('distanciaM: Obelisco a Plaza de Mayo ≈ 1,6 km', () => {
  const d = distanciaM({lat: -34.60372, lon: -58.38156}, {lat: -34.60874, lon: -58.37233})
  assert.ok(d > 1000 && d < 1200, String(d))
})

// ---------- GPS ----------
const BASE = {lat: -34.6, lon: -58.4}
// Un punto `m` metros al norte de BASE, `s` segundos después del inicio.
const punto = (m, s, precision = 5) => ({lat: BASE.lat + m / 111195, lon: BASE.lon, precision, t: 1_000_000 + s * 1000})

test('GPS: acumula distancia caminando ~1,4 m/s', () => {
  let e = gpsNuevo()
  for (let s = 0; s <= 100; s += 5) e = procesarPuntoGps(e, punto(s * 1.4, s)).estado
  assert.ok(Math.abs(e.m - 140) < 2, String(e.m))
  assert.equal(e.seg, 100)
})

test('GPS: descarta puntos con mala precisión', () => {
  let e = procesarPuntoGps(gpsNuevo(), punto(0, 0)).estado
  const r = procesarPuntoGps(e, punto(50, 5, 80))
  assert.equal(r.motivo, 'precision')
  assert.equal(r.estado, e)
})

test('GPS: el temblor con el teléfono quieto no suma distancia', () => {
  let e = procesarPuntoGps(gpsNuevo(), punto(0, 0, 10)).estado
  for (let s = 2; s <= 120; s += 2) {
    const r = procesarPuntoGps(e, punto(s % 4 === 0 ? 2 : -2, s, 10))
    e = r.estado
    assert.equal(r.motivo, 'quieto')
  }
  assert.equal(e.m, 0)
  assert.equal(e.seg, 120)
})

test('GPS: un salto imposible (más de 12 m/s) se rechaza', () => {
  let e = procesarPuntoGps(gpsNuevo(), punto(0, 0)).estado
  const r = procesarPuntoGps(e, punto(500, 5))
  assert.equal(r.motivo, 'salto')
  assert.equal(r.estado.m, 0)
})

test('GPS: tras un hueco largo se vuelve a anclar sin sumar el tramo', () => {
  let e = procesarPuntoGps(gpsNuevo(), punto(0, 0)).estado
  const r = procesarPuntoGps(e, punto(300, 120))
  assert.equal(r.motivo, 'hueco')
  assert.equal(r.estado.m, 0)
  const r2 = procesarPuntoGps(r.estado, punto(310, 125))
  assert.equal(r2.motivo, 'movimiento')
  assert.ok(Math.abs(r2.estado.m - 10) < 0.5)
})

test('GPS: puntos inválidos o con la hora hacia atrás no rompen nada', () => {
  const e = procesarPuntoGps(gpsNuevo(), punto(0, 10)).estado
  assert.equal(procesarPuntoGps(e, {lat: NaN, lon: 0, precision: 5, t: 1}).motivo, 'invalido')
  assert.equal(procesarPuntoGps(e, {lat: 91, lon: 0, precision: 5, t: 1}).motivo, 'invalido')
  assert.equal(procesarPuntoGps(e, {lat: 0, lon: 0, precision: 0, t: 1}).motivo, 'invalido')
  assert.equal(procesarPuntoGps(e, null).motivo, 'invalido')
  assert.equal(procesarPuntoGps(e, punto(20, 5)).motivo, 'tiempo')
})

test('GPS: guardar y recuperar un conteo en curso', () => {
  const e = {...gpsNuevo(), m: 1234.56, seg: 900.4, puntos: 77, ancla: punto(0, 0), t: 1}
  const g = gpsDesdeGuardado(gpsParaGuardar(e))
  assert.equal(g.m, 1234.6)
  assert.equal(g.seg, 900)
  assert.equal(g.puntos, 77)
  assert.equal(g.ancla, null)
  for (const roto of [null, '', 'xx', '{"m":-5,"seg":1}', '{"m":"a"}'])
    assert.deepEqual(gpsDesdeGuardado(roto), gpsNuevo())
})

// ---------- largo de paso y combinación ----------
test('normalizarLargoPaso: limita y usa el inicial si no es número', () => {
  assert.equal(normalizarLargoPaso('0.8'), 0.8)
  assert.equal(normalizarLargoPaso(0.123), 0.4)
  assert.equal(normalizarLargoPaso(3), 1.3)
  assert.equal(normalizarLargoPaso('hola'), LARGO_PASO_INICIAL)
  assert.equal(normalizarLargoPaso(''), LARGO_PASO_INICIAL)
  assert.equal(normalizarLargoPaso(null), LARGO_PASO_INICIAL)
})

test('pasosPorDistancia: metros / largo de paso', () => {
  assert.equal(pasosPorDistancia(720), 1000)
  assert.equal(pasosPorDistancia(800, 0.8), 1000)
  assert.equal(pasosPorDistancia(0), 0)
})

test('combinarPasos: sin GPS o con muy poca distancia manda el sensor', () => {
  assert.deepEqual(combinarPasos({sensor: 500, distM: 0}), {pasos: 500, fuente: 'sensor'})
  assert.deepEqual(combinarPasos({sensor: 20, distM: 30}), {pasos: 20, fuente: 'sensor'})
  assert.deepEqual(combinarPasos({sensor: 0, distM: 0}), {pasos: 0, fuente: 'ninguna'})
})

test('combinarPasos: sensor y GPS coinciden → se queda el sensor', () => {
  assert.deepEqual(combinarPasos({sensor: 1400, distM: 1000}), {pasos: 1400, fuente: 'sensor'})
})

test('combinarPasos: sin permiso del sensor o sensor perdido → estima con el GPS', () => {
  assert.deepEqual(combinarPasos({sensor: 0, distM: 720}), {pasos: 1000, fuente: 'gps'})
  assert.deepEqual(combinarPasos({sensor: 300, distM: 2000}), {pasos: 2778, fuente: 'gps'})
})

test('combinarPasos: si el GPS midió de menos (edificio) no baja lo del sensor', () => {
  assert.deepEqual(combinarPasos({sensor: 3000, distM: 300}), {pasos: 3000, fuente: 'sensor'})
})

test('combinarPasos: un trote de zancada larga (1,3 m) con largo sin calibrar no se toma por sensor perdido', () => {
  assert.deepEqual(combinarPasos({sensor: 1000, distM: 1300}), {pasos: 1000, fuente: 'sensor'})
})

test('combinarPasos: una zancada larga ya calibrada no se confunde con sensor perdido', () => {
  // 1,1 m por paso: 1000 pasos = 1100 m; con largo calibrado 1,1 manda el sensor
  assert.equal(combinarPasos({sensor: 1000, distM: 1100, largo: 1.1}).fuente, 'sensor')
})

test('calibrarLargoPaso: aprende de a poco y no aprende de datos incoherentes', () => {
  const n = calibrarLargoPaso({sensor: 1000, distM: 850, actual: 0.72})
  assert.ok(n > 0.72 && n < 0.85, String(n))
  assert.equal(calibrarLargoPaso({sensor: 100, distM: 500}), null)
  assert.equal(calibrarLargoPaso({sensor: 1000, distM: 100}), null)
  assert.equal(calibrarLargoPaso({sensor: 300, distM: 2000, actual: 0.72}), null)
  assert.equal(calibrarLargoPaso({sensor: 2000, distM: 400, actual: 0.72}), null)
})

test('sugerirActividad: caminata, carrera, bici o nada si es muy poco', () => {
  assert.deepEqual(sugerirActividad({distM: 3000, seg: 2400}), {tipo: 'caminata', minutos: 40, km: 3})
  assert.deepEqual(sugerirActividad({distM: 5000, seg: 1800}), {tipo: 'carrera', minutos: 30, km: 5})
  assert.equal(sugerirActividad({distM: 10000, seg: 1800}).tipo, 'bicicleta')
  assert.equal(sugerirActividad({distM: 50, seg: 600}), null)
  assert.equal(sugerirActividad({distM: 500, seg: 30}), null)
  assert.equal(sugerirActividad({}), null)
})

test('cerrarConteo: junta pasos, largo nuevo y actividad sugerida', () => {
  const r = cerrarConteo({sensor: 3000, distM: 2300, seg: 1500, largo: 0.72})
  assert.equal(r.pasos, 3000)
  assert.equal(r.fuente, 'sensor')
  assert.ok(r.largoNuevo > 0.72)
  assert.deepEqual(r.actividad, {tipo: 'caminata', minutos: 25, km: 2.3})
  const solo = cerrarConteo({sensor: 120})
  assert.deepEqual([solo.pasos, solo.largoNuevo, solo.actividad], [120, null, null])
})

// ---------- actividades ----------
test('armarActividad: valida y recorta', () => {
  assert.deepEqual(armarActividad({fecha: '2026-11-03', tipo: 'carrera', minutos: '30.7', km: '5.456', nota: '  Costanera  '}),
    {fecha: '2026-11-03', tipo: 'carrera', minutos: 30, km: 5.46, nota: 'Costanera'})
  assert.deepEqual(armarActividad({fecha: '2026-11-03', tipo: 'inventado', minutos: 10}),
    {fecha: '2026-11-03', tipo: 'otro', minutos: 10})
  assert.equal(armarActividad({fecha: '2026-11-03', tipo: 'otro', minutos: 0}), null)
  assert.equal(armarActividad({fecha: '2026-11-03', tipo: 'otro', minutos: 1441}), null)
  assert.equal(armarActividad({fecha: '2026-11-03', tipo: 'otro', minutos: 10, km: -1}), null)
  assert.equal(armarActividad({fecha: '2026-11-03', tipo: 'otro', minutos: 10, km: 1001}), null)
  assert.equal(armarActividad({tipo: 'otro', minutos: 10}), null)
  assert.equal(armarActividad({fecha: '2026-11-03', tipo: 'otro', minutos: 5, nota: 'x'.repeat(300)}).nota.length, 100)
})

test('resumenActividades: totales y lista vacía', () => {
  assert.deepEqual(resumenActividades([]), {cantidad: 0, minutos: 0, km: 0})
  assert.deepEqual(resumenActividades([{minutos: 30, km: 2.5}, {minutos: 20}]), {cantidad: 2, minutos: 50, km: 2.5})
  assert.ok(Object.keys(TIPOS).includes('caminata'))
  assert.ok(GPS_CFG.precisionMax > 0)
})
