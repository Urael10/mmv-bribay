// Lectura de lo necesario para estimar el gasto calórico (Entrega 43). Nada de esto sale de la app:
// las rutas vienen sin trazo (data/movimiento.js) y las sesiones solo aportan fecha, RPE y minutos.
import {db} from './db.js'
import {leerMovimiento} from './movimiento.js'

export async function leerGasto(desde, hasta) {
  const [sesiones, medidas, habitos, mov] = await Promise.all([
    db.sesiones.where('fecha').between(desde, hasta, true, true).toArray(),
    db.medidas.toArray(),
    db.habitos.where('fecha').between(desde, hasta, true, true).toArray(),
    leerMovimiento(desde, hasta)
  ])
  return {
    sesiones: sesiones.map(s => ({
      fecha: s.fecha,
      rpe: s.rpe,
      bloques: (s.bloques || []).map(b => ({minutos: b?.minutos}))
    })),
    medidas: medidas.map(m => ({fecha: m.fecha, peso: m.peso})),
    habitos: habitos.map(h => ({fecha: h.fecha, pasos: h.pasos})),
    ...mov
  }
}
