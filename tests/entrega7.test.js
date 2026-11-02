// Entrega 7: check-in subjetivo, preparación v2, peso y composición.
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import {
  preparacion,
  puntajeSubjetivo,
  puntajeSueno,
  suenoHabitual,
  puntajeHabitos,
  recomendacion,
  PESOS
} from '../src/domain/preparacion.js'
import {
  normalizarMedida,
  validarMedida,
  promedioVentana,
  tendencia,
  objetivo,
  proteinaObjetivo,
  edadDe,
  ultima
} from '../src/domain/cuerpo.js'
import {checkinHecho, constanciaSemanal} from '../src/domain/checkin.js'
import {sumaDias} from '../src/domain/stats.js'
import {AJUSTES} from '../src/domain/backup.js'

const HOY = '2026-11-02'
const mem = {mv_key: 'CLAVE-SECRETA', mv_altura: '178', mv_pesoobj: '80'}
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => mem[k] ?? null,
    setItem: (k, v) => {
      mem[k] = String(v)
    },
    removeItem: k => {
      delete mem[k]
    }
  }
})

test('pesos de la preparación v2 suman 1 y son 40/30/20/10', () => {
  assert.deepEqual(PESOS, {subjetivo: 0.4, sueno: 0.3, carga: 0.2, habitos: 0.1})
  assert.ok(Math.abs(Object.values(PESOS).reduce((a, b) => a + b, 0) - 1) < 1e-9)
})

test('subjetivo: todo bien = 100, todo mal = 0, el dolor se invierte, con un solo dato ya puntúa', () => {
  assert.equal(puntajeSubjetivo({energia: 5, animo: 5, dolor: 1}).p, 100)
  assert.equal(puntajeSubjetivo({energia: 1, animo: 1, dolor: 5}).p, 0)
  assert.equal(puntajeSubjetivo({energia: 3, animo: 3, dolor: 3}).p, 50)
  assert.equal(puntajeSubjetivo({dolor: 5}).p, 0)
  assert.equal(puntajeSubjetivo({dolor: 5}).n, 1)
  assert.equal(puntajeSubjetivo({energia: null, animo: '', dolor: undefined}), null)
  assert.equal(puntajeSubjetivo({energia: 9}), null, 'fuera de 1 a 5 no cuenta')
  assert.equal(puntajeSubjetivo(undefined), null)
})

const sueno = (n, h) =>
  Array.from({length: n}, (_, i) => ({fecha: sumaDias(HOY, -(i + 1)), sueno: String(h)}))

test('sueño habitual: promedio de los 28 días previos, null si hay menos de 5 días con dato', () => {
  assert.equal(suenoHabitual(sueno(4, 7), HOY), null)
  assert.equal(suenoHabitual(sueno(5, 7), HOY), 7)
  assert.equal(
    suenoHabitual([...sueno(6, 6), {fecha: HOY, sueno: '9'}], HOY),
    6,
    'hoy no cuenta en su propio promedio'
  )
  assert.equal(suenoHabitual([...sueno(6, 6), {fecha: sumaDias(HOY, -40), sueno: '2'}], HOY), 6)
})

test('sueño contra tu promedio: dormir lo habitual rinde, 2 h menos no; piso de 5 h; sin historial usa la regla absoluta', () => {
  const hist = sueno(10, 6.5)
  const p = h => puntajeSueno({sueno: String(h)}, {habitos: hist, fecha: HOY})
  assert.equal(p(6.5), 100, 'dormir tu promedio (6,5 h) es 100 aunque en absoluto sea poco')
  assert.equal(p(7.5), 100)
  assert.equal(p(4.5), 0)
  assert.ok(p(5.5) > 40 && p(5.5) < 60)
  // quien duerme siempre 4,5 h no puntúa 100 por dormir su promedio
  const poco = sueno(10, 4.5)
  assert.ok(puntajeSueno({sueno: '4.5'}, {habitos: poco, fecha: HOY}) <= 50)
  // sin historial: 8 h alto, 4 h bajo
  assert.ok(puntajeSueno({sueno: '8'}, {habitos: [], fecha: HOY}) >= 95)
  assert.equal(puntajeSueno({sueno: '4'}, {habitos: [], fecha: HOY}), 0)
  assert.equal(puntajeSueno({sueno: ''}, {habitos: hist, fecha: HOY}), null)
  // la calidad pesa 30 %
  assert.equal(puntajeSueno({sueno: '6.5', calidad: 1}, {habitos: hist, fecha: HOY}), 70)
})

