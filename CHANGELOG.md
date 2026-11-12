# Historial de versiones de MMV

## v0.48.0 · Entrega 47 · Pasos en el gasto calórico (11/11/2026)
- **Pasos sueltos:** el gasto del día suma ahora los pasos como parte aparte, **sin contar dos veces** la misma caminata: se descuentan los pasos que caen dentro de las caminatas y carreras ya registradas (actividades y rutas GPS sin actividad), a 100 pasos/min al caminar y 160 al correr. Los pasos que sobran se convierten en kcal sobre el reposo con MET 2,8 (≈ 3,2 km/h): 10.000 pasos sueltos con 70 kg dan ≈ 210 kcal. Cadencia y MET son una propuesta de diseño (constantes `PASOS_POR_MIN` y `MET_PASOS` en `src/domain/gasto.js`); sigue siendo una estimación (±30 %).
- **Dónde se ve:** el total de Hoy y de «Actividad física» (desglose «pasos sueltos»), el informe semanal (fila «Pasos sueltos» y línea del texto para copiar) y la señal de gasto de la Nota del día. Sin peso no se inventa un número. **No viaja a la IA** (una prueba lo vigila).
- **Datos:** `src/data/gasto.js` lee también los pasos de `habitos` (solo fecha y pasos). Los totales sin pasos dan lo mismo que antes. **Dexie sigue en v11**; `appId`, `androidScheme` y `publicar.yml` sin cambios; sin dependencias nuevas. `versionCode` 4800.
- **Pruebas:** `tests/entrega48.test.js`. Se relajó a propósito `entrega47` (ya no fija la versión vigente).
- **Aparte, el borrado de actividades que reportaste:** no encontré ningún código que borre actividades salvo el botón ×, y en Chromium real una actividad registrada sobrevivió a la recarga; dijiste que ya se solucionó. Sin cambios por eso.
- **No probado:** en el celular, y que la cadencia de 100 pasos/min se parezca a la tuya.

## v0.47.0 · Entrega 46 · Escáner de códigos de barras que funciona en el APK (11/11/2026)
- **El problema:** el escáner dependía de `BarcodeDetector`, que el WebView de Android declara pero que necesita Google Play Services y un WebView actualizado; sin eso el APK decía «tipeá el número».
- **Lector de reemplazo:** si falta `BarcodeDetector` y hay cámara, se usa ZXing en WebAssembly (paquete `barcode-detector` 3.2.3 con `zxing-wasm` 3.1.6), con el mismo contrato y los mismos formatos (EAN-13, EAN-8, UPC-A). `src/services/escanerWasm.js` se baja recién al abrir el escáner (import dinámico) y usa el *ponyfill* (no toca `window`). El `.wasm` (≈ 0,9 MB) sale del propio paquete, sin CDN, y el service worker lo guarda al usarlo: anda sin conexión desde la segunda vez. Si el nativo existe, manda el nativo. También ayuda en Firefox y Safari.
- **Sin cambios** en el gasto, Compartir del Coach, la Nota del día ni Hoy. **Dexie sigue en v11**; `appId` y `androidScheme` sin cambios; `publicar.yml` intacto. Única dependencia nueva: `barcode-detector` (+ `zxing-wasm`); ninguna versión existente cambió.
- **Pruebas:** `tests/entrega47.test.js`. Se relajaron a propósito `entrega27`, `entrega44` (el mensaje ya no menciona Play Services) y `entrega46` (versión y lista de dependencias).
- **No probado:** la cámara real del WebView de tu teléfono y la compilación del APK (solo corre en GitHub).

## v0.46.0 · Entrega 45 · Motor de señales local y Nota del día en Hoy (10/11/2026)
- **Nota del día (propuesta B):** una franja de una línea arriba de la rejilla de Hoy, entre el botón de entrenar y los mosaicos, con la señal más importante del día; al tocarla se abre y lista hasta 3 señales y un aviso («lectura de tus propios datos, no es un consejo médico»). Sin datos no aparece; con datos y sin nada que decir muestra «Sin novedades por ahora».
- **Señales (`src/domain/senales.js`, puro):** **sueño** (noche corta < 6 h, racha de 2 noches cortas entre las últimas 3, «dormiste bien» desde 7 h o tu promedio), **agua** (contra lo esperado a esa hora, lineal de 8 a 20 h, desde las 12; meta cumplida), **comida** (sin registros desde las 15 h, falta de proteína desde las 17 h con menos del 60 % de tu meta, kcal por encima de 115 %, en tu banda de 85–115 % desde las 18 h), **pasos** (contra tu meta o tu promedio; pocos desde las 18 h; meta cumplida), **gasto estimado** (kcal por encima del reposo, o pedir el peso si falta) y **carga de entreno** (razón aguda/crónica de `preparacion.js`: ≥ 1,5 alta, ≥ 1,3 subió, ≤ 0,6 liviana). Se ordenan por prioridad; la franja muestra la primera. Los umbrales son una propuesta de diseño (constantes exportadas), no una recomendación médica.
- **Tono:** amable y sin culpa; texto neutro, sin los colores de métrica ni de estado. El cian está solo en el chevron (acción).
- **Datos y privacidad:** `src/data/senales.js` lee 28 días de hábitos, entrenos y actividades, las comidas de hoy y el peso, sin trazos de ruta, notas, nombres de ejercicios ni de comidas. **Todo local: no hay IA ni red, y el gasto estimado no viaja a la IA** (una prueba lo vigila). Se vuelve a leer con `liveQuery` cuando cambia la base; la hora se refresca cada 5 minutos.
- **Encaje:** el motor no importa nada fuera de `src/domain/`; la franja (`src/features/hoy/NotaDelDia.jsx`) lee solo por `src/data/`. Sin `src/platform/`, sin dependencias nuevas. **Dexie sigue en v11**; `appId` y `androidScheme` sin cambios; `publicar.yml` intacto. En pantalla ancha la franja ocupa una fila propia debajo de la preparación y la rejilla.
- **Pruebas:** `tests/entrega46.test.js`. Se relajó a propósito `entrega45` (ya no fija la versión vigente).
- **No probado:** cómo se ve en pantalla (ver el informe de la entrega) ni en un celular real; los umbrales no se calibraron con tus datos.

## v0.45.0 · Entrega 44 · Hoy en rejilla de dos columnas (propuesta C) (10/11/2026)
- **Hoy en rejilla de dos columnas (propuesta C):** reemplaza la lista de la Entrega 43 (propuesta A, que se había aplicado sin que la eligieras). **Comida, Agua, Sueño y Pasos** son mosaicos de dos en dos (anillo de 40 px, rótulo, valor de 22 px y su texto de ayuda); **Peso**, que no tiene meta, ocupa todo el ancho en una fila (círculo con ícono, texto y valor a la derecha). El **color por métrica** se mantiene tal cual (`--m-comida`, `--m-agua`, `--m-sueno`, `--m-pasos`, `--m-peso`): arco e ícono, nunca el valor ni el texto; verde/ámbar/rojo siguen siendo estados. Los mosaicos usan `--sf`, `--sombra-1` y `--r-tile` (los de siempre) y al pasar el cursor `--sf-2`. Sin tokens nuevos.
- **Sin cambios de lógica:** el gasto calórico, Compartir del Coach y el escáner de la v0.44.0 quedan igual. Dexie sigue en **v11**; `appId` y `androidScheme` sin cambios; sin dependencias nuevas; `publicar.yml` intacto.
- **Pruebas:** `tests/entrega45.test.js`. Se relajó a propósito `entrega44` (ya no fija la versión vigente).
- **No probado:** cómo se ve en pantalla (no hubo navegador en este entorno) ni en un celular real; ver el informe de la entrega.

## v0.44.0 · Entrega 43 · Hoy compacto con color por métrica, gasto calórico por actividades y Android (10/11/2026)
- **Hoy compacto con color por métrica (propuesta A, lista):** el arco del anillo y el ícono de cada fila llevan el color de su métrica: agua `#5aa9ff`, sueño `#b8a4ff`, pasos `#ff9f7a`, peso `#f0abfc`; comida sigue en cian. Tokens nuevos `--m-comida`, `--m-agua`, `--m-sueno`, `--m-pasos` y `--m-peso` en `src/tokens.css` (documentados en `DESIGN-TOKENS.md`). Verde, ámbar y rojo siguen siendo estados: al llegar a la meta el anillo pasa a verde. La lista es más compacta (anillo de 40 px, filas más juntas, valor de 24 px).
- **Gasto calórico por actividades (nuevo):** `src/domain/gasto.js` (puro) estima las kcal **por encima del reposo** como `(MET − 1) × peso × horas`. Entran los **entrenos** (MET según el RPE de la sesión), las **actividades** (caminata, carrera y bicicleta según la velocidad si hay distancia; natación, deporte y otro con un MET típico) y las **rutas con GPS que no están en ninguna actividad** (la misma regla de «sin doble conteo»). Los **pasos no se suman** para no contar dos veces la misma caminata. El peso sale de la medida más cercana en el tiempo; **sin peso no se inventa un número** y la app pide cargarlo. Dónde se ve: en la fila de **Pasos** de Hoy («Actividad ≈ N kcal»), en «Actividad física» (cada actividad y el gasto del día con su desglose) y en el **informe semanal** (sección «Gasto estimado» y una línea en el texto para copiar). Es una estimación (±30 %); la tabla de entreno por RPE es una propuesta de diseño. **No viaja a la IA** (una prueba lo vigila). `src/data/gasto.js` lee los datos sin trazos ni notas.
- **Android · Compartir del informe del Coach:** el WebView no tiene `navigator.share`, y por eso el botón no aparecía. En el APK ahora se muestra y abre la hoja de compartir nativa con el texto del informe (`archivos.compartirTexto` en `src/platform/archivos.js`, `@capacitor/share`, sin archivo). En la PWA sigue igual.
- **Android · escáner de códigos de barras:** revisado. Se mantiene `BarcodeDetector` (el WebView de Android lo declara soportado, pero depende de Google Play Services). Cambios: el mensaje cuando falta dice qué hace falta y manda al buscador; y **al salir de la app la cámara se libera y se avisa** (antes el video quedaba congelado al volver). `mensajePausa` en `src/services/escaner.js`.
- **Informe:** `informeSemana` recibe `medidas` y devuelve `gasto`; `cuerpoCoach` lo descarta explícitamente.
- **Reglas:** Dexie sigue en **v11**; `appId` y `androidScheme` sin cambios; sin dependencias nuevas; `publicar.yml` intacto.
- **Pruebas:** `tests/entrega44.test.js` (+22). Se relajaron a propósito `entrega32` (el anillo ahora lleva `tam={40}`) y `entrega43` (ya no fija la versión actual).
- **No probado (pide un celular real):** la hoja de compartir con el texto del informe, el escáner dentro del APK (depende de Google Play Services), cómo se ven los colores y la lista compacta en pantalla chica, y la compilación del APK (solo corre en GitHub).

## v0.43.0 · Entrega 42 · Check-in más claro, Android completo y avisos que abren su pantalla (10/11/2026)
- **Check-in (Hoy):** cada fila (Energía, Ánimo, Dolor muscular) dice sus extremos bajo los botones («baja · alta», «bajo · alto», «nada · mucho»); desaparece la línea larga única. La descripción completa del 1 y del 5 sigue disponible para el lector de pantalla. La fila **Peso** de Hoy muestra un círculo con ícono de balanza del tamaño y grosor de los anillos, así que queda alineada con las demás.
- **Comidas en estilo plano:** la pestaña Comidas usa el mismo lenguaje plano que Hoy, Entreno y Progreso. Solo Ajustes sigue con tarjetas.
- **Tocar un aviso abre su pantalla (Android):** check-in → Hoy con el check-in abierto; agua → Hoy con Hidratación abierta; acostarte → Hoy con «Dormir con alarma» abierto; backup → Ajustes con «Backup» a la vista. Tipo desconocido: no hace nada. `destinoDeAviso` es lógica pura (`src/domain/recordatorios.js`); el plugin se escucha en `src/platform/notificaciones.js › alTocarAviso`.
- **Recordatorio de backup semanal:** cuarto aviso de Ajustes › Recordatorios (día de la semana y hora; domingo 20:00 de entrada). El día en que ya hiciste un backup no se avisa (`data/backup.js` anuncia el backup con el evento `mmv:backup` y el servicio reprograma). Como es semanal, su plan mira **8 días** (el resto sigue en 7): si hoy es el día elegido y la hora ya pasó, el de dentro de 7 días exactos queda programado.
- **Android · backup y GPX:** el WebView no baja archivos `blob:` ni tiene la hoja de compartir web. En el APK el archivo se escribe en la caché de la app (`@capacitor/filesystem`) y se manda a la hoja de compartir del teléfono (`@capacitor/share`; Drive, Archivos, WhatsApp…). Un solo botón («Guardar o compartir backup»). Si la persona cierra la hoja → «Cancelado.» y no se marca el backup; si falla → aviso y no se marca. En la PWA todo sigue igual. `src/platform/archivos.js`.
- **Android · botón atrás:** vuelve a la pestaña anterior (desde Ajustes) o a Hoy (desde Entreno, Comidas, Progreso) y sale de la app solo desde Hoy. Con «Dormir con alarma» o el modo bolsillo abiertos no hace nada, para no cortar la noche ni el conteo. Lógica pura en `src/domain/navegacion.js`; plugin `@capacitor/app` en `src/platform/atras.js`.
- **`AndroidManifest.xml`:** suma `VIBRATE` y `CAMERA` (se pide al usarla; escáner de códigos de barras y foto de la pizarra) y `uses-feature camera` con `required="false"`. Sigue sin `SCHEDULE_EXACT_ALARM`, micrófono ni ubicación en segundo plano.
- **Arreglo menor:** el mensaje de Recordatorios decía «1 avisos programados»; ahora «1 aviso programado».
- **Dependencias:** `package-lock.json` suma `@capacitor/app 8.1.2`, `@capacitor/filesystem 8.1.5`, `@capacitor/share 8.0.3` y `@capacitor/synapse 1.0.4` (lo trae filesystem); ninguna versión existente cambió. Los regenera `cap sync` en `android/capacitor.settings.gradle` y `android/app/capacitor.build.gradle`. **Dexie sigue en v11**; `appId` y `androidScheme` sin cambios.
- **Pruebas:** `tests/entrega43.test.js`. Se relajaron a propósito `entrega27` (dependencias), `entrega31` (Comidas en estilo plano) y `entrega42` (la cámara ya se permite).
- **No hecho a propósito:** «Hoy más compacto» y el color por métrica (`--m-agua`, `--m-pasos`, `--m-sueno`) esperan que se elija una propuesta visual.
- **No probado (pide un celular real):** la hoja de compartir nativa con backup y GPX, el botón atrás, el toque en el aviso con la app cerrada (el plugin retiene el evento, pero el arranque en frío no se pudo confirmar), la cámara del escáner dentro del APK, y la compilación del APK (solo corre en GitHub).

