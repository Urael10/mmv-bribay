# DECISIONES (acumulativo; no se borra)
D-001 · 2026-11-26 · mapa_osm NO viaja en el backup: apagado por defecto y fijado por tests/entrega27.test.js. No proponerlo de nuevo sin petición.
D-002 · 2026-11-26 · mv_entrada NO viaja en el backup (solo recuerda el último método de inicio de Entreno).
D-003 · 2026-11-26 · Sí viajan metapasos, alarmasueno y ruta_ocultar. ruta_ocultar guarda '1' o '0' (string); '0' sobrevive al ida y vuelta y Rutas.jsx lo lee con !== '0'. mv_key nunca viaja.
D-004 · 2026-11-26 · restaurar() valida todo antes de escribir y reemplaza en una sola transacción solo las tablas que trae el archivo (tabla ausente = local intacta). Los backups antiguos (tablas ausentes, campos extra) son válidos. privado solo se reemplaza si el backup es de la misma clave local o no hay clave; localStorage y EVENTO_RESTAURADO se aplican después de cerrar la transacción.
D-005 · 2026-11-27 · Siguiente tarea elegida: opción B (pantalla de arranque personalizada). Faltan definir y aprobar los detalles de implementación.
D-006 · 2026-11-28 · El backup en el APK funciona con @capacitor/filesystem y @capacitor/share ya instalados; no se aplican la Opción A (input sin accept y mensaje de error real) ni las opciones B y C salvo que vuelva a fallar. No volver a proponerlas sin que se pida.
