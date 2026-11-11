// Entrega 45 · Motor de señales local y Nota del día (lógica pura, sin React ni base de datos).
// Mira los datos de HOY (y lo que hace falta de los últimos 28 días) y devuelve las señales que vale la pena decir,
// de la más importante a la menos. Todo se calcula en el teléfono: nada de esto sale de la app ni va a la IA
// (el gasto estimado tampoco; una prueba lo vigila).
//
// Los umbrales de abajo son una propuesta de diseño, no una recomendación médica ni sacados de un estudio.
// Tono: amable y sin culpa. Una señal describe lo que pasa y, como mucho, sugiere algo chico.
import {sumaDias} from './stats.js'
import {suenoHabitual, puntajeCarga} from './preparacion.js'
import {cargasExternas} from './movimiento.js'
import {gastoDia, textoKcal} from './gasto.js'
import {totales} from './alimentos.js'
import {proteinaObjetivo, ultima, PROT_KG} from './cuerpo.js'
import {parsearMeta, promedioPasos, metaEfectiva} from './metaPasos.js'

export const MAX_SENALES = 3 // cuántas se listan en el detalle (la franja muestra solo la primera)
export const SUENO_CORTO_H = 6 // menos de esto es «una noche corta»
export const SUENO_BIEN_H = 7 // desde esto (o tu promedio, si es mayor) es «dormiste bien»
export const NOCHES_RACHA = 3 // ventana de noches para detectar «varias noches cortas»
export const NOCHES_CORTAS_MIN = 2 // cuántas cortas dentro de la ventana hacen racha
export const AGUA_DESDE_H = 8 // el agua «esperada» sube linealmente entre estas horas…
export const AGUA_HASTA_H = 20 // …y llega a la meta completa
export const AGUA_AVISO_DESDE_H = 12 // antes de esta hora no se avisa del agua
export const AGUA_MARGEN = 0.25 // cuánto por debajo de lo esperado (fracción de la meta) para avisar
export const COMIDA_SIN_REGISTRO_H = 15 // desde esta hora, sin comidas cargadas, se recuerda
export const PROTEINA_AVISO_H = 17
export const PROTEINA_FRACCION_MIN = 0.6 // menos de esto de la meta de proteína a esa hora → aviso
export const KCAL_PASADA = 1.15 // por encima de esto de la meta de kcal → «pasaste»
export const KCAL_EN_META = [0.85, 1.15] // banda de «vas en tu meta»
export const KCAL_EN_META_H = 18
export const PASOS_AVISO_H = 18
export const PASOS_FRACCION_MIN = 0.5
export const CARGA_ALTA = 1.5 // razón aguda/crónica de preparacion.js
export const CARGA_SUBE = 1.3
export const CARGA_BAJA = 0.6

