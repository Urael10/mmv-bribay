// Gasto calórico por actividades (Entrega 43). Lógica pura: no toca el navegador ni la base.
//
// Es una ESTIMACIÓN: kcal = (MET − 1) × peso (kg) × horas. Restar 1 MET deja solo lo que gastás POR ENCIMA del
// reposo (el reposo ya está dentro de lo que comés para mantenerte), así no se cuenta dos veces.
// Los MET salen del orden de magnitud del Compendio de Actividades Físicas (valores redondeados) y la tabla de
// entreno por RPE es una propuesta de diseño: sirve para comparar días entre sí, no para medir al gramo (±30 %).
// Pasos (Entrega 47): se suman como parte aparte, SOLO los que no caen dentro de una caminata o carrera ya contada
// (minutos × cadencia). Así la misma caminata no se cuenta dos veces. La cadencia y el MET son una propuesta de diseño.
import {rutasAparte} from './movimiento.js'
import {sumaDias} from './stats.js'

export const PESO_MIN = 20
export const PESO_MAX = 400
export const RESTAR_REPOSO = 1 // MET que se descuentan (reposo)

// Tablas [velocidad mínima km/h, MET]: vale la fila de mayor velocidad que no supera la tuya.
export const MET_CAMINATA = [[0, 2.0], [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0]]
export const MET_CARRERA = [[0, 6.0], [8.0, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0]]
export const MET_BICICLETA = [[0, 4.0], [16.1, 6.8], [19.3, 8.0], [22.5, 10.0], [25.7, 12.0], [32.2, 15.8]]

// Sin distancia (o con un tipo sin velocidad) se usa un MET típico.
export const MET_BASE = {caminata: 3.5, carrera: 9.0, bicicleta: 6.8, natacion: 6.0, deporte: 6.0, otro: 4.0}
const TABLAS = {caminata: MET_CAMINATA, carrera: MET_CARRERA, bicicleta: MET_BICICLETA}

// Entreno: MET según el RPE de la sesión (1–10). Sin RPE se supone un esfuerzo medio.
export const MET_ENTRENO = {1: 3.0, 2: 3.0, 3: 4.0, 4: 4.0, 5: 5.5, 6: 5.5, 7: 7.0, 8: 7.0, 9: 8.5, 10: 8.5}
export const MET_ENTRENO_SIN_RPE = 5.5
export const MIN_SESION_SIN_BLOQUES = 45 // misma suposición que la carga de la sesión

// Pasos sueltos del día: ~100 pasos/min al caminar (MET 2,8 ≈ 3,2 km/h); al correr ~160 pasos/min.
export const PASOS_POR_MIN = {caminata: 100, carrera: 160}
export const MET_PASOS = 2.8

const escalon = (tabla, x) => tabla.reduce((met, [v, m]) => (x >= v ? m : met), tabla[0][1])
const minutosOk = m => Math.min(1440, Math.max(0, +m || 0))

export const pesoValido = p => (+p >= PESO_MIN && +p <= PESO_MAX ? +p : null)

// MET de una actividad (o de una ruta: pasá km = distM/1000 y minutos = seg/60).
export function metActividad({tipo, minutos, km}) {
  const t = tipo in MET_BASE ? tipo : 'otro'
  const min = minutosOk(minutos)
  if (TABLAS[t] && +km > 0 && min > 0) return escalon(TABLAS[t], (+km / min) * 60)
  return MET_BASE[t]
}

export const metEntreno = rpe => MET_ENTRENO[Math.round(+rpe)] ?? MET_ENTRENO_SIN_RPE

// kcal por encima del reposo. null si falta el peso o la duración.
export function kcalActivas({met, minutos, peso}) {
  const p = pesoValido(peso),
    min = minutosOk(minutos)
  if (!p || !(min > 0) || !(met > 0)) return null
  return Math.round(Math.max(0, met - RESTAR_REPOSO) * p * (min / 60))
}

export const kcalDeActividad = (a, peso) => kcalActivas({met: metActividad(a), minutos: a.minutos, peso})
export const kcalDeRuta = (r, peso) =>
  kcalActivas({met: metActividad({tipo: r.tipo, minutos: r.seg / 60, km: r.distM / 1000}), minutos: r.seg / 60, peso})

export const minutosSesion = s => {
  const m = (s?.bloques || []).reduce((t, b) => t + (+b?.minutos || 0), 0)
  return m > 0 ? m : MIN_SESION_SIN_BLOQUES
}
export const kcalDeSesion = (s, peso) => kcalActivas({met: metEntreno(s?.rpe), minutos: minutosSesion(s), peso})

