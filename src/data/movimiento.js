// Lectura de actividades y rutas para el informe, la preparación y el coach (Entrega 29).
// Las rutas salen de acá SIN trazo: nada de puntos, tramos ni horas. Así ni el informe ni el coach
// llegan a ver coordenadas (una prueba lo vigila). Para ver o exportar rutas se usa data/rutas.js.
import {db} from './db.js'
import {rutaSinTrazo, actividadSinNota} from '../domain/movimiento.js'

export async function leerMovimiento(desde, hasta) {
  const [actividades, rutas] = await Promise.all([
    db.actividades.where('fecha').between(desde, hasta, true, true).toArray(),
    db.rutas.where('fecha').between(desde, hasta, true, true).toArray()
  ])
  return {actividades: actividades.map(actividadSinNota), rutas: rutas.map(rutaSinTrazo)}
}
