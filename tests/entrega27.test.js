// Entrega 27 · Mapa OSM opcional y GPX: matemática de teselas, exportar/importar GPX y privacidad.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {
  lonLatAPixel,
  pixelALonLat,
  vistaMapa,
  urlTesela,
  TILE_URL,
  MAPA_CFG,
  CLAVE_MAPA
} from '../src/domain/mapa.js'
import {
  rutasAGpx,
  leerGpx,
  rutaDesdeGpx,
  filasDeGpx,
  sinRepetidas,
  tipoDeGpx,
  nombreArchivoGpx,
  fechaLocal
} from '../src/domain/gpx.js'
import {armarRuta, segsDeRuta, distanciaRutaM, RUTA_CFG} from '../src/domain/rutas.js'
import {importarGpx, todasLasRutas, guardarRuta} from '../src/data/rutas.js'
import {db} from '../src/data/db.js'

const raiz = new URL('..', import.meta.url).pathname
const leer = f => readFileSync(join(raiz, f), 'utf8')
const archivos = d =>
  readdirSync(join(raiz, d)).flatMap(n => {
    const r = join(d, n)
    return statSync(join(raiz, r)).isDirectory() ? archivos(r) : [r]
  })

// Salida de ~2 km hacia el norte desde Montevideo, un punto cada ~20 m, 6 min/km.
const T0 = Date.UTC(2026, 10, 5, 12, 0, 0)
const recorrido = (n = 100, ele = true) => [
  Array.from({length: n}, (_, i) => ({
    lat: -34.9 + i * 0.00018,
    lon: -56.16 + i * 0.00002,
    t: T0 + i * 7200,
    ...(ele ? {alt: 20 + Math.round(i / 5)} : {})
  }))
]
const filaDe = (segs, extra = {}) => {
  const distM = distanciaRutaM(segs)
  const seg = (segs[0].at(-1).t - segs[0][0].t) / 1000
  return {
    ...armarRuta({fecha: fechaLocal(segs[0][0].t), distM, seg, segs, ocultarM: 150}),
    ...extra
  }
}

// ---------- Mapa: matemática ----------
test('proyección: el centro del mundo y el ida y vuelta', () => {
  const c = lonLatAPixel(0, 0, 0)
  assert.ok(Math.abs(c.x - 128) < 1e-9 && Math.abs(c.y - 128) < 1e-9)
  const e = lonLatAPixel(0, 180, 0)
  assert.ok(Math.abs(e.x - 256) < 1e-9)
  for (const [lat, lon, z] of [
    [-34.9, -56.16, 15],
    [40.4, -3.7, 9],
    [-80, 170, 5]
  ]) {
    const q = lonLatAPixel(lat, lon, z)
    const b = pixelALonLat(q.x, q.y, z)
    assert.ok(Math.abs(b.lat - lat) < 1e-7 && Math.abs(b.lon - lon) < 1e-7)
  }
})

test('teselas: Montevideo z10 cae en la tesela conocida', () => {
  const q = lonLatAPixel(-34.9011, -56.1645, 10)
  assert.equal(Math.floor(q.x / 256), 352)
  assert.equal(Math.floor(q.y / 256), 618)
})

test('vista: el trazo entra en el recuadro y las teselas lo cubren', () => {
  const v = vistaMapa(recorrido(), {ancho: 320, alto: 220})
  assert.ok(v.z >= MAPA_CFG.zMin && v.z <= MAPA_CFG.zMax)
  assert.ok(v.teselas.length >= 1 && v.teselas.length <= MAPA_CFG.teselasMax)
  const nums = v.paths[0].match(/-?\d+(\.\d+)?/g).map(Number)
  for (let i = 0; i < nums.length; i += 2) {
    assert.ok(nums[i] >= 0 && nums[i] <= 320, 'x dentro')
    assert.ok(nums[i + 1] >= 0 && nums[i + 1] <= 220, 'y dentro')
  }
  // todo el recuadro queda cubierto por alguna tesela
  for (const [px, py] of [
    [0, 0],
    [319, 0],
    [0, 219],
    [319, 219],
    [160, 110]
  ])
    assert.ok(
      v.teselas.some(s => px >= s.left && px < s.left + 256 && py >= s.top && py < s.top + 256),
      `sin tesela en ${px},${py}`
    )
})

test('vista: más largo = menos zoom; un punto solo = zoom máximo', () => {
  const corto = vistaMapa(recorrido(10), {})
  const largo = vistaMapa(
    [
      [
        {lat: -34.9, lon: -56.2},
        {lat: -34.5, lon: -55.8}
      ]
    ],
    {}
  )
  assert.ok(largo.z < corto.z)
  const uno = vistaMapa([[{lat: -34.9, lon: -56.2}]], {})
  assert.equal(uno.z, MAPA_CFG.zMax)
  assert.equal(vistaMapa([], {}), null)
  assert.equal(vistaMapa([[{lat: NaN, lon: 1}]], {}), null)
})

