import {useCallback, useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {db, hoy, cfg, setCfg} from '../../data/db'
import {sumaDias} from '../../domain/stats'
import NavFecha from '../../ui/NavFecha'
import TrazoSvg from '../../ui/TrazoSvg'
import Anillo from '../../ui/Anillo'
import Icono from '../../ui/Icono'
import {claseAnillo, textoAnillo} from '../../domain/anillo'
import {
  PROMEDIO_DIAS, parsearMeta, promedioPasos, metaEfectiva, textoMetaPasos, pasosEnVivo,
  textoPausa, META_MIN, META_MAX
} from '../../domain/metaPasos'
import {
  BOLSILLO_CFG, VIBRA, nivelSenal, agregarMuestra, ritmoAhoraSegKm, formatoRitmoMin, formatoReloj, formatoKm,
  pausaNueva, estaPausado, cambiarPausa, segPausaActual, pausaTotalSeg, tiempoActivoSeg,
  relojParaGuardar, relojDesdeGuardado, estadoVista, textoPausaVista, resumenBolsillo
} from '../../domain/bolsillo'
import {VistaBolsillo, BarrasSenal, Mantener} from './VistaBolsillo'
import {guardarRuta} from '../../data/rutas'
import {
  RUTA_CFG, rutaNueva, agregarPuntoRuta, rutaParaGuardar, rutaDesdeGuardado, armarRuta, totalPuntos
} from '../../domain/rutas'
import {
  MAX_PASOS, TIPOS, LARGO_PASO_INICIAL, GPS_CFG,
  parsearPasos, sumarPasos, magnitudParaPasos, combinarPasos, detectorNuevo, procesarMuestra,
  gpsNuevo, procesarPuntoGps, gpsParaGuardar, gpsDesdeGuardado,
  normalizarLargoPaso, cerrarConteo, armarActividad, resumenActividades
} from '../../domain/actividad'

const K = {
  activo: 'mv_pasos_activo',
  sesion: 'mv_pasos_sesion',
  gps: 'mv_pasos_gps',
  usarGps: 'mv_pasos_usar_gps',
  largo: 'mv_largo_paso',
  ruta: 'mv_ruta_curso',
  guardarRuta: 'mv_ruta_guardar',
  ocultar: 'mv_ruta_ocultar',
  reloj: 'mv_pasos_reloj',
  vibrar: 'mv_bolsillo_vibrar'
}
const leer = k => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
const borrar = k => { try { localStorage.removeItem(k) } catch { /* sin almacenamiento */ } }

const activoHoy = () => leer(K.activo) === hoy()
const sesionDeHoy = () => (activoHoy() ? +(leer(K.sesion) || 0) : 0)
const gpsDeHoy = () => (activoHoy() ? gpsDesdeGuardado(leer(K.gps)) : gpsNuevo())
const rutaDeHoy = () => (activoHoy() ? rutaDesdeGuardado(leer(K.ruta)) : rutaNueva())
const guardarRutaActivo = () => leer(K.guardarRuta) !== '0'
const ocultarActivo = () => leer(K.ocultar) !== '0'
const largoGuardado = () => normalizarLargoPaso(leer(K.largo) ?? LARGO_PASO_INICIAL)
const km = m => (m / 1000).toFixed(2).replace('.', ',')
const vibrarActivo = () => leer(K.vibrar) !== '0'
// Reloj de la caminata en curso: inicio y pausas (se recupera si la app se cerró).
const relojDeHoy = () => {
  if (!activoHoy()) return {inicio: 0, pausa: pausaNueva()}
  const r = relojDesdeGuardado(leer(K.reloj), Date.now())
  return r ? {inicio: r.inicio, pausa: r.pausa} : {inicio: Date.now(), pausa: pausaNueva()}
}

const MSG_SIN_PERMISO_SENSOR =
  'No se concedió permiso al sensor de movimiento. Para dárselo, cerrá MMV por completo, abrilo de nuevo, tocá ▶ y elegí «Permitir».'

// Modo bolsillo: pantalla casi negra mientras se camina. La página sigue visible (el sensor web solo cuenta así),
// y para salir hay que mantener presionado 1 s, así un roce dentro del bolsillo no hace nada.
// Pausar y Salir también se activan manteniendo presionado (la pausa 0,6 s, salir 1 s).
function Bolsillo({vista, pausada, onPausa, onSalir}) {
  const [ret, setRet] = useState(false),
    t = useRef(null)
  const soltar = () => {
    clearTimeout(t.current)
    setRet(false)
  }
  const apretar = () => {
    setRet(true)
    t.current = setTimeout(onSalir, 1000)
  }
  useEffect(() => () => clearTimeout(t.current), [])
  return createPortal(
    <div className="bolsillo-ov" role="dialog" aria-modal="true" aria-label="Modo bolsillo">
      <VistaBolsillo {...vista} pausada={pausada} />
      <div className="bols-acc">
        <Mantener
          ms={BOLSILLO_CFG.mantenerPausaMs}
          onHecho={onPausa}
          etiqueta={pausada ? 'Reanudar' : 'Pausar'}
          ayuda="mantené 0,6 s"
        />
        <button
          type="button"
          className={'ghost mant bolsillo-sal' + (ret ? ' on' : '')}
          style={{'--t': '1s'}}
          aria-label="Salir del modo bolsillo: mantené presionado"
          onPointerDown={apretar}
          onPointerUp={soltar}
          onPointerLeave={soltar}
          onPointerCancel={soltar}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSalir()}
          onContextMenu={e => e.preventDefault()}
        >
          <i />
          <span>Salir</span>
          <small>mantené 1 s</small>
        </button>
      </div>
      <small className="mu bols-pie">Si bloqueás el teléfono o salís de MMV, el sensor web se pausa.</small>
    </div>,
    document.body
  )
}

