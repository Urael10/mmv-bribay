// Entrega 14: menú privado «Bienestar» (cifrado, registro, backup cifrado, autobloqueo y que nada se filtre).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'
import * as P from '../src/domain/privado.js'

const mem = {mv_key: 'CLAVE-IA'}
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

test('cifrado: ida y vuelta, clave mala no abre, el texto claro no aparece y cada bloque queda atado a su mes', async () => {
  const {key, meta} = await P.crearMeta('mi frase larga 123')
  assert.ok(await P.abrirMeta(meta, 'mi frase larga 123'))
  assert.equal(await P.abrirMeta(meta, 'otra clave'), null)
  assert.equal(await P.abrirMeta(meta, ''), null)
  const b = P.agregarEv(P.ponerDia(P.bloqueVacio(), '2026-11-02', {man: true, dur: 3, lib: 4}), {
    t: '2026-11-02T15:00:00Z',
    ctx: 'pareja'
  })
  const c = await P.cifrar(key, b, '2026-11')
  const crudo = JSON.stringify(c)
  for (const s of ['2026-11-02', 'pareja', 'dur', 'man']) assert.equal(crudo.includes(s), false, s)
  assert.deepEqual(await P.descifrar(key, c, '2026-11'), b)
  await assert.rejects(() => P.descifrar(key, c, '2026-10'), 'cambiar un bloque de mes falla')
  const c2 = await P.cifrar(key, b, '2026-11')
  assert.notEqual(c.iv, c2.iv, 'cada cifrado usa un iv nuevo')
  assert.notEqual(c.ct, c2.ct)
})

test('validar clave: mínimo, coincidencia y aviso de clave corta', () => {
  assert.match(P.validarClave('abc', 'abc'), /al menos/)
  assert.match(P.validarClave('abcd', 'abce'), /no coinciden/)
  assert.equal(P.validarClave('abcd', 'abcd'), null)
  assert.equal(P.claveDebil('1234'), true)
  assert.equal(P.claveDebil('una frase larga'), false)
})

test('día: dureza solo con erección (1-4), libido 1-5, valores fuera de rango se descartan, y un día vacío se borra', () => {
  assert.deepEqual(P.normalizarDia({man: true, dur: 4, lib: 5}), {man: true, dur: 4, lib: 5})
  assert.deepEqual(P.normalizarDia({man: false, dur: 3}), {man: false}, 'sin erección no hay dureza')
  assert.deepEqual(P.normalizarDia({man: true, dur: 5, lib: 0}), {man: true})
  assert.deepEqual(P.normalizarDia({lib: 2.5}), null)
  assert.equal(P.normalizarDia({}), null)
  let b = P.ponerDia(P.bloqueVacio(), '2026-11-02', {man: true, dur: 2})
  b = P.ponerDia(b, '2026-11-02', {man: false, dur: null}) // cambiar a «No» saca la dureza
  assert.deepEqual(b.dias['2026-11-02'], {man: false})
  b = P.ponerDia(b, '2026-11-02', {man: null})
  assert.deepEqual(b.dias, {}, 'sin datos, el día desaparece')
  assert.throws(() => P.ponerDia(b, 'ayer', {man: true}), /Fecha/)
})

test('eventos: se ordenan, validan hora y contexto, y se pueden quitar', () => {
  let b = P.agregarEv(P.bloqueVacio(), {t: '2026-11-02T20:00:00Z', ctx: 'solo'})
  b = P.agregarEv(b, {t: '2026-11-01T10:00:00Z', ctx: 'raro'})
  assert.equal(b.ev[0].t, '2026-11-01T10:00:00.000Z')
  assert.equal(b.ev[0].ctx, undefined, 'contexto desconocido se ignora')
  assert.equal(b.ev[1].ctx, 'solo')
  assert.throws(() => P.agregarEv(b, {t: 'no es hora'}), /Hora/)
  b = P.quitarEv(b, b.ev[0].id)
  assert.equal(b.ev.length, 1)
  assert.equal(P.bloqueVacioOk(P.quitarEv(b, b.ev[0].id)), true)
})

