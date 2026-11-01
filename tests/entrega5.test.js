import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonico,
  soportaEscaner,
  crearDetector,
  leerCuadro,
  mensajeCamara,
  iniciarLectura,
  FORMATOS
} from '../src/services/escaner.js'
import {buscarCodigoOFF, gtinValido, reiniciarLimites} from '../src/services/off.js'

const resp = (j, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => j})
const UPCA = '036000291452',
  EAN = '0036000291452',
  EAN13 = '7790895000997'

test('escáner: UPC-A (12) se unifica a EAN-13; el resto queda igual', () => {
  assert.ok(gtinValido(UPCA) && gtinValido(EAN))
  assert.equal(canonico(UPCA), EAN)
  assert.equal(canonico(' 7790895000997 '), EAN13)
  assert.equal(canonico('96385074'), '96385074')
})
test('escáner: soporte según el navegador', () => {
  assert.equal(soportaEscaner({}), false)
  assert.equal(soportaEscaner({BarcodeDetector: function () {}, navigator: {}}), false)
  assert.equal(
    soportaEscaner({
      BarcodeDetector: function () {},
      navigator: {mediaDevices: {getUserMedia() {}}}
    }),
    true
  )
})
test('escáner: crearDetector pide solo formatos de alimentos y explica si no hay soporte', async () => {
  await assert.rejects(crearDetector({}), /Tipeá el número/)
  let usados
  class D {
    static async getSupportedFormats() {
      return ['qr_code', 'ean_13', 'upc_a', 'code_128']
    }
    constructor(o) {
      usados = o.formats
    }
  }
  await crearDetector({BarcodeDetector: D})
  assert.deepEqual(usados, ['ean_13', 'upc_a'])
  class Sin {
    static async getSupportedFormats() {
      return ['qr_code']
    }
  }
  await assert.rejects(crearDetector({BarcodeDetector: Sin}), /EAN\/UPC/)
  class SinLista {
    constructor(o) {
      usados = o.formats
    }
  }
  await crearDetector({BarcodeDetector: SinLista})
  assert.deepEqual(usados, FORMATOS)
})
test('escáner: leerCuadro ignora códigos con dígito de control inválido y errores de un cuadro', async () => {
  assert.equal(
    await leerCuadro({detect: async () => [{rawValue: '7790895000998'}, {rawValue: UPCA}]}, {}),
    EAN
  )
  assert.equal(await leerCuadro({detect: async () => [{rawValue: '7790895000998'}]}, {}), null)
  assert.equal(await leerCuadro({detect: async () => []}, {}), null)
  assert.equal(
    await leerCuadro(
      {
        detect: async () => {
          throw new Error('x')
        }
      },
      {}
    ),
    null
  )
})
test('escáner: iniciarLectura espera el video, reintenta, avisa una sola vez y se puede cancelar', async () => {
  const cola = []
  let visto = []
  const programar = f => {
    cola.push(f)
    return cola.length
  }
  const video = {readyState: 0}
  let n = 0
  const detector = {detect: async () => (++n < 3 ? [] : [{rawValue: EAN13}])}
  const parar = iniciarLectura({
    detector,
    video,
    alLeer: c => visto.push(c),
    programar,
    cancelar: () => {}
  })
  const correr = async () => {
    const f = cola.shift()
    await f()
  }
  await correr()
  assert.equal(n, 0, 'sin video listo no consulta')
  video.readyState = 4
  await correr()
  await correr()
  assert.deepEqual(visto, [])
  await correr()
  assert.deepEqual(visto, [EAN13])
  assert.equal(cola.length, 0, 'después de leer no vuelve a programar')
  const cola2 = []
  const p2 = iniciarLectura({
    detector: {detect: async () => []},
    video,
    alLeer: () => assert.fail(),
    programar: f => cola2.push(f),
    cancelar: () => {}
  })
  p2()
  await cola2[0]()
  assert.equal(cola2.length, 1, 'cancelado no sigue')
  parar()
})
test('escáner: mensajes de cámara en español', () => {
  assert.match(mensajeCamara({name: 'NotAllowedError'}), /permiso/)
  assert.match(mensajeCamara({name: 'NotFoundError'}), /cámara/)
  assert.match(mensajeCamara({name: 'NotReadableError'}), /otra app/)
  assert.match(mensajeCamara({message: 'hola'}), /hola/)
  assert.match(mensajeCamara(null), /Tipeá/)
})
test('OFF: un código UPC-A de 12 dígitos se consulta como EAN-13', async () => {
  reiniciarLimites()
  let url
  const r = await buscarCodigoOFF(UPCA, {
    pedir: async u => {
      url = u
      return resp({
        status: 1,
        product: {
          product_name: 'Pañuelos',
          nutriments: {
            'energy-kcal_100g': 100,
            proteins_100g: 1,
            carbohydrates_100g: 20,
            fat_100g: 2
          }
        }
      })
    }
  })
  assert.ok(url.includes('/api/v2/product/' + EAN + '.json'))
  assert.equal(r.alimento.fuenteId, EAN)
  reiniciarLimites()
})
test('OFF: un código que no existe (HTTP 404) se informa como «no encontrado», no como error del servidor', async () => {
  reiniciarLimites()
  await assert.rejects(
    buscarCodigoOFF(EAN13, {
      pedir: async () => resp({status: 0, status_verbose: 'product not found'}, 404)
    }),
    e =>
      e.tipo === 'no' &&
      /No encontré ese código/.test(e.message) &&
      !/Probá más tarde/.test(e.message)
  )
  reiniciarLimites()
  await assert.rejects(
    buscarCodigoOFF(EAN13, {pedir: async () => resp({}, 500)}),
    e => e.tipo === 'http'
  )
  reiniciarLimites()
})
test('OFF: si el código normalizado no está, prueba la variante sin el 0 y después la API v0', async () => {
  const ok = code =>
    resp({
      status: 1,
      product: {
        code,
        product_name: 'Fideos',
        nutriments: {
          'energy-kcal_100g': 350,
          proteins_100g: 12,
          carbohydrates_100g: 70,
          fat_100g: 1.5
        }
      }
    })
  reiniciarLimites()
  let urls = []
  let r = await buscarCodigoOFF(UPCA, {
    pedir: async u => {
      urls.push(u)
      return u.includes('/v2/product/' + EAN + '.json') ? resp({status: 0}, 404) : ok(UPCA)
    }
  })
  assert.equal(urls.length, 2)
  assert.ok(urls[1].includes('/v2/product/' + UPCA + '.json'))
  assert.equal(r.alimento.fuenteId, EAN, 'se guarda el código normalizado')
  reiniciarLimites()
  urls = []
  r = await buscarCodigoOFF(EAN13, {
    pedir: async u => {
      urls.push(u)
      return u.includes('/api/v0/') ? ok(EAN13) : resp({status: 0}, 404)
    }
  })
  assert.equal(urls.length, 2)
  assert.ok(urls[1].includes('/api/v0/product/' + EAN13))
  assert.equal(r.alimento.nombre, 'Fideos')
  reiniciarLimites()
  urls = []
  await assert.rejects(
    buscarCodigoOFF(UPCA, {
      pedir: async u => {
        urls.push(u)
        return resp({status: 0}, 404)
      }
    }),
    e => e.tipo === 'no' && /probé 0036000291452, 036000291452/.test(e.detalle)
  )
  assert.equal(urls.length, 3, '2 variantes en v2 + 1 en v0')
  reiniciarLimites()
})
