import {useSyncExternalStore} from 'react'
import {mmss, TIPOS} from '../../domain/temporizador'
import {
  suscribir,
  version,
  estado,
  ahoraPos,
  enMarcha,
  pausarOReanudar,
  sumarRonda,
  terminar
} from '../../services/reloj'

// Se vuelve a dibujar con cada aviso del reloj (la hora siempre sale de Date.now(), no de ticks contados).
export const useReloj = () => {
  useSyncExternalStore(suscribir, version)
  return {st: estado(), pos: ahoraPos(), on: enMarcha()}
}
const mostrar = pos => (pos.seg.sube ? pos.trans : pos.restante)

export function Timer({onCerrar, onMinimizar}) {
  const {st, pos, on} = useReloj()
  if (!st || !pos) return null
  const b = st.b,
    sube = pos.seg.sube,
    previo = pos.seg.previo
  const contar = b.tipo === 'amrap' || b.tipo === 'forTime'
  return (
    <div className="timer">
      <small>
        {TIPOS[b.tipo]} · {pos.seg.l}
      </small>
      <div className="big">{mmss(mostrar(pos))}</div>
      {sube && !previo && <small className="mu">tope {mmss(pos.seg.s)}</small>}
      {contar && !previo && (
        <button className="plus" onClick={sumarRonda}>
          +1 ronda ({st.r})
        </button>
      )}
      {b.tipo === 'forTime' && st.tiempo > 0 && (
        <div className="tag">Tiempo: {mmss(st.tiempo)}</div>
      )}
      <div className="row">
        <button onClick={pos.fin ? onCerrar : pausarOReanudar}>
          {pos.fin ? 'Listo' : on ? 'Pausa' : 'Seguir'}
        </button>
        {b.tipo === 'forTime' && !previo && !pos.fin && st.tiempo === 0 && (
          <button onClick={terminar}>Terminé</button>
        )}
        <button className="ghost" onClick={onMinimizar}>
          Ver ejercicios
        </button>
        <button
          className="ghost"
          onClick={() => {
            if (pos.fin || confirm('¿Cerrar el temporizador? Se guardan las rondas y el tiempo.'))
              onCerrar()
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

// Barra chica: se ve en cualquier pestaña mientras el reloj está activo.
export function BarraReloj({onAbrir}) {
  const {st, pos, on} = useReloj()
  if (!st || !pos) return null
  return (
    <div className="barrareloj">
      <button className="ghost mini" onClick={pausarOReanudar}>
        {pos.fin ? '✔' : on ? '⏸' : '▶'}
      </button>
      <span className="mono">
        {TIPOS[st.b.tipo]} · {pos.seg.l}
      </span>
      <b className="mono">{mmss(mostrar(pos))}</b>
      <button className="ghost mini" onClick={onAbrir}>
        Abrir
      </button>
    </div>
  )
}
