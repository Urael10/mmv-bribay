// Informe semanal (lunes a domingo) y coach IA. Funciones puras: las cuentas las hace SIEMPRE este código;
// la IA solo recibe el resumen ya calculado (números, sin fotos ni nombres) y devuelve consejos en texto.
import {sumaDias, volumen, repsTot, marcarPorContexto, pct, patron} from './stats.js'
import {checkinHecho} from './checkin.js'
import {cargaSesion} from './preparacion.js'
import {movimientoSemana, movimientoParaIA, hayMovimiento} from './movimiento.js'

const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const r1 = n => Math.round(n * 10) / 10
const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const enSemana = (f, d) => f >= d && f <= sumaDias(d, 6)

function volSemana(reg, desde) {
  const r = reg.filter(x => enSemana(x.fecha, desde))
  return {
    reps: r.reduce((a, x) => a + repsTot(x), 0),
    ton: Math.round(r.reduce((a, x) => a + volumen(x), 0))
  }
}

// d: {desde (lunes), sesiones, registros, habitos, comidas, actividades, rutas, manual, metaKcal, metaAgua}
// `habitos`, `actividades` y `rutas` pueden traer también la semana anterior (para comparar pasos).
// `rutas` debe venir SIN trazo (data/movimiento.js ya las reduce): el informe nunca ve coordenadas.
export function informeSemana({
  desde,
  sesiones = [],
  registros = [],
  habitos = [],
  comidas = [],
  actividades = [],
  rutas = [],
  manual = {},
  metaKcal = 2200,
  metaAgua = 2500
}) {
  const ses = sesiones.filter(s => enSemana(s.fecha, desde))
  const dias = new Set(ses.map(s => s.fecha)).size
  const carga = ses.reduce((a, s) => a + cargaSesion(s), 0)
  const rpes = ses.map(s => +s.rpe || 0).filter(x => x > 0)
  const vol = volSemana(registros, desde),
    ant = volSemana(registros, sumaDias(desde, -7))
  const sesAnt = sesiones.filter(s => enSemana(s.fecha, sumaDias(desde, -7)))
  const cargaAnt = sesAnt.reduce((a, s) => a + cargaSesion(s), 0)
  // patrones trabajados (sin Movilidad ni Otro en el recuento de "equilibrio")
  const pat = {}
  for (const r of registros)
    if (enSemana(r.fecha, desde)) {
      const p = patron(r.nombre, r.tipo, manual[r.clave])
      pat[p] = (pat[p] || 0) + repsTot(r)
    }
  // récords: registros de la semana que superan marcas previas
  const M = marcarPorContexto(registros),
    recs = registros.filter(r => enSemana(r.fecha, desde) && M[r.id]?.flags.length)
  const records = [
    ...new Set(
      recs
        .map(r =>
          String(r.nombre || '')
            .replace(/[*?]/g, '')
            .trim()
        )
        .filter(Boolean)
    )
  ]
  // hábitos
  const hs = habitos.filter(h => enSemana(h.fecha, desde))
  const horas = hs.map(h => num(h.sueno)).filter(x => x > 0),
    cal = hs.map(h => num(h.calidad)).filter((x, i) => x >= 1 && num(hs[i].sueno) > 0)
  const ci = hs.filter(checkinHecho),
    mci = k => (ci.length ? r1(media(ci.map(h => +h[k]))) : null)
  const aguas = hs.map(h => +h.agua || 0).filter(x => x > 0)
  // comidas por día
  const porDia = {}
  for (const c of comidas)
    if (enSemana(c.fecha, desde)) {
      const o = porDia[c.fecha] || (porDia[c.fecha] = {kcal: 0, p: 0})
      o.kcal += +c.kcal || 0
      o.p += +c.p || 0
    }
  const dk = Object.values(porDia).filter(x => x.kcal > 0)
  return {
    desde,
    hasta: sumaDias(desde, 6),
    entreno: {
      sesiones: ses.length,
      dias,
      rpeMedio: rpes.length ? r1(media(rpes)) : null,
      carga: Math.round(carga),
      cargaVsAnterior: pct(carga, cargaAnt),
      reps: vol.reps,
      tonelaje: vol.ton,
      repsVsAnterior: pct(vol.reps, ant.reps),
      tonelajeVsAnterior: pct(vol.ton, ant.ton),
      patrones: pat,
      records
    },
    sueno: {
      diasConDato: horas.length,
      horasMedias: horas.length ? r1(media(horas)) : null,
      calidadMedia: cal.length ? r1(media(cal)) : null,
      diasMenosDe6h: horas.filter(h => h < 6).length
    },
    checkin: {dias: ci.length, energia: mci('energia'), animo: mci('animo'), dolor: mci('dolor')},
    agua: {
      diasConDato: aguas.length,
      mlMedios: aguas.length ? Math.round(media(aguas)) : null,
      diasMeta: aguas.filter(a => a >= metaAgua).length,
      meta: metaAgua
    },
    comida: {
      diasConDato: dk.length,
      kcalMedias: dk.length ? Math.round(media(dk.map(x => x.kcal))) : null,
      proteinaMedia: dk.length ? Math.round(media(dk.map(x => x.p))) : null,
      meta: metaKcal,
      diasEnRango: dk.filter(x => Math.abs(x.kcal - metaKcal) / metaKcal <= 0.15).length
    },
    actividad: movimientoSemana({desde, habitos, actividades, rutas})
  }
}

