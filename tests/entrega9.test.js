// Entrega 9: Entreno ágil (repetir sesión, plantillas, RPE por bloque, serie pesada, video grabado).
// Lógica pura: no necesita base de datos ni navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estructuraSesion,
  ultimaSesion,
  sesionDesdeUltima,
  resumenSesion,
  rutinaDesdeSesion,
  sesionDesdeRutina,
  fusionarRutina,
  rpeSugerido,
  seriePesada,
  validarSeriePesada,
  videosPendientes,
  llevaVideo
} from '../src/domain/entreno.js'
import {e1rm, kgMax, marcar, mejores, sumaDias} from '../src/domain/stats.js'
import {descarga} from '../src/domain/progreso.js'

const HOY = '2026-11-02'
const d = n => sumaDias(HOY, n)
const sesion = (id, dias, bloques) => ({id, fecha: d(dias), rpe: 7, bloques})
const bloqueHecho = {
  tipo: 'emom',
  minutos: 12,
  intervalo: '60',
  ejercicios: ['Sentadilla', 'Remo*'],
  reg: {0: {kg: '60', reps: '10'}, 1: {kg: '40', reps: '8'}},
  rondas: '3',
  extra: '2',
  minOk: '12',
  tiempo: 462,
  rpe: '8',
  video: true
}

test('repetir sesión: copia la estructura y NO copia pesos, rondas, tiempo, RPE ni video', () => {
  const n = sesionDesdeUltima(sesion(1, -3, [bloqueHecho]))
  assert.deepEqual(n, {bloques: [{tipo: 'emom', minutos: 12, intervalo: '60', ejercicios: ['Sentadilla', 'Remo*']}]})
  assert.equal('reg' in n.bloques[0], false)
  // no comparte referencias con la sesión original
  n.bloques[0].ejercicios.push('x')
  assert.equal(bloqueHecho.ejercicios.length, 2)
})

test('última sesión: la más reciente con ejercicios; ignora las vacías', () => {
  const vacia = sesion(3, -1, [{tipo: 'amrap', ejercicios: ['', '  ']}])
  const a = sesion(1, -10, [bloqueHecho]),
    b = sesion(2, -3, [{tipo: 'amrap', minutos: 10, ejercicios: ['Swing']}])
  assert.equal(ultimaSesion([a, vacia, b]).id, 2)
  assert.equal(ultimaSesion([vacia]), null)
  assert.equal(ultimaSesion([]), null)
  // misma fecha: gana el id mayor
  assert.equal(ultimaSesion([sesion(5, -2, b.bloques), sesion(6, -2, b.bloques)]).id, 6)
  assert.equal(resumenSesion(a), '1 bloque · 2 ejercicios')
  assert.equal(resumenSesion({bloques: [b.bloques[0], b.bloques[0]]}), '2 bloques · 2 ejercicios')
})

test('plantillas: se arman desde la sesión, validan nombre y contenido y se pueden reemplazar', () => {
  const r = rutinaDesdeSesion('  Lunes   fuerza ', [bloqueHecho, {tipo: 'amrap', ejercicios: ['']}])
  assert.equal(r.nombre, 'Lunes fuerza')
  assert.equal(r.bloques.length, 1) // el bloque sin ejercicios no se guarda
  assert.equal(r.clave, rutinaDesdeSesion('lunes FUERZA', [bloqueHecho]).clave) // mismo nombre → misma clave
  assert.equal('reg' in r.bloques[0], false)
  assert.throws(() => rutinaDesdeSesion('  ', [bloqueHecho]), /nombre/)
  assert.throws(() => rutinaDesdeSesion('X', [{tipo: 'amrap', ejercicios: []}]), /ejercicios/)
  assert.deepEqual(sesionDesdeRutina(r).bloques[0].ejercicios, ['Sentadilla', 'Remo*'])
  const f = fusionarRutina(rutinaDesdeSesion('Lunes fuerza', [bloqueHecho]), {id: 9, creado: '2026-10-01T00:00:00.000Z'})
  assert.equal(f.id, 9)
  assert.equal(f.creado, '2026-10-01T00:00:00.000Z')
  assert.equal('id' in fusionarRutina(r, undefined), false)
})

