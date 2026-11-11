// Entrega 44 (v0.45.0) · Hoy en rejilla de dos columnas (propuesta C) con el color por métrica de la v0.44.0.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const css = leer('src/styles.css')
const bloque = css.slice(css.indexOf('Entrega 44: Hoy en rejilla'))

test('el bloque de la rejilla existe y usa solo tokens (sin colores sueltos)', () => {
  assert.ok(bloque.length > 400)
  assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  for (const t of ['--sf', '--sombra-1', '--r-tile', '--sp-3', '--sf-2']) assert.ok(bloque.includes(`var(${t})`), t)
})
test('las teselas de Hoy van en dos columnas y Peso ocupa todo el ancho', () => {
  assert.match(bloque, /\.plano \.teselas \{[^}]*display: grid;[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(bloque, /\.tesela\.m-peso \{[^}]*grid-column: span 2/)
})
test('cada mosaico es una caja con columna de contenido; la lista de la propuesta A ya no está', () => {
  assert.match(bloque, /\.plano \.teselas \.tesela \{[^}]*flex-direction: column[^}]*background: var\(--sf\)/)
  assert.ok(!css.includes('propuesta A: lista'))
  assert.doesNotMatch(css.slice(css.indexOf('Entrega 43: color por métrica')), /\.plano \.tesela \{[^}]*grid-template-columns: 40px/)
})
test('el color por métrica de la v0.44.0 se mantiene', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  for (const m of ['m-agua', 'm-sueno', 'm-pasos', 'm-peso']) assert.ok(h.includes(m), m)
  assert.ok(leer('src/features/comidas/FilaAlimentacion.jsx').includes('m-comida'))
  assert.match(css, /\.plano \.tesela \.anillo:not\(\.ok\):not\(\.bajo\) \.anillo-arco/)
  assert.match(leer('src/tokens.css'), /--m-peso:\s*#f0abfc/)
})
test('el hover no deja el mosaico transparente (la regla de la lista plana ya no gana)', () => {
  assert.match(bloque, /\.plano \.teselas \.tesela:hover:not\(:disabled\) \{[^}]*var\(--sf-2\)/)
})
test('documentación y reglas fijas', () => {
  // Entrega 45: ya no se fija la versión actual acá (la fija entrega46.test.js); solo que la historia no se pierda.
  assert.match(leer('CHANGELOG.md'), /## v0\.45\.0 · Entrega 44 ·/)
  assert.ok(leer('CHANGELOG.md').indexOf('v0.45.0') < leer('CHANGELOG.md').indexOf('v0.44.0'))
  assert.match(leer('README.md'), /^# Mi Mejor Versión \(MMV\) · Entrega \d+ \(v0\.\d+\.\d+\)/)
  assert.match(leer('DESIGN-TOKENS.md'), /## Hoy en rejilla \(v0\.45\.0\)/)
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /appId: 'online\.bribayfitness\.mmv'/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
})
