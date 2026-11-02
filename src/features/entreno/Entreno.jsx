import {useState, useEffect, useSyncExternalStore} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {chica} from '../../services/img'
import {pedirIA} from '../../services/ia'
import {tomarFoto} from '../../services/pendiente'
import {volumen, repsTot, marcarPorContexto, sg} from '../../domain/stats'
import {TIPOS as T, CON_RELOJ, POR_EJERCICIO, aSegundos, mmss, resumenReloj} from '../../domain/temporizador'
import {
  iniciar as iniciarReloj,
  cerrar as cerrarReloj,
  suscribir,
  version,
  estado
} from '../../services/reloj'
import {Timer, BarraReloj} from './Timer'
import {
  ultimaSesion,
  sesionDesdeUltima,
  resumenSesion,
  rutinaDesdeSesion,
  sesionDesdeRutina,
  fusionarRutina,
  rpeSugerido,
  seriePesada,
  validarSeriePesada,
  bloqueConVideo,
  llevaVideo,
  claveEjercicio,
  pideCargas,
  lecturaASesion,
  revisionLectura,
  confirmarLectura,
  hayCarga,
  textoUltima,
  valoresDeUltima,
  elegirUltima,
  aplicarUltimas,
  ordenEntrada
} from '../../domain/entreno'

const P =
  'Sos entrenador. Lee la pizarra de entrenamiento (español rioplatense) y devolve SOLO JSON: {"bloques":[{"tipo":"movilidad|warmup|emom|amrap|tabata|forTime","nombre":"","minutos":0,"ejercicios":[""]}]}. Abreviaturas: ext.=extension, lat.=lateral, rev.=reversa, uni=unilateral, LM=landmine, SQ=sentadilla, iso=isometrico. Si un ejercicio tiene asterisco azul agrega "*" al final. Respeta las cantidades (ej "10 lagartijas"). Si dudas de una lectura, escribila igual y agrega "?".'
