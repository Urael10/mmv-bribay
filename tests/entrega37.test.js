// Entrega 36 (v0.37.0) · «Dormir con alarma» suma las horas de sueño del día y propone el total para confirmar.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  HORAS_MAX, HORAS_MAX_DIA, parseHoras, horasPrevias, sumarHoras, fechaDeMs, propuestaDia
} from '../src/domain/sueno.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const local = (a, m, d, h = 0, mi = 0) => new Date(a, m - 1, d, h, mi, 0, 0).getTime()

test('horasPrevias: acepta número o texto con coma y descarta lo que no es dato', () => {
  assert.equal(horasPrevias(7.5), 7.5)
  assert.equal(horasPrevias('7,5'), 7.5)
  assert.equal(horasPrevias(' 6.25 '), 6.3)
  for (const v of [undefined, null, '', 'abc', 0, -2, NaN]) assert.equal(horasPrevias(v), 0, String(v))
  assert.equal(horasPrevias(90), HORAS_MAX_DIA)
})
test('sumarHoras: noche + siesta a décimas, con tope diario y sin sesión inválida', () => {
  assert.equal(sumarHoras(7, 1.5), 8.5)
  assert.equal(sumarHoras('6,5', 0.7), 7.2)
  assert.equal(sumarHoras('', 2), 2)
  assert.equal(sumarHoras(0.1, 0.2), 0.3) // sin ruido de coma flotante
  assert.equal(sumarHoras(23, 3), HORAS_MAX_DIA)
  for (const n of [0, -1, null, undefined, NaN, 'x']) assert.equal(sumarHoras(7, n), null, String(n))
})
test('parseHoras: una sesión llega a 16 h; el total del día a 24 h', () => {
  assert.equal(parseHoras('20'), null)
  assert.equal(parseHoras('20', HORAS_MAX_DIA), 20)
  assert.equal(parseHoras('24,5', HORAS_MAX_DIA), null)
  assert.equal(parseHoras('16'), 16)
  assert.equal(parseHoras('7,5'), 7.5)
  assert.equal(HORAS_MAX, 16)
})
test('fechaDeMs: día calendario local, como hoy() de la base', () => {
  assert.equal(fechaDeMs(local(2026, 11, 7, 0, 5)), '2026-11-07')
  assert.equal(fechaDeMs(local(2026, 11, 6, 23, 59)), '2026-11-06')
  assert.equal(fechaDeMs(local(2026, 1, 2, 7, 0)), '2026-01-02')
  assert.equal(fechaDeMs(NaN), null)
})
test('propuestaDia: siesta sobre una noche ya guardada', () => {
  const i = local(2026, 11, 7, 14, 0),
    f = local(2026, 11, 7, 15, 30)
  assert.deepEqual(propuestaDia({previo: '7', inicio: i, fin: f}), {antes: 7, sesion: 1.5, total: 8.5})
  assert.deepEqual(propuestaDia({previo: undefined, inicio: i, fin: f}), {antes: 0, sesion: 1.5, total: 1.5})
})
test('propuestaDia: noche completa sin nada previo propone solo la sesión', () => {
  const p = propuestaDia({previo: 0, inicio: local(2026, 11, 6, 23, 30), fin: local(2026, 11, 7, 7, 0)})
  assert.deepEqual(p, {antes: 0, sesion: 7.5, total: 7.5})
})
test('propuestaDia: sesión no plausible (se olvidó apagar) no inventa total', () => {
  const p = propuestaDia({previo: 7, inicio: local(2026, 11, 6, 22, 0), fin: local(2026, 11, 7, 20, 0)})
  assert.deepEqual(p, {antes: 7, sesion: null, total: null})
  assert.equal(propuestaDia({previo: 7, inicio: 5, fin: 5}).total, null)
})
test('dos siestas el mismo día se acumulan paso a paso', () => {
  const noche = 7
  const t1 = propuestaDia({previo: noche, inicio: local(2026, 11, 7, 14, 0), fin: local(2026, 11, 7, 14, 40)}).total
  assert.equal(t1, 7.7)
  const t2 = propuestaDia({previo: t1, inicio: local(2026, 11, 7, 18, 0), fin: local(2026, 11, 7, 18, 30)}).total
  assert.equal(t2, 8.2)
})

test('ModoSueno: propone el total, deja corregirlo y guarda en el día de despertar', () => {
  const m = leer('src/features/sueno/ModoSueno.jsx')
  assert.match(m, /propuestaDia\(/)
  assert.match(m, /previoDe\(fecha\)/)
  assert.match(m, /fechaDeMs\(fin\)/)
  assert.match(m, /parseHoras\(horasTxt, HORAS_MAX_DIA\)/)
  assert.match(m, /onGuardar\(h, fecha\)/)
  assert.match(m, /Total de sueño de hoy/)
  assert.match(m, /Solo esta sesión/)
  assert.match(m, /Volver al total/)
  assert.match(m, /Ya tenías/)
  assert.match(m, /se suma al total de ese día/)
  assert.doesNotMatch(m, /rutas|movimiento/)
})
test('Hoy: guarda el total en la fila del día de despertar, dentro de una transacción', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /const leerSueno = async f =>/)
  assert.match(h, /const guardarSueno = async \(horas, f\) =>/)
  assert.match(h, /db\.transaction\('rw', db\.habitos, async \(\) => \{\s*const actual = await db\.habitos\.get\(dia\)/)
  assert.match(h, /<ModoSueno previoDe=\{leerSueno\} onGuardar=\{guardarSueno\} \/>/)
  assert.match(h, /aria-label="Horas de sueño de hoy \(total del día\)"/)
})
test('sin cambios de datos ni de las demás pantallas', () => {
  assert.match(leer('src/data/db.js'), /db\.version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /db\.version\(12\)/)
  assert.doesNotMatch(leer('src/features/sueno/ModoSueno.jsx'), /Dexie|db\./) // la base solo se toca desde Hoy
})
test('el bloque CSS de la entrega 36 usa solo tokens', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 36:'))
  assert.ok(b.length > 80)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--ac\)|var\(--pr\)/)
})
test('versión 0.37.0 / entrega 36 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 37, pkg.version)
  assert.ok(Number(pkg.entrega) >= 36)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(leer('CHANGELOG.md'), /## v0\.37\.0 · Entrega 36 · «Dormir con alarma» suma el sueño del día/)
  assert.match(leer('README.md'), /horas de sueño y total del día/) // el título del README cambia en cada entrega: se vigila la sección de la función
})
