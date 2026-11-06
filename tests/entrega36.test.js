// Entrega 35 (v0.36.0) · Modo bolsillo: señal de GPS, ritmo, pausa, reloj y pantalla nueva.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  BOLSILLO_CFG,
  VIBRA,
  nivelSenal,
  agregarMuestra,
  ritmoAhoraSegKm,
  formatoRitmoMin,
  formatoReloj,
  formatoKm,
  pausaNueva,
  estaPausado,
  cambiarPausa,
  segPausaActual,
  pausaTotalSeg,
  tiempoActivoSeg,
  relojParaGuardar,
  relojDesdeGuardado,
  estadoVista,
  textoPausaVista,
  resumenBolsillo
} from '../src/domain/bolsillo.js'
import {gpsNuevo, procesarPuntoGps} from '../src/domain/actividad.js'
const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// ---------- Señal de GPS ----------
test('señal: sin usar GPS no hay indicador; sin permiso y buscando no tienen barras', () => {
  assert.equal(nivelSenal({usar: false}), null)
  assert.deepEqual(nivelSenal({permiso: false}), {
    id: 'sinpermiso',
    barras: 0,
    texto: 'GPS sin permiso'
  })
  assert.equal(nivelSenal({precision: null}).id, 'buscando')
  assert.equal(nivelSenal({}).barras, 0)
})
test('señal: buena, débil y precisión en metros', () => {
  assert.deepEqual(nivelSenal({precision: 6, edadSeg: 1}), {
    id: 'buena',
    barras: 4,
    texto: 'GPS buena · ±6 m'
  })
  assert.equal(nivelSenal({precision: 12, edadSeg: 1}).barras, 3)
  assert.equal(nivelSenal({precision: 20, edadSeg: 1}).barras, 2)
  assert.deepEqual(nivelSenal({precision: 38.4, edadSeg: 2}), {
    id: 'debil',
    barras: 1,
    texto: 'GPS débil · ±38 m'
  })
  assert.equal(nivelSenal({precision: 25, edadSeg: 1}).id, 'buena') // el límite es el mismo del detector de GPS
  assert.equal(nivelSenal({precision: 25.1, edadSeg: 1}).id, 'debil')
})
test('señal: caduca. Si el GPS deja de entregar puntos, deja de decir «buena»', () => {
  assert.equal(nivelSenal({precision: 5, edadSeg: BOLSILLO_CFG.caducaSeg}).id, 'buena')
  const s = nivelSenal({precision: 5, edadSeg: BOLSILLO_CFG.caducaSeg + 1})
  assert.deepEqual(s, {id: 'sinsenal', barras: 0, texto: 'GPS sin señal'})
})

// ---------- Ritmo «ahora» ----------
// Camina a 5 km/h (1,389 m/s = 720 s/km), un punto por segundo.
function caminar(seg, vel = 1.3889, desde = 0, m0 = 0) {
  let buf = []
  for (let i = 0; i <= seg; i++) buf = agregarMuestra(buf, desde + i * 1000, m0 + i * vel)
  return buf
}
test('ritmo ahora: a 5 km/h da 12:00 min/km', () => {
  const buf = caminar(60)
  const r = ritmoAhoraSegKm(buf, 60000)
  assert.ok(Math.abs(r - 720) <= 2, String(r))
  assert.equal(formatoRitmoMin(r), '12:00')
})
test('ritmo ahora: solo mira el último minuto', () => {
  let buf = caminar(120, 1.3889) // 5 km/h
  for (let i = 121; i <= 200; i++)
    buf = agregarMuestra(buf, i * 1000, 120 * 1.3889 + (i - 120) * 2.7778) // 10 km/h
  assert.ok(buf[0].t >= 200000 - BOLSILLO_CFG.ventanaSeg * 1000)
  const r = ritmoAhoraSegKm(buf, 200000)
  assert.ok(Math.abs(r - 360) <= 3, String(r))
})
test('ritmo ahora: no inventa. Pocos datos, parado, viejo o inválido dan null', () => {
  assert.equal(ritmoAhoraSegKm([], 0), null)
  assert.equal(ritmoAhoraSegKm(caminar(20), 20000), null) // menos de 30 s
  assert.equal(ritmoAhoraSegKm(caminar(60, 0.2), 60000), null) // 12 m en un minuto: menos de 30 m
  assert.equal(ritmoAhoraSegKm(caminar(60, 0.45), 60000), null) // 3,7 km/h pero más lento que 30 min/km? 27 m < 30 m
  assert.equal(ritmoAhoraSegKm(caminar(60), 60000 + 25000), null) // última muestra de hace 25 s
  assert.deepEqual(agregarMuestra([{t: 1, m: 1}], NaN, 5), [{t: 1, m: 1}])
  assert.deepEqual(agregarMuestra([{t: 5, m: 1}], 5, 9), [{t: 5, m: 1}]) // no repite ni retrocede
})
test('ritmo ahora: más lento que 30 min/km se muestra como «—»', () => {
  const buf = caminar(120, 0.5) // 60 m en 2 min = 33:20 min/km
  assert.equal(ritmoAhoraSegKm(buf, 120000), null)
  assert.equal(formatoRitmoMin(null), '—')
  assert.equal(formatoRitmoMin(0), '—')
  assert.equal(formatoRitmoMin(959.6), '16:00')
})
test('el buffer queda acotado', () => {
  let buf = []
  for (let i = 0; i < 500; i++)
    buf = agregarMuestra(buf, i * 100, i, {...BOLSILLO_CFG, ventanaSeg: 1000})
  assert.ok(buf.length <= BOLSILLO_CFG.muestrasMax)
})

