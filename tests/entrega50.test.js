// Entrega 49 (v0.50.0) · sonidos, vibración y festejo de metas.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {
  NIVELES, NIVEL_INICIAL, nivelDe, METAS_DIA, EVENTOS, accionesDe, tiemposTono,
  estadoVacio, leerEstado, yaFestejada, marcarMeta, marcarDia, cierraElDia, cruzoMeta
} from '../src/domain/feedback.js'
import {crearHapticos} from '../src/platform/hapticos.js'
import {AJUSTES} from '../src/domain/backup.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const archivos = d =>
  readdirSync(new URL('../' + d, import.meta.url)).flatMap(n => {
    const r = `${d}/${n}`
    return statSync(new URL('../' + r, import.meta.url)).isDirectory() ? archivos(r) : [r]
  })

test('niveles: apagado, solo vibración (por defecto) y vibración con sonido; un valor raro vuelve al inicial', () => {
  assert.deepEqual(NIVELES, ['off', 'vib', 'full'])
  assert.equal(NIVEL_INICIAL, 'vib')
  for (const raro of [null, undefined, '', 'x', 1, 'FULL']) assert.equal(nivelDe(raro), 'vib')
  assert.equal(nivelDe('full'), 'full')
  assert.equal(nivelDe('off'), 'off')
})

test('eventos: los cinco de la muestra, con los patrones aprobados', () => {
  assert.deepEqual(Object.keys(EVENTOS), ['toque', 'guardar', 'meta', 'entreno', 'dia'])
  assert.deepEqual(EVENTOS.toque.vib, [12])
  assert.deepEqual(EVENTOS.guardar.vib, [18])
  assert.deepEqual(EVENTOS.meta.vib, [20, 70, 35])
  assert.deepEqual(EVENTOS.entreno.vib, [200, 100, 200, 100, 500])
  assert.deepEqual(EVENTOS.dia.vib, [30, 60, 30, 60, 30, 60, 120])
  assert.equal(EVENTOS.toque.tono, null)
})

test('accionesDe: apagado no hace nada; «vib» sin sonido; «full» con sonido salvo que el sonido esté apagado', () => {
  assert.deepEqual(accionesDe('meta', 'off'), {vib: null, tono: null})
  assert.deepEqual(accionesDe('meta', 'vib'), {vib: [20, 70, 35], tono: null})
  assert.deepEqual(accionesDe('meta', 'full'), {vib: [20, 70, 35], tono: EVENTOS.meta.tono})
  assert.equal(accionesDe('meta', 'full', {sonidoActivo: false}).tono, null)
  assert.deepEqual(accionesDe('meta', 'full', {sonidoActivo: false}).vib, [20, 70, 35])
  assert.equal(accionesDe('toque', 'full').tono, null) // el toque de agua nunca suena
  assert.deepEqual(accionesDe('inexistente', 'full'), {vib: null, tono: null})
  assert.deepEqual(accionesDe('meta', 'basura'), accionesDe('meta', 'vib')) // valor raro = nivel inicial
})

test('tiemposTono: notas largas sin pisarse, cortas separadas un 10 %', () => {
  assert.deepEqual(tiemposTono(null), [])
  const t = tiemposTono([[1320, 250], [1320, 250], [1760, 600]])
  assert.deepEqual(t.map(n => n.f), [1320, 1320, 1760])
  assert.equal(t[0].t, 0)
  assert.equal(t[1].t, 0.275)
  assert.equal(t[2].t, 0.55)
  const largo = tiemposTono([[500, 600], [600, 100]])
  assert.equal(largo[1].t, 0.26)
})

