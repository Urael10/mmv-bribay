// MMV · plataforma: adaptador fino a Capacitor. Dice dónde corre la app: navegador/PWA o contenedor nativo (APK).
// Regla de la arquitectura: solo src/platform conoce a Capacitor. src/domain no importa nada de aquí ni de plugins.
import {Capacitor} from '@capacitor/core'

// `cap` se puede inyectar para probar sin un contenedor real (tests/platform/plataforma.test.js).
// Todo es a prueba de fallos: si Capacitor falta o lanza un error, se asume navegador, que es el caso de la PWA.
export function crearPlataforma(cap = Capacitor) {
  const nativo = () => {
    try {
      return cap?.isNativePlatform?.() === true
    } catch {
      return false
    }
  }
  const nombre = () => {
    try {
      const p = String(cap?.getPlatform?.() ?? 'web').toLowerCase()
      return p === 'android' || p === 'ios' ? p : 'web'
    } catch {
      return 'web'
    }
  }
  return {
    /** true solo dentro del contenedor nativo (APK); false en el navegador y en la PWA instalada */
    esNativo: nativo,
    /** 'android' | 'ios' | 'web' */
    plataforma: nombre,
    esAndroid: () => nombre() === 'android',
    /**
     * El service worker es solo de la PWA. Dentro del APK los archivos ya viajan en el paquete:
     * una caché propia los dejaría desactualizados después de instalar una versión nueva.
     * `nav` se puede inyectar para probar (por defecto, el navigator real).
     */
    permiteServiceWorker: (nav = globalThis.navigator) => !!nav && 'serviceWorker' in nav && !nativo()
  }
}

export const {esNativo, plataforma, esAndroid, permiteServiceWorker} = crearPlataforma()
