# ESTADO (se sobrescribe en cada cierre)
Actualizado: 2026-11-27 · alias h · Claude Sonnet 4.6 · esfuerzo bajo
Versión (package.json): 0.52.0 · HEAD: 0896ae4 · Árbol: limpio
Línea base: npm test 726/726 · build OK · 27/11/2026

## Último relevo
Tarea: recuperación de sesión cortada — se verificó coherencia del árbol, se corrieron tests y build, y se hizo el commit pendiente de la sesión anterior.
Archivos: src/domain/backup.js, src/data/backup.js, src/features/ajustes/Ajustes.jsx, tests/backup-restauracion.test.js, AGENTS.md, docs/ESTADO.md, docs/DECISIONES.md
Commit: 0896ae4 «feat(backup): backup completo y restauración segura»
Prueba manual (usuario): PENDIENTE
No verificado: pantalla Respaldo() renderizada, APK, restauración con un backup antiguo real.

## En curso
(nada)

## Pendientes (orden)
1) Prueba manual de Respaldo() en npm run preview, con un backup válido y otro roto.
2) Probar exportar e importar backup en el APK.

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
