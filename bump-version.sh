#!/bin/bash
# bump-version.sh
# Sube automáticamente el número de versión SOLO en:
#   - index.html  (?v=... en <script>/<link>, para evitar el problema de caché)
#
# CACHE_NAME (service-worker.js) y versionLabel (index.html) son MANUALES:
# los editas tú directamente cuando quieras.
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

# Número de versión:
# - Si se corre desde GitHub Actions, usa VERSION_OVERRIDE (número consecutivo simple: 39, 40, 41...)
# - Si se corre local (en tu compu), usa fecha/hora como respaldo
if [ -n "$VERSION_OVERRIDE" ]; then
    VNUM="$VERSION_OVERRIDE"
else
    VNUM="$(date +%Y%m%d%H%M)"
fi
VERSION="v${VNUM}"

if [ ! -f "$HTML_FILE" ]; then
    echo "❌ No se encontró index.html en $DIR"
    exit 1
fi

echo ""
echo "🚀 Subiendo versión a: $VERSION"
echo ""

# --- index.html: todos los ?v=ALGO ---
sed -i.bak -E "s/\?v=[A-Za-z0-9._-]+/?v=${VNUM}/g" "$HTML_FILE"
rm -f "$HTML_FILE.bak"
echo "✅ index.html -> referencias ?v= actualizadas"

# Nota: el versionLabel visible en el menú NO se toca aquí a propósito,
# para que puedas editarlo tú manualmente cuando quieras.

echo ""
echo "🎉 Listo. Ahora corre: firebase deploy"
echo ""
