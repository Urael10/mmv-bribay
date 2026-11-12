import {useState, useEffect, useMemo, useRef} from 'react'
import {sentir} from '../../services/feedback'
import {db, hoy, cfg, sembrar} from '../../data/db'
import {pedirIA} from '../../services/ia'
import {chica} from '../../services/img'
import NavFecha from '../../ui/NavFecha'
import Icono from '../../ui/Icono'
import {repartoMacros} from '../../domain/variacion'
import {sumaDias} from '../../domain/stats'
import {ultima, proteinaObjetivo, PROT_KG} from '../../domain/cuerpo'
import {
  buscarOFF,
  buscarCodigoOFF,
  esCodigo,
  soloDigitos,
  ATRIBUCION,
  FUENTE
} from '../../services/off'
import {crearDetector, iniciarLectura, mensajeCamara, mensajePausa, canonico} from '../../services/escaner'
import {
  MULTIPLOS,
  gramosPorcion,
  multiploActual,
  sugeridos,
  itemDeSugerido,
  conPorcion,
  porcionDe,
  plantillaDesdeItems,
  itemsDePlantilla,
  comidasParecidas,
  itemsDeComida,
  itemRapido,
  faltaProteina,
  atajosRecientes,
  usoDeAlimentos,
  listarAlimentos,
  FILTROS_ALIMENTOS,
  MIN_FRECUENTE
} from '../../domain/registro'
import {
  MOMENTOS,
  momentoPorHora,
  buscar,
  emparejar,
  itemDesde,
  recalcular,
  cerrar,
  totales,
  coherente,
  itemsDesdeEscaneo,
  alimentoDesdeEtiqueta,
  validarAlimento,
  claveAl,
  fmt,
  n0,
  gramos
} from '../../domain/alimentos'

const P_PLATO =
  'Sos nutricionista. Mirá la foto de una comida y devolvé SOLO JSON: {"alimentos":[{"nombre":"","gramos":0,"kcal100":0,"p100":0,"c100":0,"g100":0,"confianza":"alta|media|baja"}],"nota":""}. Un ítem por cada alimento que se ve. Nombres en español rioplatense, simples y genéricos (ej "arroz blanco cocido", "pechuga de pollo grillada", "tomate"). "gramos" = peso estimado de lo que se ve en el plato, ya cocido o preparado (líquidos: 1 ml = 1 g). kcal100, p100, c100 y g100 = calorías, proteínas, carbohidratos y grasas por cada 100 g de ese alimento. NO sumes totales. Si no hay comida en la foto devolvé {"alimentos":[]}. Si dudás del alimento o de la cantidad, poné confianza "baja".'
const P_ETIQ =
  'Leé la tabla de información nutricional de la foto y devolvé SOLO JSON: {"nombre":"","base_g":100,"kcal":0,"p":0,"c":0,"g":0,"porcion_g":0}. "nombre" = nombre del producto (vacío si no se ve). "base_g" = gramos (o ml) a los que se refieren los valores que copiás; si hay una columna "por 100 g" o "por 100 ml" usá esa y base_g=100. kcal = calorías (kcal, no kJ), p = proteínas, c = carbohidratos totales, g = grasas totales, todo en gramos. "porcion_g" = tamaño de la porción en gramos si la etiqueta lo indica, si no 0. Si un valor no se ve, poné 0.'
const horaAhora = () => new Date().toTimeString().slice(0, 5)
const fFecha = f => f.split('-').reverse().join('/').slice(0, 5)

async function leer(file, prompt, prog, fn) {
  const d = await chica(file)
  const cuerpo = JSON.stringify({
    contents: [{parts: [{text: prompt}, {inline_data: {mime_type: 'image/jpeg', data: d}}]}],
    generationConfig: {responseMimeType: 'application/json'}
  })
  const r = await pedirIA({
    modelos: [cfg('modelo', 'gemini-3.8-flash'), 'gemini-flash-latest'],
    key: cfg('key'),
    cuerpo,
    prog,
    alt: 'cargá la comida a mano desde tu base'
  })
  await db.uso.add({fecha: hoy(), fn})
  return r
}
// Macronutrientes con nombre corto que entra en una columna de celular («Carbos», no «Carbohidratos»).
// `compacto` = una línea de texto para filas; si no, columnas con mini-barra (la barra muestra el reparto por
// gramos entre proteína, carbohidratos y grasas). `sinProteina` deja afuera la proteína cuando ya se muestra
// aparte con su meta (así no aparece dos veces en el diario).
const MACROS = [
  ['Proteína', 'Prot.', 'p', '--m-p'],
  ['Carbos', 'Carb.', 'c', '--m-c'],
  ['Grasas', 'Gras.', 'gr', '--m-g']
]
const Macros = ({t, compacto, sinProteina}) => {
  if (compacto)
    return (
      <small className="mu">
        {MACROS.map(([, corto, k]) => `${corto} ${fmt(t[k])} g`).join(' · ')}
      </small>
    )
  const rp = repartoMacros(t),
    lista = sinProteina ? MACROS.filter(m => m[2] !== 'p') : MACROS
  return (
    <div className={'macros' + (lista.length === 2 ? ' dos' : '')} role="group" aria-label="Macronutrientes">
      {lista.map(([largo, , k, col]) => (
        <div className="macro" key={k}>
          <span className="macro-n">{largo}</span>
          <b className="mono macro-v">{fmt(t[k])} g</b>
          <span className="macro-bar" aria-hidden="true">
            <i style={{width: rp[k] + '%', background: `var(${col})`}} />
          </span>
        </div>
      ))}
    </div>
  )
}

