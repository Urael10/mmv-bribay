import {useState, useEffect, useMemo} from 'react'
import {db, hoy} from '../../data/db'
import {Informe} from '../coach/Coach'
import NavFecha from '../../ui/NavFecha'
import TabsDeslizables from '../../ui/TabsDeslizables'
import Pantalla from '../../ui/Pantalla'
import {nombreEjercicio} from '../../domain/formato'
import {claseVariacion} from '../../domain/variacion'
import {VistaCuerpo} from '../cuerpo/Cuerpo'
import {VistaPilares, VistaTests} from './Pilares'
import {
  PATRONES,
  patron,
  repsTot,
  volumen,
  e1rm,
  claveCtx,
  marcarPorContexto,
  mejores,
  lunes,
  sumaDias,
  volumenSemana,
  pct,
  sg,
  EPLEY_MAX
} from '../../domain/stats'
import Icono from '../../ui/Icono'

const T = {
  movilidad: 'Movilidad',
  warmup: 'Warm up',
  emom: 'EMOM',
  amrap: 'AMRAP',
  tabata: 'Tabata',
  forTime: 'For time'
}
const kg = n => String(+(+n).toFixed(1)).replace('.', ',')
const num = n => Math.round(n).toLocaleString('es-UY')
const fFecha = f => {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}
const rango = w => `${fFecha(w).slice(0, 5)} – ${fFecha(sumaDias(w, 6)).slice(0, 5)}`

function Spark({v}) {
  v = v.slice(-20)
  if (v.length < 2) return null
  const mx = Math.max(...v),
    mn = Math.min(...v),
    W = 260,
    H = 48
  const pts = v
    .map(
      (y, i) =>
        `${((i / (v.length - 1)) * W).toFixed(1)},${(H - 4 - (mx === mn ? 0.5 : (y - mn) / (mx - mn)) * (H - 8)).toFixed(1)}`
    )
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Evolución">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Semana({reg, manual, ses}) {
  const [w, setW] = useState(lunes(hoy())),
    [m, setM] = useState('reps')
  const cur = useMemo(() => volumenSemana(reg, manual, w), [reg, manual, w])
  const ant = useMemo(() => volumenSemana(reg, manual, sumaDias(w, -7)), [reg, manual, w])
  const val = (o, p) => (o[p] ? o[p][m] : 0)
  const filas = PATRONES.filter(p => val(cur, p) || val(ant, p))
  const max = Math.max(1, ...filas.map(p => Math.max(val(cur, p), val(ant, p))))
  const sw = ses.filter(s => s.fecha >= w && s.fecha <= sumaDias(w, 6))
  const rpe = sw.length
    ? (sw.reduce((a, s) => a + (+s.rpe || 0), 0) / sw.length).toFixed(1).replace('.', ',')
    : '–'
  const esActual = w === lunes(hoy())
  return (
    <section>
      <h3>Volumen semanal por patrón</h3>
      <NavFecha
        titulo={esActual ? 'Esta semana' : 'Semana'}
        sub={rango(w)}
        anteriorLabel="Semana anterior"
        siguienteLabel="Semana siguiente"
        sinSiguiente={esActual}
        onAnterior={() => setW(sumaDias(w, -7))}
        onSiguiente={() => setW(sumaDias(w, 7))}
      />
      <div className="row" style={{margin: '10px 0'}}>
        <button className={'chip' + (m === 'reps' ? ' on' : '')} onClick={() => setM('reps')}>
          Repeticiones
        </button>
        <button className={'chip' + (m === 'ton' ? ' on' : '')} onClick={() => setM('ton')}>
          Tonelaje (kg)
        </button>
      </div>
      <small className="mu">
        {sw.length} {sw.length === 1 ? 'sesión' : 'sesiones'} · RPE medio {rpe}
      </small>
      {!filas.length && <p className="mu">Sin registros de pesos y repeticiones en esta semana.</p>}
      {filas.map(p => {
        const a = val(cur, p),
          b = val(ant, p),
          d = pct(a, b)
        return (
          <div key={p} className="fila">
            <div className="row" style={{justifyContent: 'space-between'}}>
              <span>{p}</span>
              <span>
                <b className="mono">{num(a)}</b>
                {d !== null ? (
                  <small className={claseVariacion(d, {neutra: esActual})}>
                    {' '}
                    {sg(d)}%
                  </small>
                ) : b === 0 && a > 0 ? (
                  <small className="tag"> nuevo</small>
                ) : null}
              </span>
            </div>
            <div className="bar">
              <i style={{width: (a / max) * 100 + '%'}} />
            </div>
            {b > 0 && (
              <div className="bar ghostbar">
                <i style={{width: (b / max) * 100 + '%'}} />
              </div>
            )}
          </div>
        )
      })}
      {filas.length > 0 && (
        <small className="mu">
          Barra cian: esta semana · barra gris: semana anterior. El % compara con la semana
          anterior{esActual ? ' y va en gris mientras la semana sigue en curso' : ''}.
        </small>
      )}
    </section>
  )
}

