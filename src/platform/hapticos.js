// MMV · hápticos: adaptador fino a @capacitor/haptics (Entrega 49, v0.50.0).
// Regla de la arquitectura: solo src/platform conoce a Capacitor. Acá no se decide QUÉ vibrar (eso es
// src/domain/feedback.js); solo se ejecuta un patrón [vibra, pausa, vibra…] en ms.
//  · En el APK usa el plugin (vibra de verdad aunque el WebView no deje a navigator.vibrate).
//  · En el navegador / la PWA usa navigator.vibrate; si no existe, no hace nada.
//  · Todo es a prueba de fallos: vibrar nunca lanza un error ni frena lo que la persona estaba haciendo.
import {esNativo} from './plataforma.js'

// Devuelve `{plugin}` y NUNCA el plugin suelto: el objeto de Capacitor es un Proxy que responde a cualquier propiedad,
// también a `then`, y una promesa que lo devolviera quedaría colgada (mismo motivo que en notificaciones.js).
const cargarReal = () => import('@capacitor/haptics').then(m => ({plugin: m.Haptics}))

export function crearHapticos({cargar = cargarReal, nativo = esNativo, nav = globalThis.navigator, esperar = setTimeout} = {}) {
  let caja = null
  let secuencia = 0 // un patrón nuevo corta al anterior

  const web = patron => {
    try {
      return typeof nav?.vibrate === 'function' ? nav.vibrate(patron) !== false : false
    } catch {
      return false
    }
  }

  const nativa = async patron => {
    const id = ++secuencia
    try {
      const {plugin} = (caja ||= await cargar())
      for (let i = 0; i < patron.length; i++) {
        if (id !== secuencia) return true
        const ms = Math.max(0, Math.round(+patron[i] || 0))
        if (i % 2 === 0) {
          if (ms > 0) Promise.resolve(plugin.vibrate({duration: ms})).catch(() => {})
        }
        // Espera lo que dura esa vibración o esa pausa antes del siguiente tramo.
        if (i < patron.length - 1) await new Promise(r => esperar(r, ms))
      }
      return true
    } catch {
      return false
    }
  }

  return {
    /** patrón en ms (número o lista). true si el teléfono recibió la orden. */
    vibrar: async p => {
      const patron = (Array.isArray(p) ? p : [p]).map(Number).filter(Number.isFinite)
      if (!patron.length) return false
      return nativo() ? nativa(patron) : web(patron)
    }
  }
}

export const {vibrar} = crearHapticos()
