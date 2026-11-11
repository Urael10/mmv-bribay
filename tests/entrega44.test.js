// Entrega 43 (v0.44.0) · Hoy compacto con color por métrica, gasto calórico por actividades,
// Compartir del Coach con la hoja nativa y escáner que se pausa al salir de la app.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {
  metActividad, metEntreno, kcalActivas, kcalDeActividad, kcalDeSesion, kcalDeRuta, minutosSesion, pesoCercano,
  gastoDia, gastoSemana, MET_BASE, MET_ENTRENO_SIN_RPE, MIN_SESION_SIN_BLOQUES, PESO_MIN, PESO_MAX
} from '../src/domain/gasto.js'
import {informeSemana, textoGasto, textoInforme, cuerpoCoach} from '../src/domain/informe.js'
import {crearArchivos} from '../src/platform/archivos.js'
import {mensajePausa, crearDetector} from '../src/services/escaner.js'

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
const L = '2026-11-09' // lunes

// ---------- Gasto: MET ----------
test('MET de caminata, carrera y bicicleta según la velocidad', () => {
  assert.equal(metActividad({tipo: 'caminata', minutos: 60, km: 5}), 3.5) // 5 km/h
  assert.equal(metActividad({tipo: 'caminata', minutos: 60, km: 6.5}), 5.0)
  assert.equal(metActividad({tipo: 'carrera', minutos: 30, km: 5}), 9.8) // 10 km/h: tramo de 9,7 km/h en adelante
  assert.equal(metActividad({tipo: 'carrera', minutos: 60, km: 8}), 8.3)
  assert.equal(metActividad({tipo: 'bicicleta', minutos: 60, km: 20}), 8.0)
  assert.equal(metActividad({tipo: 'bicicleta', minutos: 60, km: 12}), 4.0)
})
test('sin distancia o con un tipo sin velocidad se usa el MET típico', () => {
  assert.equal(metActividad({tipo: 'caminata', minutos: 40}), MET_BASE.caminata)
  assert.equal(metActividad({tipo: 'natacion', minutos: 40, km: 1}), 6.0)
  assert.equal(metActividad({tipo: 'inventado', minutos: 40}), MET_BASE.otro)
})
test('entreno: MET por RPE y suposición sin RPE', () => {
  assert.equal(metEntreno(3), 4.0)
  assert.equal(metEntreno(9), 8.5)
  assert.equal(metEntreno(0), MET_ENTRENO_SIN_RPE)
  assert.equal(metEntreno(undefined), MET_ENTRENO_SIN_RPE)
})

// ---------- Gasto: kcal ----------
test('kcal = (MET − 1) × peso × horas, redondeado', () => {
  assert.equal(kcalActivas({met: 8, minutos: 60, peso: 70}), 490)
  assert.equal(kcalActivas({met: 3.5, minutos: 30, peso: 80}), 100)
  assert.equal(kcalActivas({met: 1, minutos: 60, peso: 70}), 0) // reposo: nada por encima
})
test('sin peso válido, sin duración o sin MET no se inventa un número', () => {
  assert.equal(kcalActivas({met: 8, minutos: 60, peso: null}), null)
  assert.equal(kcalActivas({met: 8, minutos: 60, peso: PESO_MIN - 1}), null)
  assert.equal(kcalActivas({met: 8, minutos: 60, peso: PESO_MAX + 1}), null)
  assert.equal(kcalActivas({met: 8, minutos: 0, peso: 70}), null)
  assert.equal(kcalActivas({met: 0, minutos: 30, peso: 70}), null)
})
test('actividad, ruta y sesión dan la misma cuenta por dentro', () => {
  assert.equal(kcalDeActividad({tipo: 'carrera', minutos: 60, km: 8}, 70), 511) // (8,3−1)×70
  assert.equal(kcalDeRuta({tipo: 'carrera', distM: 8000, seg: 3600}, 70), 511)
  assert.equal(kcalDeSesion({rpe: 9, bloques: [{minutos: 30}, {minutos: 30}]}, 80), 600) // 7,5×80×1
})
test('sesión sin bloques ni minutos supone 45 min (igual que la carga)', () => {
  assert.equal(minutosSesion({rpe: 6}), MIN_SESION_SIN_BLOQUES)
  assert.equal(minutosSesion({bloques: [{minutos: 10}, {minutos: '5'}, {}]}), 15)
})
test('el peso se toma de la medida más cercana en el tiempo', () => {
  const m = [{fecha: '2026-11-01', peso: 80}, {fecha: '2026-11-20', peso: 78}, {fecha: '2026-11-05', peso: 'x'}]
  assert.equal(pesoCercano(m, '2026-11-08'), 80)
  assert.equal(pesoCercano(m, '2026-11-15'), 78)
  assert.equal(pesoCercano([], '2026-11-08'), null)
  assert.equal(pesoCercano([{fecha: '2026-11-01', peso: 5}], '2026-11-08'), null)
})

