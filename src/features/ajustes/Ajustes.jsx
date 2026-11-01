import {useState, useEffect} from 'react'
import {db, hoy, cfg, setCfg} from '../../data/db'
import {exportar, restaurar, puedeCompartir, ultimoBackup} from '../../data/backup'
import {diasDesde} from '../../domain/backup'
import {INFO, fechaBuild, buscarActualizacion, actualizarAhora} from '../../version'

function Version() {
  const [r, setR] = useState(null),
    [b, setB] = useState(false),
    [pe, setPe] = useState(null)
  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPe)
      .catch(() => {})
  }, [])
  const ver = async () => {
    setB(true)
    setR((await buscarActualizacion()) || 'offline')
    setB(false)
  }
  return (
    <section>
      <h3>Versión instalada</h3>
      <div className="lin">
        <span>Versión</span>
        <span className="mono">v{INFO.version}</span>
      </div>
      <div className="lin">
        <span>Entrega</span>
        <span className="mono">{INFO.entrega}</span>
      </div>
      <div className="lin">
        <span>Compilada</span>
        <span className="mono">{fechaBuild()}</span>
      </div>
      <div className="lin">
        <span>Dirección</span>
        <span className="mono">{location.host || 'local'}</span>
      </div>
      {pe !== null && (
        <div className="lin">
          <span>Datos protegidos</span>
          <span className="mono">{pe ? 'sí' : 'no'}</span>
        </div>
      )}
      <div className="row" style={{marginTop: 10}}>
        <button className="ghost" disabled={b} onClick={ver}>
          {b ? 'Buscando…' : 'Buscar actualización'}
        </button>
        {r && r.nueva && <button onClick={actualizarAhora}>Actualizar ahora</button>}
      </div>
      {r === 'offline' && (
        <small className="mu">No pude consultar la versión publicada (¿sin conexión?).</small>
      )}
      {r && r !== 'offline' && !r.nueva && (
        <small className="tag">✔ Tenés la última versión publicada.</small>
      )}
      {r && r.nueva && (
        <small className="delta up" style={{display: 'block', marginTop: 6}}>
          Publicada: v{r.remota.version} · {r.remota.entrega} · {fechaBuild(r.remota.build)}
        </small>
      )}
    </section>
  )
}

function UsoIA() {
  const [n, setN] = useState(null)
  useEffect(() => {
    db.uso.where('fecha').startsWith(hoy().slice(0, 7)).count().then(setN)
  }, [])
  return (
    <section>
      <h3>Uso de IA este mes</h3>
      <div className="big">
        {n ?? '–'}
        <small> consultas</small>
      </div>
    </section>
  )
}

function Respaldo() {
  const [msg, setMsg] = useState(''),
    [ult, setUlt] = useState(ultimoBackup()),
    d = diasDesde(ult)
  const hacer = async compartir => {
    const r = await exportar({compartir})
    setUlt(ultimoBackup())
    setMsg(
      r === 'compartido'
        ? '✔ Backup compartido.'
        : r === 'descargado'
          ? '✔ Backup descargado (revisá la carpeta Descargas).'
          : 'Cancelado.'
    )
  }
  const imp = async e => {
    const x = e.target.files[0]
    e.target.value = ''
    if (!x) return
    try {
      const om = await restaurar(JSON.parse(await x.text()))
      alert('Backup importado' + (om ? ` (${om} registros repetidos se omitieron)` : ''))
    } catch (err) {
      alert('No pude importar ese archivo: ' + err.message)
    }
  }
  return (
    <section>
      <h3>Backup</h3>
      <p>
        Tus datos viven solo en este dispositivo.{' '}
        {d === null ? (
          <b>Todavía no hiciste ningún backup.</b>
        ) : (
          <>Último backup: {d === 0 ? 'hoy' : `hace ${d} ${d === 1 ? 'día' : 'días'}`}.</>
        )}
      </p>
      <div className="row">
        {puedeCompartir() && <button onClick={() => hacer(true)}>Compartir backup</button>}
        <button className={puedeCompartir() ? 'ghost' : ''} onClick={() => hacer(false)}>
          Descargar backup
        </button>
        <label>
          <button className="ghost" onClick={e => e.currentTarget.nextSibling.click()}>
            Importar backup
          </button>
          <input hidden type="file" accept="application/json" onChange={imp} />
        </label>
      </div>
      {msg && <small className="tag">{msg}</small>}
    </section>
  )
}

export default function Ajustes() {
  const [k, setK] = useState(cfg('key')),
    [m, setM] = useState(cfg('modelo', 'gemini-3.8-flash')),
    [a, setA] = useState(cfg('meta', 2500)),
    [kc, setKc] = useState(cfg('metakcal', 2200)),
    [so, setSo] = useState(cfg('sonido', '1') !== '0')
  return (
    <>
      <Version />
      <Respaldo />
      <UsoIA />
      <section>
        <h3>Ajustes</h3>
        <p>Clave de IA (Google AI Studio, plan gratuito). Se guarda solo en este dispositivo.</p>
        <input
          style={{width: '100%'}}
          type="password"
          value={k}
          placeholder="API key"
          onChange={e => {
            setK(e.target.value)
            setCfg('key', e.target.value)
          }}
        />
        <p>Modelo</p>
        <input
          style={{width: '100%'}}
          list="mods"
          value={m}
          onChange={e => {
            setM(e.target.value)
            setCfg('modelo', e.target.value)
          }}
        />
        <datalist id="mods">
          <option value="gemini-3.8-flash" />
          <option value="gemini-flash-latest" />
        </datalist>
        <p>Meta de agua (ml)</p>
        <input
          type="number"
          value={a}
          onChange={e => {
            setA(e.target.value)
            setCfg('meta', e.target.value)
          }}
        />
        <p>Meta de calorías (kcal por día)</p>
        <input
          type="number"
          value={kc}
          onChange={e => {
            setKc(e.target.value)
            setCfg('metakcal', e.target.value)
          }}
        />
        <p>
          <label>
            <input
              type="checkbox"
              checked={so}
              onChange={e => {
                setSo(e.target.checked)
                setCfg('sonido', e.target.checked ? '1' : '0')
              }}
            />{' '}
            Sonido del temporizador
          </label>
        </p>
      </section>
    </>
  )
}
