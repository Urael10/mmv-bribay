// Entrega 8: récords por contexto, progresión, descarga, pilares, tests de referencia, check-in en el informe y migración v6 → v7.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import {
  sugerenciaCarga,
  progresiones,
  descarga,
  cargaSemanalSerie,
  pilares,
  estadoTests,
  normalizarTest,
  validarTest
} from '../src/domain/progreso.js'
import {marcarPorContexto, claveCtx, sumaDias} from '../src/domain/stats.js'
import {informeSemana, textoInforme, cuerpoCoach, hayDatos} from '../src/domain/informe.js'

const mem = {}
globalThis.localStorage = {
  getItem: k => mem[k] ?? null,
  setItem: (k, v) => (mem[k] = String(v)),
  removeItem: k => delete mem[k]
}
const HOY = '2026-11-02' // lunes
const d = n => sumaDias(HOY, n)
const reg = (id, dias, kg, reps, extra = {}) => ({
  id,
  fecha: d(dias),
  clave: 'sentadilla',
  nombre: 'Sentadilla',
  tipo: 'warmup',
  kg,
  reps,
  ...extra
})

test('récords por contexto: el mismo ejercicio en otro tipo de bloque no se compara', () => {
  const rs = [
    reg(1, -20, 60, 10, {tipo: 'emom'}),
    reg(2, -10, 100, 5, {tipo: 'warmup'}),
    reg(3, -5, 62.5, 10, {tipo: 'emom'})
  ]
  const M = marcarPorContexto(rs)
  assert.deepEqual(M[2].flags, []) // primera vez en ese contexto
  assert.ok(M[3].flags.includes('carga')) // supera el EMOM anterior aunque no los 100 kg de otro contexto
  assert.notEqual(claveCtx(rs[0]), claveCtx(rs[1]))
})

test('sugerencia de carga: sube, consolida o repite según los dos últimos registros', () => {
  assert.equal(sugerenciaCarga([reg(1, -7, 60, 10)]).estado, 'sin-datos')
  const sube = sugerenciaCarga([reg(1, -14, 60, 8), reg(2, -7, 60, 8)])
  assert.equal(sube.estado, 'subir')
  assert.equal(sube.kgSug, 61.5)
  assert.equal(sugerenciaCarga([reg(1, -14, 10, 8), reg(2, -7, 10, 8)]).kgSug, 10.5) // mínimo +0,5 kg
  assert.equal(sugerenciaCarga([reg(1, -14, 60, 8), reg(2, -7, 65, 6)]).estado, 'consolidar')
  assert.match(sugerenciaCarga([reg(1, -14, 60, 10), reg(2, -7, 60, 8)]).texto, /Bajaron/)
  assert.match(sugerenciaCarga([reg(1, -14, 60, 10), reg(2, -7, 60, 9)]).texto, /una repetición más/)
  const L = progresiones([reg(1, -14, 60, 8), reg(2, -7, 60, 8), reg(3, -3, 40, 10, {clave: 'remo', nombre: 'Remo*', tipo: 'emom'})])
  assert.equal(L.length, 1) // el remo tiene un solo registro
  assert.equal(L[0].nombre, 'Sentadilla')
})

test('pilar fuerza: mejor 1RM estimado de 28 días contra los 28 anteriores, por ejercicio y contexto', () => {
  const remo = {clave: 'remo', nombre: 'Remo', tipo: 'emom'}
  const rs = [
    reg(1, -40, 60, 5),
    reg(2, -35, 60, 5),
    reg(3, -5, 70, 5),
    reg(4, -3, 70, 5),
    reg(5, -40, 40, 10, remo),
    reg(6, -3, 40, 10, remo)
  ]
  const F = pilares({fecha: HOY, registros: rs}).fuerza
  assert.deepEqual([F.comparables, F.suben, F.igual, F.bajan], [2, 1, 1, 0])
  assert.equal(F.etiqueta, 'Subiendo')
  assert.ok(F.records >= 1)
  assert.equal(pilares({fecha: HOY}).fuerza.etiqueta, 'Sin datos suficientes')
})

test('pilares: resistencia (cardio y tests), composición (peso) y hábitos (7 días)', () => {
  const bici = {clave: 'assault', nombre: 'Assault bike', tipo: 'amrap', kg: 0}
  const rs = [
    {id: 1, fecha: d(-3), reps: 40, ...bici},
    {id: 2, fecha: d(-35), reps: 20, ...bici}
  ]
  const tests = [
    {id: 1, fecha: d(-60), clave: 'km1', valor: 300},
    {id: 2, fecha: d(-2), clave: 'km1', valor: 280}
  ]
  const medidas = [
    {fecha: d(-30), peso: 82, estandar: true},
    {fecha: d(0), peso: 80, estandar: true}
  ]
  const habitos = [0, 1, 2, 3].map(n => ({fecha: d(-n), energia: 4, animo: 4, dolor: 2, sueno: '7', agua: 2600}))
  const p = pilares({fecha: HOY, registros: rs, sesiones: [{fecha: d(-3), rpe: 7}], habitos, comidas: [{fecha: d(-1)}], medidas, tests})
  assert.deepEqual([p.resistencia.repsCardio, p.resistencia.deltaPct], [40, 100])
  assert.deepEqual([p.resistencia.testsMejoraron, p.resistencia.testsComparados], [1, 1]) // 1 km: menos tiempo = mejor
  assert.equal(p.resistencia.etiqueta, 'Subiendo')
  assert.equal(p.composicion.peso.delta, -2)
  assert.equal(p.composicion.etiqueta, 'Con tendencia')
  assert.deepEqual([p.habitos.checkin, p.habitos.sueno, p.habitos.agua, p.habitos.comida, p.habitos.entrenos], [4, 4, 4, 1, 1])
  assert.equal(p.habitos.cumplimiento, 46)
  assert.equal(p.habitos.etiqueta, 'Irregular')
  assert.equal(pilares({fecha: HOY}).habitos.etiqueta, 'Sin datos suficientes')
})