// Peso más cercano en el tiempo a `fecha` (antes o después). null si no hay ninguno.
export function pesoCercano(medidas = [], fecha) {
  const t = new Date(fecha + 'T12:00:00').getTime()
  let mejor = null,
    dist = Infinity
  for (const m of medidas) {
    if (!pesoValido(m?.peso) || !m.fecha) continue
    const d = Math.abs(new Date(m.fecha + 'T12:00:00').getTime() - t)
    if (d < dist || (d === dist && m.fecha > mejor.fecha)) {
      mejor = m
      dist = d
    }
  }
  return mejor ? +mejor.peso : null
}

export const pasosDeHabito = (habitos = [], fecha) => {
  const p = +habitos.find(h => h?.fecha === fecha)?.pasos
  return p > 0 ? Math.floor(p) : 0
}

// Pasos que ya están dentro de caminatas y carreras (actividades y rutas) y no se vuelven a contar.
export const pasosCubiertos = items =>
  Math.round(items.reduce((t, x) => t + (PASOS_POR_MIN[x.tipo] || 0) * minutosOk(x.minutos), 0))

const suma = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0)

// Gasto de un día. Una ruta que ya está dentro de una actividad no se cuenta dos veces (misma regla que el movimiento).
// Devuelve {kcal, entreno, actividad, rutas, sinPeso}; cada parte es {kcal, minutos, cantidad}.
export function gastoDia({fecha, medidas = [], sesiones = [], actividades = [], rutas = [], habitos = []}) {
  const peso = pesoCercano(medidas, fecha)
  const ses = sesiones.filter(s => s.fecha === fecha),
    acts = actividades.filter(a => a.fecha === fecha),
    rs = rutasAparte(rutas.filter(r => r.fecha === fecha), acts)
  const parte = (lista, kcalDe, minDe) => {
    const items = lista.map(x => ({kcal: kcalDe(x, peso), minutos: minDe(x)}))
    return {kcal: suma(items, 'kcal'), minutos: Math.round(suma(items, 'minutos')), cantidad: lista.length}
  }
  const entreno = parte(ses, kcalDeSesion, minutosSesion),
    actividad = parte(acts, kcalDeActividad, a => minutosOk(a.minutos)),
    rutasP = parte(rs, kcalDeRuta, r => (+r.seg || 0) / 60)
  const total = pasosDeHabito(habitos, fecha),
    cubiertos = pasosCubiertos([...acts, ...rs.map(r => ({tipo: r.tipo, minutos: (+r.seg || 0) / 60}))]),
    sueltos = Math.max(0, total - cubiertos),
    kcalPasos = sueltos > 0 ? kcalActivas({met: MET_PASOS, minutos: sueltos / PASOS_POR_MIN.caminata, peso}) || 0 : 0
  const pasos = {kcal: kcalPasos, pasos: sueltos, cantidad: sueltos > 0 ? 1 : 0}
  return {
    peso,
    sinPeso: !peso,
    kcal: entreno.kcal + actividad.kcal + rutasP.kcal + pasos.kcal,
    entreno,
    actividad,
    rutas: rutasP,
    pasos
  }
}

// Gasto de una semana (lunes a domingo): total, promedio por día con gasto y desglose.
export function gastoSemana({desde, medidas = [], sesiones = [], actividades = [], rutas = [], habitos = []}) {
  const dias = Array.from({length: 7}, (_, i) => sumaDias(desde, i))
  const por = dias.map(f => ({fecha: f, ...gastoDia({fecha: f, medidas, sesiones, actividades, rutas, habitos})}))
  const conGasto = por.filter(d => d.kcal > 0)
  const kcal = suma(por, 'kcal')
  return {
    sinPeso: por.every(d => d.sinPeso),
    kcal,
    diasConGasto: conGasto.length,
    kcalPorDia: conGasto.length ? Math.round(kcal / conGasto.length) : null,
    entreno: Math.round(por.reduce((s, d) => s + d.entreno.kcal, 0)),
    actividad: Math.round(por.reduce((s, d) => s + d.actividad.kcal + d.rutas.kcal, 0)),
    pasos: Math.round(por.reduce((s, d) => s + d.pasos.kcal, 0)),
    haySesionesSinPeso: por.some(d => d.sinPeso && (d.entreno.cantidad || d.actividad.cantidad || d.rutas.cantidad || d.pasos.cantidad))
  }
}

export const AVISO_GASTO =
  'Es una estimación (±30 %): peso × tiempo × intensidad típica. Cuenta solo lo que gastás por encima del reposo. Los pasos suman aparte: solo los que no están dentro de una caminata o carrera ya registrada.'

export const textoKcal = n => `≈ ${Math.round(n).toLocaleString('es-UY')} kcal`
