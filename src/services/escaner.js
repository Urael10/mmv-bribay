// Lector de códigos de barras con la cámara (lógica sin React, para poder probarla sin cámara).
// Usa BarcodeDetector del navegador (Chrome/Edge en Android y escritorio compatibles). Si no existe, la app avisa y se tipea el número.
import {gtinValido, soloDigitos} from './off.js'

export const FORMATOS = ['ean_13', 'ean_8', 'upc_a']
export const INTERVALO_MS = 250

// UPC-A (12 dígitos) se guarda en OFF como EAN-13 con un 0 adelante: se unifica para que coincida con tu base y con la web.
export const canonico = c => {
  const d = soloDigitos(c)
  return d.length === 12 ? '0' + d : d
}

export const soportaEscaner = (g = globalThis) =>
  typeof g.BarcodeDetector === 'function' && !!g.navigator?.mediaDevices?.getUserMedia

// Devuelve un detector listo, o lanza Error con un mensaje claro en español.
export async function crearDetector(g = globalThis) {
  if (typeof g.BarcodeDetector !== 'function')
    throw new Error(
      'Este navegador no puede leer códigos de barras con la cámara. Tipeá el número en el buscador.'
    )
  let formatos = FORMATOS
  try {
    const ok = await g.BarcodeDetector.getSupportedFormats?.()
    if (Array.isArray(ok)) {
      formatos = FORMATOS.filter(f => ok.includes(f))
      if (!formatos.length) throw new Error('x')
    }
  } catch {
    throw new Error(
      'Este navegador no lee los códigos de barras de alimentos (EAN/UPC). Tipeá el número en el buscador.'
    )
  }
  return new g.BarcodeDetector({formats: formatos})
}

// Mira un cuadro de video y devuelve el primer código válido (dígito de control correcto), o null.
export async function leerCuadro(detector, fuente) {
  let r
  try {
    r = await detector.detect(fuente)
  } catch {
    return null
  } // un cuadro que falla no corta el escaneo
  for (const b of r || []) {
    const c = canonico(b?.rawValue)
    if (gtinValido(c)) return c
  }
  return null
}

// Traduce los errores de getUserMedia a mensajes entendibles.
export function mensajeCamara(e) {
  const n = e?.name
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'No tengo permiso para usar la cámara. Permitila en los ajustes del navegador para este sitio y probá de nuevo.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError')
    return 'No encontré una cámara en este dispositivo. Tipeá el número en el buscador.'
  if (n === 'NotReadableError')
    return 'La cámara está siendo usada por otra app. Cerrala y probá de nuevo.'
  return e?.message || 'No pude abrir la cámara. Tipeá el número en el buscador.'
}

// Bucle de lectura: llama a alLeer(código) una sola vez y se detiene. Devuelve una función para cancelar.
export function iniciarLectura({
  detector,
  video,
  alLeer,
  intervalo = INTERVALO_MS,
  programar = setTimeout,
  cancelar = clearTimeout
}) {
  let activo = true,
    t = null
  const paso = async () => {
    if (!activo) return
    if (video.readyState >= 2) {
      const c = await leerCuadro(detector, video)
      if (c && activo) {
        activo = false
        alLeer(c)
        return
      }
    }
    if (activo) t = programar(paso, intervalo)
  }
  t = programar(paso, 0)
  return () => {
    activo = false
    if (t != null) cancelar(t)
  }
}