function Borrador({b, setB, base, fecha, guardar, cancelar, guardarEnBase, guardarPlantilla}) {
  const set = (i, f) => setB({...b, items: b.items.map((x, j) => (j === i ? f(x) : x))})
  const quitar = i => setB({...b, items: b.items.filter((_, j) => j !== i)})
  const rematch = i => {
    const it = b.items[i]
    if (!(it.origen === 'ia' || (it.libre && !it.b.kcal100))) return
    const m = emparejar(base, it.nombre)
    if (m)
      set(i, x => ({...itemDesde(m, x.g, 'base', {leido: x.leido}), porcion: m.porcion || x.g}))
  }
  const T = totales(b.items.map(cerrar))
  return (
    <section>
      <h3>
        {b.id ? 'Editar comida' : 'Tu comida'} · {fFecha(fecha)}
      </h3>
      {b.nota && (
        <small className="mu" style={{display: 'block', marginBottom: 6}}>
          Nota de la IA: {b.nota}
        </small>
      )}
      {b.fuente === 'plato' && (
        <small className="mu" style={{display: 'block', marginBottom: 6}}>
          La IA estima alimentos y gramos a ojo: revisá cada línea, sobre todo los gramos.
        </small>
      )}
      <div className="row" style={{marginBottom: 6}}>
        <select
          aria-label="Momento"
          value={b.momento}
          onChange={e => setB({...b, momento: e.target.value})}
        >
          {MOMENTOS.map(m => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      {!b.items.length && <p className="mu">Elegí un alimento de arriba para empezar.</p>}
      {b.items.map((it, i) => {
        const por = porcionDe(it, base),
          act = multiploActual(it.g, por),
          al = it.alimentoId != null ? base.find(a => a.id === it.alimentoId) : null
        return (
          <div className="fila" key={i}>
            <input
              style={{width: '100%'}}
              value={it.nombre}
              placeholder="Nombre del alimento"
              onChange={e => set(i, x => ({...x, nombre: e.target.value}))}
              onBlur={() => rematch(i)}
            />
            {it.leido && it.leido.toLowerCase() !== it.nombre.toLowerCase() && (
              <small className="mu" style={{display: 'block'}}>
                La IA leyó: “{it.leido}”
              </small>
            )}
            <div className="row">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="g"
                aria-label="Gramos"
                value={it.g ?? ''}
                onChange={e => set(i, x => recalcular(x, e.target.value))}
              />
              <span className="mu">g</span>
              <b className="mono">{it.kcal} kcal</b>
              <button className="ghost mini" aria-label="Quitar" onClick={() => quitar(i)}>
                <Icono n="cerrar" tam={18} />
              </button>
            </div>
            <div
              className="row"
              style={{marginTop: 6}}
              role="group"
              aria-label={`Porción de ${it.nombre || 'alimento'}`}
            >
              {MULTIPLOS.map(([m, l]) => (
                <button
                  key={m}
                  className={'chip' + (act === m ? ' on' : '')}
                  aria-pressed={act === m}
                  title={gramosPorcion(por, m) + ' g'}
                  onClick={() => set(i, x => recalcular(x, gramosPorcion(por, m)))}
                >
                  {l}
                </button>
              ))}
              <small className="mu">× porción de {fmt(por)} g</small>
            </div>
            <Macros t={it} compacto />
            {it.origen === 'base' && (
              <small className="tag" style={{display: 'block'}}>
                <Icono n="check" tam={16} className="en-texto" /> valores de tu base
              </small>
            )}
            {al?.fuente && (
              <small className="warn">
                <Icono n="web" tam={16} className="en-texto" /> {al.fuente}: datos de la comunidad, revisalos si algo no te cierra
              </small>
            )}
            {it.origen === 'ia' && (
              <small className="warn">
                ≈ valores estimados por la IA{it.confianza === 'baja' ? ' (poca confianza)' : ''}:
                revisalos
              </small>
            )}
            {it.origen === 'manual' && (
              <small className="mu" style={{display: 'block'}}>
                <Icono n="lapiz" tam={16} className="en-texto" /> valores cargados por vos
              </small>
            )}
            {!coherente(it.b) && (
              <small className="warn">
                <Icono n="alerta" tam={16} className="en-texto" /> Las calorías no cuadran con los macros (4·P + 4·C + 9·G): revisá los valores.
              </small>
            )}
            <details open={!!it.libre}>
              <summary className="tag">Valores por 100 g</summary>
              <div className="row">
                {[
                  ['kcal100', 'kcal'],
                  ['p100', 'prot'],
                  ['c100', 'carb'],
                  ['g100', 'grasa']
                ].map(([k, l]) => (
                  <input
                    key={k}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder={l}
                    aria-label={l + ' por 100 g'}
                    value={it.b[k] ?? ''}
                    onChange={e =>
                      set(i, x => ({
                        ...recalcular({...x, b: {...x.b, [k]: e.target.value}}, x.g),
                        origen: 'manual'
                      }))
                    }
                  />
                ))}
              </div>
            </details>
            {it.origen !== 'base' && (
              <button
                className="ghost mini"
                style={{marginTop: 6}}
                onClick={() => guardarEnBase(i)}
              >
                <Icono n="mas" tam={16} className="en-texto" /> Guardar en mi base
              </button>
            )}
          </div>
        )
      })}
      <div className="lin" style={{marginTop: 10}}>
        <b>Total</b>
        <b className="mono">{T.kcal} kcal</b>
      </div>
      <Macros t={T} />
      <div className="row" style={{marginTop: 10}}>
        <button className="pri" onClick={guardar}>
          Guardar comida
        </button>
        {b.items.length > 0 && (
          <button className="ghost" onClick={() => guardarPlantilla(b.items, b.momento)}>
            <Icono n="estrella" tam={16} className="en-texto" /> Guardar como habitual
          </button>
        )}
        <button className="ghost" onClick={cancelar}>
          Cancelar
        </button>
      </div>
    </section>
  )
}

// Escáner de códigos de barras: abre la cámara trasera y avisa apenas lee un código válido.
function Escaner({alLeer, cerrar}) {
  const ref = useRef(null),
    [msg, setMsg] = useState('Abriendo la cámara…'),
    [err, setErr] = useState(null)
  useEffect(() => {
    let vivo = true,
      flujo = null,
      parar = null
    // Entrega 43: al salir de la app se libera la cámara y se avisa (ver mensajePausa)
    const alVisibilidad = () => {
      const m = mensajePausa(document.visibilityState)
      if (!m || !vivo) return
      parar?.()
      parar = null
      flujo?.getTracks().forEach(t => t.stop())
      flujo = null
      setErr(m)
    }
    document.addEventListener('visibilitychange', alVisibilidad)
    ;(async () => {
      try {
        const detector = await crearDetector()
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Este navegador no permite usar la cámara. Tipeá el número en el buscador.'
          )
        flujo = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: {ideal: 'environment'}},
          audio: false
        })
        if (!vivo) {
          flujo.getTracks().forEach(t => t.stop())
          return
        }
        const v = ref.current
        v.srcObject = flujo
        await v.play().catch(() => {})
        setMsg('Apuntá al código de barras del envase (con buena luz y sin mover).')
        parar = iniciarLectura({
          detector,
          video: v,
          alLeer: c => {
            if (vivo) alLeer(c)
          }
        })
      } catch (e) {
        if (vivo) setErr(mensajeCamara(e))
      }
    })()
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alVisibilidad)
      parar?.()
      flujo?.getTracks().forEach(t => t.stop())
    }
  }, [])
  return (
    <div style={{marginTop: 8}}>
      {err ? (
        <p className="warn">{err}</p>
      ) : (
        <>
          <video
            ref={ref}
            playsInline
            muted
            style={{
              width: '100%',
              maxHeight: 260,
              borderRadius: 12,
              background: 'var(--scrim)',
              objectFit: 'cover'
            }}
          />
          <small className="mu" style={{display: 'block', marginTop: 4}}>
            {msg}
          </small>
        </>
      )}
      <div className="row" style={{marginTop: 6}}>
        <button className="ghost mini" onClick={cerrar}>
          Cerrar cámara
        </button>
      </div>
    </div>
  )
}

