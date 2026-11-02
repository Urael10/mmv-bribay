// Reloj del entrenamiento: vive FUERA de las pantallas, así sigue corriendo si cambiás de pestaña.
// Usa la hora real (domain/temporizador), mantiene la pantalla encendida (Wake Lock) y avisa con
// sonido y vibración. El estado se guarda en localStorage: sobrevive a recargar la app.
import {armarSegmentos, posicion, transcurrido, alternar, aviso} from '../domain/temporizador.js'

const KEY = 'mv_timer'
const leer = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
let st = leer() // {b, bi, ac, ini, r, tiempo}
let ver = 0
let tick = null
let ultima = null
let audio = null
let lock = null
const subs = new Set()

const guardar = () => {
  try {
    st ? localStorage.setItem(KEY, JSON.stringify(st)) : localStorage.removeItem(KEY)
  } catch {}
}
const avisar = () => {
  ver++
  subs.forEach(f => f())
}
export const suscribir = f => {
  subs.add(f)
  return () => subs.delete(f)
}
export const version = () => ver
export const estado = () => st

export const segmentos = () => (st ? armarSegmentos(st.b) : [])
export const ahoraPos = () => (st ? posicion(segmentos(), transcurrido(st, Date.now())) : null)
export const enMarcha = () => !!st && st.ini != null

const sonido = () => localStorage.getItem('mv_sonido') !== '0'
function pitar(freq, ms, vol = 0.35) {
  if (!sonido()) return
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    const o = audio.createOscillator(),
      g = audio.createGain()
    o.frequency.value = freq
    g.gain.value = vol
    o.connect(g)
    g.connect(audio.destination)
    o.start()
    o.stop(audio.currentTime + ms / 1000)
  } catch {}
}
const vibrar = p => {
  try {
    navigator.vibrate?.(p)
  } catch {}
}
function sonar(a) {
  if (a === 'cuenta') pitar(880, 120)
  else if (a === 'cambio') {
    pitar(1320, 380)
    vibrar(250)
  } else if (a === 'fin') {
    pitar(1320, 250)
    setTimeout(() => pitar(1320, 250), 350)
    setTimeout(() => pitar(1760, 600), 700)
    vibrar([200, 100, 200, 100, 500])
  }
}

async function pedirPantalla() {
  try {
    if (!('wakeLock' in navigator) || lock) return
    lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      lock = null
    })
  } catch {}
}
function soltarPantalla() {
  try {
    lock?.release()
  } catch {}
  lock = null
}
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && enMarcha()) pedirPantalla()
  })

function arrancarTick() {
  if (tick) return
  tick = setInterval(() => {
    if (!st) return pararTick()
    const p = ahoraPos()
    const a = aviso(ultima, p)
    ultima = p
    if (a) sonar(a)
    if (p.fin && enMarcha()) {
      // terminó el tiempo: se detiene en el total
      st = {...alternar(st, Date.now())}
      guardar()
      pararTick()
      soltarPantalla()
    }
    avisar()
  }, 200)
}
function pararTick() {
  clearInterval(tick)
  tick = null
}

// Arranca de inmediato (se llama desde un toque, así el navegador permite el sonido).
export function iniciar(b, bi) {
  const {tipo, minutos, intervalo, trab, desc, rond, vueltas, ejercicios} = b
  st = {
    b: {tipo, minutos, intervalo, trab, desc, rond, vueltas, ejercicios},
    bi,
    ac: 0,
    ini: Date.now(),
    r: 0,
    tiempo: 0
  }
  ultima = null
  guardar()
  pitar(660, 80, 0.01) // "despierta" el audio dentro del toque
  pedirPantalla()
  arrancarTick()
  avisar()
}
export function pausarOReanudar() {
  if (!st) return
  st = alternar(st, Date.now())
  guardar()
  if (st.ini != null) {
    pitar(660, 80, 0.01)
    pedirPantalla()
    arrancarTick()
  } else {
    pararTick()
    soltarPantalla()
  }
  avisar()
}
export function sumarRonda() {
  if (!st) return
  st = {...st, r: st.r + 1}
  guardar()
  avisar()
}
// For time: marca el tiempo real que llevás en el bloque y detiene el reloj.
export function terminar() {
  if (!st) return
  const ahora = Date.now()
  const p = posicion(segmentos(), transcurrido(st, ahora))
  const seg = p.seg.sube ? Math.min(p.trans, p.seg.s) : 0
  st = {...st, ac: transcurrido(st, ahora), ini: null, tiempo: seg}
  guardar()
  pararTick()
  soltarPantalla()
  avisar()
}
// Cierra y devuelve lo que hay que guardar en el bloque.
export function cerrar() {
  const res = st ? {bi: st.bi, rondas: st.r, tiempo: st.tiempo} : null
  st = null
  ultima = null
  guardar()
  pararTick()
  soltarPantalla()
  avisar()
  return res
}
if (enMarcha()) arrancarTick()
