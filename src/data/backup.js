// Backup de MMV: arma el archivo, lo descarga o lo comparte, y restaura.
import {db, hoy, cfg, setCfg, TABLAS, importarTabla} from './db.js'
import {INFO} from '../version.js'
import {ajustesDe, ajustesAplicables, nombreBackup, validarBackup} from '../domain/backup.js'
import {META, planRestaurarPrivado} from '../domain/privado.js'
import {archivos} from '../platform/archivos.js'

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
  for (const t of ['sesiones', 'registros', 'comidas', 'habitos', 'actividades'])
    if (await db[t].count()) return true
  return false
}
export const ultimoBackup = () => cfg('backup')
// Nombre del evento con que se avisa (a quien escuche, p. ej. los recordatorios) que se acaba de hacer un backup.
export const EVENTO_BACKUP = 'mmv:backup'
// Entrega 50: se anuncia al terminar de restaurar un backup (los ajustes ya están escritos). Los recordatorios lo escuchan para
// reprogramar los avisos y para volver a leer su configuración.
export const EVENTO_RESTAURADO = 'mmv:restaurado'
const marcar = () => {
  setCfg('backup', new Date().toISOString())
  try {
    globalThis.dispatchEvent?.(new Event(EVENTO_BACKUP))
  } catch {
    /* sin ventana (pruebas): no hay a quién avisar */
  }
}

// En el APK de Android siempre se puede compartir (hoja nativa); en la web, solo si el navegador lo permite.
export const puedeCompartir = () => {
  if (archivos.disponible()) return true
  try {
    const f = new File(['{}'], 'x.json', {type: 'application/json'})
    return !!navigator.canShare?.({files: [f]})
  } catch {
    return false
  }
}

// compartir=true intenta la hoja de compartir del celular (Drive, WhatsApp, correo…); si no se puede, descarga.
// En el APK (Entrega 42) el WebView no baja archivos `blob:`: ahí SIEMPRE se usa la hoja de compartir nativa, también con
// «Descargar» (desde esa hoja se puede guardar en Archivos o en Drive).
// Devuelve 'compartido' | 'descargado' | 'cancelado'.
export async function exportar({compartir = false} = {}) {
  const texto = JSON.stringify(await armarBackup(), null, 1)
  const nombre = nombreBackup(hoy())
  if (archivos.disponible()) {
    const r = await archivos.compartir(nombre, texto, 'Backup de MMV')
    if (r === 'compartido') {
      marcar()
      return 'compartido'
    }
    if (r === 'cancelado') return 'cancelado'
    throw new Error('No pude preparar el backup para compartirlo. Probá de nuevo.')
  }
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
  for (const [k, v] of ajustesAplicables(d._ajustes)) setCfg(k, v)
  try {
    if (d._sesion && !localStorage.getItem('mv_sesion'))
      localStorage.setItem('mv_sesion', JSON.stringify(d._sesion))
  } catch {}
  try {
    globalThis.dispatchEvent?.(new Event(EVENTO_RESTAURADO))
  } catch {
    /* sin ventana (pruebas): no hay a quién avisar */
  }
  return omitidas
}
