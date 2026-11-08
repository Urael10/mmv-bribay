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
import {sumaDias} from '../../domain/stats'
import {fmtVal, fmtSigno, hayDato, nombreEjercicio} from '../../domain/formato'
import {claseVariacion} from '../../domain/variacion'
import Estado from '../../ui/Estado'
import Plegable from '../../ui/Plegable'
import {CajaDescarga} from './AvisoDescarga'

const sinDatos = p => p.etiqueta === 'Sin datos suficientes'

const TIPO = {movilidad: 'Movilidad', warmup: 'Warm up', emom: 'EMOM', amrap: 'AMRAP', tabata: 'Tabata', forTime: 'For time'}
const f1 = n => (n === null || n === undefined ? '–' : String(n).replace('.', ','))
const sg = n => (n === null || n === undefined ? '–' : (n > 0 ? '+' : '') + f1(n))
const fF = f => f.split('-').reverse().slice(0, 2).join('/')
const clase = d => claseVariacion(d)

function Barras({datos}) {
  const W = 280,
    H = 64,
    T = 16, // aire arriba para el valor de la semana en curso
    mx = Math.max(1, ...datos.map(d => d.y)),
    bw = W / datos.length,
    ult = datos.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${T + H + 14}`} width="100%" role="img" aria-label={`Carga de entrenamiento por semana. Semana en curso: ${datos[ult] ? datos[ult].y : 0}`}>
      {datos.map((d, i) => {
        const h = (d.y / mx) * H
        return (
          <g key={d.x}>
            <rect x={i * bw + 3} y={T + H - h} width={bw - 6} height={Math.max(h, 1)} rx="2" fill="var(--ac)" opacity={i === ult ? 1 : 0.5} />
            {i === ult && (
              <text className="barra-valor" x={i * bw + bw / 2} y={T + H - h - 4} fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--tx)">
                {Math.round(d.y).toLocaleString('es-UY')}
              </text>
            )}
            <text x={i * bw + bw / 2} y={T + H + 11} fontSize="8" textAnchor="middle" fill="var(--tx-2)">
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
      <Estado etiqueta={p.etiqueta} tono={p.tono} />
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
  // Cada pilar sabe qué le falta; los que no tienen datos van juntos en una sola tarjeta, después de los que sí.
  const tarjetas = [
    {
      nombre: 'Fuerza',
      p: F,
      falta: 'Registros de pesos y repeticiones en las últimas 8 semanas (se comparan 28 días contra los 28 anteriores).',
      cuerpo: F.comparables ? (
        <p className="mu">
          {F.comparables} {F.comparables === 1 ? 'ejercicio comparable' : 'ejercicios comparables'}: {F.suben} suben · {F.igual} estables · {F.bajan} bajan (1RM estimado de los últimos 28 días contra los 28 anteriores). Récords de carga en 28 días: {F.records}.
        </p>
      ) : null
    },
    {
      nombre: 'Resistencia',
      p: Re,
      falta: 'Repeticiones de cardio en tus sesiones o algún test de resistencia (Progreso › Tests).',
      cuerpo: (
        <p className="mu">
          Repeticiones de cardio en 28 días: <b className="mono">{Re.repsCardio}</b>
          {Re.deltaPct !== null && <small className={clase(Re.deltaPct)}> {sg(Re.deltaPct)}%</small>} · {fmtVal(Re.sesionesPorSemana)} {+Re.sesionesPorSemana === 1 ? 'sesión' : 'sesiones'} por semana
          {Re.testsComparados > 0 && ` · ${Re.testsMejoraron} de ${Re.testsComparados} tests de resistencia mejoraron`}.
        </p>
      )
    },
    {
      nombre: 'Composición',
      p: C,
      falta: 'Tu peso registrado en varias fechas (Hoy › Cuerpo) para ver la tendencia de 4 semanas.',
      cuerpo: (
        <p className="mu">
          Peso: <b className="mono">{hayDato(C.peso.actual) ? `${fmtVal(C.peso.actual)} kg` : '—'}</b>
          {hayDato(C.peso.delta) && ` (${fmtSigno(C.peso.delta)} kg en 4 semanas)`}
          {C.grasa.delta !== null && ` · grasa ${sg(C.grasa.delta)} puntos`}
          {C.musculo.delta !== null && ` · músculo ${sg(C.musculo.delta)} kg`}. Si te sirve para tu objetivo lo decidís vos: acá no se juzga si es «bueno» o «malo».
        </p>
      )
    },
    {
      nombre: 'Hábitos',
      p: H,
      falta: 'Check-in, sueño, agua o comidas cargados en los últimos 7 días.',
      cuerpo: (
        <p className="mu">
          Últimos 7 días: check-in {H.checkin}/7 · sueño cargado {H.sueno}/7 · agua en meta {H.agua}/7 · comida cargada {H.comida}/7 · {H.entrenos} {H.entrenos === 1 ? 'día' : 'días'} de entreno.
        </p>
      )
    }
  ]
  const conDatos = tarjetas.filter(x => !sinDatos(x.p)),
    vacios = tarjetas.filter(x => sinDatos(x.p))
  return (
    <>
      <CajaDescarga des={des} />
      <section>
        <h3>Carga de entrenamiento</h3>
        <Barras datos={serie.map(s => ({x: fF(s.desde), y: s.carga}))} />
        <small className="mu">Carga semanal = RPE × minutos de cada sesión. Barra clara y con número: la semana en curso.</small>
      </section>
      {conDatos.map(x => (
        <Pilar key={x.nombre} nombre={x.nombre} p={x.p}>
          {x.cuerpo}
        </Pilar>
      ))}
      {vacios.length > 0 && (
        <section className="vacio">
          <h3>Aún sin datos ({vacios.length})</h3>
          {vacios.map(x => (
            <Plegable key={x.nombre} tarjeta={false} titulo={x.nombre} resumen="Sin datos suficientes">
              <p className="mu" style={{margin: 0}}>
                Falta: {x.falta}
              </p>
            </Plegable>
          ))}
        </section>
      )}
      {prog.length === 0 ? (
        <Plegable titulo="Progresión por ejercicio" resumen="Aún sin datos">
          <p className="mu" style={{margin: 0}}>
            Aparece cuando un ejercicio tiene al menos 2 registros con carga en el mismo tipo de bloque.
          </p>
        </Plegable>
      ) : (
        <section>
          <h3>Progresión por ejercicio</h3>
          {prog.map(x => (
            <div key={x.clave} className="fila">
              <div>
                <b>{nombreEjercicio(x.nombre)}</b> <small className="tag">{TIPO[x.tipo] || x.tipo}</small>
              </div>
              <small className="mu">{x.texto}</small>
            </div>
          ))}
        </section>
      )}
      <small className="mu" style={{display: 'block', marginBottom: 12}}>
        Orientaciones de diseño, no indicaciones médicas ni un plan individual.
      </small>
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
            <Estado etiqueta={ETIQ[x.estado]} />
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
              <button className="pri" onClick={() => guardar(x)}>Guardar</button>
              <button className="ghost" onClick={() => { setAb(null); setErr('') }}>Cancelar</button>
            </div>
          ) : (
            <div className="row" style={{marginTop: 8}}>
              <button className="ghost mini" onClick={() => { setAb(x.k); setV(''); setErr('') }}>Registrar resultado</button>
              {x.ultimo && <button className="ghost mini" onClick={() => borrar(x.ultimo.id)} aria-label="Borrar el último resultado"><Icono n="cerrar" tam={18} /></button>}
            </div>
          )}
          {ab === x.k && err && <small className="warn">{err}</small>}
        </section>
      ))}
    </>
  )
}
