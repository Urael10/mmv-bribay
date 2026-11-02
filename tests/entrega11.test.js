// Entrega 11: pizarra simple (revisión de la lectura, «igual que la última», bloques sin cargas, orden de entrada).
// Lógica pura: no necesita base de datos ni navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  claveEjercicio,
  pideCargas,
  lecturaASesion,
  revisionLectura,
  confirmarLectura,
  hayCarga,
  textoUltima,
  valoresDeUltima,
  elegirUltima,
  aplicarUltimas,
  ordenEntrada,
  llevaVideo,
  haySesionEnCurso
} from '../src/domain/entreno.js'
import {dejarFoto, tomarFoto} from '../src/services/pendiente.js'

test('la clave del ejercicio ignora números, * y ? (igual que antes)', () => {
  assert.equal(claveEjercicio('10 Lagartijas*'), 'lagartijas')
  assert.equal(claveEjercicio('  Remo   LM ? '), 'remo lm')
  assert.equal(claveEjercicio(null), '')
})

test('movilidad y warm up no piden cargas; los demás bloques sí', () => {
  assert.equal(pideCargas({tipo: 'movilidad'}), false)
  assert.equal(pideCargas({tipo: 'warmup'}), false)
  for (const t of ['emom', 'amrap', 'forTime', 'tabata']) assert.equal(pideCargas({tipo: t}), true)
})

test('lecturaASesion: normaliza tipos, minutos y ejercicios, y no rompe con respuestas mal armadas', () => {
  const r = lecturaASesion({
    bloques: [
      {tipo: 'Warm up', minutos: '5', ejercicios: ['Sentadilla', '  ', 'Remo?']},
      {tipo: 'EMOM', minutos: 12, ejercicios: ['A', 'B']},
      {tipo: 'For Time', minutos: 0, ejercicios: ['C']},
      {tipo: 'algo raro', ejercicios: 'no es lista'},
      null
    ]
  })
  assert.deepEqual(
    r.bloques.map(b => b.tipo),
    ['warmup', 'emom', 'forTime', 'amrap']
  )
  assert.deepEqual(r.bloques[0].ejercicios, ['Sentadilla', 'Remo?'])
  assert.equal(r.bloques[0].minutos, 5)
  assert.equal(r.bloques[2].minutos, undefined)
  assert.deepEqual(r.bloques[3].ejercicios, [])
  for (const malo of [null, undefined, {}, {bloques: 'x'}, 'texto', 5]) assert.deepEqual(lecturaASesion(malo), {bloques: []})
  assert.equal(lecturaASesion([{tipo: 'tabata', ejercicios: ['X']}]).bloques[0].tipo, 'tabata')
})

test('revisionLectura: cuenta ejercicios, dudas y videos, y marca la lectura vacía', () => {
  const R = revisionLectura([
    {tipo: 'emom', minutos: 12, ejercicios: ['Remo*', 'Press?', '', 'Sentadilla']},
    {tipo: 'tabata', ejercicios: []}
  ])
  assert.equal(R.nEjercicios, 3)
  assert.equal(R.nDudas, 1)
  assert.equal(R.nVideos, 1)
  assert.equal(R.vacia, false)
  assert.deepEqual(R.bloques[0].ejercicios[0], {texto: 'Remo', duda: false, video: true})
  assert.deepEqual(R.bloques[0].ejercicios[1], {texto: 'Press', duda: true, video: false})
  assert.equal(R.bloques[1].ejercicios.length, 0)
  assert.equal(revisionLectura([]).vacia, true)
  assert.equal(revisionLectura(undefined).vacia, true)
  assert.equal(revisionLectura([{tipo: 'emom', ejercicios: ['', ' ']}]).vacia, true)
})

test('confirmarLectura saca el «?» y conserva el «*»; no cambia la clave del ejercicio', () => {
  const b = [{tipo: 'emom', ejercicios: ['Press ?', 'Remo*?', '10 Lagartijas']}]
  const c = confirmarLectura(b)
  assert.deepEqual(c[0].ejercicios, ['Press', 'Remo*', '10 Lagartijas'])
  assert.equal(llevaVideo(c[0].ejercicios[1]), true)
  assert.equal(claveEjercicio(c[0].ejercicios[1]), claveEjercicio(b[0].ejercicios[1]))
  assert.equal(b[0].ejercicios[0], 'Press ?') // no muta la entrada
})

test('hayCarga y textoUltima', () => {
  assert.equal(hayCarga({kg: '', reps: ''}), false)
  assert.equal(hayCarga({kg: '0', reps: '0'}), false)
  assert.equal(hayCarga({kg: '20'}), true)
  assert.equal(hayCarga({repsR: '8'}), true)
  assert.equal(hayCarga(undefined), false)
  assert.equal(textoUltima({kg: 20, reps: 10}), '20 kg × 10')
  assert.equal(textoUltima({kg: 12.5, uni: true, repsL: 8, repsR: 9}), '12.5 kg × 8/9')
  assert.equal(textoUltima(null), '')
})

