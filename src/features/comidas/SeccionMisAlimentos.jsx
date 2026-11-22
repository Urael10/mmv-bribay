import Icono from '../../ui/Icono'
import {FILTROS_ALIMENTOS, MIN_FRECUENTE} from '../../domain/registro'
import {totales} from '../../domain/alimentos'
import {ATRIBUCION, FUENTE} from '../../services/off'
import {itemsDePlantilla} from '../../domain/registro'

// Subcomponente de presentación: Pestaña Mis Alimentos y Plantillas guardadas (Fase B)
export default function SeccionMisAlimentos({
  onNuevo,
  busqueda,
  onCambioBusqueda,
  filtro,
  onCambioFiltro,
  plantillas,
  base,
  onUsarPlantilla,
  onBorrarPlantilla,
  alimentosLista,
  onSeleccionarAlimento,
  hayWeb,
  onRestaurarIniciales,
  avisoNode,
  reintentoNode
}) {
  return (
    <>
      <section className="stagger-1">
        <div className="row">
          <button className="pri" onClick={onNuevo}>
            <Icono n="mas" tam={16} className="en-texto" /> Nuevo alimento
          </button>
        </div>
        <small className="mu" style={{display: 'block', marginTop: 8}}>
          Acá corregís valores. Para cargar comidas usá «Agregar» en el Diario.
        </small>
        <input
          style={{width: '100%', marginTop: 10}}
          placeholder="Buscar alimento…"
          aria-label="Buscar en mis alimentos"
          value={busqueda}
          onChange={e => onCambioBusqueda(e.target.value)}
        />
        <div className="row" role="group" aria-label="Filtrar alimentos" style={{marginTop: 10}}>
          {FILTROS_ALIMENTOS.map(([k, n]) => (
            <button
              key={k}
              className={'chip' + (filtro === k ? ' on' : '')}
              aria-pressed={filtro === k}
              onClick={() => onCambioFiltro(k)}
            >
              {n}
            </button>
          ))}
        </div>
        <small className="mu leyenda">
          <span><Icono n="web" tam={16} className="en-texto" /> copiado de la web</span>
          <span>≈ estimado por IA o etiqueta</span>
          <span>Valores cada 100 g · ordenados por uso reciente</span>
        </small>
      </section>

      {avisoNode}
      {reintentoNode}

      {plantillas.length > 0 && (
        <section className="stagger-2">
          <h3><Icono n="estrella" tam={16} className="en-texto" /> Comidas guardadas</h3>
          {plantillas.map(p => {
            const its = itemsDePlantilla(p, base),
              k = totales(its).kcal
            return (
              <div className="fila" key={p.id}>
                <div className="row" style={{justifyContent: 'space-between'}}>
                  <b>{p.nombre}</b>
                  <span className="mono">{k} kcal</span>
                </div>
                <small className="mu">
                  {p.momento} · {its.map(i => i.nombre).join(', ')}
                </small>
                <div className="row">
                  <button className="ghost mini" onClick={() => onUsarPlantilla(p)}>
                    Usar hoy
                  </button>
                  <button className="ghost mini" onClick={() => onBorrarPlantilla(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="stagger-3">
        {alimentosLista.map(a => (
          <div
            className="lin alim"
            key={a.id}
            onClick={() => onSeleccionarAlimento(a)}
            style={{cursor: 'pointer'}}
          >
            <span className="ic">
              {a.fuente ? <Icono n="web" tam={16} etiqueta="copiado de la web" className="en-texto" /> : null}
              {a.origen === 'ia' || a.origen === 'etiqueta' ? '≈' : ''}
            </span>
            <span>{a.nombre}</span>
            <span className="mono kcal">{a.kcal100} kcal</span>
          </div>
        ))}
        {!alimentosLista.length && (
          <p className="mu">
            {filtro === 'frecuentes'
              ? `Todavía no hay alimentos que hayas usado ${MIN_FRECUENTE} veces o más en los últimos 90 días.`
              : 'No hay alimentos con ese nombre o filtro.'}
          </p>
        )}
        <small className="mu" style={{display: 'block', marginTop: 8}}>
          Los iniciales son referencias aproximadas: corregilos con tus datos. Frecuentes = usados {MIN_FRECUENTE} veces o
          más en 90 días.
        </small>
        {hayWeb && (
          <small className="mu" style={{display: 'block', marginTop: 4}}>
            {ATRIBUCION}
          </small>
        )}
      </section>

      <details className="avanzado">
        <summary className="tag">Avanzado</summary>
        <p className="mu" style={{margin: '8px 0'}}>
          Vuelve a agregar los alimentos iniciales que hayas borrado. No toca los que ya tenés ni tus comidas.
        </p>
        <button onClick={onRestaurarIniciales}>Reponer alimentos iniciales</button>
      </details>
    </>
  )
}
