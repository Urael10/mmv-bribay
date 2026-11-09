import {arco} from '../domain/anillo'

// Anillo de progreso en SVG (sin librerías). `valor` y `meta` en la misma unidad; `children` va en el centro.
// Es decorativo (aria-hidden): quien lo usa pone el texto equivalente al lado o en su etiqueta.
// Colores por tokens (clases `anillo-pista` y `anillo-arco` en styles.css); `clase`: '' | 'ok' | 'bajo'.
export default function Anillo({valor, meta, tam = 44, clase = '', children}) {
  const largo = arco(valor, meta)
  return (
    <span
      className={'anillo' + (clase ? ' ' + clase : '')}
      style={{width: tam, height: tam}}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" width={tam} height={tam}>
        <circle className="anillo-pista" cx="18" cy="18" r="15.9155" pathLength="100" />
        {largo > 0 && (
          <circle
            className="anillo-arco"
            cx="18"
            cy="18"
            r="15.9155"
            pathLength="100"
            strokeDasharray={`${largo} 100`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      {children && <span className="anillo-c">{children}</span>}
    </span>
  )
}
