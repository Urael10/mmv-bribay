import Dexie from 'dexie'
import {SEMILLA} from './semilla.js'
import {claveAl} from '../domain/alimentos.js'
export const db = new Dexie('mv')
db.version(1).stores({sesiones: '++id,fecha', habitos: 'fecha', uso: '++id,fecha'})
db.version(2).stores({ejercicios: '&clave', registros: '++id,fecha,clave'})
db.version(3).stores({alimentos: '++id,&clave', comidas: '++id,fecha'}) // 2C: solo agrega tablas; no toca tus datos
db.version(4).stores({coach: '&semana'}) // 3: solo agrega la tabla de consejos del coach por semana (clave = lunes de la semana)
db.version(5).stores({alimentos: '++id,&clave,fuenteId', plantillas: '++id,&clave'}) // 4: índice por código de barras (fuenteId) y comidas guardadas; no toca tus datos
db.version(6).stores({medidas: 'fecha'}) // 7: peso y composición (una medida por día); solo agrega una tabla, no toca tus datos
db.version(7).stores({tests: '++id,fecha,clave'}) // 8: tests de referencia (cada 6–8 semanas); solo agrega una tabla, no toca tus datos
db.version(8).stores({rutinas: '++id,&clave'}) // 9: plantillas de entreno (estructura de sesión); solo agrega una tabla, no toca tus datos
db.version(9).stores({privado: 'mes'}) // 14: registro privado cifrado (un bloque por mes + fila _meta); solo agrega una tabla, no toca tus datos
db.version(10).stores({actividades: '++id,fecha,tipo'}) // 19: actividad física diaria; conserva los datos existentes
db.version(11).stores({rutas: '++id,fecha,tipo'}) // 26: rutas GPS (trazo compacto, solo en el dispositivo); solo agrega una tabla, no toca tus datos
export const TABLAS = [
  'sesiones',
  'habitos',
  'uso',
  'ejercicios',
  'registros',
  'alimentos',
  'comidas',
  'coach',
  'plantillas',
  'medidas',
  'tests',
  'rutinas',
  'privado',
  'actividades',
  'rutas'
]
export const hoy = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
export const cfg = (k, d = '') => localStorage.getItem('mv_' + k) || d
export const setCfg = (k, v) => localStorage.setItem('mv_' + k, v)
// Carga los alimentos iniciales (una sola vez; con forzar=true repone los que falten sin tocar los tuyos).
export async function sembrar(forzar = false) {
  if (!forzar && cfg('semilla') === '1') return 0
  const hay = new Set((await db.alimentos.toArray()).map(a => a.clave))
  const filas = SEMILLA.map(a => ({...a, clave: claveAl(a.nombre)})).filter(a => !hay.has(a.clave))
  try {
    if (filas.length) await db.alimentos.bulkAdd(filas)
  } catch {}
  setCfg('semilla', '1')
  return filas.length
}
// Importa filas de un backup; si alguna choca con una clave única, la salta y sigue. Devuelve cuántas omitió.
export async function importarTabla(t, filas) {
  try {
    await db[t].bulkPut(filas)
    return 0
  } catch {}
  let omitidas = 0
  for (const f of filas) {
    try {
      await db[t].put(f)
    } catch {
      omitidas++
    }
  }
  return omitidas
}