## v0.42.0 · Entrega 41 · Recordatorios con notificaciones locales (09/11/2026)
- **Qué hay de nuevo (solo en la app de Android):** Ajustes › **Recordatorios** con tres avisos del teléfono, cada uno con su interruptor: **Check-in del día** (a la hora que elijas, 21:00 de entrada), **Hora de acostarte** (30 min antes de tu hora habitual, la misma que usa «Igual que siempre»; se activa con al menos 2 días con las dos horas) y **Agua** (franja «desde / hasta» y «cada 2, 3 o 4 h»; 09:00 a 21:00 cada 3 h de entrada).
- **No insisten con lo que ya hiciste:** una notificación programada no puede mirar tus datos cuando suena, así que el plan es una **ventana de 7 días que se recalcula** al abrir la app, al volver a ella (por si cambió el día), al cambiar un ajuste y cada vez que cambian tus hábitos (check-in, agua o sueño, vigilado con `liveQuery` de Dexie, con 0,8 s de espera). Si hoy ya hiciste el check-in o llegaste a la meta de agua, el aviso de hoy sale del plan. Las reprogramaciones van de a una (cola): nunca quedan avisos duplicados.
- **Permiso (Android 13+, `POST_NOTIFICATIONS`):** se pide **solo al activar** el primer recordatorio. Sin permiso no queda nada activado y la pantalla explica cómo habilitarlo en los ajustes del teléfono. `programar` nunca agenda sin permiso concedido: desde la 8.3.0 el plugin pide el permiso por su cuenta dentro de `schedule()`, y reprogramar al abrir la app habría mostrado el diálogo sin que nadie lo pidiera.
- **En la PWA / navegador:** el bloque dice «Los recordatorios … funcionan en la app de Android» y no ofrece interruptores: sin servidor de notificaciones una web no puede avisar con la app cerrada. No se pide ningún permiso web ni se carga el plugin.
- **Alarmas inexactas a propósito** (`isExactNotification: false`, `allowWhileIdle: true`): para recordar un vaso de agua alcanza, y evita el permiso `SCHEDULE_EXACT_ALARM`, que se **quita** del manifiesto (`tools:node="remove"`) para que Android no lleve a la persona a «Alarmas y recordatorios». Un aviso puede llegar con unos minutos de demora.
- **`AndroidManifest.xml`:** se suman `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` (el GPS de «Pasos y rutas» decía «GPS sin permiso» en el APK) y `xmlns:tools`. El resto lo aporta el plugin al fusionar manifiestos: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` (reprograma al reiniciar el teléfono) y `WAKE_LOCK`. Ícono de la barra de estado: silueta de un solo color (`res/drawable/ic_stat_mmv.xml`), con el celeste de la app como acento (`capacitor.config.ts › LocalNotifications`). Canal único «Recordatorios» (importancia 3).
- **Encaje en la arquitectura:** `@capacitor/local-notifications` (`^8.3.1`) solo lo importa `src/platform/notificaciones.js` (se baja recién al hacer falta). La lógica de cuándo avisar es pura y con pruebas en `src/domain/recordatorios.js`. El servicio y la pantalla viven en `src/features/recordatorios/` (ahí se toca la base). La configuración se guarda con `cfg()` en `localStorage` (`mv_recordatorios`): **Dexie sigue en v11**.
- **Dependencias:** `package-lock.json` suma solo `@capacitor/local-notifications 8.3.1` (ninguna versión existente cambió). Se regeneraron `android/capacitor.settings.gradle` y `android/app/capacitor.build.gradle` con `cap sync`.
- **Pruebas:** `tests/entrega42.test.js`. Se relajó a propósito `tests/entrega27.test.js` (la lista exacta de dependencias suma el plugin).
- **Límites que se mantienen:** el backup no incluye la configuración de recordatorios (como el resto de `cfg`), y los datos del APK son aparte de los de la PWA. «Dormir con alarma» sigue sin sonar con la pantalla bloqueada: una notificación no es una alarma.
- **No probado (pide un celular real):** el diálogo de permiso de Android 13+, que el aviso llegue a la hora con la app cerrada y con la pantalla bloqueada, que se reprograme tras reiniciar el teléfono, el modo de ahorro de batería de cada marca, que al tocar el aviso se abra la app, cómo se ve el ícono, el GPS con el permiso nuevo y la actualización encima del APK 0.41.0. La compilación del APK solo corre en GitHub.

## v0.41.0 · Entrega 40 · Base de Capacitor para Android reaplicada sobre el registro de sueño (08/11/2026)
- **Qué es esta entrega:** la base de Capacitor (que se había armado sobre la v0.37.0, sin sueño) vuelta a aplicar **encima del código de la v0.40.0** (registro de sueño, Entrega 39). No se partió del zip de Capacitor: se partió del código con sueño y se le sumó solo lo de Android. La numeración de la rama de Capacitor («v0.38.0 · Entrega 37») chocaba con las entregas 37 a 39 ya publicadas; por eso esta es la **v0.41.0 · Entrega 40**.
- **Base de Capacitor 8.6.0:** `@capacitor/core` y `@capacitor/android` (dependencias) y `@capacitor/cli` (desarrollo). `capacitor.config.ts` con `appId` `online.bribayfitness.mmv`, nombre «Mi Mejor Versión», `webDir: dist`, `androidScheme: https`, fondo `#0A0F14` (el de `--bg`) y barras del sistema con íconos claros (`SystemBars`, `insetsHandling: native`). `typescript` (desarrollo) hace falta para que el CLI lea `capacitor.config.ts`. Scripts nuevos: `cap:sync` y `android:build`; `npm test` ahora corre `tests/**/*.test.js`.
- **Proyecto Android (`android/`, generado con `npx cap add android`):** Gradle 8.14.3, AGP 8.13.0, compileSdk y targetSdk 36, minSdk 24 y **Java 21**. Firma de depuración fija (`android/app/debug.keystore`): sin ella cada compilación del CI firmaría con una clave nueva y Android no dejaría instalar la versión siguiente encima de la anterior (habría que desinstalar y se perderían los datos). `versionName` y `versionCode` salen de `package.json` (0.41.0 → 4100; sube siempre, así que se instala encima de un APK 0.38.0 que tenga código 3800).
- **APK en GitHub Actions:** `.github/workflows/android-debug.yml` (ubuntu-latest, **JDK 21**, Node 22; `npm ci` → `npm test` → `npm run cap:sync` → `./gradlew assembleDebug` → artefacto `mmv-vX.Y.Z-debug.apk`). Corre al subir a `prueba` o a mano. `publicar.yml` (Cloudflare Pages) no cambia.
- **Plataforma:** `src/platform/plataforma.js` (`esNativo`, `plataforma`, `esAndroid`, `permiteServiceWorker`; `crearPlataforma(cap)` permite probarlo sin contenedor). El service worker de `main.jsx` ya no se registra dentro del APK; en la PWA se registra igual que antes.
- **Ya estaba, no se tocó:** `base: './'` en `vite.config.js` y `viewport-fit=cover` + `env(safe-area-inset-*)` en `index.html` y `styles.css`. Una prueba los protege.
- **Sin cambios** en el registro de sueño (`RegistroSueno.jsx`, `domain/sueno.js`, tesela de Hoy, «Dormir con alarma»), en Dexie (sigue en v11), backup, carga diferida, `sw.js` ni la PWA publicada. El paquete principal crece 8,2 kB (2,9 kB comprimido) por `@capacitor/core`: de 461,18 a 469,35 kB (148,84 a 151,79 kB comprimido, según Vite).
- **Pruebas:** `tests/platform/plataforma.test.js` y `tests/entrega41.test.js` (las de Capacitor, con un nombre que no choca con el `entrega38.test.js` de íconos de la v0.38.0; más una que vigila que el registro de sueño y Dexie v11 sigan íntegros). Se relajó a propósito `tests/entrega27.test.js` (la lista exacta de dependencias suma los dos paquetes de Capacitor). Las aserciones de README de las pruebas del código con sueño ya eran genéricas: no hizo falta tocarlas.
- **Verificado:** `npm ci`, `npm test` (565 pruebas con Node 22: 536 del código con sueño + 17 de Capacitor + 1 que vigila el sueño + 11 de plataforma), `npm run build` y `npm run cap:sync` (después no queda nada sin versionar); la app compilada en Chromium: en modo web el service worker se registra y con un contenedor Android simulado (`androidBridge`, lo que `@capacitor/core` usa para detectar «android») no se registra; en los dos modos el registro de sueño (23:30 → 07:15 = 7 h 45 min, calidad 4) se guarda en Dexie v11 y sigue ahí al recargar; `debug.keystore` abre con `keytool` (JDK 21) y es el mismo archivo de la base de Capacitor; `versionCode` 4100 calculado desde `package.json`.
- **No probado:** la compilación del APK (solo corre en GitHub: desde el entorno de desarrollo no se llega a Google Maven) y todo lo que pasa en un celular real (instalar, abrir, Dexie al cerrar y reabrir, botón atrás, barras del sistema, el registro de sueño dentro del APK).
- **A tener en cuenta (no se cambió):** el botón atrás cierra la app (la PWA hace lo mismo: MMV no usa el historial); exportar backup o GPX puede no funcionar en el APK (el WebView no baja archivos por `blob:`); el manifiesto solo declara INTERNET (vibración, ubicación y cámara pueden fallar); «Buscar actualización» no ve APK nuevos; los datos del APK son aparte de los de la PWA (otro origen): se pasan con el backup.

## v0.40.0 · Entrega 39 · Registro de sueño: horas de acostarse y levantarse, «Igual que siempre» y tesela en Hoy (08/11/2026)
- **Nuevo bloque «Sueño» en el check-in** (`src/features/sueno/RegistroSueno.jsx`; reemplaza la fila de número + deslizador). Tres maneras de registrar, de menos a más esfuerzo:
  1. **«Igual que siempre · 23:30 → 07:15»:** un toque con tu hora habitual (mediana de los 7 días anteriores, redondeada a 5 min; aparece con al menos 2 días que tengan las dos horas; acostarse a pasada la medianoche se calcula bien).
  2. **«Me acosté» y «Me desperté»:** selectores de hora del teléfono; el total se calcula solo, también si cruza la medianoche, y se muestra arriba como «7 h 45 min».
  3. **Solo la duración:** campo «Total de horas» (pasos de 0,25) y chips de **5, 6, 7, 8, 9 h**. Un chip borra las dos horas (ya no describen ese total); tocarlo de nuevo lo quita.
- **Calidad con botones 1 a 5** (los mismos que Energía, Ánimo y Dolor) con «1 · mala / 5 · excelente» bajo los botones, en lugar del deslizador. Tocar el botón elegido lo quita.
- **Calidad sin valor inventado:** antes una fila nueva nacía con calidad 3 sin que la eligieras; ahora queda vacía hasta que la elijas. Las filas viejas no se tocan. Consecuencia: sin calidad, el componente de sueño de la preparación usa solo las horas (antes mezclaba un 3 implícito).
- **Siestas desglosadas, sin esquema nuevo:** si el total del día es mayor que lo que dan las dos horas, el bloque dice «Incluye ≈ 1 h de siestas u otras sesiones». Al corregir la hora de acostarte o levantarte, las siestas ya sumadas se conservan.
- **Tesela de Sueño en Hoy** (entre Agua y Pasos): anillo contra una referencia de 8 h (`OBJETIVO_SUENO_H`, orientativa, no médica) con ícono de luna, «7 h 45» y «de 8 h · calidad 4/5». Sin registro dice «tocá para registrar». Al tocarla abre el check-in y lleva al bloque de sueño (el mismo mecanismo que el botón de «Preparación»).
- **«Dormir con alarma» alimenta el bloque:** al guardar anota la hora de acostarte y de levantarte (`acosto`, `desperto`) **solo si la sesión fue de noche (≥ 4 h)**, y solo si ese día no tenía ya las suyas (una siesta no pisa la hora de acostarte). El resumen suma **«Calidad (opcional)»** con los mismos botones.
- **Datos:** `acosto` y `desperto` («HH:MM») son campos opcionales de la fila de hábitos del día; Dexie sigue en v11 y el backup los lleva sin cambios.
- **Lógica pura con pruebas** en `src/domain/sueno.js`: `horasEntre`, `duracionHM`, `duracionCorta`, `extraSiestas`, `reaplicarNoche`, `habitualNoche`, `nocheDeSesion`, `horaDeMs`, `fraccionSueno`, `OBJETIVO_SUENO_H`, `NOCHE_MIN_H`, `DURACIONES_RAPIDAS`.
- **Pruebas:** `tests/entrega40.test.js`. Se relajaron a propósito tres aserciones de `tests/entrega33.test.js` y `tests/entrega37.test.js` (la firma `onGuardar(total, fecha, {noche, calidad})` y `guardarSueno(horas, f, extra)`, y el lugar del campo de horas, ahora `RegistroSueno.jsx`). Se quitaron los estilos `.ck-sueno`.
- **Límites que se mantienen:** el total sumado con la alarma se redondea a décimas de hora (6 min), como siempre; las horas son tiempo en cama, no sueño medido.
- **No incluido (queda para otra entrega):** siestas como tipo de dato propio, regularidad y promedio semanal en Progreso, importar de un reloj o de Salud (una web no puede leerlos: solo por archivo exportado), corregir días anteriores, meta de sueño propia en Ajustes, contexto por hora del día en «Dormir con alarma».
- **No probado:** celular real (selector de hora nativo en iOS y Android, formato 12/24 h, lectura del bloque a 360 px en pantallas chicas). Revisado solo en Chromium a 360 px.

