import {sumaDias} from './stats.js'

// Entrega 33 · Modo sueño con alarma (lógica pura). Las horas salen de dos instantes (acostarse y apagar la alarma);
// no se mide el sueño real: es tiempo en cama, y la persona puede corregirlo antes de guardarlo.

export const HORAS_MIN = 0.25 // por debajo de esto se descarta (probablemente un toque por error)
export const HORAS_MAX = 16 // por encima, casi seguro se olvidó apagar: se pide cargarlas a mano
export const HORAS_MAX_DIA = 24 // tope del total del día (noche + siestas)
export const TOLERANCIA_MS = 10 * 60 * 1000 // si la alarma pasó hace más y no la vimos sonar, no suena de golpe
export const ALARMA_INICIAL = '07:00'

// «7:05» o «07:05» → {h, m}; null si no es una hora válida.
export function parseHora(txt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(txt ?? '').trim())
  if (!m) return null
  const h = Number(m[1]),
    mi = Number(m[2])
  return h <= 23 && mi <= 59 ? {h, m: mi} : null
}

// Próximo instante (ms) en que el reloj marca `txt` estrictamente después de `ahoraMs`; null si la hora no es válida.
export function proximaAlarma(ahoraMs, txt) {
  const p = parseHora(txt)
  if (!p || !Number.isFinite(ahoraMs)) return null
  const d = new Date(ahoraMs)
  d.setHours(p.h, p.m, 0, 0)
  if (d.getTime() <= ahoraMs) d.setDate(d.getDate() + 1)
  return d.getTime()
}

// Horas entre dos instantes, a décimas. null si no son plausibles.
export function horasDormidas(inicioMs, finMs) {
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= inicioMs) return null
  const h = (finMs - inicioMs) / 36e5
  if (h < HORAS_MIN || h > HORAS_MAX) return null
  return Math.round(h * 10) / 10
}

// Texto del campo de horas («7,5» o «7.5») → número a décimas, o null si no es válido.
// `max`: 16 h para una sola sesión; el total del día admite hasta HORAS_MAX_DIA.
export function parseHoras(txt, max = HORAS_MAX) {
  const t = String(txt ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Math.round(Number(t) * 10) / 10
  return n >= HORAS_MIN && n <= max ? n : null
}

// Entrega 36 · Total del día. Horas ya guardadas en el check-in (número o texto «7,5»); 0 si no hay dato válido.
export function horasPrevias(v) {
  if (v == null || v === '') return 0
  const n = Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 10) / 10, HORAS_MAX_DIA) : 0
}

// Suma lo ya guardado con la sesión nueva, a décimas y sin pasar de HORAS_MAX_DIA. null si la sesión no es válida.
export function sumarHoras(previo, nueva) {
  const n = Number(nueva)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round((horasPrevias(previo) + n) * 10) / 10, HORAS_MAX_DIA)
}

// Día calendario local («2026-11-07») de un instante: el mismo criterio que `hoy()` de la base de datos.
export function fechaDeMs(ms) {
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms),
    z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

// Lo que se propone en el resumen: las horas de esta sesión, lo ya guardado ese día y el total a confirmar.
// `total` es null si la sesión no es plausible (se pide cargar el total a mano).
export function propuestaDia({previo, inicio, fin}) {
  const antes = horasPrevias(previo),
    sesion = horasDormidas(inicio, fin)
  return {antes, sesion, total: sesion == null ? null : sumarHoras(antes, sesion)}
}

export const textoHoras = h => `${String(h).replace('.', ',')} h`

