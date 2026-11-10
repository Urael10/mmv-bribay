import {useState, useEffect} from 'react'
import Anillo from '../../ui/Anillo'
import {claseAnillo, textoAnillo} from '../../domain/anillo'
import {db, hoy, cfg} from '../../data/db'
import FilaAlimentacion from '../comidas/FilaAlimentacion'
import Preparacion from '../coach/Preparacion'
import {TarjetaCuerpo} from '../cuerpo/Cuerpo'
import {CHECKIN, checkinHecho} from '../../domain/checkin'
import {AvisoDescarga} from '../progreso/AvisoDescarga'
import {videosPendientes, haySesionEnCurso} from '../../domain/entreno'
import {sumaDias} from '../../domain/stats'
import {ultima} from '../../domain/cuerpo'
import {fmtVal} from '../../domain/formato'
import {dejarFoto} from '../../services/pendiente'
import ActividadFisica from '../actividad/ActividadFisica'
import ModoSueno from '../sueno/ModoSueno'
import RegistroSueno from '../sueno/RegistroSueno'
import {habitualNoche, duracionHM, duracionCorta, OBJETIVO_SUENO_H, fraccionSueno} from '../../domain/sueno'
import Icono from '../../ui/Icono'
import {parsearMeta, promedioPasos, metaEfectiva, textoMetaPasos, PROMEDIO_DIAS} from '../../domain/metaPasos'

// Fila plegable de Hoy (Entrega 30). El contenido queda montado aunque esté cerrado (solo se oculta),
// así una ruta o un formulario a medias no se pierden al plegar.
function Pleg({id, titulo, resumen, abierto, onCambio, children}) {
  return (
    <div className="pleg">
      <button
        type="button"
        className="pleg-b"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => onCambio(!abierto)}
      >
        <b>{titulo}</b>
        <span className="mu pleg-r">{resumen}</span>
        <Icono n="chevron-abajo" tam={18} className={'vacio-ch' + (abierto ? ' abierto' : '')} />
      </button>
      <div id={id} className="pleg-c" hidden={!abierto}>
        {children}
      </div>
    </div>
  )
}

// Pasos: anillo contra tu meta (o tu promedio de 28 días). Al tocarla se abre «Actividad y cuerpo», donde está el conteo.
// Lee los pasos de la base cada vez que se abre o se cierra ese plegable, así se pone al día después de contar.
function TeselaPasos({abierto, onAbrir}) {
  const [d, setD] = useState(null)
  useEffect(() => {
    let vigente = true
    const f = hoy()
    db.habitos
      .where('fecha')
      .aboveOrEqual(sumaDias(f, -PROMEDIO_DIAS))
      .toArray()
      .then(hs => {
        if (!vigente) return
        const fila = hs.find(x => x.fecha === f)
        setD({pasos: +fila?.pasos > 0 ? +fila.pasos : 0, promedio: promedioPasos(hs, f)})
      })
      .catch(() => vigente && setD({pasos: 0, promedio: null}))
    return () => {
      vigente = false
    }
  }, [abierto])
  if (!d) return null
  const ef = metaEfectiva({meta: parsearMeta(cfg('metapasos', '')).meta, promedio: d.promedio})
  return (
    <button
      type="button"
      className="tesela"
      onClick={onAbrir}
      aria-label={ef.valor ? textoAnillo('Pasos', d.pasos, ef.valor) + ': abrir conteo' : `Pasos: ${d.pasos}. Abrir conteo`}
    >
      <Anillo valor={d.pasos} meta={ef.valor} clase={claseAnillo(d.pasos, ef.valor)}>
        <Icono n="pasos" tam={20} />
      </Anillo>
      <span className="eti">Pasos</span>
      <b className="mono tesela-v">{d.pasos ? d.pasos.toLocaleString('es-AR') : '—'}</b>
      <small className="mu">{d.pasos || ef.valor ? textoMetaPasos(ef) : 'tocá para contar'}</small>
    </button>
  )
}

