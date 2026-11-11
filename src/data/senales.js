// Lectura de lo necesario para la Nota del día (Entrega 45). Todo queda en el teléfono: esta lectura no pasa por
// services/ ni por la IA. De las comidas solo se llevan kcal y proteína; de las sesiones, fecha, RPE y minutos;
// las rutas vienen sin trazo (data/movimiento.js).
import {db, cfg} from './db.js'
import {leerMovimiento} from './movimiento.js'
import {sumaDias} from '../domain/stats.js'

export const DIAS_NOTA = 28

export async function leerSenales(fecha) {
  const d0 = sumaDias(fecha, -DIAS_NOTA),
    rango = t => db[t].where('fecha').between(d0, fecha, true, true).toArray()
  const [habitos, sesiones, comidas, medidas, mov] = await Promise.all([
    rango('habitos'),
    rango('sesiones'),
    db.comidas.where('fecha').equals(fecha).toArray(),
    db.medidas.toArray(),
    leerMovimiento(d0, fecha)
  ])
  return {
    habitos,
    sesiones: sesiones.map(s => ({fecha: s.fecha, rpe: s.rpe, bloques: (s.bloques || []).map(b => ({minutos: b?.minutos}))})),
    comidas: comidas.map(c => ({fecha: c.fecha, items: (c.items || []).map(i => ({kcal: i.kcal, p: i.p, c: i.c, gr: i.gr}))})),
    medidas: medidas.map(m => ({fecha: m.fecha, peso: m.peso})),
    ...mov
  }
}

// Metas que usa la nota (las mismas que las teselas de Hoy).
export const metasNota = () => ({
  metaKcal: +cfg('metakcal', 2200) || 2200,
  metaAgua: +cfg('meta', 2500) || 2500,
  metaPasos: cfg('metapasos', ''),
  protKg: cfg('protkg', '')
})