test('historial: junta meses, más nuevo primero, con límite', () => {
  const a = P.ponerDia(P.bloqueVacio(), '2026-10-30', {lib: 3})
  let n = P.ponerDia(P.bloqueVacio(), '2026-11-02', {man: true})
  n = P.agregarEv(n, {t: '2026-11-02T18:00:00Z'})
  const h = P.historial({'2026-10': a, '2026-11': n})
  assert.equal(h.length, 3)
  assert.equal(h[0].tipo, 'ev')
  assert.equal(h[2].fecha, '2026-10-30')
  assert.equal(P.historial({'2026-10': a, '2026-11': n}, 2).length, 2)
})

test('gesto de acceso: 5 toques en 3 s abren; toques lentos o pocos no', () => {
  let t = [],
    r
  for (let i = 0; i < 4; i++) {
    r = P.registrarToque(t, 1000 + i * 400)
    t = r.toques
    assert.equal(r.abre, false)
  }
  assert.equal(P.registrarToque(t, 1000 + 4 * 400).abre, true)
  // lentos: el primero ya venció
  let t2 = []
  for (let i = 0; i < 5; i++) {
    r = P.registrarToque(t2, i * 1000)
    t2 = r.toques
  }
  assert.equal(r.abre, false, '5 toques repartidos en 4 s no abren')
})

test('autobloqueo: a los 60 s en segundo plano se bloquea; antes, no; nunca oculto, no', () => {
  assert.equal(P.debeBloquear(null, 99999), false)
  assert.equal(P.debeBloquear(1000, 1000 + 59000), false)
  assert.equal(P.debeBloquear(1000, 1000 + 60000), true)
})

test('restaurar: sin menú aquí se importa; misma clave se importa; otra clave se omite', () => {
  const filas = [{mes: '_meta', salt: 'AAA'}, {mes: '2026-11'}]
  assert.equal(P.planRestaurarPrivado(undefined, filas).importar.length, 2)
  assert.equal(P.planRestaurarPrivado({salt: 'AAA'}, filas).importar.length, 2)
  const otro = P.planRestaurarPrivado({salt: 'ZZZ'}, filas)
  assert.equal(otro.importar.length, 0)
  assert.equal(otro.omitidas, 2)
  assert.equal(P.planRestaurarPrivado(undefined, [{mes: '2026-11'}]).importar.length, 0, 'sin _meta no se importa')
})

test('base de datos: v9 agregó la tabla (hoy la base va por la v11) sin tocar lo anterior; se guarda cifrado y se lee; bloque vacío borra la fila', async () => {
  const {db} = await import('../src/data/db.js')
  await db.open()
  assert.equal(db.verno, 11)
  await db.habitos.put({fecha: '2026-11-02', agua: 500})
  const D = await import('../src/data/privado.js')
  assert.equal(await D.hayClave(), false)
  const key = await D.crearClave('frase de prueba 1')
  assert.equal(await D.hayClave(), true)
  const b = P.agregarEv(P.ponerDia(P.bloqueVacio(), '2026-11-02', {man: true, dur: 2, lib: 5}), {
    t: '2026-11-02T15:00:00Z',
    ctx: 'solo'
  })
  await D.guardarMes(key, '2026-11', b)
  const fila = await db.privado.get('2026-11')
  const crudo = JSON.stringify(fila)
  for (const s of ['2026-11-02', 'solo', '"lib"']) assert.equal(crudo.includes(s), false, s)
  assert.deepEqual(await D.leerMes(key, '2026-11'), b)
  assert.deepEqual(await D.leerMes(key, '2026-10'), P.bloqueVacio())
  assert.equal((await db.habitos.get('2026-11-02')).agua, 500)
  assert.equal(await D.abrir('mala'), null)
  assert.ok(await D.abrir('frase de prueba 1'))
  await D.guardarMes(key, '2026-11', P.bloqueVacio())
  assert.equal(await db.privado.get('2026-11'), undefined)
  await D.guardarMes(key, '2026-11', b)
})

