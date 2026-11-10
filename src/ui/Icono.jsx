// Set de íconos SVG de un solo trazo (24×24, 2 px, puntas redondas). Toman el color del texto (currentColor).
// Decorativos por defecto (aria-hidden): el texto del botón ya dice qué hace. Con `etiqueta` quedan como imagen accesible.
const RUTAS = {
  camara: (
    <>
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  lapiz: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 0l0 0a2 2 0 0 1 0 3L8 19l-4 1Z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  libro: (
    <>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
      <path d="M5 17a2 2 0 0 1 2-2h11" />
    </>
  ),
  repetir: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.6L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  balanza: (
    <>
      <path d="M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11a4.5 4.5 0 0 1 7 0" />
      <path d="M12 11.2l1.6-1.6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'flecha-arriba': (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  'flecha-abajo': (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4l9 16H3L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8v.1" />
    </>
  ),
  igual: (
    <>
      <path d="M6 9.5h12" />
      <path d="M6 14.5h12" />
    </>
  ),
  circulo: <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />,
  // Barra inferior y cabecera (v0.25.0)
  hoy: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  entreno: (
    <>
      <path d="M6.5 6.5v11" />
      <path d="M17.5 6.5v11" />
      <path d="M3.5 9.5v5" />
      <path d="M20.5 9.5v5" />
      <path d="M6.5 12h11" />
    </>
  ),
  comidas: (
    <>
      <path d="M6 3v6a2.5 2.5 0 0 0 5 0V3" />
      <path d="M8.5 11.5V21" />
      <path d="M17 21V3c-2.4 1.4-3.6 4-3.6 7 0 2 1.2 3.2 3.6 3.2" />
    </>
  ),
  progreso: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  // Entrega 37: reemplazan a los emojis y símbolos de texto de la interfaz
  candado: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </>
  ),
  estrella: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />,
  trofeo: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H4v1a3 3 0 0 0 3 3M16 6h4v1a3 3 0 0 1-3 3" />
      <path d="M12 13v4M8.5 20h7" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="M15 10.5l6-3v9l-6-3" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9Z" />
    </>
  ),
  rayo: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  bandera: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  deshacer: (
    <>
      <path d="M9 6L4 11l5 5" />
      <path d="M4 11h9a5 5 0 0 1 0 10h-3" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  plato: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <path d="M7.5 8.5v.1" />
    </>
  ),
  'chevron-izq': <path d="M15 6l-6 6 6 6" />,
  'chevron-der': <path d="M9 6l6 6-6 6" />,
  detener: <rect x="6" y="6" width="12" height="12" rx="2" />,
  reloj: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 3h5" />
    </>
  ),
  'izq-der': <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-abajo': <path d="M6 9l6 6 6-6" />,
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  pausa: <path d="M9 6v12M15 6v12" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  punto: <circle cx="12" cy="12" r="4" />,
  gota: <path d="M12 3.5c3.2 3.9 6 6.9 6 10.4a6 6 0 0 1-12 0c0-3.5 2.8-6.5 6-10.4Z" />,
  cubiertos: (
    <>
      <path d="M5 3v6a3 3 0 0 0 6 0V3" />
      <path d="M8 3v18" />
      <path d="M17.5 21V3c-2.2 1.3-3.5 4-3.5 7.2 0 1.6 1.2 2.6 3.5 2.6" />
    </>
  ),
  pasos: (
    <>
      <path d="M9 3.5c1.8 0 3 1.6 3 4 0 2.6-1.2 3.6-1.2 5.6H7.2C7 11.1 6 10 6 7.5c0-2.4 1.3-4 3-4Z" />
      <path d="M7 16.5h3.6v2a1.8 1.8 0 0 1-3.6 0v-2Z" />
      <path d="M16 11c1.6 0 2.7 1.4 2.7 3.6 0 2.3-1.1 3.3-1.1 5.1h-3.2c0-1.8-1.1-2.8-1.1-5.1 0-2.2 1.1-3.6 2.7-3.6Z" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </>
  )
}

export default function Icono({n, tam = 20, etiqueta, className = ''}) {
  return (
    <svg
      className={('ico ' + className).trim()}
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(etiqueta ? {role: 'img', 'aria-label': etiqueta} : {'aria-hidden': true})}
      focusable="false"
    >
      {RUTAS[n]}
    </svg>
  )
}
export const ICONOS = Object.keys(RUTAS)