function ConteoPasos({total, fecha, activo, promedio, onActivoChange, onGuardar, onSumar, onSugerir, onRuta, cargando}) {
  const [sesion, setSesion] = useState(sesionDeHoy),
    [gps, setGps] = useState(() => {
      const g = gpsDeHoy()
      return {m: g.m, seg: g.seg, senal: ''}
    }),
    [estado, setEstado] = useState(''),
    [guardando, setGuardando] = useState(false),
    [usarGps, setUsarGps] = useState(() => leer(K.usarGps) !== '0'),
    [largoTxt, setLargoTxt] = useState(() => String(largoGuardado()).replace('.', ',')),
    [guardarRutaSt, setGuardarRutaSt] = useState(guardarRutaActivo),
    [ocultarSt, setOcultarSt] = useState(ocultarActivo),
    [metaTxt, setMetaTxt] = useState(() => cfg('metapasos', '')),
    [visible, setVisible] = useState(() => document.visibilityState !== 'hidden'),
    [ahora, setAhora] = useState(() => Date.now()),
    [vibrarSt, setVibrarSt] = useState(vibrarActivo),
    [bolsillo, setBolsillo] = useState(false),
    [enLinea, setEnLinea] = useState(() => navigator.onLine !== false),
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
    ultimoGps = useRef(0),
    guardarRutaRef = useRef(guardarRutaActivo()),
    ocultarRef = useRef(ocultarActivo()),
    ultimoFlush = useRef(0),
    ultimoReloj = useRef(0),
    ritmoRef = useRef([]),
    vibrarRef = useRef(vibrarActivo())
  // El reloj se lee una sola vez; `pausa` (estado) es lo que se dibuja y `pausaRef` lo que leen los eventos.
  const inicioRef = useRef(0),
    pausaRef = useRef(null)
  if (pausaRef.current === null) {
    const r = relojDeHoy()
    inicioRef.current = r.inicio
    pausaRef.current = r.pausa
  }
  const [pausa, setPausa] = useState(pausaRef.current)
  // La ruta en curso se lee una sola vez (puede pesar): después vive en la referencia.
  const rutaRef = useRef(null)
  if (rutaRef.current === null) rutaRef.current = rutaDeHoy()
  const [segsVivo, setSegsVivo] = useState(() => rutaRef.current.segs)

  const cambiarGuardarRuta = v => {
    guardarRutaRef.current = v
    setGuardarRutaSt(v)
    guardar(K.guardarRuta, v ? '1' : '0')
  }
  const cambiarOcultar = v => {
    ocultarRef.current = v
    setOcultarSt(v)
    guardar(K.ocultar, v ? '1' : '0')
  }
  const cambiarUsarGps = v => {
    usarGpsRef.current = v
    setUsarGps(v)
    guardar(K.usarGps, v ? '1' : '0')
  }
  const cambiarVibrar = v => {
    vibrarRef.current = v
    setVibrarSt(v)
    guardar(K.vibrar, v ? '1' : '0')
  }
  // Vibración de confirmación (solo Android; donde no existe, no pasa nada).
  const vibrar = patron => {
    if (!vibrarRef.current) return
    try {
      navigator.vibrate?.(patron)
    } catch { /* sin vibración */ }
  }
  // Reloj y pausa: dos fuentes (manual y MMV oculto). Se guarda para poder retomar si la app se cierra.
  const guardarReloj = () => {
    if (!contandoRef.current) return
    ultimoReloj.current = Date.now()
    guardar(K.reloj, relojParaGuardar({inicio: inicioRef.current, pausa: pausaRef.current, visto: Date.now()}))
  }
  const ponerPausa = (fuente, activa) => {
    const n = cambiarPausa(pausaRef.current, fuente, activa, Date.now())
    if (n === pausaRef.current) return
    pausaRef.current = n
    setPausa(n)
    guardarReloj()
  }
  const alternarPausa = () => {
    if (!contandoRef.current) return
    const pasar = !pausaRef.current.manual
    if (pasar) {
      if (guardarRutaRef.current && totalPuntos(rutaRef.current.segs) > 0)
        guardar(K.ruta, rutaParaGuardar(rutaRef.current))
      setEstado('Conteo en pausa. No se suma nada hasta que reanudes.')
    } else {
      // Al reanudar el GPS se vuelve a anclar (no suma lo caminado durante la pausa, y la ruta abre un tramo nuevo)
      // y el detector de pasos arranca limpio.
      gpsRef.current = {...gpsRef.current, ancla: null, t: null}
      detector.current = detectorNuevo(detector.current.ultimo)
      ritmoRef.current = []
      setEstado('Conteo reanudado.')
    }
    ponerPausa('manual', pasar)
    vibrar(pasar ? VIBRA.pausar : VIBRA.reanudar)
  }
  // La meta se guarda solo si es válida; vacía es válida (el anillo usa entonces tu promedio de 28 días).
  const confirmarMeta = () => {
    const r = parsearMeta(metaTxt)
    if (!r.ok) return setMetaTxt(cfg('metapasos', ''))
    setCfg('metapasos', r.meta ? String(r.meta) : '')
    setMetaTxt(r.meta ? String(r.meta) : '')
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
      inicioRef.current = Date.now()
      pausaRef.current = pausaNueva()
      setPausa(pausaRef.current)
      ritmoRef.current = []
      rutaRef.current = rutaNueva()
      ultimoFlush.current = 0
      setSegsVivo([])
      borrar(K.ruta)
      setGps({m: 0, seg: 0, senal: hayGps ? 'buscando' : ''})
      guardar(K.activo, hoy())
      guardar(K.sesion, '0')
      guardar(K.gps, gpsParaGuardar(gpsRef.current))
      contandoRef.current = true
      guardarReloj()
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
    borrar(K.activo); borrar(K.sesion); borrar(K.gps); borrar(K.ruta); borrar(K.reloj)
    setBolsillo(false)
    try {
      const distM = gpsRef.current.m
      const r = cerrarConteo({
        sensor: sesionRef.current,
        distM,
        seg: gpsRef.current.seg,
        largo: largoGuardado()
      })
      if (r.pasos > 0) await onSumar(r.pasos)
      // La ruta se guarda aparte: si falla, los pasos ya sumados no se tocan ni se repiten.
      let rutaId = null,
        rutaFallo = false
      if (usarGpsRef.current && guardarRutaRef.current) {
        try {
          const fila = armarRuta({
            fecha,
            distM,
            seg: gpsRef.current.seg,
            segs: rutaRef.current.segs,
            ocultarM: ocultarRef.current ? RUTA_CFG.ocultarM : 0
          })
          if (fila) rutaId = await onRuta(fila)
        } catch {
          rutaFallo = true
        }
      }
      if (r.largoNuevo) {
        guardar(K.largo, String(r.largoNuevo))
        setLargoTxt(String(r.largoNuevo).replace('.', ','))
      }
      if (r.actividad) onSugerir(rutaId ? {...r.actividad, rutaId} : r.actividad)
      sesionRef.current = 0
      gpsRef.current = gpsNuevo()
      rutaRef.current = rutaNueva()
      setSegsVivo([])
      setSesion(0)
      pausaRef.current = pausaNueva()
      setPausa(pausaRef.current)
      ritmoRef.current = []
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
          (rutaId ? ' Ruta guardada.' : '') +
          (rutaFallo ? ' No pude guardar la ruta; los pasos sí quedaron.' : '') +
          (r.actividad ? ' Revisá la actividad sugerida abajo y tocá «Registrar».' : '')
      )
      onActivoChange(false)
    } catch {
      // Dejar el conteo recuperable si el almacenamiento falla.
      guardar(K.activo, hoy())
      guardar(K.sesion, String(sesionRef.current))
      guardar(K.gps, gpsParaGuardar(gpsRef.current))
      if (guardarRutaRef.current) guardar(K.ruta, rutaParaGuardar(rutaRef.current))
      contandoRef.current = true
      guardarReloj()
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
      if (pausaRef.current.manual) return // en pausa manual el sensor no suma
      const magnitud = magnitudParaPasos(e)
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
      if (contandoRef.current && guardarRutaRef.current && totalPuntos(rutaRef.current.segs) > 0)
        guardar(K.ruta, rutaParaGuardar(rutaRef.current))
      detector.current = detectorNuevo(detector.current.ultimo)
      // Tiempo que MMV estuvo oculto: el sensor web no cuenta en segundo plano, y se muestra el hueco.
      const visibleAhora = document.visibilityState === 'visible'
      setVisible(visibleAhora)
      if (contandoRef.current) ponerPausa('oculto', !visibleAhora)
      setEstado(
        document.visibilityState === 'visible'
          ? 'Conteo reanudado. El sensor vuelve a estimar desde este momento.'
          : 'Conteo pausado mientras MMV no está visible.'
      )
    }
    window.addEventListener('devicemotion', registrar)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    // GPS: suma distancia y, si la persona lo permite, arma el recorrido. La posición nunca sale del teléfono.
    let vigilia = null
    if (usarGpsRef.current && 'geolocation' in navigator) {
      vigilia = navigator.geolocation.watchPosition(
        pos => {
          if (!contandoRef.current) return
          const c = pos.coords
          ultimoGps.current = Date.now()
          // En pausa manual el punto solo sirve para el indicador de señal: no suma distancia ni ruta.
          if (pausaRef.current.manual) {
            setGps(g => ({
              ...g,
              senal: c.accuracy > GPS_CFG.precisionMax ? 'débil' : 'buena',
              precision: c.accuracy
            }))
            return
          }
          const p = {
            lat: c.latitude, lon: c.longitude, precision: c.accuracy, t: pos.timestamp,
            alt: c.altitude, altPrecision: c.altitudeAccuracy
          }
          const r = procesarPuntoGps(gpsRef.current, p)
          gpsRef.current = r.estado
          ritmoRef.current = agregarMuestra(ritmoRef.current, p.t, r.estado.m)
          guardar(K.gps, gpsParaGuardar(r.estado))
          if (guardarRutaRef.current) {
            const antes = rutaRef.current
            rutaRef.current = agregarPuntoRuta(antes, p, r.motivo)
            if (rutaRef.current !== antes) {
              setSegsVivo(rutaRef.current.segs)
              // Se guarda en el teléfono cada tanto (no en cada punto) para poder retomar si se cierra la app.
              if (Date.now() - ultimoFlush.current > 10000) {
                ultimoFlush.current = Date.now()
                guardar(K.ruta, rutaParaGuardar(rutaRef.current))
              }
            }
          }
          setGps({
            m: r.estado.m,
            seg: r.estado.seg,
            senal: c.accuracy > GPS_CFG.precisionMax ? 'débil' : 'buena',
            precision: c.accuracy
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
        if (document.visibilityState === 'visible' && navigator.wakeLock && !(candado && !candado.released)) {
          const l = await navigator.wakeLock.request('screen')
          if (cancelado) l.release().catch(() => {})
          else {
            candado = l
            // Si el sistema lo suelta (ahorro de batería, etc.) se vuelve a pedir mientras MMV siga visible.
            l.addEventListener('release', () => {
              if (candado === l) candado = null
              if (!cancelado) setTimeout(pedirPantalla, 500)
            })
          }
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

  // Un tic por segundo mientras se cuenta: reloj, pausa, ritmo y caducidad de la señal de GPS.
  useEffect(() => {
    if (!activo) return
    setAhora(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setAhora(t)
      if (t - ultimoReloj.current > 5000) guardarReloj()
    }, 1000)
    return () => clearInterval(id)
  }, [activo])

  // Aviso de conexión: el conteo no la necesita (sensor y GPS son del teléfono); solo el mapa opcional.
  useEffect(() => {
    const on = () => setEnLinea(true),
      off = () => setEnLinea(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Conteo que quedó abierto en un día anterior: se suma a ese día.
  useEffect(() => {
    const fechaPendiente = leer(K.activo)
    if (!fechaPendiente || fechaPendiente === hoy()) return
    const sensor = +(leer(K.sesion) || 0)
    const g = gpsDesdeGuardado(leer(K.gps))
    const pendientes = cerrarConteo({sensor, distM: g.m, seg: g.seg, largo: largoGuardado()}).pasos
    const rutaPendiente = rutaDesdeGuardado(leer(K.ruta))
    const guardarPendientes = async () => {
      try {
        if (pendientes > 0) {
          await db.transaction('rw', db.habitos, async () => {
            const actual = await db.habitos.get(fechaPendiente)
            await db.habitos.put({...actual, fecha: fechaPendiente, pasos: sumarPasos(actual?.pasos, pendientes)})
          })
        }
        if (guardarRutaActivo()) {
          try {
            const fila = armarRuta({
              fecha: fechaPendiente,
              distM: g.m,
              seg: g.seg,
              segs: rutaPendiente.segs,
              ocultarM: ocultarActivo() ? RUTA_CFG.ocultarM : 0
            })
            if (fila) await onRuta(fila)
          } catch { /* la ruta es opcional: los pasos ya quedaron guardados */ }
        }
        borrar(K.activo); borrar(K.sesion); borrar(K.gps); borrar(K.ruta); borrar(K.reloj)
        contandoRef.current = false
        sesionRef.current = 0
        gpsRef.current = gpsNuevo()
        rutaRef.current = rutaNueva()
        setSegsVivo([])
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
  }, [onActivoChange, onRuta])

  const esHoy = fecha === hoy(),
    // Mismo criterio que al terminar: si el sensor no cuenta (o se perdió pasos) y el GPS midió distancia,
    // el número en vivo usa el GPS en vez de quedarse en 0.
    sesionVivo = activo ? combinarPasos({sensor: sesion, distM: gps.m, largo: largoGuardado()}).pasos : 0,
    pasosHoy = pasosEnVivo({total, sesion: sesionVivo, activo, esHoy}),
    ef = metaEfectiva({meta: parsearMeta(metaTxt).meta, promedio}),
    manual = pausa.manual,
    est = estadoVista({activo, visible, manual, usarGps, senal: gps.senal, sesion}),
    tiempoSeg = activo ? tiempoActivoSeg({inicio: inicioRef.current, ahora, pausa}) : 0,
    ritmoTxt = formatoRitmoMin(activo && usarGps && !estaPausado(pausa) ? ritmoAhoraSegKm(ritmoRef.current, ahora) : null),
    senal = activo
      ? nivelSenal({
          usar: usarGps,
          permiso: gps.senal !== 'sin permiso',
          precision: gps.precision,
          edadSeg: ultimoGps.current ? Math.max(0, (ahora - ultimoGps.current) / 1000) : null
        })
      : null,
    pausaTotal = pausaTotalSeg(pausa, ahora),
    claseDelAnillo = claseAnillo(pasosHoy, ef.valor),
    vistaBolsillo = {
      pasosHoy,
      meta: ef.valor,
      claseAnillo: claseDelAnillo,
      sesion: sesionVivo,
      km: formatoKm(gps.m),
      tiempo: formatoReloj(tiempoSeg),
      ritmo: ritmoTxt,
      estado: est,
      senal,
      pausaTxt: textoPausaVista(segPausaActual(pausa, ahora)),
      pulso: sesion,
      etiqueta: resumenBolsillo({
        pasosHoy, meta: ef.valor, sesion: sesionVivo, km: formatoKm(gps.m), tiempo: formatoReloj(tiempoSeg),
        ritmo: ritmoTxt, pausada: manual
      })
    }
  return (
    <>
      <div
        className="pasos-hero"
        role="group"
        aria-label={ef.valor ? textoAnillo('Pasos', pasosHoy, ef.valor) : `Pasos: ${pasosHoy}`}
      >
        <Anillo valor={pasosHoy} meta={ef.valor} tam={148} clase={claseDelAnillo}>
          <span className="pasos-n mono">{pasosHoy.toLocaleString('es-AR')}</span>
        </Anillo>
        <div className="pasos-cuerpo">
          <b>{esHoy ? 'Pasos de hoy' : 'Pasos del día'}</b>
          <small className="mu">{textoMetaPasos(ef)}</small>
          {est && (
            <span className={'pasos-est ' + est.id}>
              <Icono n={est.icono} tam={16} /> {est.texto}
            </span>
          )}
          {activo && sesionVivo > 0 && (
            <small className="mu">+{sesionVivo.toLocaleString('es-AR')} esta caminata · se suman al terminar</small>
          )}
          {activo && pausaTotal > 0 && (
            <small className="mu">Tiempo en pausa: {textoPausa(pausaTotal)}</small>
          )}
          {activo && (
            <small className="mu">
              Tiempo {formatoReloj(tiempoSeg)}
              {usarGps ? ` · ritmo ${ritmoTxt} min/km` : ''}
            </small>
          )}
          {!enLinea && (
            <span className="pasos-est">
              <Icono n="info" tam={16} /> Sin conexión · el conteo sigue igual
            </span>
          )}
        </div>
      </div>
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
            {guardando ? 'Guardando…' : `■ Terminar conteo · ${sesionVivo.toLocaleString('es-AR')}`}
          </button>
        ) : (
          <button disabled={cargando || recuperando || fecha !== hoy()} onClick={iniciar}>▶ Contar con el teléfono</button>
        )}
        {activo && (
          <button className="ghost" disabled={guardando} onClick={alternarPausa}>
            <Icono n={manual ? 'play' : 'pausa'} tam={18} /> {manual ? 'Reanudar' : 'Pausar'}
          </button>
        )}
        {activo && (
          <button className="ghost" disabled={guardando} onClick={() => setBolsillo(true)}>
            <Icono n="luna" tam={18} /> Modo bolsillo
          </button>
        )}
        {activo && <small className="mu">Llevá el teléfono encima. Mantengo la pantalla encendida mientras contás; si salís de MMV o la bloqueás, el conteo se pausa. «Pausar» frena pasos, GPS y reloj hasta que reanudes. Con «Modo bolsillo» la pantalla queda negra y encendida.</small>}
      </div>
      {activo && bolsillo && (
        <Bolsillo
          vista={vistaBolsillo}
          pausada={manual}
          onPausa={alternarPausa}
          onSalir={() => {
            vibrar(VIBRA.salir)
            setBolsillo(false)
          }}
        />
      )}
      {fecha !== hoy() && <small className="mu">Para otros días podés consultar y corregir los pasos; el sensor solo cuenta hoy.</small>}
      {estado && <small role="status" className="mu">{estado}</small>}
      {activo && usarGps && senal && (
        <small className="mu gps-linea">
          <BarrasSenal barras={senal.barras} id={senal.id} /> {senal.texto} · {km(gps.m)} km
          {senal.id === 'debil' ? ' (salí a cielo abierto para mejorar la precisión)' : ''}
        </small>
      )}
      {activo && usarGps && guardarRutaSt && totalPuntos(segsVivo) >= 2 && (
        <TrazoSvg segs={segsVivo} ancho={320} alto={160} className="trazo-vivo" etiqueta="Trazo del recorrido en curso" />
      )}
      <details>
        <summary><small className="mu">Ajustes del conteo</small></summary>
        <label className="lin">
          <span className="check">
            <input type="checkbox" checked={usarGps} disabled={activo} onChange={e => cambiarUsarGps(e.target.checked)} />
            <span>Usar GPS para medir distancia y corregir pasos</span>
          </span>
          <small className="mu">Pide el permiso de ubicación. La ubicación en vivo nunca sale del teléfono.</small>
        </label>
        <label className="lin">
          <span className="check">
            <input type="checkbox" checked={vibrarSt} onChange={e => cambiarVibrar(e.target.checked)} />
            <span>Vibrar al pausar, reanudar y salir del modo bolsillo</span>
          </span>
          <small className="mu">Solo en teléfonos Android: en iPhone el navegador no permite vibrar.</small>
        </label>
        <label className="lin">
          <span className="check">
            <input type="checkbox" checked={guardarRutaSt} disabled={activo || !usarGps} onChange={e => cambiarGuardarRuta(e.target.checked)} />
            <span>Guardar la ruta para ver mi historial</span>
          </span>
          <small className="mu">El recorrido queda solo en este teléfono (también viaja en tu backup) y no se envía a ningún servidor. Se ve y se borra desde Progreso › Rutas.</small>
        </label>
        <label className="lin">
          <span className="check">
            <input type="checkbox" checked={ocultarSt} disabled={activo || !usarGps || !guardarRutaSt} onChange={e => cambiarOcultar(e.target.checked)} />
            <span>Ocultar los primeros y últimos 150 m del trazo</span>
          </span>
          <small className="mu">Así no queda dibujado el lugar de donde salís (por ejemplo, tu casa). La distancia y el ritmo se miden completos.</small>
        </label>
        <div className="row">
          <label htmlFor="meta-pasos">Meta diaria de pasos</label>
          <input
            id="meta-pasos"
            type="text"
            inputMode="numeric"
            placeholder={promedio ? `Mi promedio: ${promedio.toLocaleString('es-AR')}` : 'Sin meta'}
            value={metaTxt}
            onChange={e => setMetaTxt(e.target.value)}
            onBlur={confirmarMeta}
          />
        </div>
        <small className="mu">
          Opcional, entre {META_MIN.toLocaleString('es-AR')} y {META_MAX.toLocaleString('es-AR')}. Si la dejás vacía, el anillo se compara con tu promedio de {PROMEDIO_DIAS} días.
        </small>
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

export default function ActividadFisica({onVerRutas}) {
  const [fecha, setFecha] = useState(hoy()),
    [conteoActivo, setConteoActivo] = useState(activoHoy),
    [total, setTotal] = useState(''),
    [cargando, setCargando] = useState(true),
    [errorCarga, setErrorCarga] = useState(''),
    [actividades, setActividades] = useState([]),
    [tipo, setTipo] = useState('bicicleta'),
    [minutos, setMinutos] = useState(''),
    [kmTxt, setKmTxt] = useState(''),
    [nota, setNota] = useState(''),
    [rutaId, setRutaId] = useState(null),
    [promedio, setPromedio] = useState(null)

  useEffect(() => {
    let vigente = true
    db.habitos
      .where('fecha')
      .between(sumaDias(fecha, -PROMEDIO_DIAS), fecha, true, false)
      .toArray()
      .then(hs => vigente && setPromedio(promedioPasos(hs, fecha)))
      .catch(() => vigente && setPromedio(null))
    return () => { vigente = false }
  }, [fecha])

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
      setMinutos(''); setKmTxt(''); setNota(''); setRutaId(null)
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
    setRutaId(s.rutaId ?? null)
  }

  // Guarda la ruta. El historial vive en Progreso › Rutas y se lee al abrirlo.
  const guardarRutaFila = useCallback(fila => guardarRuta(fila), [])

  const agregar = async () => {
    const item = armarActividad({fecha, tipo, minutos, km: kmTxt.replace(',', '.'), nota, rutaId})
    if (!item) return
    const id = await db.actividades.add(item)
    setActividades(a => [...a, {...item, id}].sort((x, y) => x.id - y.id))
    setMinutos(''); setKmTxt(''); setNota(''); setRutaId(null)
  }

  const borrar = async id => {
    await db.actividades.delete(id)
    setActividades(a => a.filter(x => x.id !== id))
  }

  const resumen = resumenActividades(actividades)

  return (
    <>
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
      <ConteoPasos total={total} fecha={fecha} activo={conteoActivo} promedio={promedio} onActivoChange={setConteoActivo} onGuardar={guardarPasos} onSumar={sumarConteo} onSugerir={sugerir} onRuta={guardarRutaFila} cargando={cargando} />
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
      {onVerRutas && (
        <div className="botonera">
          <button className="ghost" onClick={onVerRutas}>Ver mis rutas</button>
        </div>
      )}
    </section>
    </>
  )
}
