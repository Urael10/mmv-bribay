import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alimentoDesdeOFF,
  buscarOFF,
  buscarCodigoOFF,
  gtinValido,
  esCodigo,
  soloDigitos,
  reiniciarLimites,
  LIMITES,
  ErrorOFF,
  FUENTE
} from '../src/services/off.js'
import {
  sugeridos,
  itemDeSugerido,
  porcionHabitual,
  gramosPorcion,
  multiploActual,
  plantillaDesdeItems,
  itemsDePlantilla,
  conPorcion,
  porcionDe
} from '../src/domain/registro.js'
import {coherente, validarAlimento, itemDesde, totales} from '../src/domain/alimentos.js'

const prod = (o = {}) => ({
  code: '7790895000997',
  product_name: 'Galletitas de agua',
  brands: 'Marca X, Otra',
  serving_quantity: '30',
  nutriments: {'energy-kcal_100g': 420, proteins_100g: 9.5, carbohydrates_100g: 72, fat_100g: 10.5},
  ...o
})
const resp = (j, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => j})

// ---- código de barras ----
test('GTIN: acepta códigos válidos y rechaza los mal tipeados', () => {
  assert.ok(gtinValido('7790895000997'))
  assert.ok(gtinValido('3017620422003'))
  assert.ok(gtinValido('5449000000996'))
  assert.ok(gtinValido('73513537'))
  assert.ok(!gtinValido('7790895000998'), 'último dígito mal')
  assert.ok(!gtinValido('123'))
  assert.ok(!gtinValido('12345678901234567'))
  assert.ok(!gtinValido('abc'))
  assert.ok(gtinValido('7790 8950-00997'), 'tolera espacios y guiones')
  assert.ok(esCodigo('7790895000997'))
  assert.ok(!esCodigo('pollo'))
  assert.ok(!esCodigo('1234'))
  assert.equal(soloDigitos(' 12-34 '), '1234')
})