test('formatos', () => {
  assert.equal(formatoReloj(0), '0:00')
  assert.equal(formatoReloj(2292), '38:12')
  assert.equal(formatoReloj(3725), '1:02:05')
  assert.equal(formatoReloj(-4), '0:00')
  assert.equal(formatoReloj('x'), '0:00')
  assert.equal(formatoKm(2410), '2,41')
  assert.equal(formatoKm(-5), '0,00')
})

// ---------- Pausa y reloj ----------
test('pausa: manual, y los tramos cerrados se suman', () => {
  let p = pausaNueva()
  assert.equal(estaPausado(p), false)
  p = cambiarPausa(p, 'manual', true, 10_000)
  assert.equal(estaPausado(p), true)
  assert.equal(segPausaActual(p, 52_000), 42)
  assert.equal(textoPausaVista(42), 'Pausa · 0:42 · no se cuenta nada')
  p = cambiarPausa(p, 'manual', false, 70_000)
  assert.equal(estaPausado(p), false)
  assert.equal(p.acum, 60)
  assert.equal(segPausaActual(p, 99_000), 0)
  p = cambiarPausa(p, 'oculto', true, 100_000)
  p = cambiarPausa(p, 'oculto', false, 130_000)
  assert.equal(pausaTotalSeg(p, 200_000), 90)
})
test('pausa: manual y oculta a la vez es un solo tramo, sin sumar dos veces', () => {
  let p = cambiarPausa(pausaNueva(), 'manual', true, 0)
  p = cambiarPausa(p, 'oculto', true, 20_000)
  p = cambiarPausa(p, 'oculto', false, 40_000)
  assert.equal(estaPausado(p), true) // sigue la manual
  p = cambiarPausa(p, 'manual', false, 60_000)
  assert.equal(p.acum, 60)
  assert.equal(p.desde, 0)
})
test('pausa: sin cambio devuelve el mismo objeto y una fuente desconocida no hace nada', () => {
  const p = pausaNueva()
  assert.equal(cambiarPausa(p, 'manual', false, 5), p)
  assert.equal(cambiarPausa(p, 'otra', true, 5), p)
})
test('reloj: tiempo en marcha = tiempo total − pausas (cerradas y en curso)', () => {
  let p = cambiarPausa(pausaNueva(), 'manual', true, 100_000)
  p = cambiarPausa(p, 'manual', false, 160_000) // 60 s
  assert.equal(tiempoActivoSeg({inicio: 0 + 1, ahora: 300_001, pausa: p}), 240)
  p = cambiarPausa(p, 'manual', true, 250_000) // pausa en curso
  assert.equal(tiempoActivoSeg({inicio: 1, ahora: 300_001, pausa: p}), 190) // 300 − 60 − 50
  assert.equal(tiempoActivoSeg({inicio: 0, ahora: 10, pausa: pausaNueva()}), 0) // sin inicio
  assert.equal(tiempoActivoSeg({inicio: 5000, ahora: 1000, pausa: pausaNueva()}), 0) // nunca negativo
})
test('reloj: se guarda y se recupera; el tiempo con la app cerrada cuenta como pausa', () => {
  const ahora = 1_000_000
  let p = cambiarPausa(pausaNueva(), 'oculto', true, 1000)
  p = cambiarPausa(p, 'oculto', false, 31_000) // 30 s
  const txt = relojParaGuardar({inicio: 500_000, pausa: p, visto: 900_000})
  const r = relojDesdeGuardado(txt, ahora)
  assert.equal(r.inicio, 500_000)
  assert.equal(r.pausa.acum, 30 + 100) // 100 s cerrada
  assert.equal(r.pausa.manual, false)
  // cerrada por poco: no cuenta
  assert.equal(
    relojDesdeGuardado(relojParaGuardar({inicio: 500_000, pausa: p, visto: 995_000}), ahora).pausa
      .acum,
    30
  )
})
test('reloj: una pausa manual sigue corriendo desde donde empezó', () => {
  const p = cambiarPausa(pausaNueva(), 'manual', true, 800_000)
  const r = relojDesdeGuardado(
    relojParaGuardar({inicio: 500_000, pausa: p, visto: 850_000}),
    1_000_000
  )
  assert.equal(r.pausa.manual, true)
  assert.equal(r.pausa.desde, 800_000)
  assert.equal(r.pausa.acum, 0) // el hueco con la app cerrada ya está dentro del tramo de pausa
  assert.equal(segPausaActual(r.pausa, 1_000_000), 200)
})
test('reloj: datos rotos o del futuro se descartan', () => {
  assert.equal(relojDesdeGuardado('no es json', 10), null)
  assert.equal(relojDesdeGuardado(null, 10), null)
  assert.equal(relojDesdeGuardado('{"i":0}', 10), null)
  assert.equal(relojDesdeGuardado('{"i":50}', 10), null)
})

