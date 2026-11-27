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
  'protkg',
  'metapasos',
  'alarmasueno',
  'ruta_ocultar'
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

const esObjetoPlano = v => !!v && typeof v === 'object' && !Array.isArray(v)
const esClaveTexto = v => typeof v === 'string' && v.trim().length > 0
const esClaveId = v =>
  (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length > 0)

// Clave primaria (pk) e índice único (unica) de cada tabla conocida de Dexie.
export const ESQUEMA_BACKUP = {
  sesiones: {autoId: true},
  habitos: {pk: 'fecha'},
  uso: {autoId: true},
  ejercicios: {pk: 'clave'},
  registros: {autoId: true},
  alimentos: {autoId: true, unica: 'clave'},
  comidas: {autoId: true},
  coach: {pk: 'semana'},
  plantillas: {autoId: true, unica: 'clave'},
  medidas: {pk: 'fecha'},
  tests: {autoId: true},
  rutinas: {autoId: true, unica: 'clave'},
  actividades: {autoId: true},
  rutas: {autoId: true}
}

export function validarContenidoBackup(d, esquemaExtra = null) {
  if (!esObjetoPlano(d)) return {ok: false, error: 'No parece un backup de MMV.'}
  const esquema = esquemaExtra ? {...ESQUEMA_BACKUP, ...esquemaExtra} : ESQUEMA_BACKUP
  const tieneTabla =
    Object.keys(esquema).some(t => Array.isArray(d[t])) || Object.values(d).some(Array.isArray)
  if (d._meta?.app !== 'MMV' && !tieneTabla) {
    return {ok: false, error: 'No parece un backup de MMV.'}
  }
  if (d._meta !== undefined && !esObjetoPlano(d._meta)) {
    return {ok: false, error: 'El backup tiene metadatos inválidos.'}
  }
  if (d._ajustes !== undefined && !esObjetoPlano(d._ajustes)) {
    return {ok: false, error: 'El backup tiene ajustes inválidos.'}
  }
  if (d._sesion !== undefined && !esObjetoPlano(d._sesion)) {
    return {ok: false, error: 'El backup tiene una sesión en curso inválida.'}
  }
  for (const [tabla, regla] of Object.entries(esquema)) {
    const filas = d[tabla]
    if (filas === undefined) continue // backups antiguos pueden no traer tablas nuevas
    if (!Array.isArray(filas)) {
      return {ok: false, error: `El backup tiene una tabla inválida (${tabla}).`}
    }
    const pks = new Set()
    const ids = new Set()
    const unicas = new Set()
    for (const f of filas) {
      if (!esObjetoPlano(f)) {
        return {ok: false, error: `El backup tiene una fila inválida en ${tabla}.`}
      }
      if (regla.pk) {
        const k = f[regla.pk]
        if (!esClaveTexto(k)) {
          return {ok: false, error: `El backup tiene una fila sin ${regla.pk} en ${tabla}.`}
        }
        if (pks.has(k)) {
          return {ok: false, error: `El backup tiene claves duplicadas en ${tabla}.`}
        }
        pks.add(k)
      }
      if (regla.autoId && f.id !== undefined) {
        if (!esClaveId(f.id)) {
          return {ok: false, error: `El backup tiene un id inválido en ${tabla}.`}
        }
        if (ids.has(f.id)) {
          return {ok: false, error: `El backup tiene ids duplicados en ${tabla}.`}
        }
        ids.add(f.id)
      }
      if (regla.unica && f[regla.unica] !== undefined) {
        const u = f[regla.unica]
        if (!esClaveTexto(u)) {
          return {ok: false, error: `El backup tiene una clave única inválida en ${tabla}.`}
        }
        if (unicas.has(u)) {
          return {ok: false, error: `El backup tiene claves únicas duplicadas en ${tabla}.`}
        }
        unicas.add(u)
      }
    }
  }
  return {ok: true, error: null}
}

export function validarBackup(d) {
  return validarContenidoBackup(d).ok
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
  if (typeof v === 'string') return v || null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
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
