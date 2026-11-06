// Puntaje de preparación v2 (0 a 100): una orientación para decidir qué tan fuerte entrenar hoy.
// Funciones puras (sin React ni base de datos). NO es una medición médica ni está validada:
// es una regla simple y transparente sobre tus propios datos. Los pesos son una propuesta de diseño
// (percepción subjetiva 40 %, sueño contra tu propio promedio 30 %, carga 20 %, hábitos de ayer 10 %),
// no salen de un estudio.
import {sumaDias} from './stats.js'
import {cargasExternas, pasosContexto} from './movimiento.js'

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x))
const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
// Rampa lineal: devuelve 0 en `a`, 100 en `b` (funciona también si a>b).
const rampa = (x, a, b) => clamp(((x - a) / (b - a)) * 100)

export const PESOS = {subjetivo: 0.4, sueno: 0.3, carga: 0.2, habitos: 0.1}
export const NOMBRES = {
  subjetivo: 'Cómo te sentís',
  sueno: 'Sueño',
  carga: 'Carga reciente',
  habitos: 'Hábitos de ayer'
}
export const SUENO_HIST_MIN = 5 // días con sueño cargado (en los 28 previos) para usar tu propio promedio
export const SUENO_PISO_H = 5 // por debajo de estas horas el sueño no pasa de 50, aunque duermas así siempre
export const MINIMO_COMPONENTES = 2 // con menos datos que esto no se calcula
export const HISTORIAL_MIN_DIAS = 14 // para comparar la carga hace falta al menos 2 semanas de historia

// Carga de una sesión = RPE × minutos (método sRPE). Sin minutos cargados se supone 45.
export function cargaSesion(s) {
  const min = (s.bloques || []).reduce((a, b) => a + (+b.minutos || 0), 0) || 45
  return (+s.rpe || 0) * min
}

// Check-in subjetivo: energía y ánimo (1 = muy bajo, 5 = muy alto) y dolor muscular (1 = nada, 5 = mucho).
// Cada dato que esté se pasa a 0–100 (el dolor se invierte) y se promedian; con uno solo ya se puntúa.
export function puntajeSubjetivo(h) {
  const v = k => {
    const n = num(h?.[k])
    return n >= 1 && n <= 5 ? n : null
  }
  const e = v('energia'),
    a = v('animo'),
    d = v('dolor')
  const xs = [
    e !== null ? ((e - 1) / 4) * 100 : null,
    a !== null ? ((a - 1) / 4) * 100 : null,
    d !== null ? ((5 - d) / 4) * 100 : null
  ].filter(x => x !== null)
  if (!xs.length) return null
  return {p: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length), n: xs.length, dolor: d}
}

// Promedio de horas de sueño de los 28 días anteriores a `fecha` (sin contar hoy). null si hay pocos días con dato.
export function suenoHabitual(habitos = [], fecha) {
  if (!fecha) return null
  const d0 = sumaDias(fecha, -28),
    hs = habitos
      .filter(x => x.fecha >= d0 && x.fecha < fecha)
      .map(x => num(x.sueno))
      .filter(x => x > 0)
  if (hs.length < SUENO_HIST_MIN) return null
  return +(hs.reduce((s, x) => s + x, 0) / hs.length).toFixed(1)
}

// Sueño: horas de anoche y calidad (1 a 5, pesa 30 %).
// Con historial suficiente, las horas se comparan con TU promedio (≥ promedio = 100; 2 h menos = 0) y,
// como piso de seguridad, menos de 5 h nunca pasa de 50. Sin historial: ≤4 h = 0, ≥7 h = 100.
export function puntajeSueno(h, ctx = {}) {
  const horas = num(h?.sueno)
  if (!(horas > 0)) return null
  const calidad = num(h?.calidad),
    c = calidad >= 1 && calidad <= 5 ? ((calidad - 1) / 4) * 100 : null
  const hab = suenoHabitual(ctx.habitos, ctx.fecha)
  let ph =
    hab === null ? rampa(Math.min(horas, 9), 4, 7) : rampa(Math.min(horas, hab), hab - 2, hab)
  if (hab !== null && horas < SUENO_PISO_H) ph = Math.min(ph, 50)
  if (horas > 9.5) ph -= 10 // dormir muchísimo más de lo normal tampoco suma
  const p = Math.round(clamp(c === null ? ph : 0.7 * ph + 0.3 * c))
  return p
}