test('una vez por día: la marca vale solo para su fecha y se limpia sola si está dañada', () => {
  const F = '2026-11-12'
  let e = estadoVacio(F)
  assert.equal(yaFestejada(e, 'agua'), false)
  e = marcarMeta(e, 'agua')
  assert.equal(yaFestejada(e, 'agua'), true)
  assert.deepEqual(marcarMeta(e, 'agua'), e)
  assert.deepEqual(marcarMeta(e, 'proteina'), e, 'solo las metas del día')
  assert.equal(marcarDia(e).d, true)
  const guardado = JSON.stringify(marcarDia(e))
  assert.deepEqual(leerEstado(guardado, F), {f: F, m: ['agua'], d: true})
  assert.deepEqual(leerEstado(guardado, '2026-11-13'), estadoVacio('2026-11-13'), 'otro día: empieza de cero')
  for (const malo of [null, '', 'no es json', '{"f":1}', '[]', 'null']) assert.deepEqual(leerEstado(malo, F), estadoVacio(F), String(malo))
  assert.deepEqual(leerEstado('{"f":"2026-11-12","m":["agua","x",3],"d":"si"}', F), {f: F, m: ['agua'], d: false})
})

test('cierre del día: hacen falta las tres metas', () => {
  assert.deepEqual(METAS_DIA, ['agua', 'pasos', 'sueno'])
  assert.equal(cierraElDia(new Set(['agua', 'pasos'])), false)
  assert.equal(cierraElDia(['agua', 'pasos', 'sueno']), true)
  assert.equal(cierraElDia(new Set()), false)
})

test('cruzoMeta: solo festeja el paso de no cumplida a cumplida; la primera lectura no festeja', () => {
  assert.equal(cruzoMeta(null, 3000, 2500), false) // abrir la app con la meta ya cumplida
  assert.equal(cruzoMeta(undefined, 3000, 2500), false)
  assert.equal(cruzoMeta(2000, 2500, 2500), true)
  assert.equal(cruzoMeta(2000, 2400, 2500), false)
  assert.equal(cruzoMeta(2600, 3000, 2500), false) // ya estaba cumplida
  assert.equal(cruzoMeta(0, 100, 0), false) // sin meta
  assert.equal(cruzoMeta(0, 100, null), false)
})

test('hápticos: en el navegador usa navigator.vibrate; sin API no falla', async () => {
  const llamadas = []
  const h = crearHapticos({nativo: () => false, nav: {vibrate: p => (llamadas.push(p), true)}})
  assert.equal(await h.vibrar([20, 70, 35]), true)
  assert.equal(await h.vibrar(12), true)
  assert.deepEqual(llamadas, [[20, 70, 35], [12]])
  assert.equal(await h.vibrar([]), false)
  assert.equal(await h.vibrar(['x']), false)
  assert.equal(await crearHapticos({nativo: () => false, nav: {}}).vibrar([10]), false)
  assert.equal(await crearHapticos({nativo: () => false, nav: {vibrate: () => { throw new Error('no') }}}).vibrar([10]), false)
})

test('hápticos: en el APK vibra con el plugin y respeta las pausas del patrón', async () => {
  const v = [], esperas = []
  const plugin = {vibrate: o => (v.push(o.duration), Promise.resolve())}
  let cargas = 0
  const h = crearHapticos({
    nativo: () => true,
    cargar: async () => (cargas++, {plugin}),
    esperar: (f, ms) => (esperas.push(ms), f())
  })
  assert.equal(await h.vibrar([20, 70, 35]), true)
  assert.deepEqual(v, [20, 35])
  assert.deepEqual(esperas, [20, 70]) // espera lo que dura cada tramo, menos el último
  await h.vibrar([12])
  assert.equal(cargas, 1, 'el plugin se carga una sola vez')
  assert.equal(await crearHapticos({nativo: () => true, cargar: async () => { throw new Error('sin plugin') }}).vibrar([10]), false)
})

