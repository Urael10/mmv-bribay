// Entrega 41 (v0.42.0) · recordatorios con notificaciones locales (Capacitor): lógica pura (src/domain/recordatorios.js),
// adaptador (src/platform/notificaciones.js), servicio (src/features/recordatorios), manifiesto de Android y reglas.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs'

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

import {
  CONFIG_BASE, CLAVE_CFG, DIAS_VENTANA, MIN_ANTES_ACOSTARTE, INTERVALOS_AGUA,
  normalizarConfig, hayActivos, horasDeAgua, planRecordatorios, estadoAcostarte, diaDe
} from '../src/domain/recordatorios.js'
import {crearNotificaciones, CANAL} from '../src/platform/notificaciones.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const existe = f => existsSync(new URL('../' + f, import.meta.url))
const archivos = d => {
  const r = []
  for (const n of readdirSync(new URL('../' + d + '/', import.meta.url))) {
    const ruta = d + '/' + n
    if (statSync(new URL('../' + ruta, import.meta.url)).isDirectory()) r.push(...archivos(ruta))
    else r.push(ruta)
  }
  return r
}
const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime()
const todo = {
  checkin: {on: true, hora: '21:00'},
  acostarte: {on: true},
  agua: {on: true, desde: '09:00', hasta: '21:00', cada: 3}
}
const solo = tipo => ({
  checkin: {...CONFIG_BASE.checkin, on: tipo === 'checkin'},
  acostarte: {on: tipo === 'acostarte'},
  agua: {...CONFIG_BASE.agua, on: tipo === 'agua'}
})
const HOY = '2026-11-09'
const AHORA = local(2026, 11, 9, 10, 0)
const noche = (fecha, acosto, desperto) => ({fecha, acosto, desperto})
const habitual2330 = [noche('2026-11-07', '23:30', '07:15'), noche('2026-11-08', '23:30', '07:15')]

// ---------- configuración ----------
test('normalizarConfig: sin nada guardado, todo apagado y con horas razonables', () => {
  for (const crudo of [null, undefined, '', 'no es json', '[]', 42]) {
    const c = normalizarConfig(crudo)
    assert.deepEqual(c, CONFIG_BASE, String(crudo))
    assert.equal(hayActivos(c), false)
  }
})

test('normalizarConfig: acepta texto JSON o un objeto y descarta lo inválido sin lanzar', () => {
  const c = normalizarConfig(JSON.stringify({checkin: {on: true, hora: '7:05'}, agua: {on: true, desde: 'x', cada: 5}}))
  assert.equal(c.checkin.on, true)
  assert.equal(c.checkin.hora, '07:05') // se completa a dos cifras
  assert.equal(c.agua.desde, '09:00') // hora inválida → la de siempre
  assert.equal(c.agua.cada, 3) // intervalo fuera de la lista → el de siempre
  assert.equal(normalizarConfig({acostarte: {on: 'si'}}).acostarte.on, false) // solo `true` activa
  assert.equal(normalizarConfig({agua: {on: true, desde: '21:00', hasta: '09:00'}}).agua.hasta, '21:00') // franja al revés → base
  assert.equal(hayActivos(normalizarConfig(todo)), true)
})

test('horasDeAgua: de «desde» a «hasta» inclusive, cada N horas', () => {
  assert.deepEqual(horasDeAgua({desde: '09:00', hasta: '21:00', cada: 3}), [540, 720, 900, 1080, 1260])
  assert.equal(horasDeAgua({desde: '09:00', hasta: '21:00', cada: 2}).length, 7)
  assert.deepEqual(horasDeAgua({desde: '09:00', hasta: '10:00', cada: 4}), [540])
  assert.deepEqual(horasDeAgua({desde: 'x', hasta: '10:00', cada: 3}), [])
  assert.deepEqual(INTERVALOS_AGUA, [2, 3, 4])
})