test('elegirUltima: prefiere el mismo tipo de bloque y, si no hay, el más reciente', () => {
  const a = [
    {id: 1, fecha: '2026-10-01', tipo: 'emom', kg: 10},
    {id: 3, fecha: '2026-10-20', tipo: 'amrap', kg: 30},
    {id: 2, fecha: '2026-10-10', tipo: 'emom', kg: 20}
  ]
  assert.equal(elegirUltima(a, 'emom').kg, 20)
  assert.equal(elegirUltima(a, 'amrap').kg, 30)
  assert.equal(elegirUltima(a, 'tabata').kg, 30)
  assert.equal(elegirUltima([], 'emom'), null)
})

test('aplicarUltimas completa solo lo que falta y no toca lo que ya cargaste', () => {
  const b = {
    tipo: 'emom',
    ejercicios: ['Sentadilla', 'Remo*', '', 'Burpee'],
    reg: {0: {kg: '', reps: ''}, 1: {kg: '40', reps: '8'}}
  }
  const mapa = {
    sentadilla: {kg: 60, reps: 10, repsL: 0, repsR: 0, uni: false},
    remo: {kg: 50, reps: 6, repsL: 0, repsR: 0, uni: false}
  }
  const r = aplicarUltimas(b, mapa)
  assert.equal(r.n, 1) // Sentadilla; Remo ya tenía datos; Burpee y el vacío no tienen registro
  assert.equal(r.reg[0].kg, 60)
  assert.equal(r.reg[0].reps, 10)
  assert.deepEqual(r.reg[1], {kg: '40', reps: '8'})
  assert.equal(r.reg[3], undefined)
  assert.equal(b.reg[0].kg, '') // no muta la entrada
  const s = aplicarUltimas(b, mapa, claveEjercicio, true)
  assert.equal(s.n, 2)
  assert.equal(s.reg[1].kg, 50)
  assert.equal(aplicarUltimas({ejercicios: ['X']}, {}).n, 0)
})

test('aplicarUltimas conserva la serie pesada y valoresDeUltima copia solo kg y reps', () => {
  const b = {ejercicios: ['Press'], reg: {0: {pkg: '80', preps: '3'}}}
  const r = aplicarUltimas(b, {press: {kg: 50, reps: 5, repsL: 0, repsR: 0, uni: false, id: 9, fecha: 'x'}})
  assert.equal(r.n, 1)
  assert.equal(r.reg[0].pkg, '80')
  assert.deepEqual(Object.keys(valoresDeUltima({kg: 1, reps: 2, id: 9, fecha: 'x', nombre: 'n'})).sort(), [
    'kg',
    'reps',
    'repsL',
    'repsR',
    'uni'
  ])
})

test('ordenEntrada: lo último que usaste va primero; por defecto, la pizarra', () => {
  assert.deepEqual(ordenEntrada(undefined), ['pizarra', 'ultima', 'plantillas'])
  assert.deepEqual(ordenEntrada(null), ['pizarra', 'ultima', 'plantillas'])
  assert.deepEqual(ordenEntrada('ultima'), ['ultima', 'pizarra', 'plantillas'])
  assert.deepEqual(ordenEntrada('plantilla'), ['plantillas', 'pizarra', 'ultima'])
  assert.deepEqual(ordenEntrada('manual'), ['pizarra', 'ultima', 'plantillas'])
  assert.deepEqual(ordenEntrada('cualquier cosa'), ['pizarra', 'ultima', 'plantillas'])
})

test('la foto elegida en Hoy se entrega una sola vez', () => {
  assert.equal(tomarFoto(), null)
  const f = {name: 'pizarra.jpg'}
  dejarFoto(f)
  assert.equal(tomarFoto(), f)
  assert.equal(tomarFoto(), null)
  dejarFoto(undefined)
  assert.equal(tomarFoto(), null)
})

test('haySesionEnCurso: el texto «null» o vacío no cuenta como sesión sin terminar', () => {
  assert.equal(haySesionEnCurso(null), false)
  assert.equal(haySesionEnCurso(''), false)
  assert.equal(haySesionEnCurso('null'), false)
  assert.equal(haySesionEnCurso('no es json'), false)
  assert.equal(haySesionEnCurso('{}'), false)
  assert.equal(haySesionEnCurso('{"bloques":[]}'), true)
  assert.equal(haySesionEnCurso('{"bloques":[{"tipo":"emom"}],"revisar":true}'), true)
})
