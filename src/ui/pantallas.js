// Registro de pantallas con carga diferida (Entrega 28).
// - `cargar(clave)` baja el archivo de la pantalla una sola vez (con reintentos) y comparte la promesa.
// - `componente(clave)` devuelve el React.lazy de esa pantalla (uno por clave; si falla se descarta para poder reintentar).
// - `precargarEnSegundoPlano()` baja el resto de las pantallas unos segundos después de abrir la app, para que
//   public/sw.js las guarde y anden sin conexión. Si no hay conexión, espera a que vuelva.
import {lazy} from 'react'
import {
  ORDEN_PRECARGA,
  ErrorDeCarga,
  conReintento,
  debePrecargar,
  urlDeFallo,
  urlDeReintento
} from '../domain/carga.js'

// Las rutas de import son literales: así Vite arma un archivo aparte por pantalla.
export const IMPORTADORES = {
  entreno: () => import('../features/entreno/Entreno'),
  comidas: () => import('../features/comidas/Comidas'),
  progreso: () => import('../features/progreso/Progreso'),
  rutas: () => import('../features/rutas/Rutas'),
  ajustes: () => import('../features/ajustes/Ajustes'),
  priv: () => import('../features/bienestar/Bienestar')
}

// Segundo intento en adelante: el navegador recuerda el import() que falló, así que se pide el mismo archivo
// con otra dirección (?r=). Si lo que llega no es la pantalla (falló una pieza compartida), solo recargar sirve.
async function reimportar(causa, n) {
  const m = await import(/* @vite-ignore */ urlDeReintento(urlDeFallo(causa), n))
  if (!m?.default) throw new Error('Llegó un archivo incompleto')
  return m
}

const promesas = new Map()
const lazies = new Map()
const cargadas = new Set()

export const estaCargada = clave => cargadas.has(clave)

export function cargar(clave, opciones) {
  const importar = IMPORTADORES[clave]
  if (!importar) return Promise.reject(new Error('Pantalla desconocida: ' + clave))
  if (!promesas.has(clave)) {
    const p = conReintento(
      (i, causa) => (i === 0 ? importar() : reimportar(causa, i)),
      {intentos: estadoRed().enLinea ? 3 : 1, repetir: e => !!urlDeFallo(e), ...opciones}
    ).then(
      m => {
        cargadas.add(clave)
        return m
      },
      e => {
        promesas.delete(clave) // no recordar el fallo: el próximo intento vuelve a pedir el archivo
        throw e
      }
    )
    promesas.set(clave, p)
  }
  return promesas.get(clave)
}

export function componente(clave) {
  if (!lazies.has(clave))
    lazies.set(
      clave,
      lazy(() =>
        cargar(clave).catch(e => {
          lazies.delete(clave) // React.lazy recuerda el fallo: se crea uno nuevo al reintentar
          throw new ErrorDeCarga(clave, e)
        })
      )
    )
  return lazies.get(clave)
}

const estadoRed = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  return {
    enLinea: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    ahorroDatos: !!c?.saveData,
    tipoRed: c?.effectiveType || ''
  }
}
const pausa = ms => new Promise(r => setTimeout(r, ms))

let iniciada = false
// Devuelve una función para cancelar (se usa al desmontar). Se puede llamar varias veces: solo arranca una.
export function precargarEnSegundoPlano({esperaMs = 3000, pausaMs = 400} = {}) {
  if (iniciada) return () => {}
  iniciada = true
  let cancelado = false
  const correr = async () => {
    for (const clave of ORDEN_PRECARGA) {
      if (cancelado) return
      const red = estadoRed()
      if (!red.enLinea) {
        // sin conexión: seguir cuando vuelva
        iniciada = false
        addEventListener('online', () => !cancelado && precargarEnSegundoPlano({esperaMs: 500}), {
          once: true
        })
        return
      }
      if (!debePrecargar(red)) return // ahorro de datos o 2G: cada pantalla se baja al abrirla
      if (!cargadas.has(clave)) await cargar(clave, {intentos: 1}).catch(() => {})
      await pausa(pausaMs)
    }
  }
  const t = setTimeout(correr, esperaMs)
  return () => {
    cancelado = true
    iniciada = false
    clearTimeout(t)
  }
}
