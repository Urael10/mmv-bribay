import test from 'node:test'
import assert from 'node:assert/strict'
import {SIN_DATO, hayDato, fmtVal, fmtSigno, plural, fechaDMA, nombreEjercicio} from '../src/domain/formato.js'

test('fmtVal: sin dato = «—», cero = «0», coma decimal', () => {
  for (const x of [null, undefined, '', NaN, 'abc']) assert.equal(fmtVal(x), SIN_DATO)
  assert.equal(fmtVal(0), '0')
  assert.equal(fmtVal('0'), '0')
  assert.equal(fmtVal(2500, {dec: 0}), '2500')
  assert.equal(fmtVal(72.45), '72,5')
  assert.equal(fmtVal(3, {dec: 0}), '3')
})

test('hayDato distingue cero de ausencia', () => {
  assert.equal(hayDato(0), true)
  assert.equal(hayDato(null), false)
  assert.equal(hayDato(undefined), false)
  assert.equal(hayDato(''), false)
})

test('fmtSigno: signo explícito y sin dato', () => {
  assert.equal(fmtSigno(1.2), '+1,2')
  assert.equal(fmtSigno(-0.5), '-0,5')
  assert.equal(fmtSigno(0), '0')
  assert.equal(fmtSigno(null), SIN_DATO)
})

test('plural: 1 sesión, 0 y 2 sesiones', () => {
  assert.equal(plural(1, 'sesión', 'sesiones'), '1 sesión')
  assert.equal(plural(0, 'sesión', 'sesiones'), '0 sesiones')
  assert.equal(plural(2, 'sesión', 'sesiones'), '2 sesiones')
})

test('fechaDMA: ISO a dd/mm/aaaa, sin romper otros textos', () => {
  assert.equal(fechaDMA('2026-11-02'), '02/11/2026')
  assert.equal(fechaDMA(null), '')
  assert.equal(fechaDMA('hoy'), 'hoy')
})

test('nombreEjercicio: limpia signos sueltos sin tocar abreviaturas', () => {
  assert.equal(nombreEjercicio('  50 plancha + tr.? '), '50 plancha + tr.')
  assert.equal(nombreEjercicio('Sentadilla*'), 'Sentadilla')
  assert.equal(nombreEjercicio('?? remo ,'), 'remo')
  assert.equal(nombreEjercicio('Press  banca'), 'Press banca')
  assert.equal(nombreEjercicio('???'), '???') // nada que mostrar: no deja el nombre vacío
  assert.equal(nombreEjercicio(null), '')
})

test('nombreEjercicio no modifica el valor original (cadenas inmutables)', () => {
  const orig = '50 plancha + tr.?'
  nombreEjercicio(orig)
  assert.equal(orig, '50 plancha + tr.?')
})
