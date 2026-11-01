# Historial de versiones de MMV

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
