// Entrega un archivo de texto a la persona (Entrega 27): hoja de compartir del celular si existe;
// si no, descarga. Devuelve 'compartido' | 'descargado' | 'cancelado'. No hay red de por medio.
// Entrega 42: en el APK de Android el WebView no baja archivos `blob:`, así que ahí se usa la hoja de compartir nativa
// (src/platform/archivos.js). Si no se puede preparar el archivo, lanza un Error y quien llama muestra su aviso.
import {archivos} from '../platform/archivos.js'

export async function entregarArchivo(nombre, texto, tipo = 'application/gpx+xml') {
  if (archivos.disponible()) {
    const r = await archivos.compartir(nombre, texto, nombre)
    if (r === 'compartido' || r === 'cancelado') return r
    throw new Error('No pude preparar el archivo para compartirlo.')
  }
  try {
    const file = new File([texto], nombre, {type: tipo})
    if (navigator.canShare?.({files: [file]})) {
      await navigator.share({files: [file], title: nombre})
      return 'compartido'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelado'
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], {type: tipo}))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  return 'descargado'
}