## v0.39.0 · Entrega 38 · Arreglos de las capturas del celular (08/11/2026)
- **Comidas · «Carbohidratos» ya no se parte:** la columna se llama «Carbos».
- **Comidas · la proteína aparece una sola vez:** con meta (hay peso cargado), «Proteína 42 / 120 g» con su barra y el «Faltan N g…» van arriba, y debajo quedan **Carbos** y **Grasas** en dos columnas. Sin peso (sin meta) sigue el trío Proteína · Carbos · Grasas y el aviso para registrar el peso.
- **Comidas · buscador:** el placeholder es «Buscar…» (el nombre accesible sigue siendo «Buscar alimento»), así no se corta junto a los botones de código de barras y cámara.
- **Chips seleccionados y «Tenés la última versión publicada»:** el ✓ de texto del CSS pasó a un ícono de tilde (el mismo trazo de `Icono` «check») pintado con máscara y `currentColor`. Ya no queda ningún carácter ✓ en JSX ni en CSS. Token nuevo `--ico-check` (un ícono, no un color).
- **Check-in · Sueño:** los dos campos llevan rótulo propio, **Horas** y **Calidad**, sobre el campo (antes el deslizador «3/5» no decía qué era). El campo de horas muestra «—» vacío en lugar de «horas».
- **Hoy · resúmenes de las filas plegables:** «Pasos y rutas» (antes «Pasos, rutas, medidas») y «Alarma y horas» (antes «Calcula tus horas»). Además, si un resumen no entra en una línea, baja a otra en vez de cortarse con «…».
- **Hoy · anillos en 0:** pista vacía visible (token nuevo `--pista`, 3,1:1 sobre `--bg`; antes `--sf-2`, 1,2:1) y un ícono en el centro: cubiertos (Comida), gota (Agua) y huellas (Pasos). El ícono se pone verde al llegar a la meta. Dormir y bolsillo conservan su pista tenue. 3 trazos nuevos en `Icono.jsx`: `cubiertos`, `gota`, `pasos`.
- **Hoy · Preparación sin datos:** ya no es una línea con «i». Dice **«Hacé el check-in para ver tu preparación»** y tiene el botón **Hacer el check-in**, que abre el check-in, lo trae a la vista y enfoca su primer botón (sin animación con «reducir movimiento»). Si el check-in ya está hecho pero faltan las horas de sueño, pide el sueño («Cargar el sueño»). La lógica del texto es pura: `pedidoPreparacion` en `src/domain/checkin.js`. Se quitó el `Plegable` de ese estado y una rama que nunca se ejecutaba en `Preparacion.jsx`.
- **Sin cambios** en Dexie (v11), backup, service worker, carga diferida ni en el cálculo de la preparación.
- **Pruebas:** `tests/entrega39.test.js`.
- **No probado:** celular real (solo capturas en Chromium a 360 px de ancho: lectura de los íconos a 20 px, foco y desplazamiento del botón de la preparación en iOS/Android).
- **Queda** (de la revisión de diseño): Hoy más compacto, tesela de Sueño y color por métrica (entrega 39 del informe de continuidad); fila Peso alineada con los anillos; línea larga de escalas del check-in con «baja/alta» a los extremos; Comidas en estilo plano.

## v0.38.0 · Entrega 37 · Íconos coherentes, avisos flotantes y reinicio de agua sin confirm (08/11/2026)
- **Íconos en lugar de emojis:** ✔ ✓ ✅ ⚠ ✕ ✎ ↑ ↓ ↶ ⬆ ＋ ↔ ⏸ ▶ 🏆 🎥 🌐 ⭐ ⚡ 🏁 🔎 🔒 🍽 🏷 se reemplazaron por `Icono` (check, alerta, cerrar, lapiz, flecha-arriba/abajo, deshacer, mas, izq-der, pausa, play, trofeo, video, web, estrella, rayo, bandera, lupa, candado, plato, etiqueta, chevron-izq/der, detener, reloj). También ◀ ▶ del navegador de fecha, ■ y ▶ del conteo de pasos y ▶ y ⏱ de los bloques del entreno; los textos que decían «tocá ▶» ahora nombran el botón. 17 trazos nuevos en `src/ui/Icono.jsx`, todos de 2 px sobre 24×24. Los que dicen algo importante llevan `etiqueta` accesible («copiado de la web», «con video», «récord»).
- **Mensajes de confirmación sin símbolo:** «✔ Backup compartido.» → «Backup compartido.» (idem GPX, informe, comida, plantilla, sesión). El texto ya dice el estado.
- **Botón de pausa del reloj (barra superior):** ahora es un ícono con `aria-label` («Pausar», «Reanudar», «Terminado»); antes era solo un símbolo.
- **Avisos flotantes:** la barra «Hay una versión nueva» y el aviso de backup van en `.avisos` (posición fija sobre la barra inferior, solo tokens) y ya no empujan el contenido hacia abajo.
- **Agua de hoy:** «Reiniciar» no pregunta con `confirm()`: pone en 0 y muestra «Deshacer reinicio» hasta que sumes agua.
- **Se mantienen** las flechas de texto «→» en frases de navegación («Ajustes → Perfil y objetivo») y «≈» (estimado).
- **Sin cambios** en Dexie (v11), backup, service worker ni carga diferida. Sin tokens nuevos.
- **Pruebas:** `tests/entrega38.test.js`; se relajó a propósito la aserción de README de `tests/entrega37.test.js`.
- **No probado:** celular real (posición de los avisos con la barra inferior y el modo bolsillo, lectura de los íconos nuevos a tamaño 16).
- **Queda para próximas entregas** (de la revisión de diseño): tesela de Sueño y color por métrica en Hoy, Comidas en estilo plano, panel inferior del agua, barra inferior con píldora.

## v0.37.0 · Entrega 36 · «Dormir con alarma» suma el sueño del día (06/11/2026)
- **Total del día, a confirmar:** al apagar la alarma, «Tu noche» ya no propone solo las horas de esa sesión: propone el **total del día** = horas que ya había guardadas ese día en el check-in + esta sesión. Ejemplo: noche de 7 h, siesta de 1 h 30 min → propone **8,5 h**. La línea «Ya tenías 7 h hoy + esta sesión 1,5 h = 8,5 h en el día» muestra la cuenta; el campo (ahora «Total de sueño de hoy») se puede corregir antes de «Guardar en mi check-in». Sin horas previas se ve igual que antes.
- **Dos atajos:** «Solo esta sesión (1,5 h)» pone en el campo solo lo de esta sesión (por si lo anterior estaba mal o era de otro día) y «Volver al total» restituye la suma.
- **Correcto aunque Hoy haya quedado abierta de noche:** se suma y se guarda en el día de la hora de despertar, no en el día en que se abrió la pantalla (antes, con Hoy abierta desde la noche anterior, las horas iban a la fila de ayer; ahora, además, sumarlas allí habría dado un total absurdo).
- **Límites:** el total del día admite hasta 24 h; una sola sesión sigue en 0,3 a 16 h (más se pide cargarlo a mano, como antes). Si el campo queda vacío o fuera de rango, avisa y no guarda.
- **Nuevo en `src/domain/sueno.js` (lógica pura con pruebas):** `horasPrevias`, `sumarHoras`, `fechaDeMs`, `propuestaDia`, `HORAS_MAX_DIA`; `parseHoras` acepta un tope opcional. `ModoSueno` recibe `previoDe(fecha)` y `onGuardar(total, fecha)`; `Hoy.jsx` define `leerSueno` y `guardarSueno` (transacción sobre la fila del día, sin pisar pasos ni agua). Etiqueta accesible del campo de Sueño en el check-in: «Horas de sueño de hoy (total del día)».
- **Sin cambios** en Dexie (v11), backup, service worker ni carga diferida. Un solo estilo nuevo (`.sueno-suma`, solo tokens).
- **Pruebas:** `tests/entrega37.test.js`. Se relajaron a propósito dos de `tests/entrega33.test.js` (la forma de `onGuardar` y del montaje de `ModoSueno` en Hoy).
- **A tener en cuenta:** la preparación usa ese total como «sueño de hoy»; una siesta que lleve el total a más de 9,5 h resta 10 puntos al componente de horas (regla previa, no se tocó).
- **No probado:** celular real (flujo completo noche + siesta, Hoy abierta de un día para el otro).

## v0.36.0 · Entrega 35 · Modo bolsillo con datos, señal de GPS, pausa y animación (06/11/2026)
- **Pantalla del bolsillo rediseñada (B1):** anillo grande con el **total del día** (contra tu meta o tu promedio), debajo **«Esta caminata +N pasos»** y una fila con **km · tiempo · ritmo**. Arriba, dos chips: el estado (ícono + texto) y la **señal de GPS**. Abajo, **Pausar** y **Salir**. Sigue casi negra, sin cian ni lima.
- **Ritmo «ahora» (B2):** promedio del último minuto en min/km. Muestra «—» hasta tener 30 s y 30 m válidos, si estás casi parado (más lento que 30 min/km) o si no hay GPS: no se inventa una cifra.
- **Señal de GPS (B3):** barras + texto + precisión en metros: *sin permiso*, *buscando señal*, *débil (±38 m)*, *buena (±8 m)* y *sin señal* (no llega un punto hace más de 15 s). **Corrige un defecto:** antes la señal decía «buena» para siempre aunque el GPS dejara de entregar puntos. También se ve en la pantalla normal.
- **Pausa manual (B4):** «Pausar» / «Reanudar» en la pantalla normal (un toque) y en el bolsillo (**mantener 0,6 s**; con teclado, Enter o espacio directo). En pausa el sensor no suma, el GPS no suma distancia ni ruta y el reloj se detiene; la pantalla sigue encendida. Al reanudar el GPS se **vuelve a anclar**: no suma lo caminado durante la pausa y la ruta abre un tramo nuevo. La pausa se ve inconfundible (ámbar, ícono, «Pausa · 0:42 · no se cuenta nada») y sobrevive si se recarga la app.
- **Animación (B5):** una onda fina sale del anillo por cada paso del sensor, un punto respira junto al estado y el arco avanza suave. En pausa todo se detiene; se apaga con «reducir movimiento». Solo `transform` y `opacity`; nada continuo a pantalla completa.
- **Vibración (B6):** corta al pausar, doble al reanudar y al salir del bolsillo. Activa por defecto; se apaga en «Ajustes del conteo». Solo Android (en iPhone el navegador no vibra).
- **Reloj propio (B7):** hora de inicio guardada menos las pausas (manuales y con MMV oculto), así hay tiempo también sin GPS. Si la app se cierra más de 10 s y se reabre, ese tiempo cuenta como pausa. La actividad que se sugiere al terminar sigue usando los segundos del GPS, como antes.
- **Salir del bolsillo (B8):** solo Pausar y Salir; terminar y sumar se hace en la pantalla normal.
- **Nuevo:** `src/domain/bolsillo.js` (lógica pura con pruebas, sin módulos de rutas) y `src/features/actividad/VistaBolsillo.jsx` (pantalla, barras de señal y botón de mantener; todo por props). Cambian `ActividadFisica.jsx` (solo lo visual, la pausa y el reloj: **la lógica de conteo, GPS y rutas no se tocó**), `Icono.jsx` (ícono `play`) y `styles.css` (bloque «Entrega 35» al final, solo tokens, sin tokens nuevos).
- **Sin cambios** en Dexie (v11), backup, service worker ni carga diferida. Claves nuevas en `localStorage`: `mv_pasos_reloj` y `mv_bolsillo_vibrar`.
- **Pruebas:** `tests/entrega36.test.js`. Se relajaron a propósito las de versión de `tests/entrega34.test.js` y `tests/entrega35.test.js`.
- **Límite que no cambia:** con la pantalla bloqueada o MMV en segundo plano el sensor web se pausa. Contar con la pantalla apagada pide una app nativa o leer el podómetro del sistema.
- **No probado:** celular real (sensor, GPS, táctil, vibración, batería).

## v0.35.1 · Entrega 34 · Corrección: contador de pasos en modo bolsillo (06/11/2026)
- **Corrección · el contador quedaba en 0 en modo bolsillo:** el detector medía el módulo de la aceleración *lineal* (sin gravedad), que siempre es positivo y deja el golpe del paso casi al nivel de su propio promedio; con el teléfono en el bolsillo (movimiento más suave que en la mano) nunca llegaba al umbral de 1,0 m/s². Ahora usa la aceleración **con gravedad** (cae a la lineal si el equipo no la entrega) y el umbral baja a 0,6 m/s² (rearme en 0,2). En simulación cuenta desde 0,6 m/s² de amplitud a 16, 30 y 60 muestras por segundo y no cuenta nada con el teléfono quieto.
- **Respaldo con GPS en vivo:** si el sensor no suma pasos pero el GPS midió distancia, el número del anillo, el modo bolsillo y el botón «Terminar conteo» muestran la estimación por GPS (la misma que se suma al terminar), en vez de quedarse en 0.
- **Pantalla encendida en el bolsillo:** si el sistema suelta el Wake Lock, se vuelve a pedir solo mientras MMV siga visible.
- **No probado:** celular real (solo simulación y pruebas automáticas: `tests/entrega35.test.js`).

## v0.35.0 · Entrega 34 · Modo bolsillo para caminar (06/11/2026)
- **Caminar «con la pantalla apagada», dentro de lo que permite una web:** con el conteo en marcha, el botón **Modo bolsillo** deja la pantalla casi negra y encendida (el sensor web solo cuenta con MMV visible). Muestra los pasos de hoy en tenue; para salir hay que **mantener presionado 1 s** (relleno de progreso), así un roce en el bolsillo no cambia nada. Con teclado, Enter o espacio salen directo.
- **Límite:** si bloqueás el teléfono con el botón de encendido o salís de MMV, el sensor web se pausa (el tiempo se ve en «Pausas con MMV oculto»). Contar con la pantalla realmente apagada pide una app nativa o leer el podómetro del sistema. En pantallas LCD la pantalla negra no ahorra batería; en OLED sí, casi todo.
- Sin cambios en lógica de conteo, datos, backup ni service worker. Pruebas: `tests/entrega34.test.js`; se relajó la prueba de versión de la entrega 33.
- **No probado:** celular real (táctil, mantener presionado, batería).

