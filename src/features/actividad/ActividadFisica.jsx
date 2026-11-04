import {useEffect, useRef, useState} from 'react'
import {db, hoy} from '../../data/db'
import {sumaDias} from '../../domain/stats'

const TIPOS = {
  bicicleta: '🚲 Bicicleta',
  caminata: '🚶 Caminata',
  carrera: '🏃 Carrera',
  natacion: '🏊 Natación',
  deporte: '🏅 Deporte',
  otro: 'Actividad'
}
const MAX_PASOS = 200000
const sesionDeHoy = () =>
  localStorage.getItem('mv_pasos_activo') === hoy()
    ? +(localStorage.getItem('mv_pasos_sesion') || 0)
    : 0

function ConteoPasos({total, fecha, activo, onActivoChange, onGuardar, onSumar, cargando}) {
  const [sesion, setSesion] = useState(sesionDeHoy),
    [estado, setEstado] = useState(''),
    [guardando, setGuardando] = useState(false),
    [recuperando, setRecuperando] = useState(() => {
      const guardada = localStorage.getItem('mv_pasos_activo')
      return !!guardada && guardada !== hoy()
    }),
    detector = useRef({base: null, arriba: false, ultimo: 0}),
    sesionRef = useRef(sesionDeHoy()),
    contandoRef = useRef(localStorage.getItem('mv_pasos_activo') === hoy()),
    ultimoDato = useRef(0)

  const iniciar = async () => {
    try {
      if (fecha !== hoy()) throw new Error('El sensor solo puede contar para el día de hoy.')
      if (!window.isSecureContext)
        throw new Error('Se necesita abrir MMV con una conexión segura (https).')
      if (!('DeviceMotionEvent' in window))
        throw new Error('Este navegador no ofrece acceso al sensor de movimiento.')
      const pedirPermiso = window.DeviceMotionEvent.requestPermission
      if (pedirPermiso && (await pedirPermiso.call(window.DeviceMotionEvent)) !== 'granted')
        throw new Error('No se concedió permiso para usar el sensor.')
      detector.current = {base: null, arriba: false, ultimo: 0}
      ultimoDato.current = 0
      localStorage.setItem('mv_pasos_activo', hoy())
      localStorage.setItem('mv_pasos_sesion', String(sesionRef.current))
      contandoRef.current = true
      setEstado('Esperando datos del sensor…')
      onActivoChange(true)
    } catch (e) {
      setEstado(e.message || 'No se pudo iniciar el sensor.')
    }
  }

  const detener = async () => {
    if (guardando) return
    setGuardando(true)
    contandoRef.current = false
    localStorage.removeItem('mv_pasos_activo')
    localStorage.removeItem('mv_pasos_sesion')
    try {
      const suma = sesionRef.current
      if (suma > 0) await onSumar(suma)
      sesionRef.current = 0
      setSesion(0)
      setEstado(suma > 0 ? `${suma.toLocaleString('es-AR')} pasos sumados.` : 'Conteo finalizado; no se detectaron pasos.')
      onActivoChange(false)
    } catch {
      // Dejar el conteo recuperable si el almacenamiento falla.
      localStorage.setItem('mv_pasos_activo', hoy())
      localStorage.setItem('mv_pasos_sesion', String(sesionRef.current))
      contandoRef.current = true
      onActivoChange(true)
      setEstado('No se pudo guardar el conteo. Sigue activo; intentá detenerlo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  useEffect(() => {
    if (!activo) return
    const registrar = e => {
      if (!contandoRef.current) return
      if (document.visibilityState !== 'visible') return
      const lineal = e.acceleration
      const a = lineal?.x != null && lineal?.y != null && lineal?.z != null
        ? lineal
        : e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const primerDato = !ultimoDato.current
      ultimoDato.current = Date.now()
      if (primerDato) setEstado('Sensor conectado. Caminá con el teléfono encima para empezar a contar.')
      const magnitud = Math.hypot(a.x, a.y, a.z), d = detector.current
      if (d.base == null) { d.base = magnitud; return }
      // El filtro elimina el nivel estable (incluida la gravedad) para contar picos de movimiento.
      d.base = d.base * 0.9 + magnitud * 0.1
      const senal = magnitud - d.base, ahora = Date.now()
      if (senal > 1.0 && !d.arriba && ahora - d.ultimo >= 280) {
        d.arriba = true
        d.ultimo = ahora
        const n = sesionRef.current + 1
        sesionRef.current = n
        localStorage.setItem('mv_pasos_sesion', String(n))
        setSesion(n)
        setEstado('Sensor activo. El conteo es una estimación.')
      } else if (senal < 0.3) d.arriba = false
    }
    const resetearFiltro = () => {
      detector.current = {base: null, arriba: false, ultimo: detector.current.ultimo}
      setEstado(document.visibilityState === 'visible'
        ? 'Conteo reanudado. El sensor vuelve a estimar desde este momento.'
        : 'Conteo pausado mientras MMV no está visible.')
    }
    window.addEventListener('devicemotion', registrar)
    document.addEventListener('visibilitychange', resetearFiltro)
    const aviso = setTimeout(() => {
      if (!ultimoDato.current) setEstado('No llegan datos del sensor. Revisá el permiso y probá con el teléfono en movimiento.')
    }, 5000)
    return () => {
      window.removeEventListener('devicemotion', registrar)
      document.removeEventListener('visibilitychange', resetearFiltro)
      clearTimeout(aviso)
    }
  }, [activo])

  useEffect(() => {
    const fecha = localStorage.getItem('mv_pasos_activo')
    if (!fecha || fecha === hoy()) return
    const pendientes = +(localStorage.getItem('mv_pasos_sesion') || 0)
    const guardarPendientes = async () => {
      try {
        if (pendientes > 0) {
          await db.transaction('rw', db.habitos, async () => {
            const actual = await db.habitos.get(fecha)
            const pasos = Math.min(MAX_PASOS, (+actual?.pasos || 0) + pendientes)
            await db.habitos.put({...actual, fecha, pasos})
          })
        }
        localStorage.removeItem('mv_pasos_activo')
        localStorage.removeItem('mv_pasos_sesion')
        contandoRef.current = false
        sesionRef.current = 0
        setSesion(0)
        setRecuperando(false)
      } catch {
        setEstado('No pude guardar el conteo del día anterior. Quedó guardado para intentar recuperarlo al volver a abrir MMV.')
      } finally {
        onActivoChange(false)
      }
    }
    guardarPendientes()
  }, [onActivoChange])

  return (
    <>
      <label className="lin" htmlFor="pasos-hoy">
        <b>Pasos del día</b>
        <small className="mu">Ingresá el total de tu teléfono/reloj o sumá caminatas aquí; evitá contar dos veces la misma actividad.</small>
      </label>
      <div className="row">
        <input
          id="pasos-hoy"
          type="number"
          min="0"
          max={MAX_PASOS}
          step="1"
          inputMode="numeric"
          placeholder="Ej.: 6500"
          value={total}
          disabled={activo || cargando}
          onChange={e => onGuardar(e.target.value)}
        />
        <span className="tag">pasos</span>
      </div>
      <div className="row" style={{marginTop: 8}}>
        {activo ? (
          <button className="ghost" disabled={guardando} onClick={detener}>
            {guardando ? 'Guardando…' : `■ Terminar conteo · ${sesion.toLocaleString('es-AR')}`}
          </button>
        ) : (
          <button disabled={cargando || recuperando || fecha !== hoy()} onClick={iniciar}>▶ Contar con el teléfono</button>
        )}
        {activo && <small className="mu">Llevá el teléfono encima. El conteo se pausa al bloquear la pantalla o salir de MMV.</small>}
      </div>
      {fecha !== hoy() && <small className="mu">Para otros días podés consultar y corregir los pasos; el sensor solo cuenta hoy.</small>}
      {estado && <small role="status" className="mu">{estado}</small>}
      {sesion > 0 && activo && (
        <small className="mu">Conteo actual: {sesion.toLocaleString('es-AR')} pasos. Se suman al total al terminar.</small>
      )}
    </>
  )
}

export default function ActividadFisica() {
  const [fecha, setFecha] = useState(hoy()),
    [conteoActivo, setConteoActivo] = useState(() => localStorage.getItem('mv_pasos_activo') === hoy()),
    [total, setTotal] = useState(''),
    [cargando, setCargando] = useState(true),
    [errorCarga, setErrorCarga] = useState(''),
    [actividades, setActividades] = useState([]),
    [tipo, setTipo] = useState('bicicleta'),
    [minutos, setMinutos] = useState(''),
    [km, setKm] = useState(''),
    [nota, setNota] = useState('')

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setErrorCarga('')
    Promise.all([
      db.habitos.get(fecha),
      db.actividades.where('fecha').equals(fecha).toArray()
    ]).then(([habito, lista]) => {
      if (!vigente) return
      setTotal(habito?.pasos == null ? '' : String(habito.pasos))
      setActividades(lista)
      setCargando(false)
      setMinutos(''); setKm(''); setNota('')
    }).catch(() => {
      if (!vigente) return
      setErrorCarga('No se pudieron cargar tus actividades. Recargá la app e intentá de nuevo.')
      setCargando(false)
    })
    return () => { vigente = false }
  }, [fecha])

  const guardarPasos = async valor => {
    if (valor !== '' && (!/^\d+$/.test(valor) || +valor > MAX_PASOS)) return
    setTotal(valor)
    const actual = (await db.habitos.get(fecha)) || {fecha}
    const pasos = valor === '' ? null : +valor
    await db.habitos.put({...actual, pasos})
  }

  const sumarConteo = async suma => {
    const actual = (await db.habitos.get(fecha)) || {fecha}
    const pasos = Math.min(MAX_PASOS, (+actual.pasos || 0) + suma)
    await db.habitos.put({...actual, pasos})
    setTotal(String(pasos))
  }

  const agregar = async () => {
    const duracion = Math.floor(+minutos || 0), distancia = +km || 0
    if (duracion < 1 || duracion > 1440 || distancia < 0 || distancia > 1000) return
    const item = {
      fecha, tipo, minutos: duracion,
      ...(distancia > 0 ? {km: +distancia.toFixed(2)} : {}),
      ...(nota.trim() ? {nota: nota.trim().slice(0, 100)} : {})
    }
    const id = await db.actividades.add(item)
    setActividades(a => [...a, {...item, id}].sort((x, y) => x.id - y.id))
    setMinutos(''); setKm(''); setNota('')
  }

  const borrar = async id => {
    await db.actividades.delete(id)
    setActividades(a => a.filter(x => x.id !== id))
  }

  return (
    <section style={{gridColumn: 'span 2'}}>
      <h3>Actividad física</h3>
      <div className="row" style={{justifyContent: 'space-between', marginBottom: 8}}>
        <button className="ghost mini" disabled={conteoActivo || cargando} onClick={() => setFecha(f => sumaDias(f, -1))} aria-label="Día anterior">◀</button>
        <b>{fecha === hoy() ? 'Hoy' : new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {weekday: 'short', day: 'numeric', month: 'short'})}</b>
        <button className="ghost mini" disabled={conteoActivo || cargando || fecha >= hoy()} onClick={() => setFecha(f => sumaDias(f, 1))} aria-label="Día siguiente">▶</button>
        {fecha !== hoy() && <button className="ghost mini" disabled={conteoActivo || cargando} onClick={() => setFecha(hoy())}>Hoy</button>}
      </div>
      <ConteoPasos total={total} fecha={fecha} activo={conteoActivo} onActivoChange={setConteoActivo} onGuardar={guardarPasos} onSumar={sumarConteo} cargando={cargando} />
      {errorCarga && <small role="alert" className="mu">{errorCarga}</small>}
      <h4>Agregar actividad</h4>
      <div className="row">
        <select aria-label="Tipo de actividad" value={tipo} disabled={cargando} onChange={e => setTipo(e.target.value)}>
          {Object.entries(TIPOS).map(([key, nombre]) => <option key={key} value={key}>{nombre}</option>)}
        </select>
        <input type="number" min="1" max="1440" step="1" inputMode="numeric" placeholder="Minutos" aria-label="Duración en minutos" value={minutos} disabled={cargando} onChange={e => setMinutos(e.target.value)} />
        <input type="number" min="0" max="1000" step="0.1" inputMode="decimal" placeholder="Km (opcional)" aria-label="Distancia en kilómetros (opcional)" value={km} disabled={cargando} onChange={e => setKm(e.target.value)} />
      </div>
      <div className="row">
        <input type="text" maxLength="100" placeholder="Nota (opcional)" aria-label="Nota de la actividad" value={nota} disabled={cargando} onChange={e => setNota(e.target.value)} />
        <button onClick={agregar} disabled={cargando || !minutos || +minutos < 1}>＋ Registrar</button>
      </div>
      {actividades.length ? <>
        <small className="mu">
          {actividades.reduce((s, a) => s + a.minutos, 0)} min en {actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'}
          {actividades.some(a => a.km) ? ` · ${actividades.reduce((s, a) => s + (+a.km || 0), 0).toFixed(1).replace('.', ',')} km` : ''}
        </small>
        {actividades.map(a => (
          <div className="lin" key={a.id}>
            <span>{TIPOS[a.tipo] || a.tipo} · {a.minutos} min{a.km ? ` · ${String(a.km).replace('.', ',')} km` : ''}{a.nota ? ` · ${a.nota}` : ''}</span>
            <button className="ghost mini" aria-label={`Borrar ${TIPOS[a.tipo] || 'actividad'}`} onClick={() => borrar(a.id)}>×</button>
          </div>
        ))}
      </> : <small className="mu">Todavía no registraste actividades hoy.</small>}
    </section>
  )
}
