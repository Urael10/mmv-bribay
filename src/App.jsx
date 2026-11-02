import {useState, useEffect, useRef} from 'react'
import Hoy from './features/hoy/Hoy'
import Entreno from './features/entreno/Entreno'
import {BarraReloj} from './features/entreno/Timer'
import Comidas from './features/comidas/Comidas'
import Progreso from './features/progreso/Progreso'
import Ajustes from './features/ajustes/Ajustes'
import Bienestar from './features/bienestar/Bienestar'
import {registrarToque} from './domain/privado'
import {etiqueta, buscarActualizacion, actualizarAhora} from './version'
import {exportar, hayDatos, ultimoBackup} from './data/backup'
import {avisoBackup} from './domain/backup'

const TABS = [
  ['hoy', 'Hoy'],
  ['entreno', 'Entreno'],
  ['comidas', 'Comidas'],
  ['progreso', 'Progreso']
]

export default function App() {
  const [tab, setTab] = useState('hoy'),
    [previa, setPrevia] = useState('hoy'),
    [nueva, setNueva] = useState(false),
    [bk, setBk] = useState(null),
    [oculto, setOculto] = useState(false)
  useEffect(() => {
    buscarActualizacion().then(r => r?.nueva && setNueva(true))
  }, [])
  const ir = t => {
    if (t !== 'ajustes' && t !== 'priv') setPrevia(t)
    setTab(t)
  }
  // Acceso oculto al menú privado: 5 toques seguidos en la versión. Un toque solo sigue abriendo Ajustes.
  const toques = useRef([]),
    espera = useRef(0)
  const tocarVersion = () => {
    if (tab === 'priv') return // ya estás adentro: un toque de más no te saca
    const r = registrarToque(toques.current, Date.now())
    toques.current = r.toques
    clearTimeout(espera.current)
    if (r.abre) return setTab('priv')
    espera.current = setTimeout(() => {
      if (toques.current.length === 1) {
        toques.current = [] // el toque que abrió Ajustes no cuenta para el gesto
        setTab('ajustes')
      }
    }, 700)
  }
  const revisarBackup = async () =>
    setBk(avisoBackup({ultimo: ultimoBackup(), hayDatos: await hayDatos()}))
  useEffect(() => {
    revisarBackup()
  }, [tab])
  return (
    <div className="app">
      <header>
        <b>MMV</b>
        <span>Mi Mejor Versión</span>
        <small className="ver" onClick={tocarVersion}>
          {etiqueta}
        </small>
        <button
          className={'gear' + (tab === 'ajustes' ? ' on' : '')}
          aria-label={tab === 'ajustes' ? 'Cerrar ajustes' : 'Ajustes'}
          onClick={() => (tab === 'ajustes' || tab === 'priv' ? setTab(previa) : setTab('ajustes'))}
        >
          ⚙
        </button>
      </header>
      {nueva && (
        <button className="upd" onClick={actualizarAhora}>
          ⬆ Hay una versión nueva · tocá para actualizar
        </button>
      )}
      {bk && !oculto && (
        <div className="upd bk" role="alert">
          <div>
            {bk.nunca
              ? 'Todavía no hiciste ningún backup de tus datos.'
              : `Hace ${bk.dias} días que no hacés backup.`}
          </div>
          <div className="row" style={{marginTop: 6}}>
            <button
              onClick={async () => {
                await exportar({compartir: true})
                revisarBackup()
              }}
            >
              Hacer backup ahora
            </button>
            <button className="ghost" onClick={() => setOculto(true)}>
              Más tarde
            </button>
          </div>
        </div>
      )}
      {tab !== 'entreno' && <BarraReloj onAbrir={() => ir('entreno')} />}
      <main>
        {tab === 'hoy' && <Hoy onEmpezar={() => ir('entreno')} />}
        {tab === 'entreno' && <Entreno />}
        {tab === 'comidas' && <Comidas />}
        {tab === 'progreso' && <Progreso />}
        {tab === 'ajustes' && <Ajustes />}
        {tab === 'priv' && <Bienestar onSalir={() => setTab(previa)} />}
      </main>
      <nav>
        {TABS.map(([k, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => ir(k)}>
            {n}
          </button>
        ))}
      </nav>
    </div>
  )
}