// ---- conversión OFF → alimento ----
test('OFF: convierte un producto completo (marca, porción, fuente y código)', () => {
  const r = alimentoDesdeOFF(prod())
  assert.equal(r.ok, true)
  const a = r.alimento
  assert.equal(a.nombre, 'Galletitas de agua (Marca X)')
  assert.equal(a.kcal100, 420)
  assert.equal(a.p100, 9.5)
  assert.equal(a.c100, 72)
  assert.equal(a.g100, 10.5)
  assert.equal(a.porcion, 30)
  assert.equal(a.origen, 'web')
  assert.equal(a.fuente, FUENTE)
  assert.equal(a.fuenteId, '7790895000997')
  assert.equal(a.clave, 'galletitas de agua marca x')
  assert.deepEqual(r.avisos, [])
  assert.equal(validarAlimento(a), '')
  assert.ok(coherente(a))
})
test('OFF: números como texto, coma decimal y kJ en lugar de kcal', () => {
  const r = alimentoDesdeOFF(
    prod({
      nutriments: {
        energy_100g: '1757',
        proteins_100g: '9,5',
        carbohydrates_100g: '72',
        fat_100g: '10.5'
      }
    })
  )
  assert.equal(r.ok, true)
  assert.equal(r.alimento.kcal100, Math.round(1757 / 4.184))
  assert.equal(r.alimento.p100, 9.5)
})
test('OFF: sin calorías pero con macros → las calcula la app y avisa; sin nada → descarta', () => {
  const r = alimentoDesdeOFF(
    prod({nutriments: {proteins_100g: 10, carbohydrates_100g: 10, fat_100g: 10}})
  )
  assert.equal(r.alimento.kcal100, 170)
  assert.ok(r.avisos[0].includes('calculé'))
  assert.deepEqual(alimentoDesdeOFF(prod({nutriments: {}})), {
    ok: false,
    motivo: 'sin datos nutricionales'
  })
  assert.deepEqual(
    alimentoDesdeOFF(prod({product_name: ' ', product_name_es: '', generic_name: ''})),
    {ok: false, motivo: 'sin nombre'}
  )
})
test('OFF: descarta datos imposibles y avisa de los incoherentes', () => {
  assert.equal(
    alimentoDesdeOFF(prod({nutriments: {'energy-kcal_100g': 5000, proteins_100g: 1}})).motivo,
    'datos imposibles'
  )
  assert.equal(
    alimentoDesdeOFF(
      prod({
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 60,
          carbohydrates_100g: 60,
          fat_100g: 10
        }
      })
    ).motivo,
    'datos imposibles'
  )
  const r = alimentoDesdeOFF(
    prod({
      nutriments: {'energy-kcal_100g': 50, proteins_100g: 30, carbohydrates_100g: 30, fat_100g: 20}
    })
  )
  assert.equal(r.ok, true)
  assert.ok(r.avisos.some(a => a.includes('no cuadran')))
  assert.equal(
    alimentoDesdeOFF(prod({nutriments: {'energy-kcal_100g': -5}})).ok,
    false,
    'negativos no valen'
  )
})
test('OFF: agua (0 kcal) es válida; sin porción usa 100 g; porción absurda se ignora', () => {
  const r = alimentoDesdeOFF(
    prod({
      nutriments: {'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0},
      serving_quantity: undefined
    })
  )
  assert.equal(r.ok, true)
  assert.equal(r.alimento.porcion, 100)
  assert.equal(alimentoDesdeOFF(prod({serving_quantity: 99999})).alimento.porcion, 100)
  assert.equal(alimentoDesdeOFF(prod({brands: '', product_name: 'Leche'})).alimento.nombre, 'Leche')
  assert.equal(
    alimentoDesdeOFF(prod({product_name: 'Leche Marca X entera', brands: 'marca x'})).alimento
      .nombre,
    'Leche Marca X entera',
    'no repite la marca'
  )
})

// ---- búsqueda por nombre ----
test('búsqueda: arma la URL, no manda cabeceras propias y devuelve alimentos listos para la base', async () => {
  reiniciarLimites()
  const llamadas = []
  const pedir = async (u, o) => {
    llamadas.push([u, o])
    return resp({
      products: [
        prod(),
        prod({code: '1', product_name: 'Sin datos', nutriments: {}}),
        prod({code: '7790895000997'}),
        prod({
          code: '3017620422003',
          product_name: 'Crema',
          nutriments: {
            'energy-kcal_100g': 50,
            proteins_100g: 30,
            carbohydrates_100g: 30,
            fat_100g: 20
          }
        })
      ]
    })
  }
  const r = await buscarOFF('galletitas de agua', {pedir})
  assert.equal(llamadas.length, 1)
  const [u, o] = llamadas[0]
  assert.ok(u.startsWith('https://world.openfoodfacts.org/cgi/search.pl?'))
  assert.ok(
    u.includes('search_terms=galletitas%20de%20agua') &&
      u.includes('json=1') &&
      u.includes('fields=')
  )
  assert.ok(!o || !o.headers, 'sin cabeceras propias (evita la consulta previa de CORS)')
  assert.equal(r.items.length, 2, 'sin datos descartado y el repetido unificado')
  assert.equal(r.descartados, 1)
  assert.equal(r.items[0].alimento.fuenteId, '7790895000997', 'primero los de datos coherentes')
  assert.ok(r.items[1].avisos.length > 0)
})
test('búsqueda: acepta la respuesta de la búsqueda nueva (hits) y cae a ella si la clásica falla', async () => {
  reiniciarLimites()
  const urls = []
  const pedir = async u => {
    urls.push(u)
    if (u.includes('/cgi/search.pl')) throw new TypeError('Failed to fetch')
    return resp({hits: [prod()]})
  }
  const r = await buscarOFF('galletitas', {pedir})
  assert.equal(urls.length, 2)
  assert.ok(urls[1].startsWith('https://search.openfoodfacts.org/search?'))
  assert.equal(r.items.length, 1)
})
test('búsqueda: errores claros (sin red, límite del servidor, texto corto, respuesta ilegible)', async () => {
  reiniciarLimites()
  await assert.rejects(buscarOFF('a'), e => e instanceof ErrorOFF && e.tipo === 'texto')
  await assert.rejects(
    buscarOFF('leche', {
      pedir: async () => {
        throw new TypeError('x')
      }
    }),
    e => e.tipo === 'red' && /a mano/.test(e.message)
  )
  reiniciarLimites()
  await assert.rejects(
    buscarOFF('leche', {pedir: async () => resp({}, 503)}),
    e => e.tipo === 'limite'
  )
  reiniciarLimites()
  await assert.rejects(
    buscarOFF('leche', {pedir: async () => resp({}, 500)}),
    e => e.tipo === 'http'
  )
  reiniciarLimites()
  await assert.rejects(
    buscarOFF('leche', {
      pedir: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('x')
        }
      })
    }),
    e => e.tipo === 'http'
  )
  reiniciarLimites()
  const vacio = await buscarOFF('zzzzzz', {pedir: async () => resp({products: []})})
  assert.equal(vacio.items.length, 0)
})
test('errores de OFF: el mensaje trae el detalle de qué dirección falló y por qué', async () => {
  reiniciarLimites()
  await assert.rejects(
    buscarOFF('leche', {
      pedir: async () => {
        throw new TypeError('Failed to fetch')
      }
    }),
    e =>
      e.tipo === 'red' &&
      /Detalle:/.test(e.message) &&
      /search\.pl/.test(e.detalle) &&
      /search\.openfoodfacts\.org/.test(e.detalle) &&
      /CORS/.test(e.detalle)
  )
  reiniciarLimites()
  const ab = async () => {
    const e = new Error('abort')
    e.name = 'AbortError'
    throw e
  }
  await assert.rejects(
    buscarOFF('leche', {pedir: ab}),
    e => /tardó más de 12 s/.test(e.message) && /a tiempo/.test(e.detalle)
  )
  reiniciarLimites()
  await assert.rejects(
    buscarCodigoOFF('7790895000997', {pedir: async () => resp({}, 500)}),
    e => e.tipo === 'http' && /api\/v2\/product/.test(e.detalle) && /HTTP 500/.test(e.message)
  )
  reiniciarLimites()
})
test('límite de uso: no pasa de LIMITES.busqueda por minuto y se libera con el tiempo', async () => {
  reiniciarLimites()
  let t = 1e6
  const ahora = () => t,
    pedir = async () => resp({products: []})
  for (let i = 0; i < LIMITES.busqueda; i++) await buscarOFF('leche', {pedir, ahora})
  await assert.rejects(
    buscarOFF('leche', {pedir, ahora}),
    e => e.tipo === 'limite' && /\d+ s/.test(e.message)
  )
  t += LIMITES.ventanaMs + 1
  await buscarOFF('leche', {pedir, ahora})
  reiniciarLimites()
})

