// Biblioteca de ejercicios: acceso a la base (tabla `ejercicios`). Renombrar actualiza también tus registros, sesiones guardadas,
// plantillas y la sesión en curso, para que el historial y «Igual que la última» sigan funcionando con el nombre nuevo.
import {db} from './db.js'
import {PATRONES} from '../domain/stats.js'
import {
  nombreBase,
  validarNombre,
  renombrarEnBloques,
  renombrarTexto,
  nombresDeSesiones,
  ejerciciosNombrados
} from '../domain/biblioteca.js'

const limpiar = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

// Lista de la biblioteca (nombres limpios).
export async function listar() {
  return (await db.ejercicios.toArray()).map(e => ({...e, nombre: nombreBase(e.nombre) || e.nombre}))
}
// Completa la biblioteca con los nombres que ya escribiste en tus sesiones y plantillas (idempotente). Devuelve cuántos agregó.
export async function sincronizar() {
  const [ej, ses, rut] = await Promise.all([db.ejercicios.toArray(), db.sesiones.toArray(), db.rutinas.toArray()])
  const claves = new Set(ej.map(e => e.clave))
  const nuevos = nombresDeSesiones(ses, rut).filter(n => !claves.has(n.clave))
  if (nuevos.length) await db.ejercicios.bulkPut(nuevos)
  return nuevos.length
}
// Al guardar una sesión: los ejercicios con nombre que todavía no están en la biblioteca se agregan (aunque no lleven carga).
export async function registrarNombres(bloques) {
  const nom = ejerciciosNombrados(bloques)
  if (!nom.length) return 0
  const ya = await db.ejercicios.bulkGet(nom.map(x => x.clave))
  const faltan = nom.filter((_, i) => !ya[i])
  if (faltan.length) await db.ejercicios.bulkPut(faltan)
  return faltan.length
}
export async function agregar({nombre, patron, uni} = {}) {
  const claves = new Set((await db.ejercicios.toArray()).map(e => e.clave))
  const v = validarNombre(nombre, claves)
  if (!v.ok) throw new Error(v.error)
  const fila = limpiar({
    clave: v.clave,
    nombre: v.nombre,
    patron: PATRONES.includes(patron) ? patron : undefined,
    uni: uni ? true : undefined
  })
  await db.ejercicios.put(fila)
  return fila
}
// Renombra un ejercicio en todo el historial. Si el nombre nuevo ya existe se fusionan (hay que pasar fusionar: true).
export async function renombrar(claveVieja, nuevoNombre, {fusionar = false} = {}) {
  const claves = new Set((await db.ejercicios.toArray()).map(e => e.clave))
  const v = validarNombre(nuevoNombre, claves, {claveActual: claveVieja, fusionar})
  if (!v.ok) throw new Error(v.error)
  const cambios = {registros: 0, sesiones: 0, plantillas: 0, enCurso: 0, fusiona: !!v.fusiona}
  await db.transaction('rw', db.ejercicios, db.registros, db.sesiones, db.rutinas, async () => {
    const vieja = await db.ejercicios.get(claveVieja),
      destino = v.clave !== claveVieja ? await db.ejercicios.get(v.clave) : null
    cambios.registros = await db.registros.where('clave').equals(claveVieja).modify(r => {
      r.nombre = renombrarTexto(r.nombre, v.nombre)
      r.clave = v.clave
    })
    for (const [tabla, campo] of [
      [db.sesiones, 'sesiones'],
      [db.rutinas, 'plantillas']
    ])
      for (const fila of await tabla.toArray()) {
        const r = renombrarEnBloques(fila.bloques, claveVieja, v.nombre)
        if (!r.n) continue
        await tabla.update(fila.id, {bloques: r.bloques})
        cambios[campo]++
      }
    if (v.clave !== claveVieja) await db.ejercicios.delete(claveVieja)
    await db.ejercicios.put(
      limpiar({
        ...(vieja || {}),
        ...(destino || {}),
        clave: v.clave,
        nombre: v.nombre,
        patron: destino?.patron ?? vieja?.patron,
        uni: destino?.uni ?? vieja?.uni
      })
    )
  })
  try {
    const raw = localStorage.getItem('mv_sesion'),
      s = raw && JSON.parse(raw)
    if (s?.bloques) {
      const r = renombrarEnBloques(s.bloques, claveVieja, v.nombre)
      if (r.n) {
        localStorage.setItem('mv_sesion', JSON.stringify({...s, bloques: r.bloques}))
        cambios.enCurso = r.n
      }
    }
  } catch {}
  return {clave: v.clave, nombre: v.nombre, ...cambios}
}
export async function cambiarPatron(clave, patron) {
  const e = await db.ejercicios.get(clave)
  if (!e) return
  await db.ejercicios.put(limpiar({...e, patron: PATRONES.includes(patron) ? patron : undefined}))
}
export async function cambiarUni(clave, uni) {
  const e = await db.ejercicios.get(clave)
  if (!e) return
  await db.ejercicios.put(limpiar({...e, uni: uni ? true : undefined}))
}
// Saca el ejercicio de la biblioteca. Tus registros y sesiones no se tocan (si lo volvés a usar, reaparece).
export const borrar = clave => db.ejercicios.delete(clave)
