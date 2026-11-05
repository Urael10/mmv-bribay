// Historial de rutas GPS (Entrega 26): lista por mes con trazo, detalle con parciales y borrado.
// Solo muestra y guarda; los cálculos viven en domain/rutas.js. Carga las rutas recién al abrirse.
import {useEffect, useMemo, useState} from 'react'
import {contarRutas, listarRutas, borrarRuta} from '../../data/rutas'
import {TIPOS} from '../../domain/actividad'
import {agruparPorMes, segsDeRuta, formatoDuracion, formatoRitmo} from '../../domain/rutas'
import TrazoSvg from '../../ui/TrazoSvg'

const PAGINA = 15
const kmTxt = m => (m / 1000).toFixed(2).replace('.', ',')
const nombreMes = mes =>
  new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', {month: 'long', year: 'numeric'})
const fechaCorta = f =>
  new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })

function Detalle({ruta, onBorrar}) {
  const segs = useMemo(() => segsDeRuta(ruta), [ruta])
  const [confirmar, setConfirmar] = useState(false)
  return (
    <div className="ruta-det">
      <TrazoSvg
        segs={segs}
        ancho={320}
        alto={220}
        etiqueta={`Trazo de la ruta del ${fechaCorta(ruta.fecha)}`}
      />
      <div className="ruta-datos">
        <span>
          <b>{kmTxt(ruta.distM)}</b> km
        </span>
        <span>
          <b>{formatoDuracion(ruta.seg)}</b> tiempo
        </span>
        <span>
          <b>{formatoRitmo(ruta.ritmo)}</b> min/km
        </span>
        {ruta.sube != null && (
          <span>
            <b>≈{ruta.sube}</b> m de subida
          </span>
        )}
      </div>
      {ruta.parciales?.length > 0 && (
        <>
          <small className="mu">Parciales por km</small>
          {ruta.parciales.map((s, i) => (
            <div className="lin" key={i}>
              <span>Km {i + 1}</span>
              <span>{formatoRitmo(s)} min/km</span>
            </div>
          ))}
        </>
      )}
      {ruta.recortada && (
        <small className="mu">
          El comienzo y el final del trazo están ocultos por privacidad; la distancia y el ritmo son
          los del recorrido completo.
        </small>
      )}
      {confirmar ? (
        <div className="row">
          <small className="mu">¿Borrar esta ruta? La actividad registrada no se borra.</small>
          <button className="ghost" onClick={() => onBorrar(ruta.id)}>
            Sí, borrar
          </button>
          <button className="ghost" onClick={() => setConfirmar(false)}>
            No
          </button>
        </div>
      ) : (
        <button className="ghost mini" onClick={() => setConfirmar(true)}>
          Borrar ruta
        </button>
      )}
    </div>
  )
}

export default function Rutas({version = 0}) {
  const [abierto, setAbierto] = useState(false),
    [total, setTotal] = useState(null),
    [lista, setLista] = useState([]),
    [limite, setLimite] = useState(PAGINA),
    [cargando, setCargando] = useState(false),
    [error, setError] = useState(''),
    [sel, setSel] = useState(null)

  // Solo el contador mientras está cerrado: no se leen los trazos hasta que se abre.
  useEffect(() => {
    let vigente = true
    contarRutas()
      .then(n => vigente && setTotal(n))
      .catch(() => vigente && setTotal(null))
    return () => {
      vigente = false
    }
  }, [version])

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    setCargando(true)
    setError('')
    listarRutas(limite)
      .then(f => {
        if (vigente) {
          setLista(f)
          setCargando(false)
        }
      })
      .catch(() => {
        if (vigente) {
          setError('No se pudieron cargar tus rutas. Recargá la app e intentá de nuevo.')
          setCargando(false)
        }
      })
    return () => {
      vigente = false
    }
  }, [abierto, limite, version])

  const grupos = useMemo(() => agruparPorMes(lista), [lista])

  const borrar = async id => {
    try {
      await borrarRuta(id)
      setLista(l => l.filter(r => r.id !== id))
      setTotal(n => (n == null ? n : Math.max(0, n - 1)))
      setSel(null)
    } catch {
      setError('No se pudo borrar la ruta. Intentá de nuevo.')
    }
  }

  if (total === 0 && !abierto)
    return (
      <section style={{gridColumn: 'span 2'}}>
        <h3>Rutas</h3>
        <small className="mu">
          Cuando cuentes pasos con el GPS activado, el recorrido queda guardado acá (solo en tu
          teléfono).
        </small>
      </section>
    )

  return (
    <section style={{gridColumn: 'span 2'}}>
      <h3>Rutas</h3>
      <button className="ghost" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        {abierto ? 'Ocultar mis rutas' : `Ver mis rutas${total ? ` (${total})` : ''}`}
      </button>
      {abierto && (
        <>
          {error && (
            <small role="alert" className="mu">
              {error}
            </small>
          )}
          {cargando && !lista.length && <small className="mu">Cargando…</small>}
          {grupos.map(g => (
            <div key={g.mes} className="ruta-mes">
              <div className="lin">
                <b>{nombreMes(g.mes)}</b>
                <small className="mu">
                  {g.cantidad} {g.cantidad === 1 ? 'ruta' : 'rutas'} · {kmTxt(g.km * 1000)} km ·{' '}
                  {formatoDuracion(g.seg)}
                </small>
              </div>
              {g.rutas.map(r => (
                <div key={r.id} className="ruta-item">
                  <button
                    className="ruta-fila"
                    aria-expanded={sel === r.id}
                    onClick={() => setSel(s => (s === r.id ? null : r.id))}
                  >
                    <span className="ruta-mini">
                      <TrazoSvg
                        segs={segsDeRuta(r)}
                        ancho={96}
                        alto={64}
                        extremos={false}
                        etiqueta=""
                      />
                    </span>
                    <span className="ruta-txt">
                      <b>{TIPOS[r.tipo] || 'Actividad'}</b>
                      <small>
                        {fechaCorta(r.fecha)} · {kmTxt(r.distM)} km · {formatoDuracion(r.seg)} ·{' '}
                        {formatoRitmo(r.ritmo)} min/km
                      </small>
                    </span>
                  </button>
                  {sel === r.id && <Detalle ruta={r} onBorrar={borrar} />}
                </div>
              ))}
            </div>
          ))}
          {!cargando && !lista.length && !error && (
            <small className="mu">Todavía no hay rutas guardadas.</small>
          )}
          {total != null && lista.length < total && (
            <button
              className="ghost"
              disabled={cargando}
              onClick={() => setLimite(l => l + PAGINA)}
            >
              Ver más
            </button>
          )}
        </>
      )}
    </section>
  )
}