// ---- búsqueda por código ----
test('código: encuentra el producto, valida antes de consultar y distingue "no existe"', async () => {
  reiniciarLimites()
  let n = 0,
    url = ''
  const ok = await buscarCodigoOFF('7790895000997', {
    pedir: async u => {
      n++
      url = u
      return resp({status: 1, product: prod()})
    }
  })
  assert.equal(ok.alimento.fuenteId, '7790895000997')
  assert.ok(url.includes('/api/v2/product/7790895000997.json'))
  await assert.rejects(
    buscarCodigoOFF('7790895000998', {
      pedir: async () => {
        n++
      }
    }),
    e => e.tipo === 'texto' && /último dígito/.test(e.message)
  )
  assert.equal(n, 1, 'un código inválido no gasta consultas')
  await assert.rejects(
    buscarCodigoOFF('12', {
      pedir: async () => {
        n++
      }
    }),
    e => e.tipo === 'texto'
  )
  await assert.rejects(
    buscarCodigoOFF('7790895000997', {
      pedir: async () => resp({status: 0, status_verbose: 'product not found'})
    }),
    e => e.tipo === 'no' && /No encontré/.test(e.message)
  )
  await assert.rejects(
    buscarCodigoOFF('7790895000997', {
      pedir: async () =>
        resp({status: 1, product: {code: '7790895000997', product_name: 'Algo', nutriments: {}}})
    }),
    e => e.tipo === 'no' && /no sirve/.test(e.message)
  )
  const sinCode = await buscarCodigoOFF('3017620422003', {
    pedir: async () =>
      resp({
        status: 1,
        product: {
          product_name: 'Crema',
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6,
            carbohydrates_100g: 58,
            fat_100g: 31
          }
        }
      })
  })
  assert.equal(
    sinCode.alimento.fuenteId,
    '3017620422003',
    'usa el código tipeado si OFF no lo repite'
  )
})

// ---- porciones ----
test('porciones: ½ · 1 · 1½ · 2 sobre tu porción y detección del botón activo', () => {
  assert.equal(gramosPorcion(30, 0.5), 15)
  assert.equal(gramosPorcion(125, 1.5), 187.5)
  assert.equal(gramosPorcion(33, 1.5), 49.5)
  assert.equal(gramosPorcion(0, 2), 200, 'sin porción: 100 g')
  assert.equal(multiploActual(60, 30), 2)
  assert.equal(multiploActual(15, 30), 0.5)
  assert.equal(multiploActual(47, 30), null)
  assert.equal(porcionDe({id: 0, g: 40, alimentoId: 5}, [{id: 5, porcion: 25}]), 25)
  assert.equal(porcionDe({g: 40, alimentoId: null}, []), 40)
  assert.equal(porcionDe({g: 40, porcion: 30}, []), 30)
})