// ---------- plan ----------
test('plan: sin nada activo, con ahora inválido o con fecha inválida no hay avisos', () => {
  assert.deepEqual(planRecordatorios({config: CONFIG_BASE, ahoraMs: AHORA, hoy: HOY}), [])
  assert.deepEqual(planRecordatorios({config: todo, ahoraMs: NaN, hoy: HOY}), [])
  assert.deepEqual(planRecordatorios({config: todo, ahoraMs: AHORA, hoy: 'hoy'}), [])
})

test('plan · check-in: uno por día a la hora elegida, 7 días; el de hoy se salta si ya pasó o ya lo hiciste', () => {
  const p = planRecordatorios({config: solo('checkin'), ahoraMs: AHORA, hoy: HOY})
  assert.equal(p.length, DIAS_VENTANA)
  assert.ok(p.every(x => x.tipo === 'checkin'))
  assert.equal(p[0].cuando, local(2026, 11, 9, 21, 0))
  assert.equal(p[6].cuando, local(2026, 11, 15, 21, 0))
  // ya pasó la hora de hoy
  const tarde = planRecordatorios({config: solo('checkin'), ahoraMs: local(2026, 11, 9, 21, 30), hoy: HOY})
  assert.equal(tarde.length, 6)
  assert.equal(tarde[0].cuando, local(2026, 11, 10, 21, 0))
  // check-in de hoy completo: hoy no, mañana sí
  const hecho = [{fecha: HOY, energia: 3, animo: 4, dolor: 2}]
  const p2 = planRecordatorios({config: solo('checkin'), ahoraMs: AHORA, hoy: HOY, habitos: hecho})
  assert.equal(p2.length, 6)
  assert.equal(p2[0].cuando, local(2026, 11, 10, 21, 0))
  // a medias (falta el dolor) no cuenta como hecho
  const media = [{fecha: HOY, energia: 3, animo: 4}]
  assert.equal(planRecordatorios({config: solo('checkin'), ahoraMs: AHORA, hoy: HOY, habitos: media}).length, 7)
})

test('plan · agua: franja y frecuencia elegidas; con la meta cumplida hoy no insiste, mañana sigue', () => {
  const p = planRecordatorios({config: solo('agua'), ahoraMs: AHORA, hoy: HOY, metaAgua: 2500})
  // hoy quedan 12, 15, 18 y 21 (las 9 ya pasaron) + 5 por cada uno de los 6 días siguientes
  assert.equal(p.length, 4 + 6 * 5)
  assert.equal(p[0].cuando, local(2026, 11, 9, 12, 0))
  const cumplida = planRecordatorios({
    config: solo('agua'), ahoraMs: AHORA, hoy: HOY, metaAgua: 2500, habitos: [{fecha: HOY, agua: 2500}]
  })
  assert.equal(cumplida.length, 6 * 5)
  assert.equal(cumplida[0].cuando, local(2026, 11, 10, 9, 0))
  // con 2000 de 2500 todavía falta: sigue avisando hoy
  const falta = planRecordatorios({
    config: solo('agua'), ahoraMs: AHORA, hoy: HOY, metaAgua: 2500, habitos: [{fecha: HOY, agua: 2000}]
  })
  assert.equal(falta.length, 4 + 6 * 5)
  // sin meta conocida (0) nunca se da por cumplida
  const sinMeta = planRecordatorios({config: solo('agua'), ahoraMs: AHORA, hoy: HOY, habitos: [{fecha: HOY, agua: 9999}]})
  assert.equal(sinMeta.length, 4 + 6 * 5)
})

