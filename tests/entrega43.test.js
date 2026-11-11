// Entrega 42 (v0.43.0) · check-in con extremos, Comidas plano, avisos que abren su pantalla, recordatorio de backup semanal,
// archivos y botón atrás en Android (adaptadores, lógica pura, manifiesto, reglas de arquitectura).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'

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
  CONFIG_BASE, TIPOS, DIAS_SEMANA, DIAS_VENTANA, normalizarConfig, planRecordatorios, destinoDeAviso
} from '../src/domain/recordatorios.js'
import {accionAtras, OVERLAYS_QUE_BLOQUEAN} from '../src/domain/navegacion.js'
import {CHECKIN} from '../src/domain/checkin.js'
import {crearArchivos, nombreSeguro} from '../src/platform/archivos.js'
import {crearAtras} from '../src/platform/atras.js'
import {crearNotificaciones} from '../src/platform/notificaciones.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const archivosDe = d => {
  const r = []
  for (const n of readdirSync(new URL('../' + d + '/', import.meta.url))) {
    const ruta = d + '/' + n
    if (statSync(new URL('../' + ruta, import.meta.url)).isDirectory()) r.push(...archivosDe(ruta))
    else r.push(ruta)
  }
  return r
}
const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime()
const soloBackup = extra => ({...CONFIG_BASE, backup: {on: true, dia: 0, hora: '20:00', ...extra}})
const HOY = '2026-11-09' // lunes
const AHORA = local(2026, 11, 9, 10, 0)

// Un plugin de Capacitor es un Proxy que responde a `then`: si algo lo devuelve o lo resuelve, se rompe.
const proxyTrampa = base => {
  const t = {then: 0}
  const proxy = new Proxy(
    {},
    {
      get(_, k) {
        if (k === 'then') {
          t.then++
          return () => {
            throw new Error('"then()" is not implemented on android')
          }
        }
        return base[k]
      }
    }
  )
  return {proxy, t}
}

// ---------- check-in ----------
test('check-in · cada escala tiene palabras cortas para los extremos y conserva la descripción completa', () => {
  assert.equal(CHECKIN.length, 3)
  for (const c of CHECKIN) {
    assert.ok(c.ext1 && c.ext5 && c.ext1.length <= 6 && c.ext5.length <= 6, c.k)
    assert.ok(c.bajo && c.alto, c.k)
  }
  const hoy = leer('src/features/hoy/Hoy.jsx')
  assert.match(hoy, /className="ck-ext mu" aria-hidden="true"/)
  assert.doesNotMatch(hoy, /ck-leyenda/)
  assert.match(hoy, /aria-description=\{`1 \$\{c\.bajo\}, 5 \$\{c\.alto\}`\}/)
  assert.doesNotMatch(leer('src/styles.css'), /\.ck-leyenda/)
})

test('Peso · el círculo con ícono ocupa el lugar del anillo (mismo tamaño y grosor)', () => {
  const hoy = leer('src/features/hoy/Hoy.jsx')
  assert.match(hoy, /className="anillo anillo-fijo"[\s\S]{0,120}<Icono n="balanza"/)
  assert.match(leer('src/ui/Icono.jsx'), /balanza:/)
  const css = leer('src/styles.css')
  assert.match(css, /\.anillo-fijo \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border: 4\.4px solid var\(--pista\)/s)
  assert.match(css, /\.anillo-pista,\s*\.anillo-arco \{[^}]*stroke-width: 3\.6;/s) // 3,6 de 36 sobre 44 px = 4,4 px
})

