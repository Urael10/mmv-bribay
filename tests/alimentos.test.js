import test from 'node:test'
import assert from 'node:assert/strict'
import {
  norm,
  puntaje,
  emparejar,
  buscar,
  porGramos,
  itemDesde,
  recalcular,
  cerrar,
  totales,
  coherente,
  validarAlimento,
  itemsDesdeEscaneo,
  alimentoDesdeEtiqueta,
  momentoPorHora,
  n0,
  gramos,
  fmt
} from '../src/domain/alimentos.js'
import {SEMILLA} from '../src/data/semilla.js'
import {pedirIA} from '../src/services/ia.js'

const base = SEMILLA.map((a, i) => ({...a, id: i + 1}))
const por = n => base.find(a => a.nombre === n)

test('semilla: sin duplicados y todos los valores coherentes', () => {
  const claves = SEMILLA.map(a => norm(a.nombre))
  assert.equal(new Set(claves).size, claves.length)
  for (const a of SEMILLA) {
    assert.equal(validarAlimento(a), '', a.nombre)
    assert.ok(coherente(a), 'kcal no cuadra con macros: ' + a.nombre)
    assert.ok(a.porcion > 0, a.nombre)
  }
})
test('norm: tildes, mayúsculas y signos', () =>
  assert.equal(norm('  Brócoli, COCIDO! '), 'brocoli cocido'))
