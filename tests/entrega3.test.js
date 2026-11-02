import test from 'node:test'
import assert from 'node:assert/strict'
import {
  preparacion,
  puntajeSueno,
  puntajeCarga,
  puntajeAlimentacion,
  puntajeHidratacion,
  cargaSesion,
  etiqueta
} from '../src/domain/preparacion.js'
import {
  informeSemana,
  hayDatos,
  textoInforme,
  cuerpoCoach,
  limpiarCoach,
  P_COACH
} from '../src/domain/informe.js'
import {sumaDias, lunes} from '../src/domain/stats.js'
import {pedirIA} from '../src/services/ia.js'

const HOY = '2026-10-31' // sábado
const ses = (fecha, rpe = 7, min = 40) => ({fecha, rpe, bloques: [{minutos: min}]})

test('sueño: 8 h y calidad 4/5 es alto; 4 h es bajo; sin dato es null', () => {
  assert.ok(puntajeSueno({sueno: '8', calidad: 4}) >= 90)
  assert.ok(puntajeSueno({sueno: '4', calidad: 1}) <= 5)
  assert.equal(puntajeSueno({sueno: ''}), null)
  assert.equal(puntajeSueno(undefined), null)
  assert.equal(puntajeSueno({sueno: '7,5', calidad: 3}) > 0, true, 'acepta coma decimal')
  assert.ok(puntajeSueno({sueno: '7', calidad: 5}) > puntajeSueno({sueno: '5', calidad: 5}))
})

test('carga: sin 14 días de historia o sin sesiones no se puntúa', () => {
  assert.equal(puntajeCarga([], HOY), null)
  assert.equal(puntajeCarga([ses(sumaDias(HOY, -3))], HOY), null)
})
test('carga: semana igual al promedio = zona estable (100); pico fuerte baja; semana muy floja baja', () => {
  const base = [-27, -24, -20, -17, -13, -10, -6, -3].map(d => ses(sumaDias(HOY, d))) // ritmo parejo
  const est = puntajeCarga(base, HOY)
  assert.equal(est.p, 100, 'razón ' + est.razon)
  const pico = [
    ...base.filter(s => s.fecha < sumaDias(HOY, -6)),
    ...[-6, -5, -4, -3, -2, -1, 0].map(d => ses(sumaDias(HOY, d), 9, 90))
  ]
  assert.ok(puntajeCarga(pico, HOY).p < 60, 'pico')
  const flojo = [...base.filter(s => s.fecha < sumaDias(HOY, -6)), ses(sumaDias(HOY, -27), 7, 40)]
  assert.ok(puntajeCarga(flojo, HOY).p < 100)
})
test('carga de sesión: RPE × minutos, y 45 min si no hay minutos', () => {
  assert.equal(cargaSesion({rpe: 7, bloques: [{minutos: 20}, {minutos: 10}]}), 210)
  assert.equal(cargaSesion({rpe: 6, bloques: []}), 270)
})
test('alimentación: ayer dentro de ±15% de la meta = 100; muy lejos = 0; sin comidas ayer = null', () => {
  const ayer = sumaDias(HOY, -1)
  assert.equal(puntajeAlimentacion([{fecha: ayer, kcal: 2300}], HOY, 2200).p, 100)
  assert.equal(puntajeAlimentacion([{fecha: ayer, kcal: 900}], HOY, 2200).p, 0)
  assert.equal(puntajeAlimentacion([{fecha: HOY, kcal: 2200}], HOY, 2200), null)
  assert.equal(puntajeAlimentacion([{fecha: ayer, kcal: 2000}], HOY, 0), null)
})
test('hidratación: ayer / meta, tope 100', () => {
  const ayer = sumaDias(HOY, -1)
  assert.equal(puntajeHidratacion([{fecha: ayer, agua: 1250}], HOY, 2500).p, 50)
  assert.equal(puntajeHidratacion([{fecha: ayer, agua: 4000}], HOY, 2500).p, 100)
  assert.equal(puntajeHidratacion([], HOY, 2500), null)
})
test('preparación v2: con menos de 2 componentes no calcula y dice qué falta', () => {
  const r = preparacion({fecha: HOY, habitos: [{fecha: HOY, sueno: '8', calidad: 4}]})
  assert.equal(r.ok, false)
  assert.ok(r.faltan.includes('Hábitos de ayer'))
  assert.ok(r.faltan.includes('Cómo te sentís'))
})
test('preparación v2: reparte los pesos 40/30/20/10 entre los componentes con datos y informa la confianza', () => {
  const ayer = sumaDias(HOY, -1)
  const habs = [
    {fecha: HOY, sueno: '8', calidad: 5, energia: 5, animo: 5, dolor: 1},
    {fecha: ayer, agua: 2500}
  ]
  const r = preparacion({fecha: HOY, habitos: habs})
  assert.equal(r.ok, true)
  assert.equal(r.confianza, 80) // subjetivo 40 + sueño 30 + hábitos 10
  assert.ok(r.puntaje >= 95)
  assert.deepEqual(r.faltan, ['Carga reciente'])
  const todo = preparacion({
    fecha: HOY,
    habitos: habs,
    comidas: [{fecha: ayer, kcal: 2200}],
    sesiones: [-27, -24, -20, -17, -13, -10, -6, -3].map(d => ses(sumaDias(HOY, d)))
  })
  assert.equal(todo.confianza, 100)
  assert.equal(todo.puntaje, 100)
})
test('preparación: mal sueño y exceso de carga dan un puntaje bajo', () => {
  const base = [-27, -24, -20, -17, -13].map(d => ses(sumaDias(HOY, d))),
    pico = [-5, -4, -3, -2, -1].map(d => ses(sumaDias(HOY, d), 9, 90))
  const r = preparacion({
    fecha: HOY,
    habitos: [{fecha: HOY, sueno: '4.5', calidad: 2}],
    sesiones: [...base, ...pico]
  })
  assert.equal(r.ok, true)
  assert.ok(r.puntaje < 50, 'puntaje ' + r.puntaje)
  assert.equal(r.etiqueta.c, 'down')
})
test('etiquetas por tramo', () => {
  assert.equal(etiqueta(80).c, 'up')
  assert.equal(etiqueta(60).c, '')
  assert.equal(etiqueta(20).c, 'down')
})

