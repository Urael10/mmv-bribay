// Backup: reglas puras (sin base de datos ni navegador).
import {normalizarConfig} from './recordatorios.js'
export const DIAS_AVISO = 7
// Ajustes que viajan en el backup. La clave de IA NO va nunca.
export const AJUSTES = [
  'meta',
  'metakcal',
  'modelo',
  'sonido',
  'feedback', // Entrega 49: nivel de sonidos y vibración
  'recordatorios', // Entrega 50: configuración de los avisos (JSON); se valida al ir y al volver
  'altura',
  'nac',
  'pesoobj',
  'fechaobj',
  'protkg'
]

export const diasDesde = (iso, ahora = Date.now()) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? Math.max(0, Math.floor((ahora - t) / 864e5)) : null
}

// ¿Mostrar el aviso? Solo si hay datos que perder y pasaron DIAS_AVISO (o nunca se hizo).
export function avisoBackup({ultimo, hayDatos, ahora = Date.now(), dias = DIAS_AVISO}) {
  if (!hayDatos) return null
  const d = diasDesde(ultimo, ahora)
  if (d === null) return {nunca: true, dias: null}
  return d >= dias ? {nunca: false, dias: d} : null
}

export const nombreBackup = fecha => `mmv-backup-${fecha}.json`

export function validarBackup(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    !Array.isArray(d) &&
    (d._meta?.app === 'MMV' || Object.values(d).some(Array.isArray))
  )
}

const comoObjeto = v => {
  let o = v
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o)
    } catch {
      return null
    }
  }
  return o && typeof o === 'object' && !Array.isArray(o) ? o : null
}

// Valor de un ajuste tal como se guarda en localStorage. La configuración de recordatorios se pasa por
// `normalizarConfig` (horas, días e intervalos válidos); si no es un objeto no se puede usar y devuelve null.
export function valorDeAjuste(k, v) {
  if (k === 'recordatorios') {
    const o = comoObjeto(v)
    return o ? JSON.stringify(normalizarConfig(o)) : null
  }
  return String(v)
}

export function ajustesDe(leer) {
  const o = {}
  for (const k of AJUSTES) {
    const v = leer(k)
    const val = v ? valorDeAjuste(k, v) : null
    if (val) o[k] = val
  }
  return o
}

// Lo que se escribe al restaurar: [clave, valor] solo de las claves conocidas y con valor usable. Un valor dañado
// no pisa lo que ya hay en el teléfono.
export function ajustesAplicables(guardados) {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return []
  const r = []
  for (const k of AJUSTES) {
    const v = Object.hasOwn(guardados, k) ? guardados[k] : null // nada heredado: solo lo que trae el archivo
    const val = v ? valorDeAjuste(k, v) : null
    if (val) r.push([k, val])
  }
  return r
}