test('plan · acostarte: 30 min antes de tu hora habitual; sin hora habitual no se programa nada', () => {
  assert.equal(MIN_ANTES_ACOSTARTE, 30)
  assert.deepEqual(planRecordatorios({config: solo('acostarte'), ahoraMs: AHORA, hoy: HOY, habitos: []}), [])
  // un solo día con las dos horas no alcanza (se pide al menos 2)
  assert.deepEqual(
    planRecordatorios({config: solo('acostarte'), ahoraMs: AHORA, hoy: HOY, habitos: [habitual2330[0]]}), [])
  const p = planRecordatorios({config: solo('acostarte'), ahoraMs: AHORA, hoy: HOY, habitos: habitual2330})
  assert.equal(p.length, 7)
  assert.equal(p[0].cuando, local(2026, 11, 9, 23, 0))
  assert.match(p[0].cuerpo, /23:30/)
  // ya pasaron las 23:00 de hoy: arranca mañana
  const tarde = planRecordatorios({
    config: solo('acostarte'), ahoraMs: local(2026, 11, 9, 23, 10), hoy: HOY, habitos: habitual2330
  })
  assert.equal(tarde.length, 6)
  assert.equal(tarde[0].cuando, local(2026, 11, 10, 23, 0))
})

test('plan · acostarte pasada la medianoche: el aviso de la noche de hoy cae a las 00:00 de mañana', () => {
  const hs = [noche('2026-11-07', '00:30', '08:00'), noche('2026-11-08', '00:30', '08:00')]
  const p = planRecordatorios({config: solo('acostarte'), ahoraMs: AHORA, hoy: HOY, habitos: hs})
  assert.equal(p[0].cuando, local(2026, 11, 10, 0, 0))
  assert.equal(p.length, 7)
  assert.match(p[0].cuerpo, /00:30/)
})

test('plan · todo junto: ordenado por hora, ids únicos desde 1, ventana de 7 días, textos no vacíos', () => {
  const p = planRecordatorios({config: todo, ahoraMs: AHORA, hoy: HOY, habitos: habitual2330, metaAgua: 2500})
  assert.equal(p.length, 6 + 6 * 7) // hoy: 4 de agua + check-in + acostarte = 6; cada uno de los 6 días siguientes: 5 + 1 + 1 = 7
  assert.deepEqual(p.map(x => x.id), p.map((_, i) => i + 1))
  for (let i = 1; i < p.length; i++) assert.ok(p[i].cuando >= p[i - 1].cuando)
  assert.ok(p.every(x => x.cuando > AHORA))
  assert.ok(p.every(x => x.titulo && x.cuerpo && ['checkin', 'acostarte', 'agua'].includes(x.tipo)))
  assert.ok(p[p.length - 1].cuando < local(2026, 11, 16, 0, 0)) // nada fuera de la ventana de 7 días
  // un cambio de hora de verano no corre los avisos: se arman con el calendario (hora del reloj), no sumando ms
  assert.equal(new Date(p.find(x => x.tipo === 'checkin').cuando).getHours(), 21)
})

test('estadoAcostarte y diaDe', () => {
  assert.deepEqual(estadoAcostarte([], HOY), {listo: false})
  assert.deepEqual(estadoAcostarte(habitual2330, HOY), {listo: true, acosto: '23:30', dias: 2})
  assert.equal(diaDe(local(2026, 11, 9, 23, 59)), '2026-11-09')
  assert.equal(diaDe(local(2026, 1, 5, 0, 0)), '2026-01-05')
})

// ---------- adaptador (src/platform/notificaciones.js) con un plugin de mentira ----------
function plugin({display = 'granted', pendientes = [], falla = null} = {}) {
  const llamadas = []
  const reg = (n, r) => async a => {
    llamadas.push([n, a])
    if (falla === n) throw new Error('falló ' + n)
    return typeof r === 'function' ? r(a) : r
  }
  return {
    llamadas,
    nombres: () => llamadas.map(l => l[0]),
    checkPermissions: reg('checkPermissions', {display}),
    requestPermissions: reg('requestPermissions', {display: 'granted'}),
    getPending: reg('getPending', {notifications: pendientes}),
    cancel: reg('cancel', undefined),
    createChannel: reg('createChannel', undefined),
    schedule: reg('schedule', undefined)
  }
}
const adaptador = (p, android = true) => {
  const cargas = {n: 0}
  const a = crearNotificaciones({cargar: async () => (cargas.n++, {plugin: p}), android: () => android})
  return {a, cargas}
}
const PLAN = [
  {id: 1, cuando: local(2026, 11, 9, 12, 0), tipo: 'agua', titulo: 'Agua', cuerpo: 'Un vaso'},
  {id: 2, cuando: local(2026, 11, 9, 21, 0), tipo: 'checkin', titulo: 'Check-in', cuerpo: '3 toques'}
]

