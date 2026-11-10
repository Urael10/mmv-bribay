// MMV · botón atrás de Android (Entrega 42, v0.43.0). Adaptador fino a @capacitor/app.
// Sin esto, el botón atrás cierra la app desde cualquier pantalla (MMV no usa el historial del navegador).
// Con un listener registrado, Capacitor ya no cierra la app por su cuenta: quien escucha decide si vuelve o sale.
// En el navegador y en la PWA no hace nada (`disponible()` es false y no se baja el plugin).
import {esAndroid} from './plataforma.js'

// `{app}` y no el plugin suelto: es un Proxy de Capacitor (ver notificaciones.js).
const cargarReal = () => import('@capacitor/app').then(m => ({app: m.App}))

export function crearAtras({cargar = cargarReal, android = esAndroid} = {}) {
  let caja = null
  const con = async f => f((caja ||= await cargar()).app)
  return {
    disponible: () => android() === true,

    /** Llama a `cb()` cada vez que se toca el botón atrás. Devuelve cómo dejar de escuchar. */
    async alAtras(cb) {
      if (!android()) return () => {}
      try {
        const {h} = await con(async a => ({h: await a.addListener('backButton', () => cb())}))
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

    /** Cierra la app (solo cuando ya no hay a dónde volver). */
    async salir() {
      if (!android()) return false
      try {
        await con(a => a.exitApp())
        return true
      } catch {
        return false
      }
    }
  }
}

export const atras = crearAtras()
