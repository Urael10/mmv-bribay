// Menú privado «Bienestar»: se abre con 5 toques en la versión del encabezado. Datos cifrados, clave solo en memoria.
import {useState, useEffect, useRef, useCallback} from 'react'
import {hoy} from '../../data/db'
import {hayClave, crearClave, abrir, leerMes, guardarMes, leerTodo, cambiarClave, borrarTodo} from '../../data/privado'
import {
  BLOQUEO_SEG,
  CLAVE_MIN,
  CLAVE_BUENA,
  ponerDia,
  quitarDia,
  agregarEv,
  quitarEv,
  mesDe,
  mesDeEv,
  historial,
  validarClave,
  claveDebil,
  debeBloquear,
  fechaLocal
} from '../../domain/privado'

const fF = f => f.split('-').reverse().join('/').slice(0, 5)
const fH = iso => new Date(iso).toLocaleTimeString('es-UY', {hour: '2-digit', minute: '2-digit', hour12: false})
const aLocalInput = iso => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)
}
const CTX = {pareja: 'en pareja', solo: 'a solas'}

function Crear({onListo}) {
  const [a, setA] = useState(''),
    [b, setB] = useState(''),
    [ok, setOk] = useState(false),
    [err, setErr] = useState(''),
    [ocupado, setOcupado] = useState(false)
  const crear = async () => {
    const e = validarClave(a, b)
    if (e) return setErr(e)
    if (!ok) return setErr('Marcá que entendés que la clave no se puede recuperar.')
    setOcupado(true)
    try {
      onListo(await crearClave(a))
    } catch {
      setErr('No se pudo crear la clave. Tus datos no se tocaron.')
      setOcupado(false)
    }
  }
  return (
    <section>
      <h3>Crear tu clave</h3>
      <p className="mu">
        Lo que anotes acá se guarda <b>cifrado</b> en este dispositivo. No aparece en Hoy, Progreso, el informe, el coach
        ni lo ve la IA, y en el backup viaja ilegible.
      </p>
      <label className="mu">
        Clave (mejor una frase de {CLAVE_BUENA} o más caracteres)
        <input type="password" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} />
      </label>
      <label className="mu">
        Repetí la clave
        <input type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} />
      </label>
      {a.length >= CLAVE_MIN && claveDebil(a) && (
        <small className="warn">
          Una clave corta frena a quien curiosea tu celular, pero no a quien copie el archivo y pruebe combinaciones.
        </small>
      )}
      <p>
        <label className="check">
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
          <span>
            Entiendo que si olvido la clave <b>no hay forma de recuperar estos datos</b>.
          </span>
        </label>
      </p>
      {err && <small className="warn">{err}</small>}
      <button className="pri" disabled={ocupado} onClick={crear}>
        {ocupado ? 'Creando…' : 'Crear y abrir'}
      </button>
    </section>
  )
}

function Bloqueado({onAbrir, onBorrado}) {
  const [c, setC] = useState(''),
    [err, setErr] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [fallos, setFallos] = useState(0),
    [olvide, setOlvide] = useState(false),
    [txt, setTxt] = useState('')
  const entrar = async () => {
    setOcupado(true)
    setErr('')
    const k = await abrir(c)
    if (k) return onAbrir(k)
    const n = fallos + 1
    setFallos(n)
    setErr('Clave incorrecta.')
    await new Promise(r => setTimeout(r, Math.min(n, 5) * 1000)) // espera creciente entre intentos
    setOcupado(false)
    setC('')
  }
  return (
    <section>
      <h3>Bienestar</h3>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (c && !ocupado) entrar()
        }}
      >
        <label className="mu">
          Clave
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={c}
            onChange={e => setC(e.target.value)}
          />
        </label>
        {err && <small className="warn">{err}</small>}
        <div className="row" style={{marginTop: 8}}>
          <button className="pri" type="submit" disabled={!c || ocupado}>
            {ocupado ? 'Abriendo…' : 'Abrir'}
          </button>
        </div>
      </form>
      <details style={{marginTop: 14}} open={olvide} onToggle={e => setOlvide(e.currentTarget.open)}>
        <summary>Olvidé la clave</summary>
        <p className="mu">
          No hay recuperación: es lo que impide que otra persona lea tus datos. Lo único posible es{' '}
          <b>borrar todo el registro privado</b> y empezar de cero. Escribí BORRAR para confirmar.
        </p>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="BORRAR" />
        <button
          className="ghost"
          disabled={txt !== 'BORRAR'}
          onClick={async () => {
            await borrarTodo()
            onBorrado()
          }}
        >
          Borrar todo y empezar de nuevo
        </button>
      </details>
    </section>
  )
}

