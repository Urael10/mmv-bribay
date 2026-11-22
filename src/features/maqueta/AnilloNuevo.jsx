import {useState, useEffect} from 'react'
import Icono from '../../ui/Icono'
import {sentir} from '../../services/feedback'

// Anillo interactivo evolucionado (Fase 0 · Maqueta)
// Incorpora físicas de resorte en stroke-dasharray y celebración visual al cumplir la meta.
export default function AnilloNuevo({
  valor = 75,
  meta = 100,
  tam = 72,
  metrica = 'agua',
  mostrarControles = true
}) {
  const [val, setVal] = useState(valor)
  const [pop, setPop] = useState(false)
  const [corriendo, setCorriendo] = useState(false)

  const largo = Math.min(100, Math.max(0, Math.round((val / meta) * 100)))
  const cumplida = val >= meta

  const colorMetrica = {
    agua: 'var(--m-agua)',
    pasos: 'var(--m-pasos)',
    comida: 'var(--m-comida)',
    sueno: 'var(--m-sueno)'
  }[metrica] || 'var(--ac)'

  const cambiarValor = nuevo => {
    setVal(nuevo)
    if (nuevo >= meta && !cumplida) {
      setPop(true)
      sentir('meta')
      setTimeout(() => setPop(false), 600)
    } else {
      sentir('toque')
    }
  }

  // Simulación continua de progreso
  useEffect(() => {
    if (!corriendo) return
    const id = setInterval(() => {
      setVal(v => {
        const sig = v >= 120 ? 0 : v + 20
        if (sig >= meta && v < meta) {
          setPop(true)
          sentir('meta')
          setTimeout(() => setPop(false), 600)
        }
        return sig
      })
    }, 900)
    return () => clearInterval(id)
  }, [corriendo, meta])

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)'}}>
      <div
        className={`anillo ${cumplida ? 'ok' : ''} ${pop ? 'mq-anillo-pop' : ''}`}
        style={{
          width: tam,
          height: tam,
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          transition: 'transform var(--dur-normal) var(--ease-spring)'
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" width={tam} height={tam} className="mq-anillo-svg">
          <circle
            className="anillo-pista"
            cx="18"
            cy="18"
            r="15.9155"
            pathLength="100"
            fill="none"
          />
          <circle
            className="anillo-arco-animado"
            cx="18"
            cy="18"
            r="15.9155"
            pathLength="100"
            fill="none"
            strokeDasharray={`${largo} 100`}
            stroke={cumplida ? 'var(--pos)' : colorMetrica}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: cumplida ? 'var(--pos)' : 'var(--tx-2)',
            transition: 'color var(--dur-fast), transform var(--dur-fast) var(--ease-spring)',
            transform: pop ? 'scale(1.15)' : 'scale(1)'
          }}
        >
          {cumplida ? (
            <Icono n="check" tam={tam * 0.38} />
          ) : (
            <span style={{fontFamily: 'Chakra Petch, monospace', fontSize: `${tam * 0.26}px`, fontWeight: 700}}>
              {largo}%
            </span>
          )}
        </div>
      </div>

      {mostrarControles && (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)', width: '100%'}}>
          <div style={{display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap', justifyContent: 'center'}}>
            {[0, 35, 75, 100, 120].map(p => (
              <button
                key={p}
                type="button"
                className={`mq-btn-tema ${val === p ? 'activo' : ''}`}
                style={{minHeight: '34px', padding: '4px 10px'}}
                onClick={() => cambiarValor(p)}
              >
                {p}%
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`ghost mini ${corriendo ? 'on' : ''}`}
            onClick={() => setCorriendo(c => !c)}
            style={{marginTop: 'var(--sp-1)'}}
          >
            <Icono n={corriendo ? 'pausa' : 'play'} tam={16} className="en-texto" />{' '}
            {corriendo ? 'Detener simulación' : 'Simular progreso automático'}
          </button>
        </div>
      )}
    </div>
  )
}
