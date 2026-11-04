// Formato de valores para mostrar (funciones puras; no tocan los datos guardados).
export const SIN_DATO = '—'

// Sin dato (null, undefined, '' o NaN) = «—»; el cero se muestra como «0».
export const hayDato = n => n !== null && n !== undefined && n !== '' && Number.isFinite(+n)

// Número con coma decimal. Opciones: dec = decimales máximos (por defecto 1).
export function fmtVal(n, {dec = 1} = {}) {
  if (!hayDato(n)) return SIN_DATO
  return String(+(+n).toFixed(dec)).replace('.', ',')
}

// Con signo explícito (+1,2 / −0,5 con «-» común); sin dato = «—».
export const fmtSigno = (n, o) => (!hayDato(n) ? SIN_DATO : (+n > 0 ? '+' : '') + fmtVal(n, o))

export const plural = (n, uno, varios) => `${n} ${+n === 1 ? uno : varios}`

// 'aaaa-mm-dd' → 'dd/mm/aaaa'. Si no tiene ese formato se devuelve igual.
export const fechaDMA = f => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f ?? ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f ?? '')
}

// Nombre de ejercicio listo para mostrar: recorta espacios y signos sueltos («?», «*», comas, guiones)
// al principio y al final; el punto final se respeta (abreviaturas como «tr.»). El dato guardado no se modifica.
export function nombreEjercicio(s) {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s?*.,;:¿¡!\-–—]+/, '')
    .replace(/[\s?*,;:¿¡!\-–—]+$/, '')
  return t || String(s ?? '').trim()
}
