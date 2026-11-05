// Entrega 28 · Rendimiento: carga diferida de pantallas (React.lazy) con precarga y reintento.
// Lógica pura (domain/carga.js), registro (ui/pantallas.js) y reglas de arquitectura vigiladas sobre el código.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {
  ORDEN_PRECARGA,
  ErrorDeCarga,
  conReintento,
  debePrecargar,
  textoFalloCarga,
  urlDeFallo,
  urlDeReintento
} from '../src/domain/carga.js'
import {IMPORTADORES, cargar, componente, estaCargada, precargarEnSegundoPlano} from '../src/ui/pantallas.js'

const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const archivos = d =>
  readdirSync(d).flatMap(n => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? archivos(p) : /\.(js|jsx)$/.test(n) ? [p] : []
  })
const sinEspera = {esperar: async () => {}}

// ---------- conReintento ----------
test('conReintento: devuelve el valor al primer intento sin esperar', async () => {
  let esperas = 0
  const r = await conReintento(async () => 'ok', {esperar: async () => esperas++})
  assert.equal(r, 'ok')
  assert.equal(esperas, 0)
})
test('conReintento: reintenta y espera un poco más cada vez (600 ms, 1,2 s)', async () => {
  let n = 0
  const esperas = []
  const r = await conReintento(
    async () => {
      if (++n < 3) throw new Error('red')
      return 'listo'
    },
    {esperar: async ms => esperas.push(ms)}
  )
  assert.equal(r, 'listo')
  assert.equal(n, 3)
  assert.deepEqual(esperas, [600, 1200])
})
test('conReintento: si todos fallan, lanza el último error y no espera después del último', async () => {
  let n = 0
  const esperas = []
  await assert.rejects(
    conReintento(
      async () => {
        throw new Error('fallo ' + ++n)
      },
      {intentos: 3, esperar: async ms => esperas.push(ms)}
    ),
    /fallo 3/
  )
  assert.equal(esperas.length, 2)
})
test('conReintento: con 1 intento no espera ni repite', async () => {
  let n = 0
  await assert.rejects(
    conReintento(
      async () => {
        n++
        throw new Error('x')
      },
      {intentos: 1, ...sinEspera}
    )
  )
  assert.equal(n, 1)
})

test('conReintento: pasa el número de intento y el error anterior, y corta si repetir() dice que no', async () => {
  const vistos = []
  await assert.rejects(
    conReintento(
      async (i, previo) => {
        vistos.push([i, previo?.message])
        throw new Error('e' + i)
      },
      {intentos: 5, repetir: e => e.message !== 'e1', ...sinEspera}
    ),
    /e1/
  )
  assert.deepEqual(vistos, [[0, undefined], [1, 'e0']])
})

// ---------- reintento de una descarga fallida (el navegador recuerda el import() que falló) ----------
test('urlDeFallo: saca la dirección del archivo del mensaje de Chrome, Firefox o Chrome con HTML', () => {
  const u = 'https://mmv-bribay.pages.dev/assets/Comidas-DPoeyH_l.js'
  assert.equal(urlDeFallo(new TypeError('Failed to fetch dynamically imported module: ' + u)), u)
  assert.equal(urlDeFallo(new TypeError('error loading dynamically imported module: ' + u)), u)
  assert.equal(urlDeFallo({message: `Failed to load module script: "${u}" (text/html)`}), u)
  assert.equal(
    urlDeFallo(new Error('Failed to fetch dynamically imported module: http://localhost:4173/assets/A-1.js?r=1-99')),
    'http://localhost:4173/assets/A-1.js?r=1-99'
  )
})
test('urlDeFallo: Safari no dice el archivo (null); entradas raras no rompen', () => {
  assert.equal(urlDeFallo(new TypeError('Importing a module script failed.')), null)
  assert.equal(urlDeFallo(null), null)
  assert.equal(urlDeFallo(undefined), null)
  assert.equal(urlDeFallo('texto'), null)
  assert.equal(urlDeFallo({message: 'sin señal'}), null)
})
test('urlDeReintento: agrega ?r= distinto en cada intento y no acumula parámetros', () => {
  const base = 'https://x.dev/assets/Comidas-abc.js'
  const a = urlDeReintento(base, 1, 1000)
  assert.equal(a, base + '?r=1-1000')
  assert.equal(urlDeReintento(a, 2, 2000), base + '?r=2-2000')
  assert.notEqual(urlDeReintento(base, 1, 1000), urlDeReintento(base, 1, 1001))
})
test('ErrorDeCarga.recargar: solo cuando no se sabe qué archivo falló', () => {
  assert.equal(new ErrorDeCarga('x', new TypeError('Failed to fetch dynamically imported module: https://a.dev/a/X-1.js')).recargar, false)
  assert.equal(new ErrorDeCarga('x', new TypeError('Importing a module script failed.')).recargar, true)
  assert.equal(new ErrorDeCarga('x', undefined).recargar, true)
})
test('cargar: un fallo sin dirección (Safari) no se repite en vano', async () => {
  let pedidos = 0
  const original = IMPORTADORES.comidas
  IMPORTADORES.comidas = async () => {
    pedidos++
    throw new TypeError('Importing a module script failed.')
  }
  try {
    await assert.rejects(cargar('comidas', sinEspera), /Importing a module script failed/)
    assert.equal(pedidos, 1)
  } finally {
    IMPORTADORES.comidas = original
  }
})