const Escala = ({n, valor, onElegir, nombre}) => (
  <div className="escala" role="group" aria-label={nombre}>
    {Array.from({length: n}, (_, i) => i + 1).map(v => (
      <button key={v} className={valor === v ? 'on' : ''} aria-pressed={valor === v} onClick={() => onElegir(valor === v ? null : v)}>
        {v}
      </button>
    ))}
  </div>
)

function Registro({clave, bloques, recargar}) {
  const [fecha, setFecha] = useState(hoy()),
    [ctx, setCtx] = useState(null),
    [err, setErr] = useState(''),
    [dia, setDia] = useState({})
  // El día elegido se lee de su mes (puede ser más viejo que los meses cargados para el historial).
  useEffect(() => {
    let vivo = true
    leerMes(clave, mesDe(fecha)).then(b => vivo && setDia(b.dias[fecha] || {}))
    return () => {
      vivo = false
    }
  }, [clave, fecha, bloques])
  const mod = async (mes, fn) => {
    try {
      const b = fn(await leerMes(clave, mes))
      await guardarMes(clave, mes, b)
      setErr('')
      await recargar()
    } catch (e) {
      setErr(String(e.message || e))
    }
  }
  const cambiar = parche => mod(mesDe(fecha), b => ponerDia(b, fecha, parche))
  const hecho = () =>
    mod(mesDe(fechaLocal(new Date().toISOString())), b => agregarEv(b, {t: new Date().toISOString(), ctx}))
  return (
    <section>
      <h3>Registro</h3>
      <label className="mu">
        Día{' '}
        <input type="date" value={fecha} max={hoy()} onChange={e => e.target.value && setFecha(e.target.value)} />
      </label>
      <b style={{fontSize: 14}}>Erección matutina</b>
      <div className="escala" role="group" aria-label="Erección matutina">
        {[
          [true, 'Sí'],
          [false, 'No']
        ].map(([v, n]) => (
          <button
            key={n}
            className={dia.man === v ? 'on' : ''}
            aria-pressed={dia.man === v}
            onClick={() => cambiar({man: dia.man === v ? null : v, dur: null})}
          >
            {n}
          </button>
        ))}
      </div>
      {dia.man === true && (
        <>
          <b style={{fontSize: 14}}>Dureza (1 a 4)</b>
          <Escala n={4} valor={dia.dur} nombre="Dureza" onElegir={v => cambiar({dur: v})} />
          <small className="mu">1 = no alcanza para penetrar · 4 = completamente dura (escala EHS).</small>
        </>
      )}
      <b style={{fontSize: 14}}>Libido del día (1 a 5)</b>
      <Escala n={5} valor={dia.lib} nombre="Libido" onElegir={v => cambiar({lib: v})} />
      <small>
        <span>baja</span>
        <span>alta</span>
      </small>
      <b style={{fontSize: 14}}>Eyaculación</b>
      <div className="row" style={{margin: '6px 0'}}>
        {[
          [null, 'Sin indicar'],
          ['pareja', 'En pareja'],
          ['solo', 'A solas']
        ].map(([v, n]) => (
          <button key={n} className={'chip' + (ctx === v ? ' on' : '')} onClick={() => setCtx(v)}>
            {n}
          </button>
        ))}
      </div>
      <button className="pri" onClick={hecho}>
        ＋ Registrar ahora
      </button>
      <small className="mu" style={{display: 'block', marginTop: 8}}>
        La hora se puede corregir en el historial.
      </small>
      {err && <small className="warn">{err}</small>}
    </section>
  )
}

