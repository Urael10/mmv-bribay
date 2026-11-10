// MMV · notificaciones locales: adaptador fino a @capacitor/local-notifications (Entrega 41, v0.42.0).
// Regla de la arquitectura: solo src/platform conoce a Capacitor. Acá no se decide CUÁNDO avisar (eso es
// src/domain/recordatorios.js); solo se programan, se cancelan y se pide el permiso.
//
// Tres decisiones que importan:
//  · El permiso se pide solo cuando la persona activa un recordatorio (`pedirPermiso`). `programar` NUNCA programa sin
//    permiso concedido: desde la 8.3.0 el plugin pide el permiso por su cuenta dentro de `schedule()`, y si programáramos
//    al abrir la app saldría el diálogo de Android sin que nadie lo haya pedido.
//  · Alarmas inexactas (`isExactNotification: false`): para recordar un check-in o un vaso de agua alcanza, y evita el
//    permiso SCHEDULE_EXACT_ALARM (que además se quita del manifiesto).
//  · En el navegador / la PWA no hay notificaciones nativas: `disponible()` es false y nada de acá toca el plugin.
import {esAndroid} from './plataforma.js'

export const CANAL = {
  id: 'recordatorios',
  name: 'Recordatorios',
  description: 'Avisos de check-in, de la hora de acostarte, de agua y de backup',
  importance: 3 // sonido por defecto, sin ventana emergente
}

// El plugin se baja recién cuando hace falta (en la PWA nunca se descarga). `cargar` se puede inyectar para probar y
// devuelve `{plugin}`, NUNCA el plugin suelto: el objeto de Capacitor es un Proxy que responde a cualquier propiedad,
// también a `then`. Si una promesa o una función `async` lo devolviera, JavaScript lo trataría como «thenable», llamaría a
// un método nativo `then()` que no existe y la promesa quedaría colgada para siempre (el permiso no se resolvería).
const cargarReal = () => import('@capacitor/local-notifications').then(m => ({plugin: m.LocalNotifications}))

// 'granted' | 'denied' | 'prompt'. El plugin también devuelve 'prompt-with-rationale': para nosotros es 'prompt'.
const estado = r => (r?.display === 'granted' ? 'granted' : r?.display === 'denied' ? 'denied' : 'prompt')

export function crearNotificaciones({cargar = cargarReal, android = esAndroid} = {}) {
  let caja = null
  // Ejecuta `f(plugin)`. `f` debe devolver datos planos (nunca el plugin).
  const con = async f => f((caja ||= await cargar()).plugin)

  const permiso = async () => {
    if (!android()) return 'no-disponible'
    try {
      return estado(await con(p => p.checkPermissions()))
    } catch {
      return 'no-disponible'
    }
  }

  return {
    /** true solo en el APK de Android. En el navegador y en la PWA no hay avisos nativos. */
    disponible: () => android() === true,

    /** 'granted' | 'denied' | 'prompt' | 'no-disponible' (sin pedir nada). */
    permiso,

    /** Muestra el diálogo de Android 13+ (si todavía se puede). Llamar solo cuando la persona activa algo. */
    async pedirPermiso() {
      if (!android()) return 'no-disponible'
      try {
        return estado(await con(p => p.requestPermissions()))
      } catch {
        return 'no-disponible'
      }
    },

    /**
     * Entrega 42 · avisa cuando la persona TOCA una notificación (`localNotificationActionPerformed`). `cb(tipo)` recibe el
     * `extra.tipo` que se guardó al programarla ('checkin', 'agua', …). El plugin retiene el toque hasta que haya quien
     * escuche, así que funciona aunque el listener se registre un instante después de abrir la app.
     * Devuelve una función para dejar de escuchar (siempre, también si falla o no hay plugin). El handle va en `{h}`: igual
     * que el plugin, nunca se devuelve suelto desde una función async.
     */
    async alTocarAviso(cb) {
      if (!android()) return () => {}
      try {
        const {h} = await con(async p => ({
          h: await p.addListener('localNotificationActionPerformed', ev => {
            const tipo = ev?.notification?.extra?.tipo
            if (typeof tipo === 'string') cb(tipo)
          })
        }))
        return () => {
          try {
            h?.remove?.()
          } catch {
            /* ya estaba quitado */
          }
        }
      } catch {
        return () => {}
      }
    },

    /** Cancela todo lo programado por la app. */
    async cancelarTodo() {
      if (!android()) return {ok: false, motivo: 'no-disponible'}
      try {
        await con(async p => {
          const {notifications = []} = await p.getPending()
          if (notifications.length) await p.cancel({notifications: notifications.map(n => ({id: n.id}))})
        })
        return {ok: true, n: 0}
      } catch (e) {
        return {ok: false, motivo: 'error', detalle: String(e?.message || e)}
      }
    },

    /**
     * Reemplaza lo programado por `plan` ([{id, cuando, tipo, titulo, cuerpo}], de src/domain/recordatorios.js).
     * Sin permiso concedido no programa nada. Devuelve {ok, n} o {ok:false, motivo}.
     */
    async programar(plan) {
      if (!android()) return {ok: false, motivo: 'no-disponible'}
      try {
        return await con(async p => {
          if (estado(await p.checkPermissions()) !== 'granted') return {ok: false, motivo: 'sin-permiso'}
          const {notifications = []} = await p.getPending()
          if (notifications.length) await p.cancel({notifications: notifications.map(n => ({id: n.id}))})
          if (!plan?.length) return {ok: true, n: 0}
          await p.createChannel(CANAL)
          await p.schedule({
            notifications: plan.map(r => ({
              id: r.id,
              title: r.titulo,
              body: r.cuerpo,
              channelId: CANAL.id,
              schedule: {at: new Date(r.cuando), allowWhileIdle: true},
              isExactNotification: false,
              extra: {tipo: r.tipo}
            }))
          })
          return {ok: true, n: plan.length}
        })
      } catch (e) {
        return {ok: false, motivo: 'error', detalle: String(e?.message || e)}
      }
    }
  }
}

export const notificaciones = crearNotificaciones()
