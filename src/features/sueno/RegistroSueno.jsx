import {
  DURACIONES_RAPIDAS, duracionHM, extraSiestas, reaplicarNoche
} from '../../domain/sueno'
import {hayDato} from '../../domain/formato'
import Icono from '../../ui/Icono'

// Registro del sueño del día (Entrega 39). Tres maneras, de menos a más esfuerzo:
//  1. «Igual que siempre»: un toque con tu hora habitual de acostarte y levantarte (de los últimos días).
//  2. Las dos horas (me acosté / me desperté): el total se calcula solo, también si cruza la medianoche.
//  3. Solo la duración: chips de 5 a 9 h o el campo del total.
// `h` es la fila de hoy y `g(parche)` la guarda (viene de Hoy: la base solo se toca desde allí).
// Los controles de calidad son los mismos botones 1–5 que Energía, Ánimo y Dolor.
export default function RegistroSueno({h, g, habitual}) {
  const extra = extraSiestas(h),
    total = hayDato(h.sueno) && +String(h.sueno).replace(',', '.') > 0 ? h.sueno : '',
    igualQueSiempre =
      habitual && !(h.acosto === habitual.acosto && h.desperto === habitual.desperto)
  const cambiaHora = (k, v) => g(reaplicarNoche(h, k === 'acosto' ? v : h.acosto, k === 'desperto' ? v : h.desperto))
  return (
    <div className="sq" id="hoy-sueno-reg" role="group" aria-labelledby="sq-t" tabIndex={-1}>
      <div className="sq-cab">
        <b className="ck-n" id="sq-t">
          Sueño
        </b>
        <span className="mono sq-total" aria-live="polite">
          {duracionHM(total) || '—'}
        </span>
      </div>
      {igualQueSiempre && (
        <button
          type="button"
          className="ghost sq-igual"
          onClick={() => g(reaplicarNoche(h, habitual.acosto, habitual.desperto))}
        >
          <Icono n="repetir" tam={16} className="en-texto" /> Igual que siempre · {habitual.acosto} → {habitual.desperto}
        </button>
      )}
      <div className="sq-horas">
        <label className="ck-c">
          <span className="mu">Me acosté</span>
          <input type="time" value={h.acosto || ''} onChange={e => cambiaHora('acosto', e.target.value)} />
        </label>
        <label className="ck-c">
          <span className="mu">Me desperté</span>
          <input type="time" value={h.desperto || ''} onChange={e => cambiaHora('desperto', e.target.value)} />
        </label>
      </div>
      {extra > 0 && (
        <small className="mu sq-extra">
          Incluye ≈ {duracionHM(extra)} de siestas u otras sesiones: el total es de todo el día.
        </small>
      )}
      <div className="sq-tot">
        <label className="ck-c">
          <span className="mu">Total de horas</span>
          <input
            className="fx"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            max="24"
            placeholder="—"
            aria-label="Horas de sueño de hoy (total del día)"
            value={h.sueno ?? ''}
            onChange={e => g({sueno: e.target.value})}
          />
        </label>
        <div className="sq-chips" role="group" aria-label="Duración rápida en horas">
          {DURACIONES_RAPIDAS.map(n => (
            <button
              key={n}
              type="button"
              className={'chip sq-chip' + (+h.sueno === n ? ' on' : '')}
              aria-pressed={+h.sueno === n}
              onClick={() => g(+h.sueno === n ? {sueno: ''} : {sueno: n, acosto: null, desperto: null})}
            >
              {n} h
            </button>
          ))}
        </div>
      </div>
      <div className="ck">
        <b className="ck-n" id="ck-calidad">
          Calidad
        </b>
        <div className="escala" role="group" aria-labelledby="ck-calidad" aria-description="1 mala, 5 excelente">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              className={+h.calidad === n ? 'on' : ''}
              aria-pressed={+h.calidad === n}
              onClick={() => g({calidad: +h.calidad === n ? null : n})}
            >
              {n}
            </button>
          ))}
        </div>
        <small className="mu sq-ext">
          <span>1 · mala</span>
          <span>5 · excelente</span>
        </small>
      </div>
    </div>
  )
}
