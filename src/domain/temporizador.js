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
export const CON_RELOJ = ['movilidad', 'warmup', 'emom', 'amrap', 'tabata', 'forTime']
export const POR_EJERCICIO = ['movilidad', 'warmup'] // 40 s por ejercicio, en vueltas (entrega 12)
export const PREVIO = 5 // segundos de "Preparate" antes de empezar

const pos = (x, d) => (Number.isFinite(+x) && +x > 0 ? Math.round(+x) : d)
// Nombres de los ejercicios del bloque, sin * ni ? y sin líneas vacías (el reloj dice cuál toca).
export const nombresEj = b =>
  (Array.isArray(b?.ejercicios) ? b.ejercicios : [])
    .map(e => String(e ?? '').replace(/[*?]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

export const emomIntervalo = b => Math.max(10, pos(b?.intervalo, 60))
export const emomIntervalos = b => Math.max(1, Math.round((pos(b?.minutos, 10) * 60) / emomIntervalo(b)))

// Segmentos del bloque: [{l: etiqueta, s: segundos, previo?, sube?}]
export function armarSegmentos(b) {
  const m = pos(b.minutos, 10)
  const previo = {l: 'Preparate', s: PREVIO, previo: true}
  const nom = nombresEj(b),
    N = nom.length,
    ej = r => (N ? nom[r % N] : undefined),
    con = (seg, o) => (N ? {...seg, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))} : seg)
  if (b.tipo === 'emom') {
    // Con ejercicios cargados, rotan UNO POR INTERVALO (entrega 16): con 6 ejercicios y 12 minutos, el minuto 1 es el
    // ejercicio 1, …, el 7 vuelve al 1. Sin ejercicios, el EMOM cuenta intervalos como siempre.
    const iv = emomIntervalo(b),
      n = emomIntervalos(b)
    return [
      con(previo, {sig: ej(0)}),
      ...Array.from({length: n}, (_, i) =>
        con(
          {l: `${iv === 60 ? 'Min' : 'Intervalo'} ${i + 1}/${n}`, s: iv},
          {ej: ej(i), sig: i + 1 < n ? ej(i + 1) : undefined}
        )
      )
    ]
  }
  if (b.tipo === 'tabata') {
    // Con 2 o 4 ejercicios se alternan: la ronda 1 es el ejercicio 1, la 2 el 2, y así.
    const t = pos(b.trab, 20),
      d = pos(b.desc, 10),
      n = pos(b.rond, 8)
    return [
      con(previo, {sig: ej(0)}),
      ...Array.from({length: n * 2}, (_, i) => {
        const r = Math.floor(i / 2)
        return i % 2
          ? con({l: 'Descanso', s: d}, {sig: r + 1 < n ? ej(r + 1) : undefined})
          : con({l: `Trabajo ${r + 1}/${n}`, s: t}, {ej: ej(r), sig: r + 1 < n ? ej(r + 1) : undefined})
      })
    ]
  }
  if (POR_EJERCICIO.includes(b.tipo)) {
    // Movilidad y warm up: t segundos por ejercicio (40 por defecto), `vueltas` vueltas (2 por defecto).
    // Con 3 ejercicios son 6 intervalos y con 4, 8. Descanso/cambio opcional (0 por defecto).
    const t = pos(b.trab, 40),
      d = Math.max(0, Math.round(+b.desc) || 0),
      v = Math.min(10, pos(b.vueltas, 2)),
      n = (N || 3) * v,
      out = [con(previo, {sig: ej(0)})]
    for (let r = 0; r < n; r++) {
      out.push(con({l: `Ejercicio ${r + 1}/${n}`, s: t}, {ej: ej(r), sig: r + 1 < n ? ej(r + 1) : undefined}))
      if (d > 0 && r < n - 1) out.push(con({l: 'Cambio', s: d}, {sig: ej(r + 1)}))
    }
    return out
  }
  if (b.tipo === 'forTime') return [previo, {l: 'For time (tope)', s: m * 60, sube: true}]
  return [previo, {l: TIPOS[b.tipo] || 'Bloque', s: m * 60}]
}

// Resumen corto del reloj de un bloque por intervalos, p. ej. «40 s × 6» o «20/10 × 8 rondas». '' si no aplica.
export function resumenReloj(b) {
  if (b?.tipo === 'emom') {
    const N = nombresEj(b).length
    if (!N) return ''
    const iv = emomIntervalo(b),
      n = emomIntervalos(b)
    return iv === 60 ? `1 ejercicio por minuto × ${n} min` : `1 ejercicio cada ${iv} s × ${n}`
  }
  if (!POR_EJERCICIO.includes(b?.tipo) && b?.tipo !== 'tabata') return ''
  const trabajo = armarSegmentos(b).filter(x => /^(Ejercicio|Trabajo) /.test(x.l))
  if (!trabajo.length) return ''
  if (b.tipo === 'tabata') return `${trabajo[0].s}/${pos(b.desc, 10)} × ${trabajo.length} rondas`
  return `${trabajo[0].s} s × ${trabajo.length}`
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
