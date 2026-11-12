// Entrega 49 (v0.50.0) · sonido, vibración y festejo. Ejecuta lo que decide src/domain/feedback.js:
// hápticos por src/platform/hapticos.js, tonos con Web Audio y confeti en un canvas pasajero.
// Estado en localStorage (como el reloj): `mv_feedback` (nivel) y `mv_fb_dia` (qué se festejó hoy). Dexie no se toca.
import {
  accionesDe, tiemposTono, nivelDe, leerEstado, marcarMeta, marcarDia, yaFestejada, cierraElDia, METAS_DIA
} from '../domain/feedback.js'
import {vibrar as vibrarNativo} from '../platform/hapticos.js'

const K_NIVEL = 'mv_feedback',
  K_DIA = 'mv_fb_dia'
const leer = k => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const escribir = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {}
}
const fechaHoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)

export const nivel = () => nivelDe(leer(K_NIVEL))
export const guardarNivel = v => escribir(K_NIVEL, nivelDe(v))
const sonidoActivo = () => leer('mv_sonido') !== '0' // el mismo ajuste que apaga el reloj

let audio = null
function nota(f, ms, t0, vol = 0.2) {
  audio ??= new (window.AudioContext || window.webkitAudioContext)()
  if (audio.state === 'suspended') audio.resume()
  const o = audio.createOscillator(),
    g = audio.createGain(),
    t = audio.currentTime + t0
  o.type = 'sine'
  o.frequency.value = f
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
  o.connect(g)
  g.connect(audio.destination)
  o.start(t)
  o.stop(t + ms / 1000 + 0.05)
}

/** Dispara un evento: 'toque' | 'guardar' | 'meta' | 'entreno' | 'dia'. Nunca lanza. */
export function sentir(evento) {
  const a = accionesDe(evento, nivel(), {sonidoActivo: sonidoActivo()})
  if (a.vib) vibrarNativo(a.vib).catch(() => {})
  if (a.tono)
    try {
      tiemposTono(a.tono).forEach(n => nota(n.f, n.ms, n.t))
    } catch {}
}

// ---- Confeti (solo con el tono festivo, que es el único) ----
const quieto = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const token = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

export function confeti(el, n = 24) {
  if (quieto() || typeof document === 'undefined') return
  try {
    const cv = document.createElement('canvas')
    cv.setAttribute('aria-hidden', 'true')
    cv.className = 'confeti'
    cv.width = innerWidth
    cv.height = innerHeight
    document.body.appendChild(cv)
    const cx = cv.getContext('2d'),
      b = (el || document.body).getBoundingClientRect(),
      ox = el ? b.left + b.width / 2 : innerWidth / 2,
      oy = el ? b.top + b.height / 2 : innerHeight / 3,
      cols = ['--ac', '--pr', '--pos', '--warn', '--m-sueno', '--m-pasos'].map(token).filter(Boolean),
      ps = Array.from({length: n}, () => ({
        x: ox, y: oy, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 2,
        r: Math.random() * 6, w: 4 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0] || '#fff', l: 1
      }))
    const t0 = performance.now()
    const fin = () => cv.remove()
    ;(function f(t) {
      cx.clearRect(0, 0, cv.width, cv.height)
      let vivo = false
      for (const p of ps) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; p.l -= 0.012
        if (p.l <= 0) continue
        vivo = true
        cx.globalAlpha = p.l
        cx.fillStyle = p.c
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillRect(-p.w / 2, -2, p.w, 4); cx.restore()
      }
      if (vivo && t - t0 < 2200) requestAnimationFrame(f)
      else fin()
    })(t0)
  } catch {}
}

// ---- Metas del día ----
const cumplidas = new Set() // metas que están cumplidas ahora (las avisan las teselas de Hoy)
const estado = () => leerEstado(leer(K_DIA), fechaHoy())
const guardar = e => escribir(K_DIA, JSON.stringify(e))
const tesela = k => document.querySelector('.tesela.m-' + k)

/** Una tesela avisa si su meta está cumplida ahora (también al abrir, sin festejar). */
export function marcarCumplida(clave, ok) {
  if (!METAS_DIA.includes(clave)) return
  ok ? cumplidas.add(clave) : cumplidas.delete(clave)
}

/** ¿Esta meta ya se festejó hoy? (sirve para no dar un «toque» común justo antes de un festejo que no va a venir). */
export const festejadaHoy = clave => yaFestejada(estado(), clave)

/**
 * La meta acaba de cruzarse. Festeja una sola vez por meta y por día: vibración, sonido y confeti.
 * Si con esta quedan las tres cumplidas y el día no se festejó, el cierre llega un instante después.
 * Devuelve true si festejó (para que la pantalla anime el anillo).
 */
export function festejarMeta(clave) {
  marcarCumplida(clave, true)
  let e = estado()
  const nueva = !yaFestejada(e, clave)
  if (nueva) {
    e = marcarMeta(e, clave)
    guardar(e)
    sentir('meta')
    confeti(tesela(clave), 18)
  }
  if (cierraElDia(cumplidas) && !e.d) {
    guardar(marcarDia(e))
    setTimeout(() => {
      sentir('dia')
      confeti(null, 60)
    }, nueva ? 650 : 0)
  }
  return nueva
}

/** Fin del entreno: el patrón «fin» y un chorro de confeti. */
export function festejarEntreno() {
  sentir('entreno')
  confeti(null, 40)
}
