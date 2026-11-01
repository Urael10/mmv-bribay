// Backup: reglas puras (sin base de datos ni navegador).
export const DIAS_AVISO = 7
// Ajustes que viajan en el backup. La clave de IA NO va nunca.
export const AJUSTES = ['meta', 'metakcal', 'modelo', 'sonido']

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

export function ajustesDe(leer) {
  const o = {}
  for (const k of AJUSTES) {
    const v = leer(k)
    if (v) o[k] = v
  }
  return o
}
