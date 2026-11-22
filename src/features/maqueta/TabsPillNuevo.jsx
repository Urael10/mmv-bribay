import {useRef, useState, useEffect, useCallback} from 'react'
import {sentir} from '../../services/feedback'

// Tabs deslizables con pastilla/pill elástica (Fase 0 · Maqueta)
// Proporciona retroalimentación espacial continua al cambiar de sección activa.
export default function TabsPillNuevo({
  items,
  valor,
  onCambio,
  etiqueta = 'Navegación de secciones'
}) {
  const contenedorRef = useRef(null)
  const [estiloPill, setEstiloPill] = useState({left: 0, width: 0, opacity: 0})

  const actualizarPill = useCallback(() => {
    const el = contenedorRef.current
    if (!el) return
    const botonActivo = el.querySelector('[aria-selected="true"]')
    if (botonActivo) {
      const contenedorRect = el.getBoundingClientRect()
      const botonRect = botonActivo.getBoundingClientRect()
      setEstiloPill({
        left: botonRect.left - contenedorRect.left,
        width: botonRect.width,
        opacity: 1
      })

      // Centrado suave del botón activo
      const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({
        left: botonActivo.offsetLeft - (el.clientWidth - botonActivo.offsetWidth) / 2,
        behavior: reducir ? 'auto' : 'smooth'
      })
    }
  }, [])

  useEffect(() => {
    actualizarPill()
  }, [valor, actualizarPill])

  useEffect(() => {
    window.addEventListener('resize', actualizarPill)
    return () => window.removeEventListener('resize', actualizarPill)
  }, [actualizarPill])

  const manejarTecla = e => {
    const idx = items.findIndex(([k]) => k === valor)
    let nuevoIdx = null
    if (e.key === 'ArrowRight') nuevoIdx = Math.min(items.length - 1, idx + 1)
    else if (e.key === 'ArrowLeft') nuevoIdx = Math.max(0, idx - 1)
    else if (e.key === 'Home') nuevoIdx = 0
    else if (e.key === 'End') nuevoIdx = items.length - 1

    if (nuevoIdx !== null && nuevoIdx !== idx) {
      e.preventDefault()
      sentir('toque')
      onCambio(items[nuevoIdx][0])
      contenedorRef.current?.querySelectorAll('[role="tab"]')[nuevoIdx]?.focus()
    }
  }

  const alHacerClic = k => {
    if (k !== valor) {
      sentir('toque')
      onCambio(k)
    }
  }

  return (
    <div className="mq-tabs-wrap">
      <div
        ref={contenedorRef}
        className="mq-tabs-lista"
        role="tablist"
        aria-label={etiqueta}
        onKeyDown={manejarTecla}
      >
        {/* Pastilla deslizante animada */}
        <div
          className="mq-tab-pill"
          style={{
            transform: `translateX(${estiloPill.left}px)`,
            width: `${estiloPill.width}px`,
            opacity: estiloPill.opacity
          }}
          aria-hidden="true"
        />

        {items.map(([clave, etiquetaTab]) => {
          const activo = valor === clave
          return (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={activo}
              tabIndex={activo ? 0 : -1}
              className={`mq-tab-btn ${activo ? 'activo' : ''}`}
              onClick={() => alHacerClic(clave)}
            >
              {etiquetaTab}
            </button>
          )
        })}
      </div>
    </div>
  )
}
