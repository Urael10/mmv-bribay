import {useState, useEffect} from 'react'
import {db, hoy} from '../../data/db'
import {descarga} from '../../domain/progreso'
import {sumaDias} from '../../domain/stats'

// Aviso de descarga (misma regla en Progreso y en Hoy): solo aparece con 2 o más señales.
export function CajaDescarga({des}) {
  if (!des?.sugerir) return null
  return (
    <section className="warn" role="alert">
      <b>Conviene una semana de descarga</b>
      {des.senales.map(s => (
        <div key={s}>• {s}</div>
      ))}
      <small className="mu">{des.texto}</small>
    </section>
  )
}
export function AvisoDescarga() {
  const [des, setDes] = useState(null)
  useEffect(() => {
    ;(async () => {
      const fecha = hoy(),
        desde = sumaDias(fecha, -30)
      setDes(
        descarga({
          fecha,
          sesiones: await db.sesiones.where('fecha').aboveOrEqual(desde).toArray(),
          habitos: await db.habitos.where('fecha').aboveOrEqual(desde).toArray()
        })
      )
    })()
  }, [])
  return <CajaDescarga des={des} />
}
