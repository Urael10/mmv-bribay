# Mi Mejor Versión (MMV) · Entrega 9 (v0.11.0)

## Estructura (desde la entrega 6)
```
src/domain/    lógica pura con pruebas: stats, preparacion (v2), checkin, cuerpo, progreso, entreno (plantillas, repetir, serie pesada), informe, alimentos, registro, temporizador, backup
src/data/      base de datos (Dexie v8), semilla de alimentos, backup
src/services/  IA (Gemini), Open Food Facts, escáner de código de barras, reloj del entrenamiento, imágenes
src/features/  pantallas: hoy, entreno (+Timer), comidas, progreso, cuerpo, coach, ajustes
tests/         `npm test` (123 pruebas esperadas)
```
Publicación: ver `.github/workflows/publicar.yml` y `publicar.sh` (GitHub compila, prueba y publica en Cloudflare Pages).
Formato: `.prettierrc` (Prettier 3, sin punto y coma, comillas simples).

# Entregas anteriores (v0.7.2)
Requisitos para compilar: Node 20.19 o superior (la compilación se hace en la sesión de Claude, no en la Celeron). Para probar: `npm install`, `npm test`, `npm run dev`.
1. `npm install`
2. `npm test` (opcional: pruebas de la lógica de alimentos y calorías)
3. `npm run dev` o `npm run build` y publicar `dist` en Cloudflare Pages (proyecto `mmv-bribay`).
4. En Ajustes pegá tu clave gratuita de https://aistudio.google.com/apikey

## Novedades de la entrega 4
Ver CHANGELOG.md. Archivos nuevos: `src/off.js` (cliente de Open Food Facts), `src/registro.js` (recientes, porciones y comidas guardadas), `tests/entrega4.test.js`. `src/Comidas.jsx` se reescribió. Base de datos Dexie v5.

## Novedades de la entrega 3
Ver CHANGELOG.md. Archivos nuevos: `src/preparacion.js` (puntaje), `src/informe.js` (informe y coach, lógica pura), `src/Entrega3.jsx` (pantallas), `tests/entrega3.test.js`. Base de datos Dexie v4 (agrega la tabla `coach`).

## Novedades de la 2C
Ver CHANGELOG.md. Archivos nuevos: `src/Comidas.jsx` (pantalla), `src/alimentos.js` (cálculos, búsqueda, validaciones), `src/semilla.js` (alimentos iniciales), `src/img.js`, `tests/alimentos.test.js`.

## Novedades de la 2B
- Pestaña **Progreso** con tres vistas: Semana, Historial y Récords.
- Volumen semanal por patrón de movimiento (Empuje, Tirón, Rodilla, Cadera, Core, Cardio, Movilidad, Otro), en repeticiones o tonelaje, con comparación contra la semana anterior.
- Historial de sesiones con detalle por bloque, 🏆 en marcas superadas, variación contra la vez anterior y opción de borrar una sesión.
- Récords por ejercicio: carga máxima, 1RM estimado (Epley, solo con 12 reps o menos), mejor volumen, reps máximas sin carga y gráfico de evolución.
- En Entreno: "vs última" en vivo mientras cargás kg y reps, y aviso de récords al guardar la sesión.
- El patrón de cada ejercicio es automático (palabras clave) y se puede corregir a mano en Récords.
- No cambia la base de datos (sigue Dexie versión 2): tus datos y backups actuales funcionan igual.

## Archivos
`src/stats.js` (cálculos), `src/Progreso.jsx` (pestaña nueva), `src/App.jsx` (Entreno con deltas y récords).
