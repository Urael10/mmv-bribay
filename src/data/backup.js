// Backup de MMV: arma el archivo, lo descarga o lo comparte, y restaura.
import {db, hoy, cfg, setCfg, TABLAS, importarTabla} from './db.js'
import {INFO} from '../version.js'
import {AJUSTES, ajustesDe, nombreBackup, validarBackup} from '../domain/backup.js'
import {META, planRestaurarPrivado} from '../domain/privado.js'

export async function armarBackup() {
  const d = {
    _meta: {
      app: 'MMV',
      version: INFO.version,
      entrega: INFO.entrega,
      build: INFO.build,
      exportado: new Date().toISOString()
    }
  }
  for (const t of TABLAS) d[t] = await db[t].toArray()
  d._ajustes = ajustesDe(k => localStorage.getItem('mv_' + k)) // sin la clave de IA
  try {
    const s = JSON.parse(localStorage.getItem('mv_sesion') || 'null')
    if (s) d._sesion = s // sesión en curso
  } catch {}
  return d
}

export async function hayDatos() {
  for (const t of ['sesiones', 'registros', 'comidas', 'habitos'])
    if (await db[t].count()) return true
  return false
}
export const ultimoBackup = () => cfg('backup')
const marcar = () => setCfg('backup', new Date().toISOString())

export const puedeCompartir = () => {
  try {
    const f = new File(['{}'], 'x.json', {type: 'application/json'})
    return !!navigator.canShare?.({files: [f]})
  } catch {
    return false
  }
}

// compartir=true intenta la hoja de compartir del celular (Drive, WhatsApp, correo…); si no se puede, descarga.
// Devuelve 'compartido' | 'descargado' | 'cancelado'.
export async function exportar({compartir = false} = {}) {
  const texto = JSON.stringify(await armarBackup(), null, 1)
  const nombre = nombreBackup(hoy())
  if (compartir && puedeCompartir()) {
    try {
      const file = new File([texto], nombre, {type: 'application/json'})
      await navigator.share({files: [file], title: 'Backup de MMV'})
      marcar()
      return 'compartido'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
      // si falla por otra razón, cae a la descarga
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], {type: 'application/json'}))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  marcar()
  return 'descargado'
}

// Devuelve cuántos registros se omitieron por estar repetidos.
export async function restaurar(d) {
  if (!validarBackup(d)) throw new Error('No parece un backup de MMV.')
  let omitidas = 0
  for (const t of TABLAS) {
    if (!Array.isArray(d[t])) continue
    if (t === 'privado') {
      // El registro privado viaja cifrado: solo se importa si la clave del backup es la de este equipo (o aquí no hay ninguna).
      const plan = planRestaurarPrivado(await db.privado.get(META), d[t])
      omitidas += plan.omitidas
      if (plan.importar.length) omitidas += await importarTabla(t, plan.importar)
      continue
    }
    omitidas += await importarTabla(t, d[t])
  }
  if (d._ajustes && typeof d._ajustes === 'object')
    for (const k of AJUSTES) if (d._ajustes[k]) setCfg(k, String(d._ajustes[k]))
  try {
    if (d._sesion && !localStorage.getItem('mv_sesion'))
      localStorage.setItem('mv_sesion', JSON.stringify(d._sesion))
  } catch {}
  return omitidas
}
