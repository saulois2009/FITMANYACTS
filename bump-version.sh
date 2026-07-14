#!/bin/bash
# bump-version.sh
# Sube automáticamente el número de versión en:
#   - service-worker.js  (CACHE_NAME)
#   - index.html         (?v=... en <script>/<link> y el texto del versionLabel)
#
# Uso:
#   ./bump-version.sh
#   (si es la primera vez, dale permiso de ejecución con: chmod +x bump-version.sh)
#
# Corre esto ANTES de "firebase deploy" cada vez que cambies
# app.js, storage.js, game.js, firebase-init.js o styles.css.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SW_FILE="$DIR/service-worker.js"
HTML_FILE="$DIR/index.html"

# Versión única basada en fecha/hora: 202607142316 (sin prefijo v)
VNUM="$(date +%Y%m%d%H%M)"
VERSION="v${VNUM}"

if [ ! -f "$SW_FILE" ]; then
    echo "❌ No se encontró service-worker.js en $DIR"
    exit 1
fi
if [ ! -f "$HTML_FILE" ]; then
    echo "❌ No se encontró index.html en $DIR"
    exit 1
fi

echo ""
echo "🚀 Subiendo versión a: $VERSION"
echo ""

# --- service-worker.js: CACHE_NAME = 'vXXXX'; ---
sed -i.bak -E "s/const CACHE_NAME = '[^']*';/const CACHE_NAME = '${VERSION}';/" "$SW_FILE"
rm -f "$SW_FILE.bak"
echo "✅ service-worker.js -> CACHE_NAME = '${VERSION}'"

# --- index.html: todos los ?v=ALGO ---
sed -i.bak -E "s/\?v=[A-Za-z0-9._-]+/?v=${VNUM}/g" "$HTML_FILE"
echo "✅ index.html -> referencias ?v= actualizadas"

# --- index.html: versionLabel">vALGO ---
sed -i.bak -E "s/(id=\"versionLabel\">)v[A-Za-z0-9._-]*/\1${VERSION}/" "$HTML_FILE"
rm -f "$HTML_FILE.bak"
echo "✅ index.html -> versionLabel = ${VERSION}"

echo ""
echo "🎉 Listo. Ahora corre: firebase deploy"
echo ""
