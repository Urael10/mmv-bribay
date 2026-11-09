import {liveQuery} from 'dexie'
import {db, hoy, cfg, setCfg} from '../../data/db.js'
import {notificaciones} from '../../platform/notificaciones.js'
import {CLAVE_CFG, normalizarConfig, hayActivos, planRecordatorios} from '../../domain/recordatorios.js'
import {sumaDias} from '../../domain/stats.js'

// Entrega 41 (v0.42.0) · recordatorios: une la base (hábitos), la configuración (localStorage) y las notificaciones
// nativas (src/platform/notificaciones.js). La decisión de cuándo avisar vive en src/domain/recordatorios.js.

const MARCA = 'rec_programado' // «hay avisos programados por esta app» (para no cargar el plugin si nunca se activó nada)

export const leerConfig = () => normalizarConfig(cfg(CLAVE_CFG))
export const guardarConfig = c => setCfg(CLAVE_CFG, JSON.stringify(normalizarConfig(c)))

// Hábitos de los últimos días (los que usan el plan y «Acostarte»), con el de hoy.
export const habitosRecientes = () => {
  const f = hoy()
  return db.habitos.where('fecha').between(sumaDias(f, -8), f, true, true).toArray()
}

// Las reprogramaciones van de a una: cancelar y programar a la vez dejaría avisos duplicados.
let cola = Promise.resolve()
const enCola = fn => (cola = cola.then(fn, fn))

/** Recalcula el plan y deja programado exactamente eso. Devuelve {ok, n} o {ok:false, motivo}. */
export const reprogramar = (notif = notificaciones) =>
  enCola(async () => {
    if (!notif.disponible()) return {ok: false, motivo: 'no-disponible'}
    const config = leerConfig()
    if (!hayActivos(config)) {
      if (localStorage.getItem('mv_' + MARCA) === '1') {
        const r = await notif.cancelarTodo()
        if (r.ok) localStorage.removeItem('mv_' + MARCA)
        return r
      }
      return {ok: true, n: 0}
    }
    const plan = planRecordatorios({
      config,
      ahoraMs: Date.now(),
      hoy: hoy(),
      habitos: await habitosRecientes(),
      metaAgua: +cfg('meta', 2500)
    })
    const r = await notif.programar(plan)
    if (r.ok && r.n) setCfg(MARCA, '1')
    return r
  })

/**
 * Vigila los cambios que mueven el plan (cualquier cambio en los hábitos de los últimos días: check-in, agua, sueño)
 * y el regreso a la app (por si cambió el día), y reprograma. Solo hace algo en el APK. Devuelve cómo dejar de vigilar.
 */
export function vigilar(notif = notificaciones, {espera = 800} = {}) {
  if (!notif.disponible()) return () => {}
  let t = null
  const pedir = () => {
    clearTimeout(t)
    t = setTimeout(() => reprogramar(notif), espera)
  }
  const sub = liveQuery(habitosRecientes).subscribe({next: pedir, error: () => {}})
  const alVolver = () => document.visibilityState === 'visible' && pedir()
  document.addEventListener('visibilitychange', alVolver)
  return () => {
    clearTimeout(t)
    sub.unsubscribe()
    document.removeEventListener('visibilitychange', alVolver)
  }
}