// ---------- configuración y plan del backup semanal ----------
test('backup · configuración: apagado por defecto, domingo 20:00, y lo inválido vuelve al valor de entrada', () => {
  assert.deepEqual(CONFIG_BASE.backup, {on: false, dia: 0, hora: '20:00'})
  assert.ok(TIPOS.includes('backup'))
  assert.deepEqual(DIAS_SEMANA, ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])
  assert.deepEqual(normalizarConfig(null).backup, CONFIG_BASE.backup)
  assert.deepEqual(normalizarConfig({backup: {on: true, dia: '3', hora: '8:05'}}).backup, {on: true, dia: 3, hora: '08:05'})
  for (const malo of [7, -1, 2.5, '', null, 'x'])
    assert.equal(normalizarConfig({backup: {dia: malo}}).backup.dia, 0, String(malo))
  assert.equal(normalizarConfig({backup: {on: 'true'}}).backup.on, false) // solo `true` de verdad activa
})

test('backup · un aviso por semana, el día elegido a la hora elegida, con su tipo en extra para poder navegar', () => {
  const p = planRecordatorios({config: soloBackup({dia: 3, hora: '19:30'}), ahoraMs: AHORA, hoy: HOY}) // miércoles
  assert.equal(p.length, 1)
  assert.equal(p[0].tipo, 'backup')
  assert.equal(p[0].cuando, local(2026, 11, 11, 19, 30))
  assert.match(p[0].titulo, /Backup/)
})

test('backup · ventana de 8 días: si hoy es el día y la hora ya pasó, el de dentro de 7 días exactos queda en el plan', () => {
  const lunesTarde = local(2026, 11, 9, 21, 0)
  const p = planRecordatorios({config: soloBackup({dia: 1, hora: '20:00'}), ahoraMs: lunesTarde, hoy: HOY})
  assert.deepEqual(p.map(x => x.cuando), [local(2026, 11, 16, 20, 0)])
  // y si todavía no pasó la hora, salen el de hoy y el de la semana que viene
  const mañana = planRecordatorios({config: soloBackup({dia: 1, hora: '20:00'}), ahoraMs: AHORA, hoy: HOY})
  assert.deepEqual(mañana.map(x => x.cuando), [local(2026, 11, 9, 20, 0), local(2026, 11, 16, 20, 0)])
  assert.equal(DIAS_VENTANA, 7) // el resto de los avisos sigue en 7 días
})

test('backup · el día en que ya hiciste el backup no se avisa; otro día sí', () => {
  const ya = local(2026, 11, 9, 18, 0)
  const p = planRecordatorios({
    config: soloBackup({dia: 1, hora: '20:00'}), ahoraMs: AHORA, hoy: HOY, ultimoBackup: new Date(ya).toISOString()
  })
  assert.deepEqual(p.map(x => x.cuando), [local(2026, 11, 16, 20, 0)])
  const ayer = planRecordatorios({
    config: soloBackup({dia: 1, hora: '20:00'}), ahoraMs: AHORA, hoy: HOY, ultimoBackup: new Date(local(2026, 11, 8, 12, 0)).toISOString()
  })
  assert.equal(ayer.length, 2)
  // una fecha rota no rompe nada
  assert.equal(planRecordatorios({config: soloBackup({dia: 1}), ahoraMs: AHORA, hoy: HOY, ultimoBackup: 'no-fecha'}).length, 2)
})

test('backup · no cambia el plan de los otros tres avisos (siguen dentro de 7 días)', () => {
  const sin = planRecordatorios({config: {...CONFIG_BASE, checkin: {on: true, hora: '21:00'}}, ahoraMs: AHORA, hoy: HOY})
  const con = planRecordatorios({config: {...CONFIG_BASE, checkin: {on: true, hora: '21:00'}, backup: {on: true, dia: 1, hora: '20:00'}}, ahoraMs: AHORA, hoy: HOY})
  assert.equal(sin.length, 7)
  // los `id` son posicionales (se reasignan al ordenar): lo que no debe cambiar es qué avisos hay y cuándo
  assert.deepEqual(con.filter(x => x.tipo === 'checkin').map(x => x.cuando), sin.map(x => x.cuando))
  assert.equal(sin.filter(x => x.cuando >= local(2026, 11, 16, 0, 0)).length, 0)
})

