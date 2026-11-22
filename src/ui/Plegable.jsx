import {useState, useId} from 'react'
import Icono from './Icono'

// Estado vacío o aviso informativo: una línea con ícono que se expande al tocar.
// `titulo` va en negrita, `resumen` es la frase corta y `children` el detalle (animado sin saltos de layout).
export default function Plegable({titulo, resumen, children, tarjeta = true, inicial = false}) {
  const [ab, setAb] = useState(inicial),
    id = useId()
  const cuerpo = (
    <>
      <button
        type="button"
        className="vacio-b"
        aria-expanded={ab}
        aria-controls={id}
        onClick={() => setAb(v => !v)}
      >
        <Icono n="info" tam={18} />
        <span className="vacio-t">
          {titulo && <b>{titulo}</b>}
          {titulo && resumen ? ' · ' : ''}
          <span className="mu">{resumen}</span>
        </span>
        <Icono n="chevron-abajo" tam={18} className={'vacio-ch' + (ab ? ' abierto' : '')} />
      </button>
      <div id={id} className={'vacio-c-animado' + (ab ? ' abierto' : '')} aria-hidden={!ab}>
        <div className="vacio-c">
          {children}
        </div>
      </div>
    </>
  )
  return tarjeta ? <section className="vacio">{cuerpo}</section> : <div className="vacio">{cuerpo}</div>
}