test('hábitos de ayer: promedia comida y agua; con una sola cuenta esa; sin ninguna es null', () => {
  const ayer = sumaDias(HOY, -1),
    m = {metaKcal: 2200, metaAgua: 2500}
  const ambos = puntajeHabitos([{fecha: ayer, kcal: 2200}], [{fecha: ayer, agua: 1250}], HOY, m)
  assert.equal(ambos.p, 75) // (100 + 50) / 2
  assert.equal(puntajeHabitos([], [{fecha: ayer, agua: 2500}], HOY, m).p, 100)
  assert.equal(puntajeHabitos([], [], HOY, m), null)
})

test('preparación v2: comer poco ayer pesa 10 %, no 35 % como antes', () => {
  const ayer = sumaDias(HOY, -1)
  const r = preparacion({
    fecha: HOY,
    habitos: [{fecha: HOY, energia: 5, animo: 5, dolor: 1, sueno: '8', calidad: 5}],
    comidas: [{fecha: ayer, kcal: 900}] // muy por debajo: 0 en hábitos
  })
  assert.equal(r.ok, true)
  assert.equal(r.partes.habitos.p, 0)
  assert.ok(r.puntaje >= 85, 'puntaje ' + r.puntaje) // (100*.4 + 100*.3 + 0*.1)/.8 = 87,5
})

test('preparación v2: el check-in solo ya alcanza con el sueño, y trae recomendación y avisos', () => {
  const r = preparacion({
    fecha: HOY,
    habitos: [{fecha: HOY, energia: 2, animo: 3, dolor: 5, sueno: '6', calidad: 3}]
  })
  assert.equal(r.ok, true)
  assert.equal(r.confianza, 70)
  assert.ok(r.recomendacion.texto.length > 10)
  assert.ok(r.recomendacion.avisos.some(a => /Dolor muscular alto/.test(a)))
  assert.deepEqual(r.faltan.sort(), ['Carga reciente', 'Hábitos de ayer'].sort())
})

test('recomendación por tramo; sin dolor alto no hay avisos', () => {
  assert.match(recomendacion(90).texto, /apretar/)
  assert.match(recomendacion(60).texto, /normal/)
  assert.match(recomendacion(20).texto, /liviana/)
  assert.deepEqual(recomendacion(90, {dolor: 2}).avisos, [])
  assert.equal(recomendacion(90, {dolor: 4}).avisos.length, 1)
})

test('check-in: completo solo con las tres respuestas; constancia = días con check-in en 7 días', () => {
  assert.equal(checkinHecho({energia: 3, animo: 3, dolor: 1}), true)
  assert.equal(checkinHecho({energia: 3, animo: 3}), false)
  const hs = [0, 1, 2, 9].map(d => ({fecha: sumaDias(HOY, -d), energia: 3, animo: 3, dolor: 3}))
  assert.equal(constanciaSemanal(hs, HOY, sumaDias), 3)
})

test('medida: acepta coma decimal, ignora vacíos y valida rangos', () => {
  const m = normalizarMedida({peso: '78,4', grasa: '18,5', musculo: '', bmr: '1710.6'}, HOY)
  assert.deepEqual(m, {fecha: HOY, estandar: true, peso: 78.4, grasa: 18.5, bmr: 1711})
  assert.equal(validarMedida(m), null)
  assert.match(validarMedida({fecha: HOY, estandar: true}), /peso/i)
  assert.match(validarMedida({fecha: HOY, peso: 784}), /Peso/)
  assert.match(validarMedida({fecha: HOY, peso: 78, grasa: 180}), /Grasa/)
  assert.match(validarMedida({fecha: '', peso: 78}), /fecha/i)
})

const pesos = (pares, extra = {}) =>
  pares.map(([d, peso]) => ({fecha: sumaDias(HOY, d), peso, ...extra}))

test('tendencia: promedio de 7 días contra hace 4 semanas', () => {
  const ms = pesos([
    [-30, 82],
    [-28, 81.6],
    [-3, 79.2],
    [0, 78.8]
  ])
  const t = tendencia(ms, HOY)
  assert.equal(t.actual, 79)
  assert.equal(t.hace4, 81.8)
  assert.equal(t.delta, -2.8)
  assert.equal(t.porSemana, -0.7)
  assert.equal(
    tendencia(pesos([[0, 80]]), HOY).delta,
    null,
    'sin dato de hace 4 semanas no hay delta'
  )
})

test('composición: solo cuentan las medidas hechas en tus condiciones habituales; el peso cuenta todas', () => {
  const ms = [
    {fecha: sumaDias(HOY, -1), peso: 80, grasa: 20, estandar: true},
    {fecha: HOY, peso: 82, grasa: 25, estandar: false}
  ]
  assert.equal(promedioVentana(ms, HOY, 'grasa', 7).v, 20)
  assert.equal(promedioVentana(ms, HOY, 'peso', 7).v, 81)
})

