// Pruebas de backup completo y restauración segura con IndexedDB simulada.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  AJUSTES,
  ESQUEMA_BACKUP,
  valorDeAjuste,
  validarBackup,
  validarContenidoBackup
} from '../src/domain/backup.js'
import {claveAl, itemDesde, cerrar, totales, momentoPorHora} from '../src/domain/alimentos.js'
import {plantillaDesdeItems} from '../src/domain/registro.js'
import {
  estructuraBloque,
  rutinaDesdeSesion,
  rpeSugerido,
  claveEjercicio
} from '../src/domain/entreno.js'
import {normalizarMedida} from '../src/domain/cuerpo.js'
import {normalizarTest} from '../src/domain/progreso.js'
import {limpiarCoach} from '../src/domain/informe.js'
import {lunes} from '../src/domain/stats.js'
import {armarRuta} from '../src/domain/rutas.js'
import {armarActividad, sumarPasos} from '../src/domain/actividad.js'
import {bloqueVacio, ponerDia} from '../src/domain/privado.js'

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

const eventos = []
globalThis.dispatchEvent = e => (eventos.push(e.type), true)

const limpiarMem = () => {
  for (const k of Object.keys(mem)) delete mem[k]
}

test('AJUSTES incluye metapasos, alarmasueno y ruta_ocultar; excluye key, mapa_osm y entrada', () => {
  assert.ok(AJUSTES.includes('metapasos'))
  assert.ok(AJUSTES.includes('alarmasueno'))
  assert.ok(AJUSTES.includes('ruta_ocultar'))
  assert.ok(!AJUSTES.includes('key'))
  assert.ok(!AJUSTES.includes('mapa_osm'))
  assert.ok(!AJUSTES.includes('entrada'))
})

test('valorDeAjuste conserva valores válidos (strings, incluido "0", y números) y descarta objetos o booleanos', () => {
  assert.equal(valorDeAjuste('metapasos', '8500'), '8500')
  assert.equal(valorDeAjuste('metapasos', 8500), '8500')
  assert.equal(valorDeAjuste('alarmasueno', '06:45'), '06:45')
  assert.equal(valorDeAjuste('ruta_ocultar', '0'), '0')
  assert.equal(valorDeAjuste('ruta_ocultar', '1'), '1')
  assert.equal(valorDeAjuste('sonido', '0'), '0')
  assert.equal(valorDeAjuste('meta', ''), null)
  assert.equal(valorDeAjuste('meta', {}), null)
  assert.equal(valorDeAjuste('meta', ['x']), null)
  assert.equal(valorDeAjuste('meta', true), null)
  assert.equal(valorDeAjuste('meta', NaN), null)
})

test('ida y vuelta incluye mv_metapasos, mv_alarmasueno y mv_ruta_ocultar="0" sin perder el "0" ni exponer mv_key', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  await db.open()
  for (const t of TABLAS) await db[t].clear()
  limpiarMem()

  mem.mv_key = 'CLAVE-IA-LOCAL'
  mem.mv_metapasos = '9000'
  mem.mv_alarmasueno = '07:15'
  mem.mv_ruta_ocultar = '0'
  mem.mv_mapa_osm = '1'
  mem.mv_entrada = 'plantilla'

  const d = await armarBackup()
  const txt = JSON.stringify(d)
  assert.equal(txt.includes('CLAVE-IA-LOCAL'), false)
  assert.equal(d._ajustes.metapasos, '9000')
  assert.equal(d._ajustes.alarmasueno, '07:15')
  assert.equal(d._ajustes.ruta_ocultar, '0')
  assert.equal('mapa_osm' in d._ajustes, false)
  assert.equal('entrada' in d._ajustes, false)

  delete mem.mv_metapasos
  delete mem.mv_alarmasueno
  delete mem.mv_ruta_ocultar
  await restaurar(JSON.parse(txt))
  assert.equal(mem.mv_metapasos, '9000')
  assert.equal(mem.mv_alarmasueno, '07:15')
  assert.equal(mem.mv_ruta_ocultar, '0')
  assert.equal(localStorage.getItem('mv_ruta_ocultar') !== '0', false)
  assert.equal(mem.mv_key, 'CLAVE-IA-LOCAL')

  // Rutas.jsx sigue leyendo mv_ruta_ocultar con !== '0'
  const rutasUi = readFileSync(new URL('../src/features/rutas/Rutas.jsx', import.meta.url), 'utf8')
  assert.match(rutasUi, /localStorage\.getItem\('mv_ruta_ocultar'\)\s*!==\s*'0'/)
})