// ---------- Gasto: día y semana ----------
const MED = [{fecha: '2026-11-01', peso: 70}]
test('gastoDia suma entreno, actividades y rutas sin contar dos veces la misma salida', () => {
  const g = gastoDia({
    fecha: L,
    medidas: MED,
    sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}, {fecha: '2026-11-08', rpe: 9, bloques: [{minutos: 60}]}],
    actividades: [{id: 1, fecha: L, tipo: 'carrera', minutos: 30, km: 5, rutaId: 7}],
    rutas: [
      {id: 7, fecha: L, tipo: 'carrera', distM: 5000, seg: 1800}, // ya está en la actividad
      {id: 8, fecha: L, tipo: 'caminata', distM: 3000, seg: 2400} // aparte
    ]
  })
  assert.equal(g.entreno.kcal, 420) // (7−1)×70×1
  assert.equal(g.actividad.kcal, kcalDeActividad({tipo: 'carrera', minutos: 30, km: 5}, 70))
  assert.equal(g.rutas.cantidad, 1)
  assert.equal(g.rutas.kcal, kcalDeRuta({tipo: 'caminata', distM: 3000, seg: 2400}, 70))
  assert.equal(g.kcal, g.entreno.kcal + g.actividad.kcal + g.rutas.kcal)
  assert.equal(g.sinPeso, false)
})
test('gastoDia sin peso registrado: sin kcal y lo dice', () => {
  const g = gastoDia({fecha: L, sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}]})
  assert.equal(g.sinPeso, true)
  assert.equal(g.kcal, 0)
})
test('gastoSemana: total, desglose y promedio por día con gasto', () => {
  const g = gastoSemana({
    desde: L,
    medidas: MED,
    sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}, {fecha: '2026-11-11', rpe: 7, bloques: [{minutos: 60}]}],
    actividades: [{id: 1, fecha: '2026-11-11', tipo: 'otro', minutos: 60}]
  })
  assert.equal(g.entreno, 840)
  assert.equal(g.actividad, 210) // (4−1)×70
  assert.equal(g.kcal, 1050)
  assert.equal(g.diasConGasto, 2)
  assert.equal(g.kcalPorDia, 525)
})

// ---------- Informe ----------
test('informeSemana trae el gasto y el texto lo cuenta sin inventar nada', () => {
  const con = informeSemana({desde: L, medidas: MED, sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}]})
  assert.equal(con.gasto.kcal, 420)
  assert.match(textoGasto(con.gasto), /Gasto en actividad.*≈ 420 kcal/)
  assert.match(textoInforme(con, null), /Gasto en actividad/)
  assert.equal(textoGasto(informeSemana({desde: L}).gasto), 'Gasto en actividad: sin datos')
  const sinPeso = informeSemana({desde: L, sesiones: [{fecha: L, rpe: 7}]})
  assert.match(textoGasto(sinPeso.gasto), /cargá tu peso/)
})
test('privacidad: el gasto estimado NO viaja a la IA', () => {
  const inf = informeSemana({desde: L, medidas: MED, sesiones: [{fecha: L, rpe: 7, bloques: [{minutos: 60}]}]})
  const cuerpo = cuerpoCoach(inf, null)
  assert.equal(/gasto|kcalPorDia/i.test(cuerpo.slice(cuerpo.indexOf('DATOS:'))), false)
})

