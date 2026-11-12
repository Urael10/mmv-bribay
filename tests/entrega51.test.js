// Entrega 50 (v0.51.0) · backup con la configuración de recordatorios.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {AJUSTES, ajustesDe, ajustesAplicables, valorDeAjuste} from '../src/domain/backup.js'
import {CONFIG_BASE, normalizarConfig} from '../src/domain/recordatorios.js'

const mem = {mv_key: 'CLAVE-SECRETA', mv_meta: '3000'}
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

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const CFG = {
  checkin: {on: true, hora: '08:30'},
  acostarte: {on: true},
  agua: {on: true, desde: '08:00', hasta: '22:00', cada: 2},
  backup: {on: true, dia: 5, hora: '19:15'}
}

test('la configuración de recordatorios viaja en el backup; la marca interna y la clave de IA no', () => {
  assert.ok(AJUSTES.includes('recordatorios'))
  assert.ok(!AJUSTES.includes('rec_programado'))
  assert.ok(!AJUSTES.includes('key'))
  for (const k of ['meta', 'metakcal', 'modelo', 'sonido', 'feedback', 'altura', 'nac', 'pesoobj', 'fechaobj', 'protkg'])
    assert.ok(AJUSTES.includes(k), k) // los de siempre siguen
})

test('exportar: va normalizada (valores dañados corregidos) y no aparece si nunca se configuró', () => {
  const sucia = {checkin: {on: true, hora: '7:05'}, agua: {on: true, desde: '20:00', hasta: '09:00', cada: 5}, backup: {on: 'si', dia: 9}}
  const a = ajustesDe(k => ({recordatorios: JSON.stringify(sucia), meta: '2500'})[k])
  assert.equal(typeof a.recordatorios, 'string')
  const o = JSON.parse(a.recordatorios)
  assert.deepEqual(o, normalizarConfig(sucia))
  assert.equal(o.checkin.hora, '07:05')
  assert.deepEqual([o.agua.desde, o.agua.hasta, o.agua.cada], ['09:00', '21:00', 3])
  assert.equal(o.backup.on, false) // «si» no es true
  assert.equal(o.backup.dia, CONFIG_BASE.backup.dia)
  assert.equal(a.meta, '2500')
  assert.equal('recordatorios' in ajustesDe(() => null), false)
  assert.equal('recordatorios' in ajustesDe(k => (k === 'meta' ? '2500' : '')), false)
})

test('ajustesAplicables: acepta texto JSON u objeto, normaliza y no deja pasar claves ajenas', () => {
  const comoTexto = ajustesAplicables({recordatorios: JSON.stringify(CFG), meta: 3000})
  assert.deepEqual(Object.fromEntries(comoTexto), {meta: '3000', recordatorios: JSON.stringify(normalizarConfig(CFG))})
  const comoObjeto = ajustesAplicables({recordatorios: CFG})
  assert.deepEqual(JSON.parse(comoObjeto[0][1]), CFG)
  const ajeno = ajustesAplicables({key: 'SECRETA', mv_key: 'X', constructor: 'x', rec_programado: '1'})
  assert.deepEqual(ajeno, [])
  assert.deepEqual(ajustesAplicables(Object.create({meta: '1'})), []) // lo heredado no cuenta
  assert.deepEqual(ajustesAplicables(JSON.parse('{"__proto__": {"meta": "1"}}')), []) // el __proto__ de un JSON tampoco
})

test('ajustesAplicables: un valor dañado o ausente no pisa la configuración del teléfono', () => {
  for (const malo of ['{no es json', '[]', '"texto"', '5', 'null', 7, true, [], ['x'], '', null, undefined])
    assert.deepEqual(ajustesAplicables({recordatorios: malo}), [], String(malo))
  for (const raro of [null, undefined, 'x', 5, [], [CFG]]) assert.deepEqual(ajustesAplicables(raro), [])
  assert.equal(valorDeAjuste('recordatorios', '{x'), null)
  assert.equal(valorDeAjuste('meta', 3000), '3000')
  // un objeto vacío es válido: es la configuración de fábrica (todo apagado), y eso sí se aplica
  assert.deepEqual(JSON.parse(ajustesAplicables({recordatorios: {}})[0][1]), CONFIG_BASE)
})

test('ida y vuelta con la base: armarBackup la incluye y restaurar la devuelve, validada', async () => {
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  mem.mv_recordatorios = JSON.stringify(CFG)
  const d = JSON.parse(JSON.stringify(await armarBackup()))
  assert.deepEqual(JSON.parse(d._ajustes.recordatorios), CFG)
  assert.equal(JSON.stringify(d).includes('CLAVE-SECRETA'), false)
  assert.equal('rec_programado' in d._ajustes, false)

  delete mem.mv_recordatorios
  await restaurar(d)
  assert.deepEqual(JSON.parse(mem.mv_recordatorios), CFG)
  assert.equal(mem.mv_key, 'CLAVE-SECRETA')

  // un backup manipulado trae una configuración sucia: se guarda ya corregida
  const sucio = {...d, _ajustes: {...d._ajustes, recordatorios: JSON.stringify({checkin: {on: true, hora: '99:99'}, agua: {on: true, cada: 7}})}}
  await restaurar(sucio)
  const g = JSON.parse(mem.mv_recordatorios)
  assert.equal(g.checkin.on, true)
  assert.equal(g.checkin.hora, CONFIG_BASE.checkin.hora)
  assert.equal(g.agua.cada, CONFIG_BASE.agua.cada)
})

