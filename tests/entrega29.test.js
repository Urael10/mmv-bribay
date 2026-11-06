// Entrega 29 · IA con actividad y rutas: pasos, actividades y rutas en el informe, la preparación y el coach,
// sin contar dos veces la misma salida y sin que salga nada más que totales.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {
  COINCIDE,
  RPE_ACTIVIDAD,
  actividadSinNota,
  cargaActividad,
  cargasExternas,
  hayMovimiento,
  movimientoParaIA,
  movimientoSemana,
  pasosContexto,
  repartirRutas,
  rutaSinTrazo,
  rutasAparte
} from '../src/domain/movimiento.js'
import {
  P_COACH,
  cuerpoCoach,
  hayDatos,
  informeSemana,
  textoActividad,
  textoInforme
} from '../src/domain/informe.js'
import {HISTORIAL_MIN_DIAS, preparacion, puntajeCarga} from '../src/domain/preparacion.js'
import {sumaDias} from '../src/domain/stats.js'
import {resumenRutasParaIA} from '../src/domain/rutas.js'

const L = '2026-11-02' // lunes
const HOY = '2026-11-05'
const ruta = (id, fecha, o = {}) => ({
  id,
  fecha,
  tipo: 'caminata',
  distM: 5000,
  seg: 3600,
  sube: 40,
  ritmo: 720,
  ...o
})
const act = (id, fecha, o = {}) => ({
  id,
  fecha,
  tipo: 'caminata',
  minutos: 60,
  km: 5,
  rutaId: null,
  ...o
})

// ---------- Filas reducidas ----------
test('rutaSinTrazo: se queda solo con lo agregable (sin puntos, horas, parciales ni tramos)', () => {
  const r = rutaSinTrazo({
    id: 3,
    fecha: L,
    inicio: 1730000000123,
    tipo: 'carrera',
    distM: 5012.4,
    seg: 1800,
    ritmo: 359,
    sube: 12,
    baja: 9,
    parciales: [{km: 1, seg: 361}],
    puntos: 'AAAA',
    nPuntos: 40,
    origen: 'gpx'
  })
  assert.deepEqual(Object.keys(r).sort(), ['distM', 'fecha', 'id', 'ritmo', 'seg', 'sube', 'tipo'])
  assert.equal(rutaSinTrazo({id: 1, fecha: L, distM: 100, seg: 0}).ritmo, null)
})
test('actividadSinNota: saca la nota (texto libre) y normaliza rutaId', () => {
  const a = actividadSinNota({
    id: 1,
    fecha: L,
    tipo: 'carrera',
    minutos: 30,
    km: 5,
    nota: 'con Ana en casa'
  })
  assert.equal('nota' in a, false)
  assert.equal(a.rutaId, null)
  assert.equal(actividadSinNota({id: 1, fecha: L, minutos: 30, rutaId: 7}).rutaId, 7)
})

