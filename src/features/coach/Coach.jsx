import {useState, useEffect, useMemo} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {pedirIA} from '../../services/ia'
import {lunes, sumaDias, sg} from '../../domain/stats'
import {preparacion, NOMBRES} from '../../domain/preparacion'
import {
  informeSemana,
  hayDatos,
  textoInforme,
  cuerpoCoach,
  limpiarCoach
} from '../../domain/informe'

const fFecha = f => {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}
const rango = w => `${fFecha(w).slice(0, 5)} – ${fFecha(sumaDias(w, 6)).slice(0, 5)}`
const c1 = n => (n === null || n === undefined ? '–' : String(n).replace('.', ','))
const metas = () => ({
  metaKcal: +cfg('metakcal', 2200) || 2200,
  metaAgua: +cfg('meta', 2500) || 2500
})
const Delta = ({d}) =>
  d === null || d === undefined ? null : (
    <small className={'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')}> {sg(d)}%</small>
  )

// Datos de los últimos 40 días para calcular la preparación.
async function cargarPrep() {
  const f = hoy(),
    d0 = sumaDias(f, -40),
    rango = t => db[t].where('fecha').between(d0, f, true, true).toArray()
  const [habitos, sesiones, comidas] = await Promise.all([
    rango('habitos'),
    rango('sesiones'),
    rango('comidas')
  ])
  return {habitos, sesiones, comidas}
}
const calcPrep = (d, h) =>
  preparacion({
    fecha: hoy(),
    sesiones: d.sesiones,
    comidas: d.comidas,
    ...metas(),
    habitos: [...d.habitos.filter(x => x.fecha !== hoy()), ...(h ? [{...h, fecha: hoy()}] : [])]
  })

// Tarjeta de Hoy. `h` = hábitos de hoy en vivo, así el puntaje se mueve al cargar el sueño.
export function Preparacion({h}) {
  const [d, setD] = useState(null)
  useEffect(() => {
    cargarPrep().then(setD)
  }, [])
  const r = useMemo(() => d && calcPrep(d, h), [d, h])
  if (!r) return null
  return (
    <section>
      <h3>Preparación para entrenar</h3>
      {r.ok ? (
        <>
          <div className="big">
            <span className={'sc ' + r.etiqueta.c}>{r.puntaje}</span>
            <small> / 100</small>
          </div>
          <div className="bar">
            <i style={{width: r.puntaje + '%'}} />
          </div>
          <b>{r.etiqueta.t}</b>
          <p style={{margin: '4px 0 0', fontSize: 14}}>{r.recomendacion.texto}</p>
          {r.recomendacion.avisos.map(a => (
            <small key={a} className="warn">
              {a}
            </small>
          ))}
          {r.faltan.length > 0 && (
            <small className="mu" style={{display: 'block', marginTop: 4}}>
              Calculado con el {r.confianza}% de los datos. Falta:{' '}
              {r.faltan.join(', ').toLowerCase()}.
            </small>
          )}
          <details>
            <summary className="tag">Cómo se calcula</summary>
            {Object.entries(r.partes).map(([k, v]) => (
              <div key={k} className="lin">
                <span>
                  {NOMBRES[k]}
                  {v.detalle && <small className="mu"> · {v.detalle}</small>}
                </span>
                <span className="mono">{v.p === null ? '–' : v.p}</span>
              </div>
            ))}
            <small className="mu" style={{display: 'block', marginTop: 6}}>
              Cómo te sentís 40 %, sueño contra tu propio promedio 30 %, carga reciente 20 %,
              hábitos de ayer (comida y agua) 10 %. Los pesos son una propuesta de diseño, no salen
              de un estudio: es una orientación basada en tus propios datos, no una medición médica.
              Un dolor agudo o en una articulación no es dolor muscular: parar y consultar.
            </small>
          </details>
        </>
      ) : (
        <>
          <div className="mu">Todavía no hay datos suficientes para calcularlo.</div>
          <small className="mu" style={{display: 'block', marginTop: 4}}>
            Hacé el check-in de arriba y cargá tu sueño de anoche; con los días se suman tus
            comidas, el agua y tus sesiones. Falta: {r.faltan.join(', ').toLowerCase()}.
          </small>
        </>
      )}
    </section>
  )
}