## v0.34.0 · Entrega 33 · Anillo en el contador de pasos y «Dormir con alarma» (06/11/2026)
- **Contador de pasos con anillo (propuestas D2, D3, D4 y D6 del informe, en versión acotada):** arriba de «Actividad física» hay un anillo con los **pasos de hoy en vivo** (lo ya guardado + lo que va contando el sensor) contra tu meta. Al lado: «de N · tu meta» o «de N · tu promedio de 28 días», el estado con **ícono + texto** (Contando · sensor y GPS / Buscando señal de GPS / En pausa), «+N esta caminata» y el tiempo que MMV estuvo oculto («Pausas con MMV oculto: 3 min 12 s»; el sensor web no cuenta en segundo plano). Se verde al llegar a la meta. El anillo no se anuncia en vivo: el grupo dice «Pasos: 5482 de 8000 (69 %)».
- **Meta editable (opcional):** «Ajustes del conteo» › «Meta diaria de pasos» (1.000 a 100.000). Vacía: el anillo se compara con **tu promedio de 28 días** (mínimo 3 días con pasos); sin ninguno de los dos queda vacío y no se inventa una cifra.
- **Sin conexión:** cuando el teléfono no tiene red aparece «Sin conexión · el conteo sigue igual» (sensor y GPS son del teléfono; solo el mapa opcional usa internet).
- **Hoy:** nueva fila **Pasos** con anillo chico (junto a Comida, Agua y Peso) que abre «Actividad y cuerpo»; antes había que abrir el plegable para ver un número.
- **Dormir con alarma (nuevo):** plegable «Dormir con alarma» en Hoy. Elegís la hora, tocás «Empezar a dormir» y aparece una **pantalla completa casi negra** (reloj y anillo de la noche atenuados) que mantiene la pantalla encendida (`wakeLock`). A la hora suena la alarma (pitido cada vez más fuerte + vibración si el teléfono la tiene). Al apagarla ves «Tu noche»: te acostaste / despertaste a tal hora y las **horas de sueño** ya calculadas, editables; «Guardar en mi check-in» las escribe en el campo Sueño de hoy (el que usa la preparación y el informe). Si la app se cerró y la abrís después de la hora, no suena de golpe: propone la hora de la alarma y ofrece usar la hora actual. Botón «Probar sonido» para comprobar volumen.
- **Límite que se dice en pantalla:** una app web no puede sonar con la pantalla bloqueada ni con MMV cerrado o en segundo plano; por eso la pantalla queda encendida y conviene dejar el teléfono cargando y poner además una alarma del teléfono de respaldo. Las horas son tiempo en cama (de «Empezar a dormir» a «Apagar»), no sueño medido.
- **Corrección de un riesgo existente:** el check-in de Hoy guardaba una copia de la fila del día tomada al abrir la pantalla; si entre tanto «Actividad y cuerpo» sumaba pasos, el siguiente toque en el check-in o el agua los **pisaba con el valor viejo**. Ahora guarda sobre la fila que hay en la base, dentro de una transacción.
- **Nuevo:** `src/domain/metaPasos.js` y `src/domain/sueno.js` (lógica pura con pruebas), `src/features/sueno/ModoSueno.jsx`; íconos `luna`, `pausa`, `punto`, `ubicacion`. Cambian `ActividadFisica.jsx` (solo lo visual y el seguimiento de pausas; **la lógica de conteo, GPS y rutas no se tocó**), `Hoy.jsx`, `Icono.jsx` y `styles.css`.
- **Sin cambios** en Dexie (v11), backup, service worker ni carga diferida. La noche en curso y la meta viven en `localStorage` (`mv_sueno_sesion`, `mv_alarmasueno`, `mv_metapasos`).
- **Pruebas:** `tests/entrega33.test.js`. Se relajó a propósito la prueba de versión de `tests/entrega32.test.js`.
- **No incluido (queda para otra entrega):** mantener presionado para terminar el conteo (D5), resumen con miniatura de la ruta al terminar (D7) y la hoja a pantalla completa del contador (D1/D2 completos).
- **No probado:** celular real (sensor, GPS, táctil, volumen y vibración de la alarma, comportamiento con la pantalla bloqueada), modo claro del sistema.

## v0.33.0 · Entrega 32 · Anillos de progreso en Hoy (06/11/2026)
- **Apariencia circular:** la v0.32.0 (lista limpia) no tenía ningún elemento circular. Ahora **Preparación** muestra el puntaje dentro de un anillo grande (verde si es «Listo para entrenar fuerte», rojo si dice «Priorizá la recuperación», azul de datos en el medio) con la etiqueta y la recomendación al lado; **Comida** y **Agua** llevan un anillo chico a la izquierda de su fila, que se llena con las kcal y los ml del día y se pone verde al llegar a la meta. **Peso** no tiene meta y no lleva anillo.
- **Hechos con SVG, sin librerías:** `src/ui/Anillo.jsx` (decorativo, `aria-hidden`) y `src/domain/anillo.js` (lógica pura: fracción 0–1, largo del arco, clase de color, texto accesible). Los colores salen de los tokens (`--info`, `--pos`, `--neg`, `--sf-2`); el cian sigue siendo solo para lo tocable y el lima solo para el botón de entrenar.
- **Accesibilidad:** el anillo no se anuncia; la fila de Comida y la de Agua dicen «Agua: 1250 de 2500 ml (50 %)» en su etiqueta.
- **Se quitó** la barra horizontal de la preparación y el número de 72 px (ahora 40 px dentro del anillo). El cálculo no cambia.
- **Sin cambios** en datos (Dexie v11), backup, service worker ni carga diferida: `Anillo` es un archivo chico que Hoy ya podía importar.
- **Pruebas:** nuevas en `tests/entrega32.test.js`. Se relajó a propósito la prueba de versión de `tests/entrega31.test.js`.
- **No probado:** celular real, modo claro del sistema.

## v0.32.0 · Entrega 31 · Lenguaje «lista limpia» en Hoy, Entreno y Progreso (06/11/2026)
- **Propuesta B aplicada:** en Hoy, Entreno y Progreso/Informe las secciones ya no son cajas: sin fondo, sombra ni borde, separadas por ritmo vertical (`--sp-5`, `--sp-6`). Se activa con la clase `plano` en `<main>` (`App.jsx`); Comidas y Ajustes siguen con tarjetas.
- **Hoy:** la preparación y el botón lima quedan sin caja. Comida, Agua y Peso pasan de teselas a una lista (rótulo y ayudas a la izquierda, valor a la derecha). Check-in y «Actividad y cuerpo» son filas de texto con chevron cian. **Pantalla ancha (desde 840 px):** preparación y botón a la izquierda, lista a la derecha; lo plegable queda debajo, a todo el ancho.
- **Entreno y Progreso/Informe:** mismo lenguaje: títulos `h3`, filas `.lin` y `.fila` sin líneas, con más aire entre bloques. Solo cambia el estilo: el contenido, el orden y los textos no se tocaron.
- **Se mantienen:** las cajas de aviso (`.warn`, p. ej. «Conviene una semana de descarga»), los bordes de todo control tocable y el cian para lo tocable; lima solo en el botón de entrenar.
- **Sin cambios** en datos (Dexie v11), backup, service worker ni `pantallas.js`; sin tokens nuevos.
- **Pruebas:** nuevas en `tests/entrega31.test.js`. Se cambiaron a propósito dos en `tests/entrega30.test.js`: la prueba de «solo tokens» ahora mira solo el bloque de la entrega 30 (el de la 31 tiene la suya, que admite `none` y `0` para quitar sombra y radio) y la de versión ya no fija la 0.31.0.
- **Probado:** `npm test` y `npm run build` en verde; Hoy, Entreno (inicio y sesión en curso) e Informe revisados en Chromium a 390 y 1200 px, sin errores de consola. **No probado:** celular real, teclado en pantalla, modo claro del sistema.

## v0.31.0 · Entrega 30 · Interfaz simplificada (06/11/2026)
- **Hoy, propuesta A (foco único):** arriba la **preparación** con el puntaje grande, un solo botón lima **EMPEZAR ENTRENO** (con la cámara al lado) y tres **teselas** de un vistazo: Comida (kcal y proteína), Agua y Peso. Antes eran 9 bloques apilados.
- **Check-in plegable:** se abre solo si todavía no lo hiciste hoy; hecho, queda en una fila «Hecho ✓». **Actividad y cuerpo** (pasos, rutas, medidas) también va en una fila plegable. El contenido plegado sigue montado (solo oculto): una ruta o un formulario a medias no se pierden.
- **Agua:** tocar la tesela abre el detalle con los mismos controles de antes (+250, +500, deshacer, otra cantidad, reiniciar).
- **Preparación:** el cálculo quedó igual. «Calculado con X % de los datos» y «Cómo se calcula» pasaron al plegable «Detalle y cómo se calcula».
- **Entreno:** «Sesión manual» y «Sesión en blanco» pasaron a un plegable «¿Sin foto o sin IA?».
- **Tarjetas sin borde en toda la app** (Entreno, Progreso, Informe, Comidas…): elevación sutil en lugar de línea.
- **Tokens nuevos** (solo en `src/tokens.css`): radios `--r-card`, `--r-tile`, `--r-ctl`; espacios `--sp-1` a `--sp-6`; sombra `--sombra-1`; ancho `--ancho-app` (520 px; 760 px desde 840 px de ancho de pantalla).
- **Se quitó** el texto largo bajo el botón de entrenar (explicaba la cámara; el botón conserva su etiqueta accesible).
- **Carga diferida intacta:** Hoy sigue importando solo `FilaAlimentacion`, `Preparacion` y `AvisoDescarga`; sin cambios en `pantallas.js`, Dexie (v11), backup ni service worker.
- **Pruebas:** nuevas en `tests/entrega30.test.js`. Se actualizó a propósito `tests/entrega29.test.js` (la prueba de versión ya no fija la 0.30.0).
- **No probado:** celular real (táctil, teclado en pantalla). Sí se revisó en Chromium en 390 px y 1200 px de ancho.

## v0.30.0 · Entrega 29 · IA con actividad y rutas (05/11/2026)
- **Informe semanal:** nueva sección **Actividad** (solo si hay datos): pasos (promedio de los días con dato y variación contra la semana anterior), actividades (cantidad, minutos, km) y **rutas con GPS aparte**. También entra en «Copiar informe» y cuenta para que la semana tenga informe.
- **Sin doble conteo (riesgo de la entrega 28 resuelto):** una ruta enlazada a una actividad por `rutaId`, o que coincide con una actividad sin enlace (mismo día y tipo, distancia o duración parecidas: ±15 % o 0,3 km; ±20 % o 5 min si falta la distancia), cuenta una sola vez, como actividad. El emparejamiento es uno a uno, así una actividad no tapa dos salidas. Un GPX importado de una caminata que ya cargaste a mano no se suma de nuevo.
- **Preparación:** la «carga reciente» (20 %) suma actividades y rutas aparte como RPE típico por tipo × minutos (caminata 2, bicicleta 5, carrera/natación/deporte 6, otro 4; propuesta de diseño, no de un estudio). Pesos sin cambios; sin actividad el puntaje es idéntico al de antes. El detalle muestra «con N min de actividad (7 días)». Los **pasos de ayer** se ven junto a tu promedio de 28 días, sin sumar al puntaje.
- **Coach IA:** recibe `actividad` (pasos, actividades por tipo, rutas aparte y total) y su prompt aprendió a leerla y a sugerir **ajustes chicos de la rutina de la semana** (sumar o sacar un día de fuerza, bajar volumen o intensidad, descarga, movilidad), sin nombrar ejercicios ni fijar ritmos o distancias objetivo. Si no hay movimiento esa semana, el bloque no se manda.
- **Privacidad (D3, actualizada a conciencia):** a la IA solo llegan totales. Nunca coordenadas, trazos, horas de inicio, parciales ni notas. `src/data/movimiento.js` lee las rutas ya **sin trazo** (`rutaSinTrazo`) y las actividades sin nota; `movimientoParaIA` elige campo por campo qué puede salir. Las pruebas fijan: el cuerpo enviado no contiene ninguno de esos datos aunque se le pase una fila completa; ningún servicio toca rutas; solo una lista cerrada de archivos puede importar los módulos de rutas; solo `data/rutas.js` y `data/movimiento.js` leen `db.rutas`.
- **Carga diferida intacta:** Coach e informe siguen en el paquete de Progreso; Hoy sigue sin importar Coach ni Progreso (`prep.js` solo suma `data/movimiento.js`, chico).
- **Nuevo:** `src/domain/movimiento.js` (lógica pura) y `src/data/movimiento.js`. Cambian `domain/informe.js`, `domain/preparacion.js`, `features/coach/{Coach,Preparacion}.jsx` y `prep.js`. Textos: Ajustes › Mapa y README dicen que la IA recibe solo totales.
- Sin cambios en Dexie (v11), backup ni service worker.
- **Pruebas:** 29 nuevas en `tests/entrega29.test.js`. Se actualizaron a propósito `tests/entrega26.test.js` (título de la prueba de servicios) y `tests/entrega28.test.js` (la prueba de versión ya no fija la 0.29.0).
- **No probado:** respuesta real de Gemini con el bloque de actividad (no hay clave en el entorno de desarrollo); celular real.

## v0.29.0 · Entrega 28 · Rendimiento: carga diferida de pantallas (05/11/2026)
- **Code splitting con `React.lazy`:** Entreno, Comidas, Progreso, Rutas, Ajustes y el menú oculto salen del paquete principal y se bajan aparte. JS de arranque: **556 kB → 421 kB** (de 175 kB a 139 kB comprimido; incluye React compartido de 114 kB). Hoy sigue en el paquete principal para que la primera pantalla aparezca sin esperar.
- **Sin conexión (condición de la entrega):** unos 3 s después de abrir, las demás pantallas se bajan en segundo plano, de a una y en orden (no con la red apagada, con «ahorro de datos» ni con 2G; si no hay señal espera a que vuelva) y `public/sw.js` —sin cambios— las guarda. Probado en Chromium: tras la precarga, con la red cortada y recargando, andan Entreno, Comidas, Progreso, Rutas, Ajustes y el menú oculto.
- **Reintento real:** Chrome y Firefox recuerdan que un `import()` falló y no vuelven a pedir ese archivo; reintentar el mismo pedido no servía (verificado). Ahora los reintentos piden el archivo con otra dirección (`?r=`). Un fallo pasajero se resuelve solo (3 intentos, 0,6 s y 1,2 s de espera); si no, aparece «No se pudo abrir…» con **Reintentar** y **Actualizar la app**. En Safari, que no informa qué archivo falló, «Reintentar» recarga la app. Cubre señal cortada y el caso de Cloudflare devolviendo HTML por un archivo que ya no existe tras una versión nueva.
- **Accesibilidad:** «Cargando…» con `role=status` y `aria-live`; el aviso de fallo con `role=alert`. Un fallo al *dibujar* una pantalla no se tapa: sigue yendo a la pantalla de error general con el detalle técnico.
- **D5 resuelta (recomendada): el historial de rutas pasó a Progreso › Rutas** (8 pestañas, después de Historial). En Hoy › Actividad queda el botón «Ver mis rutas», que abre Progreso directo en esa pestaña; tocar «Progreso» en la barra sigue abriendo en Pilares. Rutas ya no tiene el interruptor «Ver mis rutas»: la pestaña muestra la lista, importar y exportar GPX. El mapa OSM sigue pidiéndose solo tras el permiso de Ajustes y un toque por ruta.
- **Orden del código:** `FilaAlimentacion`, `Preparacion` y `AvisoDescarga` (usados por Hoy) pasaron a archivos propios (`comidas/FilaAlimentacion.jsx`, `coach/Preparacion.jsx` + `coach/prep.js`, `progreso/AvisoDescarga.jsx`) porque importarlos desde Comidas, Coach y Pilares arrastraba esas pantallas enteras al paquete principal. Sin copias: una prueba verifica que cada uno se define en un solo lugar.
- **Nuevo:** `src/domain/carga.js` (lógica pura con pruebas), `src/ui/pantallas.js` (registro, precarga, reintento), `src/ui/Pantalla.jsx` (Suspense + aviso).
- **Pruebas:** 34 nuevas en `tests/entrega28.test.js`. Se actualizaron a propósito `tests/entrega24.test.js` (8 pestañas) y `tests/entrega14.test.js` (el registro `ui/pantallas.js` puede nombrar el menú oculto, único modo de bajarlo; sigue sin aparecer en IA, informe, coach ni progreso).
- Sin cambios en Dexie (v11), backup ni service worker. **No probado:** celular real (precarga con datos móviles, Android con ahorro de datos, iOS/Safari).