// ---------- a dónde lleva cada aviso ----------
test('avisos · cada tipo lleva a una pantalla; lo desconocido, a ninguna', () => {
  assert.deepEqual(destinoDeAviso('checkin'), {tab: 'hoy', accion: 'checkin'})
  assert.deepEqual(destinoDeAviso('agua'), {tab: 'hoy', accion: 'agua'})
  assert.deepEqual(destinoDeAviso('acostarte'), {tab: 'hoy', accion: 'sueno'})
  assert.deepEqual(destinoDeAviso('backup'), {tab: 'ajustes', accion: 'backup'})
  for (const t of TIPOS) assert.ok(destinoDeAviso(t), 'sin destino: ' + t)
  for (const raro of ['', 'x', undefined, null, 5]) assert.equal(destinoDeAviso(raro), null)
})

test('avisos · Hoy y Ajustes reaccionan al pedido y tienen a dónde ir', () => {
  const hoy = leer('src/features/hoy/Hoy.jsx')
  assert.match(hoy, /export default function Hoy\(\{[^}]*pedido\}\)/)
  for (const id of ["'hoy-checkin'", "'hoy-agua'", "'hoy-sueno'"]) assert.ok(hoy.includes(id), id)
  assert.match(leer('src/features/ajustes/Ajustes.jsx'), /id="ajustes-backup"/)
  const app = leer('src/App.jsx')
  assert.match(app, /notificaciones\s*\.alTocarAviso/)
  assert.match(app, /destinoDeAviso\(tipo\)/)
})

// ---------- botón atrás ----------
test('atrás · Ajustes vuelve a la pestaña de la que se vino; el resto a Hoy; Hoy sale', () => {
  assert.deepEqual(accionAtras({tab: 'ajustes', previa: 'progreso'}), {tipo: 'ir', tab: 'progreso'})
  assert.deepEqual(accionAtras({tab: 'priv', previa: 'comidas'}), {tipo: 'ir', tab: 'comidas'})
  assert.deepEqual(accionAtras({tab: 'ajustes', previa: 'ajustes'}), {tipo: 'ir', tab: 'hoy'})
  assert.deepEqual(accionAtras({tab: 'ajustes'}), {tipo: 'ir', tab: 'hoy'})
  for (const t of ['entreno', 'comidas', 'progreso']) assert.deepEqual(accionAtras({tab: t, previa: t}), {tipo: 'ir', tab: 'hoy'})
  assert.deepEqual(accionAtras({tab: 'hoy', previa: 'hoy'}), {tipo: 'salir'})
  assert.deepEqual(accionAtras(), {tipo: 'salir'})
})