// ---------- Anti doble conteo ----------
test('una ruta enlazada por rutaId cuenta solo en su actividad', () => {
  const rs = [ruta(1, L), ruta(2, L, {tipo: 'carrera'})]
  const as = [act(10, L, {rutaId: 1})]
  const {aparte, enActividad} = repartirRutas(rs, as)
  assert.deepEqual(
    aparte.map(r => r.id),
    [2]
  )
  assert.deepEqual(
    enActividad.map(r => r.id),
    [1]
  )
})
test('GPX importado + actividad cargada a mano de la misma salida: cuenta una sola vez', () => {
  const importada = ruta(5, L, {distM: 5230, seg: 3500})
  const manual = act(1, L, {km: 5.2, minutos: 58})
  assert.deepEqual(rutasAparte([importada], [manual]), [])
})
test('no se considera la misma salida si cambia el día, el tipo o la distancia', () => {
  const r = ruta(1, L, {distM: 5000})
  assert.equal(rutasAparte([r], [act(1, sumaDias(L, 1), {km: 5})]).length, 1, 'otro día')
  assert.equal(rutasAparte([r], [act(1, L, {tipo: 'carrera', km: 5})]).length, 1, 'otro tipo')
  assert.equal(rutasAparte([r], [act(1, L, {km: 8})]).length, 1, 'distancia muy distinta')
  assert.equal(
    rutasAparte([r], [act(1, L, {km: 5.6})]).length,
    0,
    '5,6 vs 5,0 km está dentro de la tolerancia'
  )
})
test('tolerancia: salidas cortas usan el mínimo en km; las largas, el porcentaje', () => {
  assert.equal(COINCIDE.kmMin, 0.3)
  assert.equal(rutasAparte([ruta(1, L, {distM: 1000})], [act(1, L, {km: 1.25})]).length, 0)
  assert.equal(rutasAparte([ruta(1, L, {distM: 1000})], [act(1, L, {km: 1.4})]).length, 1)
  assert.equal(rutasAparte([ruta(1, L, {distM: 20000})], [act(1, L, {km: 22.5})]).length, 0)
  assert.equal(rutasAparte([ruta(1, L, {distM: 20000})], [act(1, L, {km: 24})]).length, 1)
})
test('emparejamiento uno a uno: una actividad no tapa a dos rutas del mismo día', () => {
  const rs = [ruta(1, L, {distM: 5000}), ruta(2, L, {distM: 5100})]
  const r = repartirRutas(rs, [act(1, L, {km: 5.1})])
  assert.equal(r.enActividad.length, 1)
  assert.equal(r.aparte.length, 1)
  assert.equal(r.enActividad[0].id, 2, 'queda con la más parecida (5,1 km)')
})
test('sin distancia en la actividad, se compara por duración; sin horarios en la ruta, por distancia', () => {
  assert.equal(rutasAparte([ruta(1, L, {seg: 3600})], [act(1, L, {km: 0, minutos: 62})]).length, 0)
  assert.equal(rutasAparte([ruta(1, L, {seg: 3600})], [act(1, L, {km: 0, minutos: 90})]).length, 1)
  assert.equal(rutasAparte([ruta(1, L, {seg: 0, ritmo: null})], [act(1, L, {km: 5})]).length, 0)
  assert.equal(
    rutasAparte([ruta(1, L, {seg: 0, ritmo: null})], [act(1, L, {km: 0, minutos: 60})]).length,
    1
  )
})
test('una actividad ya enlazada a otra ruta no se usa para tapar una ruta distinta', () => {
  const rs = [ruta(1, L), ruta(2, L)]
  const r = repartirRutas(rs, [act(1, L, {rutaId: 1})])
  assert.deepEqual(
    r.aparte.map(x => x.id),
    [2]
  )
})

// ---------- Carga de la actividad ----------
test('cargaActividad: RPE típico × minutos, con tope de 24 h y tipos desconocidos como «otro»', () => {
  assert.equal(cargaActividad({tipo: 'caminata', minutos: 60}), 60 * RPE_ACTIVIDAD.caminata)
  assert.equal(cargaActividad({tipo: 'carrera', minutos: 30}), 180)
  assert.equal(cargaActividad({tipo: 'rarísimo', minutos: 10}), 10 * RPE_ACTIVIDAD.otro)
  assert.equal(cargaActividad({tipo: 'carrera', minutos: 99999}), 1440 * 6)
  assert.equal(cargaActividad({tipo: 'carrera', minutos: -4}), 0)
})
test('cargasExternas: actividades + rutas que no están en ninguna (una salida, una carga)', () => {
  const as = [act(1, L, {tipo: 'carrera', minutos: 30, km: 5, rutaId: 1})]
  const rs = [
    ruta(1, L, {tipo: 'carrera', distM: 5000, seg: 1800}),
    ruta(2, sumaDias(L, 1), {seg: 1800})
  ]
  const ext = cargasExternas(as, rs)
  assert.equal(ext.length, 2)
  assert.deepEqual(
    ext.map(x => x.carga),
    [180, 60]
  )
  assert.deepEqual(
    ext.map(x => x.minutos),
    [30, 30]
  )
})

// ---------- Preparación ----------
const sesion = (fecha, rpe = 7, min = 45) => ({fecha, rpe, bloques: [{minutos: min}]})
const sesiones = []
for (let i = 0; i < 28; i += 3) sesiones.push(sesion(sumaDias(HOY, -i)))

