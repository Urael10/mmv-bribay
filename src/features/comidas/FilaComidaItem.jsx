import Icono from '../../ui/Icono'
import {fmt} from '../../domain/alimentos'

// Subcomponente de presentación: Fila de comida registrada en el diario (Fase B)
export default function FilaComidaItem({
  comida: c,
  base,
  esHoy,
  onEditar,
  onRepetir,
  onGuardarPlantilla,
  onBorrar,
  MacrosComponente
}) {
  return (
    <section key={c.id} className="stagger-1" style={{transition: 'transform var(--dur-instant) var(--ease-spring)'}}>
      <div className="row" style={{justifyContent: 'space-between'}}>
        <b>
          {c.momento} <small className="mu">{c.hora}</small>
        </b>
        <b className="mono">{c.kcal} kcal</b>
      </div>
      {c.items.map((it, i) => (
        <div className="lin alim" key={i}>
          <span className="ic">
            {base.find(a => a.id === it.alimentoId)?.fuente ? (
              <Icono n="web" tam={16} etiqueta="copiado de la web" className="en-texto" />
            ) : null}
            {it.origen === 'ia' ? '≈' : ''}
          </span>
          <span>
            {it.nombre} · {fmt(it.g)} g
          </span>
          <span className="mono kcal">{it.kcal} kcal</span>
        </div>
      ))}
      {MacrosComponente && <MacrosComponente t={c} compacto />}
      <div className="row" style={{marginTop: 8}}>
        <button className="ghost mini" onClick={() => onEditar(c)}>
          Editar
        </button>
        <button className="ghost mini" onClick={() => onRepetir(c)}>
          {esHoy ? 'Repetir' : 'Repetir hoy'}
        </button>
        <button
          className="ghost mini"
          onClick={() => onGuardarPlantilla(c.items, c.momento, c.momento)}
        >
          <Icono n="estrella" tam={16} className="en-texto" /> Guardar
        </button>
        <button className="ghost mini" onClick={() => onBorrar(c)}>
          Borrar
        </button>
      </div>
    </section>
  )
}
