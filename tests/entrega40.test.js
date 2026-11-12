// Entrega 39 (v0.40.0) · registro de sueño: horas de acostarse y levantarse, «Igual que siempre», duración rápida,
// calidad en botones, siestas desglosadas, tesela de Sueño en Hoy y guardado desde la alarma.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  horasEntre, duracionHM, duracionCorta, extraSiestas, reaplicarNoche, habitualNoche, nocheDeSesion, horaDeMs,
  fraccionSueno, OBJETIVO_SUENO_H, NOCHE_MIN_H, DURACIONES_RAPIDAS
} from '../src/domain/sueno.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime()

test('horasEntre: cruza la medianoche, usa centésimas y no inventa nada si falta o coincide una hora', () => {
  assert.equal(horasEntre('23:30', '07:15'), 7.75)
  assert.equal(horasEntre('00:30', '08:00'), 7.5)
  assert.equal(horasEntre('22:00', '23:30'), 1.5)
  for (const [a, d] of [['07:00', '07:00'], ['', '07:00'], [null, null], ['25:00', '07:00'], ['7', '8']]) assert.equal(horasEntre(a, d), null, `${a}→${d}`)
})

test('duracionHM y duracionCorta: texto legible y vacío sin dato', () => {
  assert.equal(duracionHM(7.75), '7 h 45 min')
  assert.equal(duracionHM('7,5'), '7 h 30 min')
  assert.equal(duracionHM(8), '8 h')
  assert.equal(duracionHM(0.75), '45 min')
  for (const v of ['', null, undefined, 0, -1, 'x']) assert.equal(duracionHM(v), '', String(v))
  assert.equal(duracionCorta(7.75), '7 h 45')
  assert.equal(duracionCorta(8), '8 h')
  assert.equal(duracionCorta(0.75), '45 min')
  assert.equal(duracionCorta(''), '')
})

test('extraSiestas: lo que el total tiene de más que la noche (a 10 min), 0 sin las dos horas o con menos de 5 min', () => {
  const noche = {acosto: '23:00', desperto: '07:00'}
  assert.equal(extraSiestas({...noche, sueno: 9}), 1)
  assert.equal(Math.round(extraSiestas({...noche, sueno: 8.3}) * 60), 20) // el total a décimas no deja minutos raros
  assert.equal(extraSiestas({...noche, sueno: 8}), 0)
  assert.equal(extraSiestas({...noche, sueno: 7}), 0) // un total menor al de las horas: se respeta, no hay «siesta negativa»
  assert.equal(extraSiestas({sueno: 9}), 0)
  assert.equal(extraSiestas({acosto: '23:00', sueno: 9}), 0)
  assert.equal(extraSiestas(undefined), 0)
})

test('reaplicarNoche: con las dos horas recalcula el total y conserva las siestas; con una sola no toca el total', () => {
  assert.deepEqual(reaplicarNoche({}, '23:30', '07:15'), {acosto: '23:30', desperto: '07:15', sueno: 7.75})
  const conSiesta = {acosto: '23:00', desperto: '07:00', sueno: 9}
  assert.deepEqual(reaplicarNoche(conSiesta, '22:00', '07:00'), {acosto: '22:00', desperto: '07:00', sueno: 10})
  assert.deepEqual(reaplicarNoche({sueno: 7}, '22:00', ''), {acosto: '22:00', desperto: null})
  assert.deepEqual(reaplicarNoche({sueno: 7}, '', ''), {acosto: null, desperto: null})
  // total manual previo sin horas: las dos horas lo reemplazan (no es siesta)
  assert.equal(reaplicarNoche({sueno: 5}, '23:00', '07:00').sueno, 8)
  // tope del día
  assert.equal(reaplicarNoche({acosto: '01:00', desperto: '02:00', sueno: 23}, '02:00', '23:00').sueno, 24)
})

test('habitualNoche: mediana de los últimos días, acostarse a pasada la medianoche, redondeo a 5 min y mínimo de días', () => {
  const hs = [
    {fecha: '2026-11-05', acosto: '23:30', desperto: '07:10'},
    {fecha: '2026-11-06', acosto: '00:20', desperto: '07:40'},
    {fecha: '2026-11-07', acosto: '23:50', desperto: '07:20'}
  ]
  assert.deepEqual(habitualNoche(hs, '2026-11-08'), {acosto: '23:50', desperto: '07:20', dias: 3})
  assert.equal(habitualNoche(hs.slice(0, 1), '2026-11-08'), null)
  assert.equal(habitualNoche([], '2026-11-08'), null)
  assert.equal(habitualNoche(undefined, '2026-11-08'), null)
  // no cuenta el día de hoy ni los de hace más de una semana, ni filas con una sola hora
  const ruido = [...hs, {fecha: '2026-11-08', acosto: '03:00', desperto: '04:00'}, {fecha: '2026-10-01', acosto: '03:00', desperto: '04:00'}, {fecha: '2026-11-04', acosto: '22:00'}]
  assert.equal(habitualNoche(ruido, '2026-11-08').dias, 3)
  // todas de madrugada
  const mad = [{fecha: '2026-11-06', acosto: '00:30', desperto: '08:00'}, {fecha: '2026-11-07', acosto: '01:00', desperto: '08:30'}]
  assert.deepEqual(habitualNoche(mad, '2026-11-08'), {acosto: '00:45', desperto: '08:15', dias: 2})
})

