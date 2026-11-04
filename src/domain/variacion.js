// Cómo se muestran las variaciones y los estados (v0.24.0, Propuesta 2). Solo presentación: no cambia ningún cálculo.

// Clase CSS de una variación (%, kg, reps…).
// Con color (verde ▲ / rojo ▼) solo cuando la comparación es firme. Con `neutra` (semana en curso, o un dato
// que no se juzga como bueno o malo, como el peso) queda en gris y conserva la flecha: hay dirección, no alarma.
export function claseVariacion(d, {neutra = false} = {}) {
  const n = Number(d)
  if (d === null || d === undefined || d === '' || !Number.isFinite(n) || n === 0) return 'delta'
  const sube = n > 0
  if (neutra) return 'delta neutra ' + (sube ? 'sube' : 'baja')
  return 'delta ' + (sube ? 'up' : 'down')
}

// ¿La semana que empieza en `desde` (lunes, aaaa-mm-dd) sigue en curso? Si es la actual, sí.
export const semanaEnCurso = (desde, lunesActual) => desde === lunesActual

// Rótulos de estado de las tarjetas de Pilares y de los tests: tipo (color) + ícono.
const ESTADOS = {
  'Sin datos suficientes': ['sin', 'circulo'],
  'Todavía no lo hiciste': ['sin', 'circulo'],
  Estable: ['info', 'igual'],
  'Con tendencia': ['info', 'info'],
  Irregular: ['warn', 'alerta'],
  'Poca constancia': ['warn', 'alerta'],
  'Toca repetirlo': ['warn', 'alerta'],
  Atrasado: ['neg', 'alerta'],
  Constante: ['ok', 'check'],
  'Al día': ['ok', 'check'],
  Subiendo: ['ok', 'flecha-arriba'],
  Bajando: ['neg', 'flecha-abajo']
}
export function chipEstado(etiqueta, tono = '') {
  const e = ESTADOS[etiqueta]
  if (e) return {tipo: e[0], icono: e[1]}
  if (tono === 'up') return {tipo: 'ok', icono: 'flecha-arriba'}
  if (tono === 'down') return {tipo: 'neg', icono: 'flecha-abajo'}
  return {tipo: 'info', icono: 'info'}
}

// Reparto de macronutrientes por gramos, para las mini-barras (0–100 cada una; con todo en cero, 0).
export function repartoMacros({p = 0, c = 0, gr = 0} = {}) {
  const v = [p, c, gr].map(x => Math.max(0, Number(x) || 0)),
    tot = v[0] + v[1] + v[2]
  const pct = x => (tot ? Math.round((x / tot) * 100) : 0)
  return {p: pct(v[0]), c: pct(v[1]), gr: pct(v[2]), total: tot}
}