test('objetivo: cuánto falta, ritmo necesario y avisos de ritmo exigente o fecha vencida', () => {
  const ms = pesos([[-1, 80]])
  const o = objetivo({pesoObj: '76', fechaObj: sumaDias(HOY, 56), medidas: ms, fecha: HOY})
  assert.equal(o.faltan, -4)
  assert.equal(o.semanas, 8)
  assert.equal(o.ritmoNecesario, -0.5)
  assert.equal(o.exigente, false)
  const ex = objetivo({pesoObj: '70', fechaObj: sumaDias(HOY, 14), medidas: ms, fecha: HOY})
  assert.equal(ex.exigente, true)
  const v = objetivo({pesoObj: '76', fechaObj: sumaDias(HOY, -3), medidas: ms, fecha: HOY})
  assert.equal(v.vencido, true)
  assert.equal(objetivo({pesoObj: '', medidas: ms, fecha: HOY}), null)
  assert.equal(objetivo({pesoObj: '76', medidas: [], fecha: HOY}), null)
  assert.equal(objetivo({pesoObj: '80', medidas: ms, fecha: HOY}).alcanzado, true)
  assert.equal(ultima(ms).peso, 80)
})

test('proteína por kg: 1,6 g/kg redondeado a 5 g; sin peso no hay meta; acepta coma', () => {
  assert.equal(proteinaObjetivo(80), 130)
  assert.equal(proteinaObjetivo('78,4', '1,8'), 140)
  assert.equal(proteinaObjetivo(null), null)
  assert.equal(proteinaObjetivo(80, 0), null)
  assert.equal(edadDe('1990', HOY), 36)
  assert.equal(edadDe('', HOY), null)
})

test('migración v5 → v6: aparece la tabla medidas, no se pierde nada, y el check-in cabe en hábitos', async () => {
  const viejo = new Dexie('mv')
  viejo.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
  viejo.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
  viejo.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'})
  viejo.version(4).stores({coach: '&semana'})
  viejo.version(5).stores({alimentos: '++id,&clave,fuenteId', plantillas: '++id,&clave'})
  await viejo.open()
  await viejo.habitos.put({fecha: '2026-11-01', agua: 2000, sueno: '7', calidad: 4})
  await viejo.comidas.add({fecha: '2026-11-01', kcal: 700})
  await viejo.alimentos.add({nombre: 'Arroz', clave: 'arroz', fuenteId: '123'})
  viejo.close()

  const {db} = await import('../src/data/db.js')
  await db.open()
  assert.equal((await db.habitos.get('2026-11-01')).agua, 2000)
  assert.equal(await db.comidas.count(), 1)
  assert.equal((await db.alimentos.where('fuenteId').equals('123').first()).clave, 'arroz')
  assert.ok(db.tables.some(t => t.name === 'medidas'))
  await db.medidas.put({fecha: '2026-11-02', peso: 78.4, grasa: 18.5, estandar: true})
  await db.medidas.put({fecha: '2026-11-02', peso: 78.2, estandar: true}) // misma fecha: reemplaza
  assert.equal(await db.medidas.count(), 1)
  assert.equal((await db.medidas.get('2026-11-02')).peso, 78.2)
  await db.habitos.put({fecha: '2026-11-02', energia: 4, animo: 3, dolor: 2, sueno: '7'})
  assert.equal((await db.habitos.get('2026-11-02')).energia, 4)
})

test('backup: incluye medidas y el perfil/objetivo, y la clave de IA no viaja', async () => {
  const {db} = await import('../src/data/db.js')
  const {armarBackup, restaurar} = await import('../src/data/backup.js')
  for (const k of ['altura', 'nac', 'pesoobj', 'fechaobj', 'protkg'])
    assert.ok(AJUSTES.includes(k), k)
  await db.medidas.clear()
  await db.medidas.put({fecha: '2026-11-02', peso: 78.4, grasa: 18.5, estandar: true})
  const b = await armarBackup()
  assert.equal(b.medidas.length, 1)
  assert.equal(b._ajustes.altura, '178')
  assert.equal(b._ajustes.pesoobj, '80')
  assert.ok(!JSON.stringify(b).includes('CLAVE-SECRETA'))
  await db.medidas.clear()
  delete mem.mv_altura
  await restaurar(JSON.parse(JSON.stringify(b)))
  assert.equal((await db.medidas.get('2026-11-02')).grasa, 18.5)
  assert.equal(mem.mv_altura, '178')
})