// Sueño: horas del día contra una referencia de 8 h, con la calidad. Al tocarla se abre el check-in en el bloque de sueño.
function TeselaSueno({h, onAbrir}) {
  const horas = +String(h.sueno ?? '').replace(',', '.') > 0 ? +String(h.sueno).replace(',', '.') : 0,
    cal = +h.calidad >= 1 ? +h.calidad : null
  return (
    <button
      type="button"
      className="tesela"
      onClick={onAbrir}
      aria-label={
        horas
          ? `Sueño: ${duracionHM(horas)} de ${OBJETIVO_SUENO_H} h (${Math.round(fraccionSueno(horas) * 100)} %)${cal ? `, calidad ${cal} de 5` : ''}: abrir el registro`
          : 'Sueño: sin registrar. Abrir el registro'
      }
    >
      <Anillo valor={horas} meta={OBJETIVO_SUENO_H} clase={claseAnillo(horas, OBJETIVO_SUENO_H)}>
        <Icono n="luna" tam={20} />
      </Anillo>
      <span className="eti">Sueño</span>
      <b className="mono tesela-v">{horas ? duracionCorta(horas) : '—'}</b>
      <small className="mu">{horas ? `de ${OBJETIVO_SUENO_H} h${cal ? ` · calidad ${cal}/5` : ''}` : 'tocá para registrar'}</small>
    </button>
  )
}

// Peso: último valor registrado. Al tocarlo se abre «Actividad y cuerpo» para cargar uno nuevo.
function TeselaPeso({onAbrir}) {
  const [u, setU] = useState(undefined)
  useEffect(() => {
    db.medidas
      .toArray()
      .then(ms => setU(ultima(ms) ?? null))
      .catch(() => setU(null))
  }, [])
  if (u === undefined) return null
  const dias = u ? Math.round((Date.now() - new Date(u.fecha + 'T12:00:00')) / 864e5) : null
  return (
    <button type="button" className="tesela" onClick={onAbrir} aria-label="Peso: abrir Cuerpo">
      {/* Entrega 42: sin meta no hay anillo, pero el círculo con el ícono ocupa el mismo lugar y alinea la fila con las otras */}
      <span className="anillo anillo-fijo" aria-hidden="true">
        <Icono n="balanza" tam={20} />
      </span>
      <span className="eti">Peso</span>
      <b className="mono tesela-v">{u ? fmtVal(u.peso) : '—'}</b>
      <small className="mu">{u ? `kg · ${dias <= 0 ? 'hoy' : `hace ${dias} d`}` : 'sin datos'}</small>
    </button>
  )
}

