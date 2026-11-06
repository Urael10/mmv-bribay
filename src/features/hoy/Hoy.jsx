import {useState, useEffect} from 'react'
import {db, hoy, cfg} from '../../data/db'
import FilaAlimentacion from '../comidas/FilaAlimentacion'
import Preparacion from '../coach/Preparacion'
import {TarjetaCuerpo} from '../cuerpo/Cuerpo'
import {CHECKIN, checkinHecho} from '../../domain/checkin'
import {AvisoDescarga} from '../progreso/AvisoDescarga'
import {videosPendientes, haySesionEnCurso} from '../../domain/entreno'
import {sumaDias} from '../../domain/stats'
import {ultima} from '../../domain/cuerpo'
import {fmtVal, hayDato} from '../../domain/formato'
import {dejarFoto} from '../../services/pendiente'
import ActividadFisica from '../actividad/ActividadFisica'
import Icono from '../../ui/Icono'

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
      <span className="eti">Peso</span>
      <b className="mono tesela-v">{u ? fmtVal(u.peso) : '—'}</b>
      <small className="mu">{u ? `kg · ${dias <= 0 ? 'hoy' : `hace ${dias} d`}` : 'sin datos'}</small>
    </button>
  )
}

export default function Hoy({onEmpezar, onComidas, onRutas}) {
  const [h, setH] = useState({fecha: hoy(), agua: 0, sueno: '', calidad: 3}),
    [otro, setOtro] = useState(''),
    [videos, setVideos] = useState([]),
    [ckAb, setCkAb] = useState(false),
    [aguaAb, setAguaAb] = useState(false),
    [masAb, setMasAb] = useState(false),
    meta = +cfg('meta', 2500),
    enCurso = haySesionEnCurso(localStorage.getItem('mv_sesion'))
  useEffect(() => {
    db.habitos.get(hoy()).then(x => {
      if (x) setH(x)
      setCkAb(!checkinHecho(x)) // el check-in se abre solo si todavía no lo hiciste hoy
    })
    db.sesiones
      .where('fecha')
      .aboveOrEqual(sumaDias(hoy(), -13))
      .toArray()
      .then(a => setVideos(videosPendientes(a, hoy())))
  }, [])
  const g = p => {
    const n = {...h, ...p}
    setH(n)
    db.habitos.put(n)
  }
  const log = h.aguaLog || []
  const sumar = ml => {
    ml = Math.round(+ml)
    if (!(ml > 0) || ml > 5000) return
    g({agua: (+h.agua || 0) + ml, aguaLog: [...log, ml]})
  }
  const deshacer = () => {
    if (!log.length) return
    const ml = log[log.length - 1]
    g({agua: Math.max(0, (+h.agua || 0) - ml), aguaLog: log.slice(0, -1)})
  }
  const resumenCk = checkinHecho(h) ? 'Hecho ✓' : '20 segundos'
  return (
    <div className="bento hoy">
      <Preparacion h={h} />
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
          <small className="mu hoy-nota">🎥 Videos sin marcar como grabados (14 días): {videos.length}</small>
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
          onClick={() => setAguaAb(v => !v)}
        >
          <span className="eti">Agua</span>
          <b className="mono tesela-v">{fmtVal(h.agua, {dec: 0})}</b>
          <small className="mu">de {meta} ml</small>
        </button>
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
              ↶ Deshacer{log.length ? ` ${log[log.length - 1]}` : ''}
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
            <button
              className="ghost"
              disabled={!h.agua}
              onClick={() => confirm('¿Poner el agua de hoy en 0?') && g({agua: 0, aguaLog: []})}
            >
              Reiniciar
            </button>
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
            </div>
          ))}
          <small className="mu ck-leyenda">
            {CHECKIN.map(c => `${c.n}: 1 ${c.bajo} · 5 ${c.alto}`).join(' — ')}
          </small>
          <div className="ck-sueno">
            <b className="ck-n">Sueño</b>
            <input
              className="fx"
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="horas"
              aria-label="Horas de sueño de anoche"
              value={h.sueno}
              onChange={e => g({sueno: e.target.value})}
            />
            <input
              type="range"
              min="1"
              max="5"
              value={hayDato(h.calidad) ? h.calidad : 3}
              aria-label="Calidad del sueño"
              onChange={e => g({calidad: +e.target.value})}
            />
            <output className="mono" aria-live="polite">
              {fmtVal(h.calidad, {dec: 0})}/5
            </output>
          </div>
        </section>
      </Pleg>
      <Pleg id="hoy-mas" titulo="Actividad y cuerpo" resumen="Pasos, rutas, medidas" abierto={masAb} onCambio={setMasAb}>
        <ActividadFisica onVerRutas={onRutas} />
        <TarjetaCuerpo />
      </Pleg>
    </div>
  )
}
