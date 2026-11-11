// Entrega 46 (v0.47.0) · lector de códigos de barras de reemplazo (ZXing en WebAssembly) para el WebView del APK.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {crearDetector, mensajePausa} from '../src/services/escaner.js'

const leer = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const conCamara = {navigator: {mediaDevices: {getUserMedia() {}}}}

test('escáner · sin BarcodeDetector pero con cámara usa la alternativa y pide solo EAN/UPC', async () => {
  let usados
  class Alt {
    static async getSupportedFormats() { return ['ean_13', 'ean_8', 'upc_a', 'qr_code'] }
    constructor(o) { usados = o.formats }
  }
  assert.ok((await crearDetector(conCamara, async () => Alt)) instanceof Alt)
  assert.deepEqual(usados, ['ean_13', 'ean_8', 'upc_a'])
})

test('escáner · la alternativa se pide solo si falta el nativo y hay cámara; si falla, el aviso de siempre', async () => {
  let pedida = 0
  const alt = async () => { pedida++; throw new Error('sin wasm') }
  await assert.rejects(crearDetector(conCamara, alt), /Tipeá el número/)
  assert.equal(pedida, 1)
  await assert.rejects(crearDetector({}, alt), /Tipeá el número/)
  assert.equal(pedida, 1)
  class Nativo { static async getSupportedFormats() { return ['ean_13'] } constructor() {} }
  await crearDetector({BarcodeDetector: Nativo, ...conCamara}, alt)
  assert.equal(pedida, 1)
  class Sin { static async getSupportedFormats() { return ['qr_code'] } }
  await assert.rejects(crearDetector({BarcodeDetector: Sin}), /EAN\/UPC/)
})

test('escáner · el .wasm sale del paquete (sin CDN), se carga de forma dinámica y lo de la Entrega 43 sigue', () => {
  const w = leer('src/services/escanerWasm.js')
  assert.match(w, /zxing_reader\.wasm\?url/)
  assert.match(w, /barcode-detector\/ponyfill/)
  assert.match(w, /locateFile/)
  assert.doesNotMatch(w, /https?:\/\//)
  const e = leer('src/services/escaner.js')
  assert.doesNotMatch(e, /^import .*escanerWasm/m)
  assert.match(e, /import\('\.\/escanerWasm\.js'\)/)
  assert.match(mensajePausa('hidden'), /pausó/)
  assert.equal(mensajePausa('visible'), null)
})

test('versión 0.47.0 · Entrega 46; Dexie v11; appId y esquema intactos; publicar.yml sin tocar', () => {
  const pkg = JSON.parse(leer('package.json'))
  assert.equal(pkg.version, '0.47.0')
  assert.equal(pkg.entrega, '46')
  assert.match(leer('CHANGELOG.md'), /^# Historial de versiones de MMV\s+## v0\.47\.0 · Entrega 46/)
  assert.match(leer('README.md'), /Entrega 46 \(v0\.47\.0\)/)
  assert.match(leer('src/data/db.js'), /version\(11\)/)
  assert.doesNotMatch(leer('src/data/db.js'), /version\(12\)/)
  assert.match(leer('capacitor.config.ts'), /online\.bribayfitness\.mmv/)
  assert.match(leer('capacitor.config.ts'), /androidScheme: 'https'/)
})
