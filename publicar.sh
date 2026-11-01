#!/bin/sh
# Uso (desde la carpeta del repositorio): ./publicar.sh ~/Descargas/mmv-vX.Y.Z-CODIGO.zip "texto del cambio" [rama]
# Reemplaza el código por el del zip (incluye borrar archivos que ya no existen), lo sube a GitHub
# y GitHub compila, prueba y publica solo. La rama por defecto es main (producción); usá "prueba" para probar antes.
set -e
zip="$1"; msg="${2:-Entrega}"; rama="${3:-main}"
[ -f "$zip" ] || { echo "No encuentro el archivo: $zip"; exit 1; }
[ -d .git ] || { echo "Ejecutalo dentro de la carpeta del repositorio (donde está .git)."; exit 1; }
git checkout "$rama" 2>/dev/null || git checkout -b "$rama"
tmp=$(mktemp -d)
unzip -q "$zip" -d "$tmp"
[ -f "$tmp/package.json" ] || tmp="$tmp/$(ls "$tmp" | head -1)"
[ -f "$tmp/package.json" ] || { echo "El zip no parece ser el -CODIGO.zip de MMV."; exit 1; }
# borra lo anterior (menos .git, node_modules, dist y este script) y copia el código nuevo
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name node_modules ! -name dist ! -name publicar.sh -exec rm -rf {} +
cp -a "$tmp"/. ./
git add -A
git commit -m "$msg" || { echo "No hay cambios para subir."; exit 0; }
git push -u origin "$rama"
echo "Listo. Mirá el avance en la pestaña Actions de tu repositorio en GitHub."
