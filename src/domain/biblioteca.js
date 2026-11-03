// Biblioteca de ejercicios (entrega 18): agregar, renombrar y elegir ejercicios; resumen de bloques. Funciones puras.
// Un ejercicio se identifica por su «clave» (el nombre sin números, asteriscos ni signos de pregunta, en minúsculas):
// por eso «Swing», «swing*» y «20 swing» son el mismo ejercicio. Los números al principio (cantidades) y los * o ? del final
// no forman parte del nombre: se conservan en las sesiones al renombrar.
import {claveEjercicio, hayCarga} from './entreno.js'

const PREFIJO = /^(\s*\d[\d\s×x.,]*?\s+)?(.*?)([*?]*)\s*$/
const partes = t => {
  const m = String(t ?? '').match(PREFIJO)
  return {pre: m?.[1] || '', core: (m?.[2] || '').replace(/\s+/g, ' ').trim(), suf: m?.[3] || ''}
}
// Nombre «limpio» para mostrar en la biblioteca: sin cantidad al principio ni * / ? al final.
export const nombreBase = t => partes(t).core
// Cambia el nombre de un ejercicio escrito en una sesión, conservando la cantidad del principio y los * / ? del final.
export const renombrarTexto = (texto, nuevo) => {
  const p = partes(texto)
  return `${p.pre}${String(nuevo).trim()}${p.suf}`
}

export const MAX_NOMBRE = 60
// Valida un nombre para agregar o renombrar. `claves`: conjunto de claves que ya existen; `claveActual`: la del ejercicio que se renombra.
// Al renombrar a un nombre que ya existe se permite (se fusionan) y se avisa con `fusiona`; al agregar es un error.
export function validarNombre(nombre, claves, {claveActual = null, fusionar = false} = {}) {
  const n = nombreBase(nombre),
    clave = claveEjercicio(n)
  if (!clave) return {ok: false, error: 'Escribí un nombre (con letras).', nombre: n, clave}
  if (n.length > MAX_NOMBRE) return {ok: false, error: `Máximo ${MAX_NOMBRE} caracteres.`, nombre: n, clave}
  const existe = claves.has(clave) && clave !== claveActual
  if (existe && !fusionar) return {ok: false, error: `«${n}» ya está en la biblioteca.`, nombre: n, clave}
  return {ok: true, nombre: n, clave, fusiona: existe}
}

// Renombra un ejercicio dentro de una lista de bloques (sesión guardada, en curso o plantilla). No toca `reg` (va por posición).
export function renombrarEnBloques(bloques, claveVieja, nuevoNombre) {
  let n = 0
  const out = (bloques || []).map(b => {
    if (!(b?.ejercicios || []).some(e => claveEjercicio(e) === claveVieja)) return b
    return {
      ...b,
      ejercicios: b.ejercicios.map(e => {
        if (claveEjercicio(e) !== claveVieja) return e
        n++
        return renombrarTexto(e, nuevoNombre)
      })
    }
  })
  return {bloques: out, n}
}

// Nombres de ejercicios escritos en tus sesiones y plantillas (el más reciente primero, sin repetir): para completar la biblioteca
// con ejercicios que nunca llevaron carga (movilidad, warm up…).
export function nombresDeSesiones(sesiones, rutinas = []) {
  const orden = [...(sesiones || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.id || 0) - (a.id || 0)))
  const vistos = new Map()
  for (const s of [...orden, ...(rutinas || [])])
    for (const b of s.bloques || [])
      for (const e of b.ejercicios || []) {
        const clave = claveEjercicio(e)
        if (clave && !vistos.has(clave)) vistos.set(clave, nombreBase(e))
      }
  return [...vistos].map(([clave, nombre]) => ({clave, nombre}))
}

const sinAcentos = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
// Búsqueda sin acentos ni mayúsculas, por todas las palabras escritas. Sin texto: todos, por orden alfabético.
export function filtrarBiblioteca(lista, q) {
  const t = sinAcentos(q).split(/\s+/).filter(Boolean)
  return [...(lista || [])]
    .filter(e => t.every(w => sinAcentos(e.nombre).includes(w)))
    .sort((a, b) => nombreBase(a.nombre).localeCompare(nombreBase(b.nombre), 'es'))
}

// Agrega un ejercicio a un bloque: ocupa el primer lugar en blanco (los que trae la sesión manual) o va al final.
export function agregarEjercicio(b, nombre) {
  const ej = [...(b?.ejercicios || [])],
    n = String(nombre ?? '').trim()
  if (!n) return b
  const hueco = ej.findIndex(e => !String(e ?? '').trim())
  if (hueco >= 0) ej[hueco] = n
  else ej.push(n)
  return {...b, ejercicios: ej}
}

// Resumen de una línea de un bloque plegado: cuántos ejercicios tiene y cuántos ya tienen carga.
export function resumenBloque(b) {
  const ej = b?.ejercicios || [],
    nombrados = ej.map((e, j) => [e, j]).filter(([e]) => String(e ?? '').trim()),
    cargados = nombrados.filter(([, j]) => hayCarga(b?.reg?.[j])).length
  return {n: nombrados.length, cargados, minutos: +b?.minutos > 0 ? +b.minutos : null}
}

// Ejercicios con nombre de una lista de bloques, sin repetir: [{clave, nombre}] (nombre limpio).
export function ejerciciosNombrados(bloques) {
  const m = new Map()
  for (const b of bloques || [])
    for (const e of b?.ejercicios || []) {
      const clave = claveEjercicio(e)
      if (clave && !m.has(clave)) m.set(clave, nombreBase(e))
    }
  return [...m].map(([clave, nombre]) => ({clave, nombre}))
}