test('adaptador · en el navegador / la PWA no está disponible y nunca toca el plugin', async () => {
  const p = plugin(),
    {a, cargas} = adaptador(p, false)
  assert.equal(a.disponible(), false)
  assert.equal(await a.permiso(), 'no-disponible')
  assert.equal(await a.pedirPermiso(), 'no-disponible')
  assert.deepEqual(await a.programar(PLAN), {ok: false, motivo: 'no-disponible'})
  assert.deepEqual(await a.cancelarTodo(), {ok: false, motivo: 'no-disponible'})
  assert.equal(cargas.n, 0) // el plugin ni siquiera se carga
  assert.deepEqual(p.llamadas, [])
})

test('adaptador · sin permiso concedido NO programa (el plugin pediría el permiso solo): ni cancela ni agenda', async () => {
  for (const display of ['prompt', 'prompt-with-rationale', 'denied']) {
    const p = plugin({display, pendientes: [{id: 9}]}),
      {a} = adaptador(p)
    assert.deepEqual(await a.programar(PLAN), {ok: false, motivo: 'sin-permiso'}, display)
    assert.deepEqual(p.nombres(), ['checkPermissions'], display)
  }
})

test('adaptador · el permiso se mapea a granted / denied / prompt y solo se pide al llamar pedirPermiso', async () => {
  const mapa = {granted: 'granted', denied: 'denied', prompt: 'prompt', 'prompt-with-rationale': 'prompt'}
  for (const [crudo, esperado] of Object.entries(mapa)) {
    const p = plugin({display: crudo}),
      {a} = adaptador(p)
    assert.equal(await a.permiso(), esperado, crudo)
    assert.ok(!p.nombres().includes('requestPermissions'), 'permiso() no debe mostrar el diálogo')
  }
  const p = plugin({display: 'prompt'}),
    {a} = adaptador(p)
  assert.equal(await a.pedirPermiso(), 'granted')
  assert.deepEqual(p.nombres(), ['requestPermissions'])
})

test('adaptador · con permiso: cancela lo anterior, crea el canal y agenda inexactas con alarma en reposo', async () => {
  const p = plugin({pendientes: [{id: 7}, {id: 8}]}),
    {a} = adaptador(p)
  assert.deepEqual(await a.programar(PLAN), {ok: true, n: 2})
  assert.deepEqual(p.nombres(), ['checkPermissions', 'getPending', 'cancel', 'createChannel', 'schedule'])
  assert.deepEqual(p.llamadas.find(l => l[0] === 'cancel')[1], {notifications: [{id: 7}, {id: 8}]})
  assert.deepEqual(p.llamadas.find(l => l[0] === 'createChannel')[1], CANAL)
  const {notifications} = p.llamadas.find(l => l[0] === 'schedule')[1]
  assert.equal(notifications.length, 2)
  for (const [i, n] of notifications.entries()) {
    assert.equal(n.id, PLAN[i].id)
    assert.equal(n.title, PLAN[i].titulo)
    assert.equal(n.body, PLAN[i].cuerpo)
    assert.equal(n.channelId, 'recordatorios')
    assert.equal(n.isExactNotification, false) // sin SCHEDULE_EXACT_ALARM
    assert.equal(n.schedule.allowWhileIdle, true)
    assert.ok(n.schedule.at instanceof Date)
    assert.equal(n.schedule.at.getTime(), PLAN[i].cuando)
    assert.equal(n.extra.tipo, PLAN[i].tipo)
  }
})

