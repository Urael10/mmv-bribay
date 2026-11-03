// Entrega 17: cambiar el orden de los ejercicios de un bloque (el reloj del EMOM sigue el nuevo orden).
import test from 'node:test'
import assert from 'node:assert/strict'
import {armarSegmentos} from '../src/domain/temporizador.js'
import {moverEjercicio, sesionManual5, podarBloquesVacios} from '../src/domain/entreno.js'

const SEIS = ['Swing', 'Remo', 'Sentadilla', 'Push up', 'Plancha', 'Burpee']

test('cambiar el orden en un EMOM: el reloj sigue el nuevo orden en las 2 vueltas', () => {
  let b = {tipo: 'emom', minutos: 12, ejercicios: SEIS}
  b = moverEjercicio(b, 0, 1) // Swing baja una posición
  assert.deepEqual(b.ejercicios.slice(0, 3), ['Remo', 'Swing', 'Sentadilla'])
  const s = armarSegmentos(b)
  assert.equal(s[0].sig, 'Remo', '«Primero» ya es el nuevo primero')
  assert.deepEqual(s.slice(1, 4).map(x => x.ej), ['Remo', 'Swing', 'Sentadilla'])
  assert.equal(s[7].ej, 'Remo', 'la segunda vuelta también')
})

test('mover varias veces: sube hasta el principio y baja hasta el final', () => {
  let b = {ejercicios: ['A', 'B', 'C', 'D']}
  for (let i = 3; i > 0; i--) b = moverEjercicio(b, i, -1)
  assert.deepEqual(b.ejercicios, ['D', 'A', 'B', 'C'])
  for (let i = 0; i < 3; i++) b = moverEjercicio(b, i, 1)
  assert.deepEqual(b.ejercicios, ['A', 'B', 'C', 'D'])
})

test('mover un ejercicio lleva consigo lo que anotaste (los registros van por posición)', () => {
  const b = {tipo: 'emom', ejercicios: ['A', 'B', 'C'], reg: {0: {kg: 10, reps: 5}, 2: {kg: 30, reps: 7}}}
  const m = moverEjercicio(b, 2, -1)
  assert.deepEqual(m.ejercicios, ['A', 'C', 'B'])
  assert.deepEqual(m.reg, {0: {kg: 10, reps: 5}, 1: {kg: 30, reps: 7}}, 'B no tenía registro: no se inventa uno')
  assert.deepEqual(b.ejercicios, ['A', 'B', 'C'], 'no modifica el bloque original')
  assert.deepEqual(b.reg[2], {kg: 30, reps: 7})
  const swap = moverEjercicio({ejercicios: ['A', 'B'], reg: {0: {kg: 1}, 1: {kg: 2}}}, 0, 1)
  assert.deepEqual(swap.reg, {0: {kg: 2}, 1: {kg: 1}})
})

test('mover: límites y valores raros no hacen nada', () => {
  const b = {ejercicios: ['A', 'B']}
  assert.equal(moverEjercicio(b, 0, -1), b)
  assert.equal(moverEjercicio(b, 1, 1), b)
  assert.equal(moverEjercicio(b, 5, 1), b)
  assert.equal(moverEjercicio(b, 0, 2), b)
  assert.equal(moverEjercicio(b, '0', 1), b)
  assert.deepEqual(moverEjercicio(b, 0, 1).ejercicios, ['B', 'A'])
  assert.equal(moverEjercicio(undefined, 0, 1), undefined)
})

test('en la sesión manual: escribir, reordenar y guardar conserva el orden y los resultados', () => {
  const s = sesionManual5()
  s.bloques[2].ejercicios = [...SEIS]
  s.bloques[2].reg = {5: {kg: 0, reps: 12}}
  s.bloques[2] = moverEjercicio(s.bloques[2], 5, -1) // Burpee sube
  const p = podarBloquesVacios(s.bloques)
  assert.deepEqual(p.map(b => b.tipo), ['emom'])
  assert.equal(p[0].ejercicios[4], 'Burpee')
  assert.deepEqual(p[0].reg[4], {kg: 0, reps: 12})
})