function Historial({ses, reg, marcas, recargar}) {
  const por = useMemo(() => {
    const o = {}
    for (const r of reg) (o[r.sesionId] || (o[r.sesionId] = [])).push(r)
    return o
  }, [reg])
  const borrar = async s => {
    if (!confirm('¿Borrar esta sesión y sus registros? No se puede deshacer.')) return
    await db.registros.filter(r => r.sesionId === s.id).delete()
    await db.sesiones.delete(s.id)
    recargar()
  }
  if (!ses.length)
    return (
      <section>
        <h3>Historial</h3>
        <p className="mu">
          Todavía no guardaste sesiones. Se registran con “Terminar y guardar” en Entreno.
        </p>
      </section>
    )
  return (
    <>
      {[...ses].reverse().map(s => {
        const R = por[s.id] || [],
          ton = R.reduce((a, r) => a + volumen(r), 0),
          usados = new Set()
        return (
          <section key={s.id}>
            <details>
              <summary>
                <b>{fFecha(s.fecha)}</b> · RPE {s.rpe ?? '–'} · {(s.bloques || []).length} bloques
                {ton > 0 && (
                  <>
                    {' '}
                    · <span className="mono">{num(ton)}</span> kg
                  </>
                )}
              </summary>
              {(s.bloques || []).map((b, i) => {
                const ex = (b.ejercicios || []).map(e => e.trim()).filter(Boolean)
                const extra = [
                  b.minutos && `${b.minutos} min`,
                  +b.rondas && `${b.rondas} rondas`,
                  +b.extra && `+${b.extra} reps`,
                  +b.minOk && `${b.minOk} min completados`
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div key={i} className="fila">
                    <div>
                      <span className="tag">{T[b.tipo] || b.tipo}</span>{' '}
                      <small className="mu">{extra}</small>
                    </div>
                    {ex.map((e, j) => {
                      const r = R.find(
                        x => String(x.nombre).trim() === e && x.tipo === b.tipo && !usados.has(x.id)
                      )
                      if (r) usados.add(r.id)
                      return (
                        <div key={j} className="lin">
                          <span>{nombreEjercicio(e)}</span>
                          {r ? (
                            <span className="mono">
                              {kg(r.kg)} kg × {r.uni ? `${r.repsL}/${r.repsR}` : r.reps}
                              {(marcas[r.id]?.flags || []).length > 0 && (
                                <span title={marcas[r.id].flags.join(', ')}> <Icono n="trofeo" tam={16} etiqueta="récord" className="en-texto" /></span>
                              )}
                              {(() => {
                                const u = marcas[r.id]?.ult
                                if (!u) return null
                                const a = volumen(r),
                                  b2 = volumen(u),
                                  d = b2 > 0 && a > 0 ? pct(a, b2) : null
                                const dr = repsTot(r) - repsTot(u)
                                return d !== null ? (
                                  <small className={claseVariacion(d)}>
                                    {' '}
                                    {sg(d)}%
                                  </small>
                                ) : dr !== 0 ? (
                                  <small className={claseVariacion(dr)}>
                                    {' '}
                                    {sg(dr)} reps
                                  </small>
                                ) : null
                              })()}
                            </span>
                          ) : (
                            <small className="mu">sin registro</small>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div className="row" style={{marginTop: 10}}>
                <button className="ghost mini" onClick={() => borrar(s)}>
                  Borrar sesión
                </button>
              </div>
            </details>
          </section>
        )
      })}
      <small className="mu">
        <Icono n="trofeo" tam={16} className="en-texto" /> = superaste una marca anterior de ese ejercicio. El % compara el volumen (kg × reps) con
        la vez anterior.
      </small>
    </>
  )
}

function Records({reg, ej, recargar}) {
  const [q, setQ] = useState('')
  const manual = useMemo(
    () => Object.fromEntries(ej.filter(e => e.patron).map(e => [e.clave, e.patron])),
    [ej]
  )
  const lista = useMemo(() => {
    const g = {}
    for (const r of [...reg].sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id
    ))
      (g[claveCtx(r)] || (g[claveCtx(r)] = [])).push(r)
    return Object.entries(g)
      .map(([k, a]) => ({
        k,
        c: a[0].clave,
        a,
        n: a[a.length - 1].nombre,
        p: patron(a[a.length - 1].nombre, a[a.length - 1].tipo, manual[a[0].clave]),
        m: mejores(a)
      }))
      .sort((x, y) => x.n.localeCompare(y.n, 'es'))
  }, [reg, manual])
  const cambiar = async (c, n, p) => {
    const e = await db.ejercicios.get(c)
    await db.ejercicios.put({...(e || {clave: c, nombre: n}), patron: p === 'auto' ? undefined : p})
    recargar()
  }
  const vis = lista.filter(x => x.n.toLowerCase().includes(q.toLowerCase()))
  if (!lista.length)
    return (
      <section>
        <h3>Récords</h3>
        <p className="mu">
          Cuando guardes sesiones con pesos y repeticiones van a aparecer acá tus mejores marcas.
        </p>
      </section>
    )
  return (
    <>
      <section>
        <h3>Récords por ejercicio</h3>
        <input
          style={{width: '100%'}}
          placeholder="Buscar ejercicio"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <small className="mu" style={{display: 'block', marginTop: 8}}>
          1RM estimado con Epley: kg × (1 + reps/30), solo si anotaste {EPLEY_MAX} reps o menos. Con
          más repeticiones (trabajo por tiempo) no se estima. Los récords se separan por tipo de
          bloque (EMOM, AMRAP…): el mismo ejercicio en otro contexto cuenta aparte.
        </small>
      </section>
      {vis.map(({k, c, a, n, p, m}) => {
        const serie = m.e1
          ? a.map(e1rm).filter(Boolean)
          : m.vol
            ? a.map(volumen).filter(Boolean)
            : a.map(repsTot)
        const ult = a[a.length - 1]
        return (
          <section key={k}>
            <details>
              <summary>
                <b>{nombreEjercicio(n)}</b> <small className="tag">{p}</small>{' '}
                <small className="tag">{T[a[a.length - 1].tipo] || a[a.length - 1].tipo}</small>
                <br />
                <small className="mu">
                  {m.carga ? (
                    <>
                      Máx <span className="mono">{kg(m.carga.v)} kg</span>
                      {m.e1 ? (
                        <>
                          {' '}
                          · 1RM est. <span className="mono">{kg(m.e1.v)} kg</span>
                        </>
                      ) : null}
                    </>
                  ) : m.reps ? (
                    <>
                      Máx <span className="mono">{m.reps.v} reps</span> sin carga
                    </>
                  ) : (
                    'Sin datos'
                  )}{' '}
                  · {a.length} {a.length === 1 ? 'registro' : 'registros'}
                </small>
              </summary>
              <Spark v={serie} />
              <small className="mu">
                {m.e1
                  ? 'Evolución del 1RM estimado'
                  : m.vol
                    ? 'Evolución del volumen (kg × reps)'
                    : 'Evolución de repeticiones'}
              </small>
              <div className="lin">
                <span>Carga máxima</span>
                <span className="mono">
                  {m.carga
                    ? `${kg(m.carga.v)} kg × ${repsTot(m.carga.r)} · ${fFecha(m.carga.r.fecha)}`
                    : '–'}
                </span>
              </div>
              <div className="lin">
                <span>1RM estimado</span>
                <span className="mono">
                  {m.e1 ? `${kg(m.e1.v)} kg · ${fFecha(m.e1.r.fecha)}` : '–'}
                </span>
              </div>
              <div className="lin">
                <span>Mejor volumen</span>
                <span className="mono">
                  {m.vol ? `${num(m.vol.v)} kg · ${fFecha(m.vol.r.fecha)}` : '–'}
                </span>
              </div>
              {m.reps && (
                <div className="lin">
                  <span>Máx reps sin carga</span>
                  <span className="mono">
                    {m.reps.v} · {fFecha(m.reps.r.fecha)}
                  </span>
                </div>
              )}
              <div className="lin">
                <span>Última vez</span>
                <span className="mono">
                  {kg(ult.kg)} kg × {repsTot(ult)} · {fFecha(ult.fecha)}
                </span>
              </div>
              <div className="row" style={{marginTop: 8}}>
                <small className="mu">Patrón</small>
                <select value={manual[c] || 'auto'} onChange={e => cambiar(c, n, e.target.value)}>
                  <option value="auto">Automático ({p})</option>
                  {PATRONES.map(x => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </details>
          </section>
        )
      })}
    </>
  )
}

export const PESTANAS = [
  ['pilares', 'Pilares'],
  ['semana', 'Semana'],
  ['historial', 'Historial'],
  ['rutas', 'Rutas'],
  ['records', 'Récords'],
  ['tests', 'Tests'],
  ['cuerpo', 'Cuerpo'],
  ['informe', 'Informe']
]

export default function Progreso({subInicial}) {
  const [d, setD] = useState(null),
    [sub, setSub] = useState(PESTANAS.some(([k]) => k === subInicial) ? subInicial : 'pilares')
  const cargar = async () =>
    setD({
      ses: await db.sesiones.orderBy('fecha').toArray(),
      reg: await db.registros.toArray(),
      ej: await db.ejercicios.toArray()
    })
  useEffect(() => {
    cargar()
  }, [])
  const manual = useMemo(
    () => (d ? Object.fromEntries(d.ej.filter(e => e.patron).map(e => [e.clave, e.patron])) : {}),
    [d]
  )
  const marcas = useMemo(() => (d ? marcarPorContexto(d.reg) : {}), [d])
  if (!d)
    return (
      <section>
        <p className="mu">Cargando…</p>
      </section>
    )
  return (
    <>
      <TabsDeslizables
        etiqueta="Secciones de Progreso"
        items={PESTANAS}
        valor={sub}
        onCambio={setSub}
      />
      {sub === 'pilares' && <VistaPilares />}
      {sub === 'tests' && <VistaTests />}
      {sub === 'semana' && <Semana reg={d.reg} manual={manual} ses={d.ses} />}
      {sub === 'historial' && (
        <Historial ses={d.ses} reg={d.reg} marcas={marcas} recargar={cargar} />
      )}
      {sub === 'rutas' && <Pantalla clave="rutas" nombre="tus rutas" />}
      {sub === 'records' && <Records reg={d.reg} ej={d.ej} recargar={cargar} />}
      {sub === 'cuerpo' && <VistaCuerpo />}
      {sub === 'informe' && <Informe ses={d.ses} reg={d.reg} manual={manual} />}
    </>
  )
}