## v0.28.0 · Entrega 27 · Mapa OSM opcional y GPX (05/11/2026)
- **Mapa opcional (D1 completada):** Ajustes › «Mapa de las rutas» (apagado por defecto, aviso explícito). Con el permiso, el detalle de cada ruta muestra «Ver sobre el mapa»; recién al tocarlo se piden las teselas a OpenStreetMap (zona visible + IP). Trazo con borde sobre las teselas, atribución «© OpenStreetMap» y aviso si no hay conexión. Sin librerías nuevas: `src/domain/mapa.js` (Web Mercator, elección de zoom, teselas, trazo en px; con pruebas) y `src/ui/MapaOsm.jsx`.
- **Exportar GPX:** por ruta (detalle) o todas (Hoy › Rutas). GPX 1.1 con `ele` y `time`, y una extensión `mmv:ruta` con las estadísticas completas. Usa la hoja de compartir del celular si existe; si no, descarga. Se exporta el trazo guardado (con el recorte de 150 m si estaba activo).
- **Importar GPX:** lee `trk`/`rte` de otras apps (atributos en cualquier orden, CDATA, comentarios; descarta puntos inválidos). Calcula distancia, tiempo (primer a último horario), ritmo, parciales y subida; aplica la opción «Ocultar 150 m». Sin horarios se guarda con la fecha de hoy, sin ritmo (`sinTiempo`). Detecta repetidas (mismo inicio y distancia) y no duplica. Un GPX exportado por MMV conserva sus estadísticas y no se vuelve a recortar. Las rutas importadas llevan `origen: 'gpx'`.
- **Datos:** sin cambios en Dexie (v11). La preferencia `mapa_osm` es local del dispositivo y no viaja en el backup. `armarRuta` acepta `exigirTiempo: false`.
- **Privacidad:** una prueba fija que la dirección del servidor de teselas vive solo en `domain/mapa.js`, que el mapa solo se monta tras el permiso y el toque, y que ningún servicio toca mapa ni GPX. El service worker no guarda teselas.
- Pruebas: 25 nuevas en `tests/entrega27.test.js` (total 342). **No probado:** celular real (compartir archivo en iOS/Android, carga de teselas, GPX de Strava/Garmin/Komoot reales).

## v0.27.0 · Entrega 26 · Rutas GPS: trazo, historial y parciales (05/11/2026)
- **Qué cambia:** el GPS ya no guarda solo la distancia. Al contar con el GPS activado, el recorrido queda guardado como **ruta** y se ve en **Hoy › Rutas** («Ver mis rutas»): lista por mes con miniatura del trazo, y al tocar una ruta, el trazo grande, distancia, tiempo, ritmo (min/km), subida aproximada y **parciales por km**. Se puede borrar cada ruta.
- **Trazo SVG privado (decisión D1):** se dibuja sin mapa ni conexión (`src/ui/TrazoSvg.jsx`, norte arriba, proporción real). Mientras contás se ve el trazo en vivo. El mapa OSM opcional queda para la entrega 27.
- **Privacidad:** el recorrido vive solo en el teléfono y no se envía a ningún servidor ni a la IA (una prueba vigila que `services/` no toque las rutas). Dos opciones nuevas en «Ajustes del conteo»: **Guardar la ruta** (por defecto sí) y **Ocultar los primeros y últimos 150 m** del trazo guardado (por defecto sí; la distancia y el ritmo se miden completos). Las rutas **viajan en el backup**, así que ese archivo ahora contiene coordenadas.
- **Lógica nueva, con pruebas:** `src/domain/rutas.js` arma el recorrido (cada hueco sin señal abre un segmento nuevo), lo simplifica (Douglas-Peucker iterativo, tope de 800 puntos guardados), lo guarda compacto (≈1 m de resolución), calcula parciales, desnivel (con histéresis de 4 m) y ritmo, proyecta el trazo, agrupa el historial y arma `resumenRutasParaIA` (solo agregados, listo para la entrega de IA).
- **Datos:** Dexie **v11** agrega la tabla `rutas` (`++id,fecha,tipo`); no toca nada existente. `rutas` está en `TABLAS` y viaja en el backup. La capa de datos está en `src/data/rutas.js`.
- **Actividad enlazada:** al registrar la actividad sugerida tras un conteo, se guarda `rutaId` en la actividad para no contar dos veces la misma salida cuando la IA use rutas y actividades.
- **Robustez:** la ruta en curso se guarda en el teléfono cada ~10 s y al pasar MMV a segundo plano, así se retoma si la app se cierra; una ruta que falla al guardarse no revierte ni repite los pasos; un conteo que quedó abierto de un día anterior también guarda su ruta con esa fecha.
- **Textos:** se corrigió la promesa anterior («la posición no se guarda»): ahora dice que la ubicación en vivo nunca sale del teléfono y explica qué se guarda.
- Pruebas: 39 nuevas en `tests/entrega26.test.js` (lógica, trazo, historial, migración v10→v11, backup con rutas y privacidad hacia la IA).
- **No probado:** celular real (precisión del GPS caminando, altura reportada por el navegador, retomar tras cierre forzado en iOS).

## v0.26.1 · Entrega 25 · Diagnóstico de arranque (04/11/2026)
- La pantalla «La app no arrancó» ahora capta también los archivos que no cargan (antes decía «sin mensaje») y muestra el estado y tipo de respuesta del script principal (ej. `200 text/html` = Cloudflare devolvió una página en lugar del archivo).
- Sin cambios en Dexie (v10), cálculos ni backup. Pruebas: 278.

## v0.26.0 · Entrega 24 · Propuesta 3 (parte 2): pestañas de Progreso deslizables (04/11/2026)
- **Progreso:** las 7 pestañas (Pilares, Semana, Historial, Récords, Tests, Cuerpo, Informe) pasaron a **una sola fila con deslizamiento horizontal** (`src/ui/TabsDeslizables.jsx`). Mismo orden y nombres; ya no queda «Informe» solo en una segunda fila.
- La pestaña activa se centra sola al abrir y al cambiar; un degradé en el borde avisa si hay más pestañas fuera de pantalla. Botones de 44 px de alto, sin barra de scroll visible.
- Accesibilidad: `role=tablist/tab`, flechas ← → / Inicio / Fin entre pestañas, y sin animación si el sistema pide reducir movimiento.
- Decisiones aplicadas (las recomendadas del informe de la entrega 23): Progreso con tabs deslizables (A), Pilares/Semana/Informe se mantienen separadas (A, sin cambios), filtro «Frecuentes» sin favoritos con estrella.
- Sin cambios en Dexie (v10), cálculos ni backup. Pruebas: 278 (5 nuevas en `tests/entrega24.test.js`).

## v0.25.0 · Entrega 23 · Propuesta 3 (parte 1): cabecera, barra inferior, Hoy, Comidas y Pilares (04/11/2026)
- **Cabecera de 56 px:** solo «MMV» y el engranaje (SVG). La versión salió de la cabecera: está en Ajustes › Versión instalada, y los 5 toques seguidos sobre la línea «Versión» de esa tarjeta siguen abriendo el menú privado.
- **Barra inferior** con íconos SVG + etiqueta (56 px de alto, ancho ≥ 86 px por botón).
- **Hoy:** orden Check-in → Preparación → Entrenar → Alimentación → Hidratación → Actividad → Cuerpo. Check-in compacto (cada métrica en una fila, leyenda de extremos en una línea, sueño en una línea). «Alimentación de hoy» pasó a una fila compacta (kcal y proteína) que abre Comidas.
- **Estados vacíos plegables** (`src/ui/Plegable.jsx`): «Preparación» sin datos y «Progresión por ejercicio» sin datos se ven en una línea y se expanden al tocar.
- **Comidas:** una sola lista «Recientes y frecuentes» (alimentos sueltos y comidas completas, con kcal y gramos), 3 visibles y «Ver más».
- **Mis alimentos:** orden por uso reciente, filtros Todos · Frecuentes · Propios · Web, leyenda 🌐/≈ arriba y «Reponer alimentos iniciales» dentro de «Avanzado».
- **Progreso › Pilares:** los pilares con datos van primero y los demás se agrupan en «Aún sin datos» con lo que falta; la semana en curso del gráfico de carga muestra su valor.
- Pendiente de tu decisión: tabs de Progreso (tarea 3) y fusión de Semana/Pilares/Informe (tarea 12).
- Sin cambios en Dexie (v10), cálculos ni backup. Pruebas: 273 (7 nuevas en `tests/entrega23.test.js`).

## v0.24.0 · Entrega 22 · Propuesta 2: sistema de color, contraste y estados (04/11/2026)
- **Tokens:** todos los colores pasaron a `src/tokens.css` (documentados en `DESIGN-TOKENS.md`). Sin hex sueltos en CSS ni componentes.
- **Contraste:** gris secundario `#7d8b9a` → `#a9b7c6` (en el hero era 2,79:1; ahora ≥ 4,5:1), placeholders ≥ 4,5:1 y bordes de controles ≥ 3:1 (antes 1,2:1, por eso botones y chips parecían deshabilitados).
- **Botones:** por defecto secundarios (borde cian); `.pri` relleno (uno por pantalla); `.cta`/`.plus` lima; deshabilitado gris; presionado. Chips: normal, presionado y seleccionado (con ✓).
- **Lima reservado:** ya no pinta etiquetas, deltas, puntajes, avisos ni «Igual». Queda en «Empezar entreno», «+1 ronda» y la confirmación de la pizarra.
- **Variaciones:** en gris con ▲/▼ mientras la semana sigue en curso (Semana e Informe) y en el peso; verde/rojo con ▲/▼ en el resto.
- **Macros:** «Proteína · Carbohidratos · Grasas» con mini-barras en lugar de «P · C · G»; en filas, «Prot. · Carb. · Gras.».
- **Pilares y tests:** rótulos de estado como chips con ícono y color.
- **Íconos:** set SVG propio (`src/ui/Icono.jsx`) en lugar de 📷 ✍ 📚 ↻ 🔁.
- Un solo botón relleno por pantalla (Entreno: «Foto de la pizarra»; Hoy: solo el lima).
- Sin cambios en Dexie (v10), cálculos ni backup. Pruebas: 266 (19 nuevas en `tests/entrega22.test.js`).

## v0.23.0 · Entrega 21 · Propuesta 1: bugs visuales y componentes base (04/11/2026)
- **Navegador de fecha/semana único** (`src/ui/NavFecha.jsx`, grid 44 px / 1fr / 44 px): Comidas, Hoy › Actividad física, Progreso › Semana e Informe. El Informe dice «Esta semana» como Semana.
- **Inputs:** campos flexibles (`.fx`) y placeholders cortos («Buscar alimento», «Min», «Km»); la casilla de pasos ya no se corta.
- **Código de barras:** SVG inline en lugar de «▮▯▮».
- **Valores vacíos (causa raíz):** nuevo `src/domain/formato.js` (sin dato «—», cero «0»). Hidratación y calidad del sueño ya no quedan en blanco cuando el día tiene una fila sin esos campos; el peso oculta «(… kg en 4 semanas)» si no hay tendencia.
- **Sueño:** la calidad se muestra en vivo.
- **Alimentos:** ícono 🌐/≈ en columna propia y kcal sin partirse.
- **Backup:** tres botones a ancho completo. **Ajustes:** «Probar la IA» separado del modelo; casillas con el estilo del tema. **Bienestar:** «Bloquear» a la derecha de las pestañas; ayuda de Registrar debajo del botón.
- **Texto:** «1 sesión por semana»; fecha dd/mm/aaaa en «Repetir la última sesión»; nombres de ejercicios limpios solo al mostrar (el dato guardado no cambia).
- Sin cambios en Dexie (v10) ni en el backup. Pruebas: 247 (7 nuevas en `tests/entrega21.test.js`).

