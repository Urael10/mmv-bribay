import type {CapacitorConfig} from '@capacitor/cli'

// MMV · contenedor Android (Capacitor). Es la misma app web (carpeta dist): Capacitor solo la empaqueta en un APK.
//
// OJO, dos valores no se cambian una vez instalado el primer APK:
//  · appId: Android lo toma como identidad de la app; con otro valor es OTRA app y la anterior queda con sus datos.
//  · server.androidScheme: define el origen del WebView (https://localhost). Con otro esquema cambia el origen
//    y Dexie/IndexedDB y localStorage quedan inaccesibles (se verían vacíos).
const config: CapacitorConfig = {
  appId: 'online.bribayfitness.mmv',
  appName: 'Mi Mejor Versión',
  webDir: 'dist',
  // Mismo color que --bg (tokens.css) y theme-color de index.html: evita el destello blanco antes del primer dibujo.
  backgroundColor: '#0A0F14',
  server: {androidScheme: 'https'},
  plugins: {
    SystemBars: {
      // La app ya usa viewport-fit=cover y env(safe-area-inset-*): con «native» el WebView respeta esas medidas.
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      // La app es siempre oscura: íconos claros en la barra de estado y la de navegación (aunque el teléfono esté en modo claro).
      style: 'DARK'
    }
  }
}

export default config