test('ida y vuelta completa con las 15 tablas pobladas usando funciones de la propia app', async () => {
  const {db, TABLAS, sembrar} = await import('../src/data/db.js')
  const {armarBackup, restaurar, validarArchivoBackup} = await import('../src/data/backup.js')
  const {agregar, registrarNombres} = await import('../src/data/biblioteca.js')
  const {anotarUso} = await import('../src/data/iaDia.js')
  const {guardarRuta} = await import('../src/data/rutas.js')
  const {crearClave, guardarMes, abrir, leerMes, borrarTodo} = await import('../src/data/privado.js')

  await db.open()
  for (const t of TABLAS) await db[t].clear()
  limpiarMem()

  const fecha = '2026-11-20'
  // 1. alimentos
  await sembrar(true)
  const [al] = await db.alimentos.toArray()
  assert.equal(al.clave, claveAl(al.nombre))

  // 2. ejercicios + 3. sesiones + 4. registros + 5. rutinas
  const ej = await agregar({nombre: 'Swing ruso', patron: 'Cadera'})
  const bloques = [
    estructuraBloque({
      tipo: 'emom',
      minutos: 10,
      rpe: 8,
      ejercicios: [ej.nombre],
      reg: [{kg: '20', reps: '15'}]
    })
  ]
  const sid = await db.sesiones.add({fecha, rpe: rpeSugerido(bloques), bloques})
  await db.registros.add({
    fecha,
    sesionId: sid,
    clave: claveEjercicio(ej.nombre),
    nombre: ej.nombre,
    tipo: 'emom',
    kg: 20,
    reps: 15
  })
  await registrarNombres(bloques)
  await db.rutinas.add(rutinaDesdeSesion('Base fuerza', bloques))

  // 6. habitos
  await db.habitos.put({
    fecha,
    agua: 2000,
    sueno: '7.5',
    energia: 4,
    animo: 4,
    dolor: 2,
    pasos: sumarPasos(0, 8200)
  })

  // 7. uso
  await anotarUso(fecha)

  // 8. comidas + 9. plantillas
  const item = cerrar(itemDesde(al, 150, 'base'))
  const items = [item]
  await db.comidas.add({
    fecha,
    hora: '08:30',
    momento: momentoPorHora(8),
    items,
    ...totales(items),
    fuente: 'manual'
  })
  await db.plantillas.add(plantillaDesdeItems('Desayuno base', 'desayuno', items))

  // 10. coach
  await db.coach.put({
    semana: lunes(fecha),
    creado: '2026-11-20T12:00:00.000Z',
    ...limpiarCoach({
      resumen: 'Buena semana de base.',
      logros: ['Constancia en entrenos'],
      mejoras: ['Sumar agua temprano'],
      plan: ['Mantener 3 sesiones']
    })
  })

  // 11. medidas
  await db.medidas.put(normalizarMedida({peso: '78,4', grasa: '18,2'}, fecha))

  // 12. tests
  await db.tests.add(normalizarTest({clave: 'plancha', valor: '95'}, fecha))

  // 13. rutas + 14. actividades
  const t0 = Date.parse(`${fecha}T09:00:00Z`)
  const ruta = armarRuta({
    fecha,
    distM: 1200,
    seg: 720,
    segs: [
      [
        {lat: -34.6037, lon: -58.3816, t: t0},
        {lat: -34.6001, lon: -58.3816, t: t0 + 360000},
        {lat: -34.593, lon: -58.3816, t: t0 + 720000}
      ]
    ],
    ocultarM: 0
  })
  const rutaId = await guardarRuta(ruta)
  await db.actividades.add(armarActividad({fecha, tipo: 'caminata', minutos: 12, km: 1.2, rutaId}))

  // 15. privado
  const kPriv = await crearClave('frase real de prueba')
  await guardarMes(kPriv, '2026-11', ponerDia(bloqueVacio(), fecha, {man: true, dur: 2, lib: 4}))

  // Verificar que todas las 15 tablas tienen datos reales antes de exportar
  const antes = {}
  for (const t of TABLAS) {
    antes[t] = await db[t].toArray()
    assert.ok(antes[t].length > 0, `tabla ${t} poblada`)
  }

  const backup = JSON.parse(JSON.stringify(await armarBackup()))
  assert.deepEqual(validarArchivoBackup(backup), {ok: true, error: null})

  await borrarTodo()
  for (const t of TABLAS) await db[t].clear()
  const omitidas = await restaurar(backup)
  assert.equal(omitidas, 0)

  for (const t of TABLAS) {
    assert.deepEqual(await db[t].toArray(), antes[t], `tabla ${t} restaurada idéntica`)
  }
  const kPriv2 = await abrir('frase real de prueba')
  assert.ok(kPriv2)
  assert.equal((await leerMes(kPriv2, '2026-11')).dias[fecha].lib, 4)
  await borrarTodo()
})

