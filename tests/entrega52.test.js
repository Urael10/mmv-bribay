// Entrega 51 (v0.52.0) · avisos de agua al ritmo: el aviso de agua de hoy se saltea si lo ya tomado alcanza para lo que
// se esperaría a esa hora (misma curva lineal de 8 a 20 h que la Nota del día).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

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

import {CONFIG_BASE, aguaAlRitmo, planRecordatorios, diaDe} from '../src/domain/recordatorios.js'
import {aguaEsperada} from '../src/domain/senales.js'
import {db, hoy} from '../src/data/db.js'
import {guardarConfig, reprogramar} from '../src/features/recordatorios/servicio.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime()
const HOY = '2026-11-09'
const META = 2500
const soloAgua = extra => ({...CONFIG_BASE, agua: {...CONFIG_BASE.agua, on: true, ...extra}})
// Horas (HH:MM) de los avisos de agua de hoy que quedan en el plan.
const deHoy = (p, ahora) =>
  p
    .filter(x => x.tipo === 'agua' && diaDe(x.cuando) === HOY)
    .map(x => new Date(x.cuando).toTimeString().slice(0, 5))
const plan = (agua, ahora = local(2026, 11, 9, 8, 0), config = soloAgua({desde: '09:00', hasta: '21:00', cada: 3})) =>
  planRecordatorios({config, ahoraMs: ahora, hoy: HOY, metaAgua: META, habitos: agua == null ? [] : [{fecha: HOY, agua}]})

test('aguaAlRitmo: compara lo tomado con la curva lineal de la Nota del día', () => {
  // 12 h → 33 % de la meta; 15 h → 58 %; 18 h → 83 %
  assert.equal(aguaAlRitmo(900, META, 12 * 60), true) // 900 ≥ 833
  assert.equal(aguaAlRitmo(800, META, 12 * 60), false) // 800 < 833
  assert.equal(aguaAlRitmo(Math.ceil(aguaEsperada(15) * META), META, 15 * 60), true) // justo en la curva: adelantado
  assert.equal(aguaAlRitmo(Math.floor(aguaEsperada(15) * META) - 1, META, 15 * 60), false)
  assert.equal(aguaAlRitmo(2500, META, 21 * 60), true) // al final de la curva (1,0 × meta)
  assert.equal(aguaAlRitmo(2400, META, 21 * 60), false)
})

test('aguaAlRitmo: sin nada tomado, sin meta o con datos ajenos nunca da por adelantado', () => {
  assert.equal(aguaAlRitmo(0, META, 7 * 60), false) // la curva vale 0 antes de las 8: igual no se saltea con 0 ml
  assert.equal(aguaAlRitmo(undefined, META, 7 * 60), false)
  assert.equal(aguaAlRitmo(null, META, 12 * 60), false)
  assert.equal(aguaAlRitmo('abc', META, 12 * 60), false)
  assert.equal(aguaAlRitmo(500, 0, 12 * 60), false)
  assert.equal(aguaAlRitmo(500, undefined, 12 * 60), false)
  assert.equal(aguaAlRitmo(-300, META, 12 * 60), false)
})

test('plan · sin agua cargada hoy salen todos los avisos que quedan (como antes)', () => {
  assert.deepEqual(deHoy(plan(null)), ['09:00', '12:00', '15:00', '18:00', '21:00'])
  assert.deepEqual(deHoy(plan(0)), ['09:00', '12:00', '15:00', '18:00', '21:00'])
})

test('plan · si vas por delante, los avisos que todavía no hacían falta se saltean; si vas atrasado, quedan', () => {
  // 1000 ml (40 %): ya alcanza para las 9 y las 12 h (33 %), no para las 15 h (58 %)
  // (con 1000 ml también se saltea el de las 9 h: la curva a esa hora pide solo 208 ml)
  assert.deepEqual(deHoy(plan(1000)), ['15:00', '18:00', '21:00'])
  // 1500 ml (60 %): salen de la lista 9, 12 y 15; quedan 18 y 21
  assert.deepEqual(deHoy(plan(1500)), ['18:00', '21:00'])
  // 2000 ml (80 %): todavía falta para las 18 h (83 %)
  assert.deepEqual(deHoy(plan(2000)), ['18:00', '21:00'])
  // 2100 ml (84 %): ya alcanza para las 18 h; solo queda el de las 21 h
  assert.deepEqual(deHoy(plan(2100)), ['21:00'])
  // meta cumplida: no queda ninguno hoy (corte que ya existía)
  assert.deepEqual(deHoy(plan(2500)), [])
})

test('plan · el aviso de la mañana no desaparece con 0 ml aunque la curva todavía no suba', () => {
  const madrugador = soloAgua({desde: '06:00', hasta: '12:00', cada: 2})
  const p = plan(0, local(2026, 11, 9, 5, 0), madrugador)
  assert.deepEqual(deHoy(p), ['06:00', '08:00', '10:00', '12:00'])
})

