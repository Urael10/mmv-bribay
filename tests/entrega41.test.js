// Entrega 40 (v0.41.0) · Base de Capacitor para Android + APK de depuración en GitHub Actions, reaplicada sobre el código con registro de sueño (v0.40.0).
// (En la rama sin sueño estas pruebas se llamaban entrega38.test.js; aquí ese nombre ya lo usa la prueba de íconos de la v0.38.0.)
// Estas pruebas leen los archivos del repositorio: fijan lo que el CI y el APK necesitan para que no se rompa sin avisar.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync, readdirSync} from 'node:fs'

const url = f => new URL('../' + f, import.meta.url)
const leer = f => readFileSync(url(f), 'utf8')
const existe = f => existsSync(url(f))
const archivos = (dir, acc = []) => {
  for (const e of readdirSync(url(dir + '/'), {withFileTypes: true})) {
    const r = dir + '/' + e.name
    e.isDirectory() ? archivos(r, acc) : acc.push(r)
  }
  return acc
}
const lineasActivas = txt => txt.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))

const config = leer('capacitor.config.ts')
const campo = n => (config.match(new RegExp(n + ":\\s*'([^']*)'")) || [])[1]
const appId = campo('appId')
const workflow = leer('.github/workflows/android-debug.yml')
const pkg = JSON.parse(leer('package.json'))
const lock = JSON.parse(leer('package-lock.json'))

test('capacitor.config.ts: identidad de la app, carpeta web y esquema https', () => {
  assert.equal(appId, 'online.bribayfitness.mmv') // no se cambia una vez instalado el primer APK (ver el comentario del archivo)
  assert.match(appId, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/) // válido como paquete de Java
  assert.equal(campo('appName'), 'Mi Mejor Versión')
  assert.equal(campo('webDir'), 'dist')
  assert.equal(campo('androidScheme'), 'https') // define el origen https://localhost donde viven Dexie y localStorage
  assert.match(config, /export default config/)
})

