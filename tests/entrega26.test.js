// Entrega 26 · Rutas GPS: recorrido, simplificación, parciales, privacidad, trazo SVG, historial y datos.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import Dexie from 'dexie'
import {distanciaM, armarActividad} from '../src/domain/actividad.js'
import {
  RUTA_CFG,
  rutaNueva,
  totalPuntos,
  agregarPuntoRuta,
  simplificar,
  limitarPuntos,
  distanciaRutaM,
  recortarExtremos,
  parciales,
  desnivel,
  ritmoSegKm,
  formatoRitmo,
  formatoDuracion,
  compactar,
  descompactar,
  rutaParaGuardar,
  rutaDesdeGuardado,
  armarRuta,
  segsDeRuta,
  trazoSvg,
  resumenRutas,
  agruparPorMes,
  resumenRutasParaIA
} from '../src/domain/rutas.js'

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

// ---- Datos de prueba (Montevideo): camino recto hacia el norte
const LAT0 = -34.9,
  LON0 = -56.16,
  M_POR_GRADO = 111194.9
const camino = (n, {pasoM = 5, dt = 4, t0 = 1_700_000_000_000, alt} = {}) =>
  Array.from({length: n}, (_, i) => ({
    lat: LAT0 + (i * pasoM) / M_POR_GRADO,
    lon: LON0,
    t: t0 + i * dt * 1000,
    ...(alt ? {alt: alt(i)} : {})
  }))
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`)
const nums = d => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)

// ---------- armado del recorrido ----------
test('agregarPuntoRuta: inicio abre segmento, movimiento lo prolonga, hueco abre otro', () => {
  const pts = camino(5)
  let r = agregarPuntoRuta(rutaNueva(), pts[0], 'inicio')
  r = agregarPuntoRuta(r, pts[1], 'movimiento')
  r = agregarPuntoRuta(r, pts[2], 'movimiento')
  assert.deepEqual(
    r.segs.map(g => g.length),
    [3]
  )
  r = agregarPuntoRuta(r, pts[3], 'hueco')
  r = agregarPuntoRuta(r, pts[4], 'movimiento')
  assert.deepEqual(
    r.segs.map(g => g.length),
    [3, 2]
  )
})

test('agregarPuntoRuta: motivos que no mueven nada devuelven la misma ruta y no se muta el estado previo', () => {
  const pts = camino(3)
  const r0 = agregarPuntoRuta(rutaNueva(), pts[0], 'inicio')
  for (const m of ['quieto', 'precision', 'salto', 'tiempo', 'invalido'])
    assert.equal(agregarPuntoRuta(r0, pts[1], m), r0, m)
  const r1 = agregarPuntoRuta(r0, pts[1], 'movimiento')
  assert.equal(r0.segs[0].length, 1, 'el estado anterior no cambia')
  assert.equal(r1.segs[0].length, 2)
})

test('agregarPuntoRuta: la altura solo entra si es confiable', () => {
  const base = camino(1)[0]
  const alt = p => agregarPuntoRuta(rutaNueva(), p, 'inicio').segs[0][0].alt
  assert.equal(alt({...base, alt: 25.4, altPrecision: 10}), 25)
  assert.equal(alt({...base, alt: 25, altPrecision: 40}), undefined)
  assert.equal(alt({...base, alt: null, altPrecision: null}), undefined)
  assert.equal(alt({...base, alt: 25}), undefined)
})

test('agregarPuntoRuta: en memoria nunca pasa del tope', () => {
  let r = rutaNueva()
  for (let i = 0; i < RUTA_CFG.enCursoMax + 200; i++) {
    const p = {lat: LAT0 + i * 1e-5, lon: LON0 + 2e-4 * Math.sin(i / 10), t: 1e12 + i * 1000}
    r = agregarPuntoRuta(r, p, i === 0 ? 'inicio' : 'movimiento')
  }
  assert.ok(totalPuntos(r.segs) <= RUTA_CFG.enCursoMax)
  assert.ok(totalPuntos(r.segs) > 100)
})

// ---------- simplificación ----------
test('simplificar: una recta se reduce a sus extremos', () => {
  const s = simplificar(camino(200))
  assert.equal(s.length, 2)
  assert.deepEqual(s[0], camino(200)[0])
  assert.deepEqual(s[1], camino(200)[199])
})

test('simplificar: conserva una esquina real y descarta el ruido chico', () => {
  const recta = camino(40, {pasoM: 5})
  const esquina = Array.from({length: 40}, (_, i) => ({
    lat: LAT0 + 195 / M_POR_GRADO,
    lon: LON0 + ((i + 1) * 5) / (M_POR_GRADO * Math.cos((LAT0 * Math.PI) / 180)),
    t: 2e12 + i * 4000
  }))
  const ruido = recta.map((p, i) => ({...p, lon: p.lon + (i % 2 ? 1 : -1) * 0.5e-5 * 0.3}))
  assert.equal(simplificar(ruido).length, 2, 'un temblor de ~0,3 m no agrega puntos')
  const s = simplificar([...recta, ...esquina])
  assert.equal(s.length, 3, 'inicio, esquina y final')
})

test('simplificar: casos borde', () => {
  assert.deepEqual(simplificar([]), [])
  const uno = camino(1)
  assert.deepEqual(simplificar(uno), uno)
  assert.equal(simplificar(camino(10), 0).length, 10, 'sin tolerancia no toca nada')
})

test('limitarPuntos: respeta el tope y conserva extremos', () => {
  const ruidoso = Array.from({length: 1000}, (_, i) => ({
    lat: LAT0 + i * 2e-5 + Math.sin(i * 12.9898) * 2e-4,
    lon: LON0 + Math.cos(i * 78.233) * 2e-4,
    t: 3e12 + i * 1000
  }))
  const {segs} = limitarPuntos([ruidoso], 200)
  assert.ok(totalPuntos(segs) <= 200, String(totalPuntos(segs)))
  assert.deepEqual(segs[0][0], ruidoso[0])
  assert.deepEqual(segs[0].at(-1), ruidoso.at(-1))
})

// ---------- distancia, recorte de privacidad ----------
test('distanciaRutaM suma dentro de cada segmento y no cruza los huecos', () => {
  const a = camino(11, {pasoM: 10}) // 100 m
  const b = camino(11, {pasoM: 10}).map(p => ({...p, lat: p.lat + 0.01}))
  cerca(distanciaRutaM([a, b]), 200, 1)
})

test('recortarExtremos: saca el comienzo y el final y deja el medio', () => {
  const ruta = camino(101, {pasoM: 10}) // 1000 m
  const [g] = recortarExtremos([ruta], 150)
  assert.ok(distanciaM(ruta[0], g[0]) >= 149.9)
  assert.ok(distanciaM(ruta.at(-1), g.at(-1)) >= 149.9)
  assert.equal(g.length, 71)
})

test('recortarExtremos: en una ruta corta recorta como mucho un cuarto por punta', () => {
  const ruta = camino(21, {pasoM: 10}) // 200 m
  const [g] = recortarExtremos([ruta], 150)
  cerca(distanciaRutaM([g]), 100, 10.1)
  assert.ok(g.length >= 2)
})

test('recortarExtremos: 0 metros no toca nada y no muta la entrada', () => {
  const ruta = camino(11)
  const copia = JSON.stringify(ruta)
  const salida = recortarExtremos([ruta], 0)
  assert.equal(salida[0].length, 11)
  assert.notEqual(salida[0], ruta)
  assert.equal(JSON.stringify(ruta), copia)
})

// ---------- parciales, desnivel, ritmo ----------
test('parciales: segundos de cada km completo', () => {
  const ruta = camino(520, {pasoM: 5, dt: 4}) // 2595 m a 800 s/km
  const p = parciales([ruta])
  assert.equal(p.length, 2)
  for (const s of p) cerca(s, 800, 1)
})

test('parciales: el tiempo de un hueco sin señal no se cuenta', () => {
  const a = camino(101, {pasoM: 5, dt: 4}) // 500 m en 400 s
  const b = camino(101, {pasoM: 5, dt: 4, t0: 1_700_000_000_000 + 3_600_000}).map(p => ({
    ...p,
    lat: p.lat + 500 / M_POR_GRADO + 0.001
  })) // 500 m más, una hora después y 100+ m más allá
  const p = parciales([a, b])
  assert.equal(p.length, 1)
  cerca(p[0], 800, 2)
})

test('parciales: una ruta de menos de 1 km no tiene parciales', () => {
  assert.deepEqual(parciales([camino(100)]), [])
  assert.deepEqual(parciales([]), [])
})

test('desnivel: histéresis (filtra el ruido) y suma subida y bajada', () => {
  const alts = [100, 100, 106, 106, 100, 103]
  const g = camino(6, {alt: i => alts[i]})
  assert.deepEqual(desnivel([g]), {sube: 6, baja: 6})
  const ruido = camino(50, {alt: i => 100 + (i % 2 ? 1 : -1)})
  assert.deepEqual(desnivel([ruido]), {sube: 0, baja: 0})
})

test('desnivel: sin alturas suficientes devuelve null', () => {
  assert.equal(desnivel([camino(10)]), null)
  assert.equal(desnivel([camino(1, {alt: () => 5})]), null)
})

test('ritmo y formatos', () => {
  assert.equal(ritmoSegKm(1000, 360), 360)
  assert.equal(ritmoSegKm(30, 60), null)
  assert.equal(ritmoSegKm(1000, 0), null)
  assert.equal(formatoRitmo(365), '6:05')
  assert.equal(formatoRitmo(359.6), '6:00')
  assert.equal(formatoRitmo(null), '—')
  assert.equal(formatoRitmo(0), '—')
  assert.equal(formatoDuracion(3725), '1:02:05')
  assert.equal(formatoDuracion(125), '2:05')
  assert.equal(formatoDuracion(-1), '—')
  assert.equal(formatoDuracion(NaN), '—')
})

// ---------- guardado compacto ----------
test('compactar / descompactar: ida y vuelta con altura y segmentos', () => {
  const g1 = camino(4, {alt: i => 20 + i})
  const g2 = camino(3).map(p => ({...p, lat: p.lat + 0.01}))
  const t0 = g1[0].t
  const c = compactar([g1, g2], t0)
  assert.equal(c[0][0].length, 4, 'con altura')
  assert.equal(c[1][0].length, 3, 'sin altura')
  const v = descompactar(c, t0)
  assert.equal(v.length, 2)
  assert.equal(v[0][3].alt, 23)
  cerca(v[0][2].lat, g1[2].lat, 1e-5)
  assert.equal(v[1][1].t, g2[1].t)
})

test('descompactar ignora basura sin romperse', () => {
  assert.deepEqual(descompactar(null, 0), [])
  assert.deepEqual(descompactar('x', 0), [])
  assert.deepEqual(descompactar([[['a', 'b', 'c']], 5, [[1, 2]]], 0), [])
  assert.equal(
    descompactar(
      [
        [
          [1, 2, 3],
          [1, 2]
        ]
      ],
      0
    )[0].length,
    1
  )
})

test('rutaParaGuardar / rutaDesdeGuardado: retoma una ruta en curso', () => {
  const r = {segs: [camino(5, {alt: i => i}), camino(3)]}
  const v = rutaDesdeGuardado(rutaParaGuardar(r))
  assert.deepEqual(
    v.segs.map(g => g.length),
    [5, 3]
  )
  assert.deepEqual(rutaDesdeGuardado(rutaParaGuardar(rutaNueva())), rutaNueva())
  for (const malo of [null, '', 'basura', '{"t0":"x"}', '[]'])
    assert.deepEqual(rutaDesdeGuardado(malo), rutaNueva(), String(malo))
})

// ---------- ruta terminada ----------
const base = {fecha: '2026-11-05', distM: 2595, seg: 2076}

test('armarRuta: rechaza recorridos muy cortos o sin puntos', () => {
  const segs = [camino(520)]
  assert.equal(armarRuta({...base, segs: []}), null)
  assert.equal(armarRuta({...base, segs: [camino(1)]}), null)
  assert.equal(armarRuta({...base, distM: 80, segs}), null)
  assert.equal(armarRuta({...base, seg: 30, segs}), null)
  assert.equal(armarRuta({distM: 2000, seg: 900, segs}), null, 'sin fecha')
})

test('armarRuta: arma la fila con estadísticas del recorrido completo', () => {
  const segs = [camino(520, {alt: i => 10 + Math.floor(i / 20)})]
  const f = armarRuta({...base, segs})
  assert.equal(f.fecha, '2026-11-05')
  assert.equal(f.tipo, 'caminata')
  assert.equal(f.distM, 2595)
  assert.equal(f.seg, 2076)
  assert.equal(f.ritmo, 800)
  assert.equal(f.parciales.length, 2)
  assert.ok(f.sube > 0 && f.baja === 0)
  assert.equal(f.inicio, segs[0][0].t)
  assert.equal(f.recortada, true)
  assert.ok(f.nPuntos >= 2 && f.nPuntos <= RUTA_CFG.puntosMax)
  assert.equal(totalPuntos(segsDeRuta(f)), f.nPuntos)
})

test('armarRuta: el recorte oculta el inicio y el fin del trazo guardado; sin recorte no', () => {
  const segs = [camino(521, {pasoM: 5})]
  const oculta = segsDeRuta(armarRuta({...base, segs}))
  const completa = armarRuta({...base, segs, ocultarM: 0})
  assert.equal(completa.recortada, false)
  const todo = segsDeRuta(completa)
  cerca(todo[0][0].lat, segs[0][0].lat, 1e-5, 'sin recorte arranca igual')
  assert.ok(distanciaM(segs[0][0], oculta[0][0]) >= 140, 'con recorte arranca más adelante')
  assert.ok(distanciaM(segs[0].at(-1), oculta.at(-1).at(-1)) >= 140)
})

test('armarRuta: tipo según el ritmo y tope de puntos en recorridos largos', () => {
  const rapida = armarRuta({
    fecha: '2026-11-05',
    distM: 5000,
    seg: 1500,
    segs: [camino(1000, {pasoM: 5, dt: 1})]
  })
  assert.equal(rapida.tipo, 'carrera') // 12 km/h
  const largo = Array.from({length: 2500}, (_, i) => ({
    lat: LAT0 + i * 2e-5 + Math.sin(i * 12.9898) * 2e-4,
    lon: LON0 + Math.cos(i * 78.233) * 2e-4,
    t: 4e12 + i * 1000
  }))
  const f = armarRuta({fecha: '2026-11-05', distM: 9000, seg: 2500, segs: [largo]})
  assert.ok(f.nPuntos <= RUTA_CFG.puntosMax, String(f.nPuntos))
})

test('armarRuta: no muta el recorrido de entrada', () => {
  const segs = [camino(300)]
  const copia = JSON.stringify(segs)
  armarRuta({fecha: '2026-11-05', distM: 1500, seg: 1200, segs})
  assert.equal(JSON.stringify(segs), copia)
})

// ---------- trazo SVG ----------
test('trazoSvg: sin puntos no hay trazo', () => {
  assert.equal(trazoSvg([]), null)
  assert.equal(trazoSvg([[]]), null)
})

test('trazoSvg: un punto solo se dibuja sin romperse', () => {
  const t = trazoSvg([camino(1)])
  assert.ok(t.paths[0].startsWith('M'))
  assert.deepEqual(t.inicio, t.fin)
})

test('trazoSvg: todo cae dentro del recuadro con margen y el norte queda arriba', () => {
  const ancho = 300,
    alto = 180,
    margen = 12
  const t = trazoSvg([camino(101, {pasoM: 10})], {ancho, alto, margen})
  const v = nums(t.paths[0])
  for (let i = 0; i < v.length; i += 2) {
    assert.ok(v[i] >= margen - 0.1 && v[i] <= ancho - margen + 0.1, `x ${v[i]}`)
    assert.ok(v[i + 1] >= margen - 0.1 && v[i + 1] <= alto - margen + 0.1, `y ${v[i + 1]}`)
  }
  assert.ok(t.fin.y < t.inicio.y, 'caminar al norte sube en la pantalla')
  cerca(t.inicio.y - t.fin.y, alto - 2 * margen, 0.2, 'el largo usa todo el alto')
  assert.equal(t.viewBox, `0 0 ${ancho} ${alto}`)
})

test('trazoSvg: conserva la proporción real (este-oeste ancho, norte-sur alto)', () => {
  const kLon = M_POR_GRADO * Math.cos((LAT0 * Math.PI) / 180)
  const este = Array.from({length: 11}, (_, i) => ({
    lat: LAT0,
    lon: LON0 + (i * 100) / kLon,
    t: i * 1000
  })) // 1000 m
  const t = trazoSvg([este], {ancho: 300, alto: 180, margen: 12})
  cerca(t.fin.x - t.inicio.x, 276, 0.2)
  cerca(t.inicio.y, 90, 0.2, 'queda centrado en vertical')
})

test('trazoSvg: cada segmento es su propio trazo (sin línea a través del hueco)', () => {
  const a = camino(5),
    b = camino(5).map(p => ({...p, lat: p.lat + 0.01}))
  assert.equal(trazoSvg([a, b]).paths.length, 2)
})

// ---------- historial ----------
test('agruparPorMes: meses de nuevo a viejo, rutas de nueva a vieja y totales', () => {
  const lista = [
    {id: 1, fecha: '2026-09-30', inicio: 1, distM: 3000, seg: 1800, sube: 10},
    {id: 2, fecha: '2026-11-02', inicio: 200, distM: 5000, seg: 2400},
    {id: 3, fecha: '2026-11-04', inicio: 300, distM: 2000, seg: 900, sube: 5},
    {id: 4, fecha: '2026-10-15', inicio: 50, distM: 1000, seg: 600},
    {id: 5, fecha: 'basura', inicio: 1, distM: 9999, seg: 1}
  ]
  const g = agruparPorMes(lista)
  assert.deepEqual(
    g.map(x => x.mes),
    ['2026-11', '2026-10', '2026-09']
  )
  assert.deepEqual(
    g[0].rutas.map(r => r.id),
    [3, 2]
  )
  assert.equal(g[0].cantidad, 2)
  cerca(g[0].km, 7, 1e-9)
  assert.equal(g[0].seg, 3300)
  assert.equal(g[0].sube, 5)
  assert.deepEqual(agruparPorMes([]), [])
  assert.deepEqual(resumenRutas([]), {cantidad: 0, km: 0, seg: 0, sube: 0})
})

// ---------- actividad enlazada ----------
test('armarActividad: guarda rutaId solo si es un entero positivo', () => {
  const b = {fecha: '2026-11-05', tipo: 'caminata', minutos: 30, km: '2,5'.replace(',', '.')}
  assert.equal(armarActividad({...b, rutaId: 7}).rutaId, 7)
  assert.equal(armarActividad({...b, rutaId: '12'}).rutaId, 12)
  for (const malo of [undefined, null, 0, -3, 1.5, 'x'])
    assert.equal('rutaId' in armarActividad({...b, rutaId: malo}), false, String(malo))
  assert.deepEqual(armarActividad(b), {fecha: '2026-11-05', tipo: 'caminata', minutos: 30, km: 2.5})
})

// ---------- privacidad hacia la IA ----------
test('resumenRutasParaIA: solo agregados, nunca coordenadas', () => {
  const filas = [
    armarRuta({...base, segs: [camino(520)]}),
    armarRuta({
      fecha: '2026-11-03',
      distM: 5000,
      seg: 1500,
      segs: [camino(1000, {pasoM: 5, dt: 1})]
    })
  ].map((f, i) => ({...f, id: i + 1}))
  const r = resumenRutasParaIA(filas)
  const texto = JSON.stringify(r)
  assert.equal(r.rutas, 2)
  cerca(r.km, 7.6, 0.05)
  assert.equal(r.porTipo.caminata.rutas, 1)
  assert.equal(r.porTipo.carrera.rutas, 1)
  assert.equal(r.kmMasLarga, 5)
  assert.ok(r.ritmoMedioSegKm > 0)
  assert.doesNotMatch(texto, /lat|lon|puntos|segs|inicio/i)
  for (const f of filas)
    for (const g of f.puntos) assert.equal(texto.includes(String(g[0][0])), false)
  assert.deepEqual(resumenRutasParaIA([]).porTipo, {})
  assert.equal(resumenRutasParaIA([]).ritmoMedioSegKm, null)
})

const raiz = new URL('..', import.meta.url).pathname
const archivos = d =>
  readdirSync(join(raiz, d)).flatMap(n => {
    const r = join(d, n)
    return statSync(join(raiz, r)).isDirectory() ? archivos(r) : [r]
  })

test('ningún servicio (IA, Open Food Facts, escáner) toca las rutas ni sus coordenadas (desde la entrega 29 la IA recibe totales armados en domain/, ver entrega29.test.js)', () => {
  for (const f of archivos('src/services')) {
    const txt = readFileSync(join(raiz, f), 'utf8')
    assert.doesNotMatch(txt, /data\/rutas|domain\/rutas|db\.rutas|\.puntos\b/, f)
  }
})

test('la pantalla ya no promete que la ruta "no se guarda"; el guardado es opcional y tiene aviso', () => {
  const txt = readFileSync(join(raiz, 'src/features/actividad/ActividadFisica.jsx'), 'utf8')
  assert.doesNotMatch(txt, /no se guarda ni sale del teléfono/i)
  assert.match(txt, /Guardar la ruta para ver mi historial/)
  assert.match(txt, /Ocultar los primeros y últimos 150 m/)
  assert.match(txt, /guardarRutaActivo\(\) \? '1'|leer\(K\.guardarRuta\) !== '0'/)
})

// ---------- datos: migración v10 → v11 y backup ----------
test('actualización desde la v10: no se pierde nada y aparece la tabla rutas', async () => {
  const viejo = new Dexie('mv')
  viejo.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
  viejo.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
  viejo.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'})
  viejo.version(4).stores({coach: '&semana'})
  viejo.version(5).stores({alimentos: '++id,&clave,fuenteId', plantillas: '++id,&clave'})
  viejo.version(6).stores({medidas: 'fecha'})
  viejo.version(7).stores({tests: '++id,fecha,clave'})
  viejo.version(8).stores({rutinas: '++id,&clave'})
  viejo.version(9).stores({privado: 'mes'})
  viejo.version(10).stores({actividades: '++id,fecha,tipo'})
  await viejo.open()
  await viejo.habitos.put({fecha: '2026-11-01', pasos: 8000})
  await viejo.actividades.add({fecha: '2026-11-01', tipo: 'caminata', minutos: 40, km: 3.1})
  viejo.close()

  const {db, TABLAS} = await import('../src/data/db.js')
  await db.open()
  assert.equal(db.verno, 11)
  assert.ok(TABLAS.includes('rutas'))
  assert.ok(db.tables.some(t => t.name === 'rutas'))
  assert.equal((await db.habitos.get('2026-11-01')).pasos, 8000)
  assert.equal((await db.actividades.toArray())[0].minutos, 40)
  assert.equal(await db.rutas.count(), 0)
})

test('capa de datos: guardar, listar (más recientes primero), paginar y borrar', async () => {
  const {guardarRuta, contarRutas, listarRutas, rutasEntre, borrarRuta} =
    await import('../src/data/rutas.js')
  const filas = ['2026-11-01', '2026-11-03', '2026-11-02'].map((fecha, i) =>
    armarRuta({
      fecha,
      distM: 2000 + i,
      seg: 1200,
      segs: [camino(300, {t0: 1_700_000_000_000 + i * 1e8})]
    })
  )
  const ids = []
  for (const f of filas) ids.push(await guardarRuta(f))
  assert.equal(await contarRutas(), 3)
  assert.deepEqual(
    (await listarRutas()).map(r => r.fecha),
    ['2026-11-03', '2026-11-02', '2026-11-01']
  )
  assert.equal((await listarRutas(2)).length, 2)
  assert.equal((await rutasEntre('2026-11-02', '2026-11-03')).length, 2)
  const primera = (await listarRutas())[0]
  assert.equal(totalPuntos(segsDeRuta(primera)), primera.nPuntos)
  await borrarRuta(ids[0])
  assert.equal(await contarRutas(), 2)
})

test('backup: las rutas viajan en el archivo y vuelven completas', async () => {
  const {db} = await import('../src/data/db.js')
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  const antes = await db.rutas.toArray()
  assert.ok(antes.length >= 2)
  const d = await armarBackup()
  assert.equal(d.rutas.length, antes.length)
  const texto = JSON.stringify(d)
  await db.rutas.clear()
  assert.equal(await restaurar(JSON.parse(texto)), 0)
  const despues = await db.rutas.toArray()
  assert.deepEqual(despues, antes)
})
