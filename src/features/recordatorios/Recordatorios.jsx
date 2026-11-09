import {useState, useEffect} from 'react'
import {hoy} from '../../data/db'
import {notificaciones} from '../../platform/notificaciones'
import {INTERVALOS_AGUA, estadoAcostarte} from '../../domain/recordatorios'
import {leerConfig, guardarConfig, reprogramar, habitosRecientes} from './servicio'

// Entrega 41 (v0.42.0) · Ajustes › Recordatorios. Avisos del teléfono (solo en la app de Android) para el check-in, la
// hora de acostarte y el agua. El permiso de notificaciones se pide acá, al activar el primero; no antes.
const AYUDA_PERMISO =
  'Android no dejó mostrar avisos. Activalos en Ajustes del teléfono › Aplicaciones › Mi Mejor Versión › Notificaciones y volvé a probar.'

export default function Recordatorios() {
  const nativo = notificaciones.disponible(),
    [c, setC] = useState(leerConfig),
    [permiso, setPermiso] = useState(null),
    [msg, setMsg] = useState(''),
    [noche, setNoche] = useState(null)
  useEffect(() => {
    if (!nativo) return
    notificaciones.permiso().then(setPermiso)
    habitosRecientes()
      .then(hs => setNoche(estadoAcostarte(hs, hoy())))
      .catch(() => {})
  }, [nativo])

  if (!nativo)
    return (
      <section>
        <h3>Recordatorios</h3>
        <p>
          Los recordatorios del check-in, de la hora de acostarte y del agua funcionan en la app de Android. En el
          navegador no se pueden mostrar avisos con la app cerrada.
        </p>
      </section>
    )

  // Guarda y reprograma. Si se activó algo y falta el permiso, se pide recién ahora; sin permiso no queda nada activado.
  const aplicar = async (nueva, activando) => {
    setMsg('')
    if (activando) {
      let p = await notificaciones.permiso()
      if (p !== 'granted') p = await notificaciones.pedirPermiso()
      setPermiso(p)
      if (p !== 'granted') {
        setMsg(AYUDA_PERMISO)
        return
      }
    }
    setC(nueva)
    guardarConfig(nueva)
    const r = await reprogramar()
    if (r.ok) setMsg(r.n ? `Listo: ${r.n} avisos programados para los próximos 7 días.` : 'Sin avisos programados.')
    else if (r.motivo === 'sin-permiso') {
      setPermiso('denied')
      setMsg(AYUDA_PERMISO)
    } else setMsg('No pude programar los avisos. Probá de nuevo.')
  }
  const cambia = (tipo, cambio, activando = false) => aplicar({...c, [tipo]: {...c[tipo], ...cambio}}, activando)

  return (
    <section>
      <h3>Recordatorios</h3>
      <p>
        Avisos del teléfono. Se recalculan cada vez que abrís la app o cambian tus datos: si ya hiciste el check-in o
        llegaste a la meta de agua, hoy no te insisten.
      </p>
      {permiso === 'denied' && (c.checkin.on || c.acostarte.on || c.agua.on) && (
        <small className="mu" role="alert">
          {AYUDA_PERMISO}
        </small>
      )}

      <p>
        <label className="check">
          <input
            type="checkbox"
            checked={c.checkin.on}
            onChange={e => cambia('checkin', {on: e.target.checked}, e.target.checked)}
          />
          <span>Check-in del día</span>
        </label>
      </p>
      {c.checkin.on && (
        <label className="ck-c">
          <span className="mu">Hora del aviso</span>
          <input
            type="time"
            value={c.checkin.hora}
            onChange={e => e.target.value && cambia('checkin', {hora: e.target.value})}
          />
        </label>
      )}

      <p>
        <label className="check">
          <input
            type="checkbox"
            checked={c.acostarte.on}
            onChange={e => cambia('acostarte', {on: e.target.checked}, e.target.checked)}
          />
          <span>Hora de acostarte</span>
        </label>
      </p>
      {c.acostarte.on && noche && (
        <small className="mu">
          {noche.listo
            ? `Te aviso 30 min antes de tu hora habitual (${noche.acosto}, según ${noche.dias} días).`
            : 'Todavía no hay hora habitual: se activa cuando tengas al menos 2 días con la hora de acostarte y de levantarte.'}
        </small>
      )}

      <p>
        <label className="check">
          <input
            type="checkbox"
            checked={c.agua.on}
            onChange={e => cambia('agua', {on: e.target.checked}, e.target.checked)}
          />
          <span>Agua</span>
        </label>
      </p>
      {c.agua.on && (
        <div className="row">
          <label className="ck-c">
            <span className="mu">Desde</span>
            <input type="time" value={c.agua.desde} onChange={e => e.target.value && cambia('agua', {desde: e.target.value})} />
          </label>
          <label className="ck-c">
            <span className="mu">Hasta</span>
            <input type="time" value={c.agua.hasta} onChange={e => e.target.value && cambia('agua', {hasta: e.target.value})} />
          </label>
          <label className="ck-c">
            <span className="mu">Cada</span>
            <select value={c.agua.cada} onChange={e => cambia('agua', {cada: Number(e.target.value)})}>
              {INTERVALOS_AGUA.map(h => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {msg && (
        <small className={msg.startsWith('Listo') ? 'ok-msg' : 'mu'} role="status">
          {msg}
        </small>
      )}
    </section>
  )
}
