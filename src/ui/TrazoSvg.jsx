// Trazo de un recorrido en SVG, sin mapa ni conexión (Entrega 26). Solo muestra: la geometría sale de domain/rutas.js.
// Inicio = círculo vacío, fin = círculo lleno (no depende del color). Colores por tokens (clases en styles.css).
import {useMemo} from 'react'
import {trazoSvg} from '../domain/rutas'

// Con etiqueta vacía queda decorativo (por ejemplo, la miniatura de una fila que ya tiene su texto).
export default function TrazoSvg({
  segs,
  ancho = 300,
  alto = 180,
  etiqueta = 'Trazo del recorrido',
  extremos = true,
  className = ''
}) {
  const t = useMemo(() => trazoSvg(segs, {ancho, alto}), [segs, ancho, alto])
  if (!t) return null
  const a11y = etiqueta ? {role: 'img', 'aria-label': etiqueta} : {'aria-hidden': true}
  return (
    <svg
      className={('trazo ' + className).trim()}
      viewBox={t.viewBox}
      preserveAspectRatio="xMidYMid meet"
      {...a11y}
    >
      {t.paths.map((d, i) => (
        <path key={i} className="trazo-linea" d={d} />
      ))}
      {extremos && (
        <>
          <circle className="trazo-ini" cx={t.inicio.x} cy={t.inicio.y} r="5" />
          <circle className="trazo-fin" cx={t.fin.x} cy={t.fin.y} r="5" />
        </>
      )}
    </svg>
  )
}