test('puntajeCarga: sin externas da lo mismo que antes', () => {
  assert.deepEqual(puntajeCarga(sesiones, HOY), puntajeCarga(sesiones, HOY, []))
  assert.equal(puntajeCarga([], HOY), null)
  assert.equal(puntajeCarga([], HOY, []), null)
})
test('puntajeCarga: la actividad entra en la razón aguda/crónica', () => {
  const base = puntajeCarga(sesiones, HOY)
  // mucha actividad intensa solo en los últimos 7 días → la razón sube y el puntaje baja
  const ext = [0, 1, 2, 3].map(i => ({fecha: sumaDias(HOY, -i), carga: 600}))
  const con = puntajeCarga(sesiones, HOY, ext)
  assert.ok(con.razon > base.razon, `${con.razon} > ${base.razon}`)
  assert.ok(con.p <= base.p)
})
test('puntajeCarga: la actividad sola también da historial si cubre 14 días', () => {
  const ext = [-20, -10, -3].map(d => ({fecha: sumaDias(HOY, d), carga: 120}))
  assert.ok(puntajeCarga([], HOY, ext))
  const corto = [-5, -3].map(d => ({fecha: sumaDias(HOY, d), carga: 120}))
  assert.equal(
    puntajeCarga([], HOY, corto),
    null,
    `menos de ${HISTORIAL_MIN_DIAS} días de historia`
  )
})
test('preparacion: usa actividades y rutas, no cuenta dos veces y muestra los minutos; los pesos no cambian', () => {
  const hab = [{fecha: HOY, energia: 4, animo: 4, dolor: 2, sueno: '7', calidad: 4}]
  const igual = preparacion({fecha: HOY, habitos: hab, sesiones})
  const sinAct = preparacion({fecha: HOY, habitos: hab, sesiones, actividades: [], rutas: []})
  assert.deepEqual(sinAct, igual)
  const as = [0, 1, 2].map(i =>
    act(i + 1, sumaDias(HOY, -i), {tipo: 'carrera', minutos: 50, km: 8, rutaId: i + 1})
  )
  const rs = [0, 1, 2].map(i =>
    ruta(i + 1, sumaDias(HOY, -i), {tipo: 'carrera', distM: 8000, seg: 3000})
  )
  const conAmbas = preparacion({fecha: HOY, habitos: hab, sesiones, actividades: as, rutas: rs})
  const soloActs = preparacion({fecha: HOY, habitos: hab, sesiones, actividades: as, rutas: []})
  assert.equal(
    conAmbas.partes.carga.p,
    soloActs.partes.carga.p,
    'las rutas enlazadas no suman otra vez'
  )
  assert.match(conAmbas.partes.carga.detalle, /con 150 min de actividad/)
  assert.ok(conAmbas.partes.carga.p <= igual.partes.carga.p)
})
test('pasosContexto: ayer contra tu promedio (solo con 5 o más días), y es informativo', () => {
  const hs = []
  for (let i = 2; i <= 8; i++) hs.push({fecha: sumaDias(HOY, -i), pasos: 8000})
  hs.push({fecha: sumaDias(HOY, -1), pasos: 12000})
  assert.deepEqual(pasosContexto(hs, HOY), {ayer: 12000, habitual: 8000})
  assert.deepEqual(pasosContexto(hs.slice(-3), HOY), {ayer: 12000, habitual: null})
  assert.equal(pasosContexto([{fecha: sumaDias(HOY, -1), pasos: 0}], HOY), null)
  const p = preparacion({
    fecha: HOY,
    habitos: [{fecha: HOY, energia: 4, animo: 4, dolor: 2, sueno: '7', calidad: 4}, ...hs],
    sesiones
  })
  const q = preparacion({
    fecha: HOY,
    habitos: [
      {fecha: HOY, energia: 4, animo: 4, dolor: 2, sueno: '7', calidad: 4},
      ...hs.map(h => ({...h, pasos: 1}))
    ],
    sesiones
  })
  assert.equal(p.pasos.ayer, 12000)
  assert.equal(p.puntaje, q.puntaje, 'los pasos no cambian el puntaje')
})

