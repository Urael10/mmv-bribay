// Entrega 34 · Modo bolsillo.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const a = leer('src/features/actividad/ActividadFisica.jsx')
test('modo bolsillo: diálogo, salida con mantener presionado y alternativa de teclado', () => {
  assert.match(a, /function Bolsillo/)
  assert.match(a, /role="dialog" aria-modal="true" aria-label="Modo bolsillo"/)
  assert.match(a, /setTimeout\(onSalir, 1000\)/)
  assert.match(a, /e\.key === 'Enter' \|\| e\.key === ' '/)
  assert.match(a, /activo && bolsillo/)
})
test('el bloque CSS del bolsillo usa solo tokens', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 34:'))
  assert.ok(b.length > 300)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--ac\)|var\(--pr\)/)
})
test('versión 0.35.0 / entrega 34', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.35.0')
  assert.equal(pkg.entrega, '34')
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\n\n## v0\.35\.0 · Entrega 34/)
})