// Carga: razón aguda/crónica. Aguda = últimos 7 días; crónica = promedio semanal de los últimos 28.
// 0,8–1,3 = zona estable (100); sube o baja linealmente hasta 0 en ≤0,3 o ≥2,0.
// `externas` (Entrega 29): esfuerzo de actividades y rutas GPS fuera del entreno, [{fecha, carga}]
// (ver cargasExternas, que ya evita contar dos veces la misma salida). Sin externas, igual que antes.
export function puntajeCarga(sesiones, fecha, externas = []) {
  const eventos = [
    ...sesiones.map(s => ({fecha: s.fecha, carga: cargaSesion(s)})),
    ...externas.map(x => ({fecha: x.fecha, carga: +x.carga || 0}))
  ]
  if (!eventos.length) return null
  const primera = eventos.reduce((m, s) => (s.fecha < m ? s.fecha : m), eventos[0].fecha)
  if (primera > sumaDias(fecha, -(HISTORIAL_MIN_DIAS - 1))) return null
  const suma = (d0, d1) =>
    eventos.filter(s => s.fecha >= d0 && s.fecha <= d1).reduce((a, s) => a + s.carga, 0)
  const aguda = suma(sumaDias(fecha, -6), fecha),
    cronica = suma(sumaDias(fecha, -27), fecha) / 4
  if (!(cronica > 0)) return null
  const r = aguda / cronica
  const p = r >= 1.3 ? rampa(r, 2, 1.3) : r <= 0.8 ? rampa(r, 0.3, 0.8) : 100
  return {p: Math.round(p), razon: +r.toFixed(2)}
}

// Alimentación de ayer: dentro de ±15% de la meta = 100; ±50% o más = 0. Si no hay comidas ayer, no se puntúa.
export function puntajeAlimentacion(comidas, fecha, meta) {
  meta = +meta || 0
  if (!(meta > 0)) return null
  const ayer = sumaDias(fecha, -1),
    dia = comidas.filter(c => c.fecha === ayer)
  if (!dia.length) return null
  const kcal = dia.reduce((a, c) => a + (+c.kcal || 0), 0)
  if (!(kcal > 0)) return null
  const d = Math.abs(kcal - meta) / meta
  return {p: Math.round(rampa(d, 0.5, 0.15)), kcal: Math.round(kcal)}
}

// Hidratación de ayer respecto de la meta (100% de la meta = 100).
export function puntajeHidratacion(habitos, fecha, meta) {
  meta = +meta || 0
  if (!(meta > 0)) return null
  const h = habitos.find(x => x.fecha === sumaDias(fecha, -1))
  if (!h || !(+h.agua > 0)) return null
  return {p: Math.round(clamp((+h.agua / meta) * 100)), ml: +h.agua}
}

// Hábitos de ayer: promedio de alimentación e hidratación (las que tengan dato).
export function puntajeHabitos(comidas, habitos, fecha, {metaKcal, metaAgua} = {}) {
  const a = puntajeAlimentacion(comidas, fecha, metaKcal),
    h = puntajeHidratacion(habitos, fecha, metaAgua),
    xs = [a?.p, h?.p].filter(x => x !== undefined && x !== null)
  if (!xs.length) return null
  return {p: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length), a, h}
}

export function etiqueta(p) {
  return p >= 75
    ? {t: 'Listo para entrenar fuerte', c: 'up'}
    : p >= 50
      ? {t: 'Entrená normal y escuchá al cuerpo', c: ''}
      : {t: 'Priorizá la recuperación', c: 'down'}
}

