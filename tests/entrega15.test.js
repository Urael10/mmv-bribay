// Entrega 15 (PZ10): sesión manual con los 5 bloques de la clase.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sesionManual5,
  podarBloquesVacios,
  estructuraSesion,
  rutinaDesdeSesion,
  ordenEntrada
} from '../src/domain/entreno.js'
import {armarSegmentos, resumenReloj, duracionTotal} from '../src/domain/temporizador.js'

test('los 5 bloques: tipos y minutos de tu clase, ejercicios en blanco', () => {
  const {bloques} = sesionManual5()
  assert.deepEqual(
    bloques.map(b => b.tipo),
    ['movilidad', 'warmup', 'emom', 'forTime', 'tabata']
  )
  assert.deepEqual(
    bloques.map(b => b.minutos),
    [4, 4, 12, 10, 4]
  )
  assert.deepEqual(
    bloques.map(b => b.ejercicios.length),
    [3, 3, 6, 3, 2]
  )
  for (const b of bloques) assert.ok(b.ejercicios.every(e => e === ''), 'no se inventa ningún ejercicio')
  assert.equal(JSON.stringify(sesionManual5()).match(/"(kg|reps|reg)"/), null, 'sin pesos ni repeticiones')
})

test('cada llamada da una sesión nueva (no se comparten listas entre sesiones)', () => {
  const a = sesionManual5(),
    b = sesionManual5()
  a.bloques[0].ejercicios[0] = 'Cat camel'
  assert.equal(b.bloques[0].ejercicios[0], '')
  assert.notEqual(a.bloques[0].ejercicios, b.bloques[0].ejercicios)
})

test('el reloj de cada bloque funciona aun sin escribir los ejercicios', () => {
  const [mov, wu, emom, ft, tab] = sesionManual5().bloques
  assert.equal(resumenReloj(mov), '40 s × 6')
  assert.equal(resumenReloj(wu), '40 s × 6')
  assert.equal(armarSegmentos(mov).length, 1 + 6)
  assert.equal(duracionTotal(armarSegmentos(mov)), 5 + 240, 'Preparate + 4 min')
  const e = armarSegmentos(emom)
  assert.equal(e.length, 1 + 12, 'EMOM 12 min: 12 intervalos de 60 s')
  assert.ok(e.slice(1).every(x => x.s === 60))
  const f = armarSegmentos(ft)
  assert.equal(f[1].s, 600, 'For time con tope de 10 min')
  assert.equal(f[1].sube, true)
  assert.equal(resumenReloj(tab), '20/10 × 8 rondas')
  assert.equal(duracionTotal(armarSegmentos(tab)), 5 + 8 * 30)
})

test('al escribir los ejercicios, el reloj los usa (4 ejercicios de movilidad = 8 intervalos; Tabata alterna 2)', () => {
  const s = sesionManual5()
  s.bloques[0].ejercicios = ['Cat camel', 'Puente', 'Bisagra', 'Rotación']
  assert.equal(resumenReloj(s.bloques[0]), '40 s × 8')
  s.bloques[4].ejercicios = ['Burpee', 'Mountain climber']
  const t = armarSegmentos(s.bloques[4]).filter(x => x.ej)
  assert.deepEqual(
    t.map(x => x.ej),
    ['Burpee', 'Mountain climber', 'Burpee', 'Mountain climber', 'Burpee', 'Mountain climber', 'Burpee', 'Mountain climber']
  )
})

test('al guardar: se van los bloques vacíos y los huecos del final; los del medio se conservan', () => {
  const s = sesionManual5()
  s.bloques[0].ejercicios = ['Cat camel', '', 'Puente'] // hueco en el medio: se queda (los registros van por posición)
  s.bloques[2].ejercicios = ['Swing', 'Remo', '', '', '', '']
  s.bloques[3].rondas = '3' // sin ejercicios pero con resultado: se queda
  const p = podarBloquesVacios(s.bloques)
  assert.deepEqual(
    p.map(b => b.tipo),
    ['movilidad', 'emom', 'forTime']
  )
  assert.deepEqual(p[0].ejercicios, ['Cat camel', '', 'Puente'])
  assert.deepEqual(p[1].ejercicios, ['Swing', 'Remo'])
  assert.deepEqual(p[2].ejercicios, [])
  assert.equal(s.bloques[2].ejercicios.length, 6, 'no modifica la sesión original')
  assert.deepEqual(podarBloquesVacios(sesionManual5().bloques), [])
  assert.deepEqual(podarBloquesVacios(null), [])
})

test('sin ejercicios no se puede guardar como plantilla; con ejercicios sí, y copia solo la estructura', () => {
  assert.throws(() => rutinaDesdeSesion('Mi clase', sesionManual5().bloques), /ejercicios/)
  const s = sesionManual5()
  s.bloques[2].ejercicios[0] = 'Swing'
  s.bloques[2].reg = {0: {kg: 14, reps: 40}}
  const r = rutinaDesdeSesion('Mi clase', s.bloques)
  assert.equal(r.bloques.length, 1)
  assert.equal(r.bloques[0].reg, undefined)
  assert.equal(estructuraSesion(s.bloques).bloques[2].reg, undefined)
})

test('«manual» sigue contando como entrada de pizarra para ordenar las opciones de Entreno', () => {
  assert.deepEqual(ordenEntrada('manual'), ['pizarra', 'ultima', 'plantillas'])
})
