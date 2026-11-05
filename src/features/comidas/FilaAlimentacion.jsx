import {useState, useEffect} from 'react'
import {db, hoy, cfg} from '../../data/db'
import Icono from '../../ui/Icono'
import {totales, fmt} from '../../domain/alimentos'
import {ultima, proteinaObjetivo, PROT_KG} from '../../domain/cuerpo'

// Fila compacta de Hoy: calorías y proteína del día; al tocarla lleva a Comidas (el detalle vive allá).
// La meta de proteína sale del último peso registrado (g por kg configurable en Ajustes → Perfil y objetivo).
export default function FilaAlimentacion({onAbrir}) {
  const [t, setT] = useState(null),
    [peso, setPeso] = useState(undefined),
    meta = +cfg('metakcal', 2200) || 2200
  useEffect(() => {
    db.comidas
      .where('fecha')
      .equals(hoy())
      .toArray()
      .then(a => setT(totales(a.flatMap(c => c.items || []))))
    db.medidas
      .toArray()
      .then(ms => setPeso(ultima(ms)?.peso ?? null))
      .catch(() => setPeso(null))
  }, [])
  if (!t) return null
  const factor = +String(cfg('protkg', PROT_KG)).replace(',', '.') || PROT_KG,
    metaP = proteinaObjetivo(peso, factor)
  return (
    <button type="button" className="filahoy" onClick={onAbrir} aria-label="Alimentación de hoy: abrir Comidas">
      <span className="filahoy-t">Alimentación de hoy</span>
      <span className="filahoy-v">
        <b className="mono">{t.kcal}</b>
        <small className="mu"> / {meta} kcal</small>
      </span>
      <span className="bar" aria-hidden="true">
        <i style={{width: Math.min(100, (t.kcal / meta) * 100) + '%'}} />
      </span>
      <span className="filahoy-p mu">
        {metaP ? (
          <>
            Proteína <b className="mono">{fmt(t.p)}</b> / {metaP} g
          </>
        ) : (
          <>
            Proteína <b className="mono">{fmt(t.p)}</b> g
          </>
        )}
      </span>
      <Icono n="chevron-abajo" tam={18} className="filahoy-ch" />
    </button>
  )
}