// ---------- debePrecargar y textos ----------
test('debePrecargar: sí con buena red; no sin conexión, con ahorro de datos o 2G', () => {
  assert.equal(debePrecargar({}), true)
  assert.equal(debePrecargar({enLinea: true, tipoRed: '4g'}), true)
  assert.equal(debePrecargar({enLinea: false}), false)
  assert.equal(debePrecargar({ahorroDatos: true}), false)
  assert.equal(debePrecargar({tipoRed: '2g'}), false)
  assert.equal(debePrecargar({tipoRed: 'slow-2g'}), false)
  assert.equal(debePrecargar({tipoRed: '3g'}), true)
  assert.equal(debePrecargar(), true)
})
test('textoFalloCarga: distingue sin conexión de falla con señal y tranquiliza sobre los datos', () => {
  const con = textoFalloCarga({enLinea: true}),
    sin = textoFalloCarga({enLinea: false})
  assert.notEqual(con, sin)
  assert.match(sin, /sin conexión/i)
  assert.match(con, /versión nueva/i)
  for (const t of [con, sin]) assert.match(t, /datos no se tocaron/i)
})
test('ErrorDeCarga: se distingue de un error común y guarda la causa', () => {
  const causa = new Error('404')
  const e = new ErrorDeCarga('entreno', causa)
  assert.ok(e instanceof Error && e instanceof ErrorDeCarga)
  assert.equal(e.clave, 'entreno')
  assert.equal(e.causa, causa)
  assert.ok(!(new Error('x') instanceof ErrorDeCarga))
})

// ---------- registro de pantallas ----------
test('ORDEN_PRECARGA y los importadores tienen exactamente las mismas pantallas, sin repetir', () => {
  assert.equal(new Set(ORDEN_PRECARGA).size, ORDEN_PRECARGA.length)
  assert.deepEqual([...ORDEN_PRECARGA].sort(), Object.keys(IMPORTADORES).sort())
  assert.deepEqual([...ORDEN_PRECARGA].sort(), ['ajustes', 'comidas', 'entreno', 'priv', 'progreso', 'rutas'])
})
test('cargar: comparte la promesa, marca la pantalla como cargada y pide el archivo una sola vez', async () => {
  let pedidos = 0
  const original = IMPORTADORES.ajustes
  IMPORTADORES.ajustes = async () => {
    pedidos++
    return {default: () => null}
  }
  try {
    assert.equal(estaCargada('ajustes'), false)
    const [a, b] = await Promise.all([cargar('ajustes'), cargar('ajustes')])
    assert.equal(a, b)
    await cargar('ajustes')
    assert.equal(pedidos, 1)
    assert.equal(estaCargada('ajustes'), true)
  } finally {
    IMPORTADORES.ajustes = original
  }
})
test('cargar: si falla no recuerda el fallo (el próximo intento vuelve a pedir el archivo)', async () => {
  let pedidos = 0
  const original = IMPORTADORES.rutas
  IMPORTADORES.rutas = async () => {
    pedidos++
    if (pedidos === 1) throw new Error('sin señal')
    return {default: () => null}
  }
  try {
    await assert.rejects(cargar('rutas', {intentos: 1, ...sinEspera}), /sin señal/)
    assert.equal(estaCargada('rutas'), false)
    await cargar('rutas', {intentos: 1, ...sinEspera})
    assert.equal(pedidos, 2)
    assert.equal(estaCargada('rutas'), true)
  } finally {
    IMPORTADORES.rutas = original
  }
})
test('cargar: una pantalla desconocida se rechaza con un mensaje claro', async () => {
  await assert.rejects(cargar('no-existe'), /Pantalla desconocida: no-existe/)
})
test('componente: devuelve el mismo React.lazy para la misma pantalla y uno distinto para otra', () => {
  assert.equal(componente('entreno'), componente('entreno'))
  assert.notEqual(componente('entreno'), componente('comidas'))
  assert.equal(typeof componente('entreno'), 'object')
})
test('precarga en segundo plano: baja todas las pantallas en orden, una vez, y se puede cancelar', async () => {
  const pedidas = []
  const originales = {...IMPORTADORES}
  for (const k of Object.keys(IMPORTADORES))
    IMPORTADORES[k] = async () => {
      pedidas.push(k)
      return {default: () => null}
    }
  try {
    const cancelar = precargarEnSegundoPlano({esperaMs: 0, pausaMs: 0})
    assert.equal(typeof cancelar, 'function')
    // una segunda llamada mientras corre no arranca otra precarga
    precargarEnSegundoPlano({esperaMs: 0, pausaMs: 0})
    await new Promise(r => setTimeout(r, 120))
    assert.deepEqual(pedidas.filter(k => k !== 'ajustes' && k !== 'rutas'), ORDEN_PRECARGA.filter(k => k !== 'ajustes' && k !== 'rutas'))
    assert.equal(new Set(pedidas).size, pedidas.length, 'ninguna pantalla se pide dos veces')
    assert.ok(pedidas.includes('priv'), 'la última también se baja, para que ande sin conexión')
    cancelar()
  } finally {
    Object.assign(IMPORTADORES, originales)
  }
})
test('precarga: cancelar antes de la espera no baja nada', async () => {
  const pedidas = []
  const originales = {...IMPORTADORES}
  for (const k of Object.keys(IMPORTADORES))
    IMPORTADORES[k] = async () => {
      pedidas.push(k)
      return {default: () => null}
    }
  try {
    const cancelar = precargarEnSegundoPlano({esperaMs: 50, pausaMs: 0})
    cancelar()
    await new Promise(r => setTimeout(r, 120))
    assert.deepEqual(pedidas, [])
  } finally {
    Object.assign(IMPORTADORES, originales)
  }
})

