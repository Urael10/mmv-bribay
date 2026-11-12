import {useState, useEffect} from 'react'
import {db, hoy, cfg, setCfg} from '../../data/db'
import {exportar, restaurar, puedeCompartir, ultimoBackup} from '../../data/backup'
import {archivos} from '../../platform/archivos'
import {diasDesde} from '../../domain/backup'
import {edadDe, proteinaObjetivo, ultima, PROT_KG} from '../../domain/cuerpo'
import {probarIA} from '../../services/ia'
import {CLAVE_MAPA} from '../../domain/mapa'
import {INFO, fechaBuild, buscarActualizacion, actualizarAhora} from '../../version'
import Icono from '../../ui/Icono'
import Recordatorios from '../recordatorios/Recordatorios'
import {nivel as nivelFb, guardarNivel, sentir, confeti} from '../../services/feedback'
import {NIVELES} from '../../domain/feedback'

function Version({onVersion}) {
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
      <div className="lin" onClick={onVersion}>
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
        <small className="ok-msg">Tenés la última versión publicada.</small>
      )}
      {r && r.nueva && (
        <small className="tag" style={{display: 'block', marginTop: 6}}>
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
  const nativo = archivos.disponible(),
    [msg, setMsg] = useState(''),
    [ult, setUlt] = useState(ultimoBackup()),
    d = diasDesde(ult)
  const hacer = async compartir => {
    try {
      const r = await exportar({compartir})
      setUlt(ultimoBackup())
      setMsg(
        r === 'compartido'
          ? 'Backup compartido.'
          : r === 'descargado'
            ? 'Backup descargado (revisá la carpeta Descargas).'
            : 'Cancelado.'
      )
    } catch (err) {
      setMsg(err?.message || 'No pude hacer el backup. Probá de nuevo.')
    }
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
    <section id="ajustes-backup">
      <h3>Backup</h3>
      <p>
        Tus datos viven solo en este dispositivo.{' '}
        {d === null ? (
          <b>Todavía no hiciste ningún backup.</b>
        ) : (
          <>Último backup: {d === 0 ? 'hoy' : `hace ${d} ${d === 1 ? 'día' : 'días'}`}.</>
        )}
      </p>
      <div className="botonera">
        {puedeCompartir() && (
          <button className="pri" onClick={() => hacer(true)}>
            {nativo ? 'Guardar o compartir backup' : 'Compartir backup'}
          </button>
        )}
        {/* En el APK la hoja de compartir ya incluye «Guardar en Archivos / Drive»: un segundo botón haría lo mismo */}
        {!nativo && (
          <button className={puedeCompartir() ? '' : 'pri'} onClick={() => hacer(false)}>
            Descargar backup
          </button>
        )}
        <button className="ghost" onClick={e => e.currentTarget.nextSibling.click()}>
          Importar backup
        </button>
        <input hidden type="file" accept="application/json" onChange={imp} />
      </div>
      {msg && <small className="tag">{msg}</small>}
    </section>
  )
}

function Perfil() {
  const [v, setV] = useState({
      altura: cfg('altura'),
      nac: cfg('nac'),
      pesoobj: cfg('pesoobj'),
      fechaobj: cfg('fechaobj'),
      protkg: cfg('protkg', String(PROT_KG).replace('.', ','))
    }),
    [peso, setPeso] = useState(null)
  useEffect(() => {
    db.medidas
      .toArray()
      .then(ms => setPeso(ultima(ms)?.peso ?? null))
      .catch(() => {})
  }, [])
  const set = (k, x) => {
    setV(o => ({...o, [k]: x}))
    setCfg(k, x)
  }
  const edad = edadDe(v.nac, hoy()),
    pr = proteinaObjetivo(peso, String(v.protkg).replace(',', '.'))
  return (
    <section>
      <h3>Perfil y objetivo</h3>
      <p>Estos datos se guardan solo en este dispositivo (y en tu backup).</p>
      <div className="grid2">
        <label className="mu">
          Altura (cm)
          <input
            type="text"
            inputMode="numeric"
            value={v.altura}
            onChange={e => set('altura', e.target.value)}
          />
        </label>
        <label className="mu">
          Año de nacimiento{edad !== null ? ` (${edad} años)` : ''}
          <input
            type="text"
            inputMode="numeric"
            value={v.nac}
            onChange={e => set('nac', e.target.value)}
          />
        </label>
        <label className="mu">
          Peso objetivo (kg)
          <input
            type="text"
            inputMode="decimal"
            value={v.pesoobj}
            onChange={e => set('pesoobj', e.target.value)}
          />
        </label>
        <label className="mu">
          Fecha del objetivo
          <input type="date" value={v.fechaobj} onChange={e => set('fechaobj', e.target.value)} />
        </label>
        <label className="mu">
          Proteína (g por kg de peso)
          <input
            type="text"
            inputMode="decimal"
            value={v.protkg}
            onChange={e => set('protkg', e.target.value)}
          />
        </label>
      </div>
      <small className="mu">
        {pr
          ? `Con tu último peso (${String(peso).replace('.', ',')} kg), la meta de proteína de Hoy es ${pr} g.`
          : 'La meta de proteína aparece cuando registres tu peso.'}{' '}
        1,6 g/kg es un valor de partida; en deporte se usan rangos de unos 1,4 a 2,0. Si tenés una
        condición de salud (por ejemplo renal), consultá antes con un profesional.
      </small>
    </section>
  )
}

function ProbarIA({modelo, onModelo}) {
  const [r, setR] = useState(null),
    [ocupado, setOcupado] = useState(false)
  return (
    <>
      <div className="row" style={{marginTop: 12}}>
        <button
          className="ghost"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            setR(await probarIA({key: cfg('key'), modelo}))
            setOcupado(false)
          }}
        >
          {ocupado ? 'Probando…' : <><Icono n="lupa" tam={16} className="en-texto" /> Probar la IA</>}
        </button>
      </div>
      {r && (
        <div role="status">
          {r.lineas.map((l, i) => (
            <small key={i} className="mu" style={{display: 'block'}}>
              {l}
            </small>
          ))}
          {r.sugeridos.length > 0 && (
            <>
              <small className="tag">Modelos disponibles: tocá uno para usarlo</small>
              <div className="row" style={{flexWrap: 'wrap'}}>
                {r.sugeridos.slice(0, 8).map(n => (
                  <button key={n} className={n === modelo ? 'mini' : 'ghost mini'} onClick={() => onModelo(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

function MapaRutas() {
  const [on, setOn] = useState(cfg(CLAVE_MAPA) === '1')
  return (
    <section>
      <h3>Mapa de las rutas</h3>
      <p>
        Por defecto tus rutas se ven como un trazo dibujado en el teléfono, sin conexión. Si lo activás,
        cada ruta tendrá un botón «Ver sobre el mapa» con OpenStreetMap de fondo.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          onChange={e => {
            setOn(e.target.checked)
            setCfg(CLAVE_MAPA, e.target.checked ? '1' : '0')
          }}
        />
        <span>Permitir el mapa de OpenStreetMap</span>
      </label>
      <small className="mu">
        Al abrir el mapa, el teléfono le pide a los servidores de OpenStreetMap las imágenes de la zona
        visible: ellos reciben esa zona y tu dirección de internet. No reciben tu nombre ni el resto de tus
        datos, y la IA nunca recibe coordenadas ni trazos (solo totales como km y minutos). Con el mapa apagado no se contacta a nadie.
      </small>
    </section>
  )
}

export default function Ajustes({onVersion, irA}) {
  const [k, setK] = useState(cfg('key')),
    [m, setM] = useState(cfg('modelo', 'gemini-3.8-flash')),
    [a, setA] = useState(cfg('meta', 2500)),
    [kc, setKc] = useState(cfg('metakcal', 2200)),
    [so, setSo] = useState(cfg('sonido', '1') !== '0'),
    [fb, setFb] = useState(nivelFb)
  // Entrega 42: tocar el aviso de backup abre Ajustes y trae «Backup» a la vista.
  useEffect(() => {
    if (irA !== 'backup') return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById('ajustes-backup')?.scrollIntoView({block: 'start', behavior: quieto ? 'auto' : 'smooth'})
  }, [irA])
  return (
    <>
      <Version onVersion={onVersion} />
      <Respaldo />
      <Perfil />
      <Recordatorios />
      <MapaRutas />
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
        <ProbarIA
          modelo={m}
          onModelo={n => {
            setM(n)
            setCfg('modelo', n)
          }}
        />
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
          <label className="check">
            <input
              type="checkbox"
              checked={so}
              onChange={e => {
                setSo(e.target.checked)
                setCfg('sonido', e.target.checked ? '1' : '0')
              }}
            />
            <span>Sonido del temporizador</span>
          </label>
        </p>
        <h3>Sonidos y vibración</h3>
        <p className="mu">
          Un toque al guardar, un festejo al cumplir cada meta del día (una vez por día) y otro al terminar el entreno.
          Con «Vibración y sonido», el sonido también se apaga con «Sonido del temporizador».
        </p>
        <div className="row" role="group" aria-label="Sonidos y vibración">
          {NIVELES.map(n => (
            <button
              key={n}
              type="button"
              className="chip"
              aria-pressed={fb === n}
              onClick={() => {
                setFb(n)
                guardarNivel(n)
              }}
            >
              {{off: 'Apagado', vib: 'Solo vibración', full: 'Vibración y sonido'}[n]}
            </button>
          ))}
          <button
            type="button"
            className="ghost"
            onClick={e => {
              sentir('meta')
              confeti(e.currentTarget, 18)
            }}
          >
            Probar
          </button>
        </div>
      </section>
    </>
  )
}
