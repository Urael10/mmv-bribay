// Caché de la lectura del día con IA (Entrega 48). Vive en el teléfono (localStorage, `mv_ia_dia`), no en Dexie:
// es un dato que se puede volver a pedir, así que no toca el esquema (sigue en v11) ni viaja en el backup.
// Guarda UNA sola lectura, la de hoy; al guardar una nueva se pierde la anterior.
import {db, cfg, setCfg} from './db.js'
import {leerCache} from '../domain/iaDia.js'

const CLAVE = 'ia_dia'

export function leerLecturaGuardada() {
  try {
    return leerCache(cfg(CLAVE))
  } catch {
    return null
  }
}

export function guardarLectura(cache) {
  try {
    setCfg(CLAVE, JSON.stringify(cache))
    return true
  } catch {
    return false
  }
}

// Cuenta la consulta en el registro de uso, igual que el coach.
export const anotarUso = fecha => db.uso.add({fecha, fn: 'dia'})
