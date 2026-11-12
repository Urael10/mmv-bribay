// Entrega 48 · Lectura del día con IA y caché (lógica pura, sin React ni base de datos).
// Arma el resumen NUMÉRICO de hoy que se le manda a la IA (solo totales: sin nombres de comidas ni de ejercicios,
// sin notas, sin trazos ni coordenadas, y SIN el gasto estimado), lo sanea al volver y decide si la lectura guardada
// de hoy sigue valiendo. La IA nunca se llama sola: solo cuando la persona toca el botón.
import {sumaDias} from './stats.js'
import {puntajeCarga} from './preparacion.js'
import {cargasExternas} from './movimiento.js'
import {totales} from './alimentos.js'
import {proteinaObjetivo, ultima, PROT_KG} from './cuerpo.js'
import {parsearMeta, promedioPasos, metaEfectiva} from './metaPasos.js'

const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const pos = x => {
  const n = num(x)
  return n !== null && n > 0 ? n : null
}
const escala = x => {
  const n = num(x)
  return n !== null && n >= 1 && n <= 5 ? n : null
}
const redondo = (n, d = 1) => (n === null ? null : +n.toFixed(d))

// datos: {fecha, hora, habitos, comidas, sesiones, actividades, rutas, medidas, metaKcal, metaAgua, metaPasos, protKg}
// → objeto chico con totales de hoy (y el sueño de las dos noches anteriores). Lo que no hay va en null.
export function datosDia(d = {}) {
  const {fecha, hora = 12, habitos = [], comidas = [], sesiones = [], actividades = [], rutas = [], medidas = []} = d
  const fila = habitos.find(h => h.fecha === fecha),
    horasDe = f => pos(habitos.find(h => h.fecha === f)?.sueno),
    items = comidas.filter(c => c.fecha === fecha).flatMap(c => c.items || []),
    t = totales(items),
    metaP = proteinaObjetivo(ultima(medidas)?.peso, num(d.protKg) || PROT_KG),
    ef = metaEfectiva({meta: parsearMeta(d.metaPasos ?? '').meta, promedio: promedioPasos(habitos, fecha)}),
    deHoy = sesiones.filter(s => s.fecha === fecha),
    minutos = deHoy.reduce((a, s) => a + (s.bloques || []).reduce((b, x) => b + (+x?.minutos || 0), 0), 0),
    rpes = deHoy.map(s => num(s.rpe)).filter(x => x !== null),
    actHoy = actividades.filter(a => a.fecha === fecha),
    carga = puntajeCarga(sesiones, fecha, cargasExternas(actividades, rutas))
  return {
    fecha,
    horaDelDia: Math.floor(hora),
    sueno: {horas: horasDe(fecha), noche1Atras: horasDe(sumaDias(fecha, -1)), noche2Atras: horasDe(sumaDias(fecha, -2))},
    checkin: {energia: escala(fila?.energia), animo: escala(fila?.animo), dolorMuscular: escala(fila?.dolor)},
    agua: {ml: pos(fila?.agua) ?? 0, meta: pos(d.metaAgua)},
    comida: {
      kcal: Math.round(t.kcal),
      proteinaG: Math.round(t.p),
      carbosG: Math.round(t.c),
      grasasG: Math.round(t.gr),
      metaKcal: pos(d.metaKcal),
      metaProteinaG: metaP || null
    },
    pasos: {hoy: pos(fila?.pasos) ?? 0, referencia: ef?.valor > 0 ? ef.valor : null},
    entrenoHoy: {sesiones: deHoy.length, rpeMedio: rpes.length ? redondo(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null, minutos: Math.round(minutos)},
    actividadesHoy: {cantidad: actHoy.length, minutos: Math.round(actHoy.reduce((a, x) => a + (+x.minutos || 0), 0))},
    cargaSemanaVsHabitual: carga ? carga.razon : null
  }
}

// ¿Hay algo de hoy con qué hablar? Sin datos no se ofrece la lectura.
export function hayDatosDia(x) {
  if (!x) return false
  return !!(
    x.sueno.horas ||
    x.checkin.energia ||
    x.checkin.animo ||
    x.checkin.dolorMuscular ||
    x.agua.ml > 0 ||
    x.comida.kcal > 0 ||
    x.pasos.hoy > 0 ||
    x.entrenoHoy.sesiones > 0 ||
    x.actividadesHoy.cantidad > 0
  )
}

// Huella corta de los datos (sin la hora del día): si cambia, la lectura guardada quedó vieja.
export function huella(x) {
  const {horaDelDia: _h, ...resto} = x || {}
  const s = JSON.stringify(resto)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export const P_DIA =
  'Sos un coach cercano y concreto, en español rioplatense (vos). Recibís los números de HOY de una persona (sueño, check-in de energía/ánimo/dolor muscular de 1 a 5, agua, comida, pasos, entreno y su carga de la semana contra lo habitual) y la hora del día. Devolvé SOLO JSON: {"resumen":"2 frases como máximo sobre cómo viene el día","sugerencias":["hasta 3 acciones chicas y concretas para lo que queda del día"],"alerta":""}. Reglas: basate SOLO en los números recibidos y no inventes datos ni cifras; si algo viene en null o en 0 a una hora temprana, no lo des por mal: decí que falta información o que todavía es temprano; no des diagnósticos, consejos médicos ni de suplementos, ni pautas de dieta con cifras (calorías o macros) más allá de comparar con la meta que ya tiene; "alerta" va vacía salvo que haya algo claramente preocupante (por ejemplo sueño muy corto varias noches con carga alta), y en ese caso sugerí descansar y consultar a un profesional si persiste. Cada ítem de hasta 160 caracteres. No recibís recorridos, lugares, nombres de comidas ni de ejercicios: no los pidas.'

export function cuerpoDia(datos) {
  return JSON.stringify({
    contents: [{parts: [{text: P_DIA + '\n\nDATOS DE HOY:\n' + JSON.stringify(datos)}]}],
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
export function limpiarDia(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {
    resumen: txt(r.resumen, 320),
    sugerencias: (Array.isArray(r.sugerencias) ? r.sugerencias : []).map(x => txt(x)).filter(Boolean).slice(0, 3),
    alerta: txt(r.alerta, 240)
  }
  if (!out.resumen && !out.sugerencias.length) throw new Error('La IA no devolvió una lectura. Probá de nuevo.')
  return out
}

// ---- Caché (una sola lectura, la de hoy) ----
// La lectura guardada es {fecha, creado (ISO), huella, lectura}. Se guarda como texto JSON en el teléfono.
export function armarCache({fecha, huella: h, lectura, creado = new Date().toISOString()}) {
  return {fecha, creado, huella: h, lectura}
}

// Lee el texto guardado; devuelve null si no es una lectura válida.
export function leerCache(texto) {
  let c
  try {
    c = JSON.parse(texto || 'null')
  } catch {
    return null
  }
  if (!c || typeof c !== 'object' || typeof c.fecha !== 'string' || typeof c.huella !== 'string') return null
  const l = c.lectura
  if (!l || typeof l !== 'object' || typeof l.resumen !== 'string' || !Array.isArray(l.sugerencias)) return null
  return {fecha: c.fecha, creado: String(c.creado || ''), huella: c.huella, lectura: {resumen: l.resumen, sugerencias: l.sugerencias.map(String).slice(0, 3), alerta: String(l.alerta || '')}}
}

// 'sin' (no hay lectura de hoy) · 'vigente' (mismos datos) · 'desactualizada' (cargaste datos nuevos después).
export function estadoCache(cache, fecha, h) {
  if (!cache || cache.fecha !== fecha) return 'sin'
  return cache.huella === h ? 'vigente' : 'desactualizada'
}

export const AVISO_DIA =
  'La IA solo ve los totales de hoy (sin fotos, nombres de comidas ni recorridos). Son orientaciones generales, no consejo médico. La lectura queda guardada en el teléfono hasta mañana.'