const num = x => {
  const n = parseFloat(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const horasDe = h => (num(h?.sueno) > 0 ? num(h.sueno) : 0)
const coma = (n, d = 1) => String(+n.toFixed(d)).replace('.', ',')
const miles = n => Math.round(n).toLocaleString('es-AR')
const senal = (id, tipo, prioridad, corto, texto) => ({id, tipo, prioridad, corto, texto})

// ---------- Sueño ----------
export function senalSueno({habitos = [], fecha}) {
  const h = habitos.find(x => x.fecha === fecha),
    horas = horasDe(h)
  if (!horas) return null
  const cortas = Array.from({length: NOCHES_RACHA}, (_, i) => horasDe(habitos.find(x => x.fecha === sumaDias(fecha, -i)))).filter(
    x => x > 0 && x < SUENO_CORTO_H
  ).length
  if (horas < SUENO_CORTO_H && cortas >= NOCHES_CORTAS_MIN)
    return senal(
      'sueno-racha',
      'sueno',
      85,
      `Van ${cortas} de las últimas ${NOCHES_RACHA} noches con poco sueño`,
      `Hoy dormiste ${coma(horas)} h y ya van ${cortas} noches cortas entre las últimas ${NOCHES_RACHA}. Hoy puede convenir ir más suave y acostarte un poco antes.`
    )
  if (horas < SUENO_CORTO_H)
    return senal(
      'sueno-corto',
      'sueno',
      80,
      `Dormiste ${coma(horas)} h: una noche corta`,
      `Dormiste ${coma(horas)} h. Una noche corta pasa; si entrenás, escuchá al cuerpo y bajá el ritmo si hace falta.`
    )
  const hab = suenoHabitual(habitos, fecha)
  if (horas >= Math.max(SUENO_BIEN_H, hab ?? 0))
    return senal('sueno-bien', 'sueno', 20, `Dormiste bien: ${coma(horas)} h`, `Dormiste ${coma(horas)} h${hab ? `, por encima de tu promedio de ${coma(hab)} h` : ''}. Buen punto de partida para el día.`)
  return null
}

// ---------- Agua ----------
export const aguaEsperada = hora => Math.max(0, Math.min(1, (hora - AGUA_DESDE_H) / (AGUA_HASTA_H - AGUA_DESDE_H)))
export function senalAgua({habitos = [], fecha, hora = 12, metaAgua}) {
  const meta = num(metaAgua),
    ml = num(habitos.find(x => x.fecha === fecha)?.agua) || 0
  if (!(meta > 0)) return null
  if (ml >= meta) return senal('agua-meta', 'agua', 15, 'Meta de agua cumplida', `Llegaste a ${miles(ml)} ml de ${miles(meta)} ml. Listo por hoy.`)
  if (hora >= AGUA_AVISO_DESDE_H && ml / meta < aguaEsperada(hora) - AGUA_MARGEN)
    return senal(
      'agua-poca',
      'agua',
      60,
      `Vas con poca agua: ${miles(ml)} de ${miles(meta)} ml`,
      `Llevás ${miles(ml)} ml de ${miles(meta)} ml para esta hora. Un vaso ahora te acerca.`
    )
  return null
}

// ---------- Comida ----------
const itemsDe = (comidas, fecha) => comidas.filter(c => c.fecha === fecha).flatMap(c => c.items || [])
export function senalComida({comidas = [], medidas = [], fecha, hora = 12, metaKcal, protKg = PROT_KG}) {
  const items = itemsDe(comidas, fecha),
    t = totales(items),
    meta = num(metaKcal)
  if (!(t.kcal > 0)) {
    return hora >= COMIDA_SIN_REGISTRO_H
      ? senal('comida-vacia', 'comida', 50, 'Todavía no registraste comidas hoy', 'Si ya comiste, cargalo en Comidas para que el día cuente.')
      : null
  }
  const metaP = proteinaObjetivo(ultima(medidas)?.peso, num(protKg) || PROT_KG)
  if (metaP && hora >= PROTEINA_AVISO_H && t.p < metaP * PROTEINA_FRACCION_MIN)
    return senal(
      'comida-proteina',
      'comida',
      55,
      `Te faltan unos ${Math.max(5, Math.round((metaP - t.p) / 5) * 5)} g de proteína`,
      `Llevás ${Math.round(t.p)} g de ${metaP} g de proteína. Lo que queda del día puede ayudar a acercarte.`
    )
  if (meta > 0 && t.kcal > meta * KCAL_PASADA)
    return senal(
      'comida-pasada',
      'comida',
      40,
      `Ya pasaste tu meta de kcal: ${miles(t.kcal)} de ${miles(meta)}`,
      `Llevás ${miles(t.kcal)} kcal de ${miles(meta)}. Un día no define la semana.`
    )
  if (meta > 0 && hora >= KCAL_EN_META_H && t.kcal >= meta * KCAL_EN_META[0] && t.kcal <= meta * KCAL_EN_META[1])
    return senal('comida-en-meta', 'comida', 18, `Vas en tu meta de kcal: ${miles(t.kcal)} de ${miles(meta)}`, `Estás dentro de tu banda de calorías de hoy (${miles(t.kcal)} de ${miles(meta)} kcal).`)
  return null
}

// ---------- Actividad (pasos) ----------
export function senalActividad({habitos = [], fecha, hora = 12, metaPasos = ''}) {
  const pasos = num(habitos.find(x => x.fecha === fecha)?.pasos) || 0
  const ef = metaEfectiva({meta: parsearMeta(metaPasos).meta, promedio: promedioPasos(habitos, fecha)})
  if (!(ef.valor > 0) || !(pasos > 0)) return null
  if (pasos >= ef.valor)
    return senal('pasos-meta', 'actividad', 20, `Meta de pasos cumplida: ${miles(pasos)}`, `Llevás ${miles(pasos)} pasos y tu referencia es ${miles(ef.valor)}.`)
  if (hora >= PASOS_AVISO_H && pasos < ef.valor * PASOS_FRACCION_MIN)
    return senal('pasos-pocos', 'actividad', 45, `Pocos pasos hoy: ${miles(pasos)} de ${miles(ef.valor)}`, `Llevás ${miles(pasos)} de ${miles(ef.valor)} pasos. Una caminata corta suma.`)
  return null
}

// ---------- Gasto estimado ----------
export function senalGasto({medidas = [], sesiones = [], actividades = [], rutas = [], fecha}) {
  const g = gastoDia({fecha, medidas, sesiones, actividades, rutas}),
    hubo = g.entreno.cantidad + g.actividad.cantidad + g.rutas.cantidad > 0
  if (g.kcal > 0)
    return senal(
      'gasto-hoy',
      'gasto',
      25,
      `Actividad de hoy: ${textoKcal(g.kcal)}`,
      `Entreno y actividad suman ${textoKcal(g.kcal)} por encima del reposo. Es una estimación (±30 %) y los pasos no se suman.`
    )
  if (hubo && g.sinPeso)
    return senal('gasto-sin-peso', 'gasto', 22, 'Cargá tu peso para estimar el gasto de hoy', 'Hubo actividad hoy, pero sin un peso registrado en Cuerpo no se puede estimar el gasto.')
  return null
}

// ---------- Carga ----------
export function senalCarga({sesiones = [], actividades = [], rutas = [], fecha}) {
  const r = puntajeCarga(sesiones, fecha, cargasExternas(actividades, rutas))
  if (!r) return null
  const x = `×${coma(r.razon)}`
  if (r.razon >= CARGA_ALTA)
    return senal(
      'carga-alta',
      'carga',
      70,
      `Tu carga de la semana viene alta (${x} de lo habitual)`,
      `Esta semana cargás ${x} lo que venías haciendo. Una sesión más liviana o un día de descanso ayuda a sostenerlo.`
    )
  if (r.razon >= CARGA_SUBE)
    return senal('carga-sube', 'carga', 50, `Tu carga subió (${x} de lo habitual)`, `Esta semana cargás ${x} lo que venías haciendo. Si te sentís bien, está dentro de lo razonable; mirá cómo respondés.`)
  if (r.razon <= CARGA_BAJA)
    return senal('carga-baja', 'carga', 30, `Semana liviana (${x} de lo habitual)`, `Esta semana cargás ${x} lo que venías haciendo. Si fue a propósito, bien; si no, retomá de a poco.`)
  return null
}

// ---------- Nota del día ----------
// datos: {fecha, hora, habitos, comidas, sesiones, actividades, rutas, medidas, metaKcal, metaAgua, metaPasos, protKg}
// → {principal, lista, hayDatos}. `principal` es null solo si no hay ningún dato con qué hablar.
export function notaDelDia(d = {}) {
  const {fecha, hora = 12, habitos = [], comidas = [], sesiones = [], actividades = [], rutas = [], medidas = []} = d
  const fila = habitos.find(x => x.fecha === fecha)
  const hayDatos =
    horasDe(fila) > 0 ||
    (num(fila?.agua) || 0) > 0 ||
    (num(fila?.pasos) || 0) > 0 ||
    itemsDe(comidas, fecha).length > 0 ||
    sesiones.some(s => s.fecha >= sumaDias(fecha, -28)) ||
    actividades.length + rutas.length > 0
  const todas = [
    senalSueno({habitos, fecha}),
    senalAgua({habitos, fecha, hora, metaAgua: d.metaAgua}),
    senalComida({comidas, medidas, fecha, hora, metaKcal: d.metaKcal, protKg: d.protKg}),
    senalActividad({habitos, fecha, hora, metaPasos: d.metaPasos}),
    senalGasto({medidas, sesiones, actividades, rutas, fecha}),
    senalCarga({sesiones, actividades, rutas, fecha})
  ].filter(Boolean)
  const lista = todas.map((s, i) => [s, i]).sort((a, b) => b[0].prioridad - a[0].prioridad || a[1] - b[1]).map(x => x[0]).slice(0, MAX_SENALES)
  if (lista.length) return {principal: lista[0], lista, hayDatos}
  if (!hayDatos) return {principal: null, lista: [], hayDatos}
  const tranquilo = senal('tranquilo', 'general', 0, 'Sin novedades por ahora', 'No hay nada fuera de lo habitual en tus datos de hoy.')
  return {principal: tranquilo, lista: [tranquilo], hayDatos}
}

export const AVISO_NOTA = 'Es una lectura de tus propios datos, hecha en el teléfono. No es un consejo médico.'
