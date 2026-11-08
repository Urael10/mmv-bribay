// Entrega 37 (v0.38.0) · íconos en lugar de emojis, avisos flotantes y reinicio de agua sin confirm().
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const archivos = d =>
  readdirSync(new URL('../' + d, import.meta.url)).flatMap(n => {
    const r = d + '/' + n
    return statSync(new URL('../' + r, import.meta.url)).isDirectory() ? archivos(r) : [r]
  })
const jsx = archivos('src').filter(f => f.endsWith('.jsx'))

test('no quedan emojis ni símbolos de estado en la interfaz (las flechas → y ≈ de texto sí)', () => {
  const prohibidos = ['✔', '✓', '✅', '⚠', '✕', '✎', '↶', '⬆', '＋', '↔', '⏸', '▶', '🏆', '🎥', '🌐', '⭐', '⚡', '🏁', '🔎', '🔒', '🍽', '🏷', '◀', '■', '⏱']
  for (const f of jsx) {
    const t = leer(f)
      .split('\n')
      .filter(l => !l.trim().startsWith('//'))
      .join('\n')
    for (const e of prohibidos) assert.ok(!t.includes(e), `${f} usa ${e}`)
  }
})

test('cada <Icono n="…"> usa un trazo que existe', () => {
  const ico = leer('src/ui/Icono.jsx')
  const claves = new Set([...ico.matchAll(/^ {2}(?:'([a-z-]+)'|([a-z]+)):/gm)].map(m => m[1] || m[2]))
  for (const f of jsx) {
    for (const m of leer(f).matchAll(/<Icono n="([a-z-]+)"/g)) assert.ok(claves.has(m[1]), `${f}: falta el ícono ${m[1]}`)
  }
  for (const n of ['candado', 'lupa', 'estrella', 'trofeo', 'video', 'web', 'rayo', 'bandera', 'deshacer', 'mas', 'plato', 'etiqueta', 'izq-der', 'chevron-izq', 'chevron-der', 'detener', 'reloj'])
    assert.ok(claves.has(n), n)
})

test('los botones que antes eran un símbolo suelto llevan nombre accesible', () => {
  assert.match(leer('src/features/entreno/Timer.jsx'), /aria-label=\{pos\.fin \? 'Terminado' : on \? 'Pausar' : 'Reanudar'\}/)
})

test('los avisos flotan: App los agrupa en .avisos y el CSS usa solo tokens', () => {
  assert.match(leer('src/App.jsx'), /<div className="avisos">/)
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 37:'))
  assert.match(b, /\.avisos \{[^}]*position: fixed/)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--pr\)/)
})

test('Hoy: reiniciar el agua no usa confirm() y se puede deshacer', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.doesNotMatch(h, /confirm\(/)
  assert.match(h, /Deshacer reinicio/)
  assert.match(h, /setReinicio\(\{agua: h\.agua, aguaLog: log\}\)/)
})

test('versión 0.38.0 / entrega 37 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 38, pkg.version)
  assert.ok(Number(pkg.entrega) >= 37)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(leer('CHANGELOG.md'), /## v0\.38\.0 · Entrega 37 · Íconos coherentes/)
})