test('atrás · no actúa con «Dormir con alarma» ni el modo bolsillo abiertos (los selectores existen en el código)', () => {
  assert.equal(OVERLAYS_QUE_BLOQUEAN, '.sueno-ov, .bolsillo-ov')
  assert.match(leer('src/features/sueno/ModoSueno.jsx'), /className="sueno-ov/)
  assert.match(leer('src/features/actividad/ActividadFisica.jsx'), /bolsillo-ov/)
  assert.match(leer('src/App.jsx'), /document\.querySelector\(OVERLAYS_QUE_BLOQUEAN\)/)
})

// ---------- adaptadores ----------
const pluginApp = () => {
  const reg = {llamadas: [], oyentes: []}
  return {
    reg,
    addListener: async (ev, cb) => (reg.oyentes.push({ev, cb}), {remove: async () => reg.llamadas.push('remove')}),
    exitApp: async () => reg.llamadas.push('exitApp')
  }
}

test('adaptador atrás · escucha, sale, deja de escuchar; en la PWA no toca el plugin', async () => {
  const p = pluginApp()
  let cargas = 0
  const a = crearAtras({cargar: async () => (cargas++, {app: p}), android: () => true})
  let veces = 0
  const quitar = await a.alAtras(() => veces++)
  p.reg.oyentes[0].cb({canGoBack: false})
  assert.equal(veces, 1)
  assert.equal(p.reg.oyentes[0].ev, 'backButton')
  assert.equal(await a.salir(), true)
  assert.deepEqual(p.reg.llamadas, ['exitApp'])
  quitar()
  quitar() // idempotente
  assert.equal(cargas, 1)
  const web = crearAtras({cargar: async () => { throw new Error('no debe cargarse') }, android: () => false})
  assert.equal(web.disponible(), false)
  assert.equal(typeof (await web.alAtras(() => {})), 'function')
  assert.equal(await web.salir(), false)
  const roto = crearAtras({cargar: async () => { throw new Error('sin plugin') }, android: () => true})
  assert.equal(typeof (await roto.alAtras(() => {})), 'function')
  assert.equal(await roto.salir(), false)
})

test('adaptador atrás · el plugin (Proxy) nunca se devuelve ni se resuelve suelto', async () => {
  const {proxy, t} = proxyTrampa(pluginApp())
  const a = crearAtras({cargar: async () => ({app: proxy}), android: () => true})
  const quitar = await a.alAtras(() => {})
  quitar()
  assert.equal(await a.salir(), true)
  assert.equal(t.then, 0)
  assert.match(leer('src/platform/atras.js'), /\.then\(m => \(\{app: m\.App\}\)\)/)
})

const pluginNotif = () => {
  const reg = {oyentes: [], quitados: 0}
  return {reg, addListener: async (ev, cb) => (reg.oyentes.push({ev, cb}), {remove: async () => reg.quitados++})}
}

test('adaptador avisos · alTocarAviso entrega el tipo guardado y descarta lo que no lo trae', async () => {
  const p = pluginNotif()
  const a = crearNotificaciones({cargar: async () => ({plugin: p}), android: () => true})
  const vistos = []
  const quitar = await a.alTocarAviso(t => vistos.push(t))
  assert.equal(p.reg.oyentes[0].ev, 'localNotificationActionPerformed')
  const tocar = ev => p.reg.oyentes[0].cb(ev)
  tocar({actionId: 'tap', notification: {id: 1, extra: {tipo: 'agua'}}})
  tocar({actionId: 'tap', notification: {id: 2, extra: {}}})
  tocar({actionId: 'tap', notification: {id: 3}})
  tocar({actionId: 'tap'})
  tocar(undefined)
  tocar({actionId: 'tap', notification: {extra: {tipo: 7}}})
  assert.deepEqual(vistos, ['agua'])
  quitar()
  assert.equal(p.reg.quitados, 1)
  const web = crearNotificaciones({cargar: async () => { throw new Error('no debe cargarse') }, android: () => false})
  assert.equal(typeof (await web.alTocarAviso(() => {})), 'function')
  const roto = crearNotificaciones({cargar: async () => { throw new Error('sin plugin') }, android: () => true})
  assert.equal(typeof (await roto.alTocarAviso(() => {})), 'function')
})

test('adaptador avisos · alTocarAviso tampoco resuelve con el Proxy del plugin', async () => {
  const {proxy, t} = proxyTrampa(pluginNotif())
  const a = crearNotificaciones({cargar: async () => ({plugin: proxy}), android: () => true})
  const quitar = await a.alTocarAviso(() => {})
  quitar()
  assert.equal(t.then, 0)
})

const filesystem = ({fallaEscritura = false} = {}) => {
  const reg = {escrituras: [], compartidos: []}
  return {
    reg,
    fs: {
      writeFile: async o => {
        if (fallaEscritura) throw new Error('disco lleno')
        reg.escrituras.push(o)
        return {uri: 'file:///cache/' + o.path}
      }
    },
    share: {
      share: async o => {
        reg.compartidos.push(o)
        if (reg.falla) throw new Error(reg.falla)
        return {}
      }
    },
    Directory: {Cache: 'CACHE'},
    Encoding: {UTF8: 'utf8'}
  }
}

test('adaptador archivos · escribe en la caché, comparte el archivo y distingue compartido / cancelado / error', async () => {
  const c = filesystem()
  let cargas = 0
  const a = crearArchivos({cargar: async () => (cargas++, c), android: () => true})
  assert.equal(a.disponible(), true)
  assert.equal(await a.compartir('mmv backup 2026-11-10.json', '{"a":1}', 'Backup de MMV'), 'compartido')
  assert.deepEqual(c.reg.escrituras[0], {path: 'mmv_backup_2026-11-10.json', data: '{"a":1}', directory: 'CACHE', encoding: 'utf8'})
  assert.deepEqual(c.reg.compartidos[0], {title: 'Backup de MMV', dialogTitle: 'Backup de MMV', files: ['file:///cache/mmv_backup_2026-11-10.json']})
  c.reg.falla = 'Share canceled'
  assert.equal(await a.compartir('x.gpx', '<gpx/>'), 'cancelado')
  c.reg.falla = 'AbortError'
  assert.equal(await a.compartir('x.gpx', '<gpx/>'), 'cancelado')
  c.reg.falla = 'no hay apps'
  assert.equal(await a.compartir('x.gpx', '<gpx/>'), 'error')
  assert.equal(cargas, 1) // los plugins se bajan una sola vez
})

test('adaptador archivos · sin plugin o sin disco devuelve error sin lanzar; en la PWA no toca nada', async () => {
  const sinDisco = crearArchivos({cargar: async () => filesystem({fallaEscritura: true}), android: () => true})
  assert.equal(await sinDisco.compartir('a.json', '{}'), 'error')
  const sinPlugin = crearArchivos({cargar: async () => { throw new Error('sin plugin') }, android: () => true})
  assert.equal(await sinPlugin.compartir('a.json', '{}'), 'error')
  const web = crearArchivos({cargar: async () => { throw new Error('no debe cargarse') }, android: () => false})
  assert.equal(web.disponible(), false)
  assert.equal(await web.compartir('a.json', '{}'), 'no-disponible')
})

test('adaptador archivos · nombres seguros', () => {
  assert.equal(nombreSeguro('mmv-backup-2026-11-10.json'), 'mmv-backup-2026-11-10.json')
  assert.equal(nombreSeguro('../../etc/pass wd'), '_.._etc_pass_wd') // sin separadores: no puede salirse de la carpeta
  assert.doesNotMatch(nombreSeguro('a/b\\c'), /[\\/]/)
  assert.equal(nombreSeguro('...'), 'archivo')
  assert.equal(nombreSeguro(''), 'archivo')
  assert.equal(nombreSeguro(null), 'archivo')
})

test('adaptador archivos · la carga real devuelve un objeto plano (los plugins son Proxy)', () => {
  const src = leer('src/platform/archivos.js')
  assert.match(src, /return \{fs: f\.Filesystem, share: s\.Share, Directory: f\.Directory, Encoding: f\.Encoding\}/)
})

// ---------- backup y GPX usan el adaptador ----------
test('backup y GPX · en el APK pasan por la hoja de compartir; en la web siguen igual', async () => {
  const b = leer('src/data/backup.js')
  assert.match(b, /import \{archivos\} from '\.\.\/platform\/archivos\.js'/)
  assert.match(b, /if \(archivos\.disponible\(\)\) \{[\s\S]*archivos\.compartir\(nombre, texto, 'Backup de MMV'\)/)
  assert.match(b, /EVENTO_BACKUP = 'mmv:backup'/)
  const e = leer('src/ui/entregarArchivo.js')
  assert.match(e, /archivos\.disponible\(\)/)
  assert.match(e, /navigator\.share\(\{files/) // la ruta web sigue
  assert.match(e, /a\.download = nombre/)
  const {puedeCompartir, EVENTO_BACKUP} = await import('../src/data/backup.js')
  assert.equal(puedeCompartir(), false) // en Node (sin Android ni navigator.share) no hay hoja de compartir
  assert.equal(EVENTO_BACKUP, 'mmv:backup')
})

test('backup · el servicio de recordatorios escucha el evento del backup y le pasa la fecha al plan', () => {
  const s = leer('src/features/recordatorios/servicio.js')
  assert.match(s, /window\.addEventListener\(EVENTO_BACKUP, pedir\)/)
  assert.match(s, /window\.removeEventListener\(EVENTO_BACKUP, pedir\)/)
  assert.match(s, /ultimoBackup: cfg\('backup'\)/)
})

// ---------- manifiesto ----------
test('manifiesto · suma vibración y cámara (opcional como hardware) y conserva lo anterior', () => {
  const m = leer('android/app/src/main/AndroidManifest.xml')
  assert.match(m, /<uses-permission android:name="android\.permission\.VIBRATE" \/>/)
  assert.match(m, /<uses-permission android:name="android\.permission\.CAMERA" \/>/)
  assert.match(m, /<uses-feature android:name="android\.hardware\.camera" android:required="false" \/>/)
  assert.match(m, /ACCESS_FINE_LOCATION/)
  assert.match(m, /SCHEDULE_EXACT_ALARM[^>]*tools:node="remove"/)
  assert.doesNotMatch(m, /RECORD_AUDIO|CONTACTS|BACKGROUND_LOCATION|USE_EXACT_ALARM|USE_FULL_SCREEN_INTENT|FOREGROUND_SERVICE/)
  assert.match(m, /<uses-permission android:name="android\.permission\.INTERNET"/)
})

// ---------- Comidas plano ----------
test('Comidas · usa el estilo plano; Ajustes no', () => {
  assert.match(leer('src/App.jsx'), /tab === 'comidas' \|\| tab === 'progreso' \? 'plano'/)
  assert.doesNotMatch(leer('src/App.jsx'), /tab === 'ajustes'[^?]*\? 'plano'/)
})

// ---------- reglas de arquitectura y dependencias ----------
test('reglas · solo src/platform importa @capacitor/*; domain no conoce plataforma ni UI; Dexie v11; appId y esquema intactos', () => {
  const fuera = archivosDe('src').filter(f => !f.startsWith('src/platform/') && /from ['"]@capacitor\/|import\(['"]@capacitor\//.test(leer(f)))
  assert.deepEqual(fuera, [])
  const dominio = archivosDe('src/domain').filter(f => /\.\.\/(platform|features|ui|data|services)\//.test(leer(f)))
  assert.deepEqual(dominio, [])
  for (const [f, pk] of [['archivos', 'filesystem'], ['archivos', 'share'], ['atras', 'app'], ['notificaciones', 'local-notifications']])
    assert.ok(leer(`src/platform/${f}.js`).includes(`@capacitor/${pk}`), f + ' ' + pk)
  assert.match(leer('src/data/db.js'), /\.version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /\.version\(12\)/)
  const cfg = leer('capacitor.config.ts')
  assert.match(cfg, /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(cfg, /androidScheme: 'https'/)
})

test('dependencias · los tres plugins nuevos están en package.json y en el lock; nada existente cambió de mayor', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  for (const n of ['app', 'filesystem', 'share']) {
    assert.match(pkg.dependencies['@capacitor/' + n], /^\^8\./)
    assert.ok(lock.packages['node_modules/@capacitor/' + n], n)
  }
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(pkg.dependencies['@capacitor/core'], /^\^8\./)
})

test('la Entrega 42 (v0.43.0) sigue en el CHANGELOG y en el README; la historia sigue', () => {
  // Entrega 43: ya no se fija la versión actual acá (la fija entrega44.test.js); solo que la historia no se pierda.
  const ch = leer('CHANGELOG.md')
  assert.match(ch, /## v0\.43\.0 · Entrega 42 ·/)
  assert.match(ch, /## v0\.42\.0 · Entrega 41 ·/)
  assert.ok(ch.indexOf('v0.43.0') < ch.indexOf('v0.42.0'))
  const rd = leer('README.md')
  assert.match(rd, /## Android completo \(v0\.43\.0\)/)
  assert.match(rd, /## Recordatorios \(v0\.42\.0\)/)
})
