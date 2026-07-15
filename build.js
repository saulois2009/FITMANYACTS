// build.js
// Genera la carpeta dist/ lista para "firebase deploy":
//   1. Copia todo el sitio (html, css, imágenes, manifest, service-worker, etc.)
//   2. Ofusca app.js, storage.js, game.js y firebase-init.js dentro de dist/
//
// El código fuente (raíz del repo) queda intacto y legible para ti/GitHub.
// Solo lo que se sube a Firebase Hosting (dist/) queda ofuscado.
//
// Uso:
//   npm run build
//   (o directamente: node build.js)

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Archivos/carpetas que NO se copian a dist/ (herramientas de desarrollo,
// no son parte del sitio que ve el usuario)
const EXCLUDE = new Set([
    'dist', 'node_modules', '.git', '.github',
    'build.js', 'package.json', 'package-lock.json',
    'bump-version.sh', 'firestore.rules',
    '.firebaserc', '.gitignore', 'firebase.json',
    'README.md'
]);

// Archivos JS de la app que se ofuscan (no libs de terceros)
const JS_A_OFUSCAR = ['app.js', 'storage.js', 'game.js', 'firebase-init.js'];

const OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: false, // false = más rápido en runtime, suficiente para disuadir copy-paste casual
    deadCodeInjection: false,
    stringArray: true,
    stringArrayThreshold: 0.75,
    rotateStringArray: true,
    // CRÍTICO: los archivos se cargan como <script> normales (no módulos) y
    // comparten variables globales entre sí (storage, window.db, funciones
    // llamadas desde otros archivos). Si esto se pone en true, el sitio se rompe.
    renameGlobals: false,
    identifierNamesGenerator: 'hexadecimal',
    selfDefending: false
};

function limpiarDist() {
    if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });
}

function copiarSitio() {
    for (const nombre of fs.readdirSync(ROOT)) {
        if (EXCLUDE.has(nombre)) continue;
        const origen = path.join(ROOT, nombre);
        const destino = path.join(DIST, nombre);
        fs.cpSync(origen, destino, { recursive: true });
    }
}

function ofuscarJS() {
    for (const archivo of JS_A_OFUSCAR) {
        const ruta = path.join(DIST, archivo);
        if (!fs.existsSync(ruta)) {
            console.warn(`⚠️  No se encontró ${archivo}, se omite.`);
            continue;
        }
        const codigo = fs.readFileSync(ruta, 'utf8');
        const resultado = JavaScriptObfuscator.obfuscate(codigo, OBFUSCATOR_OPTIONS);
        fs.writeFileSync(ruta, resultado.getObfuscatedCode());
        console.log(`✅ Ofuscado: ${archivo}`);
    }
}

console.log('🚀 Generando dist/ ...');
limpiarDist();
copiarSitio();
ofuscarJS();
console.log('🎉 Listo. Ahora corre: firebase deploy');
