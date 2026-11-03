// Entrega 16 (PZ12): el EMOM dice qué ejercicio toca en cada intervalo (uno por minuto, rotando).
import test from 'node:test'
import assert from 'node:assert/strict'
import {armarSegmentos, duracionTotal, posicion, resumenReloj, PREVIO} from '../src/domain/temporizador.js'
import {sesionManual5} from '../src/domain/entreno.js'

const SEIS = ['Swing', 'Remo', 'Sentadilla', 'Push up', 'Plancha', 'Burpee']
const emom = (o = {}) => ({tipo: 'emom', minutos: 12, ejercicios: SEIS, ...o})
const min = segs => segs.filter(s => /^(Min|Intervalo) /.test(s.l))

test('EMOM 12 min con 6 ejercicios: uno por minuto, dos vueltas', () => {
  const s = armarSegmentos(emom())
  assert.equal(s.length, 1 + 12)
  assert.equal(duracionTotal(s), PREVIO + 720, 'mismo tiempo que sin ejercicios')
  const m = min(s)
  assert.deepEqual(
    m.map(x => x.ej),
    [...SEIS, ...SEIS]
  )
  assert.ok(m.every(x => x.s === 60))
  assert.equal(m[0].l, 'Min 1/12')
  assert.equal(m[6].l, 'Min 7/12')
  assert.equal(m[6].ej, 'Swing', 'el minuto 7 vuelve al ejercicio 1')
})

test('«Preparate» avisa el primero y cada minuto avisa el siguiente; el último no tiene siguiente', () => {
  const s = armarSegmentos(emom()),
    m = min(s)
  assert.equal(s[0].sig, 'Swing')
  assert.equal(m[0].sig, 'Remo')
  assert.equal(m[5].sig, 'Swing', 'al terminar la vuelta 1, sigue el ejercicio 1')
  assert.equal(m[11].sig, undefined)
})

test('el reloj, en cada instante, dice el ejercicio correcto', () => {
  const s = armarSegmentos(emom())
  const en = seg => posicion(s, (PREVIO + seg) * 1000).seg.ej
  assert.equal(en(0), 'Swing')
  assert.equal(en(59), 'Swing')
  assert.equal(en(60), 'Remo')
  assert.equal(en(5 * 60 + 30), 'Burpee')
  assert.equal(en(6 * 60), 'Swing')
  assert.equal(en(11 * 60 + 59), 'Burpee')
})

test('sin ejercicios el EMOM queda igual que antes (solo cuenta minutos)', () => {
  for (const ejercicios of [undefined, [], ['', '', '']]) {
    const s = armarSegmentos(emom({ejercicios}))
    assert.equal(s.length, 13)
    assert.ok(min(s).every(x => x.ej === undefined && x.sig === undefined))
  }
  assert.equal(resumenReloj(emom({ejercicios: ['', '']})), '')
})

test('otras cantidades: 5 ejercicios en 12 min siguen rotando; 1 solo se repite; más ejercicios que minutos usan los primeros', () => {
  const c5 = min(armarSegmentos(emom({ejercicios: SEIS.slice(0, 5)}))).map(x => x.ej)
  assert.deepEqual(c5, ['Swing', 'Remo', 'Sentadilla', 'Push up', 'Plancha', 'Swing', 'Remo', 'Sentadilla', 'Push up', 'Plancha', 'Swing', 'Remo'])
  assert.deepEqual(
    new Set(min(armarSegmentos(emom({ejercicios: ['Swing']}))).map(x => x.ej)),
    new Set(['Swing'])
  )
  const muchos = Array.from({length: 20}, (_, i) => 'E' + (i + 1))
  const m = min(armarSegmentos(emom({minutos: 5, ejercicios: muchos})))
  assert.deepEqual(
    m.map(x => x.ej),
    ['E1', 'E2', 'E3', 'E4', 'E5']
  )
})

test('intervalo distinto de 60 s: rota igual y se llama «Intervalo»; los renglones en blanco no cuentan', () => {
  const s = armarSegmentos(emom({minutos: 6, intervalo: 90, ejercicios: ['A', '', 'B', '*', 'C']}))
  const m = min(s)
  assert.equal(m.length, 4)
  assert.equal(m[0].l, 'Intervalo 1/4')
  assert.deepEqual(
    m.map(x => x.ej),
    ['A', 'B', 'C', 'A'],
    'los * y los renglones vacíos no son ejercicios'
  )
  assert.ok(m.every(x => x.s === 90))
})

test('resumen del reloj del EMOM', () => {
  assert.equal(resumenReloj(emom()), '1 ejercicio por minuto × 12 min')
  assert.equal(resumenReloj(emom({minutos: 6, intervalo: 90})), '1 ejercicio cada 90 s × 4')
})

test('la sesión manual de 5 bloques ya trae el EMOM listo para rotar con sus 6 ejercicios', () => {
  const b = sesionManual5().bloques[2]
  assert.equal(b.tipo, 'emom')
  b.ejercicios = [...SEIS]
  assert.equal(min(armarSegmentos(b)).length, 12)
  assert.equal(min(armarSegmentos(b))[11].ej, 'Burpee')
})