// ---------- Informe ----------
test('movimientoSemana: pasos medios, variación, actividades por tipo y rutas aparte', () => {
  const m = movimientoSemana({
    desde: L,
    habitos: [
      {fecha: sumaDias(L, -7), pasos: 6000},
      {fecha: sumaDias(L, -6), pasos: 6000},
      {fecha: L, pasos: 9000},
      {fecha: sumaDias(L, 1), pasos: 7000},
      {fecha: sumaDias(L, 2), pasos: null}
    ],
    actividades: [
      act(1, L, {tipo: 'carrera', minutos: 30, km: 5, rutaId: 1}),
      act(2, sumaDias(L, 2), {tipo: 'caminata', minutos: 45, km: 3}),
      act(3, sumaDias(L, -3), {minutos: 999, km: 99}) // semana anterior: no cuenta
    ],
    rutas: [
      ruta(1, L, {tipo: 'carrera', distM: 5000, seg: 1800}),
      ruta(2, sumaDias(L, 4), {tipo: 'bicicleta', distM: 20000, seg: 3000, sube: 100}),
      ruta(3, sumaDias(L, 2), {distM: 3000, seg: 2700}) // coincide con la caminata de la actividad 2
    ]
  })
  assert.deepEqual(m.pasos, {diasConDato: 2, medios: 8000, total: 16000, vsAnterior: 33})
  assert.equal(m.actividades.cantidad, 2)
  assert.equal(m.actividades.minutos, 75)
  assert.equal(m.actividades.km, 8)
  assert.deepEqual(Object.keys(m.actividades.porTipo).sort(), ['caminata', 'carrera'])
  assert.equal(m.rutasAparte.rutas, 1)
  assert.equal(m.rutasAparte.km, 20)
  assert.equal(m.rutasEnActividades, 2)
  assert.equal(m.total.km, 28)
  assert.equal(m.total.minutos, 75 + 50)
})
test('movimientoSemana: la variación de pasos solo se calcula si hay datos en ambas semanas', () => {
  const m = movimientoSemana({desde: L, habitos: [{fecha: L, pasos: 5000}]})
  assert.equal(m.pasos.vsAnterior, null)
  assert.equal(m.pasos.medios, 5000)
})
test('informeSemana: trae la actividad y hayDatos la considera (también si es lo único)', () => {
  const vacio = informeSemana({desde: L})
  assert.equal(hayDatos(vacio), false)
  assert.equal(hayMovimiento(vacio.actividad), false)
  const solo = informeSemana({desde: L, habitos: [{fecha: L, pasos: 4000}]})
  assert.equal(hayDatos(solo), true)
  const solo2 = informeSemana({desde: L, actividades: [act(1, L)]})
  assert.equal(hayDatos(solo2), true)
  const solo3 = informeSemana({desde: L, rutas: [ruta(1, L)]})
  assert.equal(hayDatos(solo3), true)
})
test('textoInforme: línea de Actividad legible, con voseo del resto y sin null/NaN', () => {
  assert.equal(textoActividad(vacioAct()), 'Actividad: sin datos')
  const i = informeSemana({
    desde: L,
    habitos: [
      {fecha: L, pasos: 8000},
      {fecha: sumaDias(L, 1), pasos: 10000}
    ],
    actividades: [act(1, L, {minutos: 40, km: 3.5})],
    rutas: [ruta(2, sumaDias(L, 3), {tipo: 'bicicleta', distM: 15200, seg: 2400})]
  })
  const t = textoInforme(i)
  assert.match(
    t,
    /Actividad: 9\.000 pasos de media en 2 días · 1 actividad \(40 min, 3,5 km\) · 1 ruta con GPS aparte \(15,2 km\)/
  )
  assert.ok(!/NaN|undefined|null/.test(t), t)
})
function vacioAct() {
  return informeSemana({desde: L}).actividad
}

// ---------- Coach: qué sale hacia la IA ----------
const COMPLETAS = [
  ruta(1, L, {
    tipo: 'carrera',
    distM: 10040,
    seg: 3000,
    ritmo: 299,
    sube: 85,
    // lo que NUNCA debe salir: aunque alguien le pase la fila completa al informe
    inicio: 1730000123456,
    puntos: 'PUNTOS-SECRETOS-LAT-34.9011',
    segs: [[{lat: -34.9011, lon: -56.1645}]],
    parciales: [{km: 1, seg: 777771}],
    nPuntos: 321,
    origen: 'gpx'
  })
]
const ACTS = [
  act(1, sumaDias(L, 1), {
    tipo: 'bicicleta',
    minutos: 50,
    km: 18,
    nota: 'casa de Ana, calle Falsa 123'
  })
]

