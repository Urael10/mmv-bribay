import {useEffect, useRef, useState} from 'react'
import {db, hoy} from '../../data/db'
import {sumaDias} from '../../domain/stats'
import NavFecha from '../../ui/NavFecha'
import {
  MAX_PASOS, TIPOS, LARGO_PASO_INICIAL, GPS_CFG,
  parsearPasos, sumarPasos, magnitudAceleracion, detectorNuevo, procesarMuestra,
  gpsNuevo, procesarPuntoGps, gpsParaGuardar, gpsDesdeGuardado,
  normalizarLargoPaso, cerrarConteo, armarActividad, resumenActividades
} from '../../domain/actividad'

const K = {
  activo: 'mv_pasos_activo',
  sesion: 'mv_pasos_sesion',
  gps: 'mv_pasos_gps',
  usarGps: 'mv_pasos_usar_gps',
  largo: 'mv_largo_paso'
}
const leer = k => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
const borrar = k => { try { localStorage.removeItem(k) } catch { /* sin almacenamiento */ } }

const activoHoy = () => leer(K.activo) === hoy()
const sesionDeHoy = () => (activoHoy() ? +(leer(K.sesion) || 0) : 0)
const gpsDeHoy = () => (activoHoy() ? gpsDesdeGuardado(leer(K.gps)) : gpsNuevo())
const largoGuardado = () => normalizarLargoPaso(leer(K.largo) ?? LARGO_PASO_INICIAL)
const km = m => (m / 1000).toFixed(2).replace('.', ',')

const MSG_SIN_PERMISO_SENSOR =
  'No se concedió permiso al sensor de movimiento. Para dárselo, cerrá MMV por completo, abrilo de nuevo, tocá ▶ y elegí «Permitir».'

