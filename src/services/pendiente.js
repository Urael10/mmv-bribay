// Foto de pizarra elegida en «Hoy» (botón 📷): se deja acá y Entreno la toma al abrirse.
// Vive solo en memoria: no se guarda en ningún lado.
let foto = null
export const dejarFoto = f => {
  foto = f || null
}
export const tomarFoto = () => {
  const f = foto
  foto = null
  return f
}