## v0.22.0 · Entrega 20 · GPS en la actividad física y lógica con pruebas (03/11/2026)
- **Problema que reportaste:** el conteo decía «No se concedió permiso para usar el sensor». Pasa cuando el navegador (en iPhone) ofrece el permiso del sensor de movimiento y la respuesta no es «Permitir»; iOS recuerda la negativa hasta cerrar la app por completo. Ahora, si el sensor no tiene permiso, **MMV sigue contando con el GPS** y te explica cómo darle el permiso (cerrar MMV del todo, abrirlo, tocar ▶ y elegir «Permitir»). Si falla también el GPS, recién ahí avisa que no puede contar.
- **GPS (pedido):** al tocar ▶ también se mide la distancia con el GPS. Se descartan los puntos con precisión peor que 25 m, el temblor con el teléfono quieto (menos de 3 m o menos de la mitad de la precisión), los saltos de más de 12 m/s y los tramos sin señal de más de 60 s. Se ve «GPS: 1,23 km · señal buena/débil» mientras contás.
- **Cómo se combinan sensor y GPS:** manda el sensor. El GPS lo reemplaza solo cuando el sensor claramente se perdió pasos (más de 1,6 m de distancia por paso, o sin permiso del sensor) y estima los pasos con el largo de paso. Si el GPS midió menos que el sensor (por ejemplo dentro de un edificio) no se baja nada.
- **Largo de paso:** arranca en 0,72 m y se ajusta solo, de a poco, con cada conteo que tenga sensor y GPS coherentes (en «Ajustes del conteo» se puede ver y corregir a mano; se guarda en el teléfono, no en el backup).
- **Actividad sugerida:** al terminar un conteo con al menos 100 m y 1 minuto de GPS, el formulario de «Agregar actividad» queda precargado (caminata, carrera o bicicleta según el ritmo, minutos y km). Se guarda recién cuando tocás «Registrar»; Km ahora acepta coma.
- **Pantalla encendida:** mientras contás se pide al navegador que no apague la pantalla (Wake Lock), para que el bloqueo no corte el sensor ni el GPS. Si el navegador no lo permite, queda como antes: el conteo se pausa al salir de MMV.
- **Privacidad:** la ubicación se usa solo en el teléfono; no se guarda la ruta ni sale del dispositivo. Se guarda únicamente la distancia y el tiempo del conteo en curso (en el teléfono) para poder recuperarlo.
- **Lógica fuera del componente (pedido):** nuevo `src/domain/actividad.js` con el filtro del acelerómetro, el tope de 200 000 pasos, la validación de actividades, la distancia GPS, la combinación sensor + GPS y el largo de paso. `ActividadFisica.jsx` solo muestra y guarda.
- Sin cambios en Dexie (sigue **v10**) ni en el backup.
- **Pruebas: 240** (211 + 29 nuevas en `tests/entrega20.test.js`), todas pasan; `npm ci` y build en verde. Probado en Chromium de escritorio con GPS y sensor simulados: el GPS suma distancia, el sensor cuenta, el cierre suma los pasos y precarga la actividad, sin errores de consola. **No probado:** celular real (el permiso del sensor en iPhone, la precisión del GPS caminando y el Wake Lock dependen del dispositivo).
- Limpieza: la entrada `0.15.1` que estaba suelta arriba del título pasó a su lugar en el historial.

## v0.21.1 · Entrega 19 · Corrección de pruebas (03/11/2026)
- Corrige `tests/entrega14.test.js`: esperaba la base de datos en la versión 9 y desde la v0.21.0 va por la 10. Eso hacía fallar 3 pruebas (una directa y dos en cascada) y habría frenado la publicación automática en GitHub Actions.
- Sin cambios en la app: mismas pantallas, misma base (Dexie v10) y mismo backup.
- **Pruebas: 211 de 211 pasan**; `npm ci` y build en verde. Sigue pendiente validar el conteo de pasos en un teléfono real.

## v0.21.0 · Entrega 19 · Actividad física diaria (03/11/2026)
- En Hoy se agregó un contador estimado de pasos con el acelerómetro del teléfono. Se inicia con un toque, pide permiso cuando el navegador lo requiere y suma el conteo al total diario al detenerlo.
- El panel de actividad permite recorrer fechas anteriores para consultar o corregir pasos y actividades; también permite cargar una actividad en un día pasado.
- Las actualizaciones de pasos combinan el valor con la fila diaria existente para conservar el check-in y los demás datos. Un conteo sin cerrar se recupera al abrir MMV otro día.
- El conteo funciona únicamente mientras la app está abierta y visible; el navegador puede pausarlo en segundo plano o con la pantalla bloqueada. No reemplaza a un podómetro del sistema o reloj, y requiere validación en el teléfono real.
- Se pueden registrar caminatas, bicicleta, carrera, natación, deporte y otras actividades, con duración, distancia opcional y nota.
- Dexie v10 agrega la tabla `actividades`; los pasos se guardan en el registro diario existente. La tabla nueva se incluye en backups y restauraciones.
- El conteo del acelerómetro es una estimación y puede variar según dónde lleves el teléfono. No se usa GPS ni se envían datos fuera del dispositivo.
- No se verificó en teléfono real en esta entrega.

## v0.20.0 · Entrega 18 · Menos scroll y biblioteca de ejercicios (03/11/2026)
- **Menos scroll al editar (pedido):** la sesión ahora muestra **un bloque abierto a la vez**. Arriba, **chips fijos** («1 · Movilidad · 2 · Warm up · 3 · EMOM…») para saltar de un bloque a otro con un toque; los demás bloques quedan plegados en una línea («3. EMOM · 12 min — 6 ejercicios · 2 con carga · tocá para abrir»). **Siguiente bloque ›** al final de cada bloque, y «Ver todo» / «Plegar» para volver a verlos todos como antes. Al agregar un bloque se abre solo.
- **Biblioteca de ejercicios (pedido):** nueva pantalla **📚 Biblioteca de ejercicios** (Entreno, al empezar). Buscar (sin acentos ni mayúsculas), **agregar** ejercicios con su patrón de movimiento y «un lado por vez», **renombrar**, cambiar el patrón y quitar de la biblioteca.
- **Renombrar cambia el historial entero:** el nombre nuevo se aplica a tus **registros, sesiones guardadas, plantillas y la sesión en curso**, conservando la cantidad del principio y los `*` / `?` del final (por ejemplo «10 Lagartijas*» → «10 Push up*»). Si el nombre nuevo ya existe, pide confirmar y **fusiona** los dos (el historial se junta). Lo que anotaste (kg y repeticiones) no se mueve.
- **Agregar de la biblioteca a un bloque:** en cada bloque, **📚 Agregar de la biblioteca** (ocupa el primer lugar en blanco de la sesión manual; «Agregar y usar» crea el ejercicio y lo pone). Se queda abierta para sumar varios y se cierra con «Listo».
- **La biblioteca se completa sola:** al guardar una sesión, todos los ejercicios con nombre (también los de Movilidad y Warm up, que no llevan carga) pasan a la biblioteca, y al abrirla se suman los de tus sesiones y plantillas anteriores.
- «Quitar de la biblioteca» solo saca la fila: tus registros y sesiones no se tocan (si lo usás de nuevo, reaparece).
- Sin cambios en Dexie (sigue **v9**), backup, menú privado, IA ni Comidas.
- **Pruebas: 211** (196 + 15 nuevas: 8 de lógica en `entrega18.test.js` y 7 con base simulada en `entrega18-datos.test.js`), todas pasan; `npm ci` y build en verde. Probado en navegador de escritorio a 400 px: chips y bloques plegados, agregar desde la biblioteca, guardar la sesión y renombrar «Cat camel» → «Gato camello» (la sesión guardada quedó con el nombre nuevo); sin errores de consola. **No probado:** celular.

## v0.19.0 · Entrega 17 · Cambiar el orden de los ejercicios (03/11/2026)
- **Pedido:** poder cambiar el orden de los ejercicios del EMOM. En cada bloque con 2 o más ejercicios aparece **«Cambiar el orden»** (en el EMOM, «Cambiar el orden (uno por minuto)») con **↑ ↓** por ejercicio. El reloj sigue el nuevo orden: «Primero: …» y cada minuto toca el ejercicio que quedó en esa posición, en las 2 vueltas. Hay que cambiarlo **antes de tocar ▶** (un reloj ya en marcha sigue como estaba).
- **Lo que ya cargaste viaja con su ejercicio** (los kg y repeticiones se guardan por posición, así que al mover se mueven juntos); un ejercicio sin carga no inventa ninguna. Funciona en todos los tipos de bloque (en el Tabata cambia el orden en que se alternan).
- Incluye la **v0.18.0 (entrega 16, PZ12)**: el EMOM con ejercicios rota uno por minuto y el reloj dice cuál toca.
- Sin cambios en Dexie (sigue **v9**), backup, menú privado, IA ni Comidas.
- **Pruebas: 196** (191 + 5 nuevas en `entrega17.test.js`), todas pasan; `npm ci` y build en verde. Probado en navegador de escritorio: se escriben 6 ejercicios en el EMOM de la sesión manual, se baja el primero y se sube el último, y el reloj arranca con «Primero: Remo». **No probado:** celular.

## v0.18.0 · Entrega 16 · El EMOM dice qué ejercicio toca (03/11/2026)
- **PZ12 (opción A que elegiste):** con ejercicios cargados, el reloj del EMOM rota **un ejercicio por minuto**. Con 6 ejercicios en 12 min son 2 vueltas: el minuto 1 es el ejercicio 1, …, el 6 el ejercicio 6 y el 7 vuelve al 1. Se ve en grande el ejercicio del minuto, abajo **«Sigue: …»**, y en «Preparate» dice **«Primero: …»**; la barra chica del reloj muestra el ejercicio actual (igual que en el Tabata).
- **Otras cantidades:** con 5 ejercicios en 12 min la rotación sigue de corrido (E1…E5, E1…E5, E1, E2); con 1 solo se repite; si hay más ejercicios que minutos se usan los primeros. Con intervalo distinto de 60 s (por ejemplo 90 s) rota igual y los intervalos se llaman «Intervalo». Los renglones en blanco y los `*` no cuentan como ejercicios.
- **Sin ejercicios cargados el EMOM queda igual que antes** (solo cuenta minutos). El tiempo total no cambia.
- **En la lista del bloque** aparece «⏱ 1 ejercicio por minuto × 12 min · los ejercicios rotan; el reloj dice cuál toca».
- Sin cambios en Dexie (sigue **v9**), backup, menú privado, IA ni Comidas. Un reloj ya en marcha antes de actualizar sigue como estaba.
- **Pruebas: 191** (183 + 8 nuevas en `entrega16.test.js`), todas pasan; `npm ci` y build en verde. Probado en navegador de escritorio con el tiempo adelantado (Preparate → Min 2 → Min 7), sin errores de consola. **No probado:** sonido, vibración y pantalla encendida en celular real.

## v0.17.0 · Entrega 15 · Sesión manual con tus 5 bloques (02/11/2026)
- **PZ10:** en Entreno, **✍ Sesión manual con mis 5 bloques** arma de una vez Movilidad (4 min) · Warm up (4 min) · EMOM 12 min (6 lugares) · For time 10 min · Tabata 20/10 (2 lugares), con el editor de ejercicios ya abierto. **Solo escribís los ejercicios**: no se inventa ningún nombre, peso ni repetición. Sirve cuando Google falla, no hay señal o no tenés la foto. «Sesión en blanco» sigue disponible.
- **El reloj funciona desde el primer momento**, sin escribir nada: Movilidad y Warm up 40 s × 6, EMOM 12 intervalos de 60 s, For time con tope de 10 min, Tabata 20/10 × 8 rondas. Al escribir los ejercicios, el reloj dice cuál toca (con 4 de movilidad son 40 s × 8; el Tabata alterna).
- **Al guardar la sesión** se descartan los bloques que quedaron sin ejercicios ni resultados (por ejemplo un Tabata que ese día no hubo) y los espacios en blanco del final de cada lista; los del medio se conservan porque los registros van por posición. Esto vale para toda sesión (también la de pizarra). El historial y «Repetir la última» quedan limpios.
- Se puede **guardar como plantilla** (la estructura sin lo que anotaste) y usar «✓ Igual que la última» como siempre.
- Sin cambios en Dexie (sigue **v9**), backup, menú privado ni IA.
- **Pruebas: 183** (176 + 7 nuevas en `entrega15.test.js`), todas pasan. Probado en navegador de escritorio (manual → escribir ejercicios → reloj → guardar: la sesión quedó con solo los 2 bloques usados). **No probado:** celular.

## v0.16.0 · Entrega 14 · Menú privado «Bienestar» (02/11/2026)
- **Acceso oculto (H1-A):** 5 toques seguidos (en menos de 3 s) sobre la versión del encabezado. No hay pestaña, botón ni ítem en Ajustes. Un toque solo sigue abriendo Ajustes (con una espera de 0,7 s). Dentro del menú, tocar la versión no hace nada.
- **Clave y cifrado real (H2-B):** la clave nunca se guarda. Se deriva con PBKDF2-SHA256 (250 000 vueltas) y los datos se cifran con AES-GCM, **un bloque por mes**, atado a su mes. Una fila `_meta` guarda la sal y una verificación para saber si la clave es correcta. **Olvidar la clave = perder estos datos** (H8-A, sin recuperación); la pantalla lo pide confirmar al crearla. Mínimo 4 caracteres, con aviso si son menos de 8.
- **Qué se registra (H4-B):** erección matutina (sí/no, un toque), dureza 1 a 4 (solo si hubo erección), libido 1 a 5, y eyaculación con hora (sin indicar / en pareja / a solas). Día elegible (hoy por defecto). Historial de los últimos 6 meses con editar la hora, editar el día y borrar.
- **Backup (H3-B):** la tabla `privado` entra al backup **cifrada** (ilegible). Al restaurar solo se importa si este equipo no tenía menú privado o si la clave es la misma (misma sal); si no, se omite para no dejar bloques ilegibles y se cuenta entre las filas omitidas.
- **Privacidad (H5):** el menú no se importa desde la IA, el informe, el coach, la preparación, Progreso ni Hoy; una prueba recorre todo `src/` y falla si otro archivo lo menciona.
- **Autobloqueo (H7):** a los 60 s en segundo plano, al tocar 🔒 Bloquear y al salir (la clave en memoria se descarta). Tras una clave incorrecta hay espera creciente.
- **Más:** cambiar clave (re-cifra todo, todo o nada) y «Borrar todo» (escribir BORRAR), también desde «Olvidé la clave».
- **Dexie v9:** solo agrega la tabla `privado`; no toca nada anterior.
- **Pruebas: 176** (164 + 12 nuevas en `entrega14.test.js`).
- **No incluye (entregas 15 y 16):** estadísticas, comparativa semanal y relación con cargas.

## v0.15.1 · Pantalla negra
- Corrige la pantalla negra: `sw.js` con caché `mv2` (no guarda HTML como archivo, borra cachés viejas), pantalla de rescate en `index.html` y límite de errores en `main.jsx`.

