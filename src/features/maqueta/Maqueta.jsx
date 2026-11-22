import {useState, useEffect} from 'react'
import Icono from '../../ui/Icono'
import TabsPillNuevo from './TabsPillNuevo'
import GuiaEstilosViva from './GuiaEstilosViva'
import AnilloNuevo from './AnilloNuevo'
import TrazoNuevo from './TrazoNuevo'
import PlegableNuevo from './PlegableNuevo'
import TarjetasHoyComidas from './TarjetasHoyComidas'
import EstadoCargaCoach from './EstadoCargaCoach'
import {sentir} from '../../services/feedback'
import './maqueta.css'

const PESTANAS = [
  ['guia', 'Guía de Estilo'],
  ['componentes', 'Componentes'],
  ['dashboard', 'Hoy & Comidas'],
  ['coach', 'Coach & IA']
]

// Vista Maqueta Interactiva (Fase 0 · MMV)
// Permite evaluar y aprobar la evolución de diseño y sistema de micro-interacciones.
export default function Maqueta({onVolver}) {
  const [tab, setTab] = useState('guia')
  const [tema, setTema] = useState('neo') // 'actual' | 'neo' | 'oled'
  const [reducido, setReducido] = useState(false)

  // Sincronizar clase de tema en el contenedor de la maqueta
  const claseTema = {
    actual: '',
    neo: 'tema-neo',
    oled: 'tema-oled'
  }[tema] || ''

  const cambiarTema = t => {
    sentir('toque')
    setTema(t)
  }

  const volver = () => {
    sentir('toque')
    if (onVolver) onVolver()
  }

  return (
    <div className={`maqueta-root ${claseTema} ${reducido ? 'forzar-reducido' : ''}`}>
      {/* Cabecera Principal de la Maqueta */}
      <header className="mq-cabecera">
        <div className="mq-cabecera-top">
          <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
            <span className="mq-insignia">Fase 0 · Maqueta</span>
            <span style={{fontFamily: 'Chakra Petch, sans-serif', fontSize: '13px', color: 'var(--tx-2)'}}>
              v0.52.0
            </span>
          </div>

          {/* Selector en vivo de Tema / Contraste */}
          <div className="mq-selector-tema" role="group" aria-label="Variante visual">
            <button
              type="button"
              className={`mq-btn-tema ${tema === 'actual' ? 'activo' : ''}`}
              onClick={() => cambiarTema('actual')}
            >
              Base MMV
            </button>
            <button
              type="button"
              className={`mq-btn-tema ${tema === 'neo' ? 'activo' : ''}`}
              onClick={() => cambiarTema('neo')}
            >
              Neo-Motion ✨
            </button>
            <button
              type="button"
              className={`mq-btn-tema ${tema === 'oled' ? 'activo' : ''}`}
              onClick={() => cambiarTema('oled')}
            >
              Alto Contraste
            </button>
          </div>
        </div>

        <h2 style={{margin: '0 0 var(--sp-1)', fontFamily: 'Chakra Petch, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--tx)'}}>
          Laboratorio de Diseño y Motion UI
        </h2>
        <p className="mq-subtitulo">
          Evolución integral del sistema visual: físicas de resorte (spring motion), feedback elástico en controles, elevación de tarjetas y transiciones continuas sin saltos de layout.
        </p>

        {/* Acciones de accesibilidad y retorno */}
        <div className="mq-barra-acciones">
          <label className="mq-check-reducido">
            <input
              type="checkbox"
              checked={reducido}
              onChange={e => {
                sentir('toque')
                setReducido(e.target.checked)
              }}
            />
            <span>Simular prefers-reduced-motion</span>
          </label>

          <button type="button" className="ghost mini" onClick={volver}>
            <Icono n="cerrar" tam={16} className="en-texto" /> Volver a la App
          </button>
        </div>
      </header>

      {/* Tabs con pastilla deslizante reactiva */}
      <TabsPillNuevo
        items={PESTANAS}
        valor={tab}
        onCambio={setTab}
        etiqueta="Secciones del laboratorio de diseño"
      />

      {/* Contenido según pestaña activa */}
      {tab === 'guia' && <GuiaEstilosViva />}

      {tab === 'componentes' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'}}>
          {/* Anillo Animado */}
          <section className="mq-seccion mq-stagger-1">
            <h3 style={{margin: 0}}>Anillo.jsx · Transición Fluida de Resorte</h3>
            <p className="mu" style={{margin: 0, fontSize: '13px'}}>
              Animación continua con curva spring. Al alcanzar o superar la meta (≥ 100%), se activa el pulso de celebración y el arco cambia a verde institucional (--pos).
            </p>
            <AnilloNuevo valor={75} meta={100} tam={88} metrica="agua" />
          </section>

          {/* Trazo GPS Animado */}
          <section className="mq-seccion mq-stagger-2">
            <h3 style={{margin: 0}}>TrazoSvg.jsx · Dibujado Progresivo de Recorrido</h3>
            <p className="mu" style={{margin: 0, fontSize: '13px'}}>
              Trazado continuo de la ruta GPS con gradiente acento-lima y punto de llegada destacado:
            </p>
            <TrazoNuevo />
          </section>

          {/* Plegable con Expansión Suave */}
          <section className="mq-seccion mq-stagger-3">
            <h3 style={{margin: 0}}>Plegable.jsx · Expansión Continua sin Saltos</h3>
            <p className="mu" style={{margin: 0, fontSize: '13px'}}>
              Transición de altura natural con CSS Grid (0fr a 1fr) sin límite forzado de max-height:
            </p>
            <PlegableNuevo
              titulo="Detalles de recuperación del día"
              resumen="3 señales positivas detectadas"
              inicial={false}
              icono="info"
            >
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', paddingTop: 'var(--sp-2)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px'}}>
                  <span className="mu">Variabilidad cardíaca (VFC):</span>
                  <b style={{color: 'var(--pos)'}}>Alta (+12%)</b>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px'}}>
                  <span className="mu">Eficiencia del sueño:</span>
                  <b style={{color: 'var(--tx)'}}>91% (óptimo)</b>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px'}}>
                  <span className="mu">Carga muscular residual:</span>
                  <b style={{color: 'var(--info)'}}>Ligera</b>
                </div>
              </div>
            </PlegableNuevo>
          </section>
        </div>
      )}

      {tab === 'dashboard' && <TarjetasHoyComidas />}

      {tab === 'coach' && <EstadoCargaCoach />}
    </div>
  )
}
