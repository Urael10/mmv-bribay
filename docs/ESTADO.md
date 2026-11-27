# ESTADO (se sobrescribe en cada cierre)
Actualizado: 2026-11-27 · alias h · Claude Sonnet 4.6 · esfuerzo bajo
Versión (package.json): 0.52.0 · HEAD: 0de6d7a · Árbol: limpio
Línea base: npm test 726/726 · build OK · 27/11/2026

## Último relevo
Tarea: recuperación de sesión cortada — commit de backup completo y restauración segura + prueba manual aprobada.
Archivos: src/domain/backup.js, src/data/backup.js, src/features/ajustes/Ajustes.jsx, tests/backup-restauracion.test.js, AGENTS.md, docs/ESTADO.md, docs/DECISIONES.md
Commits: 0896ae4 «feat(backup): backup completo y restauración segura» · 0de6d7a «docs: actualizar ESTADO.md»
Prueba manual (usuario): ✅ OK — exportar backup válido, importar válido, importar archivo roto, estado de carga y botones 48 px; sin alert/confirm.
No verificado: restauración con un backup antiguo real · APK.

## En curso
(nada)

## Pendientes (orden)
1) Probar exportar e importar backup en el APK.

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