test('vista: cruzar el antimeridiano no rompe los índices de tesela', () => {
  const v = vistaMapa(
    [
      [
        {lat: 0, lon: 179.9995},
        {lat: 0, lon: 179.9999}
      ]
    ],
    {}
  )
  for (const s of v.teselas) assert.ok(s.x >= 0 && s.x < 2 ** s.z && s.y >= 0 && s.y < 2 ** s.z)
})

test('las URL de teselas solo apuntan a tile.openstreetmap.org', () => {
  assert.equal(urlTesela(10, 352, 616), 'https://tile.openstreetmap.org/10/352/616.png')
  const v = vistaMapa(recorrido(), {})
  for (const s of v.teselas)
    assert.match(s.url, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/)
  assert.ok(TILE_URL.startsWith('https://tile.openstreetmap.org/'))
})

// ---------- GPX: exportar ----------
test('exportar: GPX 1.1 válido con trkpt, ele, time y extensión propia', () => {
  const fila = filaDe(recorrido())
  const g = rutasAGpx([{...fila, id: 1}])
  assert.match(g, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(g, /<gpx version="1.1" creator="MMV"/)
  assert.match(g, /<trkpt lat="-34\.\d{5}" lon="-56\.\d{5}">/)
  assert.match(g, /<ele>\d+<\/ele>/)
  assert.match(g, /<time>2026-11-05T12:00:\d\d\.\d{3}Z<\/time>/)
  assert.match(g, /<mmv:ruta inicio="\d+" distM="\d+" seg="\d+"/)
  assert.equal(rutasAGpx([]), '')
})

test('exportar: el nombre se escapa y sin horario no se inventa <time>', () => {
  const fila = filaDe(recorrido(), {nombre: 'A & B <"x">', sinTiempo: true})
  const g = rutasAGpx([fila])
  assert.ok(g.includes('A &amp; B &lt;&quot;x&quot;&gt;'))
  assert.ok(!g.includes('<time>'))
})

test('nombre de archivo: una ruta usa su fecha, varias la de hoy', () => {
  assert.equal(nombreArchivoGpx([{fecha: '2026-11-05'}], '2026-11-06'), 'mmv-ruta-2026-11-05.gpx')
  assert.equal(nombreArchivoGpx([{}, {}], '2026-11-06'), 'mmv-rutas-2026-11-06.gpx')
})

// ---------- GPX: leer ----------
const GPX_EXT = `<?xml version="1.0"?>
<!-- comentario <trkpt lat="1" lon="1"/> que se ignora -->
<gpx version="1.1" creator="OtraApp">
 <metadata><name>Salida</name></metadata>
 <wpt lat="-34.9" lon="-56.1"><name>Punto suelto</name></wpt>
 <trk><name><![CDATA[Corrida & más]]></name><type>Running</type>
  <trkseg>
   <trkpt lon="-56.1600" lat="-34.9000"><ele>20.4</ele><time>2026-11-05T12:00:00Z</time></trkpt>
   <trkpt lat='-34.9010' lon='-56.1600'><ele>21</ele><time>2026-11-05T12:01:00Z</time></trkpt>
   <trkpt lat="-34.9020" lon="-56.1600"/>
   <trkpt lat="abc" lon="-56.1600"/>
   <trkpt lat="95" lon="-56.1600"/>
  </trkseg>
  <trkseg><trkpt lat="-34.9100" lon="-56.1600"/></trkseg>
 </trk>
 <trk><trkseg><trkpt lat="-34.8" lon="-56.1"/><trkpt lat="-34.81" lon="-56.1"/></trkseg></trk>
</gpx>`

test('leer: atributos en cualquier orden, comillas simples, CDATA, comentarios y puntos inválidos', () => {
  const r = leerGpx(GPX_EXT)
  assert.equal(r.pistas.length, 2)
  const [a, b] = r.pistas
  assert.equal(a.nombre, 'Corrida & más')
  assert.equal(a.tipo, 'Running')
  assert.equal(a.segs.length, 2)
  assert.equal(a.segs[0].length, 3) // se descartan "abc" y lat 95
  assert.equal(a.segs[0][0].alt, 20)
  assert.equal(a.segs[0][0].t, Date.UTC(2026, 10, 5, 12, 0, 0))
  assert.equal(a.segs[0][2].t, undefined)
  assert.equal(b.segs[0].length, 2)
})

test('leer: lo que no es GPX o no tiene recorridos da un error claro', () => {
  assert.match(leerGpx('hola').error, /GPX/)
  assert.match(leerGpx(null).error, /GPX/)
  assert.match(leerGpx('<gpx><wpt lat="1" lon="1"/></gpx>').error, /recorridos/)
})

test('leer: una ruta <rte> se acepta si no hay <trk>', () => {
  const r = leerGpx(
    '<gpx><rte><name>R</name><rtept lat="-34.9" lon="-56.1"/><rtept lat="-34.91" lon="-56.1"/></rte></gpx>'
  )
  assert.equal(r.pistas[0].segs[0].length, 2)
  assert.equal(r.pistas[0].nombre, 'R')
})

test('tipo: se reconoce el de otras apps y el propio', () => {
  assert.equal(tipoDeGpx('Running'), 'carrera')
  assert.equal(tipoDeGpx('cycling'), 'bicicleta')
  assert.equal(tipoDeGpx('hiking'), 'caminata')
  assert.equal(tipoDeGpx('caminata'), 'caminata')
  assert.equal(tipoDeGpx('yoga'), null)
})

// ---------- GPX: importar ----------
// GPX "de otra app": todos los puntos crudos, con horario, sin la extensión de MMV.
const gpxCrudo = (segs, conTiempo = true) =>
  '<gpx version="1.1"><trk><name>Salida</name><trkseg>' +
  segs[0]
    .map(
      p =>
        `<trkpt lat="${p.lat.toFixed(5)}" lon="${p.lon.toFixed(5)}"><ele>${p.alt}</ele>` +
        (conTiempo ? `<time>${new Date(p.t).toISOString()}</time>` : '') +
        '</trkpt>'
    )
    .join('') +
  '</trkseg></trk></gpx>'

test('importar GPX ajeno con horarios: distancia, tiempo, ritmo y recorte', () => {
  const g = gpxCrudo(recorrido())
  const {filas} = filasDeGpx(g, {ocultarM: 150})
  const f = filas[0]
  assert.equal(f.origen, 'gpx')
  assert.ok(f.distM > 1500 && f.distM < 3000)
  assert.ok(f.seg > 600)
  assert.ok(f.ritmo > 0)
  assert.equal(f.recortada, true)
  assert.ok(f.parciales.length >= 1)
  assert.ok(!f.sinTiempo)
  const visible = distanciaRutaM(segsDeRuta(f))
  assert.ok(visible < f.distM - 200, 'el trazo guardado está recortado, la distancia no')
})

test('importar sin horarios: se guarda con sinTiempo, sin ritmo ni parciales, y con la fecha de hoy', () => {
  const sinT = recorrido().map(g => g.map(({t, ...p}) => p))
  const g = gpxCrudo(recorrido(), false)
  const ahora = Date.UTC(2026, 10, 6, 15, 0, 0)
  const {filas} = filasDeGpx(g, {ahora})
  assert.equal(filas[0].sinTiempo, true)
  assert.equal(filas[0].seg, 0)
  assert.equal(filas[0].ritmo, null)
  assert.deepEqual(filas[0].parciales, [])
  assert.equal(filas[0].fecha, fechaLocal(ahora))
  assert.ok(sinT[0].length > 0)
})

test('importar: menos de 100 m o con ocultarM=0 sin recorte', () => {
  const corto = {
    nombre: 'x',
    segs: [
      [
        {lat: -34.9, lon: -56.1},
        {lat: -34.90001, lon: -56.1}
      ]
    ]
  }
  assert.equal(rutaDesdeGpx(corto), null)
  const g = gpxCrudo(recorrido())
  const {filas} = filasDeGpx(g, {ocultarM: 0})
  assert.equal(filas[0].recortada, false)
  assert.match(
    filasDeGpx('<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>').error,
    /100 m/
  )
})

test('ida y vuelta propia: exportar e importar conserva las estadísticas y no recorta otra vez', () => {
  const orig = filaDe(recorrido())
  const {filas} = filasDeGpx(rutasAGpx([orig]))
  const f = filas[0]
  assert.equal(f.inicio, orig.inicio)
  assert.equal(f.fecha, orig.fecha)
  assert.equal(f.distM, orig.distM)
  assert.equal(f.seg, orig.seg)
  assert.equal(f.ritmo, orig.ritmo)
  assert.deepEqual(f.parciales, orig.parciales)
  assert.equal(f.sube, orig.sube)
  assert.equal(f.tipo, orig.tipo)
  const a = segsDeRuta(orig),
    b = segsDeRuta(f)
  assert.equal(b.flat().length, a.flat().length)
  assert.ok(Math.abs(b[0][0].lat - a[0][0].lat) < 1e-4)
  assert.equal(b[0][0].t, a[0][0].t)
})

test('repetidas: mismo archivo dos veces y repetidas dentro del mismo archivo', () => {
  const orig = filaDe(recorrido())
  const {filas} = filasDeGpx(rutasAGpx([orig, orig]))
  assert.equal(filas.length, 2)
  const r1 = sinRepetidas(filas, [])
  assert.equal(r1.nuevas.length, 1)
  assert.equal(r1.repetidas, 1)
  const r2 = sinRepetidas(filas, [{...orig, id: 9}])
  assert.equal(r2.nuevas.length, 0)
  // otra salida el mismo día no es repetida
  const otra = {...filas[0], inicio: filas[0].inicio + 3 * 3600e3}
  assert.equal(sinRepetidas([otra], filas).nuevas.length, 1)
})

test('base de datos: importar guarda, no duplica y exporta todo', async () => {
  await db.rutas.clear()
  const g = rutasAGpx([filaDe(recorrido())])
  const r1 = await importarGpx(g, 0)
  assert.deepEqual(r1, {agregadas: 1, repetidas: 0, invalidas: 0})
  const r2 = await importarGpx(g, 0)
  assert.deepEqual(r2, {agregadas: 0, repetidas: 1, invalidas: 0})
  assert.ok((await importarGpx('basura')).error)
  const todas = await todasLasRutas()
  assert.equal(todas.length, 1)
  assert.equal(todas[0].origen, 'gpx')
  assert.match(rutasAGpx(todas), /<trkpt/)
  await guardarRuta({...todas[0], id: undefined, inicio: todas[0].inicio + 7 * 3600e3})
  assert.equal((await todasLasRutas()).length, 2)
})

// ---------- Privacidad y estructura ----------
test('el mapa está apagado por defecto y no viaja en el backup', () => {
  const aj = leer('src/features/ajustes/Ajustes.jsx')
  assert.match(aj, /cfg\(CLAVE_MAPA\) === '1'/)
  assert.equal(CLAVE_MAPA, 'mapa_osm')
  const bk = leer('src/domain/backup.js')
  assert.ok(!bk.includes('mapa_osm'))
  assert.match(aj, /Al abrir el mapa[\s\S]*Con el mapa apagado no se contacta a nadie/)
})

test('el mapa solo se monta tras el permiso de Ajustes y un toque en «Ver sobre el mapa»', () => {
  const ru = leer('src/features/rutas/Rutas.jsx')
  assert.match(ru, /mapaPermitido\(\) \?/)
  assert.match(ru, /verMapa \?/)
  assert.match(ru, /Ver sobre el mapa/)
  assert.match(ru, /OpenStreetMap recibe la zona/)
  const usos = archivos('src').filter(
    f => leer(f).includes('MapaOsm') && !f.endsWith('MapaOsm.jsx')
  )
  assert.deepEqual(usos, ['src/features/rutas/Rutas.jsx'])
})

test('la dirección del servidor de teselas vive solo en domain/mapa.js; el mapa lleva atribución', () => {
  const con = archivos('src').filter(f => leer(f).includes('tile.openstreetmap.org'))
  assert.deepEqual(con, ['src/domain/mapa.js'])
  assert.match(leer('src/ui/MapaOsm.jsx'), /ATRIBUCION\.texto/)
  assert.match(leer('src/ui/MapaOsm.jsx'), /rel="noopener noreferrer"/)
})

test('ningún servicio toca mapa ni GPX; no hay fetch de teselas ni librería de mapas nueva', () => {
  for (const f of archivos('src/services'))
    assert.doesNotMatch(leer(f), /domain\/(mapa|gpx)|data\/rutas|MapaOsm|\.gpx/, f)
  const pkg = JSON.parse(leer('package.json'))
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    '@fontsource/bebas-neue',
    '@fontsource/chakra-petch',
    '@fontsource/inter',
    'dexie',
    'react',
    'react-dom'
  ])
  assert.doesNotMatch(leer('src/ui/MapaOsm.jsx'), /fetch\(/)
})

test('el service worker no guarda teselas (solo atiende su propio origen)', () => {
  assert.match(leer('public/sw.js'), /u\.origin!==self\.location\.origin/)
})

test('versión 0.28.0 / entrega 27 y CSS del mapa sin colores sueltos', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.28.0')
  assert.equal(pkg.entrega, '27')
  const css = leer('src/styles.css')
  const bloque = css.slice(css.indexOf('Entrega 27: mapa OSM'))
  assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  assert.ok(RUTA_CFG.ocultarM === 150)
})
