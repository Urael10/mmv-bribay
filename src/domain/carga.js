// Carga diferida de pantallas (Entrega 28). Lógica pura, sin React ni red, para poder probarla.
// El arranque no depende de nada de acá: Hoy va en el paquete principal; el resto se baja aparte.

// Pantallas que se cargan por separado, en el orden en que se precargan en segundo plano.
// «priv» va al final: se baja igual para que ande sin conexión.
export const ORDEN_PRECARGA = ['entreno', 'comidas', 'progreso', 'rutas', 'ajustes', 'priv']

// Error propio: distingue «no se pudo bajar el archivo de la pantalla» de un fallo al dibujarla
// (ese sigue yendo a la pantalla de error general, con el detalle técnico).
// `recargar`: si el navegador no dijo qué archivo falló (Safari), no se puede reintentar solo ese archivo y
// «Reintentar» tiene que recargar la app.
export class ErrorDeCarga extends Error {
  constructor(clave, causa) {
    super(`No se pudo cargar la pantalla «${clave}»`)
    this.name = 'ErrorDeCarga'
    this.clave = clave
    this.causa = causa
    this.recargar = !urlDeFallo(causa)
  }
}

// Chrome y Firefox recuerdan que un import() falló y no vuelven a pedir ese archivo en toda la sesión de la
// página. Para reintentar hay que pedirlo con otra dirección: se saca del mensaje del error y se le agrega ?r=.
export function urlDeFallo(error) {
  const m = /https?:\/\/[^\s'"()<>,]+?\.js(?:\?[^\s'"()<>,]*)?/i.exec(String(error?.message ?? ''))
  return m ? m[0] : null
}
export function urlDeReintento(url, n, ahora = Date.now()) {
  const u = new URL(url)
  u.searchParams.set('r', `${n}-${ahora}`)
  return u.href
}

const dormir = ms => new Promise(r => setTimeout(r, ms))

// Reintenta `fn(i, errorAnterior)` hasta `intentos` veces, esperando un poco más cada vez (600 ms, 1,2 s, …).
// `repetir(error)` permite cortar antes cuando repetir no puede servir.
export async function conReintento(
  fn,
  {intentos = 3, esperaMs = 600, esperar = dormir, repetir = () => true} = {}
) {
  let ultimo
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn(i, ultimo)
    } catch (e) {
      ultimo = e
      if (i >= intentos - 1 || !repetir(e)) break
      await esperar(esperaMs * (i + 1))
    }
  }
  throw ultimo
}

// ¿Conviene bajar las demás pantallas en segundo plano? No con el celular sin conexión, con el
// «ahorro de datos» del navegador activado ni con red 2G.
export function debePrecargar({enLinea = true, ahorroDatos = false, tipoRed = ''} = {}) {
  if (!enLinea || ahorroDatos) return false
  return !/(^|-)2g$/.test(String(tipoRed || ''))
}

// Texto del aviso cuando una pantalla no se pudo bajar.
export function textoFalloCarga({enLinea = true} = {}) {
  return enLinea
    ? 'No se pudo descargar esta pantalla. Puede ser la señal o que haya una versión nueva de MMV. Tus datos no se tocaron.'
    : 'Estás sin conexión y esta pantalla todavía no se descargó. Conectate una vez para que quede disponible sin conexión. Tus datos no se tocaron.'
}