test('emparejar: nombres equivalentes', () => {
  assert.equal(emparejar(base, 'arroz blanco cocido').nombre, 'Arroz blanco cocido')
  assert.equal(emparejar(base, 'Arroz').nombre, 'Arroz blanco cocido')
  assert.equal(emparejar(base, 'papas hervidas')?.nombre, 'Papa hervida')
  assert.equal(
    emparejar(base, 'pechuga de pollo grillada'),
    null,
    'grillada no es lo mismo que cocida: no debe emparejar solo'
  )
  assert.equal(emparejar(base, 'tomates').nombre, 'Tomate')
  assert.equal(emparejar(base, 'huevo').nombre, 'Huevo entero cocido')
})
test('emparejar: NO confunde platos distintos', () => {
  assert.equal(emparejar(base, 'arroz con pollo'), null)
  assert.equal(emparejar(base, 'salsa de tomate'), null)
  assert.equal(emparejar(base, 'queso rallado'), null)
  assert.equal(emparejar([], 'arroz'), null)
  assert.equal(emparejar(base, ''), null)
})
test('buscar: texto parcial, sin tildes, y lista vacía', () => {
  assert.equal(buscar(base, 'pech')[0].nombre, 'Pechuga de pollo cocida')
  assert.equal(buscar(base, 'brocoli')[0].nombre, 'Brócoli cocido')
  assert.equal(buscar(base, 'zzzz').length, 0)
  assert.equal(buscar(base, '').length, 8)
})
test('porGramos: cuentas y redondeo', () => {
  assert.deepEqual(porGramos(por('Arroz blanco cocido'), 150), {kcal: 195, p: 4.1, c: 42, gr: 0.5})
  assert.deepEqual(porGramos({kcal100: 884}, 10), {kcal: 88, p: 0, c: 0, gr: 0})
  assert.deepEqual(porGramos(por('Banana'), 0), {kcal: 0, p: 0, c: 0, gr: 0})
})
test('entradas inválidas no rompen', () => {
  assert.equal(n0('abc'), 0)
  assert.equal(n0(-5), 0)
  assert.equal(n0(NaN), 0)
  assert.equal(gramos(99999), 5000)
  assert.equal(n0('1.5'), 1.5)
  assert.equal(porGramos({kcal100: 'x'}, 'y').kcal, 0)
  assert.equal(fmt(undefined), '0')
  assert.equal(fmt(4.25), '4,3')
})
test('itemDesde / recalcular / cerrar', () => {
  const it = itemDesde(por('Banana'), 120)
  assert.equal(it.kcal, 107)
  assert.equal(it.origen, 'base')
  const r = recalcular(it, '240')
  assert.equal(r.kcal, 214)
  assert.equal(r.g, '240')
  const c = cerrar({...r, nombre: '  Banana '})
  assert.equal(c.g, 240)
  assert.equal(c.nombre, 'Banana')
  assert.equal(c.kcal, 214)
  assert.ok(!('leido' in c))
  assert.equal(recalcular(it, '').kcal, 0)
})
test('totales: suma y redondea', () => {
  const t = totales([
    itemDesde(por('Banana'), 120),
    itemDesde(por('Pechuga de pollo cocida'), 150),
    itemDesde(por('Aceite de oliva'), 10)
  ])
  assert.equal(t.kcal, 107 + 248 + 88)
  assert.equal(totales([]).kcal, 0)
  assert.equal(totales(null).kcal, 0)
})
test('coherente / validarAlimento', () => {
  assert.ok(coherente({kcal100: 130, p100: 2.7, c100: 28, g100: 0.3}))
  assert.ok(!coherente({kcal100: 500, p100: 1, c100: 5, g100: 1}))
  assert.ok(coherente({kcal100: 0, p100: 0, c100: 0, g100: 0}))
  assert.match(validarAlimento({nombre: '', kcal100: 1, p100: 0, c100: 0, g100: 0}), /nombre/)
  assert.match(validarAlimento({nombre: 'x', kcal100: 950, p100: 0, c100: 0, g100: 0}), /900/)
  assert.match(validarAlimento({nombre: 'x', kcal100: 100, p100: 60, c100: 60, g100: 0}), /100 g/)
  assert.match(validarAlimento({nombre: 'x', kcal100: -1, p100: 0, c100: 0, g100: 0}), /negativ/)
  assert.equal(validarAlimento({nombre: 'x', kcal100: 100, p100: 10, c100: 10, g100: 2}), '')
})
test('escaneo de plato: usa la base cuando coincide y la IA cuando no', () => {
  const r = {
    alimentos: [
      {
        nombre: 'arroz blanco cocido',
        gramos: 180,
        kcal100: 999,
        p100: 99,
        c100: 99,
        g100: 99,
        confianza: 'alta'
      },
      {
        nombre: 'ñoquis de papa',
        gramos: 200,
        kcal100: 130,
        p100: 3,
        c100: 27,
        g100: 1,
        confianza: 'media'
      },
      {nombre: '', gramos: 50},
      {nombre: 'algo', gramos: 0},
      null,
      {nombre: 'sin kcal', gramos: 100, p100: 10, c100: 0, g100: 5}
    ]
  }
  const it = itemsDesdeEscaneo(r, base)
  assert.equal(it.length, 3)
  assert.equal(it[0].origen, 'base')
  assert.equal(
    it[0].kcal,
    Math.round(130 * 1.8),
    'debe usar los valores de TU base, no los de la IA'
  )
  assert.equal(it[1].origen, 'ia')
  assert.equal(it[1].kcal, 260)
  assert.equal(
    it[2].b.kcal100,
    Math.round(4 * 10 + 9 * 5),
    'si la IA no da kcal se derivan de los macros'
  )
  assert.equal(it[2].confianza, 'media')
  assert.deepEqual(itemsDesdeEscaneo({alimentos: 'x'}, base), [])
  assert.deepEqual(itemsDesdeEscaneo(null, base), [])
  assert.equal(
    itemsDesdeEscaneo(
      {alimentos: Array.from({length: 50}, (_, i) => ({nombre: 'a' + i, gramos: 10}))},
      base
    ).length,
    20
  )
})
test('etiqueta: convierte a 100 g', () => {
  const a = alimentoDesdeEtiqueta({
    nombre: 'Barra de cereal',
    base_g: 25,
    kcal: 100,
    p: 2,
    c: 17,
    g: 3,
    porcion_g: 25
  })
  assert.deepEqual([a.kcal100, a.p100, a.c100, a.g100, a.porcion], [400, 8, 68, 12, 25])
  assert.equal(alimentoDesdeEtiqueta({base_g: 100, kcal: 52, p: 0.3, c: 13.8, g: 0.2}).porcion, 100)
  assert.throws(() => alimentoDesdeEtiqueta({base_g: 0, kcal: 100}), /gramos/)
  assert.throws(() => alimentoDesdeEtiqueta({base_g: 100, kcal: 0}), /calor/)
  assert.throws(() => alimentoDesdeEtiqueta(null), /gramos/)
})
test('momento del día', () => {
  assert.deepEqual([2, 8, 13, 17, 22].map(momentoPorHora), [
    'Snack',
    'Desayuno',
    'Almuerzo',
    'Merienda',
    'Cena'
  ])
})
test('ia: mensaje de alta demanda usa la alternativa de comidas y no rompe la de pizarra', async () => {
  const f = () =>
    Promise.resolve({
      status: 503,
      json: async () => ({
        error: {code: 503, message: 'This model is currently experiencing high demand'}
      })
    })
  const base = {modelos: ['a', 'b'], key: 'k', cuerpo: '{}', espera: async () => {}, pedir: f}
  await assert.rejects(pedirIA({...base, alt: 'cargá la comida a mano'}), /cargá la comida a mano/)
  await assert.rejects(pedirIA(base), /sesión manual/)
  let n = 0
  const g = () =>
    Promise.resolve({
      status: 200,
      json: async () =>
        ++n < 3
          ? {error: {code: 503, message: 'overloaded'}}
          : {candidates: [{content: {parts: [{text: '{"ok":1}'}]}}]}
    })
  assert.deepEqual(await pedirIA({...base, pedir: g}), {ok: 1})
})