test('adaptador · plan vacío: solo deja todo cancelado (sin crear canal ni agendar); sin pendientes no cancela', async () => {
  const p = plugin({pendientes: [{id: 1}]}),
    {a} = adaptador(p)
  assert.deepEqual(await a.programar([]), {ok: true, n: 0})
  assert.deepEqual(p.nombres(), ['checkPermissions', 'getPending', 'cancel'])
  const q = plugin(),
    {a: b} = adaptador(q)
  assert.deepEqual(await b.programar([]), {ok: true, n: 0})
  assert.deepEqual(q.nombres(), ['checkPermissions', 'getPending'])
})

test('adaptador · cancelarTodo y errores del plugin devuelven {ok:false} sin lanzar', async () => {
  const p = plugin({pendientes: [{id: 3}]}),
    {a} = adaptador(p)
  assert.deepEqual(await a.cancelarTodo(), {ok: true, n: 0})
  assert.deepEqual(p.llamadas.find(l => l[0] === 'cancel')[1], {notifications: [{id: 3}]})
  for (const falla of ['schedule', 'getPending', 'createChannel']) {
    const q = plugin({falla}),
      {a: b} = adaptador(q)
    const r = await b.programar(PLAN)
    assert.equal(r.ok, false, falla)
    assert.equal(r.motivo, 'error', falla)
    assert.match(r.detalle, new RegExp(falla))
  }
  const sinPlugin = crearNotificaciones({cargar: async () => { throw new Error('sin plugin') }, android: () => true})
  assert.equal(await sinPlugin.permiso(), 'no-disponible')
  assert.equal((await sinPlugin.programar(PLAN)).ok, false)
})

test('adaptador · el plugin de Capacitor es un Proxy que responde a `then`: nunca se devuelve ni se resuelve con él', async () => {
  // Réplica del comportamiento real: pedir `then` al plugin lo «llama» y rompe (en el celular dejaba el permiso colgado).
  const base = plugin({pendientes: [{id: 4}]}),
    trampa = {then: 0}
  const proxy = new Proxy(
    {},
    {
      get(_, k) {
        if (k === 'then') {
          trampa.then++
          return () => { throw new Error('"then()" is not implemented on android') }
        }
        return base[k]
      }
    }
  )
  const a = crearNotificaciones({cargar: async () => ({plugin: proxy}), android: () => true})
  assert.equal(await a.permiso(), 'granted')
  assert.equal(await a.pedirPermiso(), 'granted')
  assert.deepEqual(await a.programar(PLAN), {ok: true, n: 2})
  assert.deepEqual(await a.cancelarTodo(), {ok: true, n: 0})
  assert.equal(trampa.then, 0, 'se le pidió `then` al plugin: alguna promesa lo resolvió como si fuera un thenable')
  // y la carga real también lo envuelve
  assert.match(leer('src/platform/notificaciones.js'), /\.then\(m => \(\{plugin: m\.LocalNotifications\}\)\)/)
})

// ---------- servicio (src/features/recordatorios/servicio.js) con base simulada ----------
const {db, hoy} = await import('../src/data/db.js')
const {reprogramar, leerConfig, guardarConfig} = await import('../src/features/recordatorios/servicio.js')
const falsa = ({disponible = true} = {}) => {
  const llamadas = []
  return {
    llamadas,
    disponible: () => disponible,
    programar: async plan => (llamadas.push(['programar', plan]), {ok: true, n: plan.length}),
    cancelarTodo: async () => (llamadas.push(['cancelarTodo']), {ok: true, n: 0})
  }
}

