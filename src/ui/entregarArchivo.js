// Entrega un archivo de texto a la persona (Entrega 27): hoja de compartir del celular si existe;
// si no, descarga. Devuelve 'compartido' | 'descargado' | 'cancelado'. No hay red de por medio.
export async function entregarArchivo(nombre, texto, tipo = 'application/gpx+xml') {
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
