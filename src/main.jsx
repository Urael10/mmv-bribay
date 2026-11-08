import {Component} from 'react'
import {createRoot} from 'react-dom/client'
// Tipografías incluidas en la app (funcionan sin conexión y sin pedir nada a Google Fonts)
import '@fontsource/bebas-neue/latin-400.css'
import '@fontsource/chakra-petch/latin-400.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import App from './App.jsx'
import {permiteServiceWorker} from './platform/plataforma.js'
import './tokens.css'
import './styles.css'
class Fallo extends Component {
  state = {e: null}
  static getDerivedStateFromError(e) {
    return {e}
  }
  render() {
    if (!this.state.e) return this.props.children
    return (
      <div style={{padding: 24}}>
        <h2>Algo falló al mostrar la app</h2>
        <p>Tus datos no se borraron. Pasame este mensaje:</p>
        <pre style={{whiteSpace: 'pre-wrap', fontSize: 12}}>{String(this.state.e?.stack || this.state.e)}</pre>
        <button onClick={() => location.reload()}>Recargar</button>
      </div>
    )
  }
}
createRoot(document.getElementById('root')).render(
  <Fallo>
    <App />
  </Fallo>
)
// El service worker es solo de la PWA: dentro del APK (Capacitor) no se registra.
if (permiteServiceWorker())
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
// Pide que el navegador no borre tus datos locales si falta espacio (sin esto Android/Chrome puede limpiarlos).
navigator.storage?.persist?.().catch(() => {})
