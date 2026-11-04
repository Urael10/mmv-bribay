// Entrega 22 · Propuesta 2: tokens de color, contraste, variaciones y estados.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {claseVariacion, semanaEnCurso, chipEstado, repartoMacros} from '../src/domain/variacion.js'

const raiz = new URL('..', import.meta.url).pathname
const leer = r => readFileSync(join(raiz, r), 'utf8')

// ---- Contraste WCAG calculado sobre los valores reales de src/tokens.css
const css = leer('src/tokens.css')
const hex = n => {
  const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))
  assert.ok(m, `falta el token --${n} (hex)`)
  return m[1]
}
const lin = c => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = h => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const SUPERFICIES = ['bg', 'sf', 'sf-2']

test('texto primario ≥ 7:1 sobre todas las superficies y el hero', () => {
  for (const s of [...SUPERFICIES, 'hero-1']) assert.ok(ratio('tx', s) >= 7, `tx/${s} = ${ratio('tx', s).toFixed(2)}`)
})
test('texto secundario ≥ 4,5:1 sobre superficies y sobre el hero (con --hero-tx)', () => {
  for (const s of SUPERFICIES) assert.ok(ratio('tx-2', s) >= 4.5, `tx-2/${s}`)
  assert.ok(ratio('hero-tx', 'hero-1') >= 4.5)
  assert.ok(ratio('hero-tx', 'hero-2') >= 4.5)
})
test('placeholders (--tx-3) ≥ 4,5:1 sobre el fondo de los campos', () => {
  assert.ok(ratio('tx-3', 'bg') >= 4.5, ratio('tx-3', 'bg').toFixed(2))
  assert.ok(ratio('tx-3', 'sf') >= 4.5)
})
test('bordes de controles (--bd) ≥ 3:1 y mayores que el separador decorativo', () => {
  for (const s of ['bg', 'sf']) assert.ok(ratio('bd', s) >= 3, `bd/${s} = ${ratio('bd', s).toFixed(2)}`)
  assert.ok(ratio('ln', 'sf') < 3)
})
test('cian, lima y estados legibles ≥ 4,5:1; texto de botón sobre su relleno ≥ 7:1', () => {
  for (const t of ['ac', 'pos', 'neg', 'warn', 'info']) for (const s of SUPERFICIES) assert.ok(ratio(t, s) >= 4.5, `${t}/${s}`)
  assert.ok(ratio('pr', 'sf') >= 4.5)
  assert.ok(ratio('on-ac', 'ac') >= 7)
  assert.ok(ratio('on-pr', 'pr') >= 7)
})
test('series de macros distinguibles del fondo (≥ 3:1)', () => {
  for (const t of ['m-c', 'm-g']) assert.ok(ratio(t, 'sf') >= 3, t)
})

// ---- Nada de colores sueltos fuera de tokens.css
const archivos = d =>
  readdirSync(join(raiz, d)).flatMap(n => {
    const r = join(d, n)
    return statSync(join(raiz, r)).isDirectory() ? archivos(r) : [r]
  })
test('no hay colores hex/rgb sueltos en styles.css ni en los componentes', () => {
  const malos = []
  for (const f of archivos('src').filter(f => /\.(css|jsx)$/.test(f) && !f.endsWith('tokens.css'))) {
    const m = leer(f).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)
    if (m) malos.push(`${f}: ${m.join(', ')}`)
  }
  assert.deepEqual(malos, [])
})
test('theme-color del manifest e index.html coincide con --bg', () => {
  const bg = hex('bg').toLowerCase()
  assert.equal(JSON.parse(leer('public/manifest.webmanifest')).theme_color.toLowerCase(), bg)
  assert.ok(leer('index.html').toLowerCase().includes(`content="${bg}"`))
})
test('el lima no se usa en etiquetas, unidades ni deltas (solo CTA, .plus y datos clave)', () => {
  const s = leer('src/styles.css')
  const usos = [...s.matchAll(/([^{}]+)\{[^{}]*var\(--pr\)[^{}]*\}/g)].map(m => m[1].replace(/\s+/g, ' ').trim())
  for (const u of usos) assert.ok(!/\.tag|\.delta|\.sc\b|\.big|\.mu\b|\.upd|\.igual/.test(u), `lima en ${u}`)
})

