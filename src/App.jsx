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
import useRecordatorios from './features/recordatorios/useRecordatorios'
import {atras} from './platform/atras'
import {notificaciones} from './platform/notificaciones'
import {destinoDeAviso} from './domain/recordatorios'
import {accionAtras, OVERLAYS_QUE_BLOQUEAN} from './domain/navegacion'

const TABS = [
  ['hoy', 'Hoy', 'hoy'],
  ['entreno', 'Entreno', 'entreno'],
  ['comidas', 'Comidas', 'comidas'],
  ['progreso', 'Progreso', 'progreso']
]

export default function App() {
  useRecordatorios() // Entrega 41: en el APK mantiene al día los avisos programados
  const [tab, setTab] = useState('hoy'),
    [previa, setPrevia] = useState('hoy'),
    [nueva, setNueva] = useState(false),
    [bk, setBk] = useState(null),
    [oculto, setOculto] = useState(false),
    [subProgreso, setSubProgreso] = useState(undefined),
    [pedido, setPedido] = useState({accion: null, n: 0}), // qué abrir en Hoy al tocar un aviso (sube con cada toque)
    [aAjustes, setAAjustes] = useState(null) // qué mostrar en Ajustes al tocar un aviso («backup»)
  useEffect(() => {
    buscarActualizacion().then(r => r?.nueva && setNueva(true))
  }, [])
  // Entrega 28: las pantallas pesadas se bajan aparte; unos segundos después de abrir se precargan
  // en segundo plano para que anden sin conexión (ver src/ui/pantallas.js).
  useEffect(() => precargarEnSegundoPlano(), [])
  // `sub`: pestaña de Progreso a la que se quiere llegar (ej. «rutas» desde Hoy).
  const ir = (t, sub) => {
    if (t !== 'ajustes' && t !== 'priv') setPrevia(t)
    if (t !== 'ajustes') setAAjustes(null)
    setSubProgreso(sub)
    setTab(t)
  }
  // Entrega 42 · en el APK: el botón atrás y el toque en un aviso. Los listeners se registran una vez y leen lo último
  // de `estado` y `irRef` (no cierran sobre el render en que nacieron). En la PWA los dos adaptadores no hacen nada.
  const estado = useRef({tab, previa}),
    irRef = useRef(ir)
  estado.current = {tab, previa}
  irRef.current = ir
  useEffect(() => {
    let fin = false,
      quitar = () => {}
    atras
      .alAtras(() => {
        if (document.querySelector(OVERLAYS_QUE_BLOQUEAN)) return
        const a = accionAtras(estado.current)
        if (a.tipo === 'ir') irRef.current(a.tab)
        else atras.salir()
      })
      .then(q => (fin ? q() : (quitar = q)))
    return () => {
      fin = true
      quitar()
    }
  }, [])
  useEffect(() => {
    let fin = false,
      quitar = () => {}
    notificaciones
      .alTocarAviso(tipo => {
        const d = destinoDeAviso(tipo)
        if (!d) return
        irRef.current(d.tab)
        if (d.tab === 'hoy') setPedido(p => ({accion: d.accion, n: p.n + 1}))
        else setAAjustes(d.accion)
      })
      .then(q => (fin ? q() : (quitar = q)))
    return () => {
      fin = true
      quitar()
    }
  }, [])
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
          onClick={() => {
            if (tab === 'ajustes' || tab === 'priv') setTab(previa)
            else {
              setAAjustes(null)
              setTab('ajustes')
            }
          }}
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
                try {
                  await exportar({compartir: true})
                } catch {
                  /* si no se pudo preparar, el aviso sigue ahí y se puede intentar de nuevo o desde Ajustes */
                }
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
      <main className={tab === 'hoy' || tab === 'entreno' || tab === 'comidas' || tab === 'progreso' ? 'plano' : undefined}>
        <div hidden={tab !== 'hoy'}>
          <Hoy
            onEmpezar={() => ir('entreno')}
            onComidas={() => ir('comidas')}
            onRutas={() => ir('progreso', 'rutas')}
            pedido={pedido}
          />
        </div>
        {tab === 'entreno' && <Pantalla clave="entreno" nombre="Entreno" />}
        {tab === 'comidas' && <Pantalla clave="comidas" nombre="Comidas" />}
        {tab === 'progreso' && <Pantalla clave="progreso" nombre="Progreso" subInicial={subProgreso} />}
        {tab === 'ajustes' && <Pantalla clave="ajustes" nombre="Ajustes" onVersion={tocarVersion} irA={aAjustes} />}
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
