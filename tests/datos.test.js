// Pruebas de datos con IndexedDB simulada: migración de versiones anteriores y ida y vuelta del backup.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'

const mem = {mv_key: 'CLAVE-SECRETA', mv_meta: '3000', mv_sonido: '0'}
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

test('actualización desde la v0.5.0 (Dexie v4): no se pierde nada y aparecen las tablas nuevas', async () => {
  const viejo = new Dexie('mv')
  viejo.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
  viejo.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
  viejo.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'})
  viejo.version(4).stores({coach: '&semana'})
  await viejo.open()
  await viejo.habitos.put({fecha: '2026-10-31', agua: 1500, sueno: '7', calidad: 4})
  await viejo.comidas.add({fecha: '2026-10-31', kcal: 600})
  await viejo.alimentos.add({nombre: 'Avena', clave: 'avena'})
  await viejo.registros.add({fecha: '2026-10-31', clave: 'swing', kg: 14, reps: 40})
  viejo.close()

  const {db} = await import('../src/data/db.js')
  await db.open()
  assert.equal((await db.habitos.get('2026-10-31')).agua, 1500)
  assert.equal(await db.comidas.count(), 1)
  assert.equal((await db.alimentos.toArray())[0].clave, 'avena')
  assert.equal(await db.registros.count(), 1)
  assert.ok(
    db.tables.some(x => x.name === 'plantillas'),
    'existe la tabla plantillas'
  )
  assert.ok(db.table('alimentos').schema.idxByName.fuenteId, 'existe el índice fuenteId')
})

test('campos nuevos del registro (aguaLog, tiempo) se guardan sin cambiar el esquema', async () => {
  const {db} = await import('../src/data/db.js')
  await db.habitos.put({fecha: '2026-11-01', agua: 750, aguaLog: [250, 500]})
  await db.registros.add({fecha: '2026-11-01', clave: 'for time', kg: 0, reps: 25, tiempo: 462})
  assert.deepEqual((await db.habitos.get('2026-11-01')).aguaLog, [250, 500])
  assert.equal((await db.registros.where('clave').equals('for time').first()).tiempo, 462)
})

test('backup: ida y vuelta completa, con ajustes y sesión en curso, y sin la clave de IA', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  mem.mv_sesion = JSON.stringify({bloques: [{tipo: 'amrap', minutos: 10, ejercicios: ['swing']}]})
  const antes = {}
  for (const t of TABLAS) antes[t] = await db[t].count()
  const d = await armarBackup()
  const texto = JSON.stringify(d)
  assert.equal(texto.includes('CLAVE-SECRETA'), false, 'la clave de IA no viaja en el backup')
  assert.equal(d._ajustes.meta, '3000')
  assert.equal(d._ajustes.sonido, '0')
  assert.ok(d._sesion)

  for (const t of TABLAS) await db[t].clear()
  delete mem.mv_sesion
  delete mem.mv_meta
  const omitidas = await restaurar(JSON.parse(texto))
  assert.equal(omitidas, 0)
  for (const t of TABLAS) assert.equal(await db[t].count(), antes[t], t)
  assert.equal(mem.mv_meta, '3000')
  assert.ok(mem.mv_sesion, 'vuelve la sesión en curso')
  assert.equal(mem.mv_key, 'CLAVE-SECRETA', 'la clave local no se toca')
})

test('restaurar no pisa una sesión en curso y rechaza archivos que no son backups', async () => {
  const {restaurar} = await import('../src/data/backup.js')
  mem.mv_sesion = JSON.stringify({bloques: [{tipo: 'emom'}]})
  await restaurar({_meta: {app: 'MMV'}, _sesion: {bloques: [{tipo: 'amrap'}]}})
  assert.equal(JSON.parse(mem.mv_sesion).bloques[0].tipo, 'emom')
  await assert.rejects(() => restaurar([1, 2, 3]), /backup/)
})
