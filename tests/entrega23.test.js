// Entrega 23 · Propuesta 3: lista única de atajos, uso de alimentos y filtros de «Mis alimentos».
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {atajosRecientes, usoDeAlimentos, listarAlimentos, MIN_FRECUENTE} from '../src/domain/registro.js'

const al = (id, nombre, extra = {}) => ({id, nombre, kcal100: 100, p100: 10, c100: 10, g100: 1, porcion: 100, ...extra})
const base = [al(1, 'Arroz'), al(2, 'Pollo'), al(3, 'Pan', {fuente: 'OFF'}), al(4, 'Avena')]
const sug = (id, nombre, g, puntaje) => ({k: 'a' + id, alimentoId: id, nombre, g, puntaje, item: {b: base[id - 1], origen: 'base'}})
const comida = items => ({fecha: '2026-11-01', momento: 'Almuerzo', items})
const it = (id, nombre, g) => ({alimentoId: id, nombre, g, b: base[id - 1], kcal: g, p: 0, origen: 'base'})

test('atajos: una sola lista, con kcal y gramos, máximo n', () => {
  const s = [1, 2, 3, 4].map((i, k) => sug(i, base[i - 1].nombre, 100, 10 - k))
  const r = atajosRecientes(s, [], base, {n: 3})
  assert.equal(r.length, 3)
  assert.deepEqual(r.map(x => x.nombre), ['Arroz', 'Pollo', 'Pan'])
  assert.ok(r.every(x => x.kcal === 100 && x.g === 100 && x.tipo === 'alimento'))
})
test('atajos: una comida de un solo alimento no se repite; la de varios sí aparece como comida', () => {
  const s = [sug(1, 'Arroz', 150, 5)]
  const parecidas = [
    {k: 'a1', nombre: 'Arroz', kcal: 150, p: 0, puntaje: 4, comida: comida([it(1, 'Arroz', 150)])},
    {k: 'a1|a2', nombre: 'Arroz + Pollo', kcal: 300, p: 0, puntaje: 9, comida: comida([it(1, 'Arroz', 150), it(2, 'Pollo', 150)])}
  ]
  const r = atajosRecientes(s, parecidas, base)
  assert.deepEqual(r.map(x => x.k), ['c:a1|a2', 'a1'])
  assert.equal(r[0].tipo, 'comida')
  assert.equal(r[0].g, 300)
  assert.equal(r[0].alimentos, 2)
})
test('atajos: entradas vacías no rompen', () => {
  assert.deepEqual(atajosRecientes(undefined, undefined, base), [])
})
test('uso de alimentos: última fecha y veces', () => {
  const u = usoDeAlimentos([
    {fecha: '2026-10-01', items: [{alimentoId: 1}]},
    {fecha: '2026-10-05', items: [{alimentoId: 1}, {alimentoId: 2}, {alimentoId: null}]}
  ])
  assert.deepEqual(u.get(1), {ult: '2026-10-05', veces: 2})
  assert.equal(u.get(2).veces, 1)
  assert.equal(u.size, 2)
})
test('Mis alimentos: orden por uso reciente y luego por nombre', () => {
  const u = usoDeAlimentos([
    {fecha: '2026-10-01', items: [{alimentoId: 2}]},
    {fecha: '2026-10-09', items: [{alimentoId: 4}]}
  ])
  assert.deepEqual(listarAlimentos(base, u).map(a => a.nombre), ['Avena', 'Pollo', 'Arroz', 'Pan'])
})
test('Mis alimentos: filtros frecuentes, propios y web; no modifica la base', () => {
  const cs = Array.from({length: MIN_FRECUENTE}, (_, i) => ({fecha: '2026-10-0' + (i + 1), items: [{alimentoId: 3}]}))
  const u = usoDeAlimentos(cs)
  const copia = JSON.stringify(base)
  assert.deepEqual(listarAlimentos(base, u, 'frecuentes').map(a => a.nombre), ['Pan'])
  assert.deepEqual(listarAlimentos(base, u, 'web').map(a => a.nombre), ['Pan'])
  assert.deepEqual(listarAlimentos(base, u, 'propios').map(a => a.nombre).sort(), ['Arroz', 'Avena', 'Pollo'])
  assert.equal(JSON.stringify(base), copia)
})
test('cabecera sin versión; barra inferior con íconos; el gesto de versión vive en Ajustes', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(!/etiqueta/.test(app.split('<header>')[1].split('</header>')[0]), 'la cabecera no muestra la versión')
  assert.ok(/<Icono n=\{ic\}/.test(app))
  const aj = readFileSync(new URL('../src/features/ajustes/Ajustes.jsx', import.meta.url), 'utf8')
  assert.ok(/onClick=\{onVersion\}/.test(aj))
})
