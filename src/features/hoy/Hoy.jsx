import {useState, useEffect} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {ResumenHoy} from '../comidas/Comidas'
import {Preparacion} from '../coach/Coach'

export default function Hoy() {
  const [h, setH] = useState({fecha: hoy(), agua: 0, sueno: '', calidad: 3}),
    [otro, setOtro] = useState(''),
    meta = +cfg('meta', 2500)
  useEffect(() => {
    db.habitos.get(hoy()).then(x => x && setH(x))
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
      <ResumenHoy />
      <Preparacion h={h} />
      <section>
        <h3>Hidratación</h3>
        <div className="big">
          {h.agua}
          <small> / {meta} ml</small>
        </div>
        <div className="bar">
          <i style={{width: Math.min(100, (h.agua / meta) * 100) + '%'}} />
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
            type="number"
            inputMode="numeric"
            placeholder="otra cantidad (ml)"
            style={{width: 170}}
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
      <section>
        <h3>Sueño de anoche</h3>
        <div className="row">
          <input
            type="number"
            step="0.5"
            placeholder="horas"
            value={h.sueno}
            onChange={e => g({sueno: e.target.value})}
          />
          <input
            type="range"
            min="1"
            max="5"
            value={h.calidad}
            onChange={e => g({calidad: +e.target.value})}
          />
          <span>calidad {h.calidad}/5</span>
        </div>
      </section>
    </div>
  )
}
