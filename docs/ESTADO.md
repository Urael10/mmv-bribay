# ESTADO (se sobrescribe en cada cierre)
Actualizado: 2026-11-26 · alias h · Gemini 4 Hydrogen · esfuerzo alto
Versión (package.json): 0.52.0 · HEAD: 236165e · Árbol: con cambios sin commit
Línea base: npm test 726/726 · build OK · 26/11/2026; se actualiza con la corrida de esta tarea

## Último relevo
Tareas: backup completo y restauración segura (código y tests terminados), ajuste en `Respaldo()` con `role="alert"` en errores y `role="status"` en avisos informativos, actualización de `AGENTS.md` (regla de `restaurar()` y decisiones vigentes) y creación de `docs/ESTADO.md` y `docs/DECISIONES.md`.
Archivos: src/domain/backup.js, src/data/backup.js, src/features/ajustes/Ajustes.jsx, tests/backup-restauracion.test.js, AGENTS.md, docs/ESTADO.md, docs/DECISIONES.md
Revisión por código de Respaldo(): botones con min-height 48 px, error visible (`role="alert"` en errores / `role="status"` informativo), estado de carga, error a mitad con reintento, sin confirm/alert; los botones se nombran por su texto visible, sin aria-label (`<input hidden type="file">` tampoco lleva aria-label).
Prueba manual (usuario): PENDIENTE
No verificado: pantalla Respaldo() renderizada, APK, restauración con un backup antiguo real.

## En curso
(nada)

## Pendientes (orden)
1) Prueba manual de Respaldo() en npm run preview, con un backup válido y otro roto.
2) Commit en prueba (lo decide el usuario). AGENTS.md y docs/ siguen sin seguimiento en git: inclúyelos.
3) Probar exportar e importar backup en el APK.

## Plantilla de relevo
RELEVO · AAAA-MM-DD · alias · modelo · esfuerzo
Tarea y alcance:
Estado: TERMINADA | A MEDIAS (en qué paso)
HEAD y árbol: <hash> · limpio | con cambios (lista)
Verificado: npm test N/N · build OK o no · manual: sí o no (qué)
NO verificado:
Decisiones (→ DECISIONES.md):
Pendientes (orden):
Siguiente sesión: tipo · modelo · esfuerzo
Cuota (grupo: % antes → después): Gemini … · Claude/GPT …
