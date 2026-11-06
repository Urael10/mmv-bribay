// Entrega 31 · Lenguaje B (lista limpia) en Hoy, Entreno y Progreso/Informe.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const css = leer('src/styles.css'),
  app = leer('src/App.jsx'),
  hoy = leer('src/features/hoy/Hoy.jsx')
const bloque = css.slice(css.indexOf('Entrega 31:'))

test('el bloque de la entrega 31 es el último de styles.css y usa solo tokens', () => {
  assert.ok(bloque.length > 800)
  assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  for (const m of bloque.matchAll(/border-radius:\s*([^;]+);/g)) assert.match(m[1], /^(0|var\(--r-[a-z]+\))$/, m[0])
  for (const m of bloque.matchAll(/box-shadow:\s*([^;]+);/g)) assert.match(m[1], /^(none|var\(--sombra-1\))$/, m[0])
  for (const m of bloque.matchAll(/\b(?:padding|gap|margin)[a-z-]*:\s*([^;]+);/g))
    for (const v of m[1].split(/\s+/)) assert.ok(/^(var\(--sp-\d\)|0|auto)$/.test(v), m[0])
})
test('el lenguaje plano solo se activa en Hoy, Entreno y Progreso (Comidas y Ajustes siguen con tarjetas)', () => {
  assert.match(app, /<main className=\{tab === 'hoy' \|\| tab === 'entreno' \|\| tab === 'progreso' \? 'plano' : undefined\}>/)
  assert.doesNotMatch(bloque, /(^|\n)section\s*\{/) // nada global: todo cuelga de .plano
  const base = css.slice(css.indexOf('\nsection {'), css.indexOf('}', css.indexOf('\nsection {')))
  assert.match(base, /box-shadow:\s*var\(--sombra-1\)/) // la base con tarjeta no cambia
})
test('las cajas de aviso (.warn) y los bordes de los controles no se tocan', () => {
  assert.match(bloque, /\.plano section:not\(\.warn\)/)
  assert.doesNotMatch(bloque, /\bbutton\b\s*\{|border-color|\.chip|--bd/)
})
test('Hoy en pantalla ancha: dos columnas desde 840 px, igual que --ancho-app', () => {
  assert.match(bloque, /@media \(min-width: 840px\)[\s\S]*\.hoy > \.teselas[\s\S]*grid-column: 2/)
  assert.match(leer('src/tokens.css'), /@media \(min-width: 840px\)[\s\S]*--ancho-app: 760px/)
})
test('Hoy: el marcado y el orden no cambian (solo cambia el estilo)', () => {
  const orden = ['<Preparacion', 'EMPEZAR ENTRENO', '<AvisoDescarga', 'className="teselas"', 'id="hoy-checkin"', 'id="hoy-mas"']
  const pos = orden.map(t => hoy.indexOf(t))
  assert.ok(pos.every(p => p > 0))
  assert.deepEqual([...pos].sort((a, b) => a - b), pos)
  assert.match(hoy, /hidden=\{!abierto\}/) // lo plegado sigue montado
})
test('versión: la 0.32.0 / entrega 31 o una posterior (la exacta la fija la prueba de la última entrega)', () => {
  const pkg = JSON.parse(leer('package.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 32, pkg.version)
  assert.ok(+pkg.entrega >= 31, pkg.entrega)
  assert.match(leer('CHANGELOG.md'), /## v0\.32\.0 · Entrega 31/)
})
