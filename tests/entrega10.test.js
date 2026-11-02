// Entrega 10: Comidas simples (comí algo parecido a…, estimación rápida, meta de proteína). Lógica pura.
import test from 'node:test'
import assert from 'node:assert/strict'
import {firmaComida, comidasParecidas, itemsDeComida, itemRapido, faltaProteina} from '../src/domain/registro.js'
import {totales} from '../src/domain/alimentos.js'
import {sumaDias} from '../src/domain/stats.js'

const HOY = '2026-11-02'
const d = n => sumaDias(HOY, n)
const it = (nombre, g, kcal100, p100, alimentoId = null) => ({
  alimentoId,
  nombre,
  g,
  b: {kcal100, p100, c100: 0, g100: 0},
  kcal: (kcal100 * g) / 100,
  p: (p100 * g) / 100,
  c: 0,
  gr: 0,
  origen: 'manual'
})
const com = (id, dias, momento, items) => ({id, fecha: d(dias), hora: '08:00', momento, items})
const desayuno = g => [it('Avena', g, 380, 13, 1), it('Leche', 200, 60, 3.3, 2)]

test('firma de una comida: depende de los alimentos, no de los gramos ni del orden', () => {
  const a = com(1, -1, 'desayuno', desayuno(40)),
    b = com(2, -2, 'desayuno', [...desayuno(60)].reverse())
  assert.equal(firmaComida(a), firmaComida(b))
  assert.notEqual(firmaComida(a), firmaComida(com(3, -1, 'desayuno', [it('Pan', 50, 250, 8)])))
  assert.equal(firmaComida({items: []}), '')
})

test('comidas parecidas: ordena por frecuencia y momento, agrupa repetidas y descarta vacías y viejas', () => {
  const almuerzo = [it('Arroz', 150, 130, 2.7), it('Pollo', 120, 165, 31)]
  const hist = [
    com(1, -1, 'desayuno', desayuno(40)),
    com(2, -2, 'desayuno', desayuno(50)),
    com(3, -3, 'desayuno', desayuno(40)),
    com(4, -1, 'almuerzo', almuerzo),
    com(5, -4, 'almuerzo', []), // vacía
    com(6, -200, 'cena', [it('Pizza', 200, 270, 11)]) // fuera de los 90 días
  ]
  const P = comidasParecidas(hist, 'desayuno', {hoy: HOY})
  assert.equal(P.length, 2)
  assert.equal(P[0].veces, 3)
  assert.equal(P[0].comida.id, 1) // la ocurrencia más reciente
  assert.equal(P[0].nombre, 'Avena + Leche')
  assert.equal(P[1].nombre, 'Arroz + Pollo')
  // en el almuerzo, la comida del almuerzo pasa adelante si pesa más que la frecuencia
  const L = comidasParecidas([...hist, com(7, -2, 'almuerzo', almuerzo), com(8, -3, 'almuerzo', almuerzo)], 'almuerzo', {hoy: HOY})
  assert.equal(L[0].nombre, 'Arroz + Pollo')
  assert.deepEqual(comidasParecidas([], 'desayuno', {hoy: HOY}), [])
  assert.equal(comidasParecidas(hist, 'desayuno', {hoy: HOY, n: 1}).length, 1)
  assert.match(comidasParecidas([com(9, -1, 'cena', [it('A', 1, 1, 1), it('B', 1, 1, 1), it('C', 1, 1, 1)])], 'cena', {hoy: HOY})[0].nombre, /\+1$/)
})

test('cargar una comida anterior: usa los valores actuales de tu base si el alimento sigue existiendo', () => {
  const c = com(1, -1, 'desayuno', desayuno(40))
  const sinBase = itemsDeComida(c, [])
  assert.equal(sinBase.length, 2)
  assert.equal(sinBase[0].g, 40)
  assert.equal(Math.round(sinBase[0].kcal), 152)
  const base = [{id: 1, nombre: 'Avena', kcal100: 400, p100: 14, c100: 60, g100: 7, porcion: 40}]
  const conBase = itemsDeComida(c, base)
  assert.equal(Math.round(conBase[0].kcal), 160) // 400 × 0,4
  assert.equal(Math.round(conBase[1].kcal), 120) // la leche no está en la base: se usa lo guardado
  assert.deepEqual(itemsDeComida(undefined, []), [])
})

test('estimación rápida: valida, no necesita nombre ni proteína y calcula bien', () => {
  const x = itemRapido({kcal: '650', p: '35,5'})
  assert.equal(x.nombre, 'Estimado rápido')
  assert.equal(x.g, 100)
  assert.equal(x.kcal, 650)
  assert.equal(x.p, 35.5)
  assert.equal(x.origen, 'manual')
  assert.equal(x.estimado, true)
  assert.equal(x.alimentoId, null)
  assert.deepEqual(totales([x]), {kcal: 650, p: 35.5, c: 0, gr: 0})
  assert.equal(itemRapido({nombre: '  Asado  con   papas ', kcal: 800, p: ''}).nombre, 'Asado con papas')
  assert.equal(itemRapido({kcal: 300}).p, 0)
  assert.throws(() => itemRapido({kcal: ''}), /calorías/)
  assert.throws(() => itemRapido({kcal: '0'}), /calorías/)
  assert.throws(() => itemRapido({kcal: '6000'}), /calorías/)
  assert.throws(() => itemRapido({kcal: '500', p: '-5'}), /proteína/)
  assert.throws(() => itemRapido({kcal: '500', p: '400'}), /proteína/)
  assert.throws(() => itemRapido({kcal: '500', p: 'abc'}), /proteína/)
})

test('meta de proteína en Comidas: cuánto falta, porcentaje y meta cumplida', () => {
  assert.equal(faltaProteina(50, null), null)
  assert.equal(faltaProteina(50, 0), null)
  assert.deepEqual(faltaProteina(82, 130), {falta: 48, pct: 63, cumplida: false})
  assert.deepEqual(faltaProteina(140, 130), {falta: 0, pct: 100, cumplida: true})
  assert.deepEqual(faltaProteina(undefined, 130), {falta: 130, pct: 0, cumplida: false})
})
