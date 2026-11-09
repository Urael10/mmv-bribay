import {useEffect, useRef, useState} from 'react'
import Anillo from '../../ui/Anillo'
import Icono from '../../ui/Icono'

// Barras de señal de GPS (decorativas: el texto al lado dice lo mismo). `barras`: 0 a 4.
export function BarrasSenal({barras = 0, id = ''}) {
  return (
    <span className={'barras' + (id ? ' ' + id : '')} aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <i key={i} className={i <= barras ? 'on' : ''} />
      ))}
    </span>
  )
}

// Botón que se activa manteniéndolo presionado `ms`. Con teclado (Enter o espacio) actúa directo.
export function Mantener({ms, onHecho, etiqueta, ayuda, className = ''}) {
  const [ret, setRet] = useState(false),
    t = useRef(null)
  const soltar = () => {
    clearTimeout(t.current)
    setRet(false)
  }
  const apretar = () => {
    setRet(true)
    t.current = setTimeout(() => {
      setRet(false)
      onHecho()
    }, ms)
  }
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <button
      type="button"
      className={'ghost mant ' + className + (ret ? ' on' : '')}
      style={{'--t': `${ms}ms`}}
      onPointerDown={apretar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onHecho()
        }
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <i />
      <span>{etiqueta}</span>
      <small>{ayuda}</small>
    </button>
  )
}

// Pantalla del modo bolsillo: total del día en el anillo, caminata, km, tiempo y ritmo, estado y señal de GPS.
// Todo llega por props y ya formateado (sin datos del trazo). `pulso` cambia con cada paso detectado
// y dispara una onda fina; en pausa no hay animación.
export function VistaBolsillo({
  pasosHoy,
  meta,
  claseAnillo,
  sesion,
  km,
  tiempo,
  ritmo,
  estado,
  senal,
  pausada,
  pausaTxt,
  pulso,
  etiqueta
}) {
  return (
    <div className={'bols' + (pausada ? ' pausada' : '')}>
      <div className="bols-top">
        {estado && (
          <span className={'bols-chip ' + estado.id} role="status">
            <Icono n={estado.icono} tam={16} /> {estado.texto}
          </span>
        )}
        {senal && (
          <span className={'bols-chip gps ' + senal.id}>
            <BarrasSenal barras={senal.barras} id={senal.id} /> {senal.texto}
          </span>
        )}
      </div>
      <div className="bols-hero" role="img" aria-label={etiqueta}>
        <Anillo valor={pasosHoy} meta={meta} tam={208} clase={claseAnillo}>
          <span className="bols-centro">
            <span className="bolsillo-n bols-n mono">{pasosHoy.toLocaleString('es-AR')}</span>
            <small className="mu">
              pasos hoy{meta ? ` · de ${meta.toLocaleString('es-AR')}` : ''}
            </small>
          </span>
        </Anillo>
        {!pausada && pulso > 0 && (
          <svg key={pulso} className="bols-onda" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="17" />
          </svg>
        )}
      </div>
      <p className="bols-cam">
        Esta caminata <b className="mono">+{sesion.toLocaleString('es-AR')}</b> pasos
      </p>
      {pausada && (
        <p className="bols-pausa">
          <Icono n="pausa" tam={16} /> {pausaTxt}
        </p>
      )}
      <div className="bols-datos">
        <div>
          <b className="mono">{km}</b>
          <small>km</small>
        </div>
        <div>
          <b className="mono">{tiempo}</b>
          <small>tiempo</small>
        </div>
        <div>
          <b className="mono">{ritmo}</b>
          <small>min/km · ahora</small>
        </div>
      </div>
    </div>
  )
}
