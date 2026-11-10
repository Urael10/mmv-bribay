// MMV · entregar archivos desde el APK de Android (Entrega 42, v0.43.0).
// El WebView de Android no baja archivos creados con `blob:` ni tiene la hoja de compartir web, así que acá un backup o
// un GPX se escribe en la carpeta de caché de la app (@capacitor/filesystem) y se manda a la hoja de compartir del
// teléfono (@capacitor/share): ahí la persona elige Drive, Archivos, WhatsApp, correo…
// Regla de la arquitectura: solo src/platform conoce a Capacitor. En el navegador y en la PWA `disponible()` es false y
// nada de acá toca los plugins (siguen las rutas web de siempre: navigator.share o descarga).
import {esAndroid} from './plataforma.js'

// Los plugins se bajan recién al hacer falta. `cargar` devuelve `{fs, share, Directory, Encoding}` (un objeto plano:
// los plugins de Capacitor son Proxy y NUNCA se devuelven sueltos desde una función async; ver notificaciones.js).
const cargarReal = async () => {
  const [f, s] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  return {fs: f.Filesystem, share: s.Share, Directory: f.Directory, Encoding: f.Encoding}
}

// El nombre llega de afuera (fecha, tipo): se deja solo lo que cualquier sistema de archivos acepta.
export const nombreSeguro = n => String(n || 'archivo').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '') || 'archivo'

// «Share canceled» (Android) o «AbortError»: la persona cerró la hoja sin elegir nada.
const esCancelado = e => /cancel|abort|dismiss/i.test(String(e?.message || e?.name || e))

export function crearArchivos({cargar = cargarReal, android = esAndroid} = {}) {
  let caja = null
  return {
    /** true solo en el APK de Android. */
    disponible: () => android() === true,

    /**
     * Escribe `texto` en la caché con `nombre` y abre la hoja de compartir.
     * Devuelve 'compartido' | 'cancelado' | 'no-disponible' | 'error' (nunca lanza).
     */
    async compartir(nombre, texto, titulo = nombre) {
      if (!android()) return 'no-disponible'
      try {
        const c = (caja ||= await cargar())
        const f = nombreSeguro(nombre)
        const {uri} = await c.fs.writeFile({path: f, data: String(texto), directory: c.Directory.Cache, encoding: c.Encoding.UTF8})
        try {
          await c.share.share({title: titulo, dialogTitle: titulo, files: [uri]})
          return 'compartido'
        } catch (e) {
          return esCancelado(e) ? 'cancelado' : 'error'
        }
      } catch {
        return 'error'
      }
    }
  }
}

export const archivos = crearArchivos()
