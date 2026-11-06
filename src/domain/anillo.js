// Entrega 32 · Anillos de progreso (lógica pura). El dibujo está en src/ui/Anillo.jsx.

// Fracción llena del anillo, entre 0 y 1. Sin meta válida o con un valor que no es número, queda vacío.
export function fraccion(valor, meta) {
  const v = Number(valor),
    m = Number(meta)
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0 || v <= 0) return 0
  return Math.min(1, v / m)
}

// Largo del arco en un círculo de circunferencia 100 (se usa con pathLength="100"). Redondeado a décimas.
export const arco = (valor, meta) => Math.round(fraccion(valor, meta) * 1000) / 10

// Clase de color: 'ok' (verde) al llegar a la meta, 'bajo' (rojo) si se pide, y si no neutro (azul de datos).
export function claseAnillo(valor, meta, {bajo = false} = {}) {
  if (bajo) return 'bajo'
  return fraccion(valor, meta) >= 1 ? 'ok' : ''
}

// Texto para lectores de pantalla: «Agua: 1250 de 2500 ml (50 %)».
export function textoAnillo(nombre, valor, meta, unidad = '') {
  const u = unidad ? ' ' + unidad : ''
  return `${nombre}: ${Math.round(Number(valor) || 0)} de ${Math.round(Number(meta) || 0)}${u} (${Math.round(fraccion(valor, meta) * 100)} %)`
}
