// Reduce la foto (máx. 1600 px, JPEG) y devuelve el base64 listo para enviar a la IA.
export async function chica(file) {
  const b = await createImageBitmap(file),
    k = Math.min(1, 1600 / Math.max(b.width, b.height)),
    c = document.createElement('canvas')
  c.width = b.width * k
  c.height = b.height * k
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85).split(',')[1]
}
