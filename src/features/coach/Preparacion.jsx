import {useState, useEffect, useMemo} from 'react'
import Plegable from '../../ui/Plegable'
import {NOMBRES} from '../../domain/preparacion'
import {cargarPrep, calcPrep} from './prep'

// Tarjeta de Hoy. `h` = hábitos de hoy en vivo, así el puntaje se mueve al cargar el sueño.
export default function Preparacion({h}) {
  const [d, setD] = useState(null)
  useEffect(() => {
    cargarPrep().then(setD)
  }, [])
  const r = useMemo(() => d && calcPrep(d, h), [d, h])
  if (!r) return null
  if (!r.ok)
    return (
      <Plegable titulo="Preparación" resumen="Todavía no hay datos suficientes">
        <p className="mu" style={{margin: 0}}>
          Para calcularla hacé el check-in de arriba y cargá tu sueño de anoche; con los días se
          suman tus comidas, el agua y tus sesiones. Falta: {r.faltan.join(', ').toLowerCase()}.
        </p>
      </Plegable>
    )
  return (
    <section>
      <h3>Preparación para entrenar</h3>
      {r.ok ? (
        <>
          <div className="big">
            <span className={'sc ' + r.etiqueta.c}>{r.puntaje}</span>
            <small> / 100</small>
          </div>
          <div className="bar">
            <i style={{width: r.puntaje + '%'}} />
          </div>
          <b>{r.etiqueta.t}</b>
          <p style={{margin: '4px 0 0', fontSize: 14}}>{r.recomendacion.texto}</p>
          {r.recomendacion.avisos.map(a => (
            <small key={a} className="warn">
              {a}
            </small>
          ))}
          {r.faltan.length > 0 && (
            <small className="mu" style={{display: 'block', marginTop: 4}}>
              Calculado con el {r.confianza}% de los datos. Falta:{' '}
              {r.faltan.join(', ').toLowerCase()}.
            </small>
          )}
          <details>
            <summary className="tag">Cómo se calcula</summary>
            {Object.entries(r.partes).map(([k, v]) => (
              <div key={k} className="lin">
                <span>
                  {NOMBRES[k]}
                  {v.detalle && <small className="mu"> · {v.detalle}</small>}
                </span>
                <span className="mono">{v.p === null ? '–' : v.p}</span>
              </div>
            ))}
            <small className="mu" style={{display: 'block', marginTop: 6}}>
              Cómo te sentís 40 %, sueño contra tu propio promedio 30 %, carga reciente 20 %,
              hábitos de ayer (comida y agua) 10 %. Los pesos son una propuesta de diseño, no salen
              de un estudio: es una orientación basada en tus propios datos, no una medición médica.
              Un dolor agudo o en una articulación no es dolor muscular: parar y consultar.
            </small>
          </details>
        </>
      ) : (
        <>
          <div className="mu">Todavía no hay datos suficientes para calcularlo.</div>
          <small className="mu" style={{display: 'block', marginTop: 4}}>
            Hacé el check-in de arriba y cargá tu sueño de anoche; con los días se suman tus
            comidas, el agua y tus sesiones. Falta: {r.faltan.join(', ').toLowerCase()}.
          </small>
        </>
      )}
    </section>
  )
}

