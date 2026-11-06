// Entrega 30 · Interfaz simplificada (Hoy, propuesta A) y tarjetas sin borde.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const tokens = leer('src/tokens.css'),
  css = leer('src/styles.css'),
  hoy = leer('src/features/hoy/Hoy.jsx')
const bloque = css.slice(css.indexOf('Entrega 30: Hoy simplificado'))

test('tokens de forma, espacio y elevación en tokens.css', () => {
  for (const t of ['--r-card', '--r-tile', '--r-ctl', '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sombra-1', '--ancho-app'])
    assert.match(tokens, new RegExp(`${t}:`), t)
  assert.match(tokens, /@media \(min-width: 840px\)[\s\S]*--ancho-app: 760px/)
})
test('el CSS de la entrega 30 usa solo tokens: sin colores, radios, sombras ni espacios sueltos', () => {
  assert.ok(bloque.length > 500)
  assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  for (const m of bloque.matchAll(/border-radius:\s*([^;]+);/g)) assert.match(m[1], /^var\(--r-/, m[0])
  for (const m of bloque.matchAll(/box-shadow:\s*([^;]+);/g)) assert.equal(m[1], 'var(--sombra-1)')
  for (const m of bloque.matchAll(/\b(?:padding|gap|margin)[a-z-]*:\s*([^;]+);/g))
    for (const v of m[1].split(/\s+/)) assert.ok(/^(var\(--sp-\d\)|0|auto|2px)$/.test(v), m[0])
})
test('las tarjetas ya no llevan borde: elevación con token', () => {
  const base = css.slice(css.indexOf('\nsection {'), css.indexOf('}', css.indexOf('\nsection {')))
  assert.match(base, /border:\s*0/)
  assert.match(base, /box-shadow:\s*var\(--sombra-1\)/)
  assert.match(base, /border-radius:\s*var\(--r-card\)/)
  assert.match(css, /max-width:\s*var\(--ancho-app\)/)
})
test('Hoy: orden A (preparación, botón, teselas, check-in, actividad y cuerpo)', () => {
  const orden = ['<Preparacion', 'EMPEZAR ENTRENO', '<AvisoDescarga', 'className="teselas"', 'id="hoy-checkin"', 'id="hoy-mas"']
  const pos = orden.map(t => hoy.indexOf(t))
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos))
  assert.deepEqual([...pos].sort((a, b) => a - b), pos)
  assert.match(hoy, /<FilaAlimentacion onAbrir=\{onComidas\}/)
})
test('Hoy: el check-in se abre solo si no está hecho y el contenido plegado sigue montado', () => {
  assert.match(hoy, /setCkAb\(!checkinHecho\(x\)\)/)
  assert.match(hoy, /hidden=\{!abierto\}/)
  assert.match(hoy, /<ActividadFisica onVerRutas=\{onRutas\}/)
  assert.match(hoy, /<TarjetaCuerpo \/>/)
  assert.match(hoy, /aria-expanded=\{abierto\}/)
})
test('Hoy: el agua conserva todos sus controles en el detalle', () => {
  for (const t of ['+{n}', 'Deshacer', 'Otra (ml)', '+ Sumar', 'Reiniciar', 'aguaLog'])
    assert.ok(hoy.includes(t), t)
})
test('carga diferida: Hoy sigue sin importar pantallas pesadas', () => {
  assert.match(hoy, /from '\.\.\/comidas\/FilaAlimentacion'/)
  assert.match(hoy, /from '\.\.\/coach\/Preparacion'/)
  assert.match(hoy, /from '\.\.\/progreso\/AvisoDescarga'/)
  assert.doesNotMatch(hoy, /comidas\/Comidas|coach\/Coach|progreso\/Progreso|progreso\/Pilares|entreno\/Entreno|rutas\/Rutas|import\(/)
  assert.doesNotMatch(leer('src/ui/pantallas.js'), /hoy\/Hoy|ActividadFisica/)
})
test('Preparación: el cálculo no cambia, el detalle va en un plegable', () => {
  const p = leer('src/features/coach/Preparacion.jsx')
  assert.match(p, /Detalle y cómo se calcula/)
  assert.match(p, /Calculado con el \{r\.confianza\}% de los datos/)
  assert.match(p, /Cómo te sentís 40 %/)
})
test('Entreno: la sesión manual queda en un plegable y conserva sus acciones', () => {
  const e = leer('src/features/entreno/Entreno.jsx')
  const i = e.indexOf('className="mas-opc"')
  assert.ok(i > 0)
  const resto = e.slice(i, e.indexOf('</details>', i))
  assert.match(resto, /Sesión manual con mis 5 bloques/)
  assert.match(resto, /Sesión en blanco/)
})
test('versión 0.31.0 / entrega 30', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.31.0')
  assert.equal(pkg.entrega, '30')
  assert.match(leer('package-lock.json'), /"version": "0\.31\.0"/)
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\n\n## v0\.31\.0 · Entrega 30/)
})
