// Contenedor de una pantalla con carga diferida (Entrega 28): mientras baja muestra «Cargando…» (accesible)
// y, si no se pudo bajar, un aviso con «Reintentar» y «Actualizar la app». Los fallos al dibujar la pantalla
// NO se tapan acá: siguen yendo a la pantalla de error general de main.jsx, con el detalle técnico.
import {Component, Suspense, useState} from 'react'
import {componente} from './pantallas'
import {ErrorDeCarga, textoFalloCarga} from '../domain/carga'
import {actualizarAhora} from '../version'

function Cargando({nombre}) {
  return (
    <section className="pantalla-carga" role="status" aria-live="polite" aria-busy="true">
      <p className="mu">Cargando {nombre}…</p>
    </section>
  )
}

class Limite extends Component {
  state = {error: null}
  static getDerivedStateFromError(error) {
    return {error}
  }
  render() {
    const {error} = this.state
    if (!error) return this.props.children
    if (!(error instanceof ErrorDeCarga)) throw error // fallo de dibujo: lo atiende el límite general
    return (
      <section className="pantalla-carga" role="alert">
        <h3>No se pudo abrir {this.props.nombre}</h3>
        <p className="mu">
          {textoFalloCarga({enLinea: typeof navigator === 'undefined' || navigator.onLine !== false})}
        </p>
        <div className="row">
          {/* Si el navegador no dijo qué archivo falló no se puede pedir solo ese: se recarga la app (los datos no se tocan) */}
          <button onClick={error.recargar ? () => location.reload() : this.props.onReintentar}>
            Reintentar
          </button>
          <button className="ghost" onClick={actualizarAhora}>
            Actualizar la app
          </button>
        </div>
      </section>
    )
  }
}

export default function Pantalla({clave, nombre = 'la pantalla', ...props}) {
  const [intento, setIntento] = useState(0)
  const C = componente(clave)
  return (
    <Limite key={intento} nombre={nombre} onReintentar={() => setIntento(n => n + 1)}>
      <Suspense fallback={<Cargando nombre={nombre} />}>
        <C {...props} />
      </Suspense>
    </Limite>
  )
}