## v0.15.0 · Entrega 13 · La IA dice qué falla y no gasta tu cuota (02/11/2026)
- **Motivo:** «no lee, reintenta sin éxito». Hasta ahora **todo error temporal se mostraba como «alta demanda»** y se reintentaba 3 veces por modelo (6 llamadas). Si el problema era la **cuota gratuita de Google (error 429)**, cada reintento gastaba más cuota y empeoraba. No pude probarlo con Google real: es una corrección por lectura del código y pruebas con respuestas simuladas.
- **Cuota (429):** ya no reintenta el mismo modelo; prueba el otro modelo una vez y, si también está agotado, dice «Llegaste al límite gratuito de Google» con los segundos de espera que informa Google (si los informa).
- **Alta demanda (500/502/503/504):** igual que antes (espera y reintenta), pero el mensaje ya no se usa para otros errores.
- **Clave inválida:** corta enseguida y manda a «Probar la IA».
- **Respuesta ilegible:** acepta JSON entre ```json … ``` o con texto alrededor; si la respuesta se cortó (MAX_TOKENS) o no es JSON, reintenta y después lo explica. Si Google bloquea la foto, dice el motivo.
- **Todo error termina con `[código N · modelo]`** para que me lo pases tal cual.
- **Ajustes → 🔎 Probar la IA:** comprueba la clave, si el modelo existe para tu clave y si responde (2 consultas chicas, sin foto). Lista los modelos «flash» disponibles y con un toque elegís uno.
- Sin cambios en Dexie (sigue **v8**), backup, pizarra, reloj ni Comidas. La clave sigue yendo en la URL (cambiarlo no se puede probar acá).
- **Pruebas: 164** (153 + 11 nuevas en `entrega13.test.js`), todas pasan.

## v0.14.0 · Entrega 12 · El reloj dice qué ejercicio toca (02/11/2026)
- **Tabata con ejercicios alternados:** el reloj muestra en grande el ejercicio de cada ronda de trabajo (la ronda 1 es el ejercicio 1, la 2 el 2, y así; con 2 ejercicios van A-B-A-B…, con 4, A-B-C-D-A-B-C-D) y, abajo, **«Sigue: …»**; durante el descanso también avisa cuál viene. En «Preparate» dice **«Primero: …»**. La barra chica del reloj muestra el ejercicio actual. Por defecto siguen siendo 8 rondas de 20/10 en total (4 minutos); si hacés más rondas, se cambia en «Más del bloque».
- **Reloj para Movilidad y Warm up (▶):** 40 s por ejercicio, **2 vueltas** por la lista: con 3 ejercicios son **40 s × 6** y con 4, **40 s × 8**. Sin pausa entre ejercicios por defecto; suena el aviso de cambio en cada uno. En «Más del bloque» se ajustan **segundos por ejercicio**, **vueltas** (hasta 10) y **cambio (seg)** entre ejercicios. El campo «min» del bloque es solo informativo: el reloj usa ejercicios × vueltas × segundos. Sin ejercicios cargados, usa 6 intervalos sin nombres.
- **En la lista del bloque** se ve el resumen del reloj («⏱ 40 s × 6», «⏱ 20/10 × 8 rondas»).
- Los `*` y `?` no aparecen en los nombres del reloj. Un reloj ya en marcha antes de actualizar sigue como estaba.
- Sin cambios en Dexie (sigue **v8**) ni en el backup. Segmentos del EMOM, AMRAP y For time: sin cambios; Tabata sin ejercicios cargados: idéntico al de antes.
- **Pruebas: 153** (140 + 13 nuevas en `entrega12.test.js`), todas pasan; `npm ci` y `npm run build` en verde. Probado en navegador de escritorio con el tiempo adelantado (Movilidad de 6 intervalos, Tabata alternando, barra del reloj), sin errores de consola. **No probado:** sonido, vibración y pantalla encendida en un celular real.

## v0.13.0 · Entrega 11 · Pizarra simple (02/11/2026)
- **Revisión de la pizarra (PZ1):** al leer la foto ya no cae directo en el editor. Primero ves la **miniatura de tu foto** (tocás para ampliarla y comparar), los bloques con su tipo y minutos, los ejercicios en lista, las **lecturas dudosas (`?`) en amarillo** y los `*` con 🎥. **✓ Está bien, entrenar** confirma (saca los `?`, conserva los `*`); **Corregir** abre el editor con «Editar ejercicios» desplegado; **🔁 Leer de nuevo** reintenta con la misma foto. Si la IA no devuelve ejercicios, lo dice. La respuesta de la IA ahora se normaliza (tipos como «Warm up» o «For Time», minutos, ejercicios vacíos): una respuesta mal armada ya no puede romper la pantalla.
- **✓ Igual que la última (PZ2):** cada ejercicio con historial muestra **«✓ Igual · 20 kg × 10»**; un toque lo confirma como hecho. Por bloque, **✓ Igual que la última**; arriba, **✓ Todo igual que la última vez** para toda la sesión. **Solo completan lo que falta: lo que ya cargaste no se pisa**, y lo que no tocás no se guarda (regla de la entrega 9). Usa el último registro del mismo tipo de bloque o, si no hay, el más reciente.
- **Pantalla más simple (PZ3):** por ejercicio queda nombre · kg (− / +) · reps · «vs última». **↔ Izquierda / derecha** y **serie pesada** pasan a «Más» (el título muestra lo cargado). Por bloque, **RPE** y ajustes del reloj (EMOM cada…, Tabata trabajo/descanso/rondas) pasan a «Más del bloque». Siguen a la vista los resultados (rondas y reps extra, tiempo del For time, minutos del EMOM) y el casillero de video. **Movilidad y Warm up ya no piden kg ni reps** (son de tiempo): se ven como lista y, si querés, «Anotar cargas (opcional)».
- **Entrada más corta (PZ6):** botón **📷 junto a EMPEZAR ENTRENO en Hoy**: elegís la foto y Entreno la lee directamente. En Entreno, **lo que usaste la última vez va primero** (por defecto, la pizarra).
- **Corrección:** al terminar o descartar una sesión, Hoy seguía diciendo «CONTINUAR ENTRENO» (se guardaba el texto «null»). Ahora se borra la sesión, y Hoy ignora el «null» que haya quedado guardado de antes.
- Sin cambios en Dexie (sigue **v8**). Backup, Open Food Facts, escáner, Comidas, temporizador y progreso: sin cambios.
- **Pruebas: 140** (128 + 12 nuevas en `entrega11.test.js`), todas pasan; `npm ci` y `npm run build` en verde. Probado además de punta a punta en un navegador de escritorio con la IA simulada (Hoy → 📷 → revisión → editor → «Todo igual»), sin errores de consola. **No probado:** la lectura real con Gemini y un celular real.

## v0.12.0 · Entrega 10 · Comidas simples (01/11/2026)
- **«Comí algo parecido a…» (Comidas → ＋ Agregar):** atajos con tus comidas completas más repetidas de los últimos 90 días, ordenadas para el momento del día (veces + doble peso si fue en ese mismo momento + 1 si fue esta semana). Dos desayunos con los mismos alimentos cuentan como la misma comida aunque cambien los gramos. Tocar uno **lo carga en tu comida sin guardarla**, para ajustar porciones (½ · 1 · 1½ · 2) y guardar; usa los valores actuales de tu base si el alimento sigue existiendo.
- **⚡ Estimar rápido:** solo calorías (obligatorio, 1 a 5000) y proteína (opcional, 0 a 300 g), con nombre opcional. Se agrega como un ítem de 100 g marcado «estimado» y **no crea ningún alimento en tu base**.
- **Meta de proteína también en Comidas:** el Diario muestra proteína del día contra tu meta (la misma de Hoy: último peso × g por kg de Ajustes), con barra y cuánto falta. Sin peso cargado, avisa dónde registrarlo.
- **Código de barras y Open Food Facts: sin cambios.** El informe proponía pausarlo hasta recibir el «Detalle»; como el producto no falló y el escáner anda, no se pausó. Tampoco se armó el proxy de Cloudflare (solo era para el caso de fallos sistemáticos).
- Sin cambios en Dexie (sigue **v8**): ningún campo nuevo en las tablas. Los ítems estimados usan el mismo formato de ítem que el resto.
- **Pruebas: 128 esperadas** (123 + 5 nuevas en `entrega10.test.js`). **Sin `npm` en la sesión: solo se corrieron 97 (las 92 de la entrega 9 + las 5 nuevas), todas pasan**; el compilado y las pruebas con base simulada las corre GitHub Actions al publicar.

## v0.11.0 · Entrega 9 · Entreno ágil (01/11/2026)
- **Entrar a entrenar en 2 toques:** EMPEZAR ENTRENO (Hoy) lleva a Entreno, que ahora ofrece **↻ Repetir la última sesión**, **Mis plantillas** (usar o borrar con ✕), foto de la pizarra y sesión manual. Si hay una sesión sin terminar, Hoy dice **CONTINUAR ENTRENO**.
- **Repetir y plantillas copian solo la estructura** (tipo de bloque, minutos, ejercicios y tiempos del reloj). No copian pesos, repeticiones, rondas, tiempos, RPE ni video: nada queda registrado como hecho si no lo cargás vos. Tabla nueva `rutinas` (Dexie **v8**, solo agrega tabla; viaja en el backup). «Guardar como plantilla» está al final de la sesión; con el mismo nombre se reemplaza (pide confirmación).
- **↺ Cargar las últimas** (por bloque): llena kg y reps con tu último registro de cada ejercicio (del mismo tipo de bloque si existe). Se pueden editar antes de guardar.
- **RPE por bloque** (opcional, 1–10): se guarda en la sesión y en cada registro (`rpeBloque`). El RPE de la sesión sigue siendo el que manda para la carga; la app sugiere el promedio de tus bloques ponderado por minutos y lo aplicás con un toque.
- **Serie pesada** (opcional, por ejercicio): kg y repeticiones de tu serie más cargada. Mejora el **1RM estimado** (se toma el mayor entre el resumen y la serie pesada) y cuenta para el récord de carga. El **volumen no cambia**: sigue saliendo del resumen kg × reps. Los registros anteriores no cambian.
- **Casilla «Video grabado»** en los bloques con ejercicios marcados con `*`. Hoy avisa cuántos ejercicios con `*` de los últimos 14 días siguen sin marcar.
- **Aviso de descarga en Hoy:** misma regla que en Progreso → Pilares (2 o más señales); se muestra debajo de la preparación.
- **Pruebas: 123 esperadas** (112 + 9 de lógica en `entrega9.test.js` + 2 de datos en `entrega9-datos.test.js`). **En esta entrega solo se pudieron correr las que no necesitan `npm`: 92 de 92 pasan (83 anteriores + 9 nuevas)**; el compilado y las pruebas con base simulada (29 anteriores + 2 nuevas) las corre GitHub Actions al publicar.

## v0.10.0 · Entrega 8 · Progreso con 4 pilares, tests de referencia, progresión y descarga (01/11/2026)
- **Progreso → Pilares (nueva pestaña inicial):** gráfico de carga semanal (RPE × minutos, 8 semanas) y un resumen de **Fuerza** (1RM estimado de 28 días contra los 28 anteriores, por ejercicio y contexto), **Resistencia** (repeticiones de cardio, sesiones por semana y tests), **Composición** (peso, grasa y músculo contra hace 4 semanas, sin juzgar si es bueno o malo: depende de tu objetivo) y **Hábitos** (constancia de los últimos 7 días).
- **Progresión (D11):** por ejercicio y tipo de bloque, sugerencia de carga según los dos últimos registros (probar +2,5 % redondeado a 0,5 kg, consolidar o repetir). **Descarga:** aviso cuando se cumplen 2 o más señales (carga +20 % sobre tu promedio, RPE medio ≥ 8, dolor muscular alto o poco sueño). Umbrales de diseño, no indicaciones médicas.
- **Récords por contexto (D11):** el mismo ejercicio en EMOM, AMRAP, For time, etc. ya no se pisa: cada contexto tiene sus propias marcas (Récords, Historial 🏆, aviso al guardar la sesión e informe semanal).
- **Tests de referencia (D8):** pestaña **Tests** con 5 pruebas (dominadas, flexiones, plancha, 1 km, burpees en 5 min). Se repiten cada 6 a 8 semanas: estado «Al día / Toca repetirlo / Atrasado», comparación con el anterior y gráfico. Tabla nueva `tests` (Dexie **v7**, solo agrega tabla); viaja en el backup.
- **Informe semanal:** línea de **check-in** (días completos y promedios de energía, ánimo y dolor muscular, escala 1 a 5). El coach recibe esos números (siguen sin enviarse peso, medidas ni nombres de ejercicios).
- **Pruebas: 112** (antes 103): 9 nuevas (contexto, progresión, pilares, descarga, serie semanal, tests, informe con check-in, migración v6 → v7 y backup).

## v0.9.0 · Entrega 7 · «Hoy» como centro de mando, check-in y cuerpo (01/11/2026)
- **Navegación (D1):** 4 pestañas (Hoy · Entreno · Comidas · Progreso) y **Ajustes como ⚙** en el encabezado (tocarlo de nuevo vuelve a la pestaña anterior). Tocar la versión sigue abriendo Ajustes.
- **«Hoy» (D1):** de arriba hacia abajo: check-in de 20 segundos (energía, ánimo y dolor muscular de 1 a 5 + sueño y su calidad) → preparación con recomendación de intensidad → botón **EMPEZAR ENTRENO** (lleva a Entreno; las entradas «repetir última» y plantillas llegan en la entrega 9) → agua en 1 toque con deshacer → calorías y **proteína** del día → tarjeta **Cuerpo**.
- **Preparación v2 (D6):** cómo te sentís 40 %, sueño contra **tu propio promedio** 30 %, carga reciente 20 %, hábitos de ayer (comida y agua) 10 %. Con menos de 5 días de sueño cargado usa la regla absoluta anterior; menos de 5 h nunca pasa de 50 aunque duermas así siempre. Sigue repartiendo los pesos entre lo que hay y mostrando la confianza. Ahora trae una **recomendación** por tramo y un aviso si el dolor muscular es 4 o 5. Los pesos son una propuesta de diseño, no salen de un estudio.
- **Cuerpo (D7):** tabla nueva `medidas` (una por día, Dexie **v6**, solo agrega tabla). Campos: peso (obligatorio) y, opcionales, % de grasa, masa muscular, % de agua, grasa visceral, metabolismo basal y masa ósea. Marca «en mis condiciones habituales»: las medidas de composición hechas en otras condiciones no entran en la tendencia. Progreso → **Cuerpo**: gráfico (promedio de 7 días), tendencia contra hace 4 semanas, objetivo con fecha (ritmo necesario vs actual y aviso si pasa de 1 % del peso por semana), historial con editar y borrar.
- **Perfil y objetivo (Ajustes):** altura, año de nacimiento, peso objetivo, fecha del objetivo y g de proteína por kg (1,6 por defecto, orientativo). La meta de proteína de Hoy sale del último peso.
- **Backup:** incluye `medidas` y el perfil/objetivo; la clave de IA sigue sin viajar.
- **Pruebas: 103** (antes 87): 16 nuevas (preparación v2, check-in, medidas, tendencia, objetivo, proteína, migración v5 → v6 y ida y vuelta del backup). Dos pruebas de la preparación vieja se reescribieron porque los pesos cambiaron.
- No cambió: temporizador, comidas, escáner, Open Food Facts, informe semanal y coach (el coach recibe las 4 partes nuevas de la preparación; no se le envía peso ni medidas).