test('descarga: se sugiere con 2 señales o más, no con una sola', () => {
  const s = (dias, rpe) => ({fecha: d(dias), rpe})
  const fuerte = descarga({fecha: HOY, sesiones: [s(-14, 6), s(-9, 6), s(-2, 9), s(-1, 9), s(0, 9)]})
  assert.equal(fuerte.sugerir, true) // carga +20 % y RPE medio ≥ 8
  assert.equal(fuerte.senales.length, 2)
  const una = descarga({fecha: HOY, sesiones: [s(-14, 3), s(-9, 3), s(-2, 5), s(-1, 5), s(0, 5)]})
  assert.deepEqual([una.sugerir, una.senales.length], [false, 1]) // solo sube la carga
  const hs = [0, 1, 2].map(n => ({fecha: d(-n), dolor: 5, sueno: '5'}))
  assert.equal(descarga({fecha: HOY, habitos: hs}).sugerir, true) // dolor y poco sueño
  assert.equal(descarga({fecha: HOY}).sugerir, false)
})

test('carga semanal: 8 semanas, de la más antigua a la actual', () => {
  const S = cargaSemanalSerie({fecha: HOY, sesiones: [{fecha: d(0), rpe: 8}, {fecha: d(-1), rpe: 7}]})
  assert.equal(S.length, 8)
  assert.equal(S[7].desde, HOY)
  assert.deepEqual([S[7].carga, S[6].carga, S[0].carga], [360, 315, 0]) // RPE × 45 min por defecto
})

test('tests de referencia: valida, calcula el estado por días y si mejoró', () => {
  assert.deepEqual(normalizarTest({clave: 'plancha', valor: '95,5'}, HOY), {fecha: HOY, clave: 'plancha', valor: 95.5})
  assert.equal(validarTest(normalizarTest({clave: 'plancha', valor: '95,5'}, HOY)), null)
  assert.match(validarTest(normalizarTest({clave: 'plancha', valor: '0'}, HOY)), /mayor que cero/)
  assert.match(validarTest(normalizarTest({clave: 'otro', valor: '5'}, HOY)), /desconocido/)
  const t = [
    {id: 1, fecha: d(-80), clave: 'km1', valor: 300},
    {id: 2, fecha: d(-60), clave: 'km1', valor: 290},
    {id: 3, fecha: d(-45), clave: 'plancha', valor: 60},
    {id: 4, fecha: d(-10), clave: 'flexiones', valor: 30}
  ]
  const E = Object.fromEntries(estadoTests(t, HOY).map(x => [x.k, x]))
  assert.deepEqual([E.km1.estado, E.km1.delta, E.km1.mejoro], ['atrasado', -10, true])
  assert.deepEqual([E.plancha.estado, E.plancha.mejoro], ['toca', null])
  assert.equal(E.flexiones.estado, 'al-dia')
  assert.equal(E.dominadas.estado, 'nunca')
})

test('informe semanal: incluye el check-in (solo días completos) y el coach lo recibe', () => {
  const desde = '2026-10-26'
  const habitos = [
    {fecha: '2026-10-26', energia: 4, animo: 5, dolor: 2},
    {fecha: '2026-10-27', energia: 2, animo: 3, dolor: 4},
    {fecha: '2026-10-28', energia: 5} // incompleto: no cuenta
  ]
  const i = informeSemana({desde, habitos})
  assert.deepEqual(i.checkin, {dias: 2, energia: 3, animo: 4, dolor: 3})
  assert.equal(hayDatos(i), true)
  assert.equal(hayDatos(informeSemana({desde})), false)
  assert.match(textoInforme(i), /Check-in: 2 días · energía 3 · ánimo 4 · dolor muscular 3 \(escala 1 a 5\)/)
  assert.match(textoInforme(informeSemana({desde})), /Check-in: sin datos/)
  assert.match(JSON.parse(cuerpoCoach(i, null)).contents[0].parts[0].text, /"checkin":\{"dias":2/)
})

test('migración v6 → v7: aparece la tabla tests, no se pierde nada y el backup la incluye', async () => {
  const viejo = new Dexie('mv')
  viejo.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
  viejo.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
  viejo.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'})
  viejo.version(4).stores({coach: '&semana'})
  viejo.version(5).stores({alimentos: '++id,&clave,fuenteId', plantillas: '++id,&clave'})
  viejo.version(6).stores({medidas: 'fecha'})
  await viejo.open()
  await viejo.medidas.put({fecha: '2026-11-01', peso: 79, estandar: true})
  await viejo.registros.add({fecha: '2026-11-01', clave: 'sentadilla', nombre: 'Sentadilla', tipo: 'emom', kg: 60, reps: 10})
  viejo.close()

  const {db} = await import('../src/data/db.js')
  await db.open()
  assert.equal((await db.medidas.get('2026-11-01')).peso, 79)
  assert.equal(await db.registros.count(), 1)
  assert.ok(db.tables.some(t => t.name === 'tests'))
  await db.tests.add({fecha: '2026-11-02', clave: 'plancha', valor: 90})
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  const b = await armarBackup()
  assert.equal(b.tests.length, 1)
  await db.tests.clear()
  await restaurar(JSON.parse(JSON.stringify(b)))
  assert.equal((await db.tests.toArray())[0].valor, 90)
})
