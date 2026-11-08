// Entrega 33 · Anillo en el contador de pasos y modo sueño con alarma.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  parsearMeta, promedioPasos, metaEfectiva, textoMetaPasos, pasosEnVivo, estadoConteo, textoPausa
} from '../src/domain/metaPasos.js'
import {
  parseHora, proximaAlarma, horasDormidas, parseHoras, textoHoras, textoDuracion, volumenAlarma,
  nuevaSesion, sesionParaGuardar, sesionDesdeGuardado, faseSueno, finPropuesto, alternativaFin,
  HORAS_MAX, TOLERANCIA_MS
} from '../src/domain/sueno.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const local = (a, m, d, h = 0, mi = 0) => new Date(a, m - 1, d, h, mi, 0, 0).getTime()

test('meta: vacía vale, 1.000 a 100.000 vale, el resto no', () => {
  assert.deepEqual(parsearMeta(''), {ok: true, meta: null})
  assert.deepEqual(parsearMeta('  '), {ok: true, meta: null})
  assert.deepEqual(parsearMeta('8000'), {ok: true, meta: 8000})
  assert.deepEqual(parsearMeta('8.000'), {ok: true, meta: 8000})
  for (const x of ['999', '100001', 'abc', '7,5', '-3', '1e4']) assert.equal(parsearMeta(x).ok, x === '' , x)
})
test('promedio de 28 días: solo días con pasos, sin contar hoy, con mínimo de 3 días', () => {
  const hs = [
    {fecha: '2026-11-05', pasos: 6000},
    {fecha: '2026-11-04', pasos: 8000},
    {fecha: '2026-11-03', pasos: 7000},
    {fecha: '2026-11-02', pasos: 0},
    {fecha: '2026-11-06', pasos: 99999}, // hoy no cuenta
    {fecha: '2026-09-01', pasos: 50000} // fuera de los 28 días
  ]
  assert.equal(promedioPasos(hs, '2026-11-06'), 7000)
  assert.equal(promedioPasos(hs.slice(0, 2), '2026-11-06'), null)
  assert.equal(promedioPasos([], '2026-11-06'), null)
})
test('meta efectiva: propia, si no promedio, si no nada (sin imponer una cifra)', () => {
  assert.deepEqual(metaEfectiva({meta: 9000, promedio: 5000}), {valor: 9000, origen: 'propia'})
  assert.deepEqual(metaEfectiva({meta: null, promedio: 5432.6}), {valor: 5433, origen: 'promedio'})
  assert.deepEqual(metaEfectiva({meta: null, promedio: null}), {valor: 0, origen: null})
  assert.deepEqual(metaEfectiva(), {valor: 0, origen: null})
  assert.match(textoMetaPasos({valor: 8000, origen: 'propia'}), /tu meta/)
  assert.match(textoMetaPasos({valor: 5433, origen: 'promedio'}), /promedio de 28 días/)
  assert.match(textoMetaPasos({valor: 0, origen: null}), /Sin meta/)
})
test('pasos en vivo: guardado + conteo actual, y el conteo solo suma hoy y activo', () => {
  assert.equal(pasosEnVivo({total: '4210', sesion: 312, activo: true, esHoy: true}), 4522)
  assert.equal(pasosEnVivo({total: '4210', sesion: 312, activo: false, esHoy: true}), 4210)
  assert.equal(pasosEnVivo({total: '4210', sesion: 312, activo: true, esHoy: false}), 4210)
  assert.equal(pasosEnVivo({total: '', sesion: 0, activo: false, esHoy: true}), 0)
  assert.equal(pasosEnVivo({total: 'x', sesion: -5, activo: true, esHoy: true}), 0)
})
test('estado del conteo: siempre ícono + texto', () => {
  assert.equal(estadoConteo({activo: false}), null)
  assert.equal(estadoConteo({activo: true, visible: false}).id, 'pausa')
  assert.equal(estadoConteo({activo: true, usarGps: true, senal: 'buscando', sesion: 0}).id, 'buscando')
  assert.equal(estadoConteo({activo: true, usarGps: true, senal: 'buscando', sesion: 5}).id, 'contando')
  for (const e of [
    estadoConteo({activo: true, visible: false}),
    estadoConteo({activo: true, usarGps: true, senal: 'buscando'}),
    estadoConteo({activo: true})
  ])
    assert.ok(e.icono && e.texto)
})
test('texto de pausa', () => {
  assert.equal(textoPausa(0), '')
  assert.equal(textoPausa(45), '45 s')
  assert.equal(textoPausa(192), '3 min 12 s')
  assert.equal(textoPausa(600), '10 min')
  assert.equal(textoPausa(3900), '1 h 5 min')
})

