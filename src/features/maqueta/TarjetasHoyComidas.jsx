import {useState} from 'react'
import Icono from '../../ui/Icono'
import AnilloNuevo from './AnilloNuevo'
import {sentir} from '../../services/feedback'

// Tarjetas de ejemplo del dashboard Hoy y Comidas (Fase 0 · Maqueta)
// Demuestra entrada escalonada (stagger), feedback táctil elástico y check animado de hábito.
export default function TarjetasHoyComidas() {
  const [keyReanimar, setKeyReanimar] = useState(0)
  const [habito1, setHabito1] = useState(false)
  const [habito2, setHabito2] = useState(true)
  const [aguaHoy, setAguaHoy] = useState(1750)
  const metaAgua = 2500

  const reanimar = () => {
    sentir('toque')
    setKeyReanimar(k => k + 1)
  }

  const toggleHabito = (val, setter) => {
    setter(!val)
    if (!val) {
      sentir('guardar')
    } else {
      sentir('toque')
    }
  }

  const sumarAgua = cantidad => {
    setAguaHoy(a => {
      const nuevo = Math.max(0, a + cantidad)
      if (nuevo >= metaAgua && a < metaAgua) {
        sentir('meta')
      } else {
        sentir('toque')
      }
      return nuevo
    })
  }

  return (
    <div key={keyReanimar} style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'}}>
      {/* Botón de control de stagger */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontFamily: 'Chakra Petch, sans-serif', fontSize: '12px', color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
          Simulación de Dashboard Diario
        </div>
        <button type="button" className="ghost mini" onClick={reanimar}>
          <Icono n="repetir" tam={16} className="en-texto" /> Reanimar entrada (Stagger)
        </button>
      </div>

      {/* 1. Mosaicos de Hoy (Stagger 1) */}
      <section className="mq-seccion mq-stagger-1 mq-tarjeta-tactil">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3 style={{margin: 0}}>Métricas Diarias · Hoy</h3>
          <span className="tag" style={{fontSize: '11px', color: 'var(--ac)'}}>Toque interactivo</span>
        </div>

        <div className="mq-grid-hoy">
          {/* Tesela Agua con suma rápida */}
          <div className="mq-tesela-hoy" onClick={() => sumarAgua(250)}>
            <AnilloNuevo valor={aguaHoy} meta={metaAgua} tam={48} metrica="agua" mostrarControles={false} />
            <div className="mq-tesela-info">
              <span className="mq-tesela-etiq">Agua</span>
              <span className="mq-tesela-val">{aguaHoy} ml</span>
              <span className="mq-tesela-meta">Meta {metaAgua} ml</span>
            </div>
          </div>

          {/* Tesela Pasos */}
          <div className="mq-tesela-hoy" onClick={() => sentir('toque')}>
            <AnilloNuevo valor={8420} meta={10000} tam={48} metrica="pasos" mostrarControles={false} />
            <div className="mq-tesela-info">
              <span className="mq-tesela-etiq">Pasos</span>
              <span className="mq-tesela-val">8.420</span>
              <span className="mq-tesela-meta">Meta 10k</span>
            </div>
          </div>

          {/* Tesela Comidas */}
          <div className="mq-tesela-hoy" onClick={() => sentir('toque')}>
            <AnilloNuevo valor={1850} meta={2200} tam={48} metrica="comida" mostrarControles={false} />
            <div className="mq-tesela-info">
              <span className="mq-tesela-etiq">Calorías</span>
              <span className="mq-tesela-val">1.850</span>
              <span className="mq-tesela-meta">Meta 2.200</span>
            </div>
          </div>

          {/* Tesela Sueño */}
          <div className="mq-tesela-hoy" onClick={() => sentir('toque')}>
            <AnilloNuevo valor={7.8} meta={8} tam={48} metrica="sueno" mostrarControles={false} />
            <div className="mq-tesela-info">
              <span className="mq-tesela-etiq">Sueño</span>
              <span className="mq-tesela-val">7h 48m</span>
              <span className="mq-tesela-meta">Meta 8h</span>
            </div>
          </div>
        </div>

        <div style={{display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)', justifyContent: 'flex-end'}}>
          <button type="button" className="ghost mini" onClick={() => sumarAgua(250)}>
            +250 ml agua
          </button>
          <button type="button" className="ghost mini" onClick={() => setAguaHoy(0)}>
            Reiniciar
          </button>
        </div>
      </section>

      {/* 2. Micro-interacción: Hábitos y Check animado (Stagger 2) */}
      <section className="mq-seccion mq-stagger-2">
        <h3 style={{margin: 0}}>Hábitos y Check-in Rápido</h3>
        <p className="mu" style={{margin: 0, fontSize: '13px'}}>
          Tocá un hábito para observar el trazo SVG dibujándose con retroalimentación táctil elástica:
        </p>

        <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)'}}>
          <button
            type="button"
            className={`mq-check-btn ${habito1 ? 'completado' : ''}`}
            onClick={() => toggleHabito(habito1, setHabito1)}
          >
            <div className="mq-check-icono">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" className="mq-check-trazo" />
              </svg>
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{fontSize: '14px', fontWeight: 600, color: 'var(--tx)'}}>
                Tomar creatina (5g) en ayunas
              </div>
              <small className="mu">Hábito diario matutino</small>
            </div>
            {habito1 && <span className="tag" style={{color: 'var(--pos)'}}>Listo</span>}
          </button>

          <button
            type="button"
            className={`mq-check-btn ${habito2 ? 'completado' : ''}`}
            onClick={() => toggleHabito(habito2, setHabito2)}
          >
            <div className="mq-check-icono">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" className="mq-check-trazo" />
              </svg>
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{fontSize: '14px', fontWeight: 600, color: 'var(--tx)'}}>
                Caminata de desconexión nocturna
              </div>
              <small className="mu">20 minutos sin pantallas</small>
            </div>
            {habito2 && <span className="tag" style={{color: 'var(--pos)'}}>Listo</span>}
          </button>
        </div>
      </section>

      {/* 3. Tarjeta de Comidas y Distribución de Macros (Stagger 3) */}
      <section className="mq-seccion mq-stagger-3 mq-tarjeta-tactil" onClick={() => sentir('toque')}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <h3 style={{margin: 0}}>Alimentación · Distribución de Macros</h3>
          <span style={{fontFamily: 'Chakra Petch, monospace', fontSize: '13px', color: 'var(--tx-2)'}}>
            1.850 / 2.200 kcal
          </span>
        </div>

        {/* Barra segmentada proporcional */}
        <div className="mq-macro-barra">
          <div className="mq-macro-seg mq-macro-p" style={{width: '35%'}} title="Proteína: 35%" />
          <div className="mq-macro-seg mq-macro-c" style={{width: '45%'}} title="Carbohidratos: 45%" />
          <div className="mq-macro-seg mq-macro-g" style={{width: '20%'}} title="Grasas: 20%" />
        </div>

        {/* Etiquetas de macros con color institucional */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)', textAlign: 'center'}}>
          <div style={{background: 'var(--sf-2)', padding: 'var(--sp-2)', borderRadius: 'var(--r-tile)', border: '1px solid var(--bd-sutil)'}}>
            <small style={{color: 'var(--m-p)', fontWeight: 700}}>PROTEÍNA</small>
            <div style={{fontFamily: 'Chakra Petch, monospace', fontSize: '16px', fontWeight: 700, color: 'var(--tx)'}}>
              145 g
            </div>
            <span className="mu" style={{fontSize: '11px'}}>Meta 160 g</span>
          </div>

          <div style={{background: 'var(--sf-2)', padding: 'var(--sp-2)', borderRadius: 'var(--r-tile)', border: '1px solid var(--bd-sutil)'}}>
            <small style={{color: 'var(--m-c)', fontWeight: 700}}>CARBOS</small>
            <div style={{fontFamily: 'Chakra Petch, monospace', fontSize: '16px', fontWeight: 700, color: 'var(--tx)'}}>
              210 g
            </div>
            <span className="mu" style={{fontSize: '11px'}}>Meta 240 g</span>
          </div>

          <div style={{background: 'var(--sf-2)', padding: 'var(--sp-2)', borderRadius: 'var(--r-tile)', border: '1px solid var(--bd-sutil)'}}>
            <small style={{color: 'var(--m-g)', fontWeight: 700}}>GRASAS</small>
            <div style={{fontFamily: 'Chakra Petch, monospace', fontSize: '16px', fontWeight: 700, color: 'var(--tx)'}}>
              55 g
            </div>
            <span className="mu" style={{fontSize: '11px'}}>Meta 65 g</span>
          </div>
        </div>
      </section>
    </div>
  )
}
