// Navegador de fecha/semana: una sola fila (flecha · título centrado · flecha).
// Las columnas fijas de 44 px las define .navfecha en styles.css.
export default function NavFecha({titulo, sub, onAnterior, onSiguiente, sinSiguiente, deshabilitado, anteriorLabel, siguienteLabel, extra}) {
  return (
    <div className="navfecha">
      <button className="ghost mini" disabled={deshabilitado} onClick={onAnterior} aria-label={anteriorLabel}>
        ◀
      </button>
      <div className="navfecha-t">
        <b>{titulo}</b>
        {sub && <small className="tag">{sub}</small>}
      </div>
      <button
        className="ghost mini"
        disabled={deshabilitado || sinSiguiente}
        onClick={onSiguiente}
        aria-label={siguienteLabel}
      >
        ▶
      </button>
      {extra && <div className="navfecha-x">{extra}</div>}
    </div>
  )
}
