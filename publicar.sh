#!/bin/sh
# Uso (desde la carpeta del repositorio): ./publicar.sh ~/Descargas/mmv-vX_Y_Z-CODIGO.zip "texto del cambio" [rama]
# Reemplaza el código por el del zip (incluye borrar archivos que ya no existen), lo sube a GitHub
# y GitHub compila, prueba y publica solo. La rama por defecto es main (producción); usá "prueba" para probar antes.
# El nombre del zip puede escribirse con puntos (v0.32.0) o con guiones bajos (v0_32_0): se prueban ambos.
set -e
# Todo va dentro de una función para que el script pueda reemplazarse a sí mismo sin romperse a mitad de la ejecución.
main() {
  self=$(mktemp); cp "$0" "$self"
  zip="$1"; msg="${2:-Entrega}"; rama="${3:-main}"
  if [ ! -f "$zip" ]; then
    alt1=$(printf '%s' "$zip" | sed -E 's/v([0-9]+)\.([0-9]+)\.([0-9]+)/v\1_\2_\3/')
    alt2=$(printf '%s' "$zip" | sed -E 's/v([0-9]+)_([0-9]+)_([0-9]+)/v\1.\2.\3/')
    if [ -f "$alt1" ]; then zip="$alt1"; elif [ -f "$alt2" ]; then zip="$alt2"; fi
  fi
  [ -f "$zip" ] || { echo "No encuentro el archivo: $1"; exit 1; }
  [ -d .git ] || { echo "Ejecutalo dentro de la carpeta del repositorio (donde está .git)."; exit 1; }
  echo "Zip: $zip · Rama: $rama · Mensaje: $msg"
  if [ "$rama" = "main" ]; then
    printf 'Esto publica en PRODUCCIÓN (main). ¿Seguimos? [s/N] '
    read -r r
    case "$r" in s|S|si|SI|sí) ;; *) echo "Cancelado. Probá primero con: $0 \"$zip\" \"$msg\" prueba"; exit 1;; esac
  fi
  git checkout "$rama" 2>/dev/null || git checkout -b "$rama"
  tmp=$(mktemp -d)
  unzip -q "$zip" -d "$tmp"
  [ -f "$tmp/package.json" ] || tmp="$tmp/$(ls "$tmp" | head -1)"
  [ -f "$tmp/package.json" ] || { echo "El zip no parece ser el -CODIGO.zip de MMV."; exit 1; }
  # borra lo anterior (menos .git, node_modules, dist y este script) y copia el código nuevo
  find . -mindepth 1 -maxdepth 1 ! -name .git ! -name node_modules ! -name dist ! -name publicar.sh -exec rm -rf {} +
  cp -a "$tmp"/. ./
  # el zip trae su propio publicar.sh (viejo): se vuelve a poner este, que es el que corre
  cp "$self" ./publicar.sh
  git add -A
  git commit -m "$msg" || { echo "No hay cambios para subir."; exit 0; }
  git push -u origin "$rama" || { echo "No se pudo subir a GitHub. El cambio quedó guardado en la rama local $rama; revisá tu conexión o permisos y repetí: git push -u origin $rama"; exit 1; }
  echo "Listo. Mirá el avance en la pestaña Actions de tu repositorio en GitHub."
}
main "$@"
exit $?
