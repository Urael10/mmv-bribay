import {useRef, useState, useEffect, useCallback} from 'react'

// Pestañas en una sola fila con deslizamiento horizontal.
// La activa se centra sola y un degradé en el borde avisa si hay más pestañas fuera de pantalla.
// `items`: [[clave, nombre], …] · `valor`: clave activa · `onCambio(clave)`.
export default function TabsDeslizables({items, valor, onCambio, etiqueta = 'Secciones'}) {
  const lista = useRef(null),
    [borde, setBorde] = useState({izq: false, der: false})

  const medir = useCallback(() => {
    const el = lista.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setBorde({izq: el.scrollLeft > 4, der: el.scrollLeft < max - 4})
  }, [])

  // Centra la pestaña activa al montar y cada vez que cambia.
  useEffect(() => {
    const el = lista.current,
      act = el?.querySelector('[aria-selected="true"]')
    if (el && act) {
      const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({
        left: act.offsetLeft - (el.clientWidth - act.offsetWidth) / 2,
        behavior: reducir ? 'auto' : 'smooth'
      })
    }
    medir()
  }, [valor, medir])

  useEffect(() => {
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir])

  // Flechas del teclado entre pestañas.
  const tecla = e => {
    const i = items.findIndex(([k]) => k === valor)
    let j = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(items.length - 1, i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1)
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = items.length - 1
    if (j === null) return
    e.preventDefault()
    onCambio(items[j][0])
    lista.current?.querySelectorAll('[role="tab"]')[j]?.focus()
  }

  return (
    <div className={'tabs-wrap' + (borde.izq ? ' hay-izq' : '') + (borde.der ? ' hay-der' : '')}>
      <div
        ref={lista}
        className="tabs-lista"
        role="tablist"
        aria-label={etiqueta}
        onScroll={medir}
        onKeyDown={tecla}
      >
        {items.map(([k, n]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={valor === k}
            tabIndex={valor === k ? 0 : -1}
            className={'chip' + (valor === k ? ' on' : '')}
            onClick={() => onCambio(k)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
