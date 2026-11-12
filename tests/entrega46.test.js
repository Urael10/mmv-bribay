// Entrega 45 (v0.46.0) · Motor de señales local y Nota del día en Hoy (franja que se abre al tocarla, propuesta B).
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {
  senalSueno,
  senalAgua,
  senalComida,
  senalActividad,
  senalGasto,
  senalCarga,
  notaDelDia,
  aguaEsperada,
  MAX_SENALES,
  AVISO_NOTA
} from '../src/domain/senales.js'

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
const {db} = await import('../src/data/db.js')
const {leerSenales, metasNota} = await import('../src/data/senales.js')

const raiz = new URL('../', import.meta.url).pathname
const leer = f => readFileSync(join(raiz, f), 'utf8')
const archivos = d =>
  readdirSync(join(raiz, d)).flatMap(n => {
    const r = join(d, n)
    return statSync(join(raiz, r)).isDirectory() ? archivos(r) : [r]
  })

const F = '2026-11-10'
const dia = (n, extra = {}) => {
  const d = new Date(Date.UTC(2026, 10, 10 - n))
  return {fecha: d.toISOString().slice(0, 10), ...extra}
}

// ---------- Sueño ----------
test('sueño: una noche corta, una racha de noches cortas y «dormiste bien»', () => {
  assert.equal(senalSueno({habitos: [dia(0, {sueno: '5'})], fecha: F}).id, 'sueno-corto')
  const racha = senalSueno({habitos: [dia(0, {sueno: '5'}), dia(1, {sueno: '4,5'})], fecha: F})
  assert.equal(racha.id, 'sueno-racha')
  assert.match(racha.corto, /Van 2 de las últimas 3/)
  const hab = [1, 2, 3, 4, 5, 6].map(n => dia(n, {sueno: '7'}))
  const bien = senalSueno({habitos: [...hab, dia(0, {sueno: '8'})], fecha: F})
  assert.equal(bien.id, 'sueno-bien')
  assert.match(bien.texto, /promedio de 7 h/)
  assert.equal(senalSueno({habitos: [dia(0, {sueno: '6,5'})], fecha: F}), null)
  assert.equal(senalSueno({habitos: [dia(0, {})], fecha: F}), null)
})

// ---------- Agua ----------
test('agua: lo esperado sube con la hora; no se avisa por la mañana; meta cumplida', () => {
  assert.equal(aguaEsperada(8), 0)
  assert.equal(aguaEsperada(14), 0.5)
  assert.equal(aguaEsperada(23), 1)
  const poca = senalAgua({habitos: [dia(0, {agua: 500})], fecha: F, hora: 16, metaAgua: 2500})
  assert.equal(poca.id, 'agua-poca')
  assert.match(poca.corto, /500 de 2\.?500 ml/)
  assert.equal(senalAgua({habitos: [dia(0, {agua: 0})], fecha: F, hora: 11, metaAgua: 2500}), null)
  assert.equal(senalAgua({habitos: [dia(0, {agua: 1400})], fecha: F, hora: 14, metaAgua: 2500}), null)
  assert.equal(senalAgua({habitos: [dia(0, {agua: 2500})], fecha: F, hora: 10, metaAgua: 2500}).id, 'agua-meta')
  assert.equal(senalAgua({habitos: [], fecha: F, hora: 20, metaAgua: 0}), null)
})

// ---------- Comida ----------
const comida = (kcal, p) => ({fecha: F, items: [{kcal, p}]})
test('comida: sin registros a la tarde, falta de proteína, kcal pasadas y en meta', () => {
  assert.equal(senalComida({fecha: F, hora: 16, metaKcal: 2200}).id, 'comida-vacia')
  assert.equal(senalComida({fecha: F, hora: 10, metaKcal: 2200}), null)
  const medidas = [{fecha: '2026-11-01', peso: 80}] // meta de proteína: 80 × 1,6 = 128 → 130 g
  const prot = senalComida({comidas: [comida(1500, 40)], medidas, fecha: F, hora: 18, metaKcal: 2200})
  assert.equal(prot.id, 'comida-proteina')
  assert.match(prot.corto, /Te faltan unos 90 g de proteína/)
  assert.equal(senalComida({comidas: [comida(1500, 40)], medidas, fecha: F, hora: 12, metaKcal: 2200}), null)
  assert.equal(senalComida({comidas: [comida(2800, 130)], medidas, fecha: F, hora: 20, metaKcal: 2200}).id, 'comida-pasada')
  assert.equal(senalComida({comidas: [comida(2200, 130)], medidas, fecha: F, hora: 19, metaKcal: 2200}).id, 'comida-en-meta')
  // sin peso no hay meta de proteína, y no se inventa
  assert.equal(senalComida({comidas: [comida(1500, 10)], fecha: F, hora: 19, metaKcal: 2200}), null)
})

