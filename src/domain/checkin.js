// Check-in de 20 segundos: tres toques (energía, ánimo, dolor muscular) + sueño. Se guarda en la fila de hábitos del día.
export const CHECKIN = [
  // `bajo` / `alto`: descripción completa del 1 y del 5 (la lee el lector de pantalla). `ext1` / `ext5`: la palabra corta
  // que se ve en los extremos de cada fila de botones (Entrega 42; antes era una sola línea larga bajo los tres).
  {k: 'energia', n: 'Energía', bajo: 'muy baja', alto: 'muy alta', ext1: 'baja', ext5: 'alta'},
  {k: 'animo', n: 'Ánimo', bajo: 'muy bajo', alto: 'muy alto', ext1: 'bajo', ext5: 'alto'},
  {k: 'dolor', n: 'Dolor muscular', bajo: 'nada', alto: 'mucho', ext1: 'nada', ext5: 'mucho'}
]
export const checkinHecho = h => CHECKIN.every(c => +h?.[c.k] >= 1 && +h?.[c.k] <= 5)
// Días con check-in completo en los 7 que terminan en `hasta` (para medir constancia semanal, no rachas).
export function constanciaSemanal(habitos, hasta, sumaDias) {
  const d0 = sumaDias(hasta, -6)
  return habitos.filter(x => x.fecha >= d0 && x.fecha <= hasta && checkinHecho(x)).length
}

// Entrega 38 · Qué decirle a la persona cuando la preparación todavía no se puede calcular.
// Sin check-in: «Hacé el check-in…». Con el check-in hecho pero sin horas de sueño: pide el sueño.
// En ambos casos la acción es la misma (abrir el check-in de Hoy, donde está todo). Lógica pura, sin pantalla.
export function pedidoPreparacion(h) {
  const hayHoras = +h?.sueno > 0
  if (!checkinHecho(h))
    return {
      titulo: 'Hacé el check-in para ver tu preparación',
      detalle:
        'Son tres toques y las horas de sueño. Con los días se suman tus comidas, el agua y tus entrenos.',
      boton: 'Hacer el check-in'
    }
  if (!hayHoras)
    return {
      titulo: 'Cargá tus horas de sueño para ver tu preparación',
      detalle:
        'Ya hiciste el check-in; falta cuánto dormiste. Con los días se suman tus comidas, el agua y tus entrenos.',
      boton: 'Cargar el sueño'
    }
  return {
    titulo: 'Todavía faltan datos para calcular tu preparación',
    detalle: 'Con los días se suman tus comidas, el agua y tus entrenos.',
    boton: 'Abrir el check-in'
  }
}
