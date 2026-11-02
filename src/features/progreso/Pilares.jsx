import {useState, useEffect, useMemo} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {
  pilares,
  descarga,
  cargaSemanalSerie,
  progresiones,
  estadoTests,
  normalizarTest,
  validarTest,
  TEST_DIAS
} from '../../domain/progreso'

const TIPO = {movilidad: 'Movilidad', warmup: 'Warm up', emom: 'EMOM', amrap: 'AMRAP', tabata: 'Tabata', forTime: 'For time'}
const f1 = n => (n === null || n === undefined ? '–' : String(n).replace('.', ','))
const sg = n => (n === null || n === undefined ? '–' : (n > 0 ? '+' : '') + f1(n))
const fF = f => f.split('-').reverse().slice(0, 2).join('/')
const clase = d => 'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')

function Barras({datos}) {
  const W = 280,
    H = 64,
    mx = Math.max(1, ...datos.map(d => d.y)),
    bw = W / datos.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} width="100%" role="img" aria-label="Carga de entrenamiento por semana">
      {datos.map((d, i) => {
        const h = (d.y / mx) * H
        return (
          <g key={d.x}>
            <rect x={i * bw + 3} y={H - h} width={bw - 6} height={Math.max(h, 1)} rx="2" fill="var(--ac)" opacity={i === datos.length - 1 ? 1 : 0.5} />
            <text x={i * bw + bw / 2} y={H + 11} fontSize="8" textAnchor="middle" fill="currentColor" opacity=".6">
              {d.x}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Linea({valores}) {
  if (valores.length < 2) return null
  const mx = Math.max(...valores),
    mn = Math.min(...valores),
    W = 260,
    H = 40
  const pts = valores
    .map((y, i) => `${((i / (valores.length - 1)) * W).toFixed(1)},${(H - 4 - (mx === mn ? 0.5 : (y - mn) / (mx - mn)) * (H - 8)).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Evolución del test">
      <polyline points={pts} fill="none" stroke="var(--ac)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

const Pilar = ({nombre, p, children}) => (
  <section>
    <div className="row" style={{justifyContent: 'space-between'}}>
      <h3 style={{margin: 0}}>{nombre}</h3>
      <small className={clase(p.tono === 'up' ? 1 : p.tono === 'down' ? -1 : 0)}>{p.etiqueta}</small>
    </div>
    {children}
  </section>
)

export function VistaPilares() {
  const [d, setD] = useState(null)
  useEffect(() => {
    ;(async () =>
      setD({
        ses: await db.sesiones.toArray(),
        reg: await db.registros.toArray(),
        hab: await db.habitos.toArray(),
        com: await db.comidas.toArray(),
        med: await db.medidas.toArray(),
        tst: await db.tests.toArray(),
        ej: await db.ejercicios.toArray()
      }))()
  }, [])
  const R = useMemo(() => {
    if (!d) return null
    const manual = Object.fromEntries(d.ej.filter(e => e.patron).map(e => [e.clave, e.patron]))
    const base = {
      fecha: hoy(),
      registros: d.reg,
      sesiones: d.ses,
      habitos: d.hab,
      comidas: d.com,
      medidas: d.med,
      tests: d.tst,
      manual,
      metaAgua: +cfg('meta', 2500) || 2500
    }
    return {p: pilares(base), des: descarga(base), serie: cargaSemanalSerie(base), prog: progresiones(d.reg)}
  }, [d])
  if (!R)
    return (
      <section>
        <p className="mu">Cargando…</p>
      </section>
    )
  const {p, des, serie, prog} = R,
    {fuerza: F, resistencia: Re, composicion: C, habitos: H} = p
  return (
    <>
      {des.sugerir && (
        <section className="warn" role="alert">
          <b>Conviene una semana de descarga</b>
          {des.senales.map(s => (
            <div key={s}>• {s}</div>
          ))}
          <small className="mu">{des.texto}</small>
        </section>
      )}
      <section>
        <h3>Carga de entrenamiento</h3>
        <Barras datos={serie.map(s => ({x: fF(s.desde), y: s.carga}))} />
        <small className="mu">Carga semanal = RPE × minutos de cada sesión. Barra clara: la semana en curso.</small>
      </section>
      <Pilar nombre="Fuerza" p={F}>
        {F.comparables ? (
          <p className="mu">
            {F.comparables} {F.comparables === 1 ? 'ejercicio comparable' : 'ejercicios comparables'}: {F.suben} suben · {F.igual} estables · {F.bajan} bajan (1RM estimado de los últimos 28 días contra los 28 anteriores). Récords de carga en 28 días: {F.records}.
          </p>
        ) : (
          <p className="mu">Con registros de pesos en las últimas 8 semanas aparece acá la comparación. Récords de carga en 28 días: {F.records}.</p>
        )}
      </Pilar>
      <Pilar nombre="Resistencia" p={Re}>
        <p className="mu">
          Repeticiones de cardio en 28 días: <b className="mono">{Re.repsCardio}</b>
          {Re.deltaPct !== null && <small className={clase(Re.deltaPct)}> {sg(Re.deltaPct)}%</small>} · {f1(Re.sesionesPorSemana)} sesiones por semana
          {Re.testsComparados > 0 && ` · ${Re.testsMejoraron} de ${Re.testsComparados} tests de resistencia mejoraron`}.
        </p>
      </Pilar>
      <Pilar nombre="Composición" p={C}>
        <p className="mu">
          Peso: <b className="mono">{f1(C.peso.actual)} kg</b> ({sg(C.peso.delta)} kg en 4 semanas)
          {C.grasa.delta !== null && ` · grasa ${sg(C.grasa.delta)} puntos`}
          {C.musculo.delta !== null && ` · músculo ${sg(C.musculo.delta)} kg`}. Si te sirve para tu objetivo lo decidís vos: acá no se juzga si es «bueno» o «malo».
        </p>
      </Pilar>
      <Pilar nombre="Hábitos" p={H}>
        <p className="mu">
          Últimos 7 días: check-in {H.checkin}/7 · sueño cargado {H.sueno}/7 · agua en meta {H.agua}/7 · comida cargada {H.comida}/7 · {H.entrenos} {H.entrenos === 1 ? 'día' : 'días'} de entreno.
        </p>
      </Pilar>
      <section>
        <h3>Progresión por ejercicio</h3>
        {!prog.length && <p className="mu">Aparece cuando un ejercicio tiene al menos 2 registros con carga en el mismo tipo de bloque.</p>}
        {prog.map(x => (
          <div key={x.clave} className="fila">
            <div>
              <b>{x.nombre}</b> <small className="tag">{TIPO[x.tipo] || x.tipo}</small>
            </div>
            <small className="mu">{x.texto}</small>
          </div>
        ))}
        <small className="mu" style={{display: 'block', marginTop: 8}}>
          Orientaciones de diseño, no indicaciones médicas ni un plan individual.
        </small>
      </section>
    </>
  )
}

const ETIQ = {nunca: 'Todavía no lo hiciste', 'al-dia': 'Al día', toca: 'Toca repetirlo', atrasado: 'Atrasado'}

export function VistaTests() {
  const [t, setT] = useState(null),
    [ab, setAb] = useState(null),
    [v, setV] = useState(''),
    [err, setErr] = useState('')
  const cargar = async () => setT(await db.tests.toArray())
  useEffect(() => {
    cargar()
  }, [])
  if (!t)
    return (
      <section>
        <p className="mu">Cargando…</p>
      </section>
    )
  const E = estadoTests(t, hoy())
  const guardar = async def => {
    const m = normalizarTest({clave: def.k, valor: v}, hoy()),
      e = validarTest(m)
    if (e) return setErr(e)
    await db.tests.add(m)
    setV('')
    setErr('')
    setAb(null)
    cargar()
  }
  const borrar = async id => {
    if (!confirm('¿Borrar este resultado?')) return
    await db.tests.delete(id)
    cargar()
  }
  return (
    <>
      <section>
        <h3>Tests de referencia</h3>
        <p className="mu">
          Repetilos cada {TEST_DIAS.toca / 7} a {TEST_DIAS.tarde / 7} semanas, en condiciones parecidas (mismo horario, descansado y con buena técnica). Muestran tu evolución real más allá de cómo te sientas cada día. Hacelos solo si te sentís bien y frená ante cualquier dolor.
        </p>
      </section>
      {E.map(x => (
        <section key={x.k}>
          <div className="row" style={{justifyContent: 'space-between'}}>
            <b>{x.n}</b>
            <small className={'tag' + (x.estado === 'toca' || x.estado === 'atrasado' ? ' on' : '')}>{ETIQ[x.estado]}</small>
          </div>
          {x.ultimo ? (
            <div className="lin">
              <span>
                Último: <b className="mono">{f1(x.ultimo.valor)} {x.u}</b> · {fF(x.ultimo.fecha)}
              </span>
              {x.delta !== null && (
                <small className={clase(x.mejoro === null ? 0 : x.mejoro ? 1 : -1)}>
                  {sg(x.delta)} {x.u} vs. el anterior
                </small>
              )}
            </div>
          ) : null}
          <Linea valores={x.hist.map(h => h.valor)} />
          {ab === x.k ? (
            <div className="row" style={{marginTop: 8}}>
              <input inputMode="decimal" placeholder={x.u} value={v} onChange={e => setV(e.target.value)} style={{width: 90}} aria-label={`${x.n} en ${x.u}`} />
              <button onClick={() => guardar(x)}>Guardar</button>
              <button className="ghost" onClick={() => { setAb(null); setErr('') }}>Cancelar</button>
            </div>
          ) : (
            <div className="row" style={{marginTop: 8}}>
              <button className="ghost mini" onClick={() => { setAb(x.k); setV(''); setErr('') }}>Registrar resultado</button>
              {x.ultimo && <button className="ghost mini" onClick={() => borrar(x.ultimo.id)} aria-label="Borrar el último resultado">✕</button>}
            </div>
          )}
          {ab === x.k && err && <small className="warn">{err}</small>}
        </section>
      ))}
    </>
  )
}