test('restaurar: un backup anterior (sin la clave) o con un valor dañado deja la configuración como estaba', async () => {
  const {restaurar} = await import('../src/data/backup.js')
  mem.mv_recordatorios = JSON.stringify(CFG)
  await restaurar({_meta: {app: 'MMV'}, _ajustes: {meta: '2800'}})
  assert.equal(mem.mv_meta, '2800')
  assert.deepEqual(JSON.parse(mem.mv_recordatorios), CFG)
  await restaurar({_meta: {app: 'MMV'}, _ajustes: {recordatorios: '{roto'}})
  assert.deepEqual(JSON.parse(mem.mv_recordatorios), CFG)
  await restaurar({_meta: {app: 'MMV'}})
  assert.deepEqual(JSON.parse(mem.mv_recordatorios), CFG)
})

test('restaurar anuncia «mmv:restaurado» al terminar, con los ajustes ya escritos', async () => {
  const {restaurar, EVENTO_RESTAURADO} = await import('../src/data/backup.js')
  assert.equal(EVENTO_RESTAURADO, 'mmv:restaurado')
  let vista = null
  globalThis.dispatchEvent = e => (eventos.push(e.type), (vista = mem.mv_recordatorios), true)
  eventos.length = 0
  delete mem.mv_recordatorios
  await restaurar({_meta: {app: 'MMV'}, _ajustes: {recordatorios: JSON.stringify(CFG)}})
  assert.deepEqual(eventos, ['mmv:restaurado'])
  assert.deepEqual(JSON.parse(vista), CFG) // cuando el servicio lo escucha, la configuración ya está
  await assert.rejects(() => restaurar({nada: 1}), /No parece un backup/)
  assert.deepEqual(eventos, ['mmv:restaurado']) // un archivo que no es backup no anuncia nada
})

test('servicio y pantalla: reprograman y vuelven a leer al restaurar; el permiso solo se pide al tocar', () => {
  const s = leer('src/features/recordatorios/servicio.js')
  assert.match(s, /window\.addEventListener\(EVENTO_RESTAURADO, pedir\)/)
  assert.match(s, /window\.removeEventListener\(EVENTO_RESTAURADO, pedir\)/)
  const ui = leer('src/features/recordatorios/Recordatorios.jsx')
  assert.match(ui, /addEventListener\(EVENTO_RESTAURADO, alRestaurar\)/)
  assert.match(ui, /removeEventListener\(EVENTO_RESTAURADO, alRestaurar\)/)
  assert.match(ui, /setC\(leerConfig\(\)\)/)
  assert.match(ui, /permiso === 'prompt' && hayActivos\(c\)/)
  assert.match(ui, /onClick=\{\(\) => aplicar\(c, true\)\}/)
  assert.match(ui, /Permitir avisos/)
  assert.equal([...ui.matchAll(/pedirPermiso\(/g)].length, 1) // sigue habiendo un solo lugar que lo pide (dentro de `aplicar`)
  for (const f of ['src/data/backup.js', 'src/domain/backup.js', 'src/features/recordatorios/servicio.js'])
    assert.doesNotMatch(leer(f), /pedirPermiso|@capacitor\//, f)
})

test('arquitectura: domain/backup.js sigue puro y data/backup.js no importa features', () => {
  const dom = leer('src/domain/backup.js').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(dom, /from 'react|data\/|platform\/|features\/|localStorage|document\.|window\.|@capacitor/)
  assert.match(dom, /from '\.\/recordatorios\.js'/)
  assert.doesNotMatch(leer('src/data/backup.js'), /features\//)
})

test('reglas fijas y documentación: Dexie v11, appId y esquema intactos, sin dependencias nuevas, versión 0.51.0', () => {
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  assert.equal(pkg.version, '0.51.0')
  assert.equal(pkg.entrega, '50')
  assert.equal(lock.version, '0.51.0')
  assert.equal(lock.packages[''].version, '0.51.0')
  assert.deepEqual(Object.keys(pkg.dependencies), [
    '@capacitor/android', '@capacitor/app', '@capacitor/core', '@capacitor/filesystem', '@capacitor/haptics',
    '@capacitor/local-notifications', '@capacitor/share', '@fontsource/bebas-neue', '@fontsource/chakra-petch',
    '@fontsource/inter', 'barcode-detector', 'dexie', 'react', 'react-dom'
  ]) // la lista de la entrega 49: esta entrega no suma ninguna
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\s+## v0\.51\.0 · Entrega 50/)
  assert.match(leer('CHANGELOG.md'), /## v0\.50\.0 · Entrega 49/)
  assert.match(leer('README.md'), /Entrega 50 \(v0\.51\.0\)/)
  assert.match(leer('README.md'), /## Backup con la configuración de recordatorios \(v0\.51\.0\)/)
  assert.ok(!/publicar/.test(leer('.github/workflows/android-debug.yml')))
})
