# Mi Mejor Versión (MMV) · Entrega 45 (v0.46.0)

App personal de seguimiento: entrenos, hábitos, comidas, progreso, cuerpo y actividad física. Todo se guarda en el dispositivo (IndexedDB con Dexie, versión 11). Historial completo de cambios en `CHANGELOG.md`.

## Estructura
```
src/domain/    lógica pura con pruebas: senales (señales y Nota del día de Hoy), recordatorios (cuándo avisar: check-in, acostarte, agua, backup; a dónde lleva cada aviso), navegacion (botón atrás), actividad (pasos, GPS, actividades), gasto (kcal estimadas por actividad, entreno y rutas), metaPasos (meta, promedio y estado del conteo), sueno (alarma, horas de sueño y total del día), rutas (recorrido, trazo, parciales), mapa (teselas OSM), gpx (exportar/importar), alimentos, backup, biblioteca, checkin, cuerpo, entreno, informe, movimiento (pasos, actividades y rutas sin doble conteo), preparacion, privado (cifrado), progreso, registro, stats, temporizador
src/data/      base de datos (Dexie v11), backup, biblioteca, menú privado, semilla de alimentos
src/services/  IA (Gemini), Open Food Facts, escáner de código de barras, imágenes, reloj del entrenamiento, pendientes
src/features/  pantallas: hoy, recordatorios (servicio y bloque de Ajustes), actividad (pasos y actividades), rutas (historial GPS, dentro de Progreso), entreno, comidas, progreso, cuerpo, coach, ajustes, bienestar (menú privado), biblioteca (ejercicios)
src/platform/  adaptadores finos a Capacitor (si la app corre en el APK o en el navegador; notificaciones locales, archivos y compartir, botón atrás); solo esta carpeta importa @capacitor/*
android/       proyecto Android de Capacitor (versionado; lo que genera `cap sync` no): se compila en GitHub, no en tu PC
capacitor.config.ts  identidad de la app Android (appId, nombre, carpeta web, esquema https, barras del sistema)
tests/         pruebas con `node --test` (`tests/platform/`: plataforma nativo/web; `entrega43.test.js`: avisos que abren pantalla, backup semanal, archivos y botón atrás; `entrega42.test.js`: recordatorios, manifiesto y plugin; `entrega41.test.js`: base de Capacitor y workflow del APK; `entrega20.test.js`: actividad física; `entrega26.test.js`: rutas GPS; `entrega27.test.js`: mapa y GPX; `entrega28.test.js`: carga diferida; `entrega29.test.js`: IA con actividad y rutas)
public/        manifest, íconos y service worker (`sw.js`)
```
`src/ui/pantallas.js` es el registro de las pantallas con carga diferida (`React.lazy`); `src/domain/carga.js` tiene su lógica pura (reintento, cuándo precargar). Los componentes de `features/` solo muestran y guardan; las reglas y cálculos viven en `domain/` para poder probarlos.

## Comandos
Requiere Node 20.19 o superior para compilar con Vite (ver `.node-version`). `npm test` y el CLI de Capacitor necesitan Node 22, el que usa el CI.
```
npm ci               # instala exactamente lo del lockfile
npm test             # pruebas (tests/**/*.test.js)
npm run dev          # servidor local (accesible desde el celular en la misma red)
npm run build        # compila a dist/ (agrega version.json con versión y fecha de compilación)
npm run cap:sync     # build + copia la web al proyecto Android (cap sync android)
npm run android:build  # cap:sync + ./gradlew assembleDebug (APK de depuración; lo normal es que lo haga el CI)
```