test('hápticos: un patrón nuevo corta al anterior', async () => {
  const v = []
  const plugin = {vibrate: o => (v.push(o.duration), Promise.resolve())}
  const pendientes = []
  const h = crearHapticos({nativo: () => true, cargar: async () => ({plugin}), esperar: (f, ms) => pendientes.push(f)})
  const a = h.vibrar([100, 50, 100]) // queda esperando
  await new Promise(r => setImmediate(r))
  const b = h.vibrar([7])
  await new Promise(r => setImmediate(r))
  pendientes.splice(0).forEach(f => f())
  await Promise.all([a, b])
  assert.deepEqual(v, [100, 7]) // el segundo tramo de «a» no llega a vibrar
})

test('encaje: solo platform importa @capacitor/haptics; el servicio y las pantallas usan lo que ya existe', () => {
  const fuera = archivos('src').filter(f => !f.startsWith('src/platform/') && /@capacitor\/haptics/.test(leer(f)))
  assert.deepEqual(fuera, [])
  assert.match(leer('src/platform/hapticos.js'), /import\('@capacitor\/haptics'\)/)
  assert.doesNotMatch(leer('src/domain/feedback.js'), /from '|import\(|localStorage|document|window|navigator/)
  assert.doesNotMatch(leer('src/services/feedback.js'), /data\/|db\./, 'sin base: usa localStorage como el reloj')
  assert.match(leer('src/services/feedback.js'), /mv_fb_dia/)
  assert.match(leer('src/services/feedback.js'), /prefers-reduced-motion/)
  const css = leer('src/styles.css')
  assert.match(css, /\.anillo\.pop/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[^}]*\{\s*\.anillo\.pop/)
})

test('enganches: agua, pasos, sueño, check-in, comida, medida, actividad y fin de entreno', () => {
  const hoy = leer('src/features/hoy/Hoy.jsx')
  for (const k of ["useMeta('agua'", "useMeta('pasos'", "useMeta('sueno'"]) assert.ok(hoy.includes(k), k)
  assert.match(hoy, /sentir\('toque'\)/)
  assert.match(hoy, /sentir\('guardar'\)/)
  assert.match(hoy, /festejadaHoy\('agua'\)/)
  assert.match(leer('src/features/hoy/useMeta.js'), /cruzoMeta/)
  assert.match(leer('src/features/entreno/Entreno.jsx'), /festejarEntreno\(\)/)
  assert.match(leer('src/features/comidas/Comidas.jsx'), /sentir\('guardar'\)/)
  assert.match(leer('src/features/cuerpo/Cuerpo.jsx'), /sentir\('guardar'\)/)
  assert.match(leer('src/features/actividad/ActividadFisica.jsx'), /sentir\('guardar'\)/)
  const aj = leer('src/features/ajustes/Ajustes.jsx')
  assert.match(aj, /Sonidos y vibración/)
  assert.match(aj, /guardarNivel/)
})

test('ajuste: el nivel viaja en el backup y la clave de IA sigue sin viajar', () => {
  assert.ok(AJUSTES.includes('feedback'))
  assert.ok(!AJUSTES.includes('key'))
})

test('reglas fijas y documentación: Dexie v11, appId y esquema intactos, dependencia nueva coherente, versión vigente', () => {
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  assert.ok(+pkg.entrega >= 49 && /^0\.\d+\.0$/.test(pkg.version)) // se relajó a propósito en la entrega 50: ya no fija la versión vigente
  assert.match(pkg.dependencies['@capacitor/haptics'], /^\^8\./)
  assert.match(lock.packages['node_modules/@capacitor/haptics'].version, /^8\./)
  assert.match(leer('android/capacitor.settings.gradle'), /node_modules\/@capacitor\/haptics\/android/)
  assert.match(leer('android/app/capacitor.build.gradle'), /implementation project\(':capacitor-haptics'\)/)
  assert.match(leer('android/app/src/main/AndroidManifest.xml'), /android\.permission\.VIBRATE/)
  assert.match(leer('CHANGELOG.md'), /## v0\.50\.0 · Entrega 49/)
  assert.match(leer('README.md'), /Entrega \d+ \(v0\.\d+\.0\)/)
  assert.ok(!/publicar/.test(leer('.github/workflows/android-debug.yml')))
})