// ¿Hay algo que informar? Sin ningún dato la semana no tiene informe.
export const hayDatos = i =>
  i.entreno.sesiones > 0 ||
  i.sueno.diasConDato > 0 ||
  i.agua.diasConDato > 0 ||
  i.checkin.dias > 0 ||
  i.comida.diasConDato > 0 ||
  i.entreno.reps > 0 ||
  hayMovimiento(i.actividad)

const sg = n => (n === null || n === undefined ? '' : (n > 0 ? '+' : '') + n + '%')
const f = n => (n === null || n === undefined ? '–' : String(n).replace('.', ','))
const fd = s => s.split('-').reverse().slice(0, 2).join('/')

const miles = n => Math.round(n).toLocaleString('es-UY')
// Línea de actividad del informe en texto: pasos, actividades y salidas con GPS que no están en ninguna actividad.
export function textoActividad(a) {
  if (!hayMovimiento(a)) return 'Actividad: sin datos'
  const partes = []
  if (a.pasos.diasConDato)
    partes.push(
      `${miles(a.pasos.medios)} pasos de media en ${a.pasos.diasConDato} ${a.pasos.diasConDato === 1 ? 'día' : 'días'}${a.pasos.vsAnterior !== null ? ' (' + sg(a.pasos.vsAnterior) + ' vs semana anterior)' : ''}`
    )
  if (a.actividades.cantidad)
    partes.push(
      `${a.actividades.cantidad} ${a.actividades.cantidad === 1 ? 'actividad' : 'actividades'} (${a.actividades.minutos} min${a.actividades.km > 0 ? ', ' + f(a.actividades.km) + ' km' : ''})`
    )
  if (a.rutasAparte.rutas)
    partes.push(
      `${a.rutasAparte.rutas} ${a.rutasAparte.rutas === 1 ? 'ruta' : 'rutas'} con GPS aparte (${f(a.rutasAparte.km)} km)`
    )
  return 'Actividad: ' + partes.join(' · ')
}

// Texto plano para copiar o compartir.
export function textoInforme(i, coach) {
  const e = i.entreno,
    L = [
      `Informe semanal ${fd(i.desde)} al ${fd(i.hasta)}`,
      '',
      `Entreno: ${e.sesiones} ${e.sesiones === 1 ? 'sesión' : 'sesiones'} en ${e.dias} ${e.dias === 1 ? 'día' : 'días'} · RPE medio ${f(e.rpeMedio)} · carga ${e.carga}${e.cargaVsAnterior !== null ? ' (' + sg(e.cargaVsAnterior) + ' vs semana anterior)' : ''}`,
      `Volumen: ${e.reps} reps · ${e.tonelaje} kg${e.tonelajeVsAnterior !== null ? ' (' + sg(e.tonelajeVsAnterior) + ' vs semana anterior)' : ''}`
    ]
  if (e.records.length) L.push('Récords: ' + e.records.join(', '))
  L.push(
    `Sueño: ${i.sueno.diasConDato ? f(i.sueno.horasMedias) + ' h de media en ' + i.sueno.diasConDato + ' días' + (i.sueno.diasMenosDe6h ? ' (' + i.sueno.diasMenosDe6h + ' con menos de 6 h)' : '') : 'sin datos'}`
  )
  L.push(
    `Check-in: ${i.checkin.dias ? i.checkin.dias + ' días · energía ' + f(i.checkin.energia) + ' · ánimo ' + f(i.checkin.animo) + ' · dolor muscular ' + f(i.checkin.dolor) + ' (escala 1 a 5)' : 'sin datos'}`
  )
  L.push(
    `Agua: ${i.agua.diasConDato ? i.agua.mlMedios + ' ml de media · meta cumplida ' + i.agua.diasMeta + ' de ' + i.agua.diasConDato + ' días' : 'sin datos'}`
  )
  L.push(textoActividad(i.actividad))
  L.push(
    `Comida: ${i.comida.diasConDato ? i.comida.kcalMedias + ' kcal de media (meta ' + i.comida.meta + ') · proteína ' + i.comida.proteinaMedia + ' g · ' + i.comida.diasEnRango + ' de ' + i.comida.diasConDato + ' días en rango' : 'sin datos'}`
  )
  if (coach) {
    L.push('', 'Coach IA: ' + coach.resumen)
    if (coach.logros.length) L.push('Bien: ' + coach.logros.join(' · '))
    if (coach.mejoras.length) L.push('A mejorar: ' + coach.mejoras.join(' · '))
    if (coach.plan.length) L.push('Plan: ' + coach.plan.join(' · '))
    if (coach.alerta) L.push('Ojo: ' + coach.alerta)
  }
  return L.join('\n')
}