## Publicación
Desde la carpeta del repositorio: `./publicar.sh ~/Descargas/mmv-vX.Y.Z-CODIGO.zip "texto del cambio" [rama]`. El script reemplaza el código por el del zip y lo sube a GitHub; `.github/workflows/publicar.yml` ejecuta `npm ci`, `npm test` y `npm run build`, y publica en Cloudflare Pages (proyecto `mmv-bribay`, https://mmv-bribay.pages.dev). Si una prueba falla, no se publica. La rama `main` es producción; la rama `prueba` publica en una dirección aparte. El APK de Android lo arma otro flujo (ver «Android»).

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

## Nota del día (v0.46.0)
- **Hoy:** una franja de una línea arriba de la rejilla (propuesta B) dice lo más importante del día y, al tocarla, lista hasta 3 señales. Mira sueño (noche corta o racha), agua (contra lo esperado a esa hora), comida (sin registros, falta de proteína, kcal pasadas o en tu meta), pasos, gasto estimado y carga de entreno (contra tu promedio de 28 días; hace falta historia de 2 semanas). Sin datos no se muestra; con datos y sin nada que decir dice «Sin novedades por ahora».
- **Local y sin IA:** se calcula en el teléfono con tus propios datos. El gasto estimado y la nota **no viajan a la IA** (una prueba lo vigila). Los umbrales son una propuesta de diseño, no una recomendación médica; viven como constantes en `src/domain/senales.js`.
- Código: `src/domain/senales.js` (puro), `src/data/senales.js` (lectura sin trazos ni notas) y `src/features/hoy/NotaDelDia.jsx` (se vuelve a leer con `liveQuery` cuando cambian los datos). Dexie sigue en v11.

## Hoy compacto y gasto calórico (v0.44.0)
- **Hoy:** **rejilla de dos columnas** (Comida, Agua, Sueño y Pasos; Peso a todo el ancho) con **color por métrica** (agua, sueño, pasos, peso; comida en cian). Los estados siguen en verde/ámbar/rojo. La disposición actual es la propuesta C (v0.45.0).
- **Gasto calórico:** estimación de las kcal por encima del reposo de tus entrenos, actividades y rutas con GPS (`(MET − 1) × peso × horas`; los pasos no se suman). Se ve en Hoy (fila de Pasos), en «Actividad física» y en el informe semanal. Necesita tu peso en Cuerpo. No se envía a la IA.
- **Android:** el botón Compartir del informe del Coach usa la hoja nativa; el escáner libera la cámara al salir de la app.
- Código: `src/domain/gasto.js` (puro), `src/data/gasto.js`, `src/platform/archivos.js › compartirTexto`. Dexie sigue en v11.

## Android completo (v0.43.0)
- **Avisos que abren su pantalla:** tocar un aviso lleva al check-in, al agua, a «Dormir con alarma» o a Ajustes › Backup. **Backup semanal** como cuarto recordatorio (día y hora a elección; no avisa el día en que ya lo hiciste).
- **Backup y GPX en el APK:** se escriben en la caché y se comparten con la hoja del teléfono (el WebView no baja archivos `blob:`). **Botón atrás:** vuelve a Hoy y sale solo desde Hoy. Manifiesto: vibración y cámara.
- Código: `src/platform/archivos.js` (`@capacitor/filesystem` y `@capacitor/share`), `src/platform/atras.js` (`@capacitor/app`), `src/domain/navegacion.js` (puro). Dexie sigue en v11.

## Recordatorios (v0.42.0)
- Ajustes › Recordatorios (solo en la app de Android): aviso del **check-in** a la hora que elijas, aviso de **acostarte** 30 min antes de tu hora habitual (necesita 2 días con las dos horas) y aviso de **agua** en una franja cada 2, 3 o 4 h. En el navegador / la PWA el bloque lo dice y no ofrece nada: una web no puede avisar con la app cerrada.
- El permiso de notificaciones (Android 13+) se pide **al activar el primer recordatorio**, no antes. Los avisos son alarmas inexactas (pueden demorar unos minutos) y se recalculan a 7 días cada vez que abrís la app o cambian tus datos: lo que ya hiciste hoy no vuelve a avisar.
- Código: `src/domain/recordatorios.js` (cuándo avisar, puro), `src/platform/notificaciones.js` (el plugin `@capacitor/local-notifications`, lo único que lo importa) y `src/features/recordatorios/` (servicio y pantalla). La configuración va en `localStorage` (`mv_recordatorios`); Dexie sigue en v11.
- `AndroidManifest.xml`: ubicación (GPS de pasos y rutas) y sin `SCHEDULE_EXACT_ALARM`; el plugin trae `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` y `WAKE_LOCK`. Verificación en el celular: ver el informe de la entrega.

## Registro de sueño (v0.40.0)
- Check-in › Sueño: «Igual que siempre» (tu hora habitual de los últimos 7 días), «Me acosté» / «Me desperté» (el total se calcula solo) o solo la duración (chips de 5 a 9 h y campo). Calidad con botones 1–5. Si el total supera lo de la noche, el bloque lo explica como siestas.
- Hoy tiene una tesela de Sueño (anillo contra 8 h de referencia) que abre ese bloque. «Dormir con alarma» anota la hora de acostarte y de levantarte si la sesión fue de noche (≥ 4 h) y deja elegir la calidad.
- Datos: `acosto` y `desperto` («HH:MM») son campos opcionales de la fila de hábitos del día (sin cambio de Dexie). Lógica pura en `src/domain/sueno.js`; el bloque en `src/features/sueno/RegistroSueno.jsx` (la base solo se toca desde `Hoy.jsx`).

## Arreglos de la interfaz (v0.39.0)
- Comidas: «Carbos», la proteína una sola vez (con su meta) y el buscador con «Buscar…». Check-in: «Horas» y «Calidad» sobre los campos de sueño.
- Hoy: anillos con pista visible (`--pista`) e ícono (cubiertos, gota, huellas); resúmenes de las filas plegables cortos; «Preparación» sin datos pide el check-in con un botón que lo abre (`pedidoPreparacion` en `src/domain/checkin.js`).
- El tilde de los chips seleccionados es un ícono por máscara (`--ico-check` en `src/tokens.css`), no un carácter.

## Íconos y avisos (v0.38.0)
- Los emojis y símbolos de texto de la interfaz (✔ ⚠ 🏆 🎥 🌐 ⭐ 🔒 ↶ …) se reemplazaron por el set de íconos propio (`src/ui/Icono.jsx`, trazo de 2 px). Los mensajes de confirmación («Backup compartido.», «Comida guardada.») ya no llevan símbolo: el texto dice el estado.
- La barra de actualización y el aviso de backup ahora flotan sobre la barra inferior (`.avisos`) y no empujan el contenido.
- «Reiniciar» el agua de hoy ya no usa el `confirm()` del navegador: reinicia y ofrece **Deshacer reinicio**.

## Dormir con alarma: total del día (v0.37.0)
- «Dormir con alarma» (Hoy) ya no pisa las horas de sueño del día: al apagar la alarma propone el **total del día** (lo que ya estaba guardado en el check-in + esta sesión) para que lo confirmes o lo corrijas. Una siesta se suma a la noche; con varias siestas el total va creciendo.
- Si no había horas ese día, propone solo las de esta sesión, como antes. «Solo esta sesión» y «Volver al total» alternan la cuenta; el campo es editable (hasta 24 h por día; una sola sesión, hasta 16 h).
- Se lee y se guarda el día en que te despertás (hora de fin), aunque Hoy haya quedado abierta de la noche anterior.
- Lógica pura en `src/domain/sueno.js` (`sumarHoras`, `propuestaDia`, `fechaDeMs`); la base solo se toca desde `Hoy.jsx`. Sin cambios de datos (Dexie v11).

## Modo bolsillo (v0.35.0 y v0.36.0)
- Con el conteo en marcha, «Modo bolsillo» deja la pantalla casi negra y encendida: total del día en un anillo, pasos de la caminata, km, tiempo, ritmo «ahora» y señal de GPS (barras + texto). Una onda fina marca cada paso.
- «Pausar» y «Reanudar» (en la pantalla normal con un toque; en el bolsillo manteniendo 0,6 s) frenan sensor, GPS y reloj. «Salir» se mantiene 1 s. Vibra al pausar, reanudar y salir (Android; se apaga en «Ajustes del conteo»).
- Una web no cuenta con la pantalla bloqueada ni con MMV en segundo plano: el sensor se pausa y el tiempo oculto cuenta como pausa.
- Lógica pura en `src/domain/bolsillo.js`; pantalla en `src/features/actividad/VistaBolsillo.jsx`. Sin cambios de datos (`localStorage`: `mv_pasos_reloj`, `mv_bolsillo_vibrar`).

## Pasos con anillo y dormir con alarma (v0.34.0)
- El contador de pasos muestra un anillo con los pasos de hoy en vivo contra tu meta (o tu promedio de 28 días si no definiste una). Meta: «Ajustes del conteo».
- «Dormir con alarma» (Hoy): pantalla casi negra y encendida, alarma a la hora elegida y horas de sueño propuestas para el check-in. Una web no puede sonar con la pantalla bloqueada: dejá el teléfono cargando y poné una alarma de respaldo.
- Sin cambios de datos: la noche en curso y la meta viven en `localStorage`.

## Lista limpia (v0.32.0)
Hoy, Entreno y Progreso/Informe usan el lenguaje «lista limpia»: sin cajas ni líneas, separados por espacio vertical. Lo activa la clase `plano` en `<main>` y vive en el último bloque de `src/styles.css` (solo tokens). Comidas y Ajustes siguen con tarjetas. Para volver a las tarjetas en una pantalla, quitá su clave de la condición de `<main>` en `App.jsx`.

## Interfaz simplificada (v0.31.0)
Hoy muestra primero la preparación y el botón de entrenar; comida, agua y peso son tres teselas, y el check-in y «Actividad y cuerpo» se pliegan. Las tarjetas de toda la app pasaron de borde a elevación sutil. Radios, espacios y sombras viven en `src/tokens.css`. Detalle en `CHANGELOG.md` y `DESIGN-TOKENS.md`.

## IA con actividad y rutas (v0.30.0)
- El informe semanal, el puntaje de preparación y el coach usan ahora pasos, actividades y rutas. Pasos: promedio diario de los días con dato y variación contra la semana anterior. Actividades: cantidad, minutos y km por tipo. Rutas: solo las que **no** están ya en una actividad.
- Sin doble conteo: una ruta enlazada a una actividad (`rutaId`), o que coincide con una actividad sin enlace (mismo día y tipo, distancia o duración parecidas: ±15 % o 0,3 km), cuenta una sola vez. Las demás cuentan aparte («Rutas con GPS aparte»).
- Preparación: la carga reciente (20 %) suma la actividad como RPE típico por tipo × minutos (caminata 2, bicicleta 5, carrera/natación/deporte 6, otro 4). Los pesos no cambian y, sin actividad, el puntaje es idéntico. Los pasos de ayer se muestran como dato, sin sumar al puntaje.
- Privacidad: a Gemini solo llegan totales (cantidades, minutos, km, desnivel, ritmo medio). Nunca coordenadas, trazos, horas de inicio, parciales ni notas. `data/movimiento.js` lee las rutas ya sin trazo y `domain/movimiento.js` elige campo por campo qué puede salir; una prueba fija además la lista de archivos que pueden importar los módulos de rutas.

## Android (Capacitor, v0.41.0)
- MMV también se empaqueta como app Android con Capacitor 8: el APK lleva la misma web (`dist`) y corre en un WebView con el origen `https://localhost`. La PWA publicada no cambia. No hay funciones nativas nuevas.
- Archivos: `capacitor.config.ts` (appId `online.bribayfitness.mmv`, nombre «Mi Mejor Versión», `webDir: dist`, esquema https, barras del sistema con íconos claros), `android/` (proyecto Gradle versionado; `build/`, los assets copiados y los plugins generados los recrea `cap sync` y están en `android/.gitignore`) y `src/platform/plataforma.js` (`esNativo`, `plataforma`, `esAndroid`, `permiteServiceWorker`; el service worker solo se registra en la PWA, nunca dentro del APK).
- Compilación: la hace GitHub, no tu PC. `.github/workflows/android-debug.yml` corre al subir a la rama `prueba` (o a mano desde Actions): `npm ci`, `npm test`, `npm run cap:sync`, `./gradlew assembleDebug` y sube `mmv-vX.Y.Z-debug.apk` como artefacto. Necesita **JDK 21** (Capacitor 8 compila para Java 21; con JDK 17 falla) y Node 22.
- Firma de depuración fija en `android/app/debug.keystore`: cada APK nuevo se instala encima del anterior sin perder los datos. Es solo de depuración (no sirve para publicar en Google Play). `versionName` y `versionCode` salen de `package.json` (0.41.0 → 4100).
- Reglas: no cambiar `appId` ni `androidScheme` después de instalar el primer APK (cambia la identidad o el origen del WebView y los datos quedan inaccesibles); solo `src/platform/` importa `@capacitor/*`; `src/domain/` sigue sin conocer plugins ni UI. El registro de sueño y el resto de la app son los mismos que en la PWA: el APK no los toca. El paso a paso para instalar el APK está en el informe de la entrega.

## Formato
`.prettierrc` (Prettier 3: sin punto y coma, comillas simples, 100 columnas).
