// Trazo sobre mapa de OpenStreetMap (Entrega 27, opcional). Solo muestra: la geometría sale de domain/mapa.js.
// Al montarse pide las teselas visibles a OpenStreetMap (eso revela la zona que se mira): el que lo
// monta es responsable de haber pedido el consentimiento (Ajustes + botón «Ver sobre el mapa»).
import {useMemo, useState} from 'react'
import {vistaMapa, ATRIBUCION, MAPA_CFG} from '../domain/mapa'

export default function MapaOsm({segs, ancho = 320, alto = 220, etiqueta = 'Trazo sobre el mapa'}) {
  const v = useMemo(() => vistaMapa(segs, {ancho, alto}), [segs, ancho, alto])
  const [fallas, setFallas] = useState(0)
  if (!v) return null
  const t = MAPA_CFG.tile
  const pct = (n, base) => `${(n / base) * 100}%`
  return (
    <div className="mapa-caja">
      <div
        className="mapa"
        style={{aspectRatio: `${ancho} / ${alto}`}}
        role="img"
        aria-label={etiqueta}
      >
        {v.teselas.map(s => (
          <img
            key={`${s.z}/${s.x}/${s.y}/${s.left}`}
            className="mapa-tesela"
            src={s.url}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              left: pct(s.left, ancho),
              top: pct(s.top, alto),
              width: pct(t, ancho),
              height: pct(t, alto)
            }}
            onError={() => setFallas(n => n + 1)}
          />
        ))}
        <svg className="mapa-trazo" viewBox={v.viewBox} aria-hidden="true">
          {v.paths.map((d, i) => (
            <path key={'b' + i} className="mapa-borde" d={d} />
          ))}
          {v.paths.map((d, i) => (
            <path key={'l' + i} className="mapa-linea" d={d} />
          ))}
          <circle className="trazo-ini" cx={v.inicio.x} cy={v.inicio.y} r="5" />
          <circle className="trazo-fin" cx={v.fin.x} cy={v.fin.y} r="5" />
        </svg>
      </div>
      <small className="mu">
        <a href={ATRIBUCION.url} target="_blank" rel="noopener noreferrer">
          {ATRIBUCION.texto}
        </a>
        {fallas >= v.teselas.length && v.teselas.length > 0
          ? ' · No se pudo cargar el mapa (¿sin conexión?). El trazo de arriba no depende de él.'
          : ''}
      </small>
    </div>
  )
}