test('plan · solo se toca hoy: los días siguientes salen completos con cualquier cantidad tomada', () => {
  const p = plan(1500)
  const manana = p.filter(x => x.tipo === 'agua' && diaDe(x.cuando) === '2026-11-10')
  assert.equal(manana.length, 5)
  assert.equal(p.filter(x => x.tipo === 'agua').length, 2 + 6 * 5)
})

test('plan · agua al ritmo no toca los otros avisos ni el texto del aviso de agua', () => {
  const config = {
    checkin: {on: true, hora: '21:00'},
    acostarte: {on: false},
    agua: {on: true, desde: '09:00', hasta: '21:00', cada: 3},
    backup: {on: true, dia: 1, hora: '20:00'}
  }
  const ahora = local(2026, 11, 9, 10, 0)
  const con = plan(1500, ahora, config),
    sin = plan(null, ahora, config)
  const noAgua = p => p.filter(x => x.tipo !== 'agua').map(({id, ...r}) => r)
  assert.deepEqual(noAgua(con), noAgua(sin))
  const agua = con.filter(x => x.tipo === 'agua')
  assert.ok(agua.every(x => x.titulo === 'Agua' && x.cuerpo === 'Un vaso de agua, ¿te parece?'))
  assert.ok(!agua.some(x => /\d/.test(x.cuerpo)), 'el texto no lleva números (puede envejecer)')
  // los ids siguen siendo 1..n sin huecos aunque se saltearan avisos
  assert.deepEqual(con.map(x => x.id), con.map((_, i) => i + 1))
})

test('plan · cargar un vaso más recalcula: con más agua desaparece un aviso que antes estaba', () => {
  const antes = deHoy(plan(800, local(2026, 11, 9, 10, 0)))
  const despues = deHoy(plan(1000, local(2026, 11, 9, 10, 0)))
  assert.ok(antes.includes('12:00') && !despues.includes('12:00'))
})

test('servicio · con agua de hoy cargada, el plan que se programa de verdad respeta la curva', async () => {
  const f = hoy()
  mem.mv_meta = String(META)
  await db.habitos.put({fecha: f, agua: 1800, energia: 3, animo: 3, dolor: 3})
  guardarConfig({...CONFIG_BASE, agua: {on: true, desde: '00:00', hasta: '23:00', cada: 2}})
  const llamadas = []
  const notif = {
    disponible: () => true,
    programar: async p => (llamadas.push(p), {ok: true, n: p.length}),
    cancelarTodo: async () => ({ok: true, n: 0})
  }
  const r = await reprogramar(notif)
  assert.equal(r.ok, true)
  const p = llamadas[0]
  const deHoyReal = p.filter(x => x.tipo === 'agua' && diaDe(x.cuando) === f)
  for (const x of deHoyReal) {
    const d = new Date(x.cuando)
    assert.equal(aguaAlRitmo(1800, META, d.getHours() * 60 + d.getMinutes()), false, `no debería quedar el aviso de las ${d.getHours()}h`)
  }
  // los demás días no pierden ninguno: 12 por día (de 00:00 a 22:00 cada 2 h) en los 6 días siguientes
  const otros = p.filter(x => x.tipo === 'agua' && diaDe(x.cuando) !== f)
  assert.equal(otros.length, 6 * 12)
})

test('encaje: domain sigue puro y el servicio no cambió de dependencias', () => {
  const dom = leer('src/domain/recordatorios.js')
  assert.match(dom, /import \{aguaEsperada\} from '\.\/senales\.js'/)
  const imports = dom.split('\n').filter(l => /^import /.test(l)).join('\n')
  assert.doesNotMatch(imports, /@capacitor|dexie|\.\.\/data|\.\.\/features|\.\.\/platform|\.\.\/services|\.\.\/ui/)
  assert.doesNotMatch(leer('src/domain/senales.js'), /from '\.\/recordatorios\.js'/) // sin ciclo
  assert.match(leer('src/features/recordatorios/Recordatorios.jsx'), /Si vas por delante con el\s+agua/)
})

test('reglas fijas y documentación: Dexie v11, appId y esquema intactos, sin dependencias nuevas, versión 0.52.0', () => {
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  assert.equal(pkg.version, '0.52.0')
  assert.equal(pkg.entrega, '51')
  assert.equal(lock.version, '0.52.0')
  assert.equal(lock.packages[''].version, '0.52.0')
  assert.deepEqual(Object.keys(pkg.dependencies), [
    '@capacitor/android', '@capacitor/app', '@capacitor/core', '@capacitor/filesystem', '@capacitor/haptics',
    '@capacitor/local-notifications', '@capacitor/share', '@fontsource/bebas-neue', '@fontsource/chakra-petch',
    '@fontsource/inter', 'barcode-detector', 'dexie', 'react', 'react-dom'
  ])
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\s+## v0\.52\.0 · Entrega 51/)
  assert.match(leer('CHANGELOG.md'), /## v0\.51\.0 · Entrega 50/)
  assert.match(leer('README.md'), /Entrega 51 \(v0\.52\.0\)/)
  assert.match(leer('README.md'), /## Agua al ritmo \(v0\.52\.0\)/)
})