test('coach: el cuerpo trae totales de actividad, rutas aparte y las reglas nuevas', () => {
  const i = informeSemana({
    desde: L,
    habitos: [{fecha: L, pasos: 9000}],
    actividades: ACTS,
    rutas: COMPLETAS
  })
  const c = JSON.parse(cuerpoCoach(i, null)),
    t = c.contents[0].parts[0].text
  assert.ok(t.startsWith(P_COACH))
  const datos = JSON.parse(t.slice(t.indexOf('DATOS:\n') + 7))
  assert.deepEqual(Object.keys(datos.actividad).sort(), [
    'actividades',
    'pasos',
    'rutasAparte',
    'total'
  ])
  assert.equal(datos.actividad.pasos.medios, 9000)
  assert.equal(datos.actividad.actividades.cantidad, 1)
  assert.equal(datos.actividad.actividades.porTipo.bicicleta.km, 18)
  assert.equal(datos.actividad.rutasAparte.rutas, 1)
  assert.equal(datos.actividad.rutasAparte.km, 10)
  assert.equal(datos.actividad.rutasAparte.ritmoMedioSegKm, 299)
  assert.equal('rutasEnActividades' in datos.actividad, false)
  for (const regla of [
    'rutasAparte',
    'no se cuentan dos veces',
    'ajustes concretos',
    'sin nombrar ejercicios'
  ])
    assert.ok(P_COACH.includes(regla), regla)
  assert.ok(P_COACH.includes('SOLO JSON'), 'sigue pidiendo JSON')
})
test('coach: PRIVACIDAD — ni coordenadas, ni puntos, ni horas, ni parciales, ni notas salen del dispositivo', () => {
  const i = informeSemana({desde: L, actividades: ACTS, rutas: COMPLETAS})
  const completo = cuerpoCoach(i, {
    ok: true,
    puntaje: 70,
    confianza: 85,
    partes: {carga: {p: 80, detalle: 'x'}}
  })
  // solo los DATOS: el texto del prompt (instrucciones) puede contener palabras como «lat» dentro de otras
  const t = JSON.parse(completo).contents[0].parts[0].text
  const cuerpo = t.slice(t.indexOf('DATOS:\n'))
  for (const prohibido of [
    'PUNTOS-SECRETOS',
    '34.9011',
    '56.1645',
    '1730000123456',
    '777771',
    'Falsa',
    'casa de Ana',
    'puntos',
    'segs',
    'parciales',
    'inicio',
    'nota',
    'lat',
    '"lon"'
  ])
    assert.equal(cuerpo.includes(prohibido), false, `no debe viajar: ${prohibido}`)
  assert.equal(cuerpo.includes('kmMasLarga'), true)
})
test('coach: sin movimiento no manda el bloque de actividad (no se inventa un cero)', () => {
  const t = JSON.parse(cuerpoCoach(informeSemana({desde: L}), null)).contents[0].parts[0].text
  assert.equal(t.slice(t.indexOf('DATOS:\n')).includes('actividad'), false)
})
test('movimientoParaIA coincide con resumenRutasParaIA (mismos agregados, sin campos extra)', () => {
  const m = movimientoSemana({desde: L, rutas: COMPLETAS})
  const ia = movimientoParaIA(m)
  const base = resumenRutasParaIA(COMPLETAS)
  assert.equal(ia.rutasAparte.rutas, base.rutas)
  assert.equal(ia.rutasAparte.km, base.km)
  assert.equal(ia.rutasAparte.kmMasLarga, base.kmMasLarga)
  assert.deepEqual(Object.keys(ia.rutasAparte).sort(), [
    'desnivelSubeM',
    'km',
    'kmMasLarga',
    'minutos',
    'ritmoMedioSegKm',
    'rutas'
  ])
  assert.equal(movimientoParaIA(null), null)
})

// ---------- Código: quién puede ver rutas ----------
const raiz = new URL('..', import.meta.url).pathname
const leer = p => readFileSync(join(raiz, p), 'utf8')
const archivos = d =>
  readdirSync(join(raiz, d)).flatMap(n => {
    const r = join(d, n)
    return statSync(join(raiz, r)).isDirectory() ? archivos(r) : [r]
  })

