# Mi Mejor Versión (MMV) · Entrega 26 (v0.27.0)

App personal de seguimiento: entrenos, hábitos, comidas, progreso, cuerpo y actividad física. Todo se guarda en el dispositivo (IndexedDB con Dexie, versión 11). Historial completo de cambios en `CHANGELOG.md`.

## Estructura
```
src/domain/    lógica pura con pruebas: actividad (pasos, GPS, actividades), rutas (recorrido, trazo, parciales), alimentos, backup, biblioteca, checkin, cuerpo, entreno, informe, preparacion, privado (cifrado), progreso, registro, stats, temporizador
src/data/      base de datos (Dexie v11), backup, biblioteca, menú privado, semilla de alimentos
src/services/  IA (Gemini), Open Food Facts, escáner de código de barras, imágenes, reloj del entrenamiento, pendientes
src/features/  pantallas: hoy, actividad (pasos y actividades), rutas (historial GPS), entreno, comidas, progreso, cuerpo, coach, ajustes, bienestar (menú privado), biblioteca (ejercicios)
tests/         pruebas con `node --test` (`entrega20.test.js`: actividad física; `entrega26.test.js`: rutas GPS)
public/        manifest, íconos y service worker (`sw.js`)
```
Los componentes de `features/` solo muestran y guardan; las reglas y cálculos viven en `domain/` para poder probarlos.

## Comandos
Requiere Node 20.19 o superior (ver `.node-version`).
```
npm ci          # instala exactamente lo del lockfile
npm test        # pruebas
npm run dev     # servidor local (accesible desde el celular en la misma red)
npm run build   # compila a dist/ (agrega version.json con versión y fecha de compilación)
```

## Publicación
Desde la carpeta del repositorio: `./publicar.sh ~/Descargas/mmv-vX.Y.Z-CODIGO.zip "texto del cambio" [rama]`. El script reemplaza el código por el del zip y lo sube a GitHub; `.github/workflows/publicar.yml` ejecuta `npm ci`, `npm test` y `npm run build`, y publica en Cloudflare Pages (proyecto `mmv-bribay`, https://mmv-bribay.pages.dev). Si una prueba falla, no se publica. La rama `main` es producción; la rama `prueba` publica en una dirección aparte.

## Actividad física (v0.22.0) y rutas (v0.27.0)
- Pasos: se pueden cargar a mano o contar con el acelerómetro (solo con MMV abierto y visible; la pantalla se mantiene encendida mientras se cuenta).
- GPS: mide la distancia, corrige el conteo cuando el sensor se perdió pasos o no tiene permiso, y precarga la actividad (tipo, minutos y km). La ubicación en vivo nunca sale del teléfono.
- Rutas: con el GPS activado, el recorrido se guarda como ruta (opcional, en «Ajustes del conteo») y se ve en Hoy › Rutas con trazo SVG, ritmo y parciales por km. Queda solo en el teléfono y viaja en el backup; no se envía a la IA. Por defecto se ocultan los primeros y últimos 150 m del trazo (tu casa).
- El conteo es una estimación y depende de dónde lleves el teléfono. No reemplaza a un podómetro del sistema o del reloj.
- Sensor y GPS requieren https (el sitio publicado lo cumple).

## Formato
`.prettierrc` (Prettier 3: sin punto y coma, comillas simples, 100 columnas).
