// Biblioteca de ejercicios: modo «gestion» (agregar, renombrar, patrón, quitar) y modo «elegir» (agregar a un bloque con un toque).
import {nombreEjercicio} from '../../domain/formato'
import {useState, useEffect, useCallback, useMemo} from 'react'
import {PATRONES, patron as patronAuto} from '../../domain/stats'
import {filtrarBiblioteca, validarNombre} from '../../domain/biblioteca'
import {listar, sincronizar, agregar, renombrar, cambiarPatron, cambiarUni, borrar} from '../../data/biblioteca'

const MAX_FILAS = 60

function Fila({e, claves, onCambio, setMsg}) {
  const [texto, setTexto] = useState(e.nombre),
    [ocupado, setOcupado] = useState(false)
  const auto = patronAuto(e.nombre, '', undefined)
  const guardar = async () => {
    const v = validarNombre(texto, claves, {claveActual: e.clave, fusionar: true})
    if (!v.ok) return setMsg(v.error)
    if (v.nombre === e.nombre) return setMsg('Es el mismo nombre.')
    if (v.fusiona && !confirm(`«${v.nombre}» ya está en la biblioteca. ¿Fusionarlos? El historial de los dos se junta y no se puede deshacer.`)) return
    setOcupado(true)
    try {
      const r = await renombrar(e.clave, texto, {fusionar: v.fusiona})
      setMsg(
        `✔ «${e.nombre}» ahora es «${r.nombre}»: ${r.registros} ${r.registros === 1 ? 'registro' : 'registros'}, ${r.sesiones} ${r.sesiones === 1 ? 'sesión' : 'sesiones'}, ${r.plantillas} ${r.plantillas === 1 ? 'plantilla' : 'plantillas'}${r.enCurso ? ' y la sesión en curso' : ''}.`
      )
      onCambio(true)
    } catch (err) {
      setMsg(err.message)
    }
    setOcupado(false)
  }
  return (
    <details className="bibfila">
      <summary>
        <b>{nombreEjercicio(e.nombre)}</b>
        <small className="mu">
          {' '}
          · {e.patron || auto}
          {e.patron ? '' : ' (auto)'}
          {e.uni ? ' · un lado por vez' : ''}
        </small>
      </summary>
      <label className="mu">
        Nombre
        <input type="text" value={texto} maxLength={70} onChange={x => setTexto(x.target.value)} />
      </label>
      <div className="row" style={{margin: '6px 0'}}>
        <button disabled={ocupado} onClick={guardar}>
          {ocupado ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </div>
      <small className="mu" style={{display: 'block'}}>
        Cambia el nombre también en tus registros, sesiones guardadas y plantillas.
      </small>
      <label className="mu">
        Patrón de movimiento
        <select
          value={e.patron || 'auto'}
          onChange={async x => {
            await cambiarPatron(e.clave, x.target.value)
            onCambio()
          }}
        >
          <option value="auto">Automático ({auto})</option>
          {PATRONES.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="row" style={{gap: 8, margin: '6px 0'}}>
        <input
          type="checkbox"
          checked={!!e.uni}
          style={{width: 22, height: 22}}
          onChange={async x => {
            await cambiarUni(e.clave, x.target.checked)
            onCambio()
          }}
        />
        <span>Un lado por vez (izquierda / derecha)</span>
      </label>
      <button
        className="ghost mini"
        onClick={async () => {
          if (!confirm(`¿Sacar «${e.nombre}» de la biblioteca? Tus registros y sesiones no se tocan.`)) return
          await borrar(e.clave)
          setMsg(`«${e.nombre}» salió de la biblioteca.`)
          onCambio()
        }}
      >
        Quitar de la biblioteca
      </button>
    </details>
  )
}

export default function Biblioteca({modo = 'gestion', onCerrar, onElegir, onCambio}) {
  const [lista, setLista] = useState(null),
    [q, setQ] = useState(''),
    [msg, setMsg] = useState(''),
    [nuevo, setNuevo] = useState({nombre: '', patron: 'auto', uni: false}),
    [puestos, setPuestos] = useState(() => new Set())
  const cargar = useCallback(async () => setLista(await listar()), [])
  useEffect(() => {
    sincronizar().then(cargar, cargar)
  }, [cargar])
  const claves = useMemo(() => new Set((lista || []).map(e => e.clave)), [lista])
  const vista = useMemo(() => filtrarBiblioteca(lista, q), [lista, q])
  const elegir = modo === 'elegir'
  const poner = nombre => {
    onElegir(nombre)
    setPuestos(p => new Set(p).add(nombre))
  }
  const crear = async () => {
    try {
      const f = await agregar({nombre: nuevo.nombre, patron: nuevo.patron, uni: nuevo.uni})
      setMsg(`✔ «${f.nombre}» agregado a la biblioteca.`)
      setNuevo({nombre: '', patron: 'auto', uni: false})
      if (elegir) poner(f.nombre)
      await cargar()
    } catch (e) {
      setMsg(e.message)
    }
  }
  return (
    <div className="bib">
      <div className="row" style={{marginBottom: 8}}>
        <b className="mono">📚 {elegir ? 'Agregar al bloque' : 'Biblioteca de ejercicios'}</b>
        <button className="ghost mini" style={{marginLeft: 'auto'}} onClick={onCerrar}>
          {elegir ? 'Listo' : 'Cerrar'}
        </button>
      </div>
      <section>
        <input
          type="search"
          placeholder="Buscar ejercicio…"
          aria-label="Buscar ejercicio"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {msg && (
          <p role="status" style={{margin: '8px 0 0'}}>
            {msg}
          </p>
        )}
      </section>
      <section>
        <h3>＋ Ejercicio nuevo</h3>
        <label className="mu">
          Nombre
          <input
            type="text"
            value={nuevo.nombre}
            maxLength={70}
            placeholder="Ej.: Sentadilla búlgara"
            onChange={e => setNuevo({...nuevo, nombre: e.target.value})}
          />
        </label>
        <details>
          <summary className="tag">Más (patrón, un lado por vez)</summary>
          <label className="mu">
            Patrón de movimiento
            <select value={nuevo.patron} onChange={e => setNuevo({...nuevo, patron: e.target.value})}>
              <option value="auto">Automático</option>
              {PATRONES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="row" style={{gap: 8, margin: '6px 0'}}>
            <input
              type="checkbox"
              checked={nuevo.uni}
              style={{width: 22, height: 22}}
              onChange={e => setNuevo({...nuevo, uni: e.target.checked})}
            />
            <span>Un lado por vez</span>
          </label>
        </details>
        <button disabled={!nuevo.nombre.trim()} onClick={crear}>
          {elegir ? 'Agregar y usar' : 'Agregar'}
        </button>
      </section>
      <section>
        <h3>
          {lista ? `${vista.length} ${vista.length === 1 ? 'ejercicio' : 'ejercicios'}` : 'Cargando…'}
          {q && lista ? ` de ${lista.length}` : ''}
        </h3>
        {lista && !lista.length && (
          <small className="mu">
            Todavía no hay ejercicios. Se completa sola con lo que guardes en tus sesiones, o agregá uno arriba.
          </small>
        )}
        {vista.slice(0, MAX_FILAS).map(e =>
          elegir ? (
            <div className="lin" key={e.clave}>
              <span>
                <b>{nombreEjercicio(e.nombre)}</b>
                <small className="mu"> · {e.patron || patronAuto(e.nombre, '', undefined)}</small>
              </span>
              <button className={puestos.has(e.nombre) ? 'ghost mini' : 'mini'} onClick={() => poner(e.nombre)}>
                {puestos.has(e.nombre) ? '✓ Otra vez' : '＋ Agregar'}
              </button>
            </div>
          ) : (
            <Fila
              key={e.clave}
              e={e}
              claves={claves}
              setMsg={setMsg}
              onCambio={async cambioHistorial => {
                if (cambioHistorial) onCambio?.()
                await cargar()
              }}
            />
          )
        )}
        {vista.length > MAX_FILAS && <small className="mu">Mostrando {MAX_FILAS}: escribí en el buscador para ver el resto.</small>}
      </section>
    </div>
  )
}