## v0.8.0 · Entrega 6 · Que no falle ni se pierda nada (01/11/2026)
- **Temporizador nuevo (D5):** usa la hora real (no se atrasa con la pantalla apagada), mantiene la pantalla encendida (Wake Lock, si el navegador lo permite), cuenta «Preparate» de 5 s con pitidos 3-2-1, avisa cada cambio con sonido y vibración, y **sigue corriendo si cambiás de pestaña** (barra chica arriba con pausa/abrir). Sobrevive a recargar la app. El **for time ahora cuenta hacia arriba** con tope, botón «Terminé» y tiempo guardado (`tiempo` en cada registro). EMOM (intervalo) y Tabata (trabajo, descanso, rondas) se pueden ajustar por bloque. Ajustes → «Sonido del temporizador».
- **Backup seguro (D4):** aviso arriba si pasaron 7 días sin backup (o si nunca hiciste uno); «Compartir backup» abre la hoja de compartir del celular (Drive, WhatsApp, correo) y, si no se puede, descarga; el backup ahora incluye tus metas y la sesión en curso (**nunca la clave de IA**); Ajustes muestra cuándo fue el último. Ya se pedía almacenamiento persistente al abrir (no cambia).
- **Agua:** «↶ Deshacer», cantidad libre y «Reiniciar» pide confirmación. Hidratación y Sueño pasan a ancho completo.
- **Uso de IA (D10):** pasó de «Hoy» a Ajustes.
- **Código reordenado (D2):** `src/domain` (lógica pura), `src/data` (base y backup), `src/services` (IA, Open Food Facts, escáner, reloj), `src/features` (pantallas). Formato legible con Prettier (`.prettierrc`). Sin cambios en Dexie (sigue v5).
- **Publicación con GitHub (D3):** `.github/workflows/publicar.yml` (compila, prueba y publica en Cloudflare Pages), `publicar.sh`, `.gitignore`, `.node-version`.
- **Pruebas: 87** (antes 58): temporizador, backup, reloj con navegador simulado, migración desde la v0.5.0 y ida y vuelta del backup con IndexedDB simulada (nueva dependencia de desarrollo: `fake-indexeddb`).
- No cambió: comidas, escáner, Open Food Facts, progreso, coach, puntaje de preparación.

## v0.7.2 · Entrega 5 (ajuste) · Códigos que OFF tiene con otra forma (01/11/2026)
- **Problema:** un producto que sí figuraba en Open Food Facts salió como «no encontrado» al escanearlo.
- **Búsqueda por código más tolerante:** si el código normalizado (EAN-13) no está, prueba la variante con/sin el 0 inicial (UPC-A) y después la API anterior (v0) de OFF. Son 3 consultas como máximo, siempre dentro del límite por minuto. Si no aparece, el «Detalle» dice qué códigos se probaron.
- **Código guardado:** «Crear alimento» después de un código sin resultado ahora guarda el código de barras con el alimento; la próxima vez que lo escanees sale de tu base, sin conexión. Los productos copiados de OFF se guardan siempre con el código normalizado.
- Sin cambios en Dexie (sigue v5). Pruebas: 58.


## v0.7.1 · Entrega 5 (ajuste) · Código no encontrado en OFF (01/11/2026)
- **Arreglo:** Open Food Facts responde HTTP 404 cuando un código de barras no está en su base. La app lo mostraba como «Open Food Facts respondió con error (404). Probá más tarde.»; ahora dice «No encontré ese código en Open Food Facts. Podés cargarlo a mano o con la foto de la etiqueta.»
- Los errores reales del servidor (5xx, límite por minuto, red) siguen mostrando su mensaje con «Detalle». Pruebas: 57.


## v0.7.0 · Entrega 5 · Código de barras con la cámara (01/11/2026)
- **Botón ▮▯▮ junto al buscador de Agregar:** abre la cámara trasera y lee EAN-13, EAN-8 y UPC-A con el lector del navegador (`BarcodeDetector`). Solo acepta códigos con el dígito de control correcto, así que una lectura errónea no gasta consultas.
- Al leer: cierra la cámara, pone el código en el buscador y, si ya está en tu base, lo muestra sin conexión; si no, lo consulta **una sola vez** en Open Food Facts (el resultado se copia a tu base con 🌐 como siempre).
- UPC-A (12 dígitos) se unifica a EAN-13 (con un 0 adelante), igual que lo guarda OFF; también aplica al código tipeado.
- Si el navegador no tiene lector (por ejemplo Firefox o algunos Chrome de escritorio), o no hay permiso o cámara, muestra un mensaje claro y se sigue tipeando el número. La cámara se apaga al cerrar o al cambiar de pantalla.
- Sin cambios en datos ni en Dexie (sigue v5). Pruebas: 56 (7 nuevas, lector con cámara y detector simulados).


## v0.6.1 · Entrega 4 (ajuste) · Diagnóstico de Open Food Facts (01/11/2026)
- Cuando falla una consulta a Open Food Facts, el mensaje ahora agrega un **«Detalle»** técnico: qué dirección falló (`world.openfoodfacts.org/cgi/search.pl`, `search.openfoodfacts.org/search` o `/api/v2/product/…`) y por qué (sin respuesta a tiempo, fallo de red/CORS, HTTP 5xx/4xx, respuesta que no es JSON). En la búsqueda por nombre se listan las dos direcciones probadas.
- Si la consulta tarda más de 12 s, el mensaje lo dice (antes se mostraba como «sin conexión»).
- Sin cambios en datos ni en Dexie (sigue v5). Pruebas: 49 (una nueva).

## v0.6.0 · Entrega 4 · Comidas simplificado + Open Food Facts (01/11/2026)
Opción 2 de la propuesta de simplificación.
- **Una sola entrada «＋ Agregar»** en el Diario: buscador (acepta código de barras tipeado), cámara 📷 (plato o etiqueta) y atajos. La etiqueta ya no te saca del Diario: el alimento se revisa ahí y se agrega a la comida.
- **Recientes y frecuentes** como atajos de un toque, ordenados según el momento del día (veces cargado + doble peso si fue en el mismo momento + 1 si fue esta semana; últimos 90 días). Agregan el alimento con tu **porción habitual** (mediana de tus gramos).
- **Porción en un toque:** ½ · 1 · 1½ · 2 veces tu porción en cada alimento del borrador; los gramos siguen editables.
- **Comidas guardadas** («mi desayuno de siempre»): ⭐ Guardar como habitual (desde el borrador o desde una comida del día), atajo de un toque en Agregar y gestión en Mis alimentos. Al usarla se aplican los valores actuales de tu base.
- **«Repetir» también dentro del mismo día.**
- La pestaña Base pasa a **«Mis alimentos»** (para corregir valores y gestionar comidas guardadas).
- **Respaldo web con Open Food Facts:** botón «🌐 Buscar en la web» (por nombre) y búsqueda por código de barras tipeado (con control del dígito verificador). Solo consulta cuando apretás el botón. Al elegir un resultado se **copia a tu base** con `fuente` y `fuenteId` (código) y una marca 🌐 visible; después funciona sin conexión y lo podés corregir. Se descartan productos sin datos nutricionales o con valores imposibles y se avisa de los dudosos (calorías que no cuadran con los macros). Si OFF no trae calorías pero sí macros, las calcula la app. Atribución ODbL visible en los resultados y en Mis alimentos.
- Cuidado con los límites de OFF: la app se limita sola a 8 búsquedas y 12 lecturas por minuto. No manda cabeceras propias (evita la consulta previa de CORS). Si no hay conexión o el sitio no lo permite, muestra un mensaje claro y todo lo demás sigue funcionando.
- Base de datos **Dexie v5**: agrega la tabla `plantillas` y el índice `fuenteId` en `alimentos`. Entrenos, comidas y backups anteriores quedan intactos; el backup nuevo incluye `plantillas`.
- Pruebas: 48 (17 nuevas: conversión y búsqueda en OFF con red simulada, límites, código de barras, recientes, porciones y comidas guardadas).

## v0.5.0 · Entrega 3 (31/10/2026)
- **Puntaje de preparación** (0 a 100) en Hoy: sueño de anoche 35 %, carga reciente 30 % (razón entre los últimos 7 días y el promedio semanal de 28 días, con RPE × minutos), comida de ayer vs tu meta 20 % e hidratación de ayer 15 %. Si falta un dato, los pesos se reparten entre los que hay y se muestra el % de datos usados; con menos de 2 componentes no calcula. Se mueve en vivo al cargar el sueño. Es una orientación con reglas simples sobre tus datos, no una medición médica.
- **Informe semanal** (Progreso → Informe, lunes a domingo, con ◀ ▶): sesiones, RPE medio, carga, repeticiones y tonelaje con % contra la semana anterior, patrones, récords, sueño, agua y comida (promedios solo de los días con datos). Botón para copiar y, si el navegador lo permite, compartir.
- **Coach IA**: lee el informe y devuelve resumen, lo que salió bien, a mejorar y plan para la semana próxima. Solo recibe números agregados (sin fotos ni nombres de ejercicios). Respuesta saneada, con reintentos y modelo de respaldo como el resto de la IA. Se guarda por semana.
- Base de datos **Dexie v4**: solo agrega la tabla `coach` (clave = lunes de la semana). Entrenos, comidas y backups anteriores quedan intactos; el backup nuevo incluye `coach`.
- Pruebas: 31 (17 nuevas: puntaje, informe y coach). `npm test` ahora corre todos los archivos de `tests/`.

## v0.4.2 · Entrega 2C · Modernización (31/10/2026)
Sin cambios de funciones ni de datos (Dexie sigue en v3; tus entrenos, comidas y backups quedan intactos).
- Stack actualizado: React 18 → 19, Vite 5 → 8, plugin de React 4 → 6, Dexie 4.4.7. Se quitó el reemplazo de `rollup` por WebAssembly (Vite 8 ya no usa rollup). `npm audit`: de 2 vulnerabilidades a 0.
- Tipografías incluidas en la app (paquetes `@fontsource`, solo subconjunto latino): ya no se piden a Google Fonts; funcionan sin conexión desde la primera apertura y no se envía nada a terceros.
- Pide al navegador que **no borre los datos locales** si falta espacio (`navigator.storage.persist`). Ajustes → Versión instalada muestra "Datos protegidos: sí/no".
- Manifest de la PWA: `id`, `scope`, `lang`, `orientation`, descripción, categorías e íconos `any` y `maskable` por separado.
- Service worker: ya no guarda en caché respuestas con error.
- `index.html`: `color-scheme` oscuro, descripción, ícono de Apple y aviso sin JavaScript.
- CSS: corregido un error en la regla de los botones (`font:… inherit` es inválido y el navegador la ignoraba: los botones quedaban en 13 px en vez de 15 px) y ajustado el padding en las tarjetas de media columna para que +250 y +500 sigan lado a lado. Anillo de foco visible, color de los deslizadores, sin resaltado gris al tocar y respeto de "reducir movimiento".
- Se quitó una propiedad inválida (`as="span"`) de un botón en Entreno.
- Requiere Node 20.19 o superior para compilar (`engines`).

## v0.4.1 · Entrega 2C (31/10/2026)
- Diseño nuevo: panel bento y tipografía (Bebas Neue en títulos, Chakra Petch en números y etiquetas, Inter en texto).
- Hoy: tarjeta destacada de calorías arriba; agua y sueño en tarjetas de media columna.
- Solo cambios visuales (estilos, fuentes y orden de Hoy). Sin cambios de datos ni de funciones. Pendiente de compilar y revisar en el celular.

## v0.4.0 · Entrega 2C (31/10/2026)
- Nueva pestaña **Comidas**: diario por día (◀ ▶), meta de kcal, macros (P/C/G) y comidas por momento (desayuno…snack). Editar, borrar y "Repetir hoy".
- **Mi base de alimentos** propia: 69 alimentos iniciales (referencias aproximadas por 100 g), buscador, alta/edición/baja y "Reponer alimentos iniciales".
- **Escáner de platos**: la IA identifica alimentos y gramos estimados; las calorías las calcula la app. Si el alimento está en tu base usa TUS valores; si no, los estimados por la IA (marcados ≈). Todo se revisa antes de guardar.
- **Escáner de etiquetas**: lee la tabla nutricional y crea el alimento convertido a 100 g.
- Controles de coherencia (kcal vs 4P+4C+9G) y de límites; "Guardar en mi base" desde cualquier ítem.
- Hoy muestra las calorías del día. Ajustes: meta de kcal. El backup incluye alimentos y comidas.
- Base de datos Dexie v3 (solo agrega tablas `alimentos` y `comidas`; no toca lo anterior).
- Pruebas automáticas de la lógica: `npm test`.

## v0.3.3 · Entrega 2B (31/10/2026)
- Lectura de pizarra: si Google responde "alta demanda" (error temporal), la app reintenta sola hasta 3 veces y luego prueba con el modelo de respaldo `gemini-flash-latest`. Muestra el avance y un mensaje claro en español.
- Botón "Reintentar con la misma foto" (no hace falta volver a sacarla).

## v0.3.2 · Entrega 2B (31/10/2026)
- Compilación compatible con PCs sin soporte de instrucciones modernas: `rollup` se reemplaza por su versión WebAssembly (`overrides` en `package.json`). Sin cambios en la app.

## v0.3.1 · Entrega 2B (31/10/2026)
- Trazabilidad: versión y entrega visibles en el encabezado y en Ajustes → "Versión instalada" (versión, entrega, fecha y hora de compilación, dirección).
- "Buscar actualización" y aviso automático cuando hay una versión nueva publicada; "Actualizar ahora" limpia la caché y recarga (ya no hace falta abrir la app dos veces).
- El backup exportado incluye `_meta` con la versión que lo generó.
- `version.json` se publica junto con la app.

## v0.3.0 · Entrega 2B (31/10/2026)
- Pestaña Progreso: Semana (volumen por patrón), Historial y Récords (1RM Epley).
- "vs última" en vivo en Entreno y aviso de récords al guardar.

## v0.2.0 · Entrega 2A (31/10/2026)
- Renombre a Mi Mejor Versión, registro de pesos y repeticiones, biblioteca de ejercicios, importar backup.
