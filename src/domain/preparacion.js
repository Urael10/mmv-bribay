// Puntaje de preparación (0 a 100): una orientación para decidir qué tan fuerte entrenar hoy.
// Funciones puras (sin React ni base de datos). NO es una medición médica ni está validada:
// es una regla simple y transparente sobre tus propios datos (sueño, carga, hidratación, comida).
import {sumaDias} from './stats.js'

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x))
const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
// Rampa lineal: devuelve 0 en `a`, 100 en `b` (funciona también si a>b).
const rampa = (x, a, b) => clamp(((x - a) / (b - a)) * 100)

export const PESOS = {sueno: 0.35, carga: 0.3, alimentacion: 0.2, hidratacion: 0.15}
export const NOMBRES = {
  sueno: 'Sueño',
  carga: 'Carga reciente',
  alimentacion: 'Alimentación',
  hidratacion: 'Hidratación'
}
export const MINIMO_COMPONENTES = 2 // con menos datos que esto no se calcula
export const HISTORIAL_MIN_DIAS = 14 // para comparar la carga hace falta al menos 2 semanas de historia

// Carga de una sesión = RPE × minutos (método sRPE). Sin minutos cargados se supone 45.
export function cargaSesion(s) {
  const min = (s.bloques || []).reduce((a, b) => a + (+b.minutos || 0), 0) || 45
  return (+s.rpe || 0) * min
}

// Sueño: 70% horas (≤4 h = 0, ≥7 h = 100) + 30% calidad (1 a 5). Se usa el dato de hoy ("sueño de anoche").
export function puntajeSueno(h) {
  const horas = num(h?.sueno)
  if (!(horas > 0)) return null
  const calidad = num(h?.calidad),
    c = calidad >= 1 && calidad <= 5 ? ((calidad - 1) / 4) * 100 : null
  const ph = rampa(Math.min(horas, 9), 4, 7) - (horas > 9.5 ? 10 : 0) // dormir muchísimo más de lo normal tampoco suma
  return Math.round(clamp(c === null ? ph : 0.7 * ph + 0.3 * c))
}

// Carga: razón aguda/crónica. Aguda = últimos 7 días; crónica = promedio semanal de los últimos 28.
// 0,8–1,3 = zona estable (100); sube o baja linealmente hasta 0 en ≤0,3 o ≥2,0.
export function puntajeCarga(sesiones, fecha) {
  if (!sesiones.length) return null
  const primera = sesiones.reduce((m, s) => (s.fecha < m ? s.fecha : m), sesiones[0].fecha)
  if (primera > sumaDias(fecha, -(HISTORIAL_MIN_DIAS - 1))) return null
  const suma = (d0, d1) =>
    sesiones.filter(s => s.fecha >= d0 && s.fecha <= d1).reduce((a, s) => a + cargaSesion(s), 0)
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

export function etiqueta(p) {
  return p >= 75
    ? {t: 'Listo para entrenar fuerte', c: 'up'}
    : p >= 50
      ? {t: 'Entrená normal y escuchá al cuerpo', c: ''}
      : {t: 'Priorizá la recuperación', c: 'down'}
}

// Calcula el puntaje. Devuelve {ok:false,faltan} o {ok:true,puntaje,etiqueta,confianza,partes}.
// Los componentes sin datos se omiten y los pesos se reparten entre los que sí hay; `confianza` es el % de peso con datos.
export function preparacion({
  fecha,
  habitos = [],
  sesiones = [],
  comidas = [],
  metaKcal = 2200,
  metaAgua = 2500
}) {
  const hoyH = habitos.find(h => h.fecha === fecha)
  const c = puntajeCarga(sesiones, fecha),
    a = puntajeAlimentacion(comidas, fecha, metaKcal),
    h = puntajeHidratacion(habitos, fecha, metaAgua)
  const partes = {
    sueno: {
      p: puntajeSueno(hoyH),
      detalle:
        hoyH && num(hoyH.sueno) > 0
          ? `${String(num(hoyH.sueno)).replace('.', ',')} h${num(hoyH.calidad) ? ` · calidad ${num(hoyH.calidad)}/5` : ''}`
          : ''
    },
    carga: {
      p: c?.p ?? null,
      detalle: c ? `razón 7/28 días: ${String(c.razon).replace('.', ',')}` : ''
    },
    alimentacion: {p: a?.p ?? null, detalle: a ? `ayer ${a.kcal} kcal de ${metaKcal}` : ''},
    hidratacion: {p: h?.p ?? null, detalle: h ? `ayer ${h.ml} ml de ${metaAgua}` : ''}
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
    confianza: Math.round(pesoTot * 100),
    partes,
    faltan: Object.keys(partes)
      .filter(k => partes[k].p === null)
      .map(k => NOMBRES[k])
  }
}
