// Entrega 32 · Anillos de progreso en Hoy: lógica pura (domain/anillo.js) y reglas de uso.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fraccion, arco, claseAnillo, textoAnillo} from '../src/domain/anillo.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

test('fracción: entre 0 y 1, sin pasarse ni dar NaN', () => {
  assert.equal(fraccion(1250, 2500), 0.5)
  assert.equal(fraccion(3000, 2500), 1)
  assert.equal(fraccion(0, 2500), 0)
  assert.equal(fraccion(-5, 2500), 0)
  assert.equal(fraccion(100, 0), 0)
  assert.equal(fraccion('x', 2500), 0)
  assert.equal(fraccion(undefined, undefined), 0)
  assert.equal(fraccion('1250', '2500'), 0.5)
})
test('arco: largo sobre 100, redondeado a décimas', () => {
  assert.equal(arco(1, 3), 33.3)
  assert.equal(arco(5000, 2500), 100)
  assert.equal(arco(0, 10), 0)
})
test('clase: verde al llegar a la meta, rojo si se pide, si no neutro', () => {
  assert.equal(claseAnillo(2500, 2500), 'ok')
  assert.equal(claseAnillo(2499, 2500), '')
  assert.equal(claseAnillo(20, 100, {bajo: true}), 'bajo')
})
test('texto accesible', () => {
  assert.equal(textoAnillo('Agua', 1250, 2500, 'ml'), 'Agua: 1250 de 2500 ml (50 %)')
  assert.equal(textoAnillo('Algo', 0, 0), 'Algo: 0 de 0 (0 %)')
})
test('Anillo es decorativo y se dibuja con SVG, sin librerías', () => {
  const a = leer('src/ui/Anillo.jsx')
  assert.match(a, /aria-hidden="true"/)
  assert.match(a, /pathLength="100"/)
  assert.doesNotMatch(a, /^import .* from '(?!\.\.\/domain\/anillo)/m)
})
test('Hoy, Preparación y Comida usan el anillo; Peso no', () => {
  assert.match(leer('src/features/coach/Preparacion.jsx'), /<Anillo[\s\S]*meta=\{100\}/)
  assert.match(leer('src/features/comidas/FilaAlimentacion.jsx'), /<Anillo valor=\{t\.kcal\}/)
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /<Anillo valor=\{h\.agua\}/)
  const peso = h.slice(h.indexOf('function TeselaPeso'), h.indexOf('export default function Hoy'))
  assert.doesNotMatch(peso, /Anillo/)
})
test('los colores del anillo salen de tokens y el bloque no mete colores sueltos', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 32:'))
  assert.ok(b.length > 500)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  for (const t of ['--info', '--pos', '--neg', '--sf-2']) assert.ok(b.includes(`var(${t})`), t)
  assert.doesNotMatch(b, /var\(--ac\)|var\(--pr\)/) // cian = tocable, lima = un solo destacado
})
test('la preparación ya no tiene la barra horizontal ni el número gigante', () => {
  assert.doesNotMatch(leer('src/features/coach/Preparacion.jsx'), /className="bar"/)
})
test('carga diferida intacta: Hoy no importa Comidas, Coach ni Pilares', () => {
  assert.doesNotMatch(
    leer('src/features/hoy/Hoy.jsx'),
    /from '\.\.\/(comidas\/Comidas|coach\/Coach|progreso\/Pilares)'/
  )
})
test('versión 0.33.0 / entrega 32', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.33.0')
  assert.equal(pkg.entrega, '32')
  assert.match(leer('package-lock.json'), /"version": "0\.33\.0"/)
  assert.match(
    leer('CHANGELOG.md'),
    /^# Historial de versiones de MMV\n\n## v0\.33\.0 · Entrega 32/
  )
})