// Qué hacer con ese puntaje: una frase por tramo + avisos puntuales según el check-in.
// No es una prescripción: es una orientación para elegir la intensidad.
export function recomendacion(puntaje, {dolor = null} = {}) {
  const base =
    puntaje >= 75
      ? 'Buen día para apretar: series pesadas o un metcon exigente, con buena técnica.'
      : puntaje >= 50
        ? 'Entrená normal: mantené la técnica y no busques récords hoy.'
        : 'Sesión liviana, movilidad o descanso. Si hoy no podés evitar entrenar, bajá la carga y el volumen.'
  const avisos = []
  if (dolor >= 4)
    avisos.push('Dolor muscular alto: evitá cargar fuerte los mismos músculos y calentá más.')
  return {texto: base, avisos}
}

// Calcula el puntaje. Devuelve {ok:false,faltan} o {ok:true,puntaje,etiqueta,recomendacion,confianza,partes}.
// Los componentes sin datos se omiten y los pesos se reparten entre los que sí hay; `confianza` es el % de peso con datos.
export function preparacion({
  fecha,
  habitos = [],
  sesiones = [],
  comidas = [],
  actividades = [],
  rutas = [],
  metaKcal = 2200,
  metaAgua = 2500
}) {
  const hoyH = habitos.find(h => h.fecha === fecha)
  const externas = cargasExternas(actividades, rutas),
    minExt7 = Math.round(
      externas
        .filter(x => x.fecha >= sumaDias(fecha, -6) && x.fecha <= fecha)
        .reduce((a, x) => a + x.minutos, 0)
    )
  const sub = puntajeSubjetivo(hoyH),
    c = puntajeCarga(sesiones, fecha, externas),
    hab = puntajeHabitos(comidas, habitos, fecha, {metaKcal, metaAgua}),
    hs = num(hoyH?.sueno) > 0 ? num(hoyH.sueno) : null,
    habit = suenoHabitual(habitos, fecha)
  const detalleHab = hab
    ? [
        hab.a ? `comida ayer ${hab.a.kcal} de ${metaKcal} kcal` : '',
        hab.h ? `agua ayer ${hab.h.ml} de ${metaAgua} ml` : ''
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const partes = {
    subjetivo: {
      p: sub?.p ?? null,
      detalle: sub
        ? [
            hoyH.energia ? `energía ${hoyH.energia}/5` : '',
            hoyH.animo ? `ánimo ${hoyH.animo}/5` : '',
            hoyH.dolor ? `dolor ${hoyH.dolor}/5` : ''
          ]
            .filter(Boolean)
            .join(' · ')
        : ''
    },
    sueno: {
      p: puntajeSueno(hoyH, {habitos, fecha}),
      detalle:
        hs !== null
          ? `${String(hs).replace('.', ',')} h${habit !== null ? ` (tu promedio ${String(habit).replace('.', ',')} h)` : ''}${num(hoyH.calidad) ? ` · calidad ${num(hoyH.calidad)}/5` : ''}`
          : ''
    },
    carga: {
      p: c?.p ?? null,
      detalle: c
        ? `razón 7/28 días: ${String(c.razon).replace('.', ',')}` +
          (minExt7 > 0 ? ` · con ${minExt7} min de actividad (7 días)` : '')
        : ''
    },
    habitos: {p: hab?.p ?? null, detalle: detalleHab}
  }
  const con = Object.keys(partes).filter(k => partes[k].p !== null)
  if (con.length < MINIMO_COMPONENTES) {
    const faltan = Object.keys(partes)
      .filter(k => partes[k].p === null)
      .map(k => NOMBRES[k])
    return {ok: false, faltan, partes}
  }
  const pesoTot = con.reduce((s, k) => s + PESOS[k], 0)
  const puntaje = Math.round(con.reduce((s, k) => s + partes[k].p * PESOS[k], 0) / pesoTot)
  return {
    ok: true,
    puntaje,
    etiqueta: etiqueta(puntaje),
    recomendacion: recomendacion(puntaje, {dolor: sub?.dolor ?? null}),
    confianza: Math.round(pesoTot * 100),
    partes,
    pasos: pasosContexto(habitos, fecha), // solo informativo: no entra en el puntaje
    faltan: Object.keys(partes)
      .filter(k => partes[k].p === null)
      .map(k => NOMBRES[k])
  }
}