test('servicio · en la PWA no hace nada; sin recordatorios activos y sin haber programado nunca, tampoco', async () => {
  const web = falsa({disponible: false})
  assert.deepEqual(await reprogramar(web), {ok: false, motivo: 'no-disponible'})
  assert.deepEqual(web.llamadas, [])
  const n = falsa()
  assert.deepEqual(await reprogramar(n), {ok: true, n: 0})
  assert.deepEqual(n.llamadas, []) // nunca se activó nada: ni se carga el plugin
})

test('servicio · activa, lee la base, programa el plan de verdad y después, al apagar todo, cancela una sola vez', async () => {
  const f = hoy()
  await db.habitos.put({fecha: f, agua: 0, energia: 3, animo: 3, dolor: 3}) // check-in de hoy hecho
  guardarConfig({...CONFIG_BASE, checkin: {on: true, hora: '21:00'}, agua: {...CONFIG_BASE.agua, on: true}})
  assert.equal(leerConfig().checkin.on, true)
  assert.ok(mem['mv_' + CLAVE_CFG]) // se guarda con cfg(): localStorage «mv_recordatorios», no en Dexie
  const n = falsa()
  const r = await reprogramar(n)
  assert.equal(r.ok, true)
  const plan = n.llamadas[0][1]
  assert.equal(n.llamadas.length, 1)
  assert.ok(plan.length > 0 && plan.length === r.n)
  assert.ok(plan.every(x => x.cuando > Date.now()))
  assert.ok(!plan.some(x => x.tipo === 'checkin' && diaDe(x.cuando) === f), 'el check-in de hoy ya está hecho')
  assert.equal(mem.mv_rec_programado, '1')
  // se apaga todo: se cancela lo programado y se limpia la marca
  guardarConfig(CONFIG_BASE)
  const m = falsa()
  assert.equal((await reprogramar(m)).ok, true)
  assert.deepEqual(m.llamadas, [['cancelarTodo']])
  assert.equal(mem.mv_rec_programado, undefined)
  const otra = falsa()
  await reprogramar(otra)
  assert.deepEqual(otra.llamadas, []) // ya no hay nada que cancelar
})

test('servicio · dos reprogramaciones a la vez se ejecutan de a una (no quedan avisos duplicados)', async () => {
  guardarConfig({...CONFIG_BASE, agua: {...CONFIG_BASE.agua, on: true}})
  const orden = []
  const lenta = {
    disponible: () => true,
    programar: async plan => {
      orden.push('ini')
      await new Promise(r => setTimeout(r, 30))
      orden.push('fin')
      return {ok: true, n: plan.length}
    },
    cancelarTodo: async () => ({ok: true, n: 0})
  }
  await Promise.all([reprogramar(lenta), reprogramar(lenta), reprogramar(lenta)])
  assert.deepEqual(orden, ['ini', 'fin', 'ini', 'fin', 'ini', 'fin'])
  guardarConfig(CONFIG_BASE)
  await reprogramar(falsa())
})

test('servicio · si falta el permiso devuelve el motivo y no marca nada como programado', async () => {
  delete mem.mv_rec_programado
  guardarConfig({...CONFIG_BASE, agua: {...CONFIG_BASE.agua, on: true}})
  const sin = {disponible: () => true, programar: async () => ({ok: false, motivo: 'sin-permiso'}), cancelarTodo: async () => ({ok: true})}
  assert.deepEqual(await reprogramar(sin), {ok: false, motivo: 'sin-permiso'})
  assert.equal(mem.mv_rec_programado, undefined)
  guardarConfig(CONFIG_BASE)
})

