import {useState, useEffect, useId} from 'react'
import Icono from '../../ui/Icono'
import {sentir} from '../../services/feedback'

// Trazo SVG interactivo con animación progresiva de recorrido (Fase 0 · Maqueta)
export default function TrazoNuevo() {
  const [progreso, setProgreso] = useState(100)
  const [animando, setAnimando] = useState(false)
  const idGrad = useId()

  // Coordenadas simuladas de una ruta panorámica limpia (parque / circuito)
  const dRuta = 'M 20,120 Q 50,40 100,70 T 180,50 T 250,110 T 320,60 T 380,130'

  const reproducir = () => {
    if (animando) return
    sentir('toque')
    setAnimando(true)
    setProgreso(0)
    setTimeout(() => {
      setProgreso(100)
      setTimeout(() => {
        setAnimando(false)
        sentir('guardar')
      }, 1900)
    }, 50)
  }

  useEffect(() => {
    // Iniciar con animación suave al montar
    const t = setTimeout(() => {
      setProgreso(100)
    }, 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)'}}>
      <div style={{position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-tile)'}}>
        <svg
          viewBox="0 0 400 160"
          className="mq-trazo-gps"
          role="img"
          aria-label="Trazo interactivo del recorrido GPS"
        >
          <defs>
            <linearGradient id={idGrad} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--ac)" />
              <stop offset="100%" stopColor="var(--pr)" />
            </linearGradient>
          </defs>

          {/* Línea tenue de fondo (camino total) */}
          <path
            d={dRuta}
            fill="none"
            stroke="var(--pista)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />

          {/* Línea animada activa */}
          <path
            d={dRuta}
            fill="none"
            stroke={`url(#${idGrad})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - progreso}
            className="mq-trazo-linea-animada"
          />

          {/* Punto de Inicio */}
          <circle
            cx="20"
            cy="120"
            r="6"
            fill="var(--bg)"
            stroke="var(--tx)"
            strokeWidth="2.5"
          />

          {/* Punto de Fin (con efecto pop al completarse) */}
          {progreso >= 95 && (
            <circle
              cx="380"
              cy="130"
              r="6.5"
              fill="var(--pr)"
              stroke="var(--bg)"
              strokeWidth="2"
              className="mq-anillo-pop"
            />
          )}
        </svg>

        {/* Indicador de distancia y estado en esquina */}
        <div
          style={{
            position: 'absolute',
            bottom: 'var(--sp-2)',
            right: 'var(--sp-2)',
            background: 'var(--sf-2)',
            padding: '4px 10px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--bd-sutil)',
            fontSize: '11px',
            fontFamily: 'Chakra Petch, monospace',
            color: 'var(--tx-2)'
          }}
        >
          {animando ? 'Simulando GPS…' : '5,42 km · Circuito Parque'}
        </div>
      </div>

      <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-1)'}}>
        <button
          type="button"
          className="ghost mini"
          onClick={reproducir}
          disabled={animando}
        >
          <Icono n="repetir" tam={16} className="en-texto" />{' '}
          {animando ? 'Dibujando ruta…' : 'Reproducir trazo GPS'}
        </button>
      </div>
    </div>
  )
}