test('nocheDeSesion: solo una sesión de al menos 4 h es noche; una siesta no cambia la hora de acostarse', () => {
  const ini = local(2026, 11, 7, 23, 30)
  assert.deepEqual(nocheDeSesion(ini, local(2026, 11, 8, 7, 15)), {acosto: '23:30', desperto: '07:15'})
  assert.equal(nocheDeSesion(local(2026, 11, 8, 14, 0), local(2026, 11, 8, 15, 30)), null)
  assert.equal(nocheDeSesion(ini, ini), null)
  assert.equal(nocheDeSesion(NaN, ini), null)
  assert.equal(NOCHE_MIN_H, 4)
  assert.equal(horaDeMs(local(2026, 11, 8, 7, 5)), '07:05')
  assert.equal(horaDeMs(NaN), null)
})

test('objetivo y atajos de duración', () => {
  assert.equal(OBJETIVO_SUENO_H, 8)
  assert.deepEqual(DURACIONES_RAPIDAS, [5, 6, 7, 8, 9])
  assert.equal(fraccionSueno(4), 0.5)
  assert.equal(fraccionSueno(10), 1)
  for (const v of [0, -1, '', null, NaN]) assert.equal(fraccionSueno(v), 0, String(v))
})

test('RegistroSueno: las tres vías, calidad en botones 1–5 y nombres accesibles; Hoy lo usa en el check-in', () => {
  const r = leer('src/features/sueno/RegistroSueno.jsx'),
    h = leer('src/features/hoy/Hoy.jsx')
  assert.match(r, /Igual que siempre/)
  assert.match(r, /type="time"/)
  assert.match(r, /reaplicarNoche\(h,/)
  assert.match(r, /DURACIONES_RAPIDAS\.map/)
  assert.match(r, /aria-pressed=\{\+h\.calidad === n\}/)
  assert.doesNotMatch(r, /type="range"/) // la calidad ya no es un deslizador
  assert.match(r, /aria-label="Horas de sueño de hoy \(total del día\)"/)
  assert.doesNotMatch(r, /db\.|Dexie/) // la base solo se toca desde Hoy
  assert.match(h, /<RegistroSueno h=\{h\} g=\{g\} habitual=\{habitual\} \/>/)
  assert.ok(h.indexOf('id="hoy-checkin"') < h.indexOf('<RegistroSueno') && h.indexOf('<RegistroSueno') < h.indexOf('id="hoy-sueno"'))
  assert.doesNotMatch(leer('src/styles.css'), /ck-sueno/)
})

test('Hoy: ya no se inventa una calidad 3 en filas nuevas y la hora habitual sale de los 7 días anteriores', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.doesNotMatch(h, /calidad: 3/)
  assert.match(h, /calidad: null/)
  assert.match(h, /\.between\(sumaDias\(hoy\(\), -8\), hoy\(\), true, false\)/)
  assert.match(h, /habitualNoche\(hs, hoy\(\)\)/)
})

test('tesela de Sueño en Hoy: anillo contra la referencia, ícono de luna y texto accesible; abre el bloque de sueño', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /function TeselaSueno\(\{h, cargado, onAbrir\}\)/ /* Entrega 49: suma `cargado` para no festejar al abrir */)
  assert.match(h, /<Icono n="luna" tam=\{20\} \/>/)
  assert.match(h, /<TeselaSueno h=\{h\} cargado=\{cargado\} onAbrir=\{\(\) => abrirCk\('hoy-sueno-reg'\)\} \/>/)
  assert.ok(h.indexOf('<TeselaSueno') < h.indexOf('<TeselaPasos'))
  assert.match(h, /Sueño: sin registrar/)
  assert.match(leer('src/features/sueno/RegistroSueno.jsx'), /id="hoy-sueno-reg"[^>]*tabIndex=\{-1\}/)
})

test('alarma: al guardar anota la noche (no las siestas) y la calidad opcional, sin pisar las horas ya guardadas', () => {
  const m = leer('src/features/sueno/ModoSueno.jsx'),
    h = leer('src/features/hoy/Hoy.jsx')
  assert.match(m, /nocheDeSesion\(sesion\.inicio, fin\)/)
  assert.match(m, /Calidad \(opcional\)/)
  assert.match(h, /if \(extra\.noche && !\(actual\?\.acosto && actual\?\.desperto\)\) Object\.assign\(nueva, extra\.noche\)/)
  assert.match(h, /if \(\+extra\.calidad >= 1\) nueva\.calidad = \+extra\.calidad/)
  assert.match(h, /setH\(fila\)/)
})

test('sin cambios de datos: Dexie sigue en v11 (los campos nuevos viajan en la misma fila de hábitos)', () => {
  assert.match(leer('src/data/db.js'), /db\.version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /db\.version\(12\)/)
  assert.match(leer('src/domain/sueno.js'), /^import \{sumaDias\} from '\.\/stats\.js'/m)
})

test('CSS de la entrega 39: solo tokens', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 39:'))
  assert.ok(b.length > 400)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--pr\)/)
})

test('versión 0.40.0 / entrega 39 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 40, pkg.version)
  assert.ok(Number(pkg.entrega) >= 39)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(leer('CHANGELOG.md'), /## v0\.40\.0 · Entrega 39 · Registro de sueño/)
  assert.match(leer('README.md'), /Entrega \d+ \(v0\.\d+\.\d+\)/)
})
