// Acceso a la tabla `rutas` (Entrega 26). Las coordenadas se quedan en el dispositivo.
import {db} from './db.js'

export const guardarRuta = fila => db.rutas.add(fila)

export const contarRutas = () => db.rutas.count()

// Las más recientes primero. `limite` pagina el historial.
export const listarRutas = async (limite = 15) => {
  const filas = await db.rutas.orderBy('fecha').reverse().limit(limite).toArray()
  return filas.sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.inicio || 0) - (a.inicio || 0)
  )
}

export const rutasEntre = (desde, hasta) =>
  db.rutas.where('fecha').between(desde, hasta, true, true).toArray()

export const borrarRuta = id => db.rutas.delete(id)
