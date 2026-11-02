// Entrega 9 (datos): migración v7 → v8 (tabla rutinas), registros con campos nuevos y backup de ida y vuelta.
// Necesita fake-indexeddb (npm ci).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import {rutinaDesdeSesion, fusionarRutina} from '../src/domain/entreno.js'

const mem = {}
globalThis.localStorage = {
  getItem: k => mem[k] ?? null,
  setItem: (k, v) => (mem[k] = String(v)),
  removeItem: k => delete mem[k]
}

test('migración v7 → v8: aparece la tabla rutinas, no se pierde nada y el backup la incluye', async () => {
  const viejo = new Dexie('mv')
  viejo.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
  viejo.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
  viejo.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'})
  viejo.version(4).stores({coach: '&semana'})
  viejo.version(5).stores({alimentos: '++id,&clave,fuenteId', plantillas: '++id,&clave'})
  viejo.version(6).stores({medidas: 'fecha'})
  viejo.version(7).stores({tests: '++id,fecha,clave'})
  await viejo.open()
  await viejo.tests.add({fecha: '2026-11-01', clave: 'plancha', valor: 80})
  await viejo.sesiones.add({fecha: '2026-11-01', rpe: 7, bloques: [{tipo: 'emom', ejercicios: ['Swing']}]})
  await viejo.plantillas.add({nombre: 'Desayuno', clave: 'desayuno', momento: 'desayuno', items: []})
  viejo.close()

  const {db} = await import('../src/data/db.js')
  await db.open()
  assert.equal((await db.tests.toArray())[0].valor, 80)
  assert.equal(await db.sesiones.count(), 1)
  assert.equal(await db.plantillas.count(), 1) // las comidas guardadas siguen aparte de las rutinas
  assert.ok(db.tables.some(t => t.name === 'rutinas'))

  const bloques = [{tipo: 'emom', minutos: 12, ejercicios: ['Sentadilla', 'Remo*']}]
  await db.rutinas.add(rutinaDesdeSesion('Lunes fuerza', bloques))
  const otra = rutinaDesdeSesion('lunes FUERZA', [{tipo: 'amrap', ejercicios: ['Swing']}])
  await assert.rejects(() => db.rutinas.add(otra), 'la clave es única: no se duplican nombres')
  const ya = await db.rutinas.where('clave').equals(otra.clave).first()
  await db.rutinas.put(fusionarRutina(otra, ya))
  assert.equal(await db.rutinas.count(), 1)
  assert.equal((await db.rutinas.toArray())[0].bloques[0].ejercicios[0], 'Swing')

  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  const b = await armarBackup()
  assert.equal(b.rutinas.length, 1)
  await db.rutinas.clear()
  await restaurar(JSON.parse(JSON.stringify(b)))
  assert.equal((await db.rutinas.toArray())[0].nombre, 'lunes FUERZA')
})

test('registros con serie pesada, RPE de bloque y video se guardan sin cambiar el esquema', async () => {
  const {db} = await import('../src/data/db.js')
  await db.registros.add({
    fecha: '2026-11-01',
    clave: 'sentadilla',
    tipo: 'emom',
    kg: 80,
    reps: 8,
    pkg: 100,
    preps: 3,
    rpeBloque: 8,
    video: true
  })
  const r = await db.registros.where('clave').equals('sentadilla').first()
  assert.deepEqual([r.pkg, r.preps, r.rpeBloque, r.video], [100, 3, 8, true])
})
