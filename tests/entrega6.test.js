import test from 'node:test'
import assert from 'node:assert/strict'
import {
  armarSegmentos,
  posicion,
  transcurrido,
  alternar,
  aviso,
  mmss,
  aSegundos,
  duracionTotal,
  PREVIO
} from '../src/domain/temporizador.js'
import {
  diasDesde,
  avisoBackup,
  ajustesDe,
  validarBackup,
  nombreBackup
} from '../src/domain/backup.js'

test('EMOM de 12 min: previo + 12 intervalos de 60 s', () => {
  const s = armarSegmentos({tipo: 'emom', minutos: 12})
  assert.equal(s.length, 13)
  assert.equal(s[0].previo, true)
  assert.equal(s[1].l, 'Min 1/12')
  assert.equal(duracionTotal(s), PREVIO + 720)
})
test('EMOM con intervalo de 90 s redondea la cantidad de intervalos', () => {
  const s = armarSegmentos({tipo: 'emom', minutos: 12, intervalo: 90})
  assert.equal(s.length, 1 + 8)
  assert.match(s[1].l, /Intervalo 1\/8/)
})
test('Tabata por defecto: 8 × (20 + 10) = 4 minutos más el previo', () => {
  const s = armarSegmentos({tipo: 'tabata'})
  assert.equal(s.length, 17)
  assert.equal(duracionTotal(s), PREVIO + 240)
  assert.equal(s[1].s, 20)
  assert.equal(s[2].s, 10)
})
test('Tabata editable: 30/15 × 6 rondas', () => {
  const s = armarSegmentos({tipo: 'tabata', trab: 30, desc: 15, rond: 6})
  assert.equal(duracionTotal(s), PREVIO + 6 * 45)
  assert.equal(s[1].l, 'Trabajo 1/6')
})
test('For time cuenta hacia arriba con tope; AMRAP hacia abajo', () => {
  assert.equal(armarSegmentos({tipo: 'forTime', minutos: 10})[1].sube, true)
  assert.equal(armarSegmentos({tipo: 'amrap', minutos: 10})[1].sube, undefined)
})
test('Valores inválidos usan los de siempre (10 min, 60 s)', () => {
  assert.equal(duracionTotal(armarSegmentos({tipo: 'amrap', minutos: 'x'})), PREVIO + 600)
  assert.equal(armarSegmentos({tipo: 'emom', minutos: 2, intervalo: -5}).length, 1 + 2)
})
test('posicion: arranque, cambio de segmento y fin', () => {
  const s = armarSegmentos({tipo: 'emom', minutos: 2})
  const a = posicion(s, 0)
  assert.equal(a.i, 0)
  assert.equal(a.restante, PREVIO)
  const b = posicion(s, PREVIO * 1000 + 1)
  assert.equal(b.i, 1)
  assert.equal(b.restante, 60)
  const c = posicion(s, (PREVIO + 59) * 1000 + 500)
  assert.equal(c.i, 1)
  assert.equal(c.restante, 1)
  const z = posicion(s, (PREVIO + 120) * 1000)
  assert.equal(z.fin, true)
  assert.equal(z.restante, 0)
})
test('posicion del for time: trans sube', () => {
  const s = armarSegmentos({tipo: 'forTime', minutos: 10})
  const p = posicion(s, (PREVIO + 75) * 1000)
  assert.equal(p.seg.sube, true)
  assert.equal(p.trans, 75)
})
test('hora real: aunque pasen 90 s sin "ticks", la posición es correcta', () => {
  const e = alternar({ac: 0, ini: null}, 1000)
  assert.equal(transcurrido(e, 91000), 90000)
})
test('pausa y reanudación acumulan bien', () => {
  let e = alternar({ac: 0, ini: null}, 0)
  e = alternar(e, 10000) // pausa a los 10 s
  assert.equal(e.ini, null)
  assert.equal(transcurrido(e, 500000), 10000) // en pausa no corre
  e = alternar(e, 600000) // reanuda
  assert.equal(transcurrido(e, 605000), 15000)
})
test('avisos: cuenta 3-2-1, cambio de segmento y fin', () => {
  const s = armarSegmentos({tipo: 'emom', minutos: 1})
  const p = ms => posicion(s, ms)
  assert.equal(aviso(p(0), p(500)), null)
  assert.equal(aviso(p(1900), p(2100)), 'cuenta') // de 4 a 3 s restantes del previo
  assert.equal(aviso(p(4900), p(5100)), 'cambio')
  assert.equal(aviso(p(64900), p(65000)), 'fin')
  assert.equal(aviso(null, p(0)), null)
})
test('el for time no hace cuenta regresiva', () => {
  const s = armarSegmentos({tipo: 'forTime', minutos: 1})
  const p = ms => posicion(s, ms)
  assert.equal(aviso(p((PREVIO + 56) * 1000), p((PREVIO + 57) * 1000)), null)
})
test('mmss y aSegundos', () => {
  assert.equal(mmss(462), '07:42')
  assert.equal(mmss(-3), '00:00')
  assert.equal(aSegundos('7:42'), 462)
  assert.equal(aSegundos('462'), 462)
  assert.equal(aSegundos('7:99'), 0)
  assert.equal(aSegundos('abc'), 0)
})

const D = 864e5
test('diasDesde', () => {
  const ahora = Date.parse('2026-11-08T12:00:00Z')
  assert.equal(diasDesde('2026-11-01T12:00:00Z', ahora), 7)
  assert.equal(diasDesde('', ahora), null)
  assert.equal(diasDesde('basura', ahora), null)
})
test('aviso de backup: sin datos no molesta; nunca hecho avisa; a los 7 días avisa', () => {
  const ahora = Date.parse('2026-11-08T12:00:00Z')
  assert.equal(avisoBackup({ultimo: '', hayDatos: false, ahora}), null)
  assert.deepEqual(avisoBackup({ultimo: '', hayDatos: true, ahora}), {nunca: true, dias: null})
  assert.equal(
    avisoBackup({ultimo: new Date(ahora - 6 * D).toISOString(), hayDatos: true, ahora}),
    null
  )
  assert.deepEqual(
    avisoBackup({ultimo: new Date(ahora - 7 * D).toISOString(), hayDatos: true, ahora}),
    {
      nunca: false,
      dias: 7
    }
  )
})
test('los ajustes del backup nunca incluyen la clave de IA', () => {
  const todo = {meta: '2500', metakcal: '2200', modelo: 'x', sonido: '0', key: 'SECRETA'}
  const a = ajustesDe(k => todo[k])
  assert.equal(a.key, undefined)
  assert.equal(JSON.stringify(a).includes('SECRETA'), false)
  assert.equal(a.sonido, '0')
})
test('validarBackup y nombre', () => {
  assert.equal(validarBackup({_meta: {app: 'MMV'}}), true)
  assert.equal(validarBackup({sesiones: []}), true)
  assert.equal(validarBackup([]), false)
  assert.equal(validarBackup(null), false)
  assert.equal(nombreBackup('2026-11-01'), 'mmv-backup-2026-11-01.json')
})