// ---------- Compartir texto (APK) ----------
const crear = (compartirImpl, android = true) => {
  const llamadas = []
  const share = {share: async o => (llamadas.push(o), compartirImpl?.(o))}
  const a = crearArchivos({cargar: async () => ({fs: {}, share, Directory: {}, Encoding: {}}), android: () => android})
  return {a, llamadas}
}
test('compartirTexto manda el texto a la hoja nativa, sin archivo', async () => {
  const {a, llamadas} = crear()
  assert.equal(await a.compartirTexto('Informe', 'Informe semanal MMV'), 'compartido')
  assert.equal(llamadas[0].text, 'Informe')
  assert.equal(llamadas[0].files, undefined)
  assert.equal(llamadas[0].title, 'Informe semanal MMV')
})
test('compartirTexto: cancelar no es error; un fallo real sí; fuera del APK no hace nada', async () => {
  assert.equal(await crear(() => { throw new Error('Share canceled') }).a.compartirTexto('x'), 'cancelado')
  assert.equal(await crear(() => { throw new Error('boom') }).a.compartirTexto('x'), 'error')
  assert.equal(await crear(null, false).a.compartirTexto('x'), 'no-disponible')
  const rota = crearArchivos({cargar: async () => { throw new Error('sin plugin') }, android: () => true})
  assert.equal(await rota.compartirTexto('x'), 'error')
})
test('el botón Compartir del Coach aparece también en el APK y usa la hoja nativa', () => {
  const c = leer('src/features/coach/Coach.jsx')
  assert.match(c, /archivos\.disponible\(\) \|\| navigator\.share/)
  assert.match(c, /archivos\.compartirTexto\(/)
  assert.doesNotMatch(c, /@capacitor/)
})

// ---------- Escáner ----------
test('el escáner avisa y libera la cámara al salir de la app', () => {
  assert.match(mensajePausa('hidden'), /se pausó/)
  assert.equal(mensajePausa('visible'), null)
  const c = leer('src/features/comidas/Comidas.jsx')
  assert.match(c, /addEventListener\('visibilitychange'/)
  assert.match(c, /removeEventListener\('visibilitychange'/)
})
test('sin BarcodeDetector el mensaje menciona Google Play Services y el buscador', async () => {
  await assert.rejects(crearDetector({}), /Google Play Services[\s\S]*Tipeá el número/)
})

// ---------- Hoy: color por métrica ----------
const css = leer('src/tokens.css')
const hex = n => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
const lin = c => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = h => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
test('colores por métrica: definidos, con contraste ≥ 3:1 sobre el fondo y distintos de los estados', () => {
  for (const m of ['agua', 'sueno', 'pasos', 'peso']) {
    assert.ok(hex('m-' + m), `falta --m-${m}`)
    assert.ok(ratio('m-' + m, 'bg') >= 3, `--m-${m} contra --bg = ${ratio('m-' + m, 'bg').toFixed(2)}`)
    assert.ok(ratio('m-' + m, 'sf') >= 3, `--m-${m} contra --sf`)
    for (const estado of ['pos', 'neg', 'warn']) assert.notEqual(hex('m-' + m).toLowerCase(), hex(estado).toLowerCase())
  }
  assert.match(css, /--m-comida:\s*var\(--ac\)/)
})
test('cada fila de Hoy lleva la clase de su métrica y el CSS la usa sin colores sueltos', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  for (const m of ['m-agua', 'm-sueno', 'm-pasos', 'm-peso']) assert.ok(h.includes(m), m)
  assert.ok(leer('src/features/comidas/FilaAlimentacion.jsx').includes('m-comida'))
  const estilos = leer('src/styles.css'),
    b = estilos.slice(estilos.indexOf('Entrega 43:'))
  assert.ok(b.length > 300)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  for (const t of ['--m-agua', '--m-sueno', '--m-pasos', '--m-peso', '--m-comida']) assert.ok(b.includes(`var(${t})`), t)
  assert.match(leer('DESIGN-TOKENS.md'), /--m-agua/)
})

// ---------- Reglas fijas ----------
test('reglas fijas: Dexie v11, appId y androidScheme, solo platform importa Capacitor, domain puro', () => {
  const db = leer('src/data/db.js')
  assert.match(db, /version\(11\)/)
  assert.doesNotMatch(db, /version\(12\)/)
  const cfg = leer('capacitor.config.ts')
  assert.match(cfg, /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(cfg, /androidScheme: 'https'/)
  for (const f of archivosDe('src').filter(f => /\.(js|jsx)$/.test(f)))
    if (!f.startsWith('src/platform/')) assert.doesNotMatch(leer(f), /@capacitor\//, f)
  assert.doesNotMatch(leer('src/domain/gasto.js'), /from '\.\.?\/(?!stats|movimiento)|react|db\.|localStorage|document|window/)
  for (const f of archivosDe('src').filter(f => /\.(js|jsx)$/.test(f)))
    if (!/^src\/(data|features)\//.test(f) && f !== 'src/main.jsx') assert.doesNotMatch(leer(f), /from '(\.\.?\/)+data\/db/, f + ' toca la base')
})
test('la Entrega 43 (v0.44.0) sigue en el CHANGELOG; la versión vigente la fija entrega45.test.js', () => {
  assert.match(leer('CHANGELOG.md'), /## v0\.44\.0 · Entrega 43 ·/)
})