test('hora de alarma: formatos válidos e inválidos', () => {
  assert.deepEqual(parseHora('7:05'), {h: 7, m: 5})
  assert.deepEqual(parseHora('07:05'), {h: 7, m: 5})
  for (const x of ['24:00', '7:60', '', null, 'abc', '7']) assert.equal(parseHora(x), null, String(x))
})
test('próxima alarma: hoy si falta, mañana si ya pasó (o es esta misma hora)', () => {
  const noche = local(2026, 11, 6, 23, 10)
  assert.equal(proximaAlarma(noche, '07:00'), local(2026, 11, 7, 7, 0))
  assert.equal(proximaAlarma(local(2026, 11, 6, 5, 0), '07:00'), local(2026, 11, 6, 7, 0))
  assert.equal(proximaAlarma(local(2026, 11, 6, 7, 0), '07:00'), local(2026, 11, 7, 7, 0))
  assert.equal(proximaAlarma(noche, '99:00'), null)
  assert.equal(proximaAlarma(NaN, '07:00'), null)
})
test('horas dormidas: a décimas y descarta lo implausible', () => {
  const t0 = local(2026, 11, 6, 23, 10)
  assert.equal(horasDormidas(t0, local(2026, 11, 7, 7, 0)), 7.8)
  assert.equal(horasDormidas(t0, local(2026, 11, 7, 6, 30)), 7.3)
  assert.equal(horasDormidas(t0, t0 + 5 * 60000), null) // un toque por error
  assert.equal(horasDormidas(t0, t0 - 1000), null)
  assert.equal(horasDormidas(t0, t0 + (HORAS_MAX + 1) * 36e5), null) // se olvidó apagar
  assert.equal(horasDormidas(t0, t0 + HORAS_MAX * 36e5), HORAS_MAX)
  assert.equal(horasDormidas(NaN, t0), null)
})
test('horas escritas a mano: coma o punto, entre 0,3 y 16', () => {
  assert.equal(parseHoras('7,5'), 7.5)
  assert.equal(parseHoras('7.25'), 7.3)
  for (const x of ['', 'x', '0', '17', '-1', '7,5h']) assert.equal(parseHoras(x), null, x)
  assert.equal(textoHoras(7.5), '7,5 h')
  assert.equal(textoDuracion(40 * 60000), '40 min')
  assert.equal(textoDuracion((6 * 60 + 40) * 60000), '6 h 40 min')
  assert.equal(textoDuracion(2 * 36e5), '2 h')
})
test('volumen de la alarma: sube de a poco y tiene tope', () => {
  assert.equal(volumenAlarma(0), 0.08)
  assert.ok(volumenAlarma(10) > volumenAlarma(0))
  assert.equal(volumenAlarma(600), 0.6)
  assert.equal(volumenAlarma(-5), 0.08)
})
test('sesión guardada: ida y vuelta y rechazo de datos rotos', () => {
  const s = nuevaSesion(1000, 5000)
  assert.deepEqual(sesionDesdeGuardado(sesionParaGuardar(s)), {inicio: 1000, alarma: 5000, fin: null})
  assert.deepEqual(sesionDesdeGuardado(sesionParaGuardar({...s, fin: 4000})), {inicio: 1000, alarma: 5000, fin: 4000})
  for (const x of [null, '', 'no json', '{}', '{"inicio":1,"alarma":0}', '{"inicio":5,"alarma":3}', '{"inicio":1,"alarma":5,"fin":0.5}'])
    assert.equal(sesionDesdeGuardado(x), null, String(x))
})
test('fase: durmiendo → sonando → resumen; abierta tarde no suena de golpe', () => {
  const s = nuevaSesion(1000, 100000)
  assert.equal(faseSueno({sesion: null, ahora: 5}), null)
  assert.equal(faseSueno({sesion: s, ahora: 50000, vivo: true}), 'durmiendo')
  assert.equal(faseSueno({sesion: s, ahora: 100000, vivo: true}), 'sonando')
  assert.equal(faseSueno({sesion: s, ahora: 100000 + TOLERANCIA_MS, vivo: true}), 'sonando')
  assert.equal(faseSueno({sesion: s, ahora: 100001 + TOLERANCIA_MS, vivo: true}), 'resumen')
  assert.equal(faseSueno({sesion: s, ahora: 100001 + TOLERANCIA_MS, vivo: true, sono: true}), 'sonando')
  assert.equal(faseSueno({sesion: s, ahora: 200000, vivo: false}), 'resumen') // reabierta después de la hora
  assert.equal(faseSueno({sesion: {...s, fin: 90000}, ahora: 50000, vivo: true}), 'resumen')
})
test('resumen: propone la hora de apagar (o la de la alarma) y ofrece la otra si difiere', () => {
  const alarma = local(2026, 11, 7, 7, 0),
    inicio = local(2026, 11, 6, 23, 0)
  const s = nuevaSesion(inicio, alarma)
  assert.equal(finPropuesto(s), alarma) // abierta tarde: la alarma
  const tarde = local(2026, 11, 7, 8, 30)
  assert.equal(alternativaFin({sesion: s, ahora: tarde}), tarde)
  assert.equal(alternativaFin({sesion: s, ahora: alarma + 5 * 60000}), null) // casi igual: no hace falta
  const apagada = {...s, fin: local(2026, 11, 7, 7, 40)}
  assert.equal(finPropuesto(apagada), apagada.fin)
  assert.equal(alternativaFin({sesion: apagada, ahora: tarde}), alarma)
})

