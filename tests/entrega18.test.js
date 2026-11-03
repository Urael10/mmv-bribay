// Entrega 18: biblioteca de ejercicios (agregar, renombrar, elegir) y bloques plegables.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nombreBase,
  renombrarTexto,
  validarNombre,
  renombrarEnBloques,
  nombresDeSesiones,
  filtrarBiblioteca,
  agregarEjercicio,
  resumenBloque
} from '../src/domain/biblioteca.js'
import {claveEjercicio} from '../src/domain/entreno.js'

test('nombre base y renombrar texto: se conserva la cantidad del principio y los * / ? del final', () => {
  assert.equal(nombreBase('10 lagartijas*'), 'lagartijas')
  assert.equal(nombreBase('  Swing   rusos? '), 'Swing rusos')
  assert.equal(nombreBase('Remo'), 'Remo')
  assert.equal(renombrarTexto('10 lagartijas*', 'Push up'), '10 Push up*')
  assert.equal(renombrarTexto('3x10 swing', 'Swing ruso'), '3x10 Swing ruso')
  assert.equal(renombrarTexto('Remo?', 'Remo con mancuerna'), 'Remo con mancuerna?')
  assert.equal(renombrarTexto('Plancha', 'Plancha lateral'), 'Plancha lateral')
})

test('validar nombre: vacío, solo números, largo, repetido (error al agregar, fusión al renombrar)', () => {
  const claves = new Set(['swing', 'remo'])
  assert.equal(validarNombre('   ', claves).ok, false)
  assert.equal(validarNombre('123', claves).ok, false)
  assert.equal(validarNombre('x'.repeat(61), claves).ok, false)
  const rep = validarNombre('SWING*', claves)
  assert.equal(rep.ok, false)
  assert.match(rep.error, /ya está/)
  const ok = validarNombre('  Press   banca ', claves)
  assert.deepEqual([ok.ok, ok.nombre, ok.clave, ok.fusiona], [true, 'Press banca', 'press banca', false])
  const mismo = validarNombre('SWING', claves, {claveActual: 'swing'}) // cambiar solo mayúsculas del propio ejercicio
  assert.deepEqual([mismo.ok, mismo.fusiona], [true, false])
  const fus = validarNombre('Remo', claves, {claveActual: 'swing', fusionar: true})
  assert.deepEqual([fus.ok, fus.fusiona], [true, true])
})

test('renombrar en bloques: solo ese ejercicio, conserva cantidades y marcas, no toca lo anotado', () => {
  const bloques = [
    {tipo: 'amrap', ejercicios: ['10 Lagartijas*', 'Remo', 'lagartijas'], reg: {0: {kg: 0, reps: 10}}},
    {tipo: 'emom', ejercicios: ['Swing']}
  ]
  const r = renombrarEnBloques(bloques, claveEjercicio('lagartijas'), 'Push up')
  assert.equal(r.n, 2)
  assert.deepEqual(r.bloques[0].ejercicios, ['10 Push up*', 'Remo', 'Push up'])
  assert.deepEqual(r.bloques[0].reg, {0: {kg: 0, reps: 10}})
  assert.equal(r.bloques[1], bloques[1], 'el bloque sin ese ejercicio es el mismo objeto')
  assert.deepEqual(bloques[0].ejercicios, ['10 Lagartijas*', 'Remo', 'lagartijas'], 'no modifica el original')
  assert.equal(renombrarEnBloques(null, 'x', 'y').n, 0)
})

test('nombres de sesiones: el más reciente primero, sin repetir, limpios', () => {
  const ses = [
    {id: 1, fecha: '2026-11-01', bloques: [{ejercicios: ['10 swing*', 'Cat camel']}]},
    {id: 2, fecha: '2026-11-02', bloques: [{ejercicios: ['Swing', '', 'Puente']}]}
  ]
  const rut = [{bloques: [{ejercicios: ['Remo', 'cat camel']}]}]
  const n = nombresDeSesiones(ses, rut)
  assert.deepEqual(n.map(x => x.clave), ['swing', 'puente', 'cat camel', 'remo'])
  assert.equal(n[0].nombre, 'Swing', 'gana la escritura más reciente')
  assert.equal(n[2].nombre, 'Cat camel')
})

test('buscar en la biblioteca: sin acentos ni mayúsculas, por palabras, ordenado', () => {
  const l = [{nombre: 'Sentadilla búlgara'}, {nombre: 'Remo'}, {nombre: 'Press de hombro'}, {nombre: 'Elevación lateral'}]
  assert.deepEqual(filtrarBiblioteca(l, 'bulgara').map(x => x.nombre), ['Sentadilla búlgara'])
  assert.deepEqual(filtrarBiblioteca(l, 'ELEVACION lat').map(x => x.nombre), ['Elevación lateral'])
  assert.deepEqual(filtrarBiblioteca(l, 'de ho').map(x => x.nombre), ['Press de hombro'])
  assert.deepEqual(filtrarBiblioteca(l, '').map(x => x.nombre), ['Elevación lateral', 'Press de hombro', 'Remo', 'Sentadilla búlgara'])
  assert.deepEqual(filtrarBiblioteca(l, 'zzz'), [])
})

test('agregar ejercicio a un bloque: ocupa el primer lugar en blanco o va al final', () => {
  assert.deepEqual(agregarEjercicio({ejercicios: ['A', '', '']}, ' Remo ').ejercicios, ['A', 'Remo', ''])
  assert.deepEqual(agregarEjercicio({ejercicios: ['A', 'B']}, 'Remo').ejercicios, ['A', 'B', 'Remo'])
  assert.deepEqual(agregarEjercicio({}, 'Remo').ejercicios, ['Remo'])
  const b = {ejercicios: ['A']}
  assert.equal(agregarEjercicio(b, '  '), b)
})

test('resumen de bloque plegado: ejercicios y cuántos tienen carga', () => {
  assert.deepEqual(resumenBloque({minutos: 12, ejercicios: ['A', '', 'C'], reg: {0: {kg: 10, reps: 5}, 1: {kg: 9, reps: 9}}}), {
    n: 2,
    cargados: 1,
    minutos: 12
  })
  assert.deepEqual(resumenBloque({ejercicios: []}), {n: 0, cargados: 0, minutos: null})
  assert.deepEqual(resumenBloque(undefined), {n: 0, cargados: 0, minutos: null})
})
