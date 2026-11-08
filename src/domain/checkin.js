// Check-in de 20 segundos: tres toques (energía, ánimo, dolor muscular) + sueño. Se guarda en la fila de hábitos del día.
export const CHECKIN = [
  {k: 'energia', n: 'Energía', bajo: 'muy baja', alto: 'muy alta'},
  {k: 'animo', n: 'Ánimo', bajo: 'muy bajo', alto: 'muy alto'},
  {k: 'dolor', n: 'Dolor muscular', bajo: 'nada', alto: 'mucho'}
]
export const checkinHecho = h => CHECKIN.every(c => +h?.[c.k] >= 1 && +h?.[c.k] <= 5)
// Días con check-in completo en los 7 que terminan en `hasta` (para medir constancia semanal, no rachas).
export function constanciaSemanal(habitos, hasta, sumaDias) {
  const d0 = sumaDias(hasta, -6)
  return habitos.filter(x => x.fecha >= d0 && x.fecha <= hasta && checkinHecho(x)).length
}
