// Pruebas del reloj (services/reloj.js) con navegador simulado: hora, almacenamiento y temporizadores falsos.
import test, {mock} from 'node:test'
import assert from 'node:assert/strict'

const mem = {mv_sonido: '0'} // sin sonido en las pruebas
let t = 1_700_000_000_000
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => mem[k] ?? null,
    setItem: (k, v) => {
      mem[k] = String(v)
    },
    removeItem: k => {
      delete mem[k]
    }
  }
})
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {vibrate() {}}})
Object.defineProperty(globalThis, 'document', {configurable: true, value: {addEventListener() {}}})
const ahora = Date.now
Date.now = () => t
mock.timers.enable({apis: ['setInterval', 'setTimeout']})

const R = await import('../src/services/reloj.js')
const avanzar = s => {
  t += s * 1000
}

test.after(() => {
  Date.now = ahora
  mock.timers.reset()
})

test('iniciar: arranca en el "Preparate" y luego pasa al primer minuto del EMOM', () => {
  R.iniciar({tipo: 'emom', minutos: 12}, 2)
  assert.equal(R.enMarcha(), true)
  assert.equal(R.ahoraPos().seg.previo, true)
  avanzar(6)
  assert.equal(R.ahoraPos().i, 1)
  assert.equal(R.ahoraPos().restante, 59)
})
test('pausa: el tiempo no corre; al seguir continúa donde quedó', () => {
  R.pausarOReanudar()
  assert.equal(R.enMarcha(), false)
  const antes = R.ahoraPos().restante
  avanzar(300)
  assert.equal(R.ahoraPos().restante, antes)
  R.pausarOReanudar()
  avanzar(2)
  assert.equal(R.ahoraPos().restante, antes - 2)
})
test('90 segundos sin ningún tick: la posición sale bien de la hora real', () => {
  avanzar(90)
  const p = R.ahoraPos()
  assert.equal(p.i, 2) // ya va en el minuto 2 (6+2 s + 90 s > 5 + 60)
})
test('sumarRonda y cerrar devuelven bloque, rondas y limpian todo', () => {
  R.sumarRonda()
  R.sumarRonda()
  assert.ok(mem.mv_timer)
  const r = R.cerrar()
  assert.deepEqual(r, {bi: 2, rondas: 2, tiempo: 0})
  assert.equal(R.estado(), null)
  assert.equal(mem.mv_timer, undefined)
  assert.equal(R.enMarcha(), false)
})
test('for time: "terminar" guarda el tiempo real (sin contar el Preparate)', () => {
  R.iniciar({tipo: 'forTime', minutos: 10}, 0)
  avanzar(5 + 462) // 7:42 de trabajo
  R.terminar()
  assert.equal(R.estado().tiempo, 462)
  assert.equal(R.enMarcha(), false)
  assert.equal(R.cerrar().tiempo, 462)
})
test('for time sin terminar antes del Preparate: tiempo 0', () => {
  R.iniciar({tipo: 'forTime', minutos: 10}, 0)
  avanzar(3)
  R.terminar()
  assert.equal(R.estado().tiempo, 0)
  R.cerrar()
})
test('al llegar al final el reloj se detiene solo', () => {
  R.iniciar({tipo: 'emom', minutos: 1}, 0)
  avanzar(5 + 60 + 1)
  mock.timers.tick(200)
  assert.equal(R.enMarcha(), false)
  assert.equal(R.ahoraPos().fin, true)
  R.cerrar()
})
test('recargar la app con el reloj en marcha: sigue con la hora real', async () => {
  R.iniciar({tipo: 'amrap', minutos: 10}, 1)
  avanzar(65) // pasan 65 s con la app cerrada
  const R2 = await import('../src/services/reloj.js?recarga=1')
  assert.equal(R2.enMarcha(), true)
  assert.equal(R2.estado().bi, 1)
  assert.equal(R2.ahoraPos().restante, 5 + 600 - 65)
  R2.cerrar()
  R.cerrar()
})