export default function Hoy({onEmpezar, onComidas, onRutas, pedido}) {
  const [h, setH] = useState({fecha: hoy(), agua: 0, sueno: '', calidad: null}),
    [otro, setOtro] = useState(''),
    [videos, setVideos] = useState([]),
    [ckAb, setCkAb] = useState(false),
    [aguaAb, setAguaAb] = useState(false),
    [suAb, setSuAb] = useState(false),
    [masAb, setMasAb] = useState(false),
    [reinicio, setReinicio] = useState(null), // lo que había antes de «Reiniciar», para deshacerlo sin preguntar
    [pedir, setPedir] = useState({id: '', n: 0}), // a qué bloque del check-in llevar (sube con cada pedido)
    [habitual, setHabitual] = useState(null), // hora habitual de acostarse y levantarse (últimos días)
    meta = +cfg('meta', 2500),
    enCurso = haySesionEnCurso(localStorage.getItem('mv_sesion'))
  useEffect(() => {
    db.habitos.get(hoy()).then(x => {
      if (x) setH(x)
      setCkAb(!checkinHecho(x)) // el check-in se abre solo si todavía no lo hiciste hoy
    })
    db.habitos
      .where('fecha')
      .between(sumaDias(hoy(), -8), hoy(), true, false)
      .toArray()
      .then(hs => setHabitual(habitualNoche(hs, hoy())))
      .catch(() => {})
    db.sesiones
      .where('fecha')
      .aboveOrEqual(sumaDias(hoy(), -13))
      .toArray()
      .then(a => setVideos(videosPendientes(a, hoy())))
  }, [])
  // «Preparación» sin datos y la tesela de Sueño piden el check-in: se abre, se trae a la vista el bloque pedido
  // (el check-in entero o el registro de sueño) y se enfoca, sin animación con «reducir movimiento».
  const abrirCk = id => {
    setCkAb(true)
    setPedir(p => ({id, n: p.n + 1}))
  }
  useEffect(() => {
    if (!pedir.n) return
    const el = document.getElementById(pedir.id)
    if (!el) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({block: 'center', behavior: quieto ? 'auto' : 'smooth'})
    ;(el.matches('[tabindex]') ? el : el.querySelector('button'))?.focus({preventScroll: true})
  }, [pedir])
  // Entrega 42 · tocar un aviso del teléfono abre acá lo que corresponde: el check-in, el agua o «Dormir con alarma».
  // `pedido.n` sube con cada toque (así el mismo aviso dos veces seguidas vuelve a abrirse). El bloque se abre y se trae
  // a la vista con el mismo mecanismo de `abrirCk`.
  useEffect(() => {
    if (!pedido?.n) return
    if (pedido.accion === 'checkin') abrirCk('hoy-checkin')
    else if (pedido.accion === 'agua') {
      setAguaAb(true)
      setPedir(p => ({id: 'hoy-agua', n: p.n + 1}))
    } else if (pedido.accion === 'sueno') {
      setSuAb(true)
      setPedir(p => ({id: 'hoy-sueno', n: p.n + 1}))
    }
  }, [pedido?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  // Se guarda sobre la fila que hay en la base (no sobre la copia de esta pantalla): los pasos los escribe
  // «Actividad y cuerpo» por su lado y una copia vieja los pisaría. La transacción ordena los toques seguidos.
  const g = p => {
    setH(prev => ({...prev, ...p}))
    const f = h.fecha
    db.transaction('rw', db.habitos, async () => {
      const actual = await db.habitos.get(f)
      await db.habitos.put({...(actual || h), ...p, fecha: f})
    })
  }
  // «Dormir con alarma»: lee y escribe el sueño del día en que te despertás (puede no ser el de esta pantalla si
  // quedó abierta de la noche anterior). Lo que llega a `guardarSueno` ya es el total confirmado (lo previo + la sesión).
  const leerSueno = async f => (await db.habitos.get(f))?.sueno
  // `extra`: {noche: {acosto, desperto}, calidad}. Las horas de la noche se anotan solo si ese día no tenía ya las suyas
  // (una siesta no pisa la hora de acostarse); la calidad solo si la persona la eligió.
  const guardarSueno = async (horas, f, extra = {}) => {
    const dia = f || h.fecha
    const fila = await db.transaction('rw', db.habitos, async () => {
      const actual = await db.habitos.get(dia)
      const nueva = {...(actual || {agua: 0}), sueno: horas, fecha: dia}
      if (extra.noche && !(actual?.acosto && actual?.desperto)) Object.assign(nueva, extra.noche)
      if (+extra.calidad >= 1) nueva.calidad = +extra.calidad
      await db.habitos.put(nueva)
      return nueva
    })
    setH(fila)
  }
  const log = h.aguaLog || []
  const sumar = ml => {
    ml = Math.round(+ml)
    if (!(ml > 0) || ml > 5000) return
    setReinicio(null)
    g({agua: (+h.agua || 0) + ml, aguaLog: [...log, ml]})
  }
  const deshacer = () => {
    if (!log.length) return
    const ml = log[log.length - 1]
    g({agua: Math.max(0, (+h.agua || 0) - ml), aguaLog: log.slice(0, -1)})
  }
  const resumenCk = checkinHecho(h) ? 'Hecho' : '20 segundos'
  return (
    <div className="bento hoy">
      <Preparacion
        h={h}
        onCheckin={() => abrirCk('hoy-checkin')}
      />
      <div className="hoy-cta">
        <div className="ctafila">
          <button className="cta" onClick={onEmpezar}>
            {enCurso ? 'CONTINUAR ENTRENO' : 'EMPEZAR ENTRENO'}
          </button>
          {!enCurso && (
            <>
              <button
                className="ctafoto"
                aria-label="Empezar con una foto de la pizarra"
                onClick={e => e.currentTarget.nextSibling.click()}
              >
                <Icono n="camara" tam={24} />
              </button>
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={e => {
                  const f = e.target.files[0]
                  e.target.value = ''
                  if (!f) return
                  dejarFoto(f)
                  onEmpezar()
                }}
              />
            </>
          )}
        </div>
        {enCurso && <small className="mu hoy-nota">Tenés una sesión sin terminar.</small>}
        {videos.length > 0 && (
          <small className="mu hoy-nota"><Icono n="video" tam={16} className="en-texto" /> Videos sin marcar como grabados (14 días): {videos.length}</small>
        )}
      </div>
      <AvisoDescarga />
      <div className="teselas">
        <FilaAlimentacion onAbrir={onComidas} />
        <button
          type="button"
          className="tesela"
          aria-expanded={aguaAb}
          aria-controls="hoy-agua"
          aria-label={textoAnillo('Agua', h.agua, meta, 'ml')}
          onClick={() => setAguaAb(v => !v)}
        >
          <Anillo valor={h.agua} meta={meta} clase={claseAnillo(h.agua, meta)}>
            <Icono n="gota" tam={20} />
          </Anillo>
          <span className="eti">Agua</span>
          <b className="mono tesela-v">{fmtVal(h.agua, {dec: 0})}</b>
          <small className="mu">de {meta} ml</small>
        </button>
        <TeselaSueno h={h} onAbrir={() => abrirCk('hoy-sueno-reg')} />
        <TeselaPasos abierto={masAb} onAbrir={() => setMasAb(true)} />
        <TeselaPeso onAbrir={() => setMasAb(true)} />
      </div>
      {aguaAb && (
        <section id="hoy-agua">
          <h3>Hidratación</h3>
          <div className="bar">
            <i style={{width: Math.min(100, ((+h.agua || 0) / meta) * 100) + '%'}} />
          </div>
          <div className="row">
            {[250, 500].map(n => (
              <button key={n} onClick={() => sumar(n)}>
                +{n}
              </button>
            ))}
            <button className="ghost" disabled={!log.length} onClick={deshacer}>
              <Icono n="deshacer" tam={16} className="en-texto" /> Deshacer{log.length ? ` ${log[log.length - 1]}` : ''}
            </button>
          </div>
          <div className="row" style={{marginTop: 8}}>
            <input
              className="fx med"
              type="number"
              inputMode="numeric"
              placeholder="Otra (ml)"
              value={otro}
              onChange={e => setOtro(e.target.value)}
            />
            <button
              className="ghost"
              disabled={!(+otro > 0)}
              onClick={() => {
                sumar(otro)
                setOtro('')
              }}
            >
              + Sumar
            </button>
            {reinicio && !h.agua ? (
              <button
                className="ghost"
                onClick={() => {
                  g(reinicio)
                  setReinicio(null)
                }}
              >
                <Icono n="deshacer" tam={16} className="en-texto" /> Deshacer reinicio
              </button>
            ) : (
              <button
                className="ghost"
                disabled={!h.agua}
                onClick={() => {
                  setReinicio({agua: h.agua, aguaLog: log})
                  g({agua: 0, aguaLog: []})
                }}
              >
                Reiniciar
              </button>
            )}
          </div>
        </section>
      )}
      <Pleg id="hoy-checkin" titulo="Check-in de hoy" resumen={resumenCk} abierto={ckAb} onCambio={setCkAb}>
        <section className="checkin">
          {CHECKIN.map(c => (
            <div className="ck" key={c.k}>
              <b className="ck-n" id={'ck-' + c.k}>
                {c.n}
              </b>
              <div className="ck-esc">
                <div
                  className="escala"
                  role="group"
                  aria-labelledby={'ck-' + c.k}
                  aria-description={`1 ${c.bajo}, 5 ${c.alto}`}
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={+h[c.k] === n ? 'on' : ''}
                      aria-pressed={+h[c.k] === n}
                      onClick={() => g({[c.k]: +h[c.k] === n ? null : n})}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {/* Entrega 42: cada fila dice sus extremos (el lector ya los tiene en `aria-description`) */}
                <div className="ck-ext mu" aria-hidden="true">
                  <span>{c.ext1}</span>
                  <span>{c.ext5}</span>
                </div>
              </div>
            </div>
          ))}
          <RegistroSueno h={h} g={g} habitual={habitual} />
        </section>
      </Pleg>
      <Pleg
        id="hoy-sueno"
        titulo="Dormir con alarma"
        resumen={+h.sueno > 0 ? `${String(h.sueno).replace('.', ',')} h hoy` : 'Alarma y horas'}
        abierto={suAb}
        onCambio={setSuAb}
      >
        <section>
          <ModoSueno previoDe={leerSueno} onGuardar={guardarSueno} />
        </section>
      </Pleg>
      <Pleg id="hoy-mas" titulo="Actividad y cuerpo" resumen="Pasos y rutas" abierto={masAb} onCambio={setMasAb}>
        <ActividadFisica onVerRutas={onRutas} />
        <TarjetaCuerpo />
      </Pleg>
    </div>
  )
}