// ---------- Actividad ----------
test('actividad: pasos contra tu meta; sin pasos cargados no se dice nada', () => {
  const p = (pasos, extra = {}) => senalActividad({habitos: [dia(0, {pasos})], fecha: F, metaPasos: '8000', ...extra})
  assert.equal(p(9000).id, 'pasos-meta')
  assert.equal(p(2000, {hora: 19}).id, 'pasos-pocos')
  assert.equal(p(2000, {hora: 12}), null)
  assert.equal(p(0, {hora: 20}), null)
  assert.equal(senalActividad({habitos: [dia(0, {pasos: 3000})], fecha: F, hora: 20, metaPasos: ''}), null) // sin meta ni promedio
})

// ---------- Gasto ----------
test('gasto: kcal por encima del reposo, o pedir el peso si falta', () => {
  const ses = [{fecha: F, rpe: 7, bloques: [{minutos: 60}]}]
  const g = senalGasto({sesiones: ses, medidas: [{fecha: '2026-11-01', peso: 80}], fecha: F})
  assert.equal(g.id, 'gasto-hoy')
  assert.match(g.corto, /480/)
  assert.match(g.texto, /estimación/)
  assert.equal(senalGasto({sesiones: ses, fecha: F}).id, 'gasto-sin-peso')
  assert.equal(senalGasto({fecha: F}), null)
})

// ---------- Carga ----------
test('carga: se compara con tu propio promedio y hace falta historia', () => {
  const s = f => ({fecha: f, rpe: 6, bloques: []}) // 6 × 45 = 270
  const base = ['2026-10-14', '2026-10-21', '2026-10-28'].map(s)
  const alta = senalCarga({sesiones: [...base, ...['2026-11-05', '2026-11-07', '2026-11-09'].map(s)], fecha: F})
  assert.equal(alta.id, 'carga-alta')
  assert.match(alta.corto, /×2/)
  const estable = senalCarga({sesiones: [...base, s('2026-11-04')], fecha: F})
  assert.equal(estable, null)
  assert.equal(senalCarga({sesiones: [s('2026-11-08')], fecha: F}), null) // menos de 2 semanas de historia
})

// ---------- Nota del día ----------
test('la nota ordena por importancia, lista como mucho 3 y la franja muestra la primera', () => {
  const s = f => ({fecha: f, rpe: 6, bloques: []})
  const nota = notaDelDia({
    fecha: F,
    hora: 17,
    metaAgua: 2500,
    metaKcal: 2200,
    habitos: [dia(0, {sueno: '5', agua: 300}), dia(1, {sueno: '5'})],
    sesiones: ['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-05', '2026-11-07', '2026-11-09'].map(s)
  })
  assert.equal(MAX_SENALES, 3)
  assert.deepEqual(
    nota.lista.map(x => x.id),
    ['sueno-racha', 'carga-alta', 'agua-poca']
  )
  assert.equal(nota.principal.id, 'sueno-racha')
})
test('sin datos no hay nota; con datos pero sin nada que decir, «Sin novedades»', () => {
  assert.equal(notaDelDia({fecha: F, hora: 10, habitos: []}).principal, null)
  const t = notaDelDia({fecha: F, hora: 9, metaAgua: 2500, habitos: [dia(0, {agua: 250})]})
  assert.equal(t.principal.id, 'tranquilo')
  assert.equal(t.lista.length, 1)
})
test('el tono es amable: sin signos de exclamación ni órdenes secas, y el aviso aclara que no es médico', () => {
  const textos = [
    senalSueno({habitos: [dia(0, {sueno: '5'}), dia(1, {sueno: '5'})], fecha: F}),
    senalAgua({habitos: [dia(0, {agua: 100})], fecha: F, hora: 18, metaAgua: 2500}),
    senalComida({fecha: F, hora: 20, metaKcal: 2200}),
    senalComida({comidas: [comida(3000, 100)], fecha: F, hora: 20, metaKcal: 2200})
  ].flatMap(x => [x.corto, x.texto])
  for (const t of textos) assert.doesNotMatch(t, /[¡!]|\bdebés\b|\bdeberías\b|\bmal\b|culpa/i, t)
  assert.match(AVISO_NOTA, /no es un consejo médico/i)
})

// ---------- Datos ----------
test('leerSenales trae lo necesario sin trazos ni notas, y metasNota usa las metas de Hoy', async () => {
  await db.open()
  await db.habitos.put({fecha: F, agua: 500, sueno: '7'})
  await db.comidas.add({fecha: F, momento: 'Almuerzo', nombre: 'secreto', items: [{nombre: 'Pollo', kcal: 300, p: 40, c: 0, gr: 5}]})
  await db.comidas.add({fecha: '2026-11-09', items: [{kcal: 999}]})
  await db.sesiones.add({fecha: F, rpe: 7, bloques: [{minutos: 30, ejercicios: ['Sentadilla*']}]})
  await db.medidas.put({fecha: F, peso: 80, nota: 'privada'})
  await db.actividades.add({fecha: F, tipo: 'caminata', minutos: 30, nota: 'nota privada'})
  await db.rutas.add({fecha: F, tipo: 'caminata', seg: 600, m: 1000, puntos: [[1, 2, 3]], trazo: 'xxxx'})
  const d = await leerSenales(F)
  assert.equal(d.comidas.length, 1) // solo las de hoy
  assert.deepEqual(Object.keys(d.comidas[0].items[0]).sort(), ['c', 'gr', 'kcal', 'p'])
  assert.deepEqual(d.sesiones[0].bloques, [{minutos: 30}])
  assert.deepEqual(d.medidas, [{fecha: F, peso: 80}])
  const json = JSON.stringify(d)
  for (const x of ['secreto', 'privada', 'Sentadilla', 'xxxx']) assert.ok(!json.includes(x), x)
  const nota = notaDelDia({...d, ...metasNota(), fecha: F, hora: 13})
  assert.ok(nota.principal)
  localStorage.setItem('mv_metakcal', '1800')
  assert.equal(metasNota().metaKcal, 1800)
  assert.equal(metasNota().metaAgua, 2500)
})