// ---- Coach IA ----
export const P_COACH =
  'Sos un coach de entrenamiento y hábitos, cercano y concreto, en español rioplatense (vos). Recibís el resumen numérico de UNA semana de una persona que entrena fuerza/funcional y, si está, su puntaje de preparación de hoy. Devolvé SOLO JSON: {"resumen":"2 frases como máximo","logros":["hasta 3 cosas que salieron bien, con el dato"],"mejoras":["hasta 3 cosas a mejorar, con el dato"],"plan":["hasta 3 acciones concretas y chicas para la semana próxima"],"alerta":""}. Reglas: basate SOLO en los números recibidos y no inventes datos ni cifras; si algo viene en null o con pocos días, decí que falta información en vez de suponer; no des diagnósticos ni consejos médicos ni de suplementos, ni pautas de dieta con cifras (calorías o macros) más allá de comparar con la meta que ya tiene; "alerta" va vacía salvo que haya algo claramente preocupante en los datos (por ejemplo varios días con menos de 6 h de sueño junto con carga en aumento), y en ese caso sugerí descansar y consultar a un profesional si persiste. Check-in: energía y ánimo de 1 (muy bajo) a 5 (muy alto); dolor muscular de 1 (nada) a 5 (mucho). Cada ítem de hasta 160 caracteres. ' + 'También recibís "actividad", el movimiento fuera del entreno: "pasos" (promedio diario de los días con dato y variación contra la semana anterior; son estimaciones del celular, no una medición exacta), "actividades" (las que la persona registró: cantidad, minutos, km y desglose por tipo) y "rutasAparte" (salidas medidas con GPS que NO están ya en las actividades, así que no se cuentan dos veces; rutas = 0 significa que no hubo; ritmoMedioSegKm son segundos por km). "total" suma actividades y rutasAparte. No recibís recorridos ni lugares y no hace falta que los pidas. Podés relacionar la actividad con la carga de entreno, el sueño y el check-in (por ejemplo mucho movimiento extra con carga alta y poco descanso), y en "plan" podés sugerir ajustes concretos y chicos de la rutina de la semana: sumar o sacar un día de fuerza, bajar o subir el volumen o la intensidad, una semana de descarga, un día de movilidad o de caminata suave; sin nombrar ejercicios (no los recibís) y sin fijar ritmos ni distancias objetivo con cifras exactas. Si no hay datos de actividad, no los menciones.'

export function cuerpoCoach(informe, prep) {
  const {desde, hasta, actividad, ...resto} = informe
  const {records, ...entreno} = resto.entreno // los nombres de los ejercicios no salen del dispositivo: solo la cantidad de récords
  const datos = {
    semana: {desde, hasta},
    ...resto,
    entreno: {...entreno, recordsBatidos: records.length}
  }
  // Pasos, actividades y rutas: solo totales, campo por campo (sin trazos, coordenadas, horas ni notas).
  if (hayMovimiento(actividad)) datos.actividad = movimientoParaIA(actividad)
  if (prep?.ok)
    datos.preparacionHoy = {
      puntaje: prep.puntaje,
      confianzaPct: prep.confianza,
      partes: Object.fromEntries(Object.entries(prep.partes).map(([k, v]) => [k, v.p]))
    }
  return JSON.stringify({
    contents: [{parts: [{text: P_COACH + '\n\nDATOS:\n' + JSON.stringify(datos)}]}],
    generationConfig: {responseMimeType: 'application/json'}
  })
}

// Sanea lo que devuelve la IA: solo texto, límites de largo y de cantidad. Lanza error si no hay nada útil.
const txt = (s, n = 160) =>
  String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
const lista = a =>
  (Array.isArray(a) ? a : [])
    .map(x => txt(x))
    .filter(Boolean)
    .slice(0, 3)
export function limpiarCoach(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {
    resumen: txt(r.resumen, 320),
    logros: lista(r.logros),
    mejoras: lista(r.mejoras),
    plan: lista(r.plan),
    alerta: txt(r.alerta, 240)
  }
  if (!out.resumen && !out.logros.length && !out.mejoras.length && !out.plan.length)
    throw new Error('El coach no devolvió consejos. Probá de nuevo.')
  return out
}
