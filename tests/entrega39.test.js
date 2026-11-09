// Entrega 38 (v0.39.0) · arreglos de las capturas del celular.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {pedidoPreparacion, checkinHecho} from '../src/domain/checkin.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const archivos = d =>
  readdirSync(new URL('../' + d, import.meta.url)).flatMap(n => {
    const r = d + '/' + n
    return statSync(new URL('../' + r, import.meta.url)).isDirectory() ? archivos(r) : [r]
  })
const luminancia = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const token = n => leer('src/tokens.css').match(new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})'))[1]

test('Comidas: «Carbos» en el trío y la proteína no se repite cuando tiene meta', () => {
  const c = leer('src/features/comidas/Comidas.jsx')
  assert.match(c, /\['Carbos', 'Carb\.', 'c', '--m-c'\]/)
  assert.doesNotMatch(c, /'Carbohidratos', 'Carb\.'/)
  assert.match(c, /<Macros t=\{tot\} sinProteina \/>/)
  // el trío completo solo se muestra en la rama sin meta de proteína
  assert.equal((c.match(/<Macros t=\{tot\} \/>/g) || []).length, 1)
  assert.match(c, /\.filter\(m => m\[2\] !== 'p'\)/)
  assert.match(leer('src/styles.css'), /\.macros\.dos \{[^}]*repeat\(2,/)
})

test('Comidas: el buscador usa un placeholder corto y conserva su nombre accesible', () => {
  const c = leer('src/features/comidas/Comidas.jsx')
  assert.match(c, /aria-label="Buscar alimento"\s+placeholder="Buscar…"/)
})

test('ya no queda ningún carácter ✓ en JSX ni en CSS (el tilde es un ícono por máscara)', () => {
  const css = leer('src/styles.css').split('\n').filter(l => !l.trim().startsWith('/*') && !l.trim().startsWith('*')).join('\n')
  assert.ok(!css.includes('✓'), 'styles.css')
  for (const f of archivos('src').filter(f => f.endsWith('.jsx'))) assert.ok(!leer(f).split('\n').filter(l => !l.trim().startsWith('//')).join('\n').includes('✓'), f)
  assert.match(leer('src/tokens.css'), /--ico-check:\s*url\("data:image\/svg\+xml/)
  const chip = leer('src/styles.css').match(/\.chip\.on::before,[^{]*\{[^}]*\}/)[0]
  assert.match(chip, /mask: var\(--ico-check\)/)
  assert.match(chip, /background: currentColor/)
})

test('Check-in: el sueño tiene rótulos «Horas» y «Calidad» y conserva sus nombres accesibles (desde la entrega 39, en RegistroSueno)', () => {
  const h = leer('src/features/sueno/RegistroSueno.jsx')
  assert.match(h, /<b className="ck-n" id="ck-calidad">\s*Calidad\s*<\/b>/)
  assert.match(h, /aria-label="Horas de sueño de hoy \(total del día\)"/)
  assert.match(leer('src/features/hoy/Hoy.jsx'), /<RegistroSueno h=\{h\} g=\{g\}/)
})

test('Hoy: resúmenes cortos de los plegables y sin corte con «…»', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /resumen="Pasos y rutas"/)
  assert.doesNotMatch(h, /Pasos, rutas, medidas|Calcula tus horas/)
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 38:'))
  assert.match(b, /\.pleg-r \{[^}]*white-space: normal/)
})

test('anillos: pista visible (≥ 3:1 sobre el fondo) e ícono en comida, agua y pasos', () => {
  assert.ok(contraste(token('pista'), token('bg')) >= 3, 'contraste de --pista')
  assert.match(leer('src/styles.css'), /\.anillo-pista \{\s*stroke: var\(--pista\)/)
  assert.match(leer('src/features/hoy/Hoy.jsx'), /<Icono n="gota"/)
  assert.match(leer('src/features/hoy/Hoy.jsx'), /<Icono n="pasos"/)
  assert.match(leer('src/features/comidas/FilaAlimentacion.jsx'), /<Icono n="cubiertos"/)
  const ico = leer('src/ui/Icono.jsx')
  for (const n of ['gota', 'cubiertos', 'pasos']) assert.match(ico, new RegExp(`^  ${n}:`, 'm'))
  // las pantallas casi negras no se encandilan
  assert.match(leer('src/styles.css'), /\.sueno-ov \.anillo-pista,\s*\.bolsillo-ov \.anillo-pista \{\s*stroke: var\(--sf-2\)/)
})

test('pedidoPreparacion: pide el check-in, o el sueño si el check-in ya está hecho', () => {
  assert.match(pedidoPreparacion(undefined).titulo, /^Hacé el check-in para ver tu preparación$/)
  assert.equal(pedidoPreparacion({energia: 3}).boton, 'Hacer el check-in')
  const hecho = {energia: 3, animo: 4, dolor: 1}
  assert.ok(checkinHecho(hecho))
  assert.match(pedidoPreparacion(hecho).titulo, /horas de sueño/)
  assert.equal(pedidoPreparacion(hecho).boton, 'Cargar el sueño')
  assert.equal(pedidoPreparacion({...hecho, sueno: '7'}).boton, 'Abrir el check-in')
  assert.equal(pedidoPreparacion({...hecho, sueno: ''}).boton, 'Cargar el sueño')
})

test('Preparación sin datos: botón que abre el check-in desde Hoy, sin Plegable ni «i»', () => {
  const p = leer('src/features/coach/Preparacion.jsx'),
    h = leer('src/features/hoy/Hoy.jsx')
  assert.doesNotMatch(p, /Plegable/)
  assert.match(p, /pedidoPreparacion\(h\)/)
  assert.match(p, /onClick=\{onCheckin\}/)
  assert.match(h, /<Preparacion\s+h=\{h\}\s+onCheckin=/)
  assert.match(h, /abrirCk\('hoy-checkin'\)/)
  assert.match(h, /setCkAb\(true\)/)
  assert.match(h, /getElementById\(pedir\.id\)/)
  assert.match(h, /prefers-reduced-motion/)
})

test('Entrega 38: CSS solo con tokens (sin hex ni rgb en el bloque nuevo)', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 38:'))
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--pr\)/)
})

test('versión 0.39.0 / entrega 38 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 39, pkg.version)
  assert.ok(Number(pkg.entrega) >= 38)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(leer('CHANGELOG.md'), /## v0\.39\.0 · Entrega 38 · Arreglos de las capturas del celular/)
  assert.match(leer('README.md'), /Entrega \d+ \(v0\.\d+\.\d+\)/)
})
