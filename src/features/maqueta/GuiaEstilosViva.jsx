import {useState} from 'react'
import Icono from '../../ui/Icono'
import {sentir} from '../../services/feedback'

// Guía de estilo viva (Fase 0 · Maqueta)
// Muestra la evolución de los tokens: paleta, contraste WCAG, tipografía, elevación y físicas de resorte.
export default function GuiaEstilosViva() {
  const [curva, setCurva] = useState('spring')
  const [disparada, setDisparada] = useState(false)

  const curvas = [
    {id: 'spring', nombre: 'Resorte Elástico', token: 'var(--ease-spring)', desc: 'Física reactiva para botones, pills y checks'},
    {id: 'soft', nombre: 'Resorte Suave', token: 'var(--ease-spring-soft)', desc: 'Ideal para paneles y transiciones de tamaño'},
    {id: 'expo', nombre: 'Salida Exponencial', token: 'var(--ease-out-expo)', desc: 'Movimiento natural sin rebote para modales'},
    {id: 'inout', nombre: 'Equilibrada', token: 'var(--ease-in-out)', desc: 'Suave al inicio y al fin para barras de progreso'}
  ]

  const paleta = [
    {grupo: 'Superficies', items: [
      {nombre: '--bg', desc: 'Fondo aplicación', colorVar: 'var(--bg)', txtVar: 'var(--tx)'},
      {nombre: '--sf', desc: 'Tarjetas estándar', colorVar: 'var(--sf)', txtVar: 'var(--tx)'},
      {nombre: '--sf-2', desc: 'Chips y controles', colorVar: 'var(--sf-2)', txtVar: 'var(--tx)'},
      {nombre: '--sf-hover', desc: 'Interacción hover', colorVar: 'var(--sf-hover)', txtVar: 'var(--tx)'}
    ]},
    {grupo: 'Acción y Énfasis', items: [
      {nombre: '--ac (Cian)', desc: 'Todo lo tocable', colorVar: 'var(--ac)', txtVar: 'var(--on-ac)'},
      {nombre: '--pr (Lima)', desc: 'Único CTA por vista', colorVar: 'var(--pr)', txtVar: 'var(--on-pr)'}
    ]},
    {grupo: 'Estados Semánticos', items: [
      {nombre: '--pos', desc: 'Éxito / Cumplido', colorVar: 'var(--pos)', txtVar: 'var(--on-pr)'},
      {nombre: '--warn', desc: 'Advertencia', colorVar: 'var(--warn)', txtVar: 'var(--on-pr)'},
      {nombre: '--neg', desc: 'Atención / Alerta', colorVar: 'var(--neg)', txtVar: 'var(--tx)'},
      {nombre: '--info', desc: 'Informativo', colorVar: 'var(--info)', txtVar: 'var(--on-pr)'}
    ]},
    {grupo: 'Métricas de Hoy', items: [
      {nombre: '--m-comida', desc: 'Alimentación', colorVar: 'var(--m-comida)', txtVar: 'var(--on-ac)'},
      {nombre: '--m-agua', desc: 'Hidratación', colorVar: 'var(--m-agua)', txtVar: 'var(--tx)'},
      {nombre: '--m-sueno', desc: 'Descanso', colorVar: 'var(--m-sueno)', txtVar: 'var(--tx)'},
      {nombre: '--m-pasos', desc: 'Actividad', colorVar: 'var(--m-pasos)', txtVar: 'var(--tx)'},
      {nombre: '--m-peso', desc: 'Composición', colorVar: 'var(--m-peso)', txtVar: 'var(--tx)'}
    ]}
  ]

  const probarFisica = id => {
    setCurva(id)
    sentir('toque')
    setDisparada(false)
    setTimeout(() => {
      setDisparada(true)
    }, 40)
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'}}>
      {/* 1. Paleta Cromática y Jerarquía */}
      <section className="mq-seccion">
        <h3 style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
          <Icono n="estrella" tam={16} /> 1. Paleta de Colores y Jerarquía Funcional
        </h3>
        <p className="mu" style={{margin: 0, fontSize: '13px'}}>
          Diseño dark refinado con contraste accesible superior a WCAG AAA (≥ 7:1) en textos principales y AA (≥ 4.5:1) en secundarios y controles.
        </p>

        {paleta.map(sec => (
          <div key={sec.grupo} style={{marginTop: 'var(--sp-2)'}}>
            <div style={{fontSize: '11px', fontFamily: 'Chakra Petch, sans-serif', color: 'var(--tx-2)', textTransform: 'uppercase', marginBottom: 'var(--sp-1)', letterSpacing: '0.05em'}}>
              {sec.grupo}
            </div>
            <div className="mq-paleta-grid">
              {sec.items.map(it => (
                <div key={it.nombre} className="mq-color-card" style={{background: 'var(--sf-2)'}}>
                  <div
                    className="mq-color-muestra"
                    style={{background: it.colorVar, color: it.txtVar}}
                  >
                    Aa
                  </div>
                  <div className="mq-color-nombre">{it.nombre}</div>
                  <div className="mq-color-ratio">{it.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 2. Tipografía y Escala */}
      <section className="mq-seccion">
        <h3 style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
          <Icono n="libro" tam={16} /> 2. Tipografía y Escala Modular
        </h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)'}}>
          <div style={{padding: 'var(--sp-3)', background: 'var(--sf-2)', borderRadius: 'var(--r-tile)', border: '1px solid var(--bd-sutil)'}}>
            <div style={{fontFamily: 'Chakra Petch, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--tx)'}}>
              Chakra Petch · Display & Datos
            </div>
            <div className="mu" style={{fontSize: '12px', marginTop: '4px'}}>
              Utilizada en métricas numéricas grandes, cabeceras técnicas y tags. Transmite precisión atlética y rendimiento.
            </div>
            <div style={{fontFamily: 'Chakra Petch, monospace', fontSize: '18px', color: 'var(--ac)', marginTop: 'var(--sp-2)', letterSpacing: '0.05em'}}>
              142 BPM · 2.450 KCAL · 10.520 PASOS
            </div>
          </div>

          <div style={{padding: 'var(--sp-3)', background: 'var(--sf-2)', borderRadius: 'var(--r-tile)', border: '1px solid var(--bd-sutil)'}}>
            <div style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: 'var(--tx)'}}>
              Inter · Lectura y Controles
            </div>
            <div className="mu" style={{fontSize: '12px', marginTop: '4px'}}>
              Fuente del sistema para cuerpo de texto, etiquetas y botones. Alta legibilidad con espaciado vertical óptimo.
            </div>
          </div>
        </div>
      </section>

      {/* 3. Elevación y Niveles de Sombra */}
      <section className="mq-seccion">
        <h3 style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
          <Icono n="candado" tam={16} /> 3. Elevación y Profundidad Neumórfica
        </h3>
        <p className="mu" style={{margin: 0, fontSize: '13px'}}>
          Las tarjetas prescinden de bordes pesados y se elevan mediante sombras suaves de doble capa, preservando la ligereza visual.
        </p>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)'}}>
          <div style={{background: 'var(--sf)', padding: 'var(--sp-3)', borderRadius: 'var(--r-tile)', boxShadow: 'var(--sombra-0)', border: '1px solid var(--bd-sutil)', textAlign: 'center'}}>
            <b style={{fontSize: '12px', color: 'var(--tx)'}}>Nivel 0 (Plano)</b>
            <div className="mu" style={{fontSize: '11px', marginTop: '4px'}}>Sin sombra (--sombra-0)</div>
          </div>
          <div style={{background: 'var(--sf)', padding: 'var(--sp-3)', borderRadius: 'var(--r-tile)', boxShadow: 'var(--sombra-1)', textAlign: 'center'}}>
            <b style={{fontSize: '12px', color: 'var(--tx)'}}>Nivel 1 (Estándar)</b>
            <div className="mu" style={{fontSize: '11px', marginTop: '4px'}}>Elevación base (--sombra-1)</div>
          </div>
          <div style={{background: 'var(--sf)', padding: 'var(--sp-3)', borderRadius: 'var(--r-tile)', boxShadow: 'var(--sombra-2)', textAlign: 'center'}}>
            <b style={{fontSize: '12px', color: 'var(--tx)'}}>Nivel 2 (Flotante)</b>
            <div className="mu" style={{fontSize: '11px', marginTop: '4px'}}>Avisos y modales (--sombra-2)</div>
          </div>
          <div style={{background: 'var(--sf)', padding: 'var(--sp-3)', borderRadius: 'var(--r-tile)', boxShadow: 'var(--sombra-glow-ac)', textAlign: 'center'}}>
            <b style={{fontSize: '12px', color: 'var(--ac)'}}>Resplandor Cian</b>
            <div className="mu" style={{fontSize: '11px', marginTop: '4px'}}>Glow interactivo</div>
          </div>
        </div>
      </section>

      {/* 4. Laboratorio de Curvas Bezier y Física de Resorte */}
      <section className="mq-seccion">
        <h3 style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
          <Icono n="rayo" tam={16} /> 4. Curvas de Movimiento y Física de Resorte
        </h3>
        <p className="mu" style={{margin: 0, fontSize: '13px'}}>
          Seleccioná una curva y observá cómo la física altera la respuesta táctil y el rebote orgánico:
        </p>

        <div style={{display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginTop: 'var(--sp-2)'}}>
          {curvas.map(c => (
            <button
              key={c.id}
              type="button"
              className={`chip ${curva === c.id ? 'on' : ''}`}
              onClick={() => probarFisica(c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Pista física interactiva */}
        <div style={{marginTop: 'var(--sp-3)'}}>
          <div className="mq-pista-resorte">
            <div
              className={`mq-bola-resorte ${disparada ? 'disparada' : ''}`}
              style={{
                transition: `transform var(--dur-slow) var(--ease-${curva === 'soft' ? 'spring-soft' : curva})`
              }}
            />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)'}}>
            <small className="tag">
              {curvas.find(c => c.id === curva)?.desc}
            </small>
            <button
              type="button"
              className="ghost mini"
              onClick={() => probarFisica(curva)}
            >
              <Icono n="repetir" tam={16} className="en-texto" /> Disparar resorte
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
