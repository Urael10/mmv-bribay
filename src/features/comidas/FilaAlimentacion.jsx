import {useState, useEffect} from 'react'
import {db, hoy, cfg} from '../../data/db'
import {totales, fmt} from '../../domain/alimentos'
import {ultima, proteinaObjetivo, PROT_KG} from '../../domain/cuerpo'

// Tesela de Hoy (Entrega 30): calorías y proteína del día; al tocarla lleva a Comidas (el detalle vive allá).
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
    <button type="button" className="tesela" onClick={onAbrir} aria-label="Alimentación de hoy: abrir Comidas">
      <span className="eti">Comida</span>
      <b className="mono tesela-v">{t.kcal}</b>
      <small className="mu">de {meta} kcal</small>
      <small className="mu tesela-p">
        {metaP ? (
          <>
            Prot. {fmt(t.p)} / {metaP} g
          </>
        ) : (
          <>Prot. {fmt(t.p)} g</>
        )}
      </small>
    </button>
  )
}
