// Acceso a la tabla `rutas` (Entrega 26). Las coordenadas se quedan en el dispositivo.
import {db} from './db.js'
import {filasDeGpx, sinRepetidas} from '../domain/gpx.js'

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

export const todasLasRutas = () => db.rutas.orderBy('fecha').toArray()

export const borrarRuta = id => db.rutas.delete(id)

// Importa un GPX: lee, descarta lo repetido y guarda lo nuevo.
// Devuelve {agregadas, repetidas, invalidas} o {error}. Nada sale del dispositivo.
export async function importarGpx(texto, ocultarM) {
  const r = filasDeGpx(texto, ocultarM == null ? undefined : {ocultarM})
  if (r.error) return {error: r.error}
  const fechas = r.filas.map(f => f.fecha).sort()
  const existentes = await rutasEntre(fechas[0], fechas.at(-1))
  const {nuevas, repetidas} = sinRepetidas(r.filas, existentes)
  if (nuevas.length) await db.rutas.bulkAdd(nuevas)
  return {agregadas: nuevas.length, repetidas, invalidas: r.invalidas}
}