// ---------- arquitectura: qué va en el paquete principal ----------
test('solo ui/pantallas.js importa las pantallas diferidas; nadie más las trae de forma estática', () => {
  const pesadas = /from '[^']*features\/(entreno\/Entreno|comidas\/Comidas|progreso\/Progreso|ajustes\/Ajustes|bienestar\/Bienestar|rutas\/Rutas)'/
  const sueltos = archivos('src').filter(f => pesadas.test(readFileSync(f, 'utf8')))
  assert.deepEqual(sueltos, [], 'importar estas pantallas de forma estática las devuelve al paquete principal')
  const reg = leer('src/ui/pantallas.js')
  for (const k of ['entreno', 'comidas', 'progreso', 'rutas', 'ajustes', 'priv'])
    assert.match(reg, new RegExp(`${k}: \\(\\) => import\\('\\.\\./features/`))
})
test('Hoy no arrastra Comidas, Coach ni Pilares: usa los archivos chicos', () => {
  const h = leer('src/features/hoy/Hoy.jsx')
  assert.match(h, /from '\.\.\/comidas\/FilaAlimentacion'/)
  assert.match(h, /from '\.\.\/coach\/Preparacion'/)
  assert.match(h, /from '\.\.\/progreso\/AvisoDescarga'/)
  assert.doesNotMatch(h, /comidas\/Comidas|coach\/Coach|progreso\/Pilares/)
})
test('cada componente compartido se define en un solo archivo (sin copias)', () => {
  const todos = archivos('src').map(f => [f, readFileSync(f, 'utf8')])
  const defs = nombre =>
    todos
      .filter(([, t]) => new RegExp(`export (default )?function ${nombre}\\b`).test(t))
      .map(([f]) => f.replaceAll('\\', '/'))
  assert.deepEqual(defs('FilaAlimentacion'), ['src/features/comidas/FilaAlimentacion.jsx'])
  assert.deepEqual(defs('Preparacion'), ['src/features/coach/Preparacion.jsx'])
  assert.deepEqual(defs('AvisoDescarga'), ['src/features/progreso/AvisoDescarga.jsx'])
  assert.deepEqual(defs('CajaDescarga'), ['src/features/progreso/AvisoDescarga.jsx'])
  const coach = leer('src/features/coach/Coach.jsx')
  assert.match(coach, /from '\.\/prep'/)
  assert.doesNotMatch(coach, /async function cargarPrep|const calcPrep =/)
})
test('App: Hoy va en el paquete principal; el resto por <Pantalla>, y se precarga al abrir', () => {
  const app = leer('src/App.jsx')
  assert.match(app, /import Hoy from '\.\/features\/hoy\/Hoy'/)
  for (const k of ['entreno', 'comidas', 'progreso', 'ajustes', 'priv'])
    assert.match(app, new RegExp(`<Pantalla clave="${k}"`))
  assert.match(app, /precargarEnSegundoPlano\(\)/)
  assert.match(app, /BarraReloj/)
})
test('Pantalla: «Cargando» accesible, aviso con Reintentar y Actualizar, y los fallos de dibujo no se tapan', () => {
  const p = leer('src/ui/Pantalla.jsx')
  assert.match(p, /<Suspense fallback=/)
  assert.match(p, /role="status" aria-live="polite" aria-busy="true"/)
  assert.match(p, /role="alert"/)
  assert.match(p, /Reintentar/)
  assert.match(p, /onClick=\{actualizarAhora\}/)
  assert.match(p, /if \(!\(error instanceof ErrorDeCarga\)\) throw error/)
  assert.match(p, /key=\{intento\}/)
  assert.match(p, /error\.recargar \? \(\) => location\.reload\(\)/)
})
test('el reintento pide el archivo con otra dirección (?r=) porque el navegador recuerda el fallo', () => {
  const r = leer('src/ui/pantallas.js')
  assert.match(r, /urlDeReintento\(urlDeFallo\(causa\), n\)/)
  assert.match(r, /@vite-ignore/)
  assert.match(r, /repetir: e => !!urlDeFallo\(e\)/)
})
test('la lógica de carga no depende de React ni de la red (dominio puro)', () => {
  const c = leer('src/domain/carga.js')
  assert.doesNotMatch(c, /from 'react'|navigator|fetch\(|document\./)
})

// ---------- sin conexión y arranque ----------
test('el service worker guarda cada archivo la primera vez y nunca guarda una respuesta HTML como archivo', () => {
  const sw = leer('public/sw.js')
  assert.match(sw, /if\(!nav&&m\)return m/)
  assert.match(sw, /!tipo\.includes\('text\/html'\)/)
  assert.match(sw, /u\.origin!==self\.location\.origin/)
})
test('el diagnóstico de arranque de index.html sigue intacto', () => {
  const h = leer('index.html')
  assert.match(h, /La app no arrancó/)
  assert.match(h, /unhandledrejection/)
  assert.match(h, /id="rep"/)
  assert.match(h, /type="module" src="\/src\/main\.jsx"/)
})
test('la carga diferida no suma colores sueltos: el CSS nuevo usa solo tokens', () => {
  const css = leer('src/styles.css')
  const i = css.indexOf('Pantallas con carga diferida (Entrega 28)')
  assert.ok(i > 0)
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.slice(i)))
})

