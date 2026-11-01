import {useState, useEffect} from 'react'
import Hoy from './features/hoy/Hoy'
import Entreno from './features/entreno/Entreno'
import {BarraReloj} from './features/entreno/Timer'
import Comidas from './features/comidas/Comidas'
import Progreso from './features/progreso/Progreso'
import Ajustes from './features/ajustes/Ajustes'
import {etiqueta, buscarActualizacion, actualizarAhora} from './version'
import {exportar, hayDatos, ultimoBackup} from './data/backup'
import {avisoBackup} from './domain/backup'

const TABS = [
  ['hoy', 'Hoy'],
  ['entreno', 'Entreno'],
  ['comidas', 'Comidas'],
  ['progreso', 'Progreso'],
  ['ajustes', 'Ajustes']
]

export default function App() {
  const [tab, setTab] = useState('hoy'),
    [nueva, setNueva] = useState(false),
    [bk, setBk] = useState(null),
    [oculto, setOculto] = useState(false)
  useEffect(() => {
    buscarActualizacion().then(r => r?.nueva && setNueva(true))
  }, [])
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
        <small className="ver" onClick={() => setTab('ajustes')}>
          {etiqueta}
        </small>
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
      {tab !== 'entreno' && <BarraReloj onAbrir={() => setTab('entreno')} />}
      <main>
        {tab === 'hoy' && <Hoy />}
        {tab === 'entreno' && <Entreno />}
        {tab === 'comidas' && <Comidas />}
        {tab === 'progreso' && <Progreso />}
        {tab === 'ajustes' && <Ajustes />}
      </main>
      <nav>
        {TABS.map(([k, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
      </nav>
    </div>
  )
}
