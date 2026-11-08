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