// Vista "Informe" de Progreso. ses/reg/manual vienen de Progreso.
export function Informe({ses, reg, manual}) {
  const [w, setW] = useState(lunes(hoy())),
    [ex, setEx] = useState(null),
    [coach, setCoach] = useState(null),
    [msg, setMsg] = useState(''),
    [ocupado, setOcupado] = useState(false)
  const actual = w === lunes(hoy())
  useEffect(() => {
    let vivo = true,
      d0 = w,
      d1 = sumaDias(w, 6)
    setCoach(null)
    setMsg('')
    Promise.all([
      db.habitos.where('fecha').between(d0, d1, true, true).toArray(),
      db.comidas.where('fecha').between(d0, d1, true, true).toArray(),
      db.coach.get(w)
    ]).then(([habitos, comidas, c]) => {
      if (vivo) {
        setEx({habitos, comidas})
        setCoach(c || null)
      }
    })
    return () => {
      vivo = false
    }
  }, [w])
  const inf = useMemo(
    () =>
      ex &&
      informeSemana({
        desde: w,
        sesiones: ses,
        registros: reg,
        manual,
        habitos: ex.habitos,
        comidas: ex.comidas,
        ...metas()
      }),
    [ex, ses, reg, manual, w]
  )
  const pedir = async () => {
    if (!cfg('key')) return setMsg('Cargá tu clave de IA en Ajustes.')
    setOcupado(true)
    setMsg('Consultando al coach…')
    try {
      const prep = actual ? calcPrep(await cargarPrep(), null) : null
      const r = await pedirIA({
        modelos: [cfg('modelo', 'gemini-3.8-flash'), 'gemini-flash-latest'],
        key: cfg('key'),
        cuerpo: cuerpoCoach(inf, prep),
        prog: setMsg,
        alt: 'leé el informe tal cual'
      })
      const doc = {semana: w, creado: new Date().toISOString(), ...limpiarCoach(r)}
      await db.uso.add({fecha: hoy(), fn: 'coach'})
      await db.coach.put(doc)
      setCoach(doc)
      setMsg('')
    } catch (e) {
      setMsg('No pude consultar al coach: ' + e.message)
    }
    setOcupado(false)
  }
  const texto = () => textoInforme(inf, coach)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto())
      setMsg('✅ Informe copiado.')
    } catch {
      setMsg('No pude copiarlo en este navegador.')
    }
  }
  const compartir = async () => {
    try {
      await navigator.share({title: 'Informe semanal MMV', text: texto()})
    } catch {}
  }
  if (!inf)
    return (
      <section>
        <p className="mu">Cargando…</p>
      </section>
    )
  const e = inf.entreno,
    pats = Object.entries(e.patrones)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
  return (
    <>
      <section>
        <h3>Informe semanal</h3>
        <div className="row" style={{justifyContent: 'space-between'}}>
          <button
            className="ghost mini"
            onClick={() => setW(sumaDias(w, -7))}
            aria-label="Semana anterior"
          >
            ◀
          </button>
          <div style={{textAlign: 'center'}}>
            <b>{actual ? 'Esta semana (en curso)' : 'Semana'}</b>
            <br />
            <small className="tag">{rango(w)}</small>
          </div>
          <button
            className="ghost mini"
            disabled={actual}
            onClick={() => setW(sumaDias(w, 7))}
            aria-label="Semana siguiente"
          >
            ▶
          </button>
        </div>
        {!hayDatos(inf) && <p className="mu">No hay datos en esta semana.</p>}
      </section>
      {hayDatos(inf) && (
        <>
          <section>
            <h3>Entreno</h3>
            <div className="lin">
              <span>Sesiones</span>
              <span className="mono">
                {e.sesiones} · {e.dias} {e.dias === 1 ? 'día' : 'días'}
              </span>
            </div>
            <div className="lin">
              <span>RPE medio</span>
              <span className="mono">{c1(e.rpeMedio)}</span>
            </div>
            <div className="lin">
              <span>Carga (RPE × min)</span>
              <span className="mono">
                {e.carga}
                <Delta d={e.cargaVsAnterior} />
              </span>
            </div>
            <div className="lin">
              <span>Repeticiones</span>
              <span className="mono">
                {e.reps}
                <Delta d={e.repsVsAnterior} />
              </span>
            </div>
            <div className="lin">
              <span>Tonelaje (kg)</span>
              <span className="mono">
                {e.tonelaje}
                <Delta d={e.tonelajeVsAnterior} />
              </span>
            </div>
            {pats.length > 0 && (
              <div className="lin">
                <span>Patrones</span>
                <span className="mono" style={{textAlign: 'right'}}>
                  {pats.map(([p, v]) => `${p} ${v}`).join(' · ')}
                </span>
              </div>
            )}
            {e.records.length > 0 && (
              <div className="lin">
                <span>🏆 Récords</span>
                <span style={{textAlign: 'right'}}>{e.records.join(', ')}</span>
              </div>
            )}
            <small className="mu">
              Los % comparan con la semana anterior
              {actual
                ? ' completa; como esta semana sigue en curso, es normal que den negativos'
                : ''}
              .
            </small>
          </section>
          <section>
            <h3>Hábitos</h3>
            <div className="lin">
              <span>Sueño</span>
              <span className="mono">
                {inf.sueno.diasConDato
                  ? `${c1(inf.sueno.horasMedias)} h · ${inf.sueno.diasConDato} d${inf.sueno.diasMenosDe6h ? ` · ${inf.sueno.diasMenosDe6h} con <6 h` : ''}`
                  : 'sin datos'}
              </span>
            </div>
            <div className="lin">
              <span>Agua</span>
              <span className="mono">
                {inf.agua.diasConDato
                  ? `${inf.agua.mlMedios} ml · meta ${inf.agua.diasMeta}/${inf.agua.diasConDato} d`
                  : 'sin datos'}
              </span>
            </div>
            <div className="lin">
              <span>Comida</span>
              <span className="mono">
                {inf.comida.diasConDato
                  ? `${inf.comida.kcalMedias} kcal · P ${inf.comida.proteinaMedia} g`
                  : 'sin datos'}
              </span>
            </div>
            {inf.comida.diasConDato > 0 && (
              <small className="mu">
                {inf.comida.diasEnRango} de {inf.comida.diasConDato} días dentro de ±15 % de tu meta
                ({inf.comida.meta} kcal). Los promedios cuentan solo los días con datos.
              </small>
            )}
          </section>
          <section>
            <h3>Coach IA</h3>
            {coach ? (
              <div className="coach">
                {coach.resumen && <p style={{marginTop: 0}}>{coach.resumen}</p>}
                {coach.alerta && <p className="warn">⚠ {coach.alerta}</p>}
                {[
                  ['Lo que salió bien', coach.logros],
                  ['A mejorar', coach.mejoras],
                  ['Plan para la semana próxima', coach.plan]
                ].map(
                  ([t, a]) =>
                    a?.length > 0 && (
                      <div key={t}>
                        <small className="tag">{t}</small>
                        <ul>
                          {a.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
                <small className="mu">
                  Generado el{' '}
                  {new Date(coach.creado).toLocaleString('es-UY', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                  {actual ? ' con la semana en curso: pedilo de nuevo al terminarla.' : '.'} La IA
                  solo ve estos números; son orientaciones generales, no consejo médico.
                </small>
              </div>
            ) : (
              <p className="mu" style={{marginTop: 0}}>
                Pedile al coach una lectura de la semana: qué salió bien, qué mejorar y un plan
                chico. Solo se le envían los números de arriba (sin fotos ni nombres de ejercicios).
              </p>
            )}
            <div className="row" style={{marginTop: 8}}>
              <button disabled={ocupado} onClick={pedir}>
                {coach ? 'Actualizar consejos' : 'Pedir consejos al coach'}
              </button>
            </div>
            {msg && <p className={msg.startsWith('No pude') ? 'warn' : 'mu'}>{msg}</p>}
            {msg.startsWith('No pude') && (
              <small className="mu">
                El informe de arriba sigue siendo válido: lo calcula la app, no la IA.
              </small>
            )}
          </section>
          <div className="row" style={{marginBottom: 12}}>
            <button className="ghost" onClick={copiar}>
              Copiar informe
            </button>
            {navigator.share && (
              <button className="ghost" onClick={compartir}>
                Compartir
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