// ---- informe ----
const L = lunes(HOY),
  reg = (fecha, id, o = {}) => ({
    id,
    fecha,
    clave: o.clave || 'sentadilla',
    nombre: o.nombre || 'Sentadilla',
    tipo: 'amrap',
    kg: o.kg ?? 40,
    reps: o.reps ?? 10,
    sesionId: 1
  })
test('informe: cuenta sesiones, carga, volumen y compara con la semana anterior', () => {
  const i = informeSemana({
    desde: L,
    sesiones: [ses(L, 7, 60), ses(sumaDias(L, 2), 8, 30), ses(sumaDias(L, -7), 6, 60)],
    registros: [
      reg(sumaDias(L, -7), 1, {kg: 40, reps: 10}),
      reg(L, 2, {kg: 50, reps: 10}),
      reg(sumaDias(L, 2), 3, {kg: 50, reps: 10})
    ]
  })
  assert.equal(i.entreno.sesiones, 2)
  assert.equal(i.entreno.dias, 2)
  assert.equal(i.entreno.rpeMedio, 7.5)
  assert.equal(i.entreno.carga, 7 * 60 + 8 * 30)
  assert.equal(i.entreno.cargaVsAnterior, Math.round(((660 - 360) / 360) * 100))
  assert.equal(i.entreno.reps, 20)
  assert.equal(i.entreno.tonelaje, 1000)
  assert.equal(i.entreno.tonelajeVsAnterior, 150)
  assert.equal(i.entreno.patrones.Rodilla, 20)
  assert.deepEqual(i.entreno.records, ['Sentadilla'], '50 kg supera los 40 kg previos')
})
test('informe: hábitos y comidas (promedios solo con días que tienen dato)', () => {
  const i = informeSemana({
    desde: L,
    metaKcal: 2000,
    metaAgua: 2500,
    habitos: [
      {fecha: L, agua: 2500, sueno: '7', calidad: 4},
      {fecha: sumaDias(L, 1), agua: 1500, sueno: '5', calidad: 2},
      {fecha: sumaDias(L, 2), agua: 0, sueno: ''}
    ],
    comidas: [
      {fecha: L, kcal: 1000, p: 50},
      {fecha: L, kcal: 1000, p: 40},
      {fecha: sumaDias(L, 1), kcal: 1500, p: 60},
      {fecha: sumaDias(L, 9), kcal: 5000, p: 1}
    ]
  })
  assert.deepEqual(i.sueno, {diasConDato: 2, horasMedias: 6, calidadMedia: 3, diasMenosDe6h: 1})
  assert.deepEqual(i.agua, {diasConDato: 2, mlMedios: 2000, diasMeta: 1, meta: 2500})
  assert.equal(i.comida.diasConDato, 2)
  assert.equal(i.comida.kcalMedias, 1750)
  assert.equal(i.comida.diasEnRango, 1)
})
test('informe: semana vacía → hayDatos false, sin NaN y el texto no se rompe', () => {
  const i = informeSemana({desde: L})
  assert.equal(hayDatos(i), false)
  const t = textoInforme(i)
  assert.ok(!/NaN|undefined|null/.test(t), t)
  assert.ok(t.includes('sin datos'))
})
test('informe: el texto incluye al coach cuando existe', () => {
  const i = informeSemana({desde: L, sesiones: [ses(L)]}),
    t = textoInforme(i, {
      resumen: 'Buena semana.',
      logros: ['a'],
      mejoras: ['b'],
      plan: ['c'],
      alerta: 'd'
    })
  for (const s of ['Buena semana.', 'Bien: a', 'A mejorar: b', 'Plan: c', 'Ojo: d'])
    assert.ok(t.includes(s), s)
})