const key = claveEjercicio
const sinRevisar = x => {
  const {revisar, ...r} = x
  return r
}
const leerEntrada = () => {
  try {
    return localStorage.getItem('mv_entrada')
  } catch {
    return null
  }
}
const recordarEntrada = o => {
  try {
    localStorage.setItem('mv_entrada', o)
  } catch {}
}
// Último registro de cada ejercicio del bloque (clave → registro), para «igual que la última».
async function ultimasDeBloque(b) {
  const m = {}
  for (const e of b.ejercicios || []) {
    const k = key(e)
    if (!k || !String(e).trim() || m[k]) continue
    const u = elegirUltima(await db.registros.where('clave').equals(k).toArray(), b.tipo)
    if (u) m[k] = u
  }
  return m
}
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
function Fila({t, tipo, v, set}) {
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
      .then(a => setU(elegirUltima(a, tipo)))
  }, [k, tipo])
  const hay = hayCarga(x),
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
      inputMode="numeric"
      placeholder={ph}
      value={x[f] ?? ''}
      onChange={e => p({[f]: e.target.value})}
    />
  )
  const extra = [x.uni ? 'I/D' : '', x.pkg || x.preps ? `serie pesada ${x.pkg || '?'}×${x.preps || '?'}` : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="fila">
      <div className="row" style={{justifyContent: 'space-between', marginTop: 0}}>
        <b>{t}</b>
        {u && !hay && (
          <button
            className="igual"
            aria-label={`Igual que la última vez: ${textoUltima(u)}`}
            onClick={() => set({...x, ...valoresDeUltima(u)})}
          >
            ✓ Igual · {textoUltima(u)}
          </button>
        )}
      </div>
      <div className="row">
        <button className="ghost mini" onClick={() => n(-0.5)}>
          −
        </button>
        <input
          type="number"
          step=".5"
          inputMode="decimal"
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
      </div>
      {dl && <small className={'delta ' + dl.c}>vs última: {dl.t}</small>}
      <details>
        <summary className="tag">Más{extra ? ' · ' + extra : ''}</summary>
        <div className="row">
          <button className="ghost mini" onClick={() => p({uni: !x.uni})}>
            {x.uni ? 'Volver a un solo lado' : '↔ Izquierda / derecha'}
          </button>
        </div>
        <div className="row">
          <input
            type="number"
            step=".5"
            inputMode="decimal"
            placeholder="kg"
            aria-label="kg de la serie pesada"
            value={x.pkg ?? ''}
            onChange={e => p({pkg: e.target.value})}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="reps"
            aria-label="repeticiones de la serie pesada"
            value={x.preps ?? ''}
            onChange={e => p({preps: e.target.value})}
          />
          <small className="tag">Serie pesada (opcional)</small>
        </div>
        <small className="mu">La serie más cargada: mejora el 1RM estimado. El volumen sale del resumen de arriba.</small>
        {u && hay && (
          <small className="tag" style={{display: 'block'}} onClick={() => set({...x, ...valoresDeUltima(u)})}>
            Última: {textoUltima(u)} · tocá para usar
          </small>
        )}
      </details>
    </div>
  )
}
export default function Entreno() {
  const [s, setS] = useState(() => JSON.parse(localStorage.getItem('mv_sesion') || 'null')),
    [msg, setMsg] = useState(''),
    [mini, setMini] = useState(false),
    [rpe, setRpe] = useState(7),
    [fx, setFx] = useState(null),
    [foto, setFoto] = useState(null),
    [zoom, setZoom] = useState(false),
    [corregir, setCorregir] = useState(false),
    [aviso, setAviso] = useState(''),
    [sinReg, setSinReg] = useState(null),
    [ult, setUlt] = useState(null),
    [rutinas, setRutinas] = useState([]),
    [nomRutina, setNomRutina] = useState(''),
    [ultimaEntrada] = useState(leerEntrada)
  const cargarEntradas = async () => {
    setUlt(ultimaSesion(await db.sesiones.orderBy('fecha').reverse().limit(10).toArray()))
    setRutinas((await db.rutinas.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
  }
  useEffect(() => {
    if (!s) cargarEntradas()
  }, [s === null])
  useEffect(() => {
    // miniatura de la foto para compararla con lo que leyó la IA (solo en memoria)
    if (!fx) return setFoto(null)
    const u = URL.createObjectURL(fx)
    setFoto(u)
    return () => URL.revokeObjectURL(u)
  }, [fx])
  useSyncExternalStore(suscribir, version) // se redibuja cuando cambia el reloj
  const activo = estado()
  const save = n => {
    setS(n)
    if (!n) {
      setCorregir(false)
      setZoom(false)
      setAviso('')
      setSinReg(null)
    }
    if (n) localStorage.setItem('mv_sesion', JSON.stringify(n))
    else localStorage.removeItem('mv_sesion')
  }
  const up = (i, p) => save({...s, bloques: s.bloques.map((b, j) => (j === i ? {...b, ...p} : b))})
  const run = async x => {
    if (!cfg('key')) return setMsg('Cargá tu clave de IA en Ajustes')
    setFx(x)
    setMsg('Leyendo pizarra…')
    try {
      const lectura = lecturaASesion(await escanear(x, setMsg))
      save({...lectura, revisar: true})
      recordarEntrada('pizarra')
      setMsg('')
    } catch (err) {
      setMsg('No pude leerla: ' + err.message)
    }
  }
  useEffect(() => {
    // foto elegida con el botón 📷 de «Hoy»
    const f = tomarFoto()
    if (f && !s) run(f)
  }, [])
  const scan = e => {
    const x = e.target.files[0]
    e.target.value = ''
    if (x) run(x)
  }
  const fin = async () => {
    for (const b of s.bloques)
      for (const [j, e] of (b.ejercicios || []).entries()) {
        const err = validarSeriePesada(b.reg?.[j])
        if (err) return setMsg(`${e.replace(/[*?]/g, '').trim() || 'Ejercicio'}: ${err}`)
      }
    const fecha = hoy(),
      sid = await db.sesiones.add({fecha, rpe, bloques: s.bloques}),
      R = [],
      E = []
    s.bloques.forEach(b =>
      (b.ejercicios || []).forEach((e, j) => {
        const x = b.reg?.[j],
          c = key(e)
        const sp = seriePesada(x)
        if (!x || !c || !(+x.kg || +x.reps || +x.repsL || +x.repsR || sp)) return
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
          tiempo: +b.tiempo || 0,
          ...(sp ? {pkg: sp.kg, preps: sp.reps} : {}),
          ...(+b.rpe >= 1 && +b.rpe <= 10 ? {rpeBloque: +b.rpe} : {}),
          ...(llevaVideo(e) && b.video ? {video: true} : {})
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
  const empezar = (n, origen) => {
    setMsg('')
    if (origen) recordarEntrada(origen)
    save(n)
  }
  if (!s) {
    const secciones = {
      ultima: ult && (
        <section key="ultima">
          <h3>Repetir la última</h3>
          <button style={{width: '100%'}} onClick={() => empezar(sesionDesdeUltima(ult), 'ultima')}>
            ↻ Repetir la última sesión
            <small style={{display: 'block', fontWeight: 400}}>
              {ult.fecha} · {resumenSesion(ult)}
            </small>
          </button>
          <p className="mu" style={{margin: '8px 0 0'}}>
            Copia los bloques y ejercicios; los pesos y repeticiones los cargás vos.
          </p>
        </section>
      ),
      plantillas: rutinas.length > 0 && (
        <section key="plantillas">
          <h3>Mis plantillas</h3>
          {rutinas.map(r => (
            <div className="fila" key={r.id}>
              <div className="row" style={{justifyContent: 'space-between'}}>
                <div>
                  <b>{r.nombre}</b>
                  <small className="mu" style={{display: 'block'}}>
                    {resumenSesion(r)}
                  </small>
                </div>
                <div className="row">
                  <button onClick={() => empezar(sesionDesdeRutina(r), 'plantilla')}>Usar</button>
                  <button
                    className="ghost mini"
                    aria-label={`Borrar la plantilla ${r.nombre}`}
                    onClick={async () => {
                      if (!confirm(`¿Borrar la plantilla «${r.nombre}»? Tus sesiones y registros no se tocan.`)) return
                      await db.rutinas.delete(r.id)
                      cargarEntradas()
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ),
      pizarra: (
        <section key="pizarra">
          <h3>Pizarra → sesión</h3>
          <label>
            <button style={{width: '100%'}} onClick={e => e.currentTarget.nextSibling.click()}>
              📷 Foto de la pizarra
            </button>
            <input hidden type="file" accept="image/*" onChange={scan} />
          </label>
          <p>{msg}</p>
          {fx && msg.startsWith('No pude') && (
            <p>
              <button onClick={() => run(fx)}>🔁 Reintentar con la misma foto</button>
            </p>
          )}
          <button className="ghost" onClick={() => empezar({bloques: []}, 'manual')}>
            Sesión manual
          </button>
        </section>
      )
    }
    return <>{ordenEntrada(ultimaEntrada).map(k => secciones[k])}</>
  }
  if (s.revisar) {
    const R = revisionLectura(s.bloques)
    return (
      <section>
        <h3>Revisá lo que leí</h3>
        {foto && (
          <>
            <img
              className={'foto' + (zoom ? ' grande' : '')}
              src={foto}
              alt="Foto de la pizarra"
              onClick={() => setZoom(!zoom)}
            />
            <small className="mu" style={{display: 'block'}}>
              Tocá la foto para {zoom ? 'achicarla' : 'ampliarla'} y compararla.
            </small>
          </>
        )}
        {R.vacia ? (
          <p role="status">No pude leer ejercicios en esa foto. Probá con otra foto o armá la sesión a mano.</p>
        ) : (
          <p className="mu">
            {R.bloques.length} {R.bloques.length === 1 ? 'bloque' : 'bloques'} · {R.nEjercicios}{' '}
            {R.nEjercicios === 1 ? 'ejercicio' : 'ejercicios'}
            {R.nDudas > 0 && ` · ${R.nDudas} con duda`}
            {R.nVideos > 0 && ` · ${R.nVideos} con 🎥`}
          </p>
        )}
        {R.bloques.map((b, i) => (
          <div className="fila" key={i}>
            <b>
              {T[b.tipo] || b.tipo}
              {b.minutos ? ` · ${b.minutos} min` : ''}
            </b>
            {b.ejercicios.length ? (
              <ul className="lect">
                {b.ejercicios.map((e, j) => (
                  <li key={j} className={e.duda ? 'duda' : ''}>
                    {e.texto}
                    {e.video && ' 🎥'}
                    {e.duda && <span> ⚠ dudosa</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <small className="mu" style={{display: 'block'}}>
                Sin ejercicios leídos.
              </small>
            )}
          </div>
        ))}
        {msg && (
          <p role="status" style={{margin: '8px 0'}}>
            {msg}
          </p>
        )}
        {!R.vacia && (
          <button
            className="cta"
            style={{marginTop: 12}}
            onClick={() => {
              setMsg('')
              save({...sinRevisar(s), bloques: confirmarLectura(s.bloques)})
            }}
          >
            ✓ Está bien, entrenar
          </button>
        )}
        <div className="row">
          {!R.vacia && (
            <button
              className="ghost"
              onClick={() => {
                setMsg('')
                setCorregir(true)
                save(sinRevisar(s))
              }}
            >
              Corregir
            </button>
          )}
          {R.vacia && <button onClick={() => save({bloques: []})}>Sesión manual</button>}
          {fx && (
            <button
              className="ghost"
              onClick={() => {
                save(null)
                run(fx)
              }}
            >
              🔁 Leer de nuevo
            </button>
          )}
          <button className="ghost" onClick={() => save(null)}>
            Descartar
          </button>
        </div>
      </section>
    )
  }
  const igualBloque = async i => {
    const b = s.bloques[i],
      r = aplicarUltimas(b, await ultimasDeBloque(b))
    setSinReg(r.n ? null : i)
    if (r.n) up(i, {reg: r.reg})
  }
  const igualSesion = async () => {
    let n = 0
    const bs = []
    for (const b of s.bloques) {
      if (!pideCargas(b)) {
        bs.push(b)
        continue
      }
      const r = aplicarUltimas(b, await ultimasDeBloque(b))
      n += r.n
      bs.push(r.n ? {...b, reg: r.reg} : b)
    }
    if (n) save({...s, bloques: bs})
    setAviso(
      n
        ? `✓ Completé ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'} con tu última vez. Ajustá lo que cambió.`
        : 'No encontré registros anteriores de estos ejercicios.'
    )
  }
  const guardarRutina = async () => {
    try {
      const nueva = rutinaDesdeSesion(nomRutina, s.bloques),
        ya = await db.rutinas.where('clave').equals(nueva.clave).first()
      if (ya && !confirm(`Ya hay una plantilla «${ya.nombre}». ¿Reemplazarla con esta sesión?`)) return
      await db.rutinas.put(fusionarRutina(nueva, ya))
      setMsg(ya ? `✅ Plantilla «${nueva.nombre}» actualizada.` : `✅ Plantilla «${nueva.nombre}» guardada.`)
      setNomRutina('')
    } catch (err) {
      setMsg(err.message)
    }
  }
  const rs = rpeSugerido(s.bloques),
    hayCargas = s.bloques.some(b => pideCargas(b) && (b.ejercicios || []).some(x => x.trim()))
  return (
    <>
      {activo && mini && <BarraReloj onAbrir={() => setMini(false)} />}
      {hayCargas && (
        <section>
          <button style={{width: '100%'}} onClick={igualSesion}>
            ✓ Todo igual que la última vez
            <small style={{display: 'block', fontWeight: 400}}>Completa solo lo que falta; después ajustás lo que cambió.</small>
          </button>
          {aviso && (
            <p role="status" style={{margin: '8px 0 0'}}>
              {aviso}
            </p>
          )}
        </section>
      )}
      {s.bloques.map((b, i) => {
        const filas = (b.ejercicios || []).map(
          (e, j) =>
            e.trim() && <Fila key={j} t={e} tipo={b.tipo} v={b.reg?.[j]} set={r => up(i, {reg: {...b.reg, [j]: r}})} />
        )
        const hayEj = (b.ejercicios || []).some(x => x.trim())
        return (
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
            <details open={corregir}>
              <summary className="tag">Editar ejercicios</summary>
              <textarea
                value={(b.ejercicios || []).join('\n')}
                onChange={e => up(i, {ejercicios: e.target.value.split('\n')})}
              />
            </details>
            {pideCargas(b) ? (
              filas
            ) : (
              <>
                <ul className="lect">
                  {(b.ejercicios || []).filter(x => x.trim()).map((e, j) => <li key={j}>{e}</li>)}
                </ul>
                {resumenReloj(b) && (
                  <small className="mu" style={{display: 'block'}}>
                    ⏱ {resumenReloj(b)} · tocá ▶ para el reloj
                  </small>
                )}
                {hayEj && (
                  <details>
                    <summary className="tag">Anotar cargas (opcional)</summary>
                    {filas}
                  </details>
                )}
              </>
            )}
            {b.tipo === 'tabata' && hayEj && (
              <small className="mu" style={{display: 'block'}}>
                ⏱ {resumenReloj(b)} · los ejercicios se alternan, uno por ronda
              </small>
            )}
            {pideCargas(b) && hayEj && (
              <div className="row">
                <button className="ghost mini" onClick={() => igualBloque(i)}>
                  ✓ Igual que la última
                </button>
                {sinReg === i && <small className="mu">Sin registros anteriores.</small>}
              </div>
            )}
            {['amrap', 'forTime'].includes(b.tipo) && (
              <div className="row">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="rondas"
                  value={b.rondas ?? ''}
                  onChange={e => up(i, {rondas: e.target.value})}
                />
                <input
                  type="number"
                  inputMode="numeric"
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
            {b.tipo === 'emom' && (
              <div className="row">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="min completados"
                  value={b.minOk ?? ''}
                  onChange={e => up(i, {minOk: e.target.value})}
                />
              </div>
            )}
            {bloqueConVideo(b) && (
              <label className="row" style={{gap: 8}}>
                <input
                  type="checkbox"
                  checked={!!b.video}
                  onChange={e => up(i, {video: e.target.checked})}
                  style={{width: 24, height: 24}}
                />
                <span>🎥 Video grabado (los ejercicios con * piden grabar en clase)</span>
              </label>
            )}
            <details>
              <summary className="tag">
                Más del bloque{b.rpe ? ` · RPE ${b.rpe}` : ''}
              </summary>
              <div className="row">
                <label className="campo">
                  RPE del bloque (1–10)
                  <input
                    type="number"
                    min="1"
                    max="10"
                    inputMode="numeric"
                    placeholder="opcional"
                    value={b.rpe ?? ''}
                    onChange={e => up(i, {rpe: e.target.value})}
                  />
                </label>
              </div>
              {b.tipo === 'emom' && (
                <div className="row">
                  <label className="campo">
                    cada (seg)
                    <input
                      type="number"
                      placeholder="60"
                      value={b.intervalo ?? ''}
                      onChange={e => up(i, {intervalo: e.target.value})}
                    />
                  </label>
                </div>
              )}
              {POR_EJERCICIO.includes(b.tipo) && (
                <div className="row">
                  <label className="campo">
                    segundos por ejercicio
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="40"
                      value={b.trab ?? ''}
                      onChange={e => up(i, {trab: e.target.value})}
                    />
                  </label>
                  <label className="campo">
                    vueltas
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="2"
                      value={b.vueltas ?? ''}
                      onChange={e => up(i, {vueltas: e.target.value})}
                    />
                  </label>
                  <label className="campo">
                    cambio (seg)
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={b.desc ?? ''}
                      onChange={e => up(i, {desc: e.target.value})}
                    />
                  </label>
                </div>
              )}
              {b.tipo === 'tabata' && (
                <div className="row">
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
                </div>
              )}
            </details>
          </section>
        )
      })}
      <button
        className="ghost"
        onClick={() =>
          save({...s, bloques: [...s.bloques, {tipo: 'amrap', minutos: 10, ejercicios: []}]})
        }
      >
        + Bloque
      </button>
      <section style={{marginTop: 12}}>
        <h3>RPE de la sesión: {rpe}/10</h3>
        <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(+e.target.value)} />
        {rs !== null && rs !== rpe && (
          <div className="row">
            <small className="mu">Según el RPE de tus bloques: {rs}/10.</small>
            <button className="ghost mini" onClick={() => setRpe(rs)}>
              Usar {rs}
            </button>
          </div>
        )}
        <details>
          <summary className="tag">Guardar como plantilla</summary>
          <div className="row">
            <input
              type="text"
              placeholder="nombre (ej. Lunes fuerza)"
              maxLength={60}
              value={nomRutina}
              onChange={e => setNomRutina(e.target.value)}
              style={{flex: 1, minWidth: 160}}
            />
            <button className="ghost" onClick={guardarRutina}>
              Guardar
            </button>
          </div>
          <small className="mu">Guarda los bloques y ejercicios, sin pesos ni repeticiones.</small>
        </details>
        {msg && (
          <p role="status" style={{margin: '8px 0'}}>
            {msg}
          </p>
        )}
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
