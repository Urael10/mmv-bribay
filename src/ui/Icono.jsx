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
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-abajo': <path d="M6 9l6 6 6-6" />,
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  pausa: <path d="M9 6v12M15 6v12" />,
  punto: <circle cx="12" cy="12" r="4" />,
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