test('los dominios nuevos son lógica pura: sin React, Dexie ni navegador', () => {
  for (const f of ['src/domain/metaPasos.js', 'src/domain/sueno.js']) {
    const c = leer(f)
    assert.doesNotMatch(c, /from 'react|from '\.\.\/data|localStorage|document\.|window\./, f)
  }
})
test('el contador de pasos usa el anillo, el estado con ícono + texto y la meta editable', () => {
  const a = leer('src/features/actividad/ActividadFisica.jsx')
  assert.match(a, /<Anillo valor=\{pasosHoy\} meta=\{ef\.valor\}/)
  assert.match(a, /<Icono n=\{est\.icono\}/)
  assert.match(a, /id="meta-pasos"/)
  assert.match(a, /Sin conexión · el conteo sigue igual/)
  assert.match(a, /role="group"/)
})
test('la lógica de conteo y de rutas no se tocó: ActividadFisica sigue llamando a las mismas funciones', () => {
  const a = leer('src/features/actividad/ActividadFisica.jsx')
  for (const f of ['procesarMuestra', 'procesarPuntoGps', 'cerrarConteo', 'armarRuta', 'agregarPuntoRuta'])
    assert.ok(a.includes(f), f)
  assert.doesNotMatch(a, /from '\.\.\/\.\.\/domain\/rutas\.js'/)
})
test('Hoy: fila de Pasos con anillo, plegable «Dormir con alarma» y guardado sobre la fila de la base', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /function TeselaPasos/)
  assert.match(h, /<TeselaPasos abierto=\{masAb\}/)
  assert.match(h, /id="hoy-sueno"/)
  assert.match(h, /<ModoSueno previoDe=\{leerSueno\} onGuardar=\{guardarSueno\} \/>/) // entrega 36: suma del día
  assert.match(h, /db\.transaction\('rw', db\.habitos/) // no pisa los pasos con una copia vieja
  assert.ok(h.indexOf('id="hoy-checkin"') < h.indexOf('id="hoy-sueno"'))
  assert.ok(h.indexOf('id="hoy-sueno"') < h.indexOf('id="hoy-mas"'))
})
test('carga diferida intacta: Hoy no importa Comidas, Coach ni Pilares; ModoSueno no toca rutas', () => {
  assert.doesNotMatch(leer('src/features/hoy/Hoy.jsx'), /from '\.\.\/(comidas\/Comidas|coach\/Coach|progreso\/Pilares)'/)
  assert.doesNotMatch(leer('src/features/sueno/ModoSueno.jsx'), /rutas|movimiento/)
})
test('modo sueño: pantalla que se queda encendida, diálogo accesible y límites dichos', () => {
  const m = leer('src/features/sueno/ModoSueno.jsx')
  assert.match(m, /wakeLock\.request\('screen'\)/)
  assert.match(m, /role="dialog" aria-modal="true"/)
  assert.match(m, /createPortal/)
  assert.match(m, /no puede sonar con la pantalla bloqueada/)
  assert.match(m, /tiempo en cama, no sueño medido/)
  assert.match(m, /onGuardar\(h, fecha\)/) // entrega 36: se guarda el total del día de despertar
})
test('sin cambios de datos: Dexie sigue en v11 y la sesión de sueño vive en localStorage', () => {
  assert.match(leer('src/data/db.js'), /db\.version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /db\.version\(12\)/)
  assert.match(leer('src/features/sueno/ModoSueno.jsx'), /mv_sueno_sesion/)
})
test('el bloque CSS de la entrega 33 usa solo tokens y no toca cian ni lima', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 33:'))
  assert.ok(b.length > 800)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  assert.doesNotMatch(b, /var\(--ac\)|var\(--pr\)/)
  assert.match(b, /prefers-reduced-motion: reduce/)
})
test('versión: la 0.34.0 / entrega 33 o una posterior', () => {
  const pkg = JSON.parse(leer('package.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 34, pkg.version)
  assert.ok(+pkg.entrega >= 33, pkg.entrega)
  assert.match(leer('CHANGELOG.md'), /## v0\.34\.0 · Entrega 33/)
})
