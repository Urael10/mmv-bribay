// Entrega 30 · Responsive: tablet y pantalla ancha. Es CSS más estructura mínima; las pruebas fijan los cortes,
// que Hoy siga con el orden de siempre y que no se haya movido nada de la carga diferida.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const css = leer('src/styles.css')
const bloque = (inicio, desde = 0) => {
  // Devuelve el contenido de la media query que empieza con `inicio`, respetando llaves anidadas.
  const i = css.indexOf(inicio, desde)
  assert.ok(i >= 0, 'no está: ' + inicio)
  let n = 0,
    k = css.indexOf('{', i)
  const ini = k
  for (; k < css.length; k++) {
    if (css[k] === '{') n++
    else if (css[k] === '}' && --n === 0) break
  }
  return css.slice(ini + 1, k)
}
const entrega30 = css.slice(css.indexOf('Entrega 30: layout responsive'))

test('cortes: tablet a 720 px y riel a 1024 px (o celular acostado de poca altura)', () => {
  assert.match(entrega30, /@media \(min-width: 720px\)/)
  assert.match(
    entrega30,
    /@media \(min-width: 1024px\), \(orientation: landscape\) and \(min-width: 640px\) and \(max-height: 520px\)/
  )
})
test('la barra inferior pasa a riel vertical a la izquierda en pantalla ancha', () => {
  const ancho = bloque(
    '@media (min-width: 1024px), (orientation: landscape)',
    css.indexOf('Entrega 30: layout responsive')
  )
  assert.match(ancho, /nav \{[^}]*flex-direction: column/)
  assert.match(ancho, /nav \{[^}]*width: var\(--rail\)/)
  assert.match(ancho, /\.app \{[^}]*padding-left: var\(--rail\)/)
  assert.match(ancho, /env\(safe-area-inset-top\)/)
})
test('el celular no cambia: ninguna regla nueva fuera de media query afecta el layout salvo .col transparente', () => {
  const fuera = entrega30.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
  assert.doesNotMatch(fuera, /nav\s*\{/)
  assert.doesNotMatch(fuera, /\.bento/)
  assert.match(css, /\.bento > \.col \{\s*display: contents;/)
})
test('los cortes de styles.css no tienen colores sueltos ni usan hex/rgb', () => {
  assert.doesNotMatch(entrega30, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
})
test('Hoy: dos pilas .col en el orden original (celular intacto)', () => {
  const j = leer('src/features/hoy/Hoy.jsx')
  assert.equal((j.match(/className="col"/g) || []).length, 2)
  const orden = [
    'checkin',
    '<Preparacion',
    '<AvisoDescarga',
    'EMPEZAR ENTRENO',
    '<FilaAlimentacion',
    'Hidratación',
    '<ActividadFisica',
    '<TarjetaCuerpo'
  ]
  let pos = -1
  for (const t of orden) {
    const p = j.indexOf(t)
    assert.ok(p > pos, 'fuera de orden: ' + t)
    pos = p
  }
  const medio = j.indexOf('className="col"', j.indexOf('className="col"') + 1)
  assert.ok(j.indexOf('<FilaAlimentacion') < medio && medio < j.indexOf('Hidratación'))
})
test('ningún selector viejo quedó pegado a .bento sin pasar por .col', () => {
  assert.doesNotMatch(css, /\.bento > (section|\.mitad|\.filahoy)/)
})
test('App: cada pantalla lleva su clase main.tab-… y la barra tiene nombre accesible', () => {
  const a = leer('src/App.jsx')
  assert.match(a, /<main className=\{'tab-' \+ tab\}>/)
  assert.match(a, /<nav aria-label="Secciones">/)
  for (const t of ['hoy', 'entreno', 'comidas', 'progreso', 'ajustes', 'priv'])
    assert.ok(t === 'priv' || css.includes('main.tab-' + t) || t === 'hoy' || t === 'progreso', t)
  for (const t of ['entreno', 'comidas', 'ajustes', 'priv'])
    assert.ok(css.includes('main.tab-' + t), t)
})
test('Progreso: pestañas verticales en ancho y flechas arriba/abajo', () => {
  const p = leer('src/features/progreso/Progreso.jsx')
  assert.match(p, /className="progreso-pag"/)
  assert.match(p, /className="progreso-cuerpo"/)
  assert.match(entrega30, /\.progreso-pag \{[^}]*grid-template-columns: 180px/)
  const t = leer('src/ui/TabsDeslizables.jsx')
  assert.match(t, /ArrowDown/)
  assert.match(t, /ArrowUp/)
})
test('el cambio es solo de presentación: no se tocaron imports de pantallas ni el registro', () => {
  const a = leer('src/App.jsx')
  assert.doesNotMatch(
    a,
    /features\/(comidas\/Comidas|coach\/Coach|progreso\/(Progreso|Pilares)|entreno\/Entreno)'/
  )
  assert.doesNotMatch(
    leer('src/features/hoy/Hoy.jsx'),
    /from '\.\.\/(comidas\/Comidas|coach\/Coach|progreso\/Pilares)'/
  )
})
test('el manifest ya no fija la orientación vertical', () => {
  const m = JSON.parse(leer('public/manifest.webmanifest'))
  assert.equal(m.orientation, 'any')
})
test('versión 0.31.0 / entrega 30', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.31.0')
  assert.equal(pkg.entrega, '30')
  assert.match(leer('package-lock.json'), /"version": "0\.31\.0"/)
})
