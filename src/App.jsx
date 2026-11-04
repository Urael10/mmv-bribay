import {useState, useEffect, useRef} from 'react'
import Hoy from './features/hoy/Hoy'
import Entreno from './features/entreno/Entreno'
import {BarraReloj} from './features/entreno/Timer'
import Comidas from './features/comidas/Comidas'
import Progreso from './features/progreso/Progreso'
import Ajustes from './features/ajustes/Ajustes'
import Bienestar from './features/bienestar/Bienestar'
import {registrarToque} from './domain/privado'
import {buscarActualizacion, actualizarAhora} from './version'
import {exportar, hayDatos, ultimoBackup} from './data/backup'
import {avisoBackup} from './domain/backup'
import Icono from './ui/Icono'

const TABS = [
  ['hoy', 'Hoy', 'hoy'],
  ['entreno', 'Entreno', 'entreno'],
  ['comidas', 'Comidas', 'comidas'],
  ['progreso', 'Progreso', 'progreso']
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
  // Acceso oculto al menú privado: 5 toques seguidos en la línea «Versión» de Ajustes (antes: la versión de la cabecera).
  const toques = useRef([])
  const tocarVersion = () => {
    if (tab === 'priv') return // ya estás adentro: un toque de más no te saca
    const r = registrarToque(toques.current, Date.now())
    toques.current = r.toques
    if (r.abre) {
      toques.current = []
      setTab('priv')
    }
  }
  const revisarBackup = async () =>
    setBk(avisoBackup({ultimo: ultimoBackup(), hayDatos: await hayDatos()}))
  useEffect(() => {
    revisarBackup()
  }, [tab])
  return (
    <div className="app">
      <header>
        <b className="logo">MMV</b>
        <button
          className={'gear' + (tab === 'ajustes' || tab === 'priv' ? ' on' : '')}
          aria-label={tab === 'ajustes' || tab === 'priv' ? 'Cerrar ajustes' : 'Ajustes'}
          onClick={() => (tab === 'ajustes' || tab === 'priv' ? setTab(previa) : setTab('ajustes'))}
        >
          <Icono n={tab === 'ajustes' || tab === 'priv' ? 'cerrar' : 'ajustes'} tam={22} />
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
        <div hidden={tab !== 'hoy'}>
          <Hoy onEmpezar={() => ir('entreno')} onComidas={() => ir('comidas')} />
        </div>
        {tab === 'entreno' && <Entreno />}
        {tab === 'comidas' && <Comidas />}
        {tab === 'progreso' && <Progreso />}
        {tab === 'ajustes' && <Ajustes onVersion={tocarVersion} />}
        {tab === 'priv' && <Bienestar onSalir={() => setTab(previa)} />}
      </main>
      <nav>
        {TABS.map(([k, n, ic]) => (
          <button
            key={k}
            className={tab === k ? 'on' : ''}
            aria-current={tab === k ? 'page' : undefined}
            onClick={() => ir(k)}
          >
            <Icono n={ic} tam={24} />
            <span>{n}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
