import {useState, useEffect, useSyncExternalStore} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {chica} from '../../services/img'
import {pedirIA} from '../../services/ia'
import {volumen, repsTot, marcarPorContexto, sg} from '../../domain/stats'
import {TIPOS as T, CON_RELOJ, aSegundos, mmss} from '../../domain/temporizador'
import {
  iniciar as iniciarReloj,
  cerrar as cerrarReloj,
  suscribir,
  version,
  estado
} from '../../services/reloj'
import {Timer, BarraReloj} from './Timer'

const P =
  'Sos entrenador. Lee la pizarra de entrenamiento (español rioplatense) y devolve SOLO JSON: {"bloques":[{"tipo":"movilidad|warmup|emom|amrap|tabata|forTime","nombre":"","minutos":0,"ejercicios":[""]}]}. Abreviaturas: ext.=extension, lat.=lateral, rev.=reversa, uni=unilateral, LM=landmine, SQ=sentadilla, iso=isometrico. Si un ejercicio tiene asterisco azul agrega "*" al final. Respeta las cantidades (ej "10 lagartijas"). Si dudas de una lectura, escribila igual y agrega "?".'
const key = s =>
  s
    .replace(/[\d*?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
async function escanear(file, prog) {
  const d = await chica(file)
  const cuerpo = JSON.stringify({
    contents: [{parts: [{text: P}, {inline_data: {mime_type: 'image/jpeg', data: d}}]}],
    generationConfig: {responseMimeType: 'application/json'}
  })
  const r = await pedirIA({
    modelos: [cfg('modelo', 'gemini-3.8-flash'), 'gemini-flash-latest'],
    key: cfg('key'),
    cuerpo,
    prog
  })
  await db.uso.add({fecha: hoy(), fn: 'pizarra'})
  return r
}
function Fila({t, v, set}) {
  const k = key(t),
    [u, setU] = useState(null),
    x = v || {},
    p = o => set({...x, ...o}),
    n = d => p({kg: Math.max(0, +((+x.kg || 0) + d).toFixed(1))})
  useEffect(() => {
    db.registros
      .where('clave')
      .equals(k)
      .toArray()
      .then(a => a.length && setU(a[a.length - 1]))
  }, [k])
  const hay = !!(x.kg || x.reps || x.repsL || x.repsR),
    dl = (() => {
      if (!u || !hay) return null
      const dk = +((+x.kg || 0) - (+u.kg || 0)).toFixed(1),
        A = volumen(x),
        B = volumen(u),
        dr = repsTot(x) - repsTot(u),
        p = []
      if (dk) p.push(sg(dk) + ' kg')
      if (A > 0 && B > 0) {
        const d = Math.round(((A - B) / B) * 100)
        p.push('vol ' + sg(d) + '%')
        return {t: p.join(' · '), c: d > 0 ? 'up' : d < 0 ? 'down' : ''}
      }
      if (dr) p.push(sg(dr) + ' reps')
      return {
        t: p.join(' · ') || 'igual',
        c: dk > 0 || dr > 0 ? 'up' : dk < 0 || dr < 0 ? 'down' : ''
      }
    })()
  const I = (f, ph) => (
    <input
      type="number"
      placeholder={ph}
      value={x[f] ?? ''}
      onChange={e => p({[f]: e.target.value})}
    />
  )
  return (
    <div className="fila">
      <div>{t}</div>
      <div className="row">
        <button className="ghost mini" onClick={() => n(-0.5)}>
          −
        </button>
        <input
          type="number"
          step=".5"
          placeholder="kg"
          value={x.kg ?? ''}
          onChange={e => p({kg: e.target.value})}
        />
        <button className="ghost mini" onClick={() => n(0.5)}>
          +
        </button>
        {x.uni ? (
          <>
            {I('repsL', 'reps I')}
            {I('repsR', 'reps D')}
          </>
        ) : (
          I('reps', 'reps')
        )}
        <button className="ghost mini" onClick={() => p({uni: !x.uni})}>
          {x.uni ? 'I/D' : '↔'}
        </button>
      </div>
      {u && (
        <small
          className="tag"
          onClick={() => set({kg: u.kg, reps: u.reps, repsL: u.repsL, repsR: u.repsR, uni: u.uni})}
        >
          Última: {u.kg} kg × {u.uni ? `${u.repsL}/${u.repsR}` : u.reps} · tocá para usar
        </small>
      )}
      {dl && <small className={'delta ' + dl.c}>vs última: {dl.t}</small>}
    </div>
  )
}
export default function Entreno() {
  const [s, setS] = useState(() => JSON.parse(localStorage.getItem('mv_sesion') || 'null')),
    [msg, setMsg] = useState(''),
    [mini, setMini] = useState(false),
    [rpe, setRpe] = useState(7),
    [fx, setFx] = useState(null)
  useSyncExternalStore(suscribir, version) // se redibuja cuando cambia el reloj
  const activo = estado()
  const save = n => {
    setS(n)
    localStorage.setItem('mv_sesion', JSON.stringify(n))
  }
  const up = (i, p) => save({...s, bloques: s.bloques.map((b, j) => (j === i ? {...b, ...p} : b))})
  const run = async x => {
    if (!cfg('key')) return setMsg('Cargá tu clave de IA en Ajustes')
    setFx(x)
    setMsg('Leyendo pizarra…')
    try {
      save(await escanear(x, setMsg))
      setMsg('')
    } catch (err) {
      setMsg('No pude leerla: ' + err.message)
    }
  }
  const scan = e => {
    const x = e.target.files[0]
    e.target.value = ''
    if (x) run(x)
  }
  const fin = async () => {
    const fecha = hoy(),
      sid = await db.sesiones.add({fecha, rpe, bloques: s.bloques}),
      R = [],
      E = []
    s.bloques.forEach(b =>
      (b.ejercicios || []).forEach((e, j) => {
        const x = b.reg?.[j],
          c = key(e)
        if (!x || !c || !(+x.kg || +x.reps || +x.repsL || +x.repsR)) return
        R.push({
          fecha,
          sesionId: sid,
          clave: c,
          nombre: e,
          tipo: b.tipo,
          kg: +x.kg || 0,
          reps: +x.reps || 0,
          repsL: +x.repsL || 0,
          repsR: +x.repsR || 0,
          uni: !!x.uni,
          rondas: +b.rondas || 0,
          extra: +b.extra || 0,
          minOk: +b.minOk || 0,
          tiempo: +b.tiempo || 0
        })
        E.push({clave: c, nombre: e, uni: !!x.uni})
      })
    )
    await db.registros.bulkAdd(R)
    const pv = await db.ejercicios.bulkGet(E.map(e => e.clave))
    await db.ejercicios.bulkPut(E.map((e, i) => ({...pv[i], ...e})))
    const todos = await db.registros.toArray(),
      M = marcarPorContexto(todos),
      nuevos = todos.filter(r => r.sesionId === sid && M[r.id]?.flags.length)
    setMsg(
      '✅ Sesión guardada.' +
        (nuevos.length
          ? ' 🏆 Récords: ' +
            nuevos
              .map(r => `${r.nombre.replace(/[*?]/g, '').trim()} (${M[r.id].flags.join(', ')})`)
              .join(' · ')
          : '')
    )
    save(null)
  }
  const cerrarTimer = () => {
    const r = cerrarReloj()
    setMini(false)
    if (r && s && s.bloques[r.bi])
      up(r.bi, {
        ...(r.rondas > 0 ? {rondas: r.rondas} : {}),
        ...(r.tiempo > 0 ? {tiempo: r.tiempo} : {})
      })
  }
  const lanzar = (b, i) => {
    if (activo && !confirm('Ya hay un temporizador activo. ¿Reemplazarlo?')) return
    iniciarReloj(b, i)
    setMini(false)
  }
  if (activo && !mini) return <Timer onCerrar={cerrarTimer} onMinimizar={() => setMini(true)} />
  if (!s)
    return (
      <section>
        <h3>Pizarra → sesión</h3>
        <label>
          <button onClick={e => e.currentTarget.nextSibling.click()}>📷 Foto de la pizarra</button>
          <input hidden type="file" accept="image/*" onChange={scan} />
        </label>
        <p>{msg}</p>
        {fx && msg.startsWith('No pude') && (
          <p>
            <button onClick={() => run(fx)}>🔁 Reintentar con la misma foto</button>
          </p>
        )}
        <button className="ghost" onClick={() => save({bloques: []})}>
          Sesión manual
        </button>
      </section>
    )
  return (
    <>
      {activo && mini && <BarraReloj onAbrir={() => setMini(false)} />}
      {s.bloques.map((b, i) => (
        <section key={i}>
          <div className="row">
            <select value={b.tipo} onChange={e => up(i, {tipo: e.target.value})}>
              {Object.entries(T).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={b.minutos || ''}
              placeholder="min"
              onChange={e => up(i, {minutos: +e.target.value})}
            />
            {CON_RELOJ.includes(b.tipo) && <button onClick={() => lanzar(b, i)}>▶</button>}
          </div>
          <details>
            <summary className="tag">Editar ejercicios</summary>
            <textarea
              value={(b.ejercicios || []).join('\n')}
              onChange={e => up(i, {ejercicios: e.target.value.split('\n')})}
            />
          </details>
          {(b.ejercicios || []).map(
            (e, j) =>
              e.trim() && (
                <Fila key={j} t={e} v={b.reg?.[j]} set={r => up(i, {reg: {...b.reg, [j]: r}})} />
              )
          )}
          {['amrap', 'forTime'].includes(b.tipo) && (
            <div className="row">
              <input
                type="number"
                placeholder="rondas"
                value={b.rondas ?? ''}
                onChange={e => up(i, {rondas: e.target.value})}
              />
              <input
                type="number"
                placeholder="reps extra"
                value={b.extra ?? ''}
                onChange={e => up(i, {extra: e.target.value})}
              />
            </div>
          )}
          {b.tipo === 'forTime' && (
            <div className="row">
              <label className="campo">
                tiempo (mm:ss)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="mm:ss"
                  key={b.tiempo || 0}
                  defaultValue={b.tiempo ? mmss(b.tiempo) : ''}
                  onBlur={e => up(i, {tiempo: aSegundos(e.target.value)})}
                />
              </label>
            </div>
          )}
          {(b.tipo === 'emom' || b.tipo === 'tabata') && (
            <details>
              <summary className="tag">Ajustar tiempos del reloj</summary>
              <div className="row">
                {b.tipo === 'emom' ? (
                  <label className="campo">
                    cada (seg)
                    <input
                      type="number"
                      placeholder="60"
                      value={b.intervalo ?? ''}
                      onChange={e => up(i, {intervalo: e.target.value})}
                    />
                  </label>
                ) : (
                  <>
                    <label className="campo">
                      trabajo (seg)
                      <input
                        type="number"
                        placeholder="20"
                        value={b.trab ?? ''}
                        onChange={e => up(i, {trab: e.target.value})}
                      />
                    </label>
                    <label className="campo">
                      descanso (seg)
                      <input
                        type="number"
                        placeholder="10"
                        value={b.desc ?? ''}
                        onChange={e => up(i, {desc: e.target.value})}
                      />
                    </label>
                    <label className="campo">
                      rondas
                      <input
                        type="number"
                        placeholder="8"
                        value={b.rond ?? ''}
                        onChange={e => up(i, {rond: e.target.value})}
                      />
                    </label>
                  </>
                )}
              </div>
            </details>
          )}
          {b.tipo === 'emom' && (
            <div className="row">
              <input
                type="number"
                placeholder="min completados"
                value={b.minOk ?? ''}
                onChange={e => up(i, {minOk: e.target.value})}
              />
            </div>
          )}
          {b.ejercicios?.some(x => x.includes('*')) && (
            <div className="tag">🎥 Grabar video en clase</div>
          )}
        </section>
      ))}
      <button
        className="ghost"
        onClick={() =>
          save({bloques: [...s.bloques, {tipo: 'amrap', minutos: 10, ejercicios: []}]})
        }
      >
        + Bloque
      </button>
      <section style={{marginTop: 12}}>
        <h3>RPE de la sesión: {rpe}/10</h3>
        <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(+e.target.value)} />
        <div className="row">
          <button onClick={fin}>Terminar y guardar</button>
          <button className="ghost" onClick={() => save(null)}>
            Descartar
          </button>
        </div>
      </section>
    </>
  )
}