// «6 h 40 min», «25 min».
export function textoDuracion(ms) {
  const min = Math.max(0, Math.round((Number(ms) || 0) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60),
    r = min % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

// Volumen de la alarma (0–1): arranca bajo y sube de a poco para no despertar de un sobresalto.
export const volumenAlarma = seg => {
  const s = Math.max(0, Number(seg) || 0)
  return Math.round(Math.min(0.6, 0.08 + s * 0.01) * 100) / 100
}

// Sesión de sueño guardada en el teléfono: {inicio, alarma, fin|null} (todo en ms).
export const nuevaSesion = (inicio, alarma) => ({inicio, alarma, fin: null})
export const sesionParaGuardar = s => JSON.stringify({inicio: s.inicio, alarma: s.alarma, fin: s.fin ?? null})
export function sesionDesdeGuardado(txt) {
  try {
    const s = JSON.parse(txt)
    const ok = x => Number.isFinite(x) && x > 0
    if (!s || !ok(s.inicio) || !ok(s.alarma) || s.alarma <= s.inicio) return null
    if (s.fin != null && !(ok(s.fin) && s.fin >= s.inicio)) return null
    return {inicio: s.inicio, alarma: s.alarma, fin: s.fin ?? null}
  } catch {
    return null
  }
}

// Fase de la pantalla: 'durmiendo' (antes de la alarma), 'sonando', 'resumen' (ya apagada o se abrió tarde) o null.
// `vivo`: la app estaba abierta antes de la hora; `sono`: ya la vimos sonar en esta apertura.
export function faseSueno({sesion, ahora, vivo = false, sono = false}) {
  if (!sesion) return null
  if (sesion.fin != null) return 'resumen'
  if (ahora < sesion.alarma) return 'durmiendo'
  if (sono || (vivo && ahora - sesion.alarma <= TOLERANCIA_MS)) return 'sonando'
  return 'resumen'
}

// Hora de despertar que se propone en el resumen: la de apagar la alarma, o (si se abrió tarde) la de la alarma.
export const finPropuesto = s => s.fin ?? s.alarma

// Otra hora posible para el resumen (la alarma o ahora), solo si difiere en más de 10 min de la elegida.
export function alternativaFin({sesion, ahora}) {
  const fin = finPropuesto(sesion),
    alt = fin === sesion.alarma ? ahora : sesion.alarma
  if (Math.abs(alt - fin) <= 10 * 60 * 1000) return null
  return horasDormidas(sesion.inicio, alt) == null ? null : alt
}

// ===== Entrega 39 · Registro de sueño con horas de acostarse y levantarse =====
// La fila de hábitos del día suma dos campos opcionales: `acosto` y `desperto` («23:30», «07:15»). `sueno` sigue siendo
// el total del día en horas (puede incluir siestas); `calidad` va de 1 a 5. Sin esquema nuevo: es la misma fila.
export const OBJETIVO_SUENO_H = 8 // referencia del anillo de la tesela de Hoy (no es una recomendación médica)
export const NOCHE_MIN_H = 4 // una sesión de la alarma de al menos esto cuenta como «noche»; menos, como siesta
export const DURACIONES_RAPIDAS = [5, 6, 7, 8, 9]
export const DIAS_HABITUAL = 7 // días hacia atrás para calcular «Igual que siempre»
export const MIN_DIAS_HABITUAL = 2 // con menos días con ambas horas no se propone nada

const DIA_MIN = 1440
const minDeHora = txt => {
  const p = parseHora(txt)
  return p ? p.h * 60 + p.m : null
}
const horaDeMin = min => {
  const m = ((Math.round(min) % DIA_MIN) + DIA_MIN) % DIA_MIN,
    z = n => String(n).padStart(2, '0')
  return `${z(Math.floor(m / 60))}:${z(m % 60)}`
}
const r2 = n => Math.round(n * 100) / 100

// «HH:MM» local de un instante (la hora que marca el reloj del teléfono); null si no es un instante.
export function horaDeMs(ms) {
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return horaDeMin(d.getHours() * 60 + d.getMinutes())
}

// Horas entre acostarse y levantarse (cruza la medianoche si hace falta), a centésimas. null si falta una hora o
// si son iguales (no se sabe si fueron 0 o 24 horas).
export function horasEntre(acosto, desperto) {
  const a = minDeHora(acosto),
    d = minDeHora(desperto)
  if (a == null || d == null || a === d) return null
  return r2((d > a ? d - a : d - a + DIA_MIN) / 60)
}

// «7 h 15 min», «8 h», «45 min» a partir de horas (número o texto con coma); '' si no hay dato.
export function duracionHM(h) {
  const n = Number(String(h ?? '').replace(',', '.'))
  if (!(n > 0)) return ''
  const min = Math.round(n * 60),
    hh = Math.floor(min / 60),
    mm = min % 60
  return hh === 0 ? `${mm} min` : mm ? `${hh} h ${mm} min` : `${hh} h`
}
// Versión corta para la tesela: «7 h 45», «8 h», «45 min».
export function duracionCorta(h) {
  const t = duracionHM(h)
  return t.endsWith(' min') && t.includes(' h ') ? t.slice(0, -4) : t
}

// Horas del día que no vienen de la noche (siestas u otras sesiones): total guardado menos lo que dan las dos horas.
// 0 si falta alguna hora o si la diferencia es menor a 5 min. Se redondea a 10 min: el total puede venir a décimas.
export function extraSiestas(h) {
  const noche = horasEntre(h?.acosto, h?.desperto),
    total = Number(String(h?.sueno ?? '').replace(',', '.'))
  if (noche == null || !(total > 0)) return 0
  const dif = total - noche
  return dif >= 5 / 60 ? Math.round((dif * 60) / 10) / 6 : 0
}

// Parche para la fila al cambiar una de las dos horas. Con las dos horas puestas recalcula `sueno` y conserva lo que
// ya había de siestas (para no borrarlas al corregir la hora). Con una sola, solo guarda la hora.
export function reaplicarNoche(h, acosto, desperto) {
  const a = acosto || null,
    d = desperto || null,
    nueva = horasEntre(a, d)
  if (nueva == null) return {acosto: a, desperto: d}
  const extra = extraSiestas(h)
  return {acosto: a, desperto: d, sueno: Math.min(r2(nueva + extra), HORAS_MAX_DIA)}
}

// Mediana de una lista de minutos.
const mediana = v => {
  const o = [...v].sort((x, y) => x - y),
    m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}
// «Igual que siempre»: mediana de la hora de acostarse y de levantarse de los últimos días (sin contar `fecha`),
// redondeada a 5 min. Acostarse se mide con la medianoche en el medio (23:30 y 00:30 dan 00:00, no 12:00).
// null si hay menos de MIN_DIAS_HABITUAL días con las dos horas.
export function habitualNoche(habitos, fecha, dias = DIAS_HABITUAL) {
  const d0 = sumaDias(fecha, -dias)
  const f = (habitos || []).filter(
    x => x && x.fecha >= d0 && x.fecha < fecha && minDeHora(x.acosto) != null && minDeHora(x.desperto) != null
  )
  if (f.length < MIN_DIAS_HABITUAL) return null
  const al = f.map(x => {
    const m = minDeHora(x.acosto)
    return m < 12 * 60 ? m + DIA_MIN : m // de madrugada cuenta como «después de la medianoche»
  })
  const r5 = m => Math.round(m / 5) * 5
  return {
    acosto: horaDeMin(r5(mediana(al))),
    desperto: horaDeMin(r5(mediana(f.map(x => minDeHora(x.desperto))))),
    dias: f.length
  }
}

// Lo que la alarma aporta a la fila al guardar: las dos horas, solo si la sesión es de noche (≥ NOCHE_MIN_H).
export function nocheDeSesion(inicioMs, finMs) {
  const h = horasDormidas(inicioMs, finMs)
  return h != null && h >= NOCHE_MIN_H ? {acosto: horaDeMs(inicioMs), desperto: horaDeMs(finMs)} : null
}

// Fracción del objetivo cubierta (0–1), para el texto accesible de la tesela.
export const fraccionSueno = horas => {
  const n = Number(horas)
  return Number.isFinite(n) && n > 0 ? Math.min(1, n / OBJETIVO_SUENO_H) : 0
}
