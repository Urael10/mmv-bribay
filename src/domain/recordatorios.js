import {sumaDias} from './stats.js'
import {checkinHecho} from './checkin.js'
import {habitualNoche, parseHora} from './sueno.js'

// Entrega 41 (v0.42.0) · recordatorios (lógica pura). Decide CUÁNDO avisar; no sabe de plugins, de Android ni de pantallas.
//
// Una notificación local ya programada no puede mirar tus datos cuando suena (la app puede estar cerrada). Por eso
// el plan es una ventana de DIAS_VENTANA días que se vuelve a calcular cada vez que cambian los datos o la
// configuración: al cumplir algo hoy (check-in hecho, meta de agua alcanzada) el aviso que quedaba de hoy desaparece
// del plan, y el servicio cancela todo y reprograma.

export const CLAVE_CFG = 'recordatorios' // se guarda con cfg()/setCfg() (localStorage), no en Dexie
export const DIAS_VENTANA = 7
export const MIN_ANTES_ACOSTARTE = 30 // el aviso de acostarte llega este tiempo antes de tu hora habitual
export const INTERVALOS_AGUA = [2, 3, 4] // horas entre avisos
export const TIPOS = ['checkin', 'acostarte', 'agua']

export const CONFIG_BASE = {
  checkin: {on: false, hora: '21:00'},
  acostarte: {on: false},
  agua: {on: false, desde: '09:00', hasta: '21:00', cada: 3}
}

const DIA_MIN = 1440
const minDe = txt => {
  const p = parseHora(txt)
  return p ? p.h * 60 + p.m : null
}
const dosCifras = n => String(n).padStart(2, '0')
// «7:05» → «07:05»; si no es una hora válida, devuelve `porDefecto`.
const horaValida = (txt, porDefecto) => {
  const p = parseHora(txt)
  return p ? `${dosCifras(p.h)}:${dosCifras(p.m)}` : porDefecto
}

// Convierte lo guardado (texto JSON, objeto o nada) en una configuración completa y válida. Nunca lanza.
export function normalizarConfig(crudo) {
  let c = crudo
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c)
    } catch {
      c = null
    }
  }
  c = c && typeof c === 'object' ? c : {}
  const b = CONFIG_BASE
  let desde = horaValida(c.agua?.desde, b.agua.desde),
    hasta = horaValida(c.agua?.hasta, b.agua.hasta)
  if (minDe(desde) >= minDe(hasta)) [desde, hasta] = [b.agua.desde, b.agua.hasta] // la franja tiene que tener largo
  return {
    checkin: {on: c.checkin?.on === true, hora: horaValida(c.checkin?.hora, b.checkin.hora)},
    acostarte: {on: c.acostarte?.on === true},
    agua: {
      on: c.agua?.on === true,
      desde,
      hasta,
      cada: INTERVALOS_AGUA.includes(Number(c.agua?.cada)) ? Number(c.agua.cada) : b.agua.cada
    }
  }
}

export const hayActivos = cfg => TIPOS.some(t => cfg?.[t]?.on === true)

// Instantes (minutos desde las 00:00 de un día) de los avisos de agua: desde, desde+cada, … hasta `hasta` inclusive.
export function horasDeAgua({desde, hasta, cada}) {
  const a = minDe(desde),
    z = minDe(hasta),
    paso = Math.max(1, Number(cada)) * 60,
    r = []
  if (a == null || z == null) return r
  for (let m = a; m <= z; m += paso) r.push(m)
  return r
}

// Mismo día + `min` minutos, sin que un cambio de hora (verano) corra el reloj: se arma con el calendario, no sumando ms.
const instante = (f, min) => {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(y, m - 1, d, 0, min, 0, 0).getTime()
}

/**
 * Plan de avisos de los próximos DIAS_VENTANA días, del más próximo al más lejano.
 * @param {object} p
 * @param {object} p.config   configuración (se normaliza acá)
 * @param {number} p.ahoraMs  instante actual
 * @param {string} p.hoy      «AAAA-MM-DD» de hoy (hora local)
 * @param {object[]} p.habitos filas de hábitos de los últimos días (con la de hoy, si existe)
 * @param {number} p.metaAgua meta diaria de agua en ml
 * @returns {{id:number, cuando:number, tipo:string, titulo:string, cuerpo:string}[]}
 */
export function planRecordatorios({config, ahoraMs, hoy, habitos = [], metaAgua = 0}) {
  const cfg = normalizarConfig(config),
    fila = (habitos || []).find(h => h?.fecha === hoy),
    out = []
  if (!hayActivos(cfg) || !Number.isFinite(ahoraMs) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hoy))) return out
  const futuro = ms => ms > ahoraMs
  const habitual = cfg.acostarte.on ? habitualNoche(habitos, hoy) : null
  const aguaListos = (+fila?.agua || 0) >= (+metaAgua || Infinity) // meta alcanzada hoy: no se insiste con el agua

  for (let i = 0; i < DIAS_VENTANA; i++) {
    const dia = sumaDias(hoy, i)
    if (cfg.checkin.on && !(i === 0 && checkinHecho(fila))) {
      const t = instante(dia, minDe(cfg.checkin.hora))
      if (futuro(t))
        out.push({
          tipo: 'checkin',
          cuando: t,
          titulo: 'Check-in de 20 segundos',
          cuerpo: 'Tres toques: energía, ánimo y dolor muscular.'
        })
    }
    if (habitual) {
      // La noche del día `dia` empieza esa tarde. Si te acostás pasada la medianoche (00:30), el aviso cae ya en el día
      // siguiente (a las 00:00), por eso se suma un día a las horas «de madrugada».
      const a = minDe(habitual.acosto),
        t = instante(dia, (a < 12 * 60 ? a + DIA_MIN : a) - MIN_ANTES_ACOSTARTE)
      if (futuro(t))
        out.push({
          tipo: 'acostarte',
          cuando: t,
          titulo: 'Ya casi es hora de dormir',
          cuerpo: `Tu hora habitual de acostarte es ${habitual.acosto}.`
        })
    }
    if (cfg.agua.on && !(i === 0 && aguaListos)) {
      for (const m of horasDeAgua(cfg.agua)) {
        const t = instante(dia, m)
        if (futuro(t)) out.push({tipo: 'agua', cuando: t, titulo: 'Agua', cuerpo: 'Un vaso de agua, ¿te parece?'})
      }
    }
  }
  out.sort((x, y) => x.cuando - y.cuando)
  return out.map((o, n) => ({id: n + 1, ...o}))
}

// Frase para la pantalla de Ajustes: qué pasa con «Acostarte» según haya o no hora habitual.
export function estadoAcostarte(habitos, hoy) {
  const h = habitualNoche(habitos, hoy)
  return h ? {listo: true, acosto: h.acosto, dias: h.dias} : {listo: false}
}

// «AAAA-MM-DD» local de un instante (el servicio lo usa para notar que cambió el día).
export const diaDe = ms => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`
}
