# AGENTS.md — Mi Mejor Versión (MMV)

App personal, local-first, de un solo usuario y un solo dispositivo: entrenamientos, nutrición, hábitos y analítica asistida por IA (Gemini). React + Vite en JavaScript (sin TypeScript). Datos en IndexedDB (Dexie). Se publica como PWA en Cloudflare Pages (`mmv-bribay.pages.dev`) y existe un empaquetado Android con Capacitor (`android/`). Versiones y dependencias: lee `package.json`. Comunícate en español; el código sigue el idioma que ya use el repo.

## Comandos
- Usa solo scripts que existan en `package.json`; nunca inventes uno.
- Instalar: `npm ci` (`npm install` solo al añadir un paquete). `node_modules` debe ser una carpeta real, no un enlace simbólico.
- Desarrollo: `npm run dev`. Vista previa del build: `npm run preview`.
- Verificación: `npm test` y `npm run build`. No hay lint ni TypeScript: no los añadas sin que se pida.
- `npm run cap:sync` y `npm run android:build` solo cuando se pidan.

## Definición de terminado
1. `npm test` y `npm run build` pasan. Si no pudiste ejecutarlos, dilo explícitamente.
2. Si tocaste PWA, Vite o `public/sw.js`: `npm run build && npm run preview` y comprueba carga sin red y actualización de versión.
3. Si tocaste Dexie o el backup: añade o ajusta tests con `fake-indexeddb` que cubran la migración desde la versión anterior y la restauración.
4. Informa qué verificaste y qué no. No digas que algo funciona si no lo ejecutaste.

## Ramas y commits
- Se trabaja en la rama `prueba`; `main` es producción. No hagas commits directamente en `main` salvo que se pida.
- Cada permiso de commit vale para un solo commit, incluidos los de documentación. El permiso de push se pide aparte.

## Datos (Dexie)
- El esquema vive en `src/data/db.js` con versiones incrementales. Nunca edites una versión publicada: añade `db.version(n+1)` con `upgrade` explícito. Varios tests fijan la versión (`verno`): al subirla, actualízalos (`grep -rn verno src`).
- Convención actual: los componentes de `src/features/` pueden leer y escribir Dexie. El esquema, las migraciones y el backup viven solo en `src/data/` y `src/domain/backup.js`. No refactorices accesos existentes a repositorios sin que se pida.
- Los datos son irremplazables (un dispositivo, sin servidor). Pide confirmación antes de cualquier cambio que borre tablas, campos o datos, o cambie claves primarias.
- Backup: toda tabla nueva entra en el export. Para toda preferencia nueva en localStorage (`mv_*`) decide explícitamente si entra en el backup (lista `AJUSTES` en `src/domain/backup.js`). `mv_key` nunca entra.
- Decisiones vigentes: `mapa_osm` queda fuera del backup a propósito (lo fija `tests/entrega27.test.js`) y `entrada` también; `ruta_ocultar`, `metapasos` y `alarmasueno` sí entran. No las vuelvas a proponer sin que se pida.
- `restaurar()` valida todo el archivo antes de escribir; reemplaza en una sola transacción únicamente las tablas que el backup trae (una tabla ausente deja la local intacta; los backups antiguos con tablas ausentes o campos extra son válidos); la tabla cifrada privada solo se reemplaza si la clave coincide; todo cambio aquí lleva test con `fake-indexeddb`.
- Fechas: el "día" de un registro es una fecha local `YYYY-MM-DD` (no derivada de UTC); los instantes son timestamps. No los mezcles.
- Unidades: guarda en una unidad canónica (kg, kcal, cm, ml, g) y convierte solo al mostrar.
- Valida los datos al leerlos: pueden venir de versiones antiguas o de un import.

## IA y privacidad
- La IA es Gemini, llamada desde el cliente con la clave del propio usuario, guardada en localStorage (`mv_key`). Nunca pongas claves en el repo, en `.env*` ni en variables `VITE_*`.
- En código nuevo envía la clave en el header `x-goog-api-key`, no en la URL.
- Los datos de salud solo salen del dispositivo por acción explícita del usuario y con el mínimo necesario: agregados numéricos, nunca nombres de ejercicios o comidas, notas, trazos GPS ni el módulo cifrado privado. Toda acción nueva que envíe datos muestra antes qué se envía.
- Toda llamada nueva a la IA lleva timeout (`AbortController`) y no añade reintentos automáticos sin confirmación (el cupo es limitado).
- Nunca imprimas valores de secretos. Sin telemetría, analytics ni SDKs de terceros sin confirmación.

## PWA, Android y despliegue
- `public/sw.js` es sensible: el nombre de caché es estático y no hay precaché. Cambia el service worker solo en una tarea aparte, con plan de prueba offline y de actualización.
- Cuida el fallback SPA de Cloudflare Pages: un asset antiguo inexistente puede devolver HTML con 200 y romper la carga.
- El despliegue lo hace `.github/workflows/publicar.yml`: asume que un push a `main` puede desplegar.
- No hagas `git commit` ni `git push` salvo que se pida.

## Diseño y UX (mobile-first, uso diario)
- Tema oscuro único (intencional): no añadas tema claro salvo que se pida. El acceso ✨ Maqueta también es intencional: no lo quites.
- Registro rápido: las acciones frecuentes (anotar serie, comida, marcar hábito) en 3 toques o menos, usables con una mano, con el último valor precargado.
- Offline es el estado normal: nunca muestres errores de red para funciones locales.
- No pierdas datos: autoguarda una sesión en curso. En código nuevo, borrar es "deshacer" con UI propia: no añadas `confirm()`, `alert()` ni `prompt()`.
- Controles nuevos: objetivos de 44 px o más, inputs de 16 px o más, `inputMode` numérico para peso/reps/kcal, `label` o `aria-label` en todo control, safe areas (también laterales).
- Respeta `prefers-reduced-motion` también en JS (por ejemplo scroll suave).
- Cada pantalla define estado vacío, de carga y de error. Las lecturas de Dexie llevan `.catch()` con error visible.
- Reutiliza los componentes y tokens existentes (`src/tokens.css`, `src/styles.css`). Sin librerías de UI nuevas sin confirmación.

## Alcance
- Cambios acotados a lo pedido. No refactorices módulos no relacionados.
- No añadas dependencias pesadas sin justificarlas.

## Pide confirmación antes de tocar
- `.github/workflows/*` y parámetros de despliegue de Cloudflare Pages.
- `android/` (manifest, firma, backup de Android) y `capacitor.config.ts`.
- Esquemas Dexie con migración destructiva o riesgo de pérdida de datos.
- `.env*` y cualquier archivo con secretos, tokens o claves.
- Eliminar módulos, rutas o funcionalidades.

## Cuándo detenerte y preguntar
Si el cambio afecta al esquema de datos, al flujo offline/PWA, a la IA o a la privacidad, o si hay ambigüedad funcional: detente y propón 2-3 opciones breves con su trade-off.
