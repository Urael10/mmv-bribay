import {useState} from 'react'
import Icono from '../../ui/Icono'
import {sentir} from '../../services/feedback'

// Demostración interactiva del estado de carga del Coach / LecturaIA (Fase 0 · Maqueta)
// Presenta shimmer visual con degradé de tokens y transiciones sin saltos.
export default function EstadoCargaCoach() {
  const [estado, setEstado] = useState('listo') // 'listo' | 'cargando' | 'resultado'
  const [faseCarga, setFaseCarga] = useState(0)

  const simularAnalisis = () => {
    sentir('toque')
    setEstado('cargando')
    setFaseCarga(1)

    setTimeout(() => {
      setFaseCarga(2)
    }, 1200)

    setTimeout(() => {
      setEstado('resultado')
      sentir('meta')
    }, 2800)
  }

  const reiniciar = () => {
    sentir('toque')
    setEstado('listo')
    setFaseCarga(0)
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontFamily: 'Chakra Petch, sans-serif', fontSize: '12px', color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
          Estados de Interfaz · Coach & LecturaIA
        </div>
        <div style={{display: 'flex', gap: 'var(--sp-1)'}}>
          {['listo', 'cargando', 'resultado'].map(est => (
            <button
              key={est}
              type="button"
              className={`mq-btn-tema ${estado === est ? 'activo' : ''}`}
              style={{minHeight: '30px', padding: '2px 10px', fontSize: '11px'}}
              onClick={() => {
                sentir('toque')
                setEstado(est)
              }}
            >
              {{listo: 'Listo', cargando: 'Cargando', resultado: 'Respuesta'}[est]}
            </button>
          ))}
        </div>
      </div>

      {/* Estado 1: Listo para consultar */}
      {estado === 'listo' && (
        <section className="mq-seccion mq-stagger-1">
          <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
            <Icono n="estrella" tam={20} />
            <h3 style={{margin: 0}}>Coach MMV · Análisis Diario</h3>
          </div>
          <p className="mu" style={{margin: 0, fontSize: '14px', lineHeight: 1.4}}>
            Tu motor local recopiló 4 señales de recuperación (sueño profundo de 7h 48m, balance de agua óptimo, descanso de fuerza).
          </p>
          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-2)'}}>
            <button type="button" className="cta" onClick={simularAnalisis}>
              <Icono n="rayo" tam={18} className="en-texto" /> Pedir consejo al Coach
            </button>
          </div>
        </section>
      )}

      {/* Estado 2: Cargando (Shimmer + Barra cuántica) */}
      {estado === 'cargando' && (
        <section className="mq-seccion mq-stagger-1">
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: 'var(--r-pill)',
                  border: '2px solid var(--ac)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <h3 style={{margin: 0, color: 'var(--ac)'}}>
                {faseCarga === 1 ? 'Sintetizando hechos del día…' : 'Gemini formulando recomendación…'}
              </h3>
            </div>
            <span className="tag" style={{fontSize: '11px', color: 'var(--tx-2)'}}>Costo cero / Cuota protegida</span>
          </div>

          <div className="mq-shimmer-box" style={{marginTop: 'var(--sp-2)'}}>
            <div className="mq-shimmer-linea" style={{width: '75%'}} />
            <div className="mq-shimmer-linea" style={{width: '95%'}} />
            <div className="mq-shimmer-linea" style={{width: '60%'}} />

            {/* Barra de progreso cuántica animada */}
            <div className="mq-barra-cuantica">
              <div className="mq-barra-cuantica-haz" />
            </div>
          </div>

          <small className="mu" style={{display: 'block', textAlign: 'center', marginTop: 'var(--sp-1)'}}>
            Procesamiento seguro · Tus datos biométricos no salen de tu dispositivo
          </small>
        </section>
      )}

      {/* Estado 3: Respuesta Generada */}
      {estado === 'resultado' && (
        <section className="mq-seccion mq-stagger-1" style={{borderLeft: '4px solid var(--pos)'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
              <Icono n="check" tam={20} />
              <h3 style={{margin: 0, color: 'var(--pos)'}}>Recomendación del Coach</h3>
            </div>
            <span className="tag" style={{color: 'var(--pos)', fontSize: '11px'}}>Evidencia sólida</span>
          </div>

          <div
            style={{
              background: 'var(--sf-2)',
              borderRadius: 'var(--r-tile)',
              padding: 'var(--sp-3)',
              marginTop: 'var(--sp-2)',
              border: '1px solid var(--bd-sutil)'
            }}
          >
            <p style={{margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--tx)'}}>
              <b>Día ideal para trabajo pesado:</b> Tu calidad de sueño subió 18% respecto a tu media de 14 días. Te sugiero mantener la serie pesada planificada en Sentadilla y adelantar la hidratación antes de las 18:00 h.
            </p>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)'}}>
            <button type="button" className="ghost mini" onClick={reiniciar}>
              <Icono n="deshacer" tam={16} className="en-texto" /> Reiniciar demostración
            </button>
            <button type="button" className="mini" onClick={() => sentir('guardar')}>
              Aceptar consejo
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
