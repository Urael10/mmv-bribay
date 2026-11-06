// Corrección 0.35.1 · el contador quedaba en 0 en modo bolsillo.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {detectorNuevo, procesarMuestra, magnitudParaPasos, combinarPasos} from '../src/domain/actividad.js'
const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// Caminata a ~1,8 pasos/s con golpe vertical + armónico + ruido; devuelve los pasos contados en 60 s.
function caminar({amp, hz = 60, gravedad = true, ruido = 0.12}) {
  let d = detectorNuevo(), n = 0, seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5
  for (let i = 0; i < 60 * hz; i++) {
    const t = (i * 1000) / hz, w = (2 * Math.PI * 1.8 * t) / 1000
    const lin = {
      x: amp * 0.5 * Math.sin(w + 1) + rnd() * ruido,
      y: rnd() * ruido,
      z: amp * (Math.sin(w) + 0.4 * Math.sin(2 * w)) + rnd() * ruido
    }
    const ev = gravedad
      ? {acceleration: lin, accelerationIncludingGravity: {...lin, z: lin.z + 9.81}}
      : {acceleration: lin}
    const r = procesarMuestra(d, magnitudParaPasos(ev), t)
    d = r.detector
    if (r.paso) n++
  }
  return n
}

test('magnitudParaPasos: prefiere la que incluye gravedad y cae a la lineal', () => {
  assert.equal(magnitudParaPasos({accelerationIncludingGravity: {x: 0, y: 3, z: 4}, acceleration: {x: 1, y: 1, z: 1}}), 5)
  assert.equal(magnitudParaPasos({acceleration: {x: 3, y: 4, z: 0}}), 5)
  assert.equal(magnitudParaPasos({accelerationIncludingGravity: {x: null, y: 1, z: 1}, acceleration: {x: 3, y: 4, z: 0}}), 5)
  assert.equal(magnitudParaPasos({}), null)
  assert.equal(magnitudParaPasos(null), null)
})

test('bolsillo: movimiento suave (0,6 a 1 m/s²) ahora cuenta; antes quedaba en 0', () => {
  for (const amp of [0.6, 1, 1.5, 2.5, 4]) {
    const n = caminar({amp})
    assert.ok(n >= 100 && n <= 112, `amp ${amp}: contó ${n}, esperaba ~108`)
  }
})

test('bolsillo: también cuenta con 16 y 30 muestras por segundo', () => {
  for (const hz of [16, 30]) {
    const n = caminar({amp: 1, hz})
    assert.ok(n >= 100 && n <= 112, `${hz} Hz: contó ${n}`)
  }
})

test('quieto o con ruido de sensor no cuenta pasos falsos', () => {
  assert.equal(caminar({amp: 0}), 0)
  assert.equal(caminar({amp: 0.3}), 0)
})

test('respaldo: sin pasos del sensor, el número en vivo sigue al GPS en vez de quedarse en 0', () => {
  assert.equal(combinarPasos({sensor: 0, distM: 100, largo: 0.72}).pasos, 139)
  assert.equal(combinarPasos({sensor: 0, distM: 100, largo: 0.72}).fuente, 'gps')
  assert.equal(combinarPasos({sensor: 0, distM: 10}).pasos, 0) // poca distancia: no inventa pasos
})

test('el componente usa la magnitud nueva y el respaldo GPS en vivo', () => {
  const a = leer('src/features/actividad/ActividadFisica.jsx')
  assert.match(a, /magnitudParaPasos\(e\)/)
  assert.match(a, /combinarPasos\(\{sensor: sesion, distM: gps\.m/)
  assert.match(a, /pasosEnVivo\(\{total, sesion: sesionVivo/)
  assert.match(a, /addEventListener\('release'/)
})

test('versión 0.35.1 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  assert.equal(pkg.version, '0.35.1')
  assert.equal(lock.version, '0.35.1')
  assert.equal(lock.packages[''].version, '0.35.1')
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\n\n## v0\.35\.1 · Entrega 34 · Corrección: contador de pasos en modo bolsillo/)
})
