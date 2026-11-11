import {useState, useEffect, useMemo} from 'react'
import {liveQuery} from 'dexie'
import Icono from '../../ui/Icono'
import {hoy} from '../../data/db'
import {leerSenales, metasNota} from '../../data/senales'
import {notaDelDia, AVISO_NOTA} from '../../domain/senales'

const horaAhora = () => {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

// Nota del día (Entrega 45, propuesta B): una franja de una línea arriba de la rejilla que se abre al tocarla.
// Todo se lee de la base y se vuelve a leer cuando algo cambia (agua, sueño, pasos, comidas, entrenos, actividades),
// con `liveQuery`: no depende de la copia de Hoy, que arranca con un valor de relleno. Todo local: no hay IA ni red.
export default function NotaDelDia() {
  const [d, setD] = useState(null),
    [ab, setAb] = useState(false),
    [hora, setHora] = useState(horaAhora)
  useEffect(() => {
    const sub = liveQuery(() => leerSenales(hoy())).subscribe({next: setD, error: () => setD(null)})
    const t = setInterval(() => setHora(horaAhora()), 5 * 60 * 1000)
    return () => {
      sub.unsubscribe()
      clearInterval(t)
    }
  }, [])
  const nota = useMemo(() => {
    if (!d) return null
    return notaDelDia({...d, ...metasNota(), fecha: hoy(), hora})
  }, [d, hora])
  if (!nota?.principal) return null
  return (
    <section className="nota" aria-label="Nota del día">
      <button type="button" className="nota-b" aria-expanded={ab} aria-controls="hoy-nota-d" onClick={() => setAb(v => !v)}>
        <Icono n="info" tam={20} className="nota-i" />
        <span className="nota-t">{nota.principal.corto}</span>
        <Icono n="chevron-abajo" tam={18} className={'vacio-ch' + (ab ? ' abierto' : '')} />
      </button>
      <div id="hoy-nota-d" className="nota-d" hidden={!ab}>
        <ul className="nota-l">
          {nota.lista.map(s => (
            <li key={s.id}>{s.texto}</li>
          ))}
        </ul>
        <small className="mu">{AVISO_NOTA}</small>
      </div>
    </section>
  )
}
