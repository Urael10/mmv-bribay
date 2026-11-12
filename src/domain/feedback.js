// Entrega 49 (v0.50.0) · sonido, vibración y festejo de metas (lógica pura, sin navegador ni Capacitor).
// Acá se decide QUÉ pasa en cada evento y CUÁNDO se festeja; cómo vibra o suena el teléfono lo hacen
// src/platform/hapticos.js y src/services/feedback.js.

export const NIVELES = ['off', 'vib', 'full'] // apagado · solo vibración · vibración y sonido
export const NIVEL_INICIAL = 'vib'
export const nivelDe = v => (NIVELES.includes(v) ? v : NIVEL_INICIAL)

// Metas que forman «el día cerrado» (los tres anillos de Hoy con meta propia).
export const METAS_DIA = ['agua', 'pasos', 'sueno']

// Vibración: patrón en ms (vibra, pausa, vibra…). Tono: lista de [Hz, ms].
export const EVENTOS = {
  toque: {vib: [12], tono: null},
  guardar: {vib: [18], tono: [[660, 70]]},
  meta: {vib: [20, 70, 35], tono: [[784, 110], [1047, 200]]},
  entreno: {vib: [200, 100, 200, 100, 500], tono: [[1320, 250], [1320, 250], [1760, 600]]},
  dia: {vib: [30, 60, 30, 60, 30, 60, 120], tono: [[784, 120], [988, 120], [1175, 120], [1568, 420]]}
}

// Qué hacer con un evento: `vib` (patrón o null) y `tono` (lista o null). El sonido solo en «full» y si el
// sonido del reloj no está apagado en Ajustes; un evento desconocido no hace nada.
export function accionesDe(evento, nivel, {sonidoActivo = true} = {}) {
  const e = EVENTOS[evento],
    n = nivelDe(nivel)
  if (!e || n === 'off') return {vib: null, tono: null}
  return {vib: e.vib, tono: n === 'full' && sonidoActivo ? e.tono : null}
}

// Cuándo empieza cada nota: las largas no se pisan, las cortas se separan un 10 %.
export function tiemposTono(tono) {
  let t = 0
  return (tono || []).map(([f, ms]) => {
    const n = {f, ms, t: Math.round(t * 1000) / 1000}
    t += (Math.min(ms, 260) / 1000) * (ms > 260 ? 1 : 1.1)
    return n
  })
}

// ---- Qué se festejó hoy (una sola vez por meta y por día) ----
// Estado: {f: fecha, m: [metas festejadas], d: true si ya se festejó el día cerrado}.
export const estadoVacio = fecha => ({f: fecha, m: [], d: false})

export function leerEstado(raw, fecha) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!o || o.f !== fecha) return estadoVacio(fecha)
    return {f: fecha, m: (Array.isArray(o.m) ? o.m : []).filter(k => METAS_DIA.includes(k)), d: o.d === true}
  } catch {
    return estadoVacio(fecha)
  }
}

export const yaFestejada = (estado, clave) => estado.m.includes(clave)
export const marcarMeta = (estado, clave) =>
  yaFestejada(estado, clave) || !METAS_DIA.includes(clave) ? estado : {...estado, m: [...estado.m, clave]}
export const marcarDia = estado => (estado.d ? estado : {...estado, d: true})

// ¿Están las tres metas cumplidas ahora? `cumplidas` es un Set (o lista) de claves.
export const cierraElDia = cumplidas => {
  const s = new Set(cumplidas)
  return METAS_DIA.every(k => s.has(k))
}

// ¿Una meta pasó de no cumplida a cumplida? `antes` es null mientras el dato no se cargó: la primera lectura
// es solo el punto de partida y no se festeja (abrir la app con la meta ya cumplida no hace nada).
export function cruzoMeta(antes, valor, meta) {
  if (antes === null || antes === undefined) return false
  const m = +meta
  if (!(m > 0)) return false
  return !(+antes >= m) && +valor >= m
}
