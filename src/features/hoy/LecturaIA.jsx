import {useState, useMemo} from 'react'
import {hoy, cfg} from '../../data/db'
import {pedirIA} from '../../services/ia'
import {leerLecturaGuardada, guardarLectura, anotarUso} from '../../data/iaDia'
import {datosDia, hayDatosDia, huella, cuerpoDia, limpiarDia, armarCache, estadoCache, AVISO_DIA} from '../../domain/iaDia'

const hhmm = iso => {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleTimeString('es-UY', {hour: '2-digit', minute: '2-digit', hour12: false})
}

// Lectura del día con IA (Entrega 48). Vive dentro de la Nota del día, al abrirla. Nunca llama sola: solo al tocar el
// botón. Si ya hay una lectura de hoy se muestra sin red; si cargaste datos nuevos después, avisa y deja actualizar.
// `d` son los datos que lee la Nota (data/senales.js) y `hora` la hora decimal.
export default function LecturaIA({d, metas, hora}) {
  const [cache, setCache] = useState(leerLecturaGuardada),
    [msg, setMsg] = useState(''),
    [ocupado, setOcupado] = useState(false)
  const datos = useMemo(() => datosDia({...d, ...metas, fecha: hoy(), hora}), [d, metas, hora]),
    h = useMemo(() => huella(datos), [datos]),
    estado = estadoCache(cache, hoy(), h)
  if (!cfg('key') || !hayDatosDia(datos)) return null
  const pedir = async () => {
    setOcupado(true)
    setMsg('Consultando a la IA…')
    try {
      const r = await pedirIA({
        modelos: [cfg('modelo', 'gemini-3.8-flash'), 'gemini-flash-latest'],
        key: cfg('key'),
        cuerpo: cuerpoDia(datos),
        prog: setMsg,
        alt: 'seguí con la nota de arriba'
      })
      const nueva = armarCache({fecha: hoy(), huella: h, lectura: limpiarDia(r)})
      await anotarUso(hoy())
      guardarLectura(nueva)
      setCache(nueva)
      setMsg('')
    } catch (e) {
      setMsg('No pude consultar a la IA: ' + e.message)
    }
    setOcupado(false)
  }
  const l = estado !== 'sin' ? cache.lectura : null
  return (
    <div className="lectura-ia">
      <small className="tag">Lectura del día con IA</small>
      {l && (
        <>
          {l.resumen && <p style={{margin: '4px 0'}}>{l.resumen}</p>}
          {l.sugerencias.length > 0 && (
            <ul className="nota-l">
              {l.sugerencias.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          {l.alerta && <p className="warn">{l.alerta}</p>}
          <small className="mu" style={{display: 'block'}}>
            Generada a las {hhmm(cache.creado)}
            {estado === 'desactualizada' ? '; cargaste datos nuevos desde entonces.' : ' con los datos de hoy.'}
          </small>
        </>
      )}
      {!l && (
        <p className="mu" style={{margin: '4px 0'}}>
          Una lectura corta de cómo viene tu día. Se pide solo cuando tocás el botón.
        </p>
      )}
      <div className="row" style={{margin: '8px 0'}}>
        <button type="button" className={estado === 'vigente' ? 'ghost' : 'pri'} disabled={ocupado} onClick={pedir}>
          {estado === 'sin' ? 'Pedir lectura del día' : 'Actualizar lectura'}
        </button>
      </div>
      {msg && <p className={msg.startsWith('No pude') ? 'warn' : 'mu'}>{msg}</p>}
      <small className="mu" style={{display: 'block'}}>
        {AVISO_DIA}
      </small>
    </div>
  )
}