// Una sola entrada para agregar: buscador (con código de barras), cámara, recientes, comidas guardadas y respaldo web.
function Agregar({base, atajos, plant, usarComida, agregar, libre, nuevo, usarPlantilla, usarWeb, foto}) {
  const [rap, setRap] = useState({nombre: '', kcal: '', p: ''}),
    [rapErr, setRapErr] = useState(''),
    [q, setQ] = useState(''),
    [cam, setCam] = useState(false),
    [web, setWeb] = useState(null),
    [esc, setEsc] = useState(false),
    [verMas, setVerMas] = useState(false)
  const cod = esCodigo(q),
    texto = q.trim()
  const res = useMemo(() => {
    if (!texto) return []
    const l = cod ? base.find(a => a.fuenteId === soloDigitos(q)) : null
    return l ? [l] : buscar(base, q, 6)
  }, [q, base])
  const limpiar = () => {
    setQ('')
    setWeb(null)
  }
  const buscarWeb = async codigo => {
    const porCodigo = typeof codigo === 'string' ? codigo : null
    setWeb({estado: 'cargando'})
    try {
      setWeb({
        estado: 'ok',
        ...(porCodigo || cod
          ? {items: [await buscarCodigoOFF(porCodigo || q)], descartados: 0}
          : await buscarOFF(q))
      })
    } catch (e) {
      setWeb({estado: 'error', msg: e.message})
    }
  }
  // Código leído con la cámara: si ya está en tu base se muestra; si no, se consulta la web una vez.
  const alLeerCodigo = c => {
    c = canonico(c)
    setEsc(false)
    setQ(c)
    setWeb(null)
    if (!base.some(a => a.fuenteId === c)) buscarWeb(c)
  }
  const elegir = a => {
    agregar(conPorcion(itemDesde(a, a.porcion || 100, 'base'), a.porcion || 100))
    limpiar()
  }
  return (
    <section>
      <h3><Icono n="mas" tam={16} className="en-texto" /> Agregar</h3>
      <div className="row">
        <input
          className="fx"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Buscar alimento"
          placeholder="Buscar…"
          value={q}
          onChange={e => {
            setQ(e.target.value)
            setWeb(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && texto && !res.length) buscarWeb()
          }}
        />
        <button
          className={esc ? 'sel' : ''}
          aria-label="Escanear código de barras con la cámara"
          aria-expanded={esc}
          onClick={() => {
            setEsc(!esc)
            setCam(false)
          }}
        >
          <svg className="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <g fill="currentColor">
              <rect x="3" y="5" width="2" height="14" rx=".4" />
              <rect x="6.5" y="5" width="1" height="14" rx=".3" />
              <rect x="9" y="5" width="3" height="14" rx=".4" />
              <rect x="13.5" y="5" width="1" height="14" rx=".3" />
              <rect x="16" y="5" width="1.5" height="14" rx=".3" />
              <rect x="19" y="5" width="2" height="14" rx=".4" />
            </g>
          </svg>
        </button>
        <button
          className={cam ? 'sel' : ''}
          aria-label="Cámara: foto del plato o de una etiqueta"
          aria-expanded={cam}
          onClick={() => {
            setCam(!cam)
            setEsc(false)
          }}
        >
          <Icono n="camara" />
        </button>
      </div>
      {esc && <Escaner alLeer={alLeerCodigo} cerrar={() => setEsc(false)} />}
      {cam && (
        <div className="row" style={{marginTop: 8}}>
          {foto('plato', <><Icono n="plato" tam={18} className="en-texto" /> Foto del plato</>)}
          {foto('etiqueta', <><Icono n="etiqueta" tam={18} className="en-texto" /> Foto de etiqueta</>, true)}
        </div>
      )}
      {!texto && (
        <>
          {plant.length > 0 && (
            <div style={{marginTop: 10}}>
              <small className="tag"><Icono n="estrella" tam={16} className="en-texto" /> Comidas guardadas</small>
              <div className="row" style={{marginTop: 4}}>
                {plant.slice(0, 6).map(p => (
                  <button key={p.id} className="chip" onClick={() => usarPlantilla(p)}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <details style={{marginTop: 10}}>
            <summary className="tag"><Icono n="rayo" tam={16} className="en-texto" /> Estimar rápido (solo calorías y proteína)</summary>
            <div className="row" style={{marginTop: 6}}>
              <input
                style={{flex: 1, minWidth: 140}}
                type="text"
                maxLength={60}
                aria-label="Nombre (opcional)"
                placeholder="nombre (opcional)"
                value={rap.nombre}
                onChange={e => setRap({...rap, nombre: e.target.value})}
              />
              <input
                type="number"
                inputMode="decimal"
                aria-label="Calorías estimadas"
                placeholder="kcal"
                value={rap.kcal}
                onChange={e => setRap({...rap, kcal: e.target.value})}
              />
              <input
                type="number"
                inputMode="decimal"
                aria-label="Proteína estimada en gramos"
                placeholder="prot. g"
                value={rap.p}
                onChange={e => setRap({...rap, p: e.target.value})}
              />
              <button
                className="ghost"
                onClick={() => {
                  try {
                    agregar(itemRapido(rap))
                    setRap({nombre: '', kcal: '', p: ''})
                    setRapErr('')
                  } catch (e) {
                    setRapErr(e.message)
                  }
                }}
              >
                Agregar
              </button>
            </div>
            {rapErr && <small className="warn">{rapErr}</small>}
            <small className="mu" style={{display: 'block', marginTop: 4}}>
              Es una estimación, no un dato medido: se guarda como «estimado» y no crea ningún alimento en tu base.
            </small>
          </details>
          {atajos.length > 0 && (
            <div style={{marginTop: 10}}>
              <small className="tag">Recientes y frecuentes</small>
              <div className="atajos">
                {atajos.slice(0, verMas ? atajos.length : 3).map(a => (
                  <button
                    key={a.k}
                    className="atajo"
                    onClick={() =>
                      a.tipo === 'comida' ? usarComida(a.origen.comida) : agregar(itemDeSugerido(a.origen, base))
                    }
                  >
                    <span className="atajo-n">
                      {a.nombre}
                      {a.tipo === 'comida' && <small className="mu"> · comida de {a.alimentos}</small>}
                    </span>
                    <small className="mono atajo-v">
                      {a.kcal} kcal · {a.g} g
                    </small>
                  </button>
                ))}
              </div>
              {atajos.length > 3 && (
                <button className="enlace" aria-expanded={verMas} onClick={() => setVerMas(v => !v)}>
                  {verMas ? 'Ver menos' : `Ver más (${atajos.length - 3})`}
                </button>
              )}
            </div>
          )}
          {!atajos.length && !plant.length && (
            <p className="mu" style={{marginBottom: 0}}>
              Buscá un alimento, escaneá o escribí un código de barras, o sacá una foto. Lo que más
              cargues va a aparecer acá como atajo.
            </p>
          )}
        </>
      )}
      {texto && (
        <>
          {res.map(a => (
            <button key={a.id} className="ghost sug" onClick={() => elegir(a)}>
              <span>
                {a.fuente ? <><Icono n="web" tam={16} etiqueta="copiado de la web" className="en-texto" /> </> : null}
                {a.nombre}
              </span>
              <small className="mu">
                {a.kcal100} kcal/100 g · {a.porcion || 100} g
              </small>
            </button>
          ))}
          <div className="row" style={{marginTop: 8}}>
            {!(cod && res.length) && (
              <button
                className="ghost mini"
                disabled={web?.estado === 'cargando'}
                onClick={() => buscarWeb()}
              >
                <Icono n="web" tam={16} className="en-texto" /> {cod ? 'Buscar el código en la web' : 'Buscar en la web'}
              </button>
            )}
            <button
              className="ghost mini"
              onClick={() => {
                libre()
                limpiar()
              }}
            >
              <Icono n="mas" tam={16} className="en-texto" /> Libre
            </button>
            <button
              className="ghost mini"
              onClick={() => {
                nuevo(texto)
                limpiar()
              }}
            >
              Crear alimento
            </button>
          </div>
          {!res.length && !web && (
            <small className="mu" style={{display: 'block', marginTop: 6}}>
              No está en tu base. Probá en la web, cargalo libre o creá el alimento.
            </small>
          )}
          {web?.estado === 'cargando' && (
            <small className="mu" style={{display: 'block', marginTop: 6}}>
              Buscando en Open Food Facts…
            </small>
          )}
          {web?.estado === 'error' && <p className="warn">{web.msg}</p>}
          {web?.estado === 'ok' && (
            <div style={{marginTop: 6}}>
              {!web.items.length && <small className="mu">No encontré resultados en la web.</small>}
              {web.items.map((r, i) => (
                <div key={r.alimento.fuenteId || i}>
                  <button
                    className="ghost sug"
                    onClick={async () => {
                      await usarWeb(r)
                      limpiar()
                    }}
                  >
                    <span><Icono n="web" tam={16} className="en-texto" /> {r.alimento.nombre}</span>{' '}
                    <small className="mu">
                      {r.alimento.kcal100} kcal · Prot. {r.alimento.p100} · Carb. {r.alimento.c100} · Gras.{' '}
                      {r.alimento.g100} /100 g
                    </small>
                  </button>
                  {r.avisos.map((a, j) => (
                    <small key={j} className="warn">
                      <Icono n="alerta" tam={16} className="en-texto" /> {a}
                    </small>
                  ))}
                </div>
              ))}
              {web.descartados > 0 && (
                <small className="mu" style={{display: 'block'}}>
                  {web.descartados} resultado{web.descartados === 1 ? '' : 's'} sin datos
                  nutricionales válidos descartado{web.descartados === 1 ? '' : 's'}.
                </small>
              )}
              {web.items.length > 0 && (
                <small className="mu" style={{display: 'block', marginTop: 4}}>
                  Al elegir uno se copia a tu base (después funciona sin conexión y lo podés
                  corregir). {ATRIBUCION}
                </small>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function FormAlimento({f, setF, guardar, borrar, cancelar}) {
  const c = (k, l, t = 'number') => (
    <label className="campo">
      <small className="mu">{l}</small>
      <input
        type={t}
        inputMode={t === 'number' ? 'decimal' : undefined}
        step="any"
        value={f[k] ?? ''}
        onChange={e => setF({...f, [k]: e.target.value})}
      />
    </label>
  )
  return (
    <section>
      <h3>
        {f.id ? 'Editar alimento' : 'Nuevo alimento'}
        {f.origen === 'etiqueta' && !f.id ? ' (leído de la etiqueta: revisalo)' : ''}
      </h3>
      {f.fuente && (
        <small className="warn" style={{display: 'block', marginBottom: 6}}>
          <Icono n="web" tam={16} className="en-texto" /> {f.fuente}
          {f.fuenteId ? (
            <>
              {' '}
              · código{' '}
              <a
                href={'https://world.openfoodfacts.org/product/' + f.fuenteId}
                target="_blank"
                rel="noopener noreferrer"
              >
                {f.fuenteId}
              </a>
            </>
          ) : null}
          . Datos de la comunidad: corregí lo que no cuadre.
        </small>
      )}
      {f.fuenteId && !f.fuente && (
        <small className="mu" style={{display: 'block', marginBottom: 6}}>
          Código {f.fuenteId}: se guarda con el alimento, así la próxima vez que lo escanees sale
          de tu base.
        </small>
      )}
      {c('nombre', 'Nombre', 'text')}
      <div className="row">
        {c('kcal100', 'kcal / 100 g')}
        {c('p100', 'Proteínas g')}
        {c('c100', 'Carbohidratos g')}
        {c('g100', 'Grasas g')}
        {c('porcion', 'Porción habitual g')}
      </div>
      {!coherente(f) && (
        <small className="warn">
          <Icono n="alerta" tam={16} className="en-texto" /> Las calorías no cuadran con los macros: revisá los valores.
        </small>
      )}
      <div className="row" style={{marginTop: 10}}>
        <button className="pri" onClick={guardar}>
          {f.alAgregar && !f.id ? 'Guardar y agregar' : 'Guardar'}
        </button>
        <button className="ghost" onClick={cancelar}>
          Cancelar
        </button>
        {f.id && (
          <button className="ghost" onClick={borrar}>
            Borrar
          </button>
        )}
      </div>
    </section>
  )
}

const nuevoBor = () => ({
  momento: momentoPorHora(new Date().getHours()),
  items: [],
  fuente: 'manual'
})

export default function Comidas() {
  const [vista, setVista] = useState('diario'),
    [fecha, setFecha] = useState(hoy()),
    [cs, setCs] = useState([]),
    [base, setBase] = useState([]),
    [bor, setBor] = useState(null),
    [form, setForm] = useState(null),
    [msg, setMsg] = useState(''),
    [fx, setFx] = useState(null),
    [ocupado, setOcupado] = useState(false),
    [bq, setBq] = useState('')
  const [plant, setPlant] = useState([]),
    [hist, setHist] = useState([])
  const cargarBase = () =>
    db.alimentos
      .toArray()
      .then(a => setBase(a.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))))
  const cargarDia = () =>
    db.comidas
      .where('fecha')
      .equals(fecha)
      .toArray()
      .then(a => setCs(a.sort((x, y) => (x.hora || '').localeCompare(y.hora || ''))))
  const cargarPlant = () =>
    db.plantillas
      .toArray()
      .then(a =>
        setPlant(
          a.sort((x, y) => (y.usos || 0) - (x.usos || 0) || x.nombre.localeCompare(y.nombre, 'es'))
        )
      )
  const [peso, setPeso] = useState(null)
  useEffect(() => {
    db.medidas
      .toArray()
      .then(ms => setPeso(ultima(ms)?.peso ?? null))
      .catch(() => setPeso(null))
  }, [])
  const cargarHist = () =>
    db.comidas.where('fecha').aboveOrEqual(sumaDias(hoy(), -90)).toArray().then(setHist)
  useEffect(() => {
    sembrar().then(cargarBase)
    cargarPlant()
    cargarHist()
  }, [])
  useEffect(() => {
    cargarDia()
  }, [fecha])
  const meta = +cfg('metakcal', 2200) || 2200,
    tot = totales(cs.flatMap(c => c.items || [])),
    esHoy = fecha === hoy()
  const momentoAct = bor?.momento || momentoPorHora(new Date().getHours())
  const atajos = useMemo(
    () =>
      atajosRecientes(
        sugeridos(hist, momentoAct, {hoy: hoy(), n: 8}),
        comidasParecidas(hist, momentoAct, {hoy: hoy(), n: 5}),
        base,
        {n: 5}
      ),
    [hist, momentoAct, base]
  )
  const factorP = +String(cfg('protkg', PROT_KG)).replace(',', '.') || PROT_KG,
    metaP = proteinaObjetivo(peso, factorP),
    prot = faltaProteina(tot.p, metaP)
  const porcionBase = it => base.find(a => a.id === it.alimentoId)?.porcion || it.g
  const agregar = its =>
    setBor(b => {
      const x = b || nuevoBor()
      return {...x, items: [...x.items, ...[].concat(its)]}
    })

  const run = async (file, m) => {
    if (!cfg('key')) return setMsg('Cargá tu clave de IA en Ajustes')
    setFx({file, m})
    setOcupado(true)
    setMsg(m === 'plato' ? 'Analizando el plato…' : 'Leyendo la etiqueta…')
    try {
      if (m === 'plato') {
        const r = await leer(file, P_PLATO, setMsg, 'comida'),
          items = itemsDesdeEscaneo(r, base).map(it => conPorcion(it, porcionBase(it)))
        if (!items.length) setMsg('No vi alimentos en la foto. Probá con otra o agregalos a mano.')
        else {
          setBor(b => ({
            ...(b || nuevoBor()),
            fuente: b?.items?.length ? b.fuente : 'plato',
            nota: String(r.nota || '').slice(0, 200),
            items: [...(b?.items || []), ...items]
          }))
          setVista('diario')
          setMsg('')
        }
      } else {
        setForm({
          ...alimentoDesdeEtiqueta(await leer(file, P_ETIQ, setMsg, 'etiqueta')),
          alAgregar: true
        })
        setMsg('')
      }
    } catch (e) {
      setMsg('No pude leerla: ' + e.message)
    }
    setOcupado(false)
  }
  const foto = (m, txt, ghost) => (
    <label>
      <button
        className={ghost ? 'ghost' : ''}
        disabled={ocupado}
        onClick={e => e.currentTarget.nextSibling.click()}
      >
        {txt}
      </button>
      <input
        hidden
        type="file"
        accept="image/*"
        onChange={e => {
          const x = e.target.files[0]
          e.target.value = ''
          if (x) run(x, m)
        }}
      />
    </label>
  )

  const guardar = async () => {
    const items = bor.items.map(cerrar).filter(i => i.g > 0 && i.nombre)
    if (!items.length) return setMsg('Agregá al menos un alimento con nombre y gramos.')
    const reg = {
      fecha,
      hora: bor.hora || horaAhora(),
      momento: bor.momento,
      items,
      ...totales(items),
      fuente: bor.fuente || 'manual'
    }
    if (bor.id) await db.comidas.put({...reg, id: bor.id})
    else await db.comidas.add(reg)
    setBor(null)
    setFx(null)
    setMsg('Comida guardada.')
    sentir('guardar')
    cargarDia()
    cargarHist()
  }
  const guardarEnBase = async i => {
    const it = cerrar(bor.items[i]),
      al = {
        nombre: it.nombre,
        clave: claveAl(it.nombre),
        ...it.b,
        porcion: it.g || 100,
        origen: bor.items[i].origen === 'ia' ? 'ia' : 'propio'
      }
    const err = validarAlimento(al)
    if (err) return setMsg(err)
    if (base.some(a => a.clave === al.clave))
      return setMsg('Ya hay un alimento con ese nombre en tu base.')
    const id = await db.alimentos.add(al)
    await cargarBase()
    setBor(x => ({
      ...x,
      items: x.items.map((y, j) => (j === i ? {...y, alimentoId: id, origen: 'base'} : y))
    }))
    setMsg('Guardado en tu base.')
  }
  const borrarComida = async c => {
    if (confirm('¿Borrar esta comida?')) {
      await db.comidas.delete(c.id)
      cargarDia()
      cargarHist()
    }
  }
  const repetir = async c => {
    const {id, ...r} = c
    await db.comidas.add({...r, fecha: hoy(), hora: horaAhora()})
    setFecha(hoy())
    setMsg('Repetida en hoy.')
    sentir('guardar')
    if (fecha === hoy()) cargarDia()
    cargarHist()
  }
  const editar = c => {
    setBor({
      id: c.id,
      momento: c.momento,
      hora: c.hora,
      fuente: c.fuente,
      items: c.items.map(x => conPorcion({...x}, porcionBase(x)))
    })
    setMsg('')
    setVista('diario')
    scrollTo(0, 0)
  }

  // comidas guardadas
  const guardarPlantilla = async (items, momento, sugerido = '') => {
    const nombre = prompt(
      'Nombre para esta comida guardada (ej.: Mi desayuno de siempre)',
      sugerido
    )
    if (nombre === null) return
    try {
      const pl = plantillaDesdeItems(nombre, momento, items.map(cerrar)),
        ex = plant.find(p => p.clave === pl.clave)
      if (ex) {
        if (!confirm('Ya hay una comida guardada con ese nombre. ¿Reemplazarla?')) return
        await db.plantillas.put({...pl, id: ex.id, usos: ex.usos || 0})
      } else await db.plantillas.add(pl)
      await cargarPlant()
      setMsg('Guardada como «' + pl.nombre + '». La vas a ver en los atajos de Agregar.')
    } catch (e) {
      setMsg('No pude guardarla: ' + e.message)
    }
  }
  const usarComida = c => {
    setBor(b => {
      const x = b || nuevoBor()
      return {
        ...x,
        momento: b?.items?.length ? x.momento : c.momento || x.momento,
        items: [...x.items, ...itemsDeComida(c, base)]
      }
    })
    setVista('diario')
  }
  const usarPlantilla = async pl => {
    setBor(b => {
      const x = b || nuevoBor()
      return {
        ...x,
        momento: b?.items?.length ? x.momento : pl.momento || x.momento,
        items: [...x.items, ...itemsDePlantilla(pl, base)]
      }
    })
    setVista('diario')
    await db.plantillas.update(pl.id, {usos: (pl.usos || 0) + 1})
    cargarPlant()
  }
  const borrarPlantilla = async p => {
    if (
      confirm('¿Borrar la comida guardada «' + p.nombre + '»? Las comidas ya cargadas no cambian.')
    ) {
      await db.plantillas.delete(p.id)
      cargarPlant()
    }
  }

  // resultado de la web: se COPIA a tu base con la fuente anotada y se agrega al borrador
  const usarWeb = async r => {
    try {
      let a = r.alimento,
        ex = a.fuenteId ? base.find(x => x.fuenteId === a.fuenteId) : null
      if (!ex) {
        let nombre = a.nombre
        const libre = n => !base.some(x => x.clave === claveAl(n))
        if (!libre(nombre)) nombre = a.nombre + ' (OFF)'
        if (!libre(nombre)) nombre = a.nombre + ' (OFF ' + (a.fuenteId || '') + ')'
        const nuevo = {...a, nombre, clave: claveAl(nombre)}
        const id = await db.alimentos.add(nuevo)
        ex = {...nuevo, id}
        await cargarBase()
        setMsg('Copiado a tu base desde ' + FUENTE + '. Revisá los valores.')
      } else setMsg('Ese producto ya estaba en tu base.')
      agregar(conPorcion(itemDesde(ex, ex.porcion || 100, 'base'), ex.porcion || 100))
    } catch (e) {
      setMsg('No pude guardarlo en tu base: ' + e.message)
    }
  }

  const guardarForm = async () => {
    const al = {
      ...form,
      nombre: String(form.nombre || '').trim(),
      kcal100: n0(form.kcal100),
      p100: n0(form.p100),
      c100: n0(form.c100),
      g100: n0(form.g100),
      porcion: gramos(form.porcion) || 100,
      origen: form.origen === 'base' ? 'propio' : form.origen || 'propio'
    }
    const alAgregar = al.alAgregar
    delete al.alAgregar
    al.clave = claveAl(al.nombre)
    const err = validarAlimento(al)
    if (err) return setMsg(err)
    const dup = base.find(a => a.clave === al.clave && a.id !== al.id)
    if (dup) return setMsg('Ya existe «' + dup.nombre + '» en tu base.')
    let id = al.id
    if (al.id) await db.alimentos.put(al)
    else {
      delete al.id
      id = await db.alimentos.add(al)
    }
    setForm(null)
    setMsg('Guardado.')
    await cargarBase()
    if (alAgregar && !form.id) {
      agregar(conPorcion(itemDesde({...al, id}, al.porcion, 'base'), al.porcion))
      setVista('diario')
    }
  }
  const borrarAl = async () => {
    if (confirm('¿Borrar «' + form.nombre + '» de tu base? Las comidas ya guardadas no cambian.')) {
      await db.alimentos.delete(form.id)
      setForm(null)
      cargarBase()
    }
  }
  const restaurar = async () => {
    const n = await sembrar(true)
    await cargarBase()
    setMsg(n ? `Se repusieron ${n} alimentos iniciales.` : 'No faltaba ningún alimento inicial.')
  }
  const [filtro, setFiltro] = useState('todos')
  const uso = useMemo(() => usoDeAlimentos(hist), [hist])
  const lista = useMemo(
    () => listarAlimentos(bq.trim() ? buscar(base, bq, 60) : base, uso, filtro),
    [base, bq, uso, filtro]
  )
  const aviso = () =>
    msg ? <p className={msg.startsWith('No pude') ? 'warn' : 'mu'}>{msg}</p> : null
  const reintento = () =>
    fx && msg.startsWith('No pude') ? (
      <p>
        <button disabled={ocupado} onClick={() => run(fx.file, fx.m)}>
          <span className="btn-l">
            <Icono n="repetir" tam={18} /> Reintentar con la misma foto
          </span>
        </button>
      </p>
    ) : null
  const hayWeb = base.some(a => a.fuente)

  return (
    <>
      <div className="row" style={{marginBottom: 12}}>
        <button
          className={'chip' + (vista === 'diario' ? ' on' : '')}
          onClick={() => {
            setVista('diario')
            setMsg('')
          }}
        >
          Diario
        </button>
        <button
          className={'chip' + (vista === 'base' ? ' on' : '')}
          onClick={() => {
            setVista('base')
            setMsg('')
          }}
        >
          Mis alimentos ({base.length})
        </button>
      </div>

      {form ? (
        <>
          <FormAlimento
            f={form}
            setF={setForm}
            guardar={guardarForm}
            borrar={borrarAl}
            cancelar={() => {
              setForm(null)
              setMsg('')
            }}
          />
          {aviso()}
        </>
      ) : vista === 'diario' ? (
        <>
          <section>
            <NavFecha
              titulo={esHoy ? 'Hoy' : 'Día'}
              sub={fFecha(fecha)}
              anteriorLabel="Día anterior"
              siguienteLabel="Día siguiente"
              sinSiguiente={esHoy}
              onAnterior={() => setFecha(sumaDias(fecha, -1))}
              onSiguiente={() => setFecha(sumaDias(fecha, 1))}
            />
            <div className="big" style={{marginTop: 8}}>
              {tot.kcal}
              <small> / {meta} kcal</small>
            </div>
            <div className="bar">
              <i style={{width: Math.min(100, (tot.kcal / meta) * 100) + '%'}} />
            </div>
            {prot ? (
              <>
                <div className="lin prot-lin" style={{borderColor: 'var(--hero-ln)'}}>
                  <span>Proteína</span>
                  <span className="mono">
                    {fmt(tot.p)} / {metaP} g
                  </span>
                </div>
                <div className="bar">
                  <i style={{width: prot.pct + '%'}} />
                </div>
                <small className="mu">
                  {prot.cumplida
                    ? 'Meta de proteína cumplida.'
                    : `Faltan ${prot.falta} g para tu meta (orientativa: ${String(factorP).replace('.', ',')} g por kg).`}
                </small>
                <Macros t={tot} sinProteina />
              </>
            ) : (
              <>
                <Macros t={tot} />
                {peso === null && (
                  <small className="mu" style={{display: 'block', marginTop: 4}}>
                    Registrá tu peso (Hoy → tarjeta Cuerpo) y acá aparece tu meta de proteína.
                  </small>
                )}
              </>
            )}
          </section>
          <Agregar
            base={base}
            atajos={atajos}
            plant={plant}
            usarComida={usarComida}
            agregar={agregar}
            libre={() =>
              agregar({
                alimentoId: null,
                nombre: '',
                g: 100,
                porcion: 100,
                b: {kcal100: '', p100: '', c100: '', g100: ''},
                kcal: 0,
                p: 0,
                c: 0,
                gr: 0,
                origen: 'manual',
                libre: true
              })
            }
            nuevo={t =>
              setForm({
                nombre: esCodigo(t) ? '' : t,
                ...(esCodigo(t) ? {fuenteId: canonico(t)} : {}),
                kcal100: '',
                p100: '',
                c100: '',
                g100: '',
                porcion: 100,
                origen: 'propio',
                alAgregar: true
              })
            }
            usarPlantilla={usarPlantilla}
            usarWeb={usarWeb}
            foto={foto}
          />
          {bor && (
            <Borrador
              b={bor}
              setB={setBor}
              base={base}
              fecha={fecha}
              guardar={guardar}
              cancelar={() => {
                setBor(null)
                setMsg('')
              }}
              guardarEnBase={guardarEnBase}
              guardarPlantilla={guardarPlantilla}
            />
          )}
          {aviso()}
          {reintento()}
          {!bor && !cs.length && <p className="mu">Todavía no cargaste comidas este día.</p>}
          {cs.map(c => (
            <section key={c.id}>
              <div className="row" style={{justifyContent: 'space-between'}}>
                <b>
                  {c.momento} <small className="mu">{c.hora}</small>
                </b>
                <b className="mono">{c.kcal} kcal</b>
              </div>
              {c.items.map((it, i) => (
                <div className="lin alim" key={i}>
                  <span className="ic">
                    {base.find(a => a.id === it.alimentoId)?.fuente ? <Icono n="web" tam={16} etiqueta="copiado de la web" className="en-texto" /> : null}
                    {it.origen === 'ia' ? '≈' : ''}
                  </span>
                  <span>
                    {it.nombre} · {fmt(it.g)} g
                  </span>
                  <span className="mono kcal">{it.kcal} kcal</span>
                </div>
              ))}
              <Macros t={c} compacto />
              <div className="row" style={{marginTop: 8}}>
                <button className="ghost mini" onClick={() => editar(c)}>
                  Editar
                </button>
                <button className="ghost mini" onClick={() => repetir(c)}>
                  {esHoy ? 'Repetir' : 'Repetir hoy'}
                </button>
                <button
                  className="ghost mini"
                  onClick={() => guardarPlantilla(c.items, c.momento, c.momento)}
                >
                  <Icono n="estrella" tam={16} className="en-texto" /> Guardar
                </button>
                <button className="ghost mini" onClick={() => borrarComida(c)}>
                  Borrar
                </button>
              </div>
            </section>
          ))}
          {cs.some(c => c.items.some(i => i.origen === 'ia')) && (
            <small className="mu">≈ = valores estimados por la IA, no de tu base.</small>
          )}
          {cs.some(c => c.items.some(i => base.find(a => a.id === i.alimentoId)?.fuente)) && (
            <small className="mu" style={{display: 'block'}}>
              <Icono n="web" tam={16} className="en-texto" /> = alimento copiado de {FUENTE}.
            </small>
          )}
        </>
      ) : (
        <>
          <section>
            <div className="row">
              <button
                className="pri"
                onClick={() => {
                  setForm({
                    nombre: '',
                    kcal100: '',
                    p100: '',
                    c100: '',
                    g100: '',
                    porcion: 100,
                    origen: 'propio'
                  })
                  setMsg('')
                }}
              >
                <Icono n="mas" tam={16} className="en-texto" /> Nuevo alimento
              </button>
            </div>
            <small className="mu" style={{display: 'block', marginTop: 8}}>
              Acá corregís valores. Para cargar comidas usá «Agregar» en el Diario.
            </small>
            <input
              style={{width: '100%', marginTop: 10}}
              placeholder="Buscar alimento…"
              aria-label="Buscar en mis alimentos"
              value={bq}
              onChange={e => setBq(e.target.value)}
            />
            <div className="row" role="group" aria-label="Filtrar alimentos" style={{marginTop: 10}}>
              {FILTROS_ALIMENTOS.map(([k, n]) => (
                <button
                  key={k}
                  className={'chip' + (filtro === k ? ' on' : '')}
                  aria-pressed={filtro === k}
                  onClick={() => setFiltro(k)}
                >
                  {n}
                </button>
              ))}
            </div>
            <small className="mu leyenda">
              <span><Icono n="web" tam={16} className="en-texto" /> copiado de la web</span>
              <span>≈ estimado por IA o etiqueta</span>
              <span>Valores cada 100 g · ordenados por uso reciente</span>
            </small>
          </section>
          {aviso()}
          {reintento()}
          {plant.length > 0 && (
            <section>
              <h3><Icono n="estrella" tam={16} className="en-texto" /> Comidas guardadas</h3>
              {plant.map(p => {
                const its = itemsDePlantilla(p, base),
                  k = totales(its).kcal
                return (
                  <div className="fila" key={p.id}>
                    <div className="row" style={{justifyContent: 'space-between'}}>
                      <b>{p.nombre}</b>
                      <span className="mono">{k} kcal</span>
                    </div>
                    <small className="mu">
                      {p.momento} · {its.map(i => i.nombre).join(', ')}
                    </small>
                    <div className="row">
                      <button className="ghost mini" onClick={() => usarPlantilla(p)}>
                        Usar hoy
                      </button>
                      <button className="ghost mini" onClick={() => borrarPlantilla(p)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
          <section>
            {lista.map(a => (
              <div
                className="lin alim"
                key={a.id}
                onClick={() => {
                  setForm({...a})
                  setMsg('')
                }}
                style={{cursor: 'pointer'}}
              >
                <span className="ic">
                  {a.fuente ? <Icono n="web" tam={16} etiqueta="copiado de la web" className="en-texto" /> : null}
                  {a.origen === 'ia' || a.origen === 'etiqueta' ? '≈' : ''}
                </span>
                <span>{a.nombre}</span>
                <span className="mono kcal">{a.kcal100} kcal</span>
              </div>
            ))}
            {!lista.length && (
              <p className="mu">
                {filtro === 'frecuentes'
                  ? `Todavía no hay alimentos que hayas usado ${MIN_FRECUENTE} veces o más en los últimos 90 días.`
                  : 'No hay alimentos con ese nombre o filtro.'}
              </p>
            )}
            <small className="mu" style={{display: 'block', marginTop: 8}}>
              Los iniciales son referencias aproximadas: corregilos con tus datos. Frecuentes = usados {MIN_FRECUENTE} veces o
              más en 90 días.
            </small>
            {hayWeb && (
              <small className="mu" style={{display: 'block', marginTop: 4}}>
                {ATRIBUCION}
              </small>
            )}
          </section>
          <details className="avanzado">
            <summary className="tag">Avanzado</summary>
            <p className="mu" style={{margin: '8px 0'}}>
              Vuelve a agregar los alimentos iniciales que hayas borrado. No toca los que ya tenés ni tus comidas.
            </p>
            <button onClick={restaurar}>Reponer alimentos iniciales</button>
          </details>
        </>
      )}
    </>
  )
}
