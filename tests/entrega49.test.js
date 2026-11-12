// Entrega 48 (v0.49.0) · lectura del día con IA y caché.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  datosDia,
  hayDatosDia,
  huella,
  cuerpoDia,
  limpiarDia,
  armarCache,
  leerCache,
  estadoCache,
  P_DIA
} from '../src/domain/iaDia.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const F = '2026-11-12'
const base = {
  fecha: F,
  hora: 15.5,
  habitos: [
    {fecha: '2026-11-10', sueno: '5.5', secreto: 'x'},
    {fecha: '2026-11-11', sueno: 7},
    {fecha: F, sueno: '6,5', energia: 4, animo: 3, dolor: 2, agua: 1200, pasos: 4000, notaPrivada: 'no'}
  ],
  comidas: [{fecha: F, nombre: 'Milanesa casera', items: [{nombre: 'Pollo', kcal: 400, p: 40, c: 10, gr: 12}, {nombre: 'Arroz', kcal: 300, p: 6, c: 60, gr: 2}]}],
  sesiones: [{fecha: F, rpe: 8, nombre: 'Piernas', bloques: [{minutos: 30, ejercicios: ['Sentadilla']}, {minutos: 15}]}],
  actividades: [{fecha: F, tipo: 'caminata', minutos: 20, notas: 'plaza'}],
  rutas: [],
  medidas: [{fecha: '2026-11-01', peso: 70}],
  metaKcal: 2200,
  metaAgua: 2500,
  metaPasos: '8000',
  protKg: ''
}

test('datosDia: totales de hoy y sueño de las dos noches anteriores', () => {
  const d = datosDia(base)
  assert.equal(d.horaDelDia, 15)
  assert.deepEqual(d.sueno, {horas: 6.5, noche1Atras: 7, noche2Atras: 5.5})
  assert.deepEqual(d.checkin, {energia: 4, animo: 3, dolorMuscular: 2})
  assert.deepEqual(d.agua, {ml: 1200, meta: 2500})
  assert.equal(d.comida.kcal, 700)
  assert.equal(d.comida.proteinaG, 46)
  assert.equal(d.comida.metaKcal, 2200)
  assert.equal(d.pasos.hoy, 4000)
  assert.equal(d.pasos.referencia, 8000)
  assert.deepEqual(d.entrenoHoy, {sesiones: 1, rpeMedio: 8, minutos: 45})
  assert.deepEqual(d.actividadesHoy, {cantidad: 1, minutos: 20})
})

test('lo que falta va en null o 0, no se inventa', () => {
  const d = datosDia({fecha: F, hora: 9})
  assert.equal(d.sueno.horas, null)
  assert.equal(d.checkin.energia, null)
  assert.equal(d.agua.ml, 0)
  assert.equal(d.comida.kcal, 0)
  assert.equal(d.cargaSemanaVsHabitual, null)
  assert.equal(hayDatosDia(d), false)
  assert.equal(hayDatosDia(null), false)
  assert.equal(hayDatosDia(datosDia(base)), true)
  assert.equal(datosDia({fecha: F, habitos: [{fecha: F, energia: 9}]}).checkin.energia, null)
})

test('privacidad: no viajan nombres, notas, gasto ni campos fuera de la lista', () => {
  const cuerpo = cuerpoDia(datosDia(base)),
    datos = JSON.parse(JSON.parse(cuerpo).contents[0].parts[0].text.split('DATOS DE HOY:\n')[1]) // solo la parte de datos, no el prompt
  const enviado = JSON.stringify(datos)
  for (const prohibido of ['Milanesa', 'Pollo', 'Arroz', 'Piernas', 'Sentadilla', 'plaza', 'secreto', 'notaPrivada', 'gasto', 'kcal"Por', 'trazo', '"lat"', '"lng"', 'peso'])
    assert.equal(enviado.includes(prohibido), false, prohibido)
  assert.deepEqual(Object.keys(datos).sort(), ['actividadesHoy', 'agua', 'cargaSemanaVsHabitual', 'checkin', 'comida', 'entrenoHoy', 'fecha', 'horaDelDia', 'pasos', 'sueno'])
  assert.match(cuerpo, /responseMimeType/)
  assert.match(P_DIA, /SOLO JSON/)
  assert.match(P_DIA, /no inventes/)
  assert.match(P_DIA, /consejos médicos/)
})

test('huella: estable, ignora la hora del día y cambia si cambian los datos', () => {
  const a = huella(datosDia(base)),
    b = huella(datosDia({...base, hora: 20}))
  assert.equal(a, b)
  const c = huella(datosDia({...base, habitos: base.habitos.map(h => (h.fecha === F ? {...h, agua: 1500} : h))}))
  assert.notEqual(a, c)
})

test('limpiarDia: saneado, límites y error si no hay nada', () => {
  const r = limpiarDia({resumen: '  Vas <b>bien</b>  ', sugerencias: ['a', '', 'b', 'c', 'd', 'x'.repeat(300)], alerta: ''})
  assert.equal(r.resumen, 'Vas bbien/b')
  assert.equal(r.sugerencias.length, 3)
  assert.equal(limpiarDia({sugerencias: ['x'.repeat(300)]}).sugerencias[0].length, 160)
  assert.throws(() => limpiarDia({}), /no devolvió una lectura/)
  assert.throws(() => limpiarDia(null), /no devolvió una lectura/)
})

test('caché: ida y vuelta, vigente / desactualizada / sin, y texto roto', () => {
  const h = huella(datosDia(base)),
    c = armarCache({fecha: F, huella: h, lectura: {resumen: 'ok', sugerencias: ['uno'], alerta: ''}, creado: '2026-11-12T15:00:00.000Z'})
  const v = leerCache(JSON.stringify(c))
  assert.deepEqual(v, c)
  assert.equal(estadoCache(v, F, h), 'vigente')
  assert.equal(estadoCache(v, F, 'otra'), 'desactualizada')
  assert.equal(estadoCache(v, '2026-11-13', h), 'sin')
  assert.equal(estadoCache(null, F, h), 'sin')
  for (const malo of ['', 'no es json', 'null', '{}', '{"fecha":"x","huella":"y"}', JSON.stringify({fecha: F, huella: h, lectura: {resumen: 1}})])
    assert.equal(leerCache(malo), null, malo)
})

test('encaje: dominio puro, sin Dexie nueva, usa pedirIA solo desde el botón, versión 0.49.0', () => {
  assert.doesNotMatch(leer('src/domain/iaDia.js'), /from '\.\.?\/(?!stats|preparacion|movimiento|alimentos|cuerpo|metaPasos)|react|db\.|localStorage|document|window/)
  assert.match(leer('src/data/iaDia.js'), /ia_dia/)
  const comp = leer('src/features/hoy/LecturaIA.jsx')
  assert.match(comp, /pedirIA/)
  assert.match(comp, /onClick=\{pedir\}/)
  assert.equal((comp.match(/pedirIA\(/g) || []).length, 1, 'una sola llamada, la del botón')
  assert.doesNotMatch(comp, /useEffect/, 'no se pide en un efecto')
  assert.match(leer('src/features/hoy/NotaDelDia.jsx'), /<LecturaIA/)
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.doesNotMatch(leer('src/domain/informe.js'), /iaDia/)
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.49.0')
  assert.equal(pkg.entrega, '48')
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\s+## v0\.49\.0 · Entrega 48/)
  assert.match(leer('README.md'), /Entrega 48 \(v0\.49\.0\)/)
  assert.match(leer('capacitor.config.ts'), /online\.bribayfitness\.mmv/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
})