function Historial({clave, bloques, recargar, onVer}) {
  const filas = historial(bloques, 60),
    [edit, setEdit] = useState(null),
    [val, setVal] = useState('')
  const guardarHora = async e => {
    const nuevo = new Date(val)
    if (isNaN(nuevo)) return
    const viejoMes = mesDeEv(e),
      iso = nuevo.toISOString(),
      nuevoMes = mesDe(fechaLocal(iso))
    const bv = quitarEv(await leerMes(clave, viejoMes), e.id)
    if (viejoMes === nuevoMes) await guardarMes(clave, viejoMes, agregarEv(bv, {...e, t: iso}))
    else {
      await guardarMes(clave, viejoMes, bv)
      await guardarMes(clave, nuevoMes, agregarEv(await leerMes(clave, nuevoMes), {id: e.id, t: iso, ctx: e.ctx}))
    }
    setEdit(null)
    await recargar()
  }
  const borrarEv = async e => {
    if (!confirm('¿Borrar este registro?')) return
    await guardarMes(clave, mesDeEv(e), quitarEv(await leerMes(clave, mesDeEv(e)), e.id))
    await recargar()
  }
  const borrarDia = async f => {
    if (!confirm('¿Borrar los datos de este día?')) return
    await guardarMes(clave, mesDe(f.fecha), quitarDia(await leerMes(clave, mesDe(f.fecha)), f.fecha))
    await recargar()
  }
  return (
    <section>
      <h3>Historial (últimos 6 meses)</h3>
      {!filas.length && <small className="mu">Todavía no anotaste nada.</small>}
      {filas.map(f =>
        f.tipo === 'dia' ? (
          <div className="lin" key={'d' + f.fecha}>
            <span>
              <b className="mono">{fF(f.fecha)}</b> ·{' '}
              {[
                f.man === true ? 'erección matutina' + (f.dur ? ` (dureza ${f.dur})` : '') : f.man === false ? 'sin erección matutina' : null,
                f.lib ? `libido ${f.lib}` : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="row">
              <button className="ghost mini" onClick={() => onVer(f.fecha)}>
                Editar
              </button>
              <button className="ghost mini" aria-label="Borrar día" onClick={() => borrarDia(f)}>
                ✕
              </button>
            </span>
          </div>
        ) : (
          <div className="lin" key={'e' + f.id}>
            {edit === f.id ? (
              <span className="row">
                <input type="datetime-local" value={val} max={aLocalInput(new Date().toISOString())} onChange={e => setVal(e.target.value)} />
                <button className="mini" onClick={() => guardarHora(f)}>
                  Guardar
                </button>
                <button className="ghost mini" onClick={() => setEdit(null)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <>
                <span>
                  <b className="mono">{fF(f.fecha)}</b> · {fH(f.t)} · eyaculación{f.ctx ? ' ' + CTX[f.ctx] : ''}
                </span>
                <span className="row">
                  <button
                    className="ghost mini"
                    onClick={() => {
                      setEdit(f.id)
                      setVal(aLocalInput(f.t))
                    }}
                  >
                    Hora
                  </button>
                  <button className="ghost mini" aria-label="Borrar registro" onClick={() => borrarEv(f)}>
                    ✕
                  </button>
                </span>
              </>
            )}
          </div>
        )
      )}
    </section>
  )
}

function Clave({clave, onNueva, onBorrado}) {
  const [a, setA] = useState(''),
    [b, setB] = useState(''),
    [msg, setMsg] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [txt, setTxt] = useState('')
  const cambiar = async () => {
    const e = validarClave(a, b)
    if (e) return setMsg(e)
    setOcupado(true)
    try {
      onNueva(await cambiarClave(clave, a))
      setA('')
      setB('')
      setMsg('✔ Clave cambiada. Todo el registro quedó cifrado con la nueva.')
    } catch {
      setMsg('No se pudo cambiar la clave; no se modificó nada.')
    }
    setOcupado(false)
  }
  return (
    <section>
      <h3>Clave y datos</h3>
      <label className="mu">
        Clave nueva
        <input type="password" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} />
      </label>
      <label className="mu">
        Repetila
        <input type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} />
      </label>
      {a.length >= CLAVE_MIN && claveDebil(a) && <small className="warn">Mejor una frase de {CLAVE_BUENA} o más caracteres.</small>}
      <div className="row" style={{marginTop: 8}}>
        <button className="pri" disabled={ocupado || !a} onClick={cambiar}>
          {ocupado ? 'Cambiando…' : 'Cambiar clave'}
        </button>
      </div>
      {msg && <small className="tag">{msg}</small>}
      <details style={{marginTop: 14}}>
        <summary>Borrar todo el registro privado</summary>
        <p className="mu">No se puede deshacer. Escribí BORRAR para confirmar.</p>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="BORRAR" />
        <button
          className="ghost"
          disabled={txt !== 'BORRAR'}
          onClick={async () => {
            await borrarTodo()
            onBorrado()
          }}
        >
          Borrar todo
        </button>
      </details>
    </section>
  )
}

function Abierto({clave, onBloquear, onNueva, onBorrado}) {
  const [vista, setVista] = useState('registro'),
    [bloques, setBloques] = useState(null)
  const recargar = useCallback(async () => setBloques(await leerTodo(clave, 6)), [clave])
  useEffect(() => {
    recargar()
  }, [recargar])
  if (!bloques) return <small className="mu">Abriendo…</small>
  return (
    <>
      <div className="row pestanas" style={{marginBottom: 8}}>
        {[
          ['registro', 'Registro'],
          ['historial', 'Historial'],
          ['clave', 'Clave']
        ].map(([k, n]) => (
          <button key={k} className={'chip' + (vista === k ? ' on' : '')} onClick={() => setVista(k)}>
            {n}
          </button>
        ))}
        <button className="ghost mini bloquear" onClick={onBloquear}>
          🔒 Bloquear
        </button>
      </div>
      {vista === 'registro' && <Registro clave={clave} bloques={bloques} recargar={recargar} />}
      {vista === 'historial' && <Historial clave={clave} bloques={bloques} recargar={recargar} onVer={() => setVista('registro')} />}
      {vista === 'clave' && <Clave clave={clave} onNueva={onNueva} onBorrado={onBorrado} />}
      <small className="mu">
        Se bloquea solo a los {BLOQUEO_SEG} s en segundo plano y al salir. Nada de acá va a la IA, al informe ni al coach.
      </small>
    </>
  )
}

export default function Bienestar({onSalir}) {
  const [estado, setEstado] = useState('cargando'),
    [clave, setClave] = useState(null),
    oculto = useRef(null)
  const iniciar = useCallback(async () => setEstado((await hayClave()) ? 'bloqueado' : 'crear'), [])
  useEffect(() => {
    iniciar()
  }, [iniciar])
  // Autobloqueo (H7): al pasar a segundo plano se anota la hora; al volver, si pasó el tiempo, se descarta la clave.
  useEffect(() => {
    const f = () => {
      if (document.hidden) oculto.current = Date.now()
      else {
        if (debeBloquear(oculto.current, Date.now())) {
          setClave(null)
          iniciar()
        }
        oculto.current = null
      }
    }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f) // al salir del menú, la clave en memoria se pierde
  }, [iniciar])
  const abierto = estado !== 'cargando' && clave
  return (
    <div className="priv">
      <div className="row" style={{marginBottom: 8}}>
        <b className="mono">Bienestar</b>
        <button className="ghost mini" style={{marginLeft: 'auto'}} onClick={onSalir}>
          Salir
        </button>
      </div>
      {estado === 'cargando' && <small className="mu">…</small>}
      {estado === 'crear' && !clave && <Crear onListo={k => (setClave(k), setEstado('abierto'))} />}
      {estado === 'bloqueado' && !clave && <Bloqueado onAbrir={k => (setClave(k), setEstado('abierto'))} onBorrado={iniciar} />}
      {abierto && (
        <Abierto
          clave={clave}
          onBloquear={() => {
            setClave(null)
            iniciar()
          }}
          onNueva={setClave}
          onBorrado={() => {
            setClave(null)
            iniciar()
          }}
        />
      )}
    </div>
  )
}
