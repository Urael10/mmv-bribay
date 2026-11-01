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
import './styles.css'
createRoot(document.getElementById('root')).render(<App />)
if ('serviceWorker' in navigator)
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
// Pide que el navegador no borre tus datos locales si falta espacio (sin esto Android/Chrome puede limpiarlos).
navigator.storage?.persist?.().catch(() => {})