// ---- Variaciones
test('claseVariacion: color solo con comparación firme', () => {
  assert.equal(claseVariacion(12), 'delta up')
  assert.equal(claseVariacion(-30), 'delta down')
  assert.equal(claseVariacion(0), 'delta')
})
test('claseVariacion: semana en curso o dato sin juicio → gris con dirección', () => {
  assert.equal(claseVariacion(-47, {neutra: true}), 'delta neutra baja')
  assert.equal(claseVariacion(8, {neutra: true}), 'delta neutra sube')
  assert.equal(claseVariacion(0, {neutra: true}), 'delta')
})
test('claseVariacion: sin dato no rotula nada', () => {
  for (const v of [null, undefined, '', NaN, 'x']) assert.equal(claseVariacion(v), 'delta')
  assert.equal(claseVariacion('5'), 'delta up')
})
test('semanaEnCurso compara con el lunes actual', () => {
  assert.equal(semanaEnCurso('2026-11-02', '2026-11-02'), true)
  assert.equal(semanaEnCurso('2026-10-26', '2026-11-02'), false)
})

// ---- Chips de estado de Pilares y tests
test('chipEstado: cada rótulo existente tiene ícono y tipo', () => {
  const todos = ['Sin datos suficientes', 'Estable', 'Irregular', 'Subiendo', 'Bajando', 'Constante', 'Poca constancia', 'Con tendencia', 'Todavía no lo hiciste', 'Al día', 'Toca repetirlo', 'Atrasado']
  for (const t of todos) {
    const c = chipEstado(t)
    assert.ok(c.tipo && c.icono, t)
  }
  assert.deepEqual(chipEstado('Sin datos suficientes'), {tipo: 'sin', icono: 'circulo'})
  assert.deepEqual(chipEstado('Irregular'), {tipo: 'warn', icono: 'alerta'})
  assert.deepEqual(chipEstado('Estable'), {tipo: 'info', icono: 'igual'})
})
test('chipEstado: rótulo nuevo cae por tono', () => {
  assert.deepEqual(chipEstado('Otro', 'up'), {tipo: 'ok', icono: 'flecha-arriba'})
  assert.deepEqual(chipEstado('Otro', 'down'), {tipo: 'neg', icono: 'flecha-abajo'})
  assert.deepEqual(chipEstado('Otro'), {tipo: 'info', icono: 'info'})
})
test('los rótulos del dominio de progreso están todos mapeados', () => {
  const fuente = leer('src/domain/progreso.js')
  const rot = [...fuente.matchAll(/etiqueta: '([^']+)'/g)].map(m => m[1])
  assert.ok(rot.length >= 6)
  for (const r of new Set(rot)) {
    const c = chipEstado(r, '')
    assert.notEqual(`${c.tipo}/${c.icono}`, 'info/info', `${r} cae al valor por defecto: mapealo en ESTADOS`)
  }
})

// ---- Macros
test('repartoMacros: porcentajes por gramos y ceros sin dividir', () => {
  assert.deepEqual(repartoMacros({p: 0, c: 0, gr: 0}), {p: 0, c: 0, gr: 0, total: 0})
  assert.deepEqual(repartoMacros({p: 50, c: 30, gr: 20}), {p: 50, c: 30, gr: 20, total: 100})
  assert.deepEqual(repartoMacros(), {p: 0, c: 0, gr: 0, total: 0})
  assert.equal(repartoMacros({p: 10, c: -5, gr: 'x'}).p, 100)
})
test('Comidas ya no muestra «P · C · G» abreviado', () => {
  const c = leer('src/features/comidas/Comidas.jsx')
  assert.ok(!/P \{fmt\(t\.p\)\}/.test(c))
  assert.ok(c.includes('Carbohidratos'))
})

// ---- Íconos
test('no quedan los emojis 📷 ✍ 📚 ↻ en la interfaz', () => {
  for (const f of archivos('src').filter(f => f.endsWith('.jsx'))) {
    const t = leer(f)
    for (const e of ['📷', '✍', '📚', '↻', '🔁']) assert.ok(!t.includes(e), `${f} usa ${e}`)
  }
})