test('ESQUEMA_BACKUP coincide exactamente con TABLAS y con los primKey e índices únicos de Dexie (salvo privado)', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {restaurar, validarArchivoBackup} = await import('../src/data/backup.js')
  await db.open()

  // `privado` queda fuera de ESQUEMA_BACKUP a propósito para respetar el aislamiento probado en tests/entrega14.test.js
  // (donde src/domain/backup.js no puede nombrar el módulo privado); se valida aparte en validarArchivoBackup().
  const tablasPublicas = TABLAS.filter(t => t !== 'privado').sort()
  const enEsquema = Object.keys(ESQUEMA_BACKUP).sort()
  assert.deepEqual(enEsquema, tablasPublicas)

  for (const t of enEsquema) {
    const regla = ESQUEMA_BACKUP[t]
    const schema = db.table(t).schema
    if (regla.autoId) {
      assert.equal(schema.primKey.auto, true, `${t} debe tener primKey autoincremental`)
      assert.equal(schema.primKey.name, 'id', `${t} debe usar id como primKey`)
    } else {
      assert.equal(schema.primKey.auto, false, `${t} no debe tener primKey autoincremental`)
      assert.equal(schema.primKey.name, regla.pk, `${t} primKey debe coincidir`)
    }
    const unicos = schema.indexes.filter(i => i.unique).map(i => i.name)
    if (regla.unica) {
      assert.deepEqual(unicos, [regla.unica], `${t} índice único debe coincidir`)
    } else {
      assert.deepEqual(unicos, [], `${t} no debe tener índices únicos extra`)
    }
  }

  // Comprobación explícita de `privado` en Dexie y su validación en validarArchivoBackup / restaurar()
  const privSchema = db.table('privado').schema
  assert.equal(privSchema.primKey.auto, false)
  assert.equal(privSchema.primKey.name, 'mes')
  assert.deepEqual(
    privSchema.indexes.filter(i => i.unique).map(i => i.name),
    []
  )

  for (const privMalo of [
    {_meta: {app: 'MMV'}, privado: [{salt: 'AAA'}]},
    {_meta: {app: 'MMV'}, privado: [{mes: '2026-11'}, {mes: '2026-11'}]},
    {_meta: {app: 'MMV'}, privado: 'no-es-array'}
  ]) {
    assert.equal(validarArchivoBackup(privMalo).ok, false)
    await assert.rejects(() => restaurar(privMalo), /backup/i)
  }
})

test('restaurar reemplaza tablas presentes sin mezclar filas previas y deja intactas las tablas ausentes', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {restaurar} = await import('../src/data/backup.js')
  await db.open()
  for (const t of TABLAS) await db[t].clear()
  limpiarMem()

  await db.habitos.put({fecha: '2026-11-01', agua: 1200})
  await db.habitos.put({fecha: '2026-11-02', agua: 2000})
  await db.sesiones.add({id: 1, fecha: '2026-11-01', bloques: [{tipo: 'emom'}]})
  await db.sesiones.add({id: 2, fecha: '2026-11-02', bloques: [{tipo: 'amrap'}]})
  await db.rutas.add({id: 99, fecha: '2026-11-02', tipo: 'caminata', m: 1500})

  // Backup antiguo: trae habitos y sesiones, pero no trae rutas ni otras tablas nuevas; tiene campos extra.
  const backupAntiguo = {
    _meta: {app: 'MMV', version: '0.10.0', campoExtra: 'ok'},
    extraRaiz: true,
    habitos: [{fecha: '2026-10-20', agua: 2500, campoLegacy: 42}],
    sesiones: [{id: 1, fecha: '2026-10-20', bloques: [{tipo: 'tabata'}]}]
  }

  assert.equal(validarBackup(backupAntiguo), true)
  await restaurar(backupAntiguo)

  const habitos = await db.habitos.toArray()
  assert.deepEqual(habitos, [{fecha: '2026-10-20', agua: 2500, campoLegacy: 42}])

  const sesiones = await db.sesiones.toArray()
  assert.equal(sesiones.length, 1)
  assert.equal(sesiones[0].fecha, '2026-10-20')

  // La tabla ausente en el backup antiguo queda intacta.
  const rutas = await db.rutas.toArray()
  assert.equal(rutas.length, 1)
  assert.equal(rutas[0].id, 99)
})