function ConteoPasos({total, fecha, activo, onActivoChange, onGuardar, onSumar, onSugerir, cargando}) {
  const [sesion, setSesion] = useState(sesionDeHoy),
    [gps, setGps] = useState(() => {
      const g = gpsDeHoy()
      return {m: g.m, seg: g.seg, senal: ''}
    }),
    [estado, setEstado] = useState(''),
    [guardando, setGuardando] = useState(false),
    [usarGps, setUsarGps] = useState(() => leer(K.usarGps) !== '0'),
    [largoTxt, setLargoTxt] = useState(() => String(largoGuardado()).replace('.', ',')),
    [recuperando, setRecuperando] = useState(() => {
      const guardada = leer(K.activo)
      return !!guardada && guardada !== hoy()
    }),
    detector = useRef(detectorNuevo()),
    sesionRef = useRef(sesionDeHoy()),
    gpsRef = useRef(gpsDeHoy()),
    contandoRef = useRef(activoHoy()),
    usarGpsRef = useRef(leer(K.usarGps) !== '0'),
    ultimoDato = useRef(0),
    ultimoGps = useRef(0)

  const cambiarUsarGps = v => {
    usarGpsRef.current = v
    setUsarGps(v)
    guardar(K.usarGps, v ? '1' : '0')
  }
  const confirmarLargo = () => {
    const n = normalizarLargoPaso(largoTxt.replace(',', '.'))
    guardar(K.largo, String(n))
    setLargoTxt(String(n).replace('.', ','))
  }

  const iniciar = async () => {
    try {
      if (fecha !== hoy()) throw new Error('El sensor solo puede contar para el día de hoy.')
      if (!window.isSecureContext)
        throw new Error('Se necesita abrir MMV con una conexión segura (https).')
      const hayMovimiento = 'DeviceMotionEvent' in window
      const hayGps = usarGpsRef.current && 'geolocation' in navigator
      if (!hayMovimiento && !hayGps)
        throw new Error('Este navegador no ofrece acceso al sensor de movimiento ni al GPS.')
      // El permiso del sensor se pide primero y directo desde el toque (iOS lo exige).
      let sensorOk = hayMovimiento
      const pedirPermiso = hayMovimiento && window.DeviceMotionEvent.requestPermission
      if (pedirPermiso) {
        try {
          sensorOk = (await pedirPermiso.call(window.DeviceMotionEvent)) === 'granted'
        } catch {
          sensorOk = false
        }
      }
      if (!sensorOk && !hayGps) throw new Error(MSG_SIN_PERMISO_SENSOR)
      detector.current = detectorNuevo()
      gpsRef.current = gpsNuevo()
      ultimoDato.current = 0
      ultimoGps.current = 0
      sesionRef.current = 0
      setSesion(0)
      setGps({m: 0, seg: 0, senal: hayGps ? 'buscando' : ''})
      guardar(K.activo, hoy())
      guardar(K.sesion, '0')
      guardar(K.gps, gpsParaGuardar(gpsRef.current))
      contandoRef.current = true
      setEstado(
        sensorOk
          ? 'Esperando datos del sensor…'
          : `${MSG_SIN_PERMISO_SENSOR} Mientras tanto cuento con el GPS.`
      )
      onActivoChange(true)
    } catch (e) {
      setEstado(e.message || 'No se pudo iniciar el conteo.')
    }
  }

  const detener = async () => {
    if (guardando) return
    setGuardando(true)
    contandoRef.current = false
    borrar(K.activo); borrar(K.sesion); borrar(K.gps)
    try {
      const distM = gpsRef.current.m
      const r = cerrarConteo({
        sensor: sesionRef.current,
        distM,
        seg: gpsRef.current.seg,
        largo: largoGuardado()
      })
      if (r.pasos > 0) await onSumar(r.pasos)
      if (r.largoNuevo) {
        guardar(K.largo, String(r.largoNuevo))
        setLargoTxt(String(r.largoNuevo).replace('.', ','))
      }
      if (r.actividad) onSugerir(r.actividad)
      sesionRef.current = 0
      gpsRef.current = gpsNuevo()
      setSesion(0)
      setGps({m: 0, seg: 0, senal: ''})
      const origen =
        r.fuente === 'gps'
          ? ` (estimados con ${km(distM)} km de GPS)`
          : r.fuente === 'sensor' && r.actividad
            ? ` · ${km(r.actividad.km * 1000)} km con GPS`
            : ''
      setEstado(
        (r.pasos > 0
          ? `${r.pasos.toLocaleString('es-AR')} pasos sumados${origen}.`
          : 'Conteo finalizado; no se detectaron pasos.') +
          (r.actividad ? ' Revisá la actividad sugerida abajo y tocá «Registrar».' : '')
      )
      onActivoChange(false)
    } catch {
      // Dejar el conteo recuperable si el almacenamiento falla.
      guardar(K.activo, hoy())
      guardar(K.sesion, String(sesionRef.current))
      guardar(K.gps, gpsParaGuardar(gpsRef.current))
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
      const magnitud = magnitudAceleracion(e)
      if (magnitud == null) return
      const primerDato = !ultimoDato.current
      ultimoDato.current = Date.now()
      if (primerDato) setEstado('Sensor conectado. Caminá con el teléfono encima para empezar a contar.')
      // El filtro elimina el nivel estable (incluida la gravedad) para contar picos de movimiento.
      const r = procesarMuestra(detector.current, magnitud, Date.now())
      detector.current = r.detector
      if (r.paso) {
        const n = sesionRef.current + 1
        sesionRef.current = n
        guardar(K.sesion, String(n))
        setSesion(n)
        setEstado('Sensor activo. El conteo es una estimación.')
      }
    }
    const alCambiarVisibilidad = () => {
      detector.current = detectorNuevo(detector.current.ultimo)
      setEstado(
        document.visibilityState === 'visible'
          ? 'Conteo reanudado. El sensor vuelve a estimar desde este momento.'
          : 'Conteo pausado mientras MMV no está visible.'
      )
    }
    window.addEventListener('devicemotion', registrar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    // GPS: solo suma distancia; la posición no se guarda ni sale del teléfono.
    let vigilia = null
    if (usarGpsRef.current && 'geolocation' in navigator) {
      vigilia = navigator.geolocation.watchPosition(
        pos => {
          if (!contandoRef.current) return
          const c = pos.coords
          const r = procesarPuntoGps(gpsRef.current, {
            lat: c.latitude, lon: c.longitude, precision: c.accuracy, t: pos.timestamp
          })
          ultimoGps.current = Date.now()
          gpsRef.current = r.estado
          guardar(K.gps, gpsParaGuardar(r.estado))
          setGps({
            m: r.estado.m,
            seg: r.estado.seg,
            senal: c.accuracy > GPS_CFG.precisionMax ? 'débil' : 'buena'
          })
        },
        err => {
          if (err.code === 1) {
            setGps(g => ({...g, senal: 'sin permiso'}))
            setEstado('El GPS no tiene permiso en este navegador; sigo solo con el sensor de movimiento.')
          } else setGps(g => ({...g, senal: 'sin señal'}))
        },
        {enableHighAccuracy: true, maximumAge: 0, timeout: 30000}
      )
    }

    // Mantiene la pantalla encendida mientras se cuenta (evita que el bloqueo corte sensor y GPS).
    let candado = null, cancelado = false
    const pedirPantalla = async () => {
      try {
        if (document.visibilityState === 'visible' && navigator.wakeLock) {
          const l = await navigator.wakeLock.request('screen')
          if (cancelado) l.release().catch(() => {})
          else candado = l
        }
      } catch { /* el navegador puede negarlo (ahorro de batería) */ }
    }
    pedirPantalla()
    const volverAPedir = () => document.visibilityState === 'visible' && pedirPantalla()
    document.addEventListener('visibilitychange', volverAPedir)

    const aviso = setTimeout(() => {
      if (!ultimoDato.current && !ultimoGps.current)
        setEstado('No llegan datos del sensor ni del GPS. Revisá los permisos y probá con el teléfono en movimiento.')
      else if (!ultimoDato.current)
        setEstado(g => (g.startsWith('Esperando') ? 'Sin datos del sensor de movimiento; cuento con el GPS.' : g))
    }, 8000)
    return () => {
      cancelado = true
      window.removeEventListener('devicemotion', registrar)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      document.removeEventListener('visibilitychange', volverAPedir)
      if (vigilia != null) navigator.geolocation.clearWatch(vigilia)
      candado?.release().catch(() => {})
      clearTimeout(aviso)
    }
  }, [activo])

  // Conteo que quedó abierto en un día anterior: se suma a ese día.
  useEffect(() => {
    const fechaPendiente = leer(K.activo)
    if (!fechaPendiente || fechaPendiente === hoy()) return
    const sensor = +(leer(K.sesion) || 0)
    const g = gpsDesdeGuardado(leer(K.gps))
    const pendientes = cerrarConteo({sensor, distM: g.m, seg: g.seg, largo: largoGuardado()}).pasos
    const guardarPendientes = async () => {
      try {
        if (pendientes > 0) {
          await db.transaction('rw', db.habitos, async () => {
            const actual = await db.habitos.get(fechaPendiente)
            await db.habitos.put({...actual, fecha: fechaPendiente, pasos: sumarPasos(actual?.pasos, pendientes)})
          })
        }
        borrar(K.activo); borrar(K.sesion); borrar(K.gps)
        contandoRef.current = false
        sesionRef.current = 0
        gpsRef.current = gpsNuevo()
        setSesion(0)
        setGps({m: 0, seg: 0, senal: ''})
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
          className="fx"
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
        {activo && <small className="mu">Llevá el teléfono encima. Mantengo la pantalla encendida mientras contás; si salís de MMV el conteo se pausa.</small>}
      </div>
      {fecha !== hoy() && <small className="mu">Para otros días podés consultar y corregir los pasos; el sensor solo cuenta hoy.</small>}
      {estado && <small role="status" className="mu">{estado}</small>}
      {sesion > 0 && activo && (
        <small className="mu">Conteo actual: {sesion.toLocaleString('es-AR')} pasos. Se suman al total al terminar.</small>
      )}
      {activo && usarGps && (
        <small className="mu">
          GPS: {km(gps.m)} km{gps.senal ? ` · señal ${gps.senal}` : ''}
          {gps.senal === 'débil' ? ' (salí a cielo abierto para mejorar la precisión)' : ''}
        </small>
      )}
      <details>
        <summary><small className="mu">Ajustes del conteo</small></summary>
        <label className="lin">
          <span className="check">
            <input type="checkbox" checked={usarGps} disabled={activo} onChange={e => cambiarUsarGps(e.target.checked)} />
            <span>Usar GPS para medir distancia y corregir pasos</span>
          </span>
          <small className="mu">Pide el permiso de ubicación. La posición no se guarda ni sale del teléfono: solo se guarda la distancia.</small>
        </label>
        <div className="row">
          <label htmlFor="largo-paso">Largo de paso (m)</label>
          <input
            id="largo-paso"
            type="text"
            inputMode="decimal"
            value={largoTxt}
            disabled={activo}
            onChange={e => setLargoTxt(e.target.value)}
            onBlur={confirmarLargo}
          />
        </div>
        <small className="mu">Se usa para pasar distancia a pasos cuando el sensor no alcanza. Se ajusta solo con cada conteo que tenga sensor y GPS.</small>
      </details>
    </>
  )
}

export default function ActividadFisica() {
  const [fecha, setFecha] = useState(hoy()),
    [conteoActivo, setConteoActivo] = useState(activoHoy),
    [total, setTotal] = useState(''),
    [cargando, setCargando] = useState(true),
    [errorCarga, setErrorCarga] = useState(''),
    [actividades, setActividades] = useState([]),
    [tipo, setTipo] = useState('bicicleta'),
    [minutos, setMinutos] = useState(''),
    [kmTxt, setKmTxt] = useState(''),
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
      setMinutos(''); setKmTxt(''); setNota('')
    }).catch(() => {
      if (!vigente) return
      setErrorCarga('No se pudieron cargar tus actividades. Recargá la app e intentá de nuevo.')
      setCargando(false)
    })
    return () => { vigente = false }
  }, [fecha])

  const guardarPasos = async valor => {
    const v = parsearPasos(valor)
    if (!v.ok) return
    setTotal(valor)
    const actual = (await db.habitos.get(fecha)) || {fecha}
    await db.habitos.put({...actual, pasos: v.pasos})
  }

  const sumarConteo = async suma => {
    const actual = (await db.habitos.get(fecha)) || {fecha}
    const pasos = sumarPasos(actual.pasos, suma)
    await db.habitos.put({...actual, pasos})
    setTotal(String(pasos))
  }

  // Lo medido con GPS queda precargado; la persona lo confirma con «Registrar».
  const sugerir = s => {
    setTipo(s.tipo); setMinutos(String(s.minutos)); setKmTxt(String(s.km).replace('.', ',')); setNota('')
  }

  const agregar = async () => {
    const item = armarActividad({fecha, tipo, minutos, km: kmTxt.replace(',', '.'), nota})
    if (!item) return
    const id = await db.actividades.add(item)
    setActividades(a => [...a, {...item, id}].sort((x, y) => x.id - y.id))
    setMinutos(''); setKmTxt(''); setNota('')
  }

  const borrar = async id => {
    await db.actividades.delete(id)
    setActividades(a => a.filter(x => x.id !== id))
  }

  const resumen = resumenActividades(actividades)

  return (
    <section style={{gridColumn: 'span 2'}}>
      <h3>Actividad física</h3>
      <NavFecha
        titulo={fecha === hoy() ? 'Hoy' : new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {weekday: 'short', day: 'numeric', month: 'short'})}
        anteriorLabel="Día anterior"
        siguienteLabel="Día siguiente"
        deshabilitado={conteoActivo || cargando}
        sinSiguiente={fecha >= hoy()}
        onAnterior={() => setFecha(f => sumaDias(f, -1))}
        onSiguiente={() => setFecha(f => sumaDias(f, 1))}
        extra={fecha !== hoy() && <button className="ghost mini" disabled={conteoActivo || cargando} onClick={() => setFecha(hoy())}>Volver a hoy</button>}
      />
      <ConteoPasos total={total} fecha={fecha} activo={conteoActivo} onActivoChange={setConteoActivo} onGuardar={guardarPasos} onSumar={sumarConteo} onSugerir={sugerir} cargando={cargando} />
      {errorCarga && <small role="alert" className="mu">{errorCarga}</small>}
      <h4>Agregar actividad</h4>
      <div className="row">
        <select className="med-sel" aria-label="Tipo de actividad" value={tipo} disabled={cargando} onChange={e => setTipo(e.target.value)}>
          {Object.entries(TIPOS).map(([key, nombre]) => <option key={key} value={key}>{nombre}</option>)}
        </select>
        <input className="fx" type="number" min="1" max="1440" step="1" inputMode="numeric" placeholder="Min" aria-label="Duración en minutos" value={minutos} disabled={cargando} onChange={e => setMinutos(e.target.value)} />
        <input className="fx" type="text" inputMode="decimal" placeholder="Km" aria-label="Distancia en kilómetros (opcional)" value={kmTxt} disabled={cargando} onChange={e => setKmTxt(e.target.value)} />
      </div>
      <div className="row">
        <input className="fx" type="text" maxLength="100" placeholder="Nota (opcional)" aria-label="Nota de la actividad" value={nota} disabled={cargando} onChange={e => setNota(e.target.value)} />
        <button onClick={agregar} disabled={cargando || !minutos || +minutos < 1}>＋ Registrar</button>
      </div>
      {actividades.length ? <>
        <small className="mu">
          {resumen.minutos} min en {resumen.cantidad} {resumen.cantidad === 1 ? 'actividad' : 'actividades'}
          {resumen.km > 0 ? ` · ${resumen.km.toFixed(1).replace('.', ',')} km` : ''}
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
