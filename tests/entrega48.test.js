// Entrega 47 (v0.48.0) · pasos en el gasto calórico, sin contar dos veces las caminatas.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gastoDia, gastoSemana, pasosCubiertos, PASOS_POR_MIN, MET_PASOS} from '../src/domain/gasto.js'
import {informeSemana, textoGasto, cuerpoCoach} from '../src/domain/informe.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const L = '2026-11-09'
const medidas = [{fecha: L, peso: 70}]

test('pasos sueltos: 10.000 pasos con 70 kg ≈ 210 kcal sobre el reposo', () => {
  const g = gastoDia({fecha: L, medidas, habitos: [{fecha: L, pasos: 10000}]})
  assert.equal(g.pasos.pasos, 10000)
  assert.equal(g.pasos.kcal, Math.round((MET_PASOS - 1) * 70 * (10000 / PASOS_POR_MIN.caminata / 60)))
  assert.equal(g.kcal, g.pasos.kcal)
})

test('no cuenta dos veces: una caminata de 60 min descuenta 6.000 pasos', () => {
  const g = gastoDia({fecha: L, medidas, habitos: [{fecha: L, pasos: 10000}], actividades: [{fecha: L, tipo: 'caminata', minutos: 60}]})
  assert.equal(g.pasos.pasos, 4000)
  assert.equal(g.kcal, g.actividad.kcal + g.pasos.kcal)
})

test('si los pasos no superan lo cubierto, no suman; la bici no descuenta pasos', () => {
  const a = gastoDia({fecha: L, medidas, habitos: [{fecha: L, pasos: 3000}], actividades: [{fecha: L, tipo: 'caminata', minutos: 60}]})
  assert.equal(a.pasos.kcal, 0)
  assert.equal(a.pasos.cantidad, 0)
  assert.equal(pasosCubiertos([{tipo: 'bicicleta', minutos: 60}]), 0)
  assert.equal(pasosCubiertos([{tipo: 'carrera', minutos: 30}]), 4800)
})

test('sin peso no se inventan kcal de pasos; sin pasos el total es el de antes', () => {
  const sp = gastoDia({fecha: L, habitos: [{fecha: L, pasos: 8000}]})
  assert.equal(sp.kcal, 0)
  assert.equal(sp.sinPeso, true)
  const sin = gastoDia({fecha: L, medidas, sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}]})
  assert.equal(sin.pasos.kcal, 0)
  assert.equal(sin.kcal, sin.entreno.kcal)
})

test('semana: suma los pasos y el informe los cuenta; no viajan a la IA', () => {
  const habitos = [{fecha: L, pasos: 10000}, {fecha: '2026-11-10', pasos: 5000}]
  const s = gastoSemana({desde: L, medidas, habitos})
  assert.equal(s.pasos, s.kcal)
  assert.ok(s.kcal > 300)
  const inf = informeSemana({desde: L, medidas, habitos})
  assert.match(textoGasto(inf.gasto), /pasos sueltos ≈/)
  assert.equal(/pasos sueltos|kcalPorDia/i.test(JSON.stringify(cuerpoCoach(inf))), false)
})

test('lectura y reglas: habitos solo fecha y pasos; Dexie v11; versión 0.48.0', () => {
  assert.match(leer('src/data/gasto.js'), /habitos: habitos\.map\(h => \(\{fecha: h\.fecha, pasos: h\.pasos\}\)\)/)
  assert.doesNotMatch(leer('src/domain/gasto.js'), /from '\.\.?\/(?!stats|movimiento)|react|db\.|localStorage|document|window/)
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  const pkg = JSON.parse(leer('package.json'))
  assert.match(pkg.version, /^0\.(4[89]|[5-9]\d)\.\d+$/) // relajada en la Entrega 48: ya no fija la versión vigente
  assert.match(leer('CHANGELOG.md'), /## v0\.48\.0 · Entrega 47/)
})