test('PRIVACIDAD (código): los servicios siguen sin tocar rutas; el informe, la preparación y el coach no leen trazos ni notas', () => {
  for (const f of archivos('src/services'))
    assert.doesNotMatch(leer(f), /rutas|movimiento|\.puntos\b/, f)
  for (const f of [
    'src/domain/informe.js',
    'src/domain/preparacion.js',
    'src/domain/movimiento.js',
    'src/data/movimiento.js',
    'src/features/coach/Coach.jsx',
    'src/features/coach/prep.js',
    'src/features/coach/Preparacion.jsx'
  ])
    assert.doesNotMatch(
      leer(f),
      /\.(puntos|segs|parciales|nPuntos|inicio|nota|lat|lon)\b/,
      `${f} no debe leer coordenadas, horas ni notas`
    )
})
test('PRIVACIDAD (código): quién importa los módulos de rutas es una lista cerrada', () => {
  const quien = archivos('src')
    .filter(f => /\.(js|jsx)$/.test(f))
    .flatMap(f =>
      [...leer(f).matchAll(/from '([^']*\/rutas(?:\.js)?)'/g)].map(
        m => `${f.replaceAll('\\', '/')} ← ${m[1]}`
      )
    )
    .sort()
  assert.deepEqual(quien, [
    'src/domain/gpx.js ← ./rutas.js',
    'src/domain/mapa.js ← ./rutas.js',
    'src/domain/movimiento.js ← ./rutas.js',
    'src/features/actividad/ActividadFisica.jsx ← ../../data/rutas',
    'src/features/actividad/ActividadFisica.jsx ← ../../domain/rutas',
    'src/features/rutas/Rutas.jsx ← ../../data/rutas',
    'src/features/rutas/Rutas.jsx ← ../../domain/rutas',
    'src/ui/TrazoSvg.jsx ← ../domain/rutas'
  ])
  // y movimiento.js toma de rutas.js una sola cosa: el resumen que ya es solo agregados
  assert.match(
    leer('src/domain/movimiento.js'),
    /import \{resumenRutasParaIA\} from '\.\/rutas\.js'/
  )
  // la tabla de rutas solo la leen la capa de datos de rutas (con trazo) y la de movimiento (sin trazo)
  const leen = archivos('src')
    .filter(f => /db\.rutas/.test(leer(f)))
    .map(f => f.replaceAll('\\', '/'))
    .sort()
  assert.deepEqual(leen, ['src/data/movimiento.js', 'src/data/rutas.js'])
})

test('datos: leerMovimiento devuelve filas SIN trazo ni nota y respeta el rango de fechas', async () => {
  const {db} = await import('../src/data/db.js')
  const {leerMovimiento} = await import('../src/data/movimiento.js')
  await db.open()
  await db.actividades.bulkAdd([
    {fecha: L, tipo: 'carrera', minutos: 30, km: 5, nota: 'privado', rutaId: 1},
    {fecha: sumaDias(L, -20), tipo: 'carrera', minutos: 30}
  ])
  await db.rutas.bulkAdd([
    {
      fecha: L,
      inicio: 1730000000000,
      tipo: 'carrera',
      distM: 5000,
      seg: 1800,
      ritmo: 360,
      parciales: [{km: 1, seg: 360}],
      puntos: 'COORDENADAS',
      nPuntos: 50,
      sube: 10
    },
    {fecha: sumaDias(L, -20), tipo: 'carrera', distM: 3000, seg: 900, puntos: 'X'}
  ])
  const r = await leerMovimiento(sumaDias(L, -7), sumaDias(L, 6))
  assert.equal(r.actividades.length, 1)
  assert.equal(r.rutas.length, 1)
  assert.equal(JSON.stringify(r).includes('COORDENADAS'), false)
  assert.equal(JSON.stringify(r).includes('privado'), false)
  assert.equal('puntos' in r.rutas[0] || 'inicio' in r.rutas[0] || 'parciales' in r.rutas[0], false)
  assert.equal('nota' in r.actividades[0], false)
  assert.equal(r.actividades[0].rutaId, 1)
})

// ---------- Carga diferida intacta ----------
test('carga diferida: Hoy sigue sin importar Coach ni Progreso; prep.js solo suma archivos chicos', () => {
  const prep = leer('src/features/coach/prep.js')
  assert.match(prep, /from '\.\.\/\.\.\/data\/movimiento'/)
  assert.doesNotMatch(prep, /Coach|Progreso|Pilares|Comidas/)
  assert.doesNotMatch(leer('src/features/hoy/Hoy.jsx'), /coach\/Coach|progreso\/Progreso/)
  const coach = leer('src/features/coach/Coach.jsx')
  assert.match(coach, /from '\.\/prep'/)
  assert.match(coach, /leerMovimiento/)
  // Coach sigue viviendo en el paquete de Progreso (lo importa Progreso, no el registro)
  assert.match(leer('src/features/progreso/Progreso.jsx'), /from '\.\.\/coach\/Coach'/)
  assert.doesNotMatch(leer('src/ui/pantallas.js'), /coach\/Coach/)
})

test('versión: la 0.30.0 / entrega 29 o una posterior (la exacta la fija la prueba de la última entrega)', () => {
  const pkg = JSON.parse(leer('package.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 30, pkg.version)
  assert.ok(+pkg.entrega >= 29, pkg.entrega)
  assert.match(leer('package-lock.json'), /"version": "0\.\d+\.\d+"/)
})