test('el fondo de Capacitor coincide con --bg y con el theme-color de index.html', () => {
  const bg = (leer('src/tokens.css').match(/--bg:\s*(#[0-9a-fA-F]{6})/) || [])[1].toLowerCase()
  assert.equal(campo('backgroundColor').toLowerCase(), bg)
  assert.ok(leer('index.html').toLowerCase().includes(`content="${bg}"`))
})

test('barras del sistema: íconos claros sobre la app oscura y respeto de las medidas seguras', () => {
  assert.equal(campo('style'), 'DARK')
  assert.equal(campo('insetsHandling'), 'native')
  assert.equal(campo('initialViewportFitValueHint'), 'cover')
  // Capacitor lee el viewport-fit del meta de index.html; sin «cover» no pasa las medidas al CSS
  assert.match(leer('index.html'), /<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*">/)
  const css = leer('src/styles.css')
  assert.match(css, /padding-top:\s*env\(safe-area-inset-top\)/)
  assert.match(css, /padding-bottom:\s*env\(safe-area-inset-bottom\)/)
})

test('package.json: Capacitor 8 (core y android en dependencias; cli y typescript en desarrollo) y scripts nuevos', () => {
  for (const n of ['@capacitor/core', '@capacitor/android']) assert.match(pkg.dependencies[n], /^\^8\./, n)
  assert.match(pkg.devDependencies['@capacitor/cli'], /^\^8\./)
  assert.ok(pkg.devDependencies.typescript, 'el CLI necesita typescript en el proyecto para leer capacitor.config.ts')
  assert.match(pkg.scripts['cap:sync'], /npm run build && cap sync android/)
  assert.match(pkg.scripts['android:build'], /npm run cap:sync/)
  assert.match(pkg.scripts['android:build'], /gradlew assembleDebug/)
  assert.match(pkg.scripts.test, /tests\/\*\*\/\*\.test\.js/) // incluye tests/platform/
  assert.equal(pkg.scripts.build, 'vite build')
})

test('el lockfile deja core, android y cli de Capacitor en la misma versión', () => {
  const v = n => lock.packages['node_modules/' + n].version
  assert.equal(v('@capacitor/core'), v('@capacitor/android'))
  assert.equal(v('@capacitor/core'), v('@capacitor/cli'))
  assert.match(v('@capacitor/core'), /^8\./)
  assert.ok(lock.packages['node_modules/typescript'])
})

test('vite.config.js: base relativa y salida en dist (sirve para Cloudflare Pages y para el APK)', () => {
  const v = leer('vite.config.js')
  assert.match(v, /base:\s*'\.\/'/)
  assert.doesNotMatch(v, /outDir/) // la carpeta de salida es dist, la misma que webDir
})

test('el service worker se registra solo si permiteServiceWorker() y solo desde main.jsx', () => {
  const main = leer('src/main.jsx')
  assert.match(main, /import \{permiteServiceWorker\} from '\.\/platform\/plataforma\.js'/)
  assert.match(
    main,
    /if \(permiteServiceWorker\(\)\)\s*\n\s*addEventListener\('load', \(\) => navigator\.serviceWorker\.register\('\.\/sw\.js'\)\)/
  )
  const registran = archivos('src').filter(f => /serviceWorker\s*\.\s*register/.test(leer(f)))
  assert.deepEqual(registran, ['src/main.jsx'])
  assert.ok(existe('public/sw.js')) // la PWA conserva su service worker
})

test('arquitectura: solo src/platform importa Capacitor y src/domain no conoce plugins ni UI', () => {
  for (const f of archivos('src').filter(f => /\.(js|jsx)$/.test(f) && !f.startsWith('src/platform/')))
    assert.doesNotMatch(leer(f), /@capacitor\//, f)
  for (const f of archivos('src/domain')) {
    const imports = [...leer(f).matchAll(/from '([^']+)'/g)].map(m => m[1])
    for (const i of imports) assert.match(i, /^\.\/[A-Za-z]+\.js$/, `${f} importa ${i}: domain solo puede importar módulos hermanos`)
  }
  assert.match(leer('src/platform/plataforma.js'), /from '@capacitor\/core'/)
})

test('android-debug.yml: dispara en «prueba» y a mano, y arma el APK en el orden correcto', () => {
  assert.match(workflow, /branches: \[prueba\]/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /runs-on: ubuntu-latest/)
  assert.match(workflow, /permissions:\s*\n\s*contents: read/)
  const orden = [
    'actions/checkout@',
    'actions/setup-node@',
    'actions/setup-java@',
    'npm ci',
    'npm test',
    'npm run cap:sync',
    './gradlew assembleDebug',
    'actions/upload-artifact@'
  ].map(s => workflow.indexOf(s))
  orden.forEach((p, i) => assert.ok(p > 0, 'falta el paso ' + i))
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'los pasos deben ir en este orden')
  assert.match(workflow, /working-directory: android/)
  assert.match(workflow, /android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/)
  assert.match(workflow, /if-no-files-found: error/)
})

test('el JDK del workflow alcanza para el Java que genera Capacitor', () => {
  const pedido = Number(leer('android/app/capacitor.build.gradle').match(/JavaVersion\.VERSION_(\d+)/)[1])
  const jdk = Number(workflow.match(/java-version:\s*(\d+)/)[1])
  assert.ok(pedido >= 17)
  assert.ok(jdk >= pedido, `el workflow usa JDK ${jdk} pero Capacitor compila para Java ${pedido}`)
  assert.match(workflow, /distribution: temurin/)
})

test('el Node del workflow cumple lo que exige el CLI de Capacitor', () => {
  const exige = Number(lock.packages['node_modules/@capacitor/cli'].engines.node.match(/(\d+)/)[1])
  const node = Number(workflow.match(/node-version:\s*(\d+)/)[1])
  assert.ok(node >= exige, `el workflow usa Node ${node} y el CLI pide ${exige}`)
  assert.ok(Number(leer('.node-version').trim()) >= exige)
  assert.match(leer('.github/workflows/publicar.yml'), /node-version: 22/)
})

test('android/: appId, paquete de MainActivity y nombre coinciden con capacitor.config.ts', () => {
  const g = leer('android/app/build.gradle')
  assert.match(g, new RegExp(`namespace = "${appId.replaceAll('.', '\\.')}"`))
  assert.match(g, new RegExp(`applicationId "${appId.replaceAll('.', '\\.')}"`))
  const ruta = `android/app/src/main/java/${appId.replaceAll('.', '/')}/MainActivity.java`
  assert.ok(existe(ruta), 'falta ' + ruta)
  assert.match(leer(ruta), new RegExp(`package ${appId.replaceAll('.', '\\.')};`))
  assert.match(leer('android/app/src/main/res/values/strings.xml'), /<string name="app_name">Mi Mejor Versión<\/string>/)
  assert.match(leer('android/capacitor.settings.gradle'), /node_modules\/@capacitor\/android\/capacitor/)
  assert.match(leer('android/app/src/main/AndroidManifest.xml'), /android\.permission\.INTERNET/)
})

test('android/: wrapper de Gradle, firma de depuración fija y versión tomada de package.json', () => {
  for (const f of ['android/gradlew', 'android/gradle/wrapper/gradle-wrapper.jar', 'android/gradle/wrapper/gradle-wrapper.properties'])
    assert.ok(existe(f), 'falta ' + f)
  assert.ok(existe('android/app/debug.keystore'))
  const g = leer('android/app/build.gradle')
  assert.match(g, /signingConfigs\s*\{\s*debug\s*\{[^}]*storeFile file\('debug\.keystore'\)[^}]*keyAlias 'androiddebugkey'/)
  assert.match(g, /rootProject\.file\('\.\.\/package\.json'\)/)
  assert.match(g, /versionCode codigoVersion/)
  assert.match(g, /versionName pkgVersion/)
  // el binario es un almacén PKCS12 (empieza con una secuencia ASN.1, no es un archivo de texto)
  assert.equal(readFileSync(url('android/app/debug.keystore'))[0], 0x30)
})

test('versionCode = mayor·10000 + menor·100 + parche: 0.41.0 → 4100 y siempre crece', () => {
  const g = leer('android/app/build.gradle')
  assert.match(
    g,
    /partesVersion\[0\]\.toInteger\(\) \* 10000 \+ partesVersion\[1\]\.toInteger\(\) \* 100 \+ partesVersion\[2\]\.toInteger\(\)/
  )
  const codigo = v => {
    const [a, b, c] = v.split('.').map(Number)
    return a * 10000 + b * 100 + c
  }
  assert.equal(codigo('0.38.0'), 3800)
  assert.equal(codigo('0.41.0'), 4100)
  const versiones = ['0.37.0', '0.38.0', '0.38.1', '0.39.0', '0.40.0', '0.41.0', '0.99.9', '1.0.0']
  for (let i = 1; i < versiones.length; i++) assert.ok(codigo(versiones[i]) > codigo(versiones[i - 1]), versiones[i])
  // el APK de la versión de Capacitor sin sueño (0.38.0 → 3800) y el código con sueño (0.40.0) quedan por debajo: se instala encima
  assert.ok(codigo(pkg.version) > codigo('0.40.0'), 'la versión debe estar por encima de la del código con sueño')
})

test('los .gitignore no tapan lo que el CI necesita y sí dejan afuera lo que se genera', () => {
  const raiz = lineasActivas(leer('.gitignore'))
  assert.ok(raiz.includes('node_modules') && raiz.includes('dist'))
  for (const l of raiz) assert.doesNotMatch(l, /android|keystore|\.jar|gradle/, 'el .gitignore de la raíz tapa algo de Android: ' + l)
  const a = lineasActivas(leer('android/.gitignore'))
  for (const generado of ['build/', 'capacitor-cordova-android-plugins', 'app/src/main/assets/public', 'app/src/main/assets/capacitor.config.json'])
    assert.ok(a.includes(generado), 'android/.gitignore debe ignorar ' + generado)
  for (const l of a) assert.doesNotMatch(l, /keystore|\.jar|\.jks/, 'android/.gitignore tapa un archivo que el CI necesita: ' + l)
})

test('publicar.yml (Cloudflare Pages) sigue igual: main y prueba, pruebas y build antes de publicar', () => {
  const p = leer('.github/workflows/publicar.yml')
  assert.match(p, /branches: \[main, prueba\]/)
  assert.match(p, /pages deploy dist --project-name=mmv-bribay/)
  assert.ok(p.indexOf('npm test') < p.indexOf('npm run build') && p.indexOf('npm run build') < p.indexOf('pages deploy'))
})

test('versión 0.41.0 / entrega 40 con su nota en el CHANGELOG y su sección en el README', () => {
  const [ma, mi] = pkg.version.split('.').map(Number)
  assert.ok(ma > 0 || mi >= 41, pkg.version)
  assert.ok(Number(pkg.entrega) >= 40)
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  const cl = leer('CHANGELOG.md')
  assert.match(cl, /## v0\.41\.0 · Entrega 40 · Base de Capacitor para Android reaplicada sobre el registro de sueño/)
  // las notas anteriores siguen en su lugar (no se pisó la historia)
  assert.match(cl, /## v0\.40\.0 · Entrega 39 · Registro de sueño/)
  assert.match(cl, /## v0\.39\.0 · Entrega 38 · Arreglos de las capturas del celular/)
  assert.match(cl, /## v0\.38\.0 · Entrega 37 · Íconos coherentes/)
  const readme = leer('README.md')
  assert.match(readme, /## Android \(Capacitor, v0\.41\.0\)/)
  assert.match(readme, /Entrega \d+ \(v0\.\d+\.\d+\)/)
  for (const t of ['android-debug.yml', 'cap:sync', 'src/platform', 'debug.keystore', 'JDK 21']) assert.ok(readme.includes(t), t)
})

// Lo que NO debe perderse: el registro de sueño de la entrega 39 sobrevive a la integración de Capacitor.
test('el registro de sueño sigue entero: componente, lógica, Dexie v11 y datos opcionales', () => {
  assert.ok(existe('src/features/sueno/RegistroSueno.jsx'))
  assert.ok(existe('src/features/sueno/ModoSueno.jsx'))
  const sueno = leer('src/domain/sueno.js')
  for (const f of ['horasEntre', 'duracionHM', 'duracionCorta', 'extraSiestas', 'reaplicarNoche', 'habitualNoche', 'nocheDeSesion', 'horaDeMs', 'fraccionSueno', 'OBJETIVO_SUENO_H', 'NOCHE_MIN_H', 'DURACIONES_RAPIDAS'])
    assert.match(sueno, new RegExp('export (const|function) ' + f + '\\b'), f)
  const todo = archivos('src').filter(f => /\.jsx$/.test(f)).map(leer).join('\n')
  assert.match(todo, /RegistroSueno/)
  assert.match(todo, /acosto/)
  assert.match(todo, /desperto/)
  const db = leer('src/data/db.js')
  assert.match(db, /db\.version\(11\)/)
  assert.doesNotMatch(db, /db\.version\(12\)/) // el sueño no agregó tabla; Capacitor tampoco toca Dexie
})
