import {db, hoy, cfg} from '../../data/db'
import {sumaDias} from '../../domain/stats'
import {preparacion} from '../../domain/preparacion'

export const metas = () => ({
  metaKcal: +cfg('metakcal', 2200) || 2200,
  metaAgua: +cfg('meta', 2500) || 2500
})

// Datos de los últimos 40 días para calcular la preparación.
export async function cargarPrep() {
  const f = hoy(),
    d0 = sumaDias(f, -40),
    rango = t => db[t].where('fecha').between(d0, f, true, true).toArray()
  const [habitos, sesiones, comidas] = await Promise.all([
    rango('habitos'),
    rango('sesiones'),
    rango('comidas')
  ])
  return {habitos, sesiones, comidas}
}
export const calcPrep = (d, h) =>
  preparacion({
    fecha: hoy(),
    sesiones: d.sesiones,
    comidas: d.comidas,
    ...metas(),
    habitos: [...d.habitos.filter(x => x.fecha !== hoy()), ...(h ? [{...h, fecha: hoy()}] : [])]
  })