test('validación previa: un archivo inválido se rechaza sin modificar ni la base ni localStorage', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {restaurar} = await import('../src/data/backup.js')
  await db.open()
  for (const t of TABLAS) await db[t].clear()
  limpiarMem()

  await db.habitos.put({fecha: '2026-11-10', agua: 1800})
  mem.mv_meta = '2500'
  eventos.length = 0

  const invalidos = [
    {_meta: {app: 'MMV'}, sesiones: 'no-es-array'},
    {_meta: {app: 'MMV'}, habitos: [{agua: 500}]}, // falta pk fecha
    {_meta: {app: 'MMV'}, habitos: [{fecha: '2026-11-01'}, {fecha: '2026-11-01'}]}, // pk duplicada
    {_meta: {app: 'MMV'}, sesiones: [{id: 1}, {id: 1}]}, // id duplicado
    {_meta: {app: 'MMV'}, alimentos: [{nombre: 'A', clave: 'a'}, {nombre: 'B', clave: 'a'}]}, // única duplicada
    {_meta: {app: 'MMV'}, comidas: [null]},
    {_meta: {app: 'MMV'}, _ajustes: ['invalido']},
    {_meta: {app: 'MMV'}, _sesion: 'invalido'}
  ]

  for (const malo of invalidos) {
    assert.equal(validarContenidoBackup(malo).ok, false)
    await assert.rejects(() => restaurar(malo), /backup/i)
  }

  assert.deepEqual(await db.habitos.toArray(), [{fecha: '2026-11-10', agua: 1800}])
  assert.equal(mem.mv_meta, '2500')
  assert.equal(eventos.length, 0)
})

test('atomicidad: si falla la escritura en una tabla dentro de la transacción, se revierte todo', async () => {
  const {db, TABLAS} = await import('../src/data/db.js')
  const {restaurar} = await import('../src/data/backup.js')
  await db.open()
  for (const t of TABLAS) await db[t].clear()
  limpiarMem()

  await db.habitos.put({fecha: '2026-11-15', agua: 1700})
  await db.rutas.put({id: 5, fecha: '2026-11-15', tipo: 'caminata', m: 800})
  mem.mv_meta = '2400'
  eventos.length = 0

  const originalBulkAdd = db.rutas.bulkAdd.bind(db.rutas)
  db.rutas.bulkAdd = async () => {
    throw new Error('fallo simulado al escribir rutas')
  }

  try {
    await assert.rejects(
      () =>
        restaurar({
          _meta: {app: 'MMV'},
          _ajustes: {meta: '3200'},
          habitos: [{fecha: '2026-11-01', agua: 500}],
          rutas: [{id: 1, fecha: '2026-11-01', tipo: 'caminata', m: 100}]
        }),
      /fallo simulado/
    )
  } finally {
    db.rutas.bulkAdd = originalBulkAdd
  }

  // habitos y rutas conservan sus datos originales gracias al rollback de la transacción única
  assert.deepEqual(await db.habitos.toArray(), [{fecha: '2026-11-15', agua: 1700}])
  assert.deepEqual(await db.rutas.toArray(), [{id: 5, fecha: '2026-11-15', tipo: 'caminata', m: 800}])
  assert.equal(mem.mv_meta, '2400')
  assert.equal(eventos.length, 0)
})

test('Ajustes.jsx valida antes de restaurar y ofrece exportar datos actuales sin usar alert ni confirm', () => {
  const aj = readFileSync(new URL('../src/features/ajustes/Ajustes.jsx', import.meta.url), 'utf8')
  const respaldo = aj.slice(aj.indexOf('function Respaldo()'), aj.indexOf('function Perfil()'))
  assert.match(respaldo, /validarArchivoBackup/)
  assert.match(respaldo, /Exportar datos actuales antes de restaurar/)
  assert.match(respaldo, /Confirmar y restaurar/)
  assert.match(respaldo, /role=\{msg\.error \? 'alert' : 'status'\}/)
  assert.doesNotMatch(respaldo, /\b(alert|confirm|prompt)\s*\(/)
})