// ---------- reglas de arquitectura y de Android ----------
test('arquitectura: el plugin solo lo importa src/platform; el dominio sigue puro; la base solo se toca desde features', () => {
  for (const f of archivos('src').filter(f => /\.(js|jsx)$/.test(f) && !f.startsWith('src/platform/')))
    assert.doesNotMatch(leer(f), /@capacitor\//, f)
  assert.match(leer('src/platform/notificaciones.js'), /import\('@capacitor\/local-notifications'\)/)
  const dom = leer('src/domain/recordatorios.js').replace(/\/\/.*$/gm, '') // sin comentarios
  assert.doesNotMatch(dom, /from 'react|data\/|platform\/|localStorage|document\.|window\.|Date\.now|new Date\(\)/)
  for (const f of ['src/platform/notificaciones.js', 'src/domain/recordatorios.js'])
    assert.doesNotMatch(leer(f).replace(/\/\/.*$/gm, ''), /Dexie|db\.|data\/db/, f)
  // el servicio y la pantalla viven en features/ (ahí se puede tocar la base) y no importan el plugin
  for (const f of archivos('src/features/recordatorios')) assert.doesNotMatch(leer(f), /@capacitor\//, f)
})

test('permiso: se pide solo al activar un recordatorio; nunca al abrir la app ni al montar la pantalla', () => {
  const ui = leer('src/features/recordatorios/Recordatorios.jsx')
  assert.equal([...ui.matchAll(/pedirPermiso\(/g)].length, 1)
  const dentro = ui.slice(ui.indexOf('const aplicar'), ui.indexOf('const cambia'))
  assert.match(dentro, /if \(activando\)/)
  assert.match(dentro, /pedirPermiso\(\)/)
  // y en los dos lugares que corren sin que nadie toque nada, nunca
  for (const f of ['src/features/recordatorios/servicio.js', 'src/features/recordatorios/useRecordatorios.js', 'src/App.jsx'])
    assert.doesNotMatch(leer(f), /pedirPermiso/, f)
  // activar pasa «activando» solo al marcar (no al desmarcar ni al cambiar una hora)
  assert.match(ui, /cambia\('checkin', \{on: e\.target\.checked\}, e\.target\.checked\)/)
  assert.match(ui, /cambia\('acostarte', \{on: e\.target\.checked\}, e\.target\.checked\)/)
  assert.match(ui, /cambia\('agua', \{on: e\.target\.checked\}, e\.target\.checked\)/)
  assert.match(ui, /e\.target\.value && cambia\('checkin', \{hora: e\.target\.value\}\)/)
})

test('PWA: la pantalla lo dice explícito y no ofrece nada que no pueda cumplir', () => {
  const ui = leer('src/features/recordatorios/Recordatorios.jsx')
  assert.match(ui, /if \(!nativo\)/)
  assert.match(ui, /funcionan en la app de Android/)
  assert.match(ui, /navegador no se pueden mostrar avisos con la app cerrada/)
  assert.doesNotMatch(ui, /Notification\.requestPermission|new Notification\(/)
  assert.doesNotMatch(leer('src/platform/notificaciones.js'), /Notification\.requestPermission|new Notification\(/)
  assert.match(leer('src/features/ajustes/Ajustes.jsx'), /<Recordatorios \/>/)
  assert.match(leer('src/App.jsx'), /useRecordatorios\(\)/)
})

test('AndroidManifest: ubicación sí; SCHEDULE_EXACT_ALARM se quita; el plugin aporta el resto', () => {
  const m = leer('android/app/src/main/AndroidManifest.xml')
  assert.match(m, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/)
  assert.match(m, /<uses-permission android:name="android\.permission\.INTERNET" \/>/)
  assert.match(m, /<uses-permission android:name="android\.permission\.ACCESS_FINE_LOCATION" \/>/)
  assert.match(m, /<uses-permission android:name="android\.permission\.ACCESS_COARSE_LOCATION" \/>/)
  assert.match(m, /<uses-permission android:name="android\.permission\.SCHEDULE_EXACT_ALARM" tools:node="remove" \/>/)
  // el manifiesto propio no declara a mano lo que ya trae el plugin (se fusiona al compilar)
  for (const p of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK', 'USE_EXACT_ALARM', 'USE_FULL_SCREEN_INTENT', 'FOREGROUND_SERVICE'])
    assert.doesNotMatch(m.replace(/<!--[\s\S]*?-->/g, ''), new RegExp(p), p)
  // sin permisos de más: micrófono, contactos, ubicación en segundo plano.
  // Entrega 42 (v0.43.0): la cámara (escáner y foto de la pizarra) y la vibración se permiten a propósito (ver entrega43.test.js).
  assert.doesNotMatch(m, /RECORD_AUDIO|CONTACTS|BACKGROUND_LOCATION/)
})

test('Android: ícono monocromo de la barra de estado, canal y config de Capacitor; appId y esquema no cambian', () => {
  const ic = leer('android/app/src/main/res/drawable/ic_stat_mmv.xml')
  assert.match(ic, /<vector /)
  assert.match(ic, /#FFFFFFFF/) // silueta blanca: el sistema la tiñe
  const cfg = leer('capacitor.config.ts')
  assert.match(cfg, /LocalNotifications: \{\s*smallIcon: 'ic_stat_mmv',\s*iconColor: '#22D3EE'/)
  assert.match(cfg, /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(cfg, /server: \{androidScheme: 'https'\}/)
  assert.match(leer('src/tokens.css'), /--ac:\s*#22d3ee/i) // el acento de la notificación es el de la app
  assert.equal(CANAL.id, 'recordatorios')
  assert.ok(CANAL.importance >= 3)
  // lo que genera «cap sync» y va versionado incluye el plugin
  assert.match(leer('android/capacitor.settings.gradle'), /node_modules\/@capacitor\/local-notifications\/android/)
  assert.match(leer('android/app/capacitor.build.gradle'), /implementation project\(':capacitor-local-notifications'\)/)
})

test('dependencia: @capacitor/local-notifications ^8.3 con el lock coherente; las demás versiones no se movieron', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  assert.match(pkg.dependencies['@capacitor/local-notifications'], /^\^8\.3\./)
  assert.match(lock.packages['node_modules/@capacitor/local-notifications'].version, /^8\.3\./)
  assert.match(lock.packages['node_modules/@capacitor/core'].version, /^8\./)
  assert.equal(pkg.dependencies.dexie, '^4.4.7')
})

test('sin cambios de datos: Dexie sigue en v11 (sin v12) y la configuración no va a la base', () => {
  const dbjs = leer('src/data/db.js')
  assert.match(dbjs, /db\.version\(11\)/)
  assert.doesNotMatch(dbjs, /db\.version\(12\)/)
  assert.match(leer('src/features/recordatorios/servicio.js'), /setCfg\(CLAVE_CFG/)
})

test('versión 0.42.0 / entrega 41 con su nota en el CHANGELOG y su sección en el README; la historia sigue', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 42, pkg.version)
  assert.ok(Number(pkg.entrega) >= 41)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  const cl = leer('CHANGELOG.md')
  assert.match(cl, /## v0\.42\.0 · Entrega 41 · Recordatorios con notificaciones locales/)
  for (const v of [/## v0\.41\.0 · Entrega 40/, /## v0\.40\.0 · Entrega 39/, /## v0\.39\.0 · Entrega 38/, /## v0\.38\.0 · Entrega 37/])
    assert.match(cl, v)
  const readme = leer('README.md')
  assert.match(readme, /## Recordatorios \(v0\.42\.0\)/)
  assert.match(readme, /Entrega \d+ \(v0\.\d+\.\d+\)/)
  assert.ok(existe('tests/entrega41.test.js') && existe('tests/entrega42.test.js'))
})

test('versionCode del APK: 0.42.0 → 4200, mayor que el 4100 del APK instalado', () => {
  const g = leer('android/app/build.gradle')
  assert.match(g, /partesVersion\[0\]\.toInteger\(\) \* 10000 \+ partesVersion\[1\]\.toInteger\(\) \* 100 \+ partesVersion\[2\]\.toInteger\(\)/)
  const [a, b, c] = JSON.parse(leer('package.json')).version.split('.').map(Number)
  assert.ok(a * 10000 + b * 100 + c > 4100)
})
