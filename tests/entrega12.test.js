// Entrega 12: el reloj dice qué ejercicio toca (Tabata alterna) y Movilidad / Warm up tienen reloj por ejercicio.
// Lógica pura: no necesita base de datos ni navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  armarSegmentos,
  duracionTotal,
  posicion,
  aviso,
  resumenReloj,
  nombresEj,
  CON_RELOJ,
  PREVIO
} from '../src/domain/temporizador.js'

const trabajo = segs => segs.filter(s => /^(Ejercicio|Trabajo) /.test(s.l))

test('movilidad y warm up tienen reloj', () => {
  assert.ok(CON_RELOJ.includes('movilidad'))
  assert.ok(CON_RELOJ.includes('warmup'))
})

test('Tabata con 2 ejercicios: se alternan en las 8 rondas de trabajo', () => {
  const s = armarSegmentos({tipo: 'tabata', ejercicios: ['Plancha iso', 'Mountain climbers']})
  assert.equal(s.length, 17) // igual que sin ejercicios
  assert.equal(duracionTotal(s), PREVIO + 240)
  const t = trabajo(s)
  assert.deepEqual(
    t.map(x => x.ej),
    ['Plancha iso', 'Mountain climbers', 'Plancha iso', 'Mountain climbers', 'Plancha iso', 'Mountain climbers', 'Plancha iso', 'Mountain climbers']
  )
  assert.equal(s[0].sig, 'Plancha iso') // «Preparate»: primero toca el ejercicio 1
  assert.equal(t[0].sig, 'Mountain climbers')
  assert.equal(t[7].sig, undefined) // en la última ronda no hay «sigue»
  assert.equal(s[2].l, 'Descanso')
  assert.equal(s[2].sig, 'Mountain climbers') // durante el descanso se avisa cuál sigue
  assert.equal(s[16].sig, undefined) // el último descanso no tiene siguiente
})

test('Tabata con 4 ejercicios: cada uno dos veces, en orden', () => {
  const s = armarSegmentos({tipo: 'tabata', ejercicios: ['A', 'B', 'C', 'D']})
  assert.deepEqual(
    trabajo(s).map(x => x.ej),
    ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']
  )
})

test('Tabata sin ejercicios: segmentos idénticos a los de antes (sin ej ni sig)', () => {
  const s = armarSegmentos({tipo: 'tabata'})
  assert.equal(s.length, 17)
  for (const x of s) assert.deepEqual(Object.keys(x).filter(k => k === 'ej' || k === 'sig'), [])
  assert.equal(s[1].l, 'Trabajo 1/8')
})

test('Tabata con una sola ronda de trabajo editable respeta rondas y tiempos', () => {
  const s = armarSegmentos({tipo: 'tabata', trab: 30, desc: 15, rond: 4, ejercicios: ['A', 'B']})
  assert.equal(duracionTotal(s), PREVIO + 4 * 45)
  assert.deepEqual(
    trabajo(s).map(x => x.ej),
    ['A', 'B', 'A', 'B']
  )
})

test('Movilidad con 3 ejercicios: 40 s × 6 (2 vueltas), sin pausas', () => {
  const s = armarSegmentos({tipo: 'movilidad', minutos: 5, ejercicios: ['Gato-camello', 'Rotación torácica', 'Puente']})
  const t = trabajo(s)
  assert.equal(t.length, 6)
  assert.ok(t.every(x => x.s === 40))
  assert.equal(s.length, 1 + 6) // previo + 6, sin cambios
  assert.equal(duracionTotal(s), PREVIO + 240)
  assert.deepEqual(
    t.map(x => x.ej),
    ['Gato-camello', 'Rotación torácica', 'Puente', 'Gato-camello', 'Rotación torácica', 'Puente']
  )
  assert.equal(t[0].l, 'Ejercicio 1/6')
  assert.equal(t[5].sig, undefined)
  assert.equal(resumenReloj({tipo: 'movilidad', ejercicios: ['a', 'b', 'c']}), '40 s × 6')
})

test('Warm up con 4 ejercicios: 40 s × 8', () => {
  const b = {tipo: 'warmup', ejercicios: ['A', 'B', 'C', 'D']}
  assert.equal(trabajo(armarSegmentos(b)).length, 8)
  assert.equal(resumenReloj(b), '40 s × 8')
  assert.equal(duracionTotal(armarSegmentos(b)), PREVIO + 8 * 40)
})

test('Warm up editable: segundos, vueltas y cambio entre ejercicios', () => {
  const s = armarSegmentos({tipo: 'warmup', trab: 30, vueltas: 3, desc: 5, ejercicios: ['A', 'B']})
  const t = trabajo(s)
  assert.equal(t.length, 6)
  assert.equal(t[0].s, 30)
  assert.equal(s.filter(x => x.l === 'Cambio').length, 5) // entre intervalos, no después del último
  assert.equal(duracionTotal(s), PREVIO + 6 * 30 + 5 * 5)
  assert.equal(s[2].l, 'Cambio')
  assert.equal(s[2].sig, 'B')
})

test('Warm up sin ejercicios cargados: 6 intervalos de 40 s, sin nombres', () => {
  const s = armarSegmentos({tipo: 'warmup', ejercicios: ['', '  ']})
  assert.equal(trabajo(s).length, 6)
  assert.ok(trabajo(s).every(x => x.ej === undefined))
  assert.equal(armarSegmentos({tipo: 'movilidad'}).length, 7)
})

test('valores inválidos usan los de siempre y las vueltas tienen tope', () => {
  const s = armarSegmentos({tipo: 'warmup', trab: -5, vueltas: 'x', desc: 'abc', ejercicios: ['A', 'B', 'C']})
  assert.equal(trabajo(s).length, 6)
  assert.equal(trabajo(s)[0].s, 40)
  assert.equal(s.filter(x => x.l === 'Cambio').length, 0)
  assert.equal(trabajo(armarSegmentos({tipo: 'warmup', vueltas: 9999, ejercicios: ['A']})).length, 10)
})

test('los * y ? no aparecen en los nombres del reloj', () => {
  assert.deepEqual(nombresEj({ejercicios: ['Remo uni*', ' Press  militar ? ', '', null]}), ['Remo uni', 'Press militar'])
  assert.deepEqual(nombresEj({}), [])
  assert.deepEqual(nombresEj(null), [])
})

test('al pasar de un ejercicio al otro suena el aviso de cambio', () => {
  const s = armarSegmentos({tipo: 'movilidad', ejercicios: ['A', 'B', 'C']})
  const a = posicion(s, (PREVIO + 39) * 1000),
    b = posicion(s, (PREVIO + 40) * 1000)
  assert.equal(a.seg.ej, 'A')
  assert.equal(b.seg.ej, 'B')
  assert.equal(aviso(a, b), 'cambio')
  assert.equal(posicion(s, (PREVIO + 240) * 1000).fin, true)
})

test('resumenReloj: Tabata y bloques sin reloj por intervalos', () => {
  assert.equal(resumenReloj({tipo: 'tabata'}), '20/10 × 8 rondas')
  assert.equal(resumenReloj({tipo: 'tabata', trab: 30, desc: 15, rond: 6}), '30/15 × 6 rondas')
  assert.equal(resumenReloj({tipo: 'emom'}), '')
  assert.equal(resumenReloj(null), '')
})
