import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import Anillo from '../../ui/Anillo'
import Icono from '../../ui/Icono'
import {cfg, setCfg} from '../../data/db'
import {
  ALARMA_INICIAL, parseHora, proximaAlarma, horasDormidas, parseHoras, textoHoras, textoDuracion,
  volumenAlarma, nuevaSesion, sesionParaGuardar, sesionDesdeGuardado, faseSueno, finPropuesto,
  alternativaFin, propuestaDia, fechaDeMs, horasPrevias, nocheDeSesion, HORAS_MAX_DIA
} from '../../domain/sueno'

const CLAVE = 'mv_sueno_sesion'
const leer = k => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
const borrar = k => { try { localStorage.removeItem(k) } catch { /* sin almacenamiento */ } }
const hhmm = ms => new Date(ms).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit', hour12: false})
const enCampo = h => (h == null ? '' : String(h).replace('.', ','))

// Dormir con alarma: pantalla casi negra que se queda encendida, suena a la hora elegida y, al apagarla,
// propone las horas de sueño para el check-in. Las horas se calculan con los instantes guardados (no con
// un contador), así que salen bien aunque el teléfono haya frenado el reloj de la página.
// Entrega 36: la propuesta es el TOTAL DEL DÍA (lo ya guardado ese día + esta sesión), para que una siesta
// se sume a la noche en vez de pisarla. `previoDe(fecha)` devuelve las horas ya guardadas de ese día y
// `onGuardar(total, fecha, {noche, calidad})` escribe el total confirmado en la fila de ese día. `noche` lleva la hora de
// acostarse y de levantarse (solo si la sesión fue de noche, no una siesta) y `calidad` lo que eligió la persona.
export default function ModoSueno({onGuardar, previoDe}) {
  const [sesion, setSesion] = useState(() => sesionDesdeGuardado(leer(CLAVE))),
    [ahora, setAhora] = useState(() => Date.now()),
    [alarmaTxt, setAlarmaTxt] = useState(() => {
      const g = cfg('alarmasueno', ALARMA_INICIAL)
      return parseHora(g) ? g : ALARMA_INICIAL
    }),
    [horasTxt, setHorasTxt] = useState(''),
    [aviso, setAviso] = useState(''),
    [calidad, setCalidad] = useState(null), // opcional: cómo dormiste (1–5), se guarda junto con las horas
    [ultimo, setUltimo] = useState(null),
    [previo, setPrevio] = useState({fecha: null, horas: 0}),
    ctx = useRef(null),
    vivo = useRef(!!sesion && Date.now() < sesion.alarma),
    sono = useRef(false)

  const fase = faseSueno({sesion, ahora, vivo: vivo.current, sono: sono.current})
  if (fase === 'sonando') sono.current = true
  const fin = sesion ? finPropuesto(sesion) : null

  const prepararAudio = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!ctx.current) ctx.current = new AC()
      ctx.current.resume?.()
    } catch { /* sin audio: queda la vibración */ }
  }
  const pitar = vol => {
    try {
      const c = ctx.current
      if (!c) return
      const o = c.createOscillator(),
        g = c.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      g.gain.setValueAtTime(0, c.currentTime)
      g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.03)
      g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3)
      o.connect(g)
      g.connect(c.destination)
      o.start()
      o.stop(c.currentTime + 0.35)
    } catch { /* ignorar */ }
  }

  // Reloj: mientras haya una noche en curso se mira la hora cada segundo y al volver a la app.
  const enCurso = !!sesion && sesion.fin == null
  useEffect(() => {
    if (!enCurso) return
    const tic = () => setAhora(Date.now())
    tic()
    const id = setInterval(tic, 1000)
    const vis = () => document.visibilityState === 'visible' && tic()
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [enCurso])

  // Pantalla encendida mientras se duerme: sin eso el teléfono suspende la página y la alarma no puede sonar.
  const mantener = !!sesion && fase !== 'resumen'
  useEffect(() => {
    if (!mantener) return
    let candado = null,
      cancelado = false
    const pedir = async () => {
      try {
        if (document.visibilityState === 'visible' && navigator.wakeLock) {
          const l = await navigator.wakeLock.request('screen')
          if (cancelado) l.release().catch(() => {})
          else candado = l
        }
      } catch { /* el navegador puede negarlo (ahorro de batería) */ }
    }
    pedir()
    const vis = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', vis)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', vis)
      candado?.release().catch(() => {})
    }
  }, [mantener])

  // Alarma: un pitido por segundo, cada vez más fuerte, más vibración si el teléfono la tiene.
  useEffect(() => {
    if (fase !== 'sonando') return
    prepararAudio()
    const t0 = Date.now()
    const sonar = () => {
      pitar(volumenAlarma((Date.now() - t0) / 1000))
      try { navigator.vibrate?.([200, 100, 200]) } catch { /* sin vibración */ }
    }
    sonar()
    const id = setInterval(sonar, 1000)
    return () => {
      clearInterval(id)
      try { navigator.vibrate?.(0) } catch { /* sin vibración */ }
    }
  }, [fase])

  // Día en que se despierta (el de la hora de fin): ahí se suma y se guarda, aunque la pantalla de Hoy
  // se haya abierto la noche anterior.
  const fecha = fin == null ? null : fechaDeMs(fin)

  // Al entrar al resumen se leen las horas que ya había ese día (otra noche o siestas).
  useEffect(() => {
    if (fase !== 'resumen' || !fecha) return
    let vigente = true
    const listo = h => vigente && setPrevio({fecha, horas: horasPrevias(h)})
    Promise.resolve(previoDe ? previoDe(fecha) : 0).then(listo, () => listo(0))
    return () => {
      vigente = false
    }
  }, [fase, fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  // Con eso leído se propone el total; la persona lo puede corregir. Hasta entonces el campo espera (sin parpadeo).
  const previoListo = previo.fecha === fecha
  useEffect(() => {
    if (fase !== 'resumen' || !sesion || !previoListo) return
    setHorasTxt(enCampo(propuestaDia({previo: previo.horas, inicio: sesion.inicio, fin: finPropuesto(sesion)}).total))
  }, [fase, sesion?.inicio, fin, previoListo, previo.horas]) // eslint-disable-line react-hooks/exhaustive-deps

  const empezar = () => {
    const t = Date.now(),
      alarma = proximaAlarma(t, alarmaTxt)
    if (!alarma) return setAviso('Elegí una hora de alarma válida.')
    const s = nuevaSesion(t, alarma)
    guardar(CLAVE, sesionParaGuardar(s))
    setCfg('alarmasueno', alarmaTxt)
    prepararAudio()
    vivo.current = true
    sono.current = false
    setAviso('')
    setUltimo(null)
    setCalidad(null)
    setPrevio({fecha: null, horas: 0})
    setAhora(t)
    setSesion(s)
  }
  const apagar = () => {
    const s = {...sesion, fin: Date.now()}
    guardar(CLAVE, sesionParaGuardar(s))
    setSesion(s)
  }
  const usarFin = ms => {
    const s = {...sesion, fin: ms}
    guardar(CLAVE, sesionParaGuardar(s))
    setSesion(s)
  }
  const descartar = () => {
    if (!confirm('¿Descartar esta noche? No se guardan horas de sueño.')) return
    borrar(CLAVE)
    sono.current = false
    setSesion(null)
    setAviso('')
    setCalidad(null)
    setPrevio({fecha: null, horas: 0})
  }
  const confirmar = () => {
    const h = parseHoras(horasTxt, HORAS_MAX_DIA)
    if (!h) return setAviso(`Escribí las horas de sueño, entre 0,3 y ${HORAS_MAX_DIA} (por ejemplo 7,5).`)
    onGuardar(h, fecha, {noche: nocheDeSesion(sesion.inicio, fin), calidad})
    borrar(CLAVE)
    sono.current = false
    setSesion(null)
    setAviso('')
    setUltimo({horas: h, suma: previoListo && previo.horas > 0})
    setCalidad(null)
    setPrevio({fecha: null, horas: 0})
  }

  const probar = () => {
    prepararAudio()
    pitar(0.3)
  }

  // ---- Vista normal (dentro de Hoy) ----
  const inicio = (
    <div className="sueno">
      <div className="row">
        <label htmlFor="alarma-sueno">Alarma</label>
        <input
          id="alarma-sueno"
          type="time"
          value={alarmaTxt}
          disabled={!!sesion}
          onChange={e => setAlarmaTxt(e.target.value)}
        />
        <button type="button" onClick={empezar} disabled={!!sesion || !parseHora(alarmaTxt)}>
          <Icono n="luna" tam={18} /> Empezar a dormir
        </button>
      </div>
      <small className="mu">
        La pantalla queda casi negra y encendida; a la hora elegida suena la alarma. Al apagarla te propongo las horas de sueño para el check-in; si ya tenías horas ese día (otra noche o una siesta), te propongo el total sumado para que lo confirmes.
      </small>
      {aviso && !sesion && <small role="alert" className="mu">{aviso}</small>}
      {ultimo != null && (
        <small role="status" className="mu">
          {ultimo.suma
            ? `Guardé ${textoHoras(ultimo.horas)} de sueño en total hoy (sumé esta sesión a lo que ya tenías).`
            : `Guardé ${textoHoras(ultimo.horas)} de sueño en el check-in de hoy.`}
        </small>
      )}
      <details>
        <summary><small className="mu">Cómo funciona y límites</small></summary>
        <small className="mu">
          Una app web no puede sonar con la pantalla bloqueada ni con MMV cerrado o en segundo plano. Por eso la pantalla se queda encendida (casi negra) y conviene dejar el teléfono cargando. Poné además una alarma del teléfono de respaldo.
        </small>
        <small className="mu">
          Las horas son el tiempo desde que tocás «Empezar a dormir» hasta que apagás la alarma: es tiempo en cama, no sueño medido. Si tardaste en dormirte o te despertaste antes, corregilas antes de guardar. Cada vez que uses «Dormir con alarma» el mismo día (por ejemplo una siesta), se suma al total de ese día y vos confirmás la cuenta.
        </small>
      </details>
    </div>
  )

  if (!sesion) return inicio

  // ---- Pantalla completa (casi negra) ----
  const alt = fase === 'resumen' ? alternativaFin({sesion, ahora}) : null
  const total = sesion.alarma - sesion.inicio
  const prop = propuestaDia({previo: previoListo ? previo.horas : 0, inicio: sesion.inicio, fin: fin ?? sesion.alarma}),
    suma = previoListo && prop.antes > 0 && prop.sesion != null
  const soloSesion = suma && parseHoras(horasTxt, HORAS_MAX_DIA) === prop.sesion
  return (
    <>
      {inicio}
      {createPortal(
        <div className="sueno-ov" role="dialog" aria-modal="true" aria-label="Modo sueño">
          {fase === 'durmiendo' && (
            <>
              <p className="sueno-est" role="status">
                <Icono n="luna" tam={18} /> Durmiendo · alarma a las {hhmm(sesion.alarma)}
              </p>
              <Anillo valor={ahora - sesion.inicio} meta={total} tam={240}>
                <span className="sueno-hora mono">{hhmm(ahora)}</span>
              </Anillo>
              <p className="sueno-falta">Faltan {textoDuracion(sesion.alarma - ahora)}</p>
              <small className="mu sueno-nota">
                Dejá MMV abierto y el teléfono cargando. Con la pantalla bloqueada la alarma no suena.
              </small>
              <div className="row sueno-bot">
                <button type="button" className="ghost" onClick={probar}>Probar sonido</button>
                <button type="button" onClick={apagar}>Despertarme ya</button>
                <button type="button" className="ghost" onClick={descartar}>Cancelar noche</button>
              </div>
            </>
          )}
          {fase === 'sonando' && (
            <>
              <p className="sueno-est" role="alert">
                <Icono n="alerta" tam={18} /> Es hora de despertar
              </p>
              <Anillo valor={1} meta={1} clase="ok" tam={240}>
                <span className="sueno-hora mono">{hhmm(ahora)}</span>
              </Anillo>
              <button type="button" className="pri sueno-apagar" autoFocus onClick={apagar}>
                Apagar alarma
              </button>
            </>
          )}
          {fase === 'resumen' && (
            <div className="sueno-res">
              <h3>Tu noche</h3>
              <p className="sueno-linea">
                Te acostaste a las {hhmm(sesion.inicio)} · despertaste a las {hhmm(fin)}
                {sesion.fin == null && ' (la hora de la alarma: la app estaba cerrada cuando sonó)'}
              </p>
              {suma && (
                <p className="sueno-suma" role="status">
                  Ya tenías <b>{textoHoras(prop.antes)}</b> hoy + esta sesión <b>{textoHoras(prop.sesion)}</b> ={' '}
                  <b>{textoHoras(prop.total)}</b> en el día.
                </p>
              )}
              <div className="row">
                <label htmlFor="horas-sueno">{suma ? 'Total de sueño de hoy' : 'Horas de sueño'}</label>
                <input
                  id="horas-sueno"
                  className="fx"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej.: 7,5"
                  value={horasTxt}
                  onChange={e => setHorasTxt(e.target.value)}
                />
                <span className="tag">h</span>
              </div>
              {suma && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setHorasTxt(enCampo(soloSesion ? prop.total : prop.sesion))}
                >
                  {soloSesion ? `Volver al total (${textoHoras(prop.total)})` : `Solo esta sesión (${textoHoras(prop.sesion)})`}
                </button>
              )}
              {alt != null && (
                <button type="button" className="ghost" onClick={() => usarFin(alt)}>
                  Usar las {hhmm(alt)} ({textoHoras(horasDormidas(sesion.inicio, alt))} de esta sesión)
                </button>
              )}
              <div className="ck">
                <b className="ck-n" id="sueno-cal">Calidad (opcional)</b>
                <div className="escala" role="group" aria-labelledby="sueno-cal" aria-description="1 mala, 5 excelente">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={calidad === n ? 'on' : ''}
                      aria-pressed={calidad === n}
                      onClick={() => setCalidad(calidad === n ? null : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <small className="mu sq-ext">
                  <span>1 · mala</span>
                  <span>5 · excelente</span>
                </small>
              </div>
              <small className="mu">
                {suma
                  ? 'Es lo que ya tenías ese día más el tiempo desde que te acostaste: si tardaste en dormirte, te despertaste antes o lo anterior estaba mal, corregilo.'
                  : 'Es el tiempo desde que te acostaste: si tardaste en dormirte o te despertaste antes, corregilo.'}
              </small>
              {aviso && <small role="alert" className="mu">{aviso}</small>}
              <div className="row">
                <button type="button" className="pri" onClick={confirmar}>Guardar en mi check-in</button>
                <button type="button" className="ghost" onClick={descartar}>Descartar</button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
