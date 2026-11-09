// Entrega 24 · Propuesta 3 (parte 2): pestañas de Progreso en una fila deslizable.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const prog = readFileSync(new URL('../src/features/progreso/Progreso.jsx', import.meta.url), 'utf8')
const tabs = readFileSync(new URL('../src/ui/TabsDeslizables.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

const claves = [...prog.matchAll(/^\s*\['(\w+)', '([^']+)'\]/gm)].map(m => m[1])

test('Progreso tiene 8 pestañas (D5: «Rutas» después de Historial), mismo orden y nombres', () => {
  const bloque = prog.slice(prog.indexOf('export const PESTANAS'), prog.indexOf('export default function Progreso'))
  const pares = [...bloque.matchAll(/\['(\w+)', '([^']+)'\]/g)].map(m => m.slice(1))
  assert.deepEqual(pares, [
    ['pilares', 'Pilares'],
    ['semana', 'Semana'],
    ['historial', 'Historial'],
    ['rutas', 'Rutas'],
    ['records', 'Récords'],
    ['tests', 'Tests'],
    ['cuerpo', 'Cuerpo'],
    ['informe', 'Informe']
  ])
  assert.ok(claves.length >= 8)
})
test('cada pestaña de Progreso tiene su vista', () => {
  for (const k of ['pilares', 'semana', 'historial', 'rutas', 'records', 'tests', 'cuerpo', 'informe'])
    assert.ok(prog.includes(`sub === '${k}'`), 'falta la vista de ' + k)
})
test('Progreso usa las tabs deslizables y no la fila de chips que se partía en dos', () => {
  assert.ok(prog.includes('<TabsDeslizables'))
  assert.ok(!prog.includes('<div className="row" style={{marginBottom: 12}}>\n        {['))
})
test('tabs: roles de accesibilidad, pestaña activa centrada y flechas de teclado', () => {
  assert.ok(tabs.includes('role="tablist"') && tabs.includes('role="tab"'))
  assert.ok(tabs.includes('aria-selected'))
  assert.ok(tabs.includes('scrollTo') && tabs.includes('ArrowRight') && tabs.includes('ArrowLeft'))
  assert.ok(tabs.includes('prefers-reduced-motion'))
})
test('tabs: CSS en una fila, sin barra visible, degradé con tokens y sin hex sueltos', () => {
  const i = css.indexOf('Progreso: pestañas en una fila')
  assert.ok(i > 0)
  const b = css.slice(i)
  assert.ok(b.includes('flex-wrap: nowrap') && b.includes('overflow-x: auto'))
  assert.ok(b.includes('scrollbar-width: none'))
  assert.ok(b.includes('min-height: 44px'))
  assert.ok(b.includes('var(--bg)'))
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(b))
})
