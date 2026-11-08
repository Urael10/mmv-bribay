import {useState, useEffect, useMemo} from 'react'
import Anillo from '../../ui/Anillo'
import {NOMBRES} from '../../domain/preparacion'
import {pedidoPreparacion} from '../../domain/checkin'
import {cargarPrep, calcPrep} from './prep'

// Tarjeta de Hoy. `h` = hábitos de hoy en vivo, así el puntaje se mueve al cargar el sueño.
// `onCheckin` abre el check-in de Hoy (lo usa el estado «sin datos»).
export default function Preparacion({h, onCheckin}) {
  const [d, setD] = useState(null)
  useEffect(() => {
    cargarPrep().then(setD)
  }, [])
  const r = useMemo(() => d && calcPrep(d, h), [d, h])
  if (!r) return null
  if (!r.ok) {
    const p = pedidoPreparacion(h)
    return (
      <section className="prep prep-vacia">
        <h3>Preparación para entrenar</h3>
        <p className="prep-t">{p.titulo}</p>
        <p className="mu prep-r">
          {p.detalle} Falta: {r.faltan.join(', ').toLowerCase()}.
        </p>
        {onCheckin && (
          <button type="button" onClick={onCheckin}>
            {p.boton}
          </button>
        )}
      </section>
    )
  }
  return (
    <section className="prep">
      <h3>Preparación para entrenar</h3>
      <>
        <div className="prep-cab">
          <Anillo
            valor={r.puntaje}
            meta={100}
            tam={128}
            clase={r.etiqueta.c === 'up' ? 'ok' : r.etiqueta.c === 'down' ? 'bajo' : ''}
          >
            <span className="prep-n">
              <span className={'sc ' + r.etiqueta.c}>{r.puntaje}</span>
              <small>/ 100</small>
            </span>
          </Anillo>
          <div className="prep-cuerpo">
            <p className="prep-t">{r.etiqueta.t}</p>
            <p className="mu prep-r">{r.recomendacion.texto}</p>
          </div>
        </div>
        {r.recomendacion.avisos.map(a => (
          <small key={a} className="warn">
            {a}
          </small>
        ))}
        <details className="prep-d">
          <summary className="tag">Detalle y cómo se calcula</summary>
          {r.faltan.length > 0 && (
            <small className="mu" style={{display: 'block', margin: '6px 0'}}>
              Calculado con el {r.confianza}% de los datos. Falta:{' '}
              {r.faltan.join(', ').toLowerCase()}.
            </small>
          )}
          {Object.entries(r.partes).map(([k, v]) => (
            <div key={k} className="lin">
              <span>
                {NOMBRES[k]}
                {v.detalle && <small className="mu"> · {v.detalle}</small>}
              </span>
              <span className="mono">{v.p === null ? '–' : v.p}</span>
            </div>
          ))}
          {r.pasos && (
            <div className="lin">
              <span>
                Pasos de ayer <small className="mu">· no suman al puntaje</small>
              </span>
              <span className="mono">
                {r.pasos.ayer.toLocaleString('es-UY')}
                {r.pasos.habitual !== null &&
                  ` (tu promedio ${r.pasos.habitual.toLocaleString('es-UY')})`}
              </span>
            </div>
          )}
          <small className="mu" style={{display: 'block', marginTop: 6}}>
            Cómo te sentís 40 %, sueño contra tu propio promedio 30 %, carga reciente (entrenos,
            actividades y rutas, sin contar dos veces la misma salida) 20 %, hábitos de ayer (comida
            y agua) 10 %. Los pesos son una propuesta de diseño, no salen de un estudio: es una
            orientación basada en tus propios datos, no una medición médica. Un dolor agudo o en una
            articulación no es dolor muscular: parar y consultar.
          </small>
        </details>
      </>
    </section>
  )
}
