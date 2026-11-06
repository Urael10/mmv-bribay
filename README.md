# Mi Mejor Versión (MMV) · Entrega 29 (v0.30.0)

App personal de seguimiento: entrenos, hábitos, comidas, progreso, cuerpo y actividad física. Todo se guarda en el dispositivo (IndexedDB con Dexie, versión 11). Historial completo de cambios en `CHANGELOG.md`.

## Estructura
```
src/domain/    lógica pura con pruebas: actividad (pasos, GPS, actividades), rutas (recorrido, trazo, parciales), mapa (teselas OSM), gpx (exportar/importar), alimentos, backup, biblioteca, checkin, cuerpo, entreno, informe, movimiento (pasos, actividades y rutas sin doble conteo), preparacion, privado (cifrado), progreso, registro, stats, temporizador
src/data/      base de datos (Dexie v11), backup, biblioteca, menú privado, semilla de alimentos
src/services/  IA (Gemini), Open Food Facts, escáner de código de barras, imágenes, reloj del entrenamiento, pendientes
src/features/  pantallas: hoy, actividad (pasos y actividades), rutas (historial GPS, dentro de Progreso), entreno, comidas, progreso, cuerpo, coach, ajustes, bienestar (menú privado), biblioteca (ejercicios)
tests/         pruebas con `node --test` (`entrega20.test.js`: actividad física; `entrega26.test.js`: rutas GPS; `entrega27.test.js`: mapa y GPX; `entrega28.test.js`: carga diferida; `entrega29.test.js`: IA con actividad y rutas)
public/        manifest, íconos y service worker (`sw.js`)
```
`src/ui/pantallas.js` es el registro de las pantallas con carga diferida (`React.lazy`); `src/domain/carga.js` tiene su lógica pura (reintento, cuándo precargar). Los componentes de `features/` solo muestran y guardan; las reglas y cálculos viven en `domain/` para poder probarlos.

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
- Rutas: con el GPS activado, el recorrido se guarda como ruta (opcional, en «Ajustes del conteo») y se ve en Progreso › Rutas (desde Hoy, «Ver mis rutas») con trazo SVG, ritmo y parciales por km. Queda solo en el teléfono y viaja en el backup; la IA nunca recibe el trazo ni coordenadas (ver «IA con actividad y rutas»). Por defecto se ocultan los primeros y últimos 150 m del trazo (tu casa).
- El conteo es una estimación y depende de dónde lleves el teléfono. No reemplaza a un podómetro del sistema o del reloj.
- Sensor y GPS requieren https (el sitio publicado lo cumple).

## Mapa y GPX (v0.28.0)
- Mapa opcional: apagado por defecto. Se permite en Ajustes › Mapa de las rutas; aun así solo se carga al tocar «Ver sobre el mapa» en una ruta. Ahí OpenStreetMap recibe la zona visible (y la IP); la IA y el backup no llevan coordenadas del mapa. Sin librerías: las teselas son `<img>` calculadas en `src/domain/mapa.js`.
- GPX: en Progreso › Rutas se puede exportar una ruta (o todas) e importar archivos GPX de otras apps (trazos `trk` y rutas `rte`; hasta 10 MB). Un GPX contiene coordenadas: queda en tus manos.

## Rendimiento y carga sin conexión (v0.29.0)
- Hoy va en el paquete principal; Entreno, Comidas, Progreso (con Rutas), Ajustes y el menú oculto se bajan aparte al abrirlos (`React.lazy` + `Suspense`). Mientras bajan se ve «Cargando…».
- Unos segundos después de abrir, la app baja las demás pantallas en segundo plano (no lo hace sin conexión, con «ahorro de datos» ni con red 2G) y `public/sw.js` las guarda, así andan sin conexión. Si una pantalla no se puede bajar aparece «No se pudo abrir…» con **Reintentar** y **Actualizar la app**; tus datos no se tocan.
- Regla para el código: nadie fuera de `src/ui/pantallas.js` importa esas pantallas de forma estática (una prueba lo vigila); una pantalla nueva se agrega ahí y a `ORDEN_PRECARGA`.

## IA con actividad y rutas (v0.30.0)
- El informe semanal, el puntaje de preparación y el coach usan ahora pasos, actividades y rutas. Pasos: promedio diario de los días con dato y variación contra la semana anterior. Actividades: cantidad, minutos y km por tipo. Rutas: solo las que **no** están ya en una actividad.
- Sin doble conteo: una ruta enlazada a una actividad (`rutaId`), o que coincide con una actividad sin enlace (mismo día y tipo, distancia o duración parecidas: ±15 % o 0,3 km), cuenta una sola vez. Las demás cuentan aparte («Rutas con GPS aparte»).
- Preparación: la carga reciente (20 %) suma la actividad como RPE típico por tipo × minutos (caminata 2, bicicleta 5, carrera/natación/deporte 6, otro 4). Los pesos no cambian y, sin actividad, el puntaje es idéntico. Los pasos de ayer se muestran como dato, sin sumar al puntaje.
- Privacidad: a Gemini solo llegan totales (cantidades, minutos, km, desnivel, ritmo medio). Nunca coordenadas, trazos, horas de inicio, parciales ni notas. `data/movimiento.js` lee las rutas ya sin trazo y `domain/movimiento.js` elige campo por campo qué puede salir; una prueba fija además la lista de archivos que pueden importar los módulos de rutas.

## Formato
`.prettierrc` (Prettier 3: sin punto y coma, comillas simples, 100 columnas).
