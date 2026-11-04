import {useState, useEffect, useCallback} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {sumaDias} from '../../domain/stats'
import {
  CAMPOS,
  AVISO_BIA,
  normalizarMedida,
  validarMedida,
  tendencia,
  ultima,
  objetivo,
  promedioVentana
} from '../../domain/cuerpo'

const c1 = n => (n === null || n === undefined ? '–' : String(n).replace('.', ','))
const sg = n => (n > 0 ? '+' : '') + c1(n)
const fFecha = f => f.split('-').reverse().join('/').slice(0, 5)

const useMedidas = () => {
  const [ms, setMs] = useState(null)
  const cargar = useCallback(async () => setMs(await db.medidas.orderBy('fecha').toArray()), [])
  useEffect(() => {
    cargar()
  }, [cargar])
  return [ms, cargar]
}

// Formulario: solo el peso es obligatorio; el resto, lo que dé tu báscula.
function FormMedida({inicial, onGuardar, onCancelar}) {
  const [f, setF] = useState(() => ({fecha: hoy(), estandar: true, ...inicial})),
    [err, setErr] = useState('')
  const set = (k, v) => setF(x => ({...x, [k]: v}))
  const guardar = async () => {
    const m = normalizarMedida(f, hoy()),
      e = validarMedida(m)
    if (e) return setErr(e)
    await db.medidas.put(m)
    onGuardar()
  }
  return (
    <div>
      <div className="row">
        <label className="mu">
          Fecha{' '}
          <input
            type="date"
            value={f.fecha}
            max={hoy()}
            onChange={e => set('fecha', e.target.value)}
          />
        </label>
      </div>
      <div className="grid2">
        {CAMPOS.map(c => (
          <label key={c.k} className="mu">
            {c.n} ({c.u}){c.req ? ' *' : ''}
            <input
              type="text"
              inputMode="decimal"
              value={f[c.k] ?? ''}
              onChange={e => set(c.k, e.target.value)}
            />
          </label>
        ))}
      </div>
      <p>
        <label className="check">
          <input
            type="checkbox"
            checked={f.estandar !== false}
            onChange={e => set('estandar', e.target.checked)}
          />
          <span>Medida en mis condiciones habituales (mañana, en ayunas)</span>
        </label>
      </p>
      <small className="mu">
        Cargá solo lo que muestre tu báscula y dejá el resto en blanco. Una medida por día: si
        guardás otra con la misma fecha, reemplaza a la anterior.
      </small>
      {err && <small className="warn">{err}</small>}
      <div className="row" style={{marginTop: 8}}>
        <button onClick={guardar}>Guardar medida</button>
        {onCancelar && (
          <button className="ghost" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

// Tarjeta de «Hoy»: última medida, tendencia y atajo para registrar.
export function TarjetaCuerpo() {
  const [ms, cargar] = useMedidas(),
    [abierto, setAbierto] = useState(false)
  if (!ms) return null
  const u = ultima(ms),
    t = tendencia(ms, hoy()),
    dias = u ? Math.round((Date.now() - new Date(u.fecha + 'T12:00:00')) / 864e5) : null
  return (
    <section>
      <h3>Cuerpo</h3>
      {abierto ? (
        <FormMedida
          onGuardar={() => {
            setAbierto(false)
            cargar()
          }}
          onCancelar={() => setAbierto(false)}
        />
      ) : (
        <>
          {u ? (
            <>
              <div className="big">
                {c1(u.peso)}
                <small> kg · {dias <= 0 ? 'hoy' : `hace ${dias} d`}</small>
              </div>
              {t.delta !== null ? (
                <small className={'delta ' + (t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : '')}>
                  {sg(t.delta)} kg vs hace 4 semanas (promedios de 7 días)
                </small>
              ) : (
                <small className="mu">
                  La tendencia aparece con medidas de hoy y de hace 4 semanas.
                </small>
              )}
              {dias > 10 && (
                <small className="warn">
                  Hace más de 10 días que no te pesás; con una vez por semana alcanza.
                </small>
              )}
            </>
          ) : (
            <p className="mu" style={{marginTop: 0}}>
              Todavía no registraste tu peso. Una vez por semana, siempre en las mismas condiciones,
              alcanza.
            </p>
          )}
          <div className="row" style={{marginTop: 8}}>
            <button onClick={() => setAbierto(true)}>Registrar medida</button>
          </div>
        </>
      )}
    </section>
  )
}

// Gráfico simple: puntos de peso, promedio de 7 días y línea del objetivo.
function Linea({ms, obj}) {
  const pts = ms.filter(m => m.peso > 0).slice(-40)
  if (pts.length < 2) return null
  const prom = pts.map(m => promedioVentana(ms, m.fecha, 'peso', 7)?.v ?? m.peso)
  const todos = [...pts.map(m => m.peso), ...prom, ...(obj ? [obj] : [])],
    mx = Math.max(...todos),
    mn = Math.min(...todos),
    W = 300,
    H = 110,
    Y = v => H - 12 - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - 24),
    X = i => (i / (pts.length - 1)) * (W - 8) + 4
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label="Peso en el tiempo"
    >
      {obj > 0 && (
        <line x1="0" x2={W} y1={Y(obj)} y2={Y(obj)} stroke="var(--pr)" strokeDasharray="4 4" />
      )}
      <polyline
        points={prom.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {pts.map((m, i) => (
        <circle key={m.fecha} cx={X(i)} cy={Y(m.peso)} r="2.5" fill="var(--mu)" />
      ))}
      <text x="4" y="10" fontSize="10" fill="var(--mu)">
        {c1(mx)}
      </text>
      <text x="4" y={H - 2} fontSize="10" fill="var(--mu)">
        {c1(mn)}
      </text>
    </svg>
  )
}

// Vista completa (Progreso → Cuerpo): objetivo, gráfico, tendencia por campo e historial.
export function VistaCuerpo() {
  const [ms, cargar] = useMedidas(),
    [form, setForm] = useState(null)
  if (!ms) return null
  const f = hoy(),
    obj = objetivo({pesoObj: cfg('pesoobj'), fechaObj: cfg('fechaobj'), medidas: ms, fecha: f}),
    campos = CAMPOS.filter(c => c.k !== 'peso' && ms.some(m => m[c.k] > 0))
  const borrar = async m => {
    if (!confirm(`¿Borrar la medida del ${fFecha(m.fecha)}?`)) return
    await db.medidas.delete(m.fecha)
    cargar()
  }
  return (
    <>
      <section>
        <h3>Peso y composición</h3>
        {form ? (
          <FormMedida
            inicial={form === 'nueva' ? null : form}
            onGuardar={() => {
              setForm(null)
              cargar()
            }}
            onCancelar={() => setForm(null)}
          />
        ) : (
          <button onClick={() => setForm('nueva')}>Registrar medida</button>
        )}
      </section>
      {ms.length === 0 && (
        <section>
          <p className="mu" style={{margin: 0}}>
            Sin medidas todavía. Con unas semanas de datos, acá vas a ver la tendencia contra hace 4
            semanas.
          </p>
        </section>
      )}
      {ms.length > 0 && (
        <section>
          <h3>Tendencia</h3>
          <Linea ms={ms} obj={obj?.pesoObj} />
          <small className="mu">
            Línea: promedio de 7 días · puntos: cada pesada · guiones: tu objetivo.
          </small>
          <div className="lin">
            <span>Peso (prom. 7 días)</span>
            <span className="mono">
              {c1(tendencia(ms, f).actual)} kg
              {tendencia(ms, f).delta !== null && (
                <small className="delta"> {sg(tendencia(ms, f).delta)} vs hace 4 sem</small>
              )}
            </span>
          </div>
          {campos.map(c => {
            const t = tendencia(ms, f, c.k)
            return (
              <div className="lin" key={c.k}>
                <span>{c.n}</span>
                <span className="mono">
                  {c1(t.actual ?? ultima(ms, c.k)?.[c.k])} {c.u}
                  {t.delta !== null && (
                    <small className="delta"> {sg(t.delta)} vs hace 4 sem</small>
                  )}
                </span>
              </div>
            )
          })}
          <small className="mu">{AVISO_BIA}</small>
        </section>
      )}
      <section>
        <h3>Objetivo</h3>
        {obj ? (
          <>
            <div className="lin">
              <span>Ahora → objetivo</span>
              <span className="mono">
                {c1(obj.pesoActual)} → {c1(obj.pesoObj)} kg
              </span>
            </div>
            <div className="lin">
              <span>{obj.faltan > 0 ? 'Falta subir' : 'Falta bajar'}</span>
              <span className="mono">{c1(Math.abs(obj.faltan))} kg</span>
            </div>
            {obj.semanas !== null && !obj.vencido && (
              <div className="lin">
                <span>Ritmo necesario</span>
                <span className="mono">{sg(obj.ritmoNecesario)} kg/semana</span>
              </div>
            )}
            <div className="lin">
              <span>Ritmo actual</span>
              <span className="mono">
                {obj.ritmoActual === null ? 'sin datos' : `${sg(obj.ritmoActual)} kg/semana`}
              </span>
            </div>
            {obj.alcanzado && <small className="tag">🏁 Estás en el objetivo.</small>}
            {obj.vencido && (
              <small className="warn">
                La fecha del objetivo ya pasó: actualizala en Ajustes → Perfil y objetivo.
              </small>
            )}
            {obj.exigente && (
              <small className="warn">
                Ese ritmo es exigente (más de 1 % del peso por semana). Conviene revisar la fecha.
              </small>
            )}
          </>
        ) : (
          <p className="mu" style={{margin: 0}}>
            Cargá tu peso objetivo (y una fecha si querés) en Ajustes → Perfil y objetivo.
          </p>
        )}
      </section>
      {ms.length > 0 && (
        <section>
          <h3>Historial</h3>
          {[...ms]
            .reverse()
            .slice(0, 30)
            .map(m => (
              <div className="lin" key={m.fecha}>
                <span>
                  {fFecha(m.fecha)}
                  {m.estandar === false && <small className="mu"> · otras condiciones</small>}
                </span>
                <span className="mono" style={{textAlign: 'right'}}>
                  {c1(m.peso)} kg{m.grasa ? ` · ${c1(m.grasa)} %` : ''}{' '}
                  <button className="ghost mini" onClick={() => setForm(m)} aria-label="Editar">
                    ✎
                  </button>{' '}
                  <button className="ghost mini" onClick={() => borrar(m)} aria-label="Borrar">
                    ✕
                  </button>
                </span>
              </div>
            ))}
        </section>
      )}
    </>
  )
}