test('cambiar clave: todo se vuelve a cifrar, la vieja deja de abrir y los datos siguen', async () => {
  const D = await import('../src/data/privado.js')
  const {db} = await import('../src/data/db.js')
  const vieja = await D.abrir('frase de prueba 1')
  const antes = await D.leerMes(vieja, '2026-11')
  const nueva = await D.cambiarClave(vieja, 'otra frase nueva 2')
  assert.equal(await D.abrir('frase de prueba 1'), null)
  assert.ok(await D.abrir('otra frase nueva 2'))
  assert.deepEqual(await D.leerMes(nueva, '2026-11'), antes)
  assert.equal(await db.privado.count(), 2, '_meta + un mes')
})

test('backup: el registro privado viaja solo cifrado y vuelve; otra clave no se mezcla; borrar todo vacía', async () => {
  const {db} = await import('../src/data/db.js')
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  const D = await import('../src/data/privado.js')
  const key = await D.abrir('otra frase nueva 2')
  const original = await D.leerMes(key, '2026-11')
  const d = await armarBackup()
  const texto = JSON.stringify(d)
  assert.equal(d.privado.length, 2)
  const soloPriv = JSON.stringify(d.privado)
  for (const s of ['2026-11-02', 'solo', '"lib"', '"man"']) assert.equal(soloPriv.includes(s), false, s)
  for (const s of ['otra frase nueva 2', 'frase de prueba']) assert.equal(texto.includes(s), false, 'la clave no viaja: ' + s)

  // equipo nuevo (sin menú): se importa y abre con la misma clave
  await D.borrarTodo()
  assert.equal(await D.hayClave(), false)
  assert.equal(await restaurar(JSON.parse(texto)), 0)
  const k2 = await D.abrir('otra frase nueva 2')
  assert.ok(k2)
  assert.deepEqual(await D.leerMes(k2, '2026-11'), original)

  // equipo con otra clave: las filas del backup se omiten y lo local queda intacto
  await D.borrarTodo()
  const kx = await D.crearClave('clave distinta del equipo')
  await D.guardarMes(kx, '2026-09', P.ponerDia(P.bloqueVacio(), '2026-09-01', {lib: 2}))
  const omitidas = await restaurar(JSON.parse(texto))
  assert.equal(omitidas, 2)
  assert.ok(await D.abrir('clave distinta del equipo'))
  assert.equal(await db.privado.get('2026-11'), undefined)
  assert.equal((await D.leerMes(kx, '2026-09')).dias['2026-09-01'].lib, 2)

  // un backup viejo, sin la tabla, no toca el registro privado
  await restaurar({_meta: {app: 'MMV'}, habitos: []})
  assert.equal(await db.privado.count(), 2)
  await D.borrarTodo()
  assert.equal(await D.hayClave(), false)
})

test('nada se filtra: solo el menú privado, la base y el backup conocen esta tabla', () => {
  const permitidos = new Set([
    'src/domain/privado.js',
    'src/data/privado.js',
    'src/data/db.js',
    'src/data/backup.js',
    'src/features/bienestar/Bienestar.jsx',
    'src/App.jsx'
  ])
  const todos = []
  const rec = d => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      statSync(p).isDirectory() ? rec(p) : /\.(js|jsx)$/.test(n) && todos.push(p)
    }
  }
  rec('src')
  const intrusos = todos.filter(p => !permitidos.has(p) && /privado|bienestar/i.test(readFileSync(p, 'utf8')))
  assert.deepEqual(intrusos, [], 'ningún otro archivo (IA, informe, coach, preparación, progreso, Hoy…) menciona el menú privado')
  // y los permitidos no se cuelan en la IA/informe: ninguno de ellos es importado por esos módulos
  for (const p of ['src/services/ia.js', 'src/domain/informe.js', 'src/domain/preparacion.js', 'src/features/coach/Coach.jsx'])
    assert.equal(/privado|bienestar/i.test(readFileSync(p, 'utf8')), false, p)
})