// ---------- D5: historial de rutas en Progreso ----------
test('D5: Progreso tiene la pestaña «Rutas», abre en la pedida y cae en Pilares si no existe', () => {
  const p = leer('src/features/progreso/Progreso.jsx')
  assert.match(p, /\['rutas', 'Rutas'\]/)
  assert.match(p, /Progreso\(\{subInicial\}\)/)
  assert.match(p, /PESTANAS\.some\(\(\[k\]\) => k === subInicial\) \? subInicial : 'pilares'/)
  assert.match(p, /sub === 'rutas' && <Pantalla clave="rutas"/)
})
test('D5: Hoy ya no muestra el historial; «Ver mis rutas» lleva a Progreso › Rutas', () => {
  const act = leer('src/features/actividad/ActividadFisica.jsx')
  assert.doesNotMatch(act, /from '\.\.\/rutas\/Rutas'|<Rutas/)
  assert.match(act, /onVerRutas/)
  assert.match(act, /Ver mis rutas/)
  assert.match(leer('src/features/hoy/Hoy.jsx'), /<ActividadFisica onVerRutas=\{onRutas\}/)
  const app = leer('src/App.jsx')
  assert.match(app, /onRutas=\{\(\) => ir\('progreso', 'rutas'\)\}/)
  assert.match(app, /subInicial=\{subProgreso\}/)
  // tocar «Progreso» en la barra inferior sigue abriendo en Pilares
  assert.match(app, /onClick=\{\(\) => ir\(k\)\}/)
})
test('D5: Rutas ya no tiene el interruptor «Ver mis rutas» y sigue con importar/exportar GPX y mapa tras el toque', () => {
  const r = leer('src/features/rutas/Rutas.jsx')
  assert.doesNotMatch(r, /abierto|Ocultar mis rutas|version = 0/)
  assert.match(r, /Importar GPX/)
  assert.match(r, /Exportar GPX/)
  assert.match(r, /verMapa \?/)
})
test('privacidad: los servicios siguen sin tocar rutas, mapa ni GPX tras mover la pantalla', () => {
  for (const f of archivos('src/services'))
    assert.doesNotMatch(readFileSync(f, 'utf8'), /data\/rutas|domain\/rutas|domain\/gpx|domain\/mapa|db\.rutas/, f)
})

test('versión 0.29.0 / entrega 28', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.29.0')
  assert.equal(pkg.entrega, '28')
  assert.match(leer('package-lock.json'), /"version": "0\.29\.0"/)
})