// ---- coach ----
test('coach: lo que se envía a la IA son solo números agregados (sin nombres de ejercicios ni fotos) y trae las reglas', () => {
  const i = informeSemana({
    desde: L,
    sesiones: [ses(L)],
    registros: [
      reg(sumaDias(L, -7), 1, {nombre: 'Peso muerto secreto', clave: 'pms', kg: 40}),
      reg(L, 2, {nombre: 'Peso muerto secreto', clave: 'pms', kg: 60})
    ]
  })
  assert.deepEqual(i.entreno.records, ['Peso muerto secreto'], 'hay un récord con ese nombre')
  const c = JSON.parse(
      cuerpoCoach(i, {ok: true, puntaje: 70, confianza: 85, partes: {sueno: {p: 80}}})
    ),
    t = c.contents[0].parts[0].text
  assert.ok(t.startsWith(P_COACH))
  assert.ok(t.includes('preparacionHoy'))
  assert.ok(!t.includes('secreto'), 'no manda nombres')
  assert.ok(t.includes('"recordsBatidos":1'))
  assert.equal(c.generationConfig.responseMimeType, 'application/json')
  assert.equal(JSON.stringify(c).includes('inline_data'), false)
})
test('coach: limpia la respuesta (largos, cantidades, HTML, tipos raros) y rechaza respuestas vacías', () => {
  const r = limpiarCoach({
    resumen: '<b>Hola</b>',
    logros: ['a', 'b', 'c', 'd'],
    mejoras: 'no es lista',
    plan: [1, null, 'x'.repeat(500)],
    alerta: 7
  })
  assert.equal(r.resumen, 'bHola/b')
  assert.equal(r.logros.length, 3)
  assert.deepEqual(r.mejoras, [])
  assert.equal(r.plan[1].length, 160)
  assert.equal(r.alerta, '7')
  assert.throws(() => limpiarCoach({}), /no devolvió/)
  assert.throws(() => limpiarCoach(null), /no devolvió/)
})
test('coach: usa pedirIA con reintento ante alta demanda y devuelve el JSON', async () => {
  let n = 0
  const pedir = async () => {
    n++
    return n === 1
      ? {status: 503, json: async () => ({error: {code: 503, message: 'The model is overloaded'}})}
      : {
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        resumen: 'ok',
                        logros: [],
                        mejoras: [],
                        plan: ['x'],
                        alerta: ''
                      })
                    }
                  ]
                }
              }
            ]
          })
        }
  }
  const r = await pedirIA({modelos: ['m1'], key: 'k', cuerpo: '{}', espera: async () => {}, pedir})
  assert.equal(limpiarCoach(r).plan[0], 'x')
  assert.equal(n, 2)
})