// ---------- Arquitectura y privacidad ----------
test('la nota es 100 % local: ni el motor, ni la lectura, ni la franja tocan la IA, la red o Capacitor', () => {
  for (const f of ['src/domain/senales.js', 'src/data/senales.js', 'src/features/hoy/NotaDelDia.jsx']) {
    const c = leer(f)
    assert.doesNotMatch(c, /from '[^']*(services\/|@capacitor\/)|fetch\(/, f)
  }
  // nada de la IA ni del coach importa el motor de señales: el gasto estimado sigue sin viajar
  for (const f of archivos('src').filter(f => /(services|features\/coach)\//.test(f)))
    assert.doesNotMatch(leer(f), /senales/, f)
  assert.doesNotMatch(leer('src/data/senales.js'), /\bleerGasto\b/)
})
test('la base solo se toca desde src/data y src/features; el dominio no sabe de UI', () => {
  assert.doesNotMatch(leer('src/domain/senales.js'), /from '(dexie|react)|document\.|window\.|localStorage/)
  assert.match(leer('src/features/hoy/NotaDelDia.jsx'), /from '\.\.\/\.\.\/data\/senales'/)
})

// ---------- Hoy y estilos ----------
test('Hoy monta la nota entre el aviso y la rejilla, y la rejilla C sigue', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /import NotaDelDia from '\.\/NotaDelDia'/)
  assert.ok(h.indexOf('<AvisoDescarga />') < h.indexOf('<NotaDelDia />'))
  assert.ok(h.indexOf('<NotaDelDia />') < h.indexOf('<div className="teselas">'))
  assert.doesNotMatch(leer('src/styles.css'), /propuesta A: lista/)
})
test('la franja es accesible: botón con aria-expanded y detalle oculto hasta abrirlo', () => {
  const c = leer('src/features/hoy/NotaDelDia.jsx')
  assert.match(c, /aria-expanded=\{ab\}/)
  assert.match(c, /aria-controls="hoy-nota-d"/)
  assert.match(c, /id="hoy-nota-d"[^>]*hidden=\{!ab\}/)
})
test('estilos de la nota: solo tokens; ni colores de métrica ni de estado; el cian solo en el chevron (declarado aparte)', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 45: Nota del día'))
  assert.ok(b.length > 300)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  assert.doesNotMatch(b, /var\(--(m-|pos|neg|warn|info|pr\b)/)
  assert.doesNotMatch(b, /var\(--ac\)/) // lo tocable (el chevron) se declara con el de los plegables, antes de los bloques de las entregas 32 a 36
  assert.match(css, /\.pleg-b \.vacio-ch,\n\.nota-b \.vacio-ch \{[^}]*var\(--ac\)/)
  for (const t of ['--sf', '--sf-2', '--sombra-1', '--r-tile', '--tx', '--tx-2', '--sp-3']) assert.ok(b.includes(`var(${t})`), t)
  assert.match(b, /\.nota \{[^}]*grid-column: span 2/)
})

// ---------- Versión y reglas fijas ----------
test('documentación y reglas fijas', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.match(leer('CHANGELOG.md'), /## v0\.46\.0 · Entrega 45 ·/)
  const c = leer('CHANGELOG.md')
  assert.ok(c.indexOf('v0.46.0') < c.indexOf('v0.45.0'))
  assert.match(leer('README.md'), /senales \(señales y Nota del día/)
  assert.match(leer('DESIGN-TOKENS.md'), /## Nota del día \(v0\.46\.0\)/)
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    '@capacitor/android', '@capacitor/app', '@capacitor/core', '@capacitor/filesystem', '@capacitor/haptics', '@capacitor/local-notifications',
    '@capacitor/share', '@fontsource/bebas-neue', '@fontsource/chakra-petch', '@fontsource/inter', 'barcode-detector', 'dexie', 'react', 'react-dom'
  ]) // Entrega 46: suma barcode-detector (escáner del WebView); Entrega 49: suma @capacitor/haptics
  assert.ok(!/publicar/.test(leer('.github/workflows/android-debug.yml')))
  assert.match(leer('android/app/build.gradle'), /package\.json/)
})
