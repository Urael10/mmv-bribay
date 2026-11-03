// Entrega 18: biblioteca con IndexedDB simulada (renombrar actualiza el historial, fusionar, sincronizar, borrar).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'

const mem = {}
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => mem[k] ?? null,
    setItem: (k, v) => {
      mem[k] = String(v)
    },
    removeItem: k => {
      delete mem[k]
    }
  }
})
const {db} = await import('../src/data/db.js')
const B = await import('../src/data/biblioteca.js')

test('sincronizar completa la biblioteca con los nombres de tus sesiones y plantillas, sin repetir', async () => {
  await db.open()
  await db.sesiones.add({fecha: '2026-11-01', bloques: [{tipo: 'movilidad', ejercicios: ['Cat camel', 'Puente']}]})
  await db.rutinas.add({nombre: 'Mi clase', clave: 'mi clase', bloques: [{tipo: 'emom', ejercicios: ['Swing*', 'cat camel']}]})
  await db.ejercicios.put({clave: 'swing', nombre: 'Swing', patron: 'Cadera'})
  assert.equal(await B.sincronizar(), 2, 'Cat camel y Puente; Swing ya estaba')
  assert.equal(await B.sincronizar(), 0, 'idempotente')
  const l = await B.listar()
  assert.deepEqual(l.map(e => e.clave).sort(), ['cat camel', 'puente', 'swing'])
  assert.equal(l.find(e => e.clave === 'swing').patron, 'Cadera', 'no pisa lo que ya había')
})

test('agregar: valida, no repite y guarda patrón y «un lado por vez»', async () => {
  const f = await B.agregar({nombre: '  Press   militar* ', patron: 'Empuje', uni: true})
  assert.deepEqual(f, {clave: 'press militar', nombre: 'Press militar', patron: 'Empuje', uni: true})
  await assert.rejects(() => B.agregar({nombre: 'PRESS MILITAR'}), /ya está/)
  await assert.rejects(() => B.agregar({nombre: '  '}), /nombre/)
  const g = await B.agregar({nombre: 'Zancada', patron: 'inventado'})
  assert.equal(g.patron, undefined, 'un patrón que no existe se ignora')
})

test('registrar nombres al guardar una sesión: agrega los que faltan aunque no lleven carga', async () => {
  const n = await B.registrarNombres([{ejercicios: ['10 Burpee*', 'Swing', '']}, {ejercicios: ['burpee']}])
  assert.equal(n, 1)
  assert.equal((await db.ejercicios.get('burpee')).nombre, 'Burpee')
  assert.equal(await B.registrarNombres([]), 0)
})

test('renombrar: actualiza ejercicios, registros, sesiones, plantillas y la sesión en curso', async () => {
  await db.ejercicios.put({clave: 'remo', nombre: 'Remo'}) // en la app, cada ejercicio con registros tiene su fila
  await db.registros.bulkAdd([
    {fecha: '2026-10-30', clave: 'swing', nombre: 'Swing*', kg: 14, reps: 40},
    {fecha: '2026-11-01', clave: 'swing', nombre: '20 Swing', kg: 14, reps: 20},
    {fecha: '2026-11-01', clave: 'remo', nombre: 'Remo', kg: 20, reps: 10}
  ])
  await db.sesiones.add({fecha: '2026-11-02', bloques: [{tipo: 'emom', ejercicios: ['Swing*', 'Remo'], reg: {0: {kg: 14, reps: 30}}}]})
  mem.mv_sesion = JSON.stringify({bloques: [{tipo: 'amrap', ejercicios: ['swing', '']}], revisar: false})
  const r = await B.renombrar('swing', 'Swing ruso')
  assert.deepEqual([r.clave, r.nombre, r.registros, r.enCurso, r.fusiona], ['swing ruso', 'Swing ruso', 2, 1, false])
  assert.ok(r.sesiones >= 1 && r.plantillas === 1)
  assert.equal(await db.ejercicios.get('swing'), undefined, 'la clave vieja desaparece')
  const nuevo = await db.ejercicios.get('swing ruso')
  assert.deepEqual([nuevo.nombre, nuevo.patron], ['Swing ruso', 'Cadera'], 'conserva el patrón')
  const regs = await db.registros.where('clave').equals('swing ruso').toArray()
  assert.deepEqual(regs.map(x => x.nombre).sort(), ['20 Swing ruso', 'Swing ruso*'], 'cantidad y marca se conservan')
  assert.equal((await db.registros.where('clave').equals('swing').count()), 0)
  assert.equal((await db.registros.where('clave').equals('remo').count()), 1, 'otros ejercicios no se tocan')
  const ses = (await db.sesiones.toArray()).find(s => s.fecha === '2026-11-02')
  assert.deepEqual(ses.bloques[0].ejercicios, ['Swing ruso*', 'Remo'])
  assert.deepEqual(ses.bloques[0].reg, {0: {kg: 14, reps: 30}}, 'lo anotado queda donde estaba')
  assert.equal((await db.rutinas.toArray())[0].bloques[0].ejercicios[0], 'Swing ruso*')
  assert.deepEqual(JSON.parse(mem.mv_sesion).bloques[0].ejercicios, ['Swing ruso', ''])
})

test('renombrar sobre un nombre que ya existe: pide fusionar y, al fusionar, junta el historial', async () => {
  await assert.rejects(() => B.renombrar('burpee', 'Remo'), /ya está/)
  const r = await B.renombrar('burpee', 'Remo', {fusionar: true})
  assert.equal(r.fusiona, true)
  assert.equal(await db.ejercicios.get('burpee'), undefined)
  assert.equal((await db.ejercicios.get('remo')).nombre, 'Remo')
  await assert.rejects(() => B.renombrar('remo', ''), /nombre/)
})

test('cambiar solo mayúsculas del propio ejercicio funciona (misma clave)', async () => {
  const r = await B.renombrar('puente', 'PUENTE glúteo'.replace(' glúteo', ''))
  assert.equal(r.clave, 'puente')
  assert.equal((await db.ejercicios.get('puente')).nombre, 'PUENTE')
})

test('patrón y un lado por vez: se cambian y se pueden volver a automático', async () => {
  await B.cambiarPatron('remo', 'Tirón')
  assert.equal((await db.ejercicios.get('remo')).patron, 'Tirón')
  await B.cambiarPatron('remo', 'auto')
  assert.equal((await db.ejercicios.get('remo')).patron, undefined)
  await B.cambiarUni('remo', true)
  assert.equal((await db.ejercicios.get('remo')).uni, true)
  await B.cambiarUni('remo', false)
  assert.equal((await db.ejercicios.get('remo')).uni, undefined)
  await B.cambiarPatron('no existe', 'Empuje') // no hace nada
})

test('borrar saca solo la fila de la biblioteca: los registros quedan', async () => {
  const antes = await db.registros.count()
  await B.borrar('remo')
  assert.equal(await db.ejercicios.get('remo'), undefined)
  assert.equal(await db.registros.count(), antes)
})