// ---------- El GPS no suma lo caminado durante la pausa ----------
test('reanudar re-ancla el GPS: el tramo en pausa no suma distancia y no se cuenta como paso a paso', () => {
  const pt = (lat, t) => ({lat, lon: -58.4, precision: 5, t})
  let g = gpsNuevo()
  g = procesarPuntoGps(g, pt(-34.6, 0)).estado
  g = procesarPuntoGps(g, pt(-34.5999, 5000)).estado // ~11 m
  const antes = g.m
  assert.ok(antes > 5 && antes < 20, String(antes))
  // Misma operación que hace alternarPausa al reanudar: ancla y hora en null
  g = {...g, ancla: null, t: null}
  const r = procesarPuntoGps(g, pt(-34.59, 600_000)) // 1 km más al norte, caminado en pausa
  assert.equal(r.motivo, 'inicio')
  assert.equal(r.estado.m, antes)
})

// ---------- Textos ----------
test('estado: la pausa manual manda; después se sigue con el estado de siempre', () => {
  assert.equal(estadoVista({activo: false}), null)
  assert.deepEqual(estadoVista({activo: true, manual: true, visible: false}), {
    id: 'pausa',
    icono: 'pausa',
    texto: 'En pausa'
  })
  assert.equal(estadoVista({activo: true, visible: false}).id, 'pausa')
  assert.equal(
    estadoVista({activo: true, usarGps: true, senal: 'buscando', sesion: 0}).id,
    'buscando'
  )
  assert.equal(estadoVista({activo: true}).id, 'contando')
})
test('resumen para lectores de pantalla', () => {
  const t = resumenBolsillo({
    pasosHoy: 5482,
    meta: 8000,
    sesion: 312,
    km: '2,41',
    tiempo: '38:12',
    ritmo: '15:51'
  })
  assert.match(t, /Pasos de hoy: 5482 de 8000 \(69 %\)/)
  assert.match(t, /Esta caminata: 312 pasos/)
  assert.match(t, /ritmo 15:51 minutos por kilómetro/)
  assert.match(resumenBolsillo({ritmo: '—', pausada: true}), /ritmo sin datos\. En pausa\./)
  assert.match(resumenBolsillo({pasosHoy: 10}), /Pasos de hoy: 10\./)
})
test('vibración: una corta al pausar, doble al reanudar y al salir', () => {
  assert.deepEqual(VIBRA.pausar, [40])
  assert.deepEqual(VIBRA.reanudar, [40, 60, 40])
  assert.deepEqual(VIBRA.salir, VIBRA.reanudar)
})