// ---- recientes y frecuentes ----
const it = (nombre, g, extra = {}) => ({
  alimentoId: null,
  nombre,
  g,
  b: {kcal100: 100, p100: 5, c100: 10, g100: 2},
  kcal: g,
  p: 0,
  c: 0,
  gr: 0,
  origen: 'manual',
  ...extra
})
const cm = (fecha, momento, items, hora = '08:00') => ({fecha, hora, momento, items})
const HOY = '2026-11-01'
test('sugeridos: ordena por frecuencia, momento del día y recencia; la porción es la mediana', () => {
  const cs = [
    cm('2026-10-30', 'Desayuno', [it('Pan', 50, {alimentoId: 1}), it('Café', 200)]),
    cm('2026-10-31', 'Desayuno', [it('Pan', 60, {alimentoId: 1}), it('Café', 200)]),
    cm(
      '2026-10-31',
      'Almuerzo',
      [it('Arroz', 150, {alimentoId: 2}), it('Pollo', 120, {alimentoId: 3})],
      '13:00'
    ),
    cm('2026-10-25', 'Almuerzo', [it('Arroz', 200, {alimentoId: 2})], '13:00'),
    cm('2026-11-01', 'Desayuno', [it('Pan', 70, {alimentoId: 1})])
  ]
  const des = sugeridos(cs, 'Desayuno', {hoy: HOY}),
    alm = sugeridos(cs, 'Almuerzo', {hoy: HOY})
  assert.equal(des[0].nombre, 'Pan')
  assert.equal(des[0].g, 60, 'mediana de 50, 60 y 70')
  assert.equal(alm[0].nombre, 'Arroz')
  assert.equal(alm[0].g, 175)
  assert.ok(
    des.findIndex(s => s.nombre === 'Café') < des.findIndex(s => s.nombre === 'Arroz'),
    'el café de la mañana va antes que el arroz'
  )
  assert.equal(sugeridos(cs, 'Cena', {hoy: HOY, n: 2}).length, 2)
})
test('sugeridos: ignora lo viejo (más de 90 días), nombres vacíos y agrupa por alimento', () => {
  const cs = [
    cm('2026-01-01', 'Cena', [it('Viejo', 100)]),
    cm('2026-10-30', 'Cena', [it('', 100), it('Pizza', 100), it('pizza', 100)])
  ]
  const r = sugeridos(cs, 'Cena', {hoy: HOY})
  assert.deepEqual(
    r.map(s => s.nombre),
    ['pizza']
  )
  assert.equal(r[0].veces, 2)
  assert.deepEqual(sugeridos([], 'Cena', {hoy: HOY}), [])
  assert.equal(porcionHabitual([]), 0)
})
test('sugerido → ítem: usa los valores actuales de la base; si el alimento se borró, los guardados', () => {
  const base = [{id: 1, nombre: 'Pan', kcal100: 250, p100: 8, c100: 50, g100: 2, porcion: 40}]
  const s = sugeridos(
    [cm('2026-10-30', 'Desayuno', [it('Pan', 60, {alimentoId: 1})])],
    'Desayuno',
    {hoy: HOY}
  )[0]
  const a = itemDeSugerido(s, base)
  assert.equal(a.kcal, 150)
  assert.equal(a.origen, 'base')
  assert.equal(a.g, 60)
  assert.equal(a.porcion, 40, 'los botones se basan en la porción de la base')
  const b = itemDeSugerido(s, [])
  assert.equal(b.kcal, 60)
  assert.equal(b.alimentoId, null)
  assert.equal(b.porcion, 60)
})

// ---- comidas guardadas ----
test('comida guardada: valida, normaliza y se recarga con los valores actuales', () => {
  const base = [{id: 1, nombre: 'Avena', kcal100: 370, p100: 13, c100: 60, g100: 7, porcion: 40}]
  const items = [{...itemDesde(base[0], 50, 'base')}, it('Leche', 200), {...it('Vacío', 0)}]
  const pl = plantillaDesdeItems('  Mi desayuno  de siempre ', 'Desayuno', items)
  assert.equal(pl.nombre, 'Mi desayuno de siempre')
  assert.equal(pl.clave, 'mi desayuno de siempre')
  assert.equal(pl.items.length, 2, 'sin ítems de 0 g')
  assert.throws(() => plantillaDesdeItems('', 'Desayuno', items), /nombre/)
  assert.throws(() => plantillaDesdeItems('x', 'Desayuno', [it('a', 0)]), /alimentos/)
  const nuevaBase = [{...base[0], kcal100: 400}] // corregiste la avena
  const r = itemsDePlantilla(pl, nuevaBase)
  assert.equal(r[0].kcal, 200, 'usa el valor corregido (400 × 50 g)')
  assert.equal(r[0].origen, 'base')
  assert.equal(r[1].nombre, 'Leche')
  assert.equal(r[1].kcal, 200)
  assert.equal(totales(r).kcal, 400)
  assert.equal(
    itemsDePlantilla(pl, [])[0].kcal,
    185,
    'si la avena ya no está en la base, usa lo guardado'
  )
})
test('conPorcion: toma la porción dada o los gramos del ítem', () => {
  assert.equal(conPorcion({g: 80}, 30).porcion, 30)
  assert.equal(conPorcion({g: 80}, 0).porcion, 80)
  assert.equal(conPorcion({}, 0).porcion, 100)
})
