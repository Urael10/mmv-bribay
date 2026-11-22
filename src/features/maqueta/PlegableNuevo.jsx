import {useState, useId} from 'react'
import Icono from '../../ui/Icono'
import {sentir} from '../../services/feedback'

// Plegable con animación CSS Grid continua (Fase 0 · Maqueta)
// Evita el salto brusco del DOM al expandir/contraer usando grid-template-rows: 0fr -> 1fr.
export default function PlegableNuevo({
  titulo,
  resumen,
  children,
  inicial = false,
  icono = 'info'
}) {
  const [abierto, setAbierto] = useState(inicial)
  const idCuerpo = useId()

  const toggle = () => {
    sentir('toque')
    setAbierto(a => !a)
  }

  return (
    <div className={`mq-plegable ${abierto ? 'abierto' : ''}`}>
      <button
        type="button"
        className="mq-pleg-cabecera"
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        onClick={toggle}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0, flex: 1}}>
          <Icono n={icono} tam={18} />
          <span style={{lineHeight: 1.3}}>
            {titulo && <b style={{color: 'var(--tx)'}}>{titulo}</b>}
            {titulo && resumen && <span style={{color: 'var(--tx-2)'}}> · </span>}
            {resumen && <span style={{color: 'var(--tx-2)'}}>{resumen}</span>}
          </span>
        </div>
        <Icono n="chevron-abajo" tam={18} className="mq-pleg-chevron" />
      </button>

      <div id={idCuerpo} className="mq-pleg-cuerpo-animado" aria-hidden={!abierto}>
        <div className="mq-pleg-contenido">
          {children}
        </div>
      </div>
    </div>
  )
}
