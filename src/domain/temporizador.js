// Temporizador de bloques: funciones puras (sin React, sin reloj, sin sonido).
// El tiempo se calcula SIEMPRE con la hora real (marcas de tiempo), nunca contando ticks:
// así no se atrasa si el navegador frena los temporizadores con la pantalla apagada.

export const TIPOS = {
  movilidad: 'Movilidad',
  warmup: 'Warm up',
  emom: 'EMOM',
  amrap: 'AMRAP',
  tabata: 'Tabata',
  forTime: 'For time'
}
export const CON_RELOJ = ['emom', 'amrap', 'tabata', 'forTime']
export const PREVIO = 5 // segundos de "Preparate" antes de empezar

const pos = (x, d) => (Number.isFinite(+x) && +x > 0 ? Math.round(+x) : d)

// Segmentos del bloque: [{l: etiqueta, s: segundos, previo?, sube?}]
export function armarSegmentos(b) {
  const m = pos(b.minutos, 10)
  const previo = {l: 'Preparate', s: PREVIO, previo: true}
  if (b.tipo === 'emom') {
    const iv = Math.max(10, pos(b.intervalo, 60))
    const n = Math.max(1, Math.round((m * 60) / iv))
    return [
      previo,
      ...Array.from({length: n}, (_, i) => ({
        l: `${iv === 60 ? 'Min' : 'Intervalo'} ${i + 1}/${n}`,
        s: iv
      }))
    ]
  }
  if (b.tipo === 'tabata') {
    const t = pos(b.trab, 20),
      d = pos(b.desc, 10),
      n = pos(b.rond, 8)
    return [
      previo,
      ...Array.from({length: n * 2}, (_, i) =>
        i % 2 ? {l: 'Descanso', s: d} : {l: `Trabajo ${i / 2 + 1}/${n}`, s: t}
      )
    ]
  }
  if (b.tipo === 'forTime') return [previo, {l: 'For time (tope)', s: m * 60, sube: true}]
  return [previo, {l: TIPOS[b.tipo] || 'Bloque', s: m * 60}]
}

export const duracionTotal = segs => segs.reduce((a, s) => a + s.s, 0)

// Dónde estamos a los `ms` milisegundos de haber arrancado.
// Devuelve {i, seg, restante, trans, fin, total}. `restante` redondea hacia arriba (se ve 05:00 al empezar).
export function posicion(segs, ms) {
  const total = duracionTotal(segs)
  if (ms >= total * 1000) {
    const i = segs.length - 1
    return {i, seg: segs[i], restante: 0, trans: segs[i].s, fin: true, total}
  }
  let ini = 0
  for (let i = 0; i < segs.length; i++) {
    const fin = ini + segs[i].s
    if (ms < fin * 1000) {
      return {
        i,
        seg: segs[i],
        restante: Math.ceil((fin * 1000 - ms) / 1000),
        trans: Math.floor((ms - ini * 1000) / 1000),
        fin: false,
        total
      }
    }
    ini = fin
  }
}

// Estado del reloj: {ac: ms acumulados, ini: marca de inicio o null si está en pausa}
export const transcurrido = (e, ahora) =>
  (e.ac || 0) + (e.ini != null ? Math.max(0, ahora - e.ini) : 0)
export const alternar = (e, ahora) =>
  e.ini != null ? {...e, ac: transcurrido(e, ahora), ini: null} : {...e, ini: ahora}

// ¿Qué aviso corresponde al pasar de la posición `ant` a `act`? 'cuenta' | 'cambio' | 'fin' | null
export function aviso(ant, act) {
  if (!ant || !act) return null
  if (act.fin && !ant.fin) return 'fin'
  if (act.i !== ant.i) return 'cambio'
  if (!act.seg.sube && act.restante !== ant.restante && act.restante >= 1 && act.restante <= 3)
    return 'cuenta'
  return null
}

export const mmss = s => {
  s = Math.max(0, Math.floor(+s || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
// "7:42" -> 462 ; "462" -> 462 ; inválido -> 0
export function aSegundos(txt) {
  const t = String(txt ?? '').trim()
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/)
  if (m) return +m[1] * 60 + +m[2]
  return /^\d+$/.test(t) ? +t : 0
}