test('RPE por bloque: promedio ponderado por minutos, solo con valores entre 1 y 10', () => {
  assert.equal(rpeSugerido([]), null)
  assert.equal(rpeSugerido([{minutos: 10}, {minutos: 5, rpe: ''}]), null)
  assert.equal(rpeSugerido([{minutos: 10, rpe: '6'}, {minutos: 10, rpe: '8'}]), 7)
  assert.equal(rpeSugerido([{minutos: 30, rpe: '6'}, {minutos: 10, rpe: '10'}]), 7) // (180+100)/40 = 7
  assert.equal(rpeSugerido([{rpe: '9'}, {minutos: 5, rpe: '15'}]), 9) // sin minutos pesa 1; 15 se ignora
})

test('serie pesada: se valida y mejora el 1RM estimado sin tocar los registros viejos', () => {
  assert.deepEqual(seriePesada({pkg: '100', preps: '3'}), {kg: 100, reps: 3})
  assert.equal(seriePesada({pkg: '100'}), null)
  assert.equal(validarSeriePesada({}), null)
  assert.equal(validarSeriePesada({pkg: '100', preps: '3'}), null)
  assert.match(validarSeriePesada({pkg: '100'}), /kg y repeticiones/)
  assert.match(validarSeriePesada({preps: '3'}), /kg y repeticiones/)
  assert.match(validarSeriePesada({pkg: '100', preps: '3.5'}), /entero/)
  const viejo = {kg: 80, reps: 8} // 80 × (1 + 8/30) = 101,3
  assert.equal(e1rm(viejo), 101.3)
  const nuevo = {kg: 80, reps: 8, pkg: 100, preps: 3} // 100 × 1,1 = 110
  assert.equal(e1rm(nuevo), 110)
  assert.equal(kgMax(nuevo), 100)
  assert.equal(kgMax(viejo), 80)
  // sin serie pesada, igual que antes; con serie pesada de menos 1RM, no empeora
  assert.equal(e1rm({kg: 80, reps: 8, pkg: 60, preps: 3}), 101.3)
})

test('serie pesada en récords: la carga más alta cuenta como récord de carga', () => {
  const rs = [
    {id: 1, fecha: d(-14), clave: 'sentadilla', kg: 80, reps: 8},
    {id: 2, fecha: d(-7), clave: 'sentadilla', kg: 80, reps: 8, pkg: 100, preps: 3}
  ]
  const M = marcar(rs)
  assert.ok(M[2].flags.includes('carga'))
  assert.ok(M[2].flags.includes('1RM est.'))
  assert.equal(mejores(rs).carga.v, 100)
})

test('video grabado: lista los ejercicios con * de los últimos 14 días sin video marcado', () => {
  assert.equal(llevaVideo('Remo*'), true)
  assert.equal(llevaVideo('Remo'), false)
  const ses = [
    sesion(1, -2, [{tipo: 'emom', ejercicios: ['Remo*', 'Swing']}]),
    sesion(2, -3, [{tipo: 'emom', ejercicios: ['Clean*'], video: true}]),
    sesion(3, -20, [{tipo: 'emom', ejercicios: ['Snatch*']}])
  ]
  assert.deepEqual(videosPendientes(ses, HOY), [{fecha: d(-2), nombre: 'Remo'}])
  assert.deepEqual(videosPendientes([], HOY), [])
})

test('aviso de descarga en Hoy: usa la misma regla (2 o más señales)', () => {
  const habitos = [1, 2, 3].map(n => ({fecha: d(-n), dolor: 5, sueno: '5'}))
  const A = descarga({fecha: HOY, sesiones: [], habitos})
  assert.equal(A.sugerir, true)
  assert.equal(A.senales.length, 2)
  assert.equal(descarga({fecha: HOY, sesiones: [], habitos: habitos.slice(0, 2)}).sugerir, false)
})

test('estructura de sesión: valores por defecto y datos incompletos no rompen', () => {
  assert.deepEqual(estructuraSesion(undefined), {bloques: []})
  assert.deepEqual(estructuraSesion([{}]), {bloques: [{tipo: 'amrap', ejercicios: []}]})
})
