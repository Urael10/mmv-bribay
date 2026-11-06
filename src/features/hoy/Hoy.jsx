import {useState, useEffect} from 'react'
import {db, hoy, cfg} from '../../data/db'
import FilaAlimentacion from '../comidas/FilaAlimentacion'
import Preparacion from '../coach/Preparacion'
import {TarjetaCuerpo} from '../cuerpo/Cuerpo'
import {CHECKIN} from '../../domain/checkin'
import {AvisoDescarga} from '../progreso/AvisoDescarga'
import {videosPendientes, haySesionEnCurso} from '../../domain/entreno'
import {sumaDias} from '../../domain/stats'
import {fmtVal, hayDato} from '../../domain/formato'
import {dejarFoto} from '../../services/pendiente'
import ActividadFisica from '../actividad/ActividadFisica'
import Icono from '../../ui/Icono'

export default function Hoy({onEmpezar, onComidas, onRutas}) {
  const [h, setH] = useState({fecha: hoy(), agua: 0, sueno: '', calidad: 3}),
    [otro, setOtro] = useState(''),
    [videos, setVideos] = useState([]),
    meta = +cfg('meta', 2500),
    enCurso = haySesionEnCurso(localStorage.getItem('mv_sesion'))
  useEffect(() => {
    db.habitos.get(hoy()).then(x => x && setH(x))
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
  return (
    <div className="bento">
      <div className="col">
        <section className="checkin">
          <h3>Check-in de hoy · 20 segundos</h3>
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
        <Preparacion h={h} />
        <AvisoDescarga />
        <div style={{gridColumn: 'span 2'}}>
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
          <small className="mu" style={{display: 'block', marginTop: -6}}>
            {enCurso ? (
              'Tenés una sesión sin terminar.'
            ) : (
              <>
                Con la cámara <Icono n="camara" tam={14} className="en-texto" /> empezás directo
                desde la foto de la pizarra; también podés repetir la última, usar una plantilla o
                armarla a mano.
              </>
            )}
          </small>
          {videos.length > 0 && (
            <small className="mu" style={{display: 'block', marginTop: 4}}>
              🎥 Videos sin marcar como grabados (14 días): {videos.length}
            </small>
          )}
        </div>
        <FilaAlimentacion onAbrir={onComidas} />
      </div>
      <div className="col">
        <section>
          <h3>Hidratación</h3>
          <div className="big">
            {fmtVal(h.agua, {dec: 0})}
            <small> / {meta} ml</small>
          </div>
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
              placeholder="Otra cantidad (ml)"
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
        <ActividadFisica onVerRutas={onRutas} />
        <TarjetaCuerpo />
      </div>
    </div>
  )
}