// ---------- Arquitectura ----------
test('bolsillo.js es lógica pura: sin React, Dexie, navegador ni módulos de rutas', () => {
  const c = leer('src/domain/bolsillo.js')
  assert.doesNotMatch(c, /from 'react|from '\.\.\/data|localStorage|document\.|window\.|navigator/)
  assert.doesNotMatch(c, /\/rutas(\.js)?'/)
})
test('VistaBolsillo recibe todo por props y no importa rutas, datos ni dominio de conteo', () => {
  const v = leer('src/features/actividad/VistaBolsillo.jsx')
  assert.doesNotMatch(v, /rutas|\/data\/|domain\/actividad|localStorage/)
  assert.match(v, /export function VistaBolsillo/)
  assert.match(v, /export function BarrasSenal/)
  assert.match(v, /export function Mantener/)
  assert.match(v, /e\.key === 'Enter' \|\| e\.key === ' '/) // alternativa de teclado
})
test('ActividadFisica: pausa manual, reloj, señal con caducidad y ritmo; la lógica de conteo no se tocó', () => {
  const a = leer('src/features/actividad/ActividadFisica.jsx')
  assert.match(a, /if \(pausaRef\.current\.manual\) return/) // el sensor no suma en pausa
  assert.match(a, /gpsRef\.current = \{\.\.\.gpsRef\.current, ancla: null, t: null\}/) // re-ancla al reanudar
  assert.match(a, /ponerPausa\('oculto', !visibleAhora\)/)
  assert.match(a, /agregarMuestra\(ritmoRef\.current, p\.t, r\.estado\.m\)/)
  assert.match(a, /nivelSenal\(/)
  assert.match(a, /K\.reloj/)
  assert.match(a, /navigator\.vibrate\?\.\(patron\)/)
  assert.match(a, /<Bolsillo\s/)
  for (const f of [
    'procesarMuestra',
    'procesarPuntoGps',
    'cerrarConteo',
    'armarRuta',
    'agregarPuntoRuta',
    'combinarPasos'
  ])
    assert.ok(a.includes(f), f)
  // el reloj nuevo no cambia de dónde salen los segundos de la actividad sugerida
  assert.match(a, /seg: gpsRef\.current\.seg,\n\s+largo: largoGuardado\(\)/)
})
test('el bolsillo mantiene salir con 1 s y agrega la pausa con 0,6 s', () => {
  const a = leer('src/features/actividad/ActividadFisica.jsx')
  assert.match(a, /setTimeout\(onSalir, 1000\)/)
  assert.equal(BOLSILLO_CFG.mantenerPausaMs, 600)
  assert.match(a, /ms=\{BOLSILLO_CFG\.mantenerPausaMs\}/)
})
test('la privacidad no cambia: ningún archivo nuevo importa módulos de rutas', () => {
  for (const f of ['src/domain/bolsillo.js', 'src/features/actividad/VistaBolsillo.jsx'])
    assert.doesNotMatch(leer(f), /from '[^']*\/rutas(\.js)?'/, f)
})

// ---------- Estilos ----------
test('el bloque CSS de la entrega 35 usa solo tokens, sin cian ni lima, y respeta «reducir movimiento»', () => {
  const css = leer('src/styles.css'),
    b = css.slice(css.indexOf('Entrega 35:'))
  assert.ok(b.length > 1500)
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|var\(--ac\)|var\(--pr\)/)
  assert.match(b, /prefers-reduced-motion: reduce[\s\S]*\.bols-onda[\s\S]*display: none/)
  assert.match(b, /@keyframes bols-onda/)
  for (const t of ['--info', '--pos', '--warn', '--sf-2', '--tx-dis'])
    assert.ok(b.includes(`var(${t})`), t)
})
test('no hay tokens nuevos', () => {
  assert.doesNotMatch(leer('src/tokens.css'), /--bols|--senal|--pausa/)
})

test('versión 0.36.0 / entrega 35 con su nota en el CHANGELOG', () => {
  const pkg = JSON.parse(leer('package.json')),
    lock = JSON.parse(leer('package-lock.json'))
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 36, pkg.version)
  assert.ok(Number(pkg.entrega) >= 35)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.match(
    leer('CHANGELOG.md'),
    /## v0\.36\.0 · Entrega 35 · Modo bolsillo con datos, señal de GPS, pausa y animación/
  )
  assert.match(leer('README.md'), /Modo bolsillo \(v0\.35\.0 y v0\.36\.0\)/)
})
