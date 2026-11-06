import {db, hoy, cfg} from '../../data/db'
import {sumaDias} from '../../domain/stats'
import {preparacion} from '../../domain/preparacion'
import {leerMovimiento} from '../../data/movimiento'

export const metas = () => ({
  metaKcal: +cfg('metakcal', 2200) || 2200,
  metaAgua: +cfg('meta', 2500) || 2500
})

// Datos de los últimos 40 días para calcular la preparación (incluye actividades y rutas sin trazo).
export async function cargarPrep() {
  const f = hoy(),
    d0 = sumaDias(f, -40),
    rango = t => db[t].where('fecha').between(d0, f, true, true).toArray()
  const [habitos, sesiones, comidas, mov] = await Promise.all([
    rango('habitos'),
    rango('sesiones'),
    rango('comidas'),
    leerMovimiento(d0, f)
  ])
  return {habitos, sesiones, comidas, ...mov}
}
export const calcPrep = (d, h) =>
  preparacion({
    fecha: hoy(),
    sesiones: d.sesiones,
    comidas: d.comidas,
    actividades: d.actividades,
    rutas: d.rutas,
    ...metas(),
    habitos: [...d.habitos.filter(x => x.fecha !== hoy()), ...(h ? [{...h, fecha: hoy()}] : [])]
  })

