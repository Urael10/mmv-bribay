import {useState, useEffect, useRef} from 'react'
import Hoy from './features/hoy/Hoy'
import {BarraReloj} from './features/entreno/Timer'
import Pantalla from './ui/Pantalla'
import {precargarEnSegundoPlano} from './ui/pantallas'
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
    [oculto, setOculto] = useState(false),
    [subProgreso, setSubProgreso] = useState(undefined)
  useEffect(() => {
    buscarActualizacion().then(r => r?.nueva && setNueva(true))
  }, [])
  // Entrega 28: las pantallas pesadas se bajan aparte; unos segundos después de abrir se precargan
  // en segundo plano para que anden sin conexión (ver src/ui/pantallas.js).
  useEffect(() => precargarEnSegundoPlano(), [])
  // `sub`: pestaña de Progreso a la que se quiere llegar (ej. «rutas» desde Hoy).
  const ir = (t, sub) => {
    if (t !== 'ajustes' && t !== 'priv') setPrevia(t)
    setSubProgreso(sub)
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
      {/* Entrega 37: los avisos flotan sobre la barra inferior y ya no empujan el contenido hacia abajo */}
      <div className="avisos">
      {nueva && (
        <button className="upd" onClick={actualizarAhora}>
          <Icono n="flecha-arriba" tam={18} className="en-texto" /> Hay una versión nueva · tocá para actualizar
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
      </div>
      {tab !== 'entreno' && <BarraReloj onAbrir={() => ir('entreno')} />}
      <main className={tab === 'hoy' || tab === 'entreno' || tab === 'progreso' ? 'plano' : undefined}>
        <div hidden={tab !== 'hoy'}>
          <Hoy
            onEmpezar={() => ir('entreno')}
            onComidas={() => ir('comidas')}
            onRutas={() => ir('progreso', 'rutas')}
          />
        </div>
        {tab === 'entreno' && <Pantalla clave="entreno" nombre="Entreno" />}
        {tab === 'comidas' && <Pantalla clave="comidas" nombre="Comidas" />}
        {tab === 'progreso' && <Pantalla clave="progreso" nombre="Progreso" subInicial={subProgreso} />}
        {tab === 'ajustes' && <Pantalla clave="ajustes" nombre="Ajustes" onVersion={tocarVersion} />}
        {tab === 'priv' && (
          <Pantalla clave="priv" nombre="esta pantalla" onSalir={() => setTab(previa)} />
        )}
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
