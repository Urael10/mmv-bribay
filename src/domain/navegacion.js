// Navegación de MMV (Entrega 42, v0.43.0): qué hace el botón atrás de Android. Lógica pura: App.jsx es quien navega.
//
// MMV no usa el historial del navegador (las pantallas son pestañas), así que «atrás» significa:
//   · dentro de Ajustes → volver a la pestaña de la que se vino;
//   · en Entreno, Comidas o Progreso → volver a Hoy;
//   · en Hoy → salir de la app.
// Los modos de pantalla completa («Dormir con alarma» y «bolsillo») se cierran a propósito de otra forma (mantener
// presionado, o apagar la alarma): ahí «atrás» no hace nada, para no cortar una noche de sueño ni el conteo de pasos.

export const OVERLAYS_QUE_BLOQUEAN = '.sueno-ov, .bolsillo-ov'

/** @param {{tab:string, previa?:string}} e @returns {{tipo:'ir', tab:string}|{tipo:'salir'}} */
export function accionAtras({tab, previa} = {}) {
  if (tab === 'ajustes' || tab === 'priv') return {tipo: 'ir', tab: previa && previa !== 'ajustes' && previa !== 'priv' ? previa : 'hoy'}
  if (tab && tab !== 'hoy') return {tipo: 'ir', tab: 'hoy'}
  return {tipo: 'salir'}
}
