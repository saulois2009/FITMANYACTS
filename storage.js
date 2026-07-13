// storage.js - Datos en Firestore (Firebase)
// Requiere que firebase-init.js haya inicializado window.db antes

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

function obtenerFechaHoy() {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const d = String(hoy.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function sumarMeses(fechaStr, n) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const diaOrig = fecha.getDate();
    fecha.setMonth(fecha.getMonth() + n);
    if (fecha.getDate() !== diaOrig) fecha.setDate(0);
    return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
}

function membresiaVigente(usuario) {
    if (usuario.rol !== 'usuario') return true;
    if (!usuario.membresia_vence) return false;
    return usuario.membresia_vence >= obtenerFechaHoy();
}

// Acceso rápido a Firestore (lazy: se resuelve en cada llamada para que no falle antes de firebase-init.js)
function getDB() { return window.db; }
function collection(...a) { return window.firestoreSDK.collection(...a); }
function doc(...a)        { return window.firestoreSDK.doc(...a); }
function getDoc(...a)     { return window.firestoreSDK.getDoc(...a); }
function getDocs(...a)    { return window.firestoreSDK.getDocs(...a); }
function setDoc(...a)     { return window.firestoreSDK.setDoc(...a); }
function updateDoc(...a)  { return window.firestoreSDK.updateDoc(...a); }
function deleteDoc(...a)  { return window.firestoreSDK.deleteDoc(...a); }
function query(...a)      { return window.firestoreSDK.query(...a); }
function where(...a)      { return window.firestoreSDK.where(...a); }
function addDoc(...a)     { return window.firestoreSDK.addDoc(...a); }

// ─── SESIÓN LOCAL (solo en este dispositivo) ──────────────────────────────────
// El usuario actual sigue en localStorage porque es solo una preferencia local

const CURRENT_USER_KEY = 'fitmanyacts_usuario_actual';

function guardarUsuarioActual(usuario) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(usuario));
}

function obtenerUsuarioActual() {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
}

function cerrarSesion() {
    localStorage.removeItem(CURRENT_USER_KEY);
    if (window.authSDK) window.authSDK.signOut().catch(() => {});
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

async function obtenerTodosUsuarios() {
    const snap = await getDocs(collection(getDB(), 'usuarios'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function buscarUsuarioPorEmail(email) {
    const q = query(collection(getDB(), 'usuarios'), where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
}

async function validarLogin(email, contraseña) {
    try {
        await window.authSDK.signInWithEmailAndPassword(email, contraseña);
        const usuario = await buscarUsuarioPorEmail(email);
        return usuario || null;
    } catch (err) {
        console.warn('Login fallido:', err.code);
        return null;
    }
}

async function registrarUsuario(datos) {
    if (!datos.nombre || !datos.email || !datos.contraseña || !datos.rol) {
        return { exito: false, error: 'Faltan datos obligatorios' };
    }
    try {
        const cred = await window.authSDK.createUserWithEmailAndPassword(datos.email, datos.contraseña);
        const uid = cred.user.uid;
        const nuevoUsuario = {
            uid,
            nombre: datos.nombre,
            email: datos.email.toLowerCase(),
            rol: datos.rol,
            estado: 'activo',
            fecha_registro: obtenerFechaHoy()
        };
        if (datos.rol === 'usuario') {
            nuevoUsuario.membresia_vence = sumarMeses(obtenerFechaHoy(), 1);
        }
        const ref = doc(getDB(), 'usuarios', uid);
        await setDoc(ref, nuevoUsuario);
        return { exito: true, usuario: { id: uid, ...nuevoUsuario } };
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            return { exito: false, error: 'Este email ya está registrado' };
        }
        return { exito: false, error: err.message };
    }
}

async function obtenerCoaches() {
    const q = query(collection(getDB(), 'usuarios'), where('rol', '==', 'entrenador'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerMiembros() {
    const q = query(collection(getDB(), 'usuarios'), where('rol', '==', 'usuario'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function crearCoach(datos) {
    if (!datos.nombre || !datos.email) {
        return { exito: false, error: 'Por favor completa nombre y email' };
    }
    const existente = await buscarUsuarioPorEmail(datos.email);
    if (existente) return { exito: false, error: 'Este email ya esta registrado' };

    const passwordTemporal = generarPasswordTemporal();

    try {
        const secondApp = firebase.apps.find(a => a.name === 'secondary')
            || firebase.initializeApp(window._firebaseConfig, 'secondary');
        const secondAuth = secondApp.auth();
        const cred = await secondAuth.createUserWithEmailAndPassword(datos.email, passwordTemporal);
        const uid = cred.user.uid;
        await secondAuth.signOut();

        const nuevoCoach = {
            uid,
            nombre: datos.nombre,
            email: datos.email.toLowerCase(),
            rol: 'entrenador',
            estado: 'pendiente',
            fecha_registro: obtenerFechaHoy()
        };
        const ref = doc(getDB(), 'usuarios', uid);
        await setDoc(ref, nuevoCoach);
        return { exito: true, passwordTemporal, usuario: { id: uid, ...nuevoCoach } };
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            return { exito: false, error: 'Este email ya esta registrado' };
        }
        return { exito: false, error: err.message };
    }
}

async function eliminarCoach(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists || snap.data().rol !== 'entrenador') {
        return { exito: false, error: 'Coach no encontrado' };
    }
    await deleteDoc(ref);
    return { exito: true };
}

async function eliminarMiembro(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists || snap.data().rol !== 'usuario') {
        return { exito: false, error: 'Miembro no encontrado' };
    }
    await deleteDoc(ref);
    // Eliminar reservas
    const q = query(collection(getDB(), 'reservas'), where('usuarioId', '==', usuarioId));
    const reservasSnap = await getDocs(q);
    for (const r of reservasSnap.docs) await deleteDoc(r.ref);
    return { exito: true };
}

async function activarMembresia(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists) return { exito: false, error: 'Usuario no encontrado' };
    const usuario = snap.data();
    if (usuario.rol !== 'usuario') return { exito: false, error: 'Este usuario no tiene membresía' };

    const hoy = obtenerFechaHoy();
    const base = (usuario.membresia_vence && usuario.membresia_vence >= hoy) ? usuario.membresia_vence : hoy;
    const nuevaFecha = sumarMeses(base, 1);
    await updateDoc(ref, { membresia_vence: nuevaFecha });
    return { exito: true, nuevaFecha };
}

async function desactivarMembresia(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists) return { exito: false, error: 'Usuario no encontrado' };

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = `${ayer.getFullYear()}-${String(ayer.getMonth()+1).padStart(2,'0')}-${String(ayer.getDate()).padStart(2,'0')}`;
    await updateDoc(ref, { membresia_vence: fechaAyer });
    return { exito: true };
}

// ─── EXPORT GLOBAL (para que app.js siga funcionando igual) ───────────────────
// En vez de `storage.metodo()` ahora se llama directamente `await metodo()`
// pero para no reescribir app.js, creamos el objeto storage con las mismas firmas

// ─── INVITACIÓN DE MIEMBROS ───────────────────────────────────────────────────

function generarPasswordTemporal() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    return pass;
}

async function invitarMiembro(nombre, email) {
    if (!nombre || !email) return { exito: false, error: 'Nombre y email son requeridos' };
    email = email.toLowerCase().trim();

    const existente = await buscarUsuarioPorEmail(email);
    if (existente) return { exito: false, error: 'Este email ya está registrado' };

    const passwordTemporal = generarPasswordTemporal();

    try {
        // Usar segunda app de Firebase para no cerrar sesión del coach
        const secondApp = firebase.apps.find(a => a.name === 'secondary') 
            || firebase.initializeApp(window._firebaseConfig, 'secondary');
        const secondAuth = secondApp.auth();
        const cred = await secondAuth.createUserWithEmailAndPassword(email, passwordTemporal);
        const uid = cred.user.uid;
        await secondAuth.signOut();

        const nuevoMiembro = {
            uid,
            nombre,
            email,
            rol: 'usuario',
            estado: 'pendiente',
            fecha_registro: obtenerFechaHoy(),
            membresia_vence: sumarMeses(obtenerFechaHoy(), 1)
        };
        await setDoc(doc(getDB(), 'usuarios', uid), nuevoMiembro);

        return { exito: true, passwordTemporal, nombre };
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            return { exito: false, error: 'Este email ya está registrado en el sistema' };
        }
        return { exito: false, error: err.message };
    }
}

async function cambiarPasswordPrimeraVez(nuevaPassword) {
    try {
        const user = window.auth.currentUser;
        if (!user) return { exito: false, error: 'No hay sesión activa' };
        await user.updatePassword(nuevaPassword);
        const usuario = await buscarUsuarioPorEmail(user.email);
        if (usuario) {
            const ref = window.db.collection('usuarios').doc(usuario.id);
            await ref.update({ estado: 'activo' });
        }
        return { exito: true };
    } catch (err) {
        return { exito: false, error: err.message };
    }
}


// ─── ESTADÍSTICAS PARA REPORTE ───────────────────────────────────────────────

async function obtenerEstadisticas() {
    const hoy = obtenerFechaHoy();
    const [y, m] = hoy.split('-').map(Number);
    const inicioMes = `${y}-${String(m).padStart(2,'0')}-01`;

    // Fechas de la semana actual
    const ahora = new Date();
    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(ahora);
        d.setDate(ahora.getDate() - ahora.getDay() + i);
        diasSemana.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }

    // Fecha en 7 días para membresías por vencer
    const en7dias = new Date();
    en7dias.setDate(en7dias.getDate() + 7);
    const fecha7dias = `${en7dias.getFullYear()}-${String(en7dias.getMonth()+1).padStart(2,'0')}-${String(en7dias.getDate()).padStart(2,'0')}`;

    // Todos los usuarios
    const todosUsuarios = await obtenerTodosUsuarios();
    const miembros = todosUsuarios.filter(u => u.rol === 'usuario');
    const coaches = todosUsuarios.filter(u => u.rol === 'entrenador' && u.estado === 'activo');

    const miembrosActivos = miembros.filter(u => u.estado === 'activo').length;
    const miembrosInactivos = miembros.filter(u => u.estado === 'inactivo').length;
    const miembrosPendientes = miembros.filter(u => u.estado === 'pendiente').length;
    const miembrosNuevos = miembros.filter(u => u.fecha_registro >= inicioMes).length;

    // Membresías por vencer en 7 días
    const porVencer = miembros.filter(u => 
        u.estado === 'activo' && u.membresia_vence && 
        u.membresia_vence >= hoy && u.membresia_vence <= fecha7dias
    );

    // Reservas de la semana
    const snapReservas = await getDocs(getDB().collection('reservas'));
    const todasReservas = snapReservas.docs.map(d => ({ id: d.id, ...d.data() }));
    const reservasSemana = todasReservas.filter(r => diasSemana.includes(r.fecha));

    // Clase más popular
    const conteoHoras = {};
    reservasSemana.forEach(r => {
        conteoHoras[r.hora] = (conteoHoras[r.hora] || 0) + 1;
    });
    const clasePopular = Object.entries(conteoHoras).sort((a, b) => b[1] - a[1])[0];

    // Ocupación promedio (cupo máximo 20 por clase, 6 horarios por día, 5 días)
    const clasesTotalesSemana = 6 * 5;
    const ocupacionMax = clasesTotalesSemana * 20;
    const ocupacionPct = ocupacionMax > 0 ? Math.round((reservasSemana.length / ocupacionMax) * 100) : 0;

    // Reto 90 días
    const snapReto = await getDocs(getDB().collection('reto90'));
    const totalReto = snapReto.docs.length;

    return {
        miembrosActivos,
        miembrosInactivos,
        miembrosPendientes,
        miembrosNuevos,
        porVencer,
        totalReservasSemana: reservasSemana.length,
        ocupacionPct,
        clasePopular: clasePopular ? `Clase mas popular: ${clasePopular[0]} hrs (${clasePopular[1]} reservas)` : 'Sin reservas esta semana',
        totalCoaches: coaches.length,
        totalReto
    };
}


async function obtenerInscripcionesPorRango(rango) {
    const todos = await obtenerTodosUsuarios();
    const miembros = todos.filter(u => u.rol === 'usuario' && u.fecha_registro);

    const hoy = new Date();
    let labels = [];
    let datos = [];

    if (rango === 'semana') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            const fecha = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dia = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
            labels.push(dia);
            datos.push(miembros.filter(m => m.fecha_registro === fecha).length);
        }
    } else if (rango === 'mes') {
        for (let i = 29; i >= 0; i--) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            const fecha = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dia = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            labels.push(dia);
            datos.push(miembros.filter(m => m.fecha_registro === fecha).length);
        }
    } else if (rango === 'anio') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const mes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
            labels.push(label);
            datos.push(miembros.filter(m => m.fecha_registro && m.fecha_registro.startsWith(mes)).length);
        }
    } else { // todo
        if (miembros.length === 0) return { labels: [], datos: [] };
        const fechas = miembros.map(m => m.fecha_registro).sort();
        const inicio = new Date(fechas[0]);
        const meses = [];
        const d = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
        while (d <= hoy) {
            const mes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
            meses.push({ mes, label });
            d.setMonth(d.getMonth() + 1);
        }
        labels = meses.map(m => m.label);
        datos = meses.map(m => miembros.filter(u => u.fecha_registro && u.fecha_registro.startsWith(m.mes)).length);
    }

    return { labels, datos };
}


const storage = {
    // Sesión
    guardarUsuarioActual,
    obtenerUsuarioActual,
    cerrarSesion,
    obtenerEstadisticas,
    obtenerInscripcionesPorRango,
    invitarMiembro,
    cambiarPasswordPrimeraVez,
    // Usuarios
    obtenerTodosUsuarios,
    buscarUsuarioPorEmail,
    validarLogin,
    registrarUsuario,
    obtenerCoaches,
    obtenerMiembros,
    crearCoach,
    eliminarCoach,
    eliminarMiembro,
    activarMembresia,
    desactivarMembresia,
    membresiaVigente,
    obtenerFechaHoy,
    sumarMeses,
    // (Las demás secciones se agregarán en las siguientes partes)
};

// ─── HORARIOS DE CLASES (constantes, no van a Firestore) ──────────────────────

const HORARIOS_CLASES = [
    { hora: '05:00', etiqueta: '5:00-6:00 AM' },
    { hora: '06:00', etiqueta: '6:00-7:00 AM' },
    { hora: '07:30', etiqueta: '7:30-8:30 AM' },
    { hora: '09:00', etiqueta: '9:00-10:00 AM' },
    { hora: '10:00', etiqueta: '10:00-11:00 AM' },
    { hora: '17:00', etiqueta: '5:00-6:00 PM' },
    { hora: '18:00', etiqueta: '6:00-7:00 PM' },
    { hora: '19:00', etiqueta: '7:00-8:00 PM' },
    { hora: '20:00', etiqueta: '8:00-9:00 PM' },
    { hora: '21:00', etiqueta: '9:00-10:00 PM' }
];

const CUPO_MAXIMO = 20;
const VENTANA_MINUTOS = 15;

function obtenerHorariosClases() { return HORARIOS_CLASES; }

function obtenerFechaHoraClase(fechaStr, horaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const [h, min] = horaStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
}

function minutosHastaClase(fechaStr, horaStr) {
    return (obtenerFechaHoraClase(fechaStr, horaStr) - new Date()) / 60000;
}

function claseYaPaso(fechaStr, horaStr) {
    return minutosHastaClase(fechaStr, horaStr) < 0;
}

function puedeModificarReserva(fechaStr, horaStr) {
    return minutosHastaClase(fechaStr, horaStr) > VENTANA_MINUTOS;
}

function esDiaHabil(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const dia = new Date(y, m - 1, d).getDay();
    return dia >= 1 && dia <= 5;
}

// ─── RESERVAS ─────────────────────────────────────────────────────────────────

async function contarReservas(fechaStr, horaStr) {
    const q = query(
        collection(getDB(), 'reservas'),
        where('fecha', '==', fechaStr),
        where('hora', '==', horaStr)
    );
    const snap = await getDocs(q);
    return snap.size;
}

async function obtenerReservasPorFecha(fecha) {
    const q = query(collection(getDB(), 'reservas'), where('fecha', '==', fecha));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function cuposDisponibles(fechaStr, horaStr) {
    return CUPO_MAXIMO - await contarReservas(fechaStr, horaStr);
}

async function usuarioEstaAnotado(usuarioId, fechaStr, horaStr) {
    const q = query(
        collection(getDB(), 'reservas'),
        where('usuarioId', '==', usuarioId),
        where('fecha', '==', fechaStr),
        where('hora', '==', horaStr)
    );
    const snap = await getDocs(q);
    return !snap.empty;
}

async function reservarClase(usuarioId, fechaStr, horaStr) {
    if (claseYaPaso(fechaStr, horaStr)) {
        return { exito: false, error: 'Esta clase ya pasó' };
    }
    if (await usuarioEstaAnotado(usuarioId, fechaStr, horaStr)) {
        return { exito: false, error: 'Ya estás anotado en esta clase' };
    }
    if (await cuposDisponibles(fechaStr, horaStr) <= 0) {
        return { exito: false, error: 'No hay cupos disponibles' };
    }
    await addDoc(collection(getDB(), 'reservas'), {
        usuarioId, fecha: fechaStr, hora: horaStr,
        fecha_reserva: obtenerFechaHoy()
    });
    return { exito: true };
}

async function desanotarClase(usuarioId, fechaStr, horaStr) {
    if (!puedeModificarReserva(fechaStr, horaStr)) {
        return { exito: false, error: `Ya no puedes desanotarte (límite: ${VENTANA_MINUTOS} min antes)` };
    }
    const q = query(
        collection(getDB(), 'reservas'),
        where('usuarioId', '==', usuarioId),
        where('fecha', '==', fechaStr),
        where('hora', '==', horaStr)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { exito: false, error: 'No estás anotado en esta clase' };
    await deleteDoc(snap.docs[0].ref);
    return { exito: true };
}

async function reservarClaseAdmin(usuarioId, fechaStr, horaStr) {
    if (claseYaPaso(fechaStr, horaStr)) return { exito: false, error: 'Esta clase ya pasó' };
    if (await usuarioEstaAnotado(usuarioId, fechaStr, horaStr)) return { exito: false, error: 'Este miembro ya está anotado' };
    if (await cuposDisponibles(fechaStr, horaStr) <= 0) return { exito: false, error: 'No hay cupos' };
    await addDoc(collection(getDB(), 'reservas'), {
        usuarioId, fecha: fechaStr, hora: horaStr,
        fecha_reserva: obtenerFechaHoy(), agendado_por_staff: true
    });
    return { exito: true };
}

async function desanotarClaseAdmin(usuarioId, fechaStr, horaStr) {
    const q = query(
        collection(getDB(), 'reservas'),
        where('usuarioId', '==', usuarioId),
        where('fecha', '==', fechaStr),
        where('hora', '==', horaStr)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { exito: false, error: 'No está anotado' };
    await deleteDoc(snap.docs[0].ref);
    return { exito: true };
}

async function obtenerListaAnotadosConId(fechaStr, horaStr) {
    const q = query(
        collection(getDB(), 'reservas'),
        where('fecha', '==', fechaStr),
        where('hora', '==', horaStr)
    );
    const snap = await getDocs(q);
    const usuarios = await obtenerTodosUsuarios();
    return snap.docs.map(d => {
        const r = d.data();
        const u = usuarios.find(u => u.id === r.usuarioId);
        return { usuarioId: r.usuarioId, nombre: u ? u.nombre : 'Desconocido' };
    });
}

async function limpiarReservasPasadas() {
    const snap = await getDocs(collection(getDB(), 'reservas'));
    for (const d of snap.docs) {
        const r = d.data();
        if (claseYaPaso(r.fecha, r.hora)) await deleteDoc(d.ref);
    }
}

// Agregar a storage object
Object.assign(storage, {
    obtenerHorariosClases,
    claseYaPaso,
    puedeModificarReserva,
    esDiaHabil,
    contarReservas,
    obtenerReservasPorFecha,
    obtenerReservasPorFecha,
    cuposDisponibles,
    usuarioEstaAnotado,
    reservarClase,
    desanotarClase,
    reservarClaseAdmin,
    desanotarClaseAdmin,
    obtenerListaAnotadosConId,
    limpiarReservasPasadas,
    VENTANA_MINUTOS
});

// ─── EVENTOS ──────────────────────────────────────────────────────────────────

async function obtenerTodosEventos() {
    const snap = await getDocs(collection(getDB(), 'eventos'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerEventosActivos() {
    const q = query(collection(getDB(), 'eventos'), where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerEventoPorId(eventoId) {
    const snap = await getDoc(doc(getDB(), 'eventos', eventoId));
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
}

async function crearEvento(datos) {
    const nuevoEvento = {
        nombre: datos.nombre || '',
        fecha: datos.fecha || '',
        hora: datos.hora || '',
        ubicacion: datos.ubicacion || '',
        costo_extra: datos.costo_extra !== undefined ? datos.costo_extra : 0,
        incluye_desayuno: datos.incluye_desayuno || false,
        link_maps: datos.link_maps || '',
        campos_extra: Array.isArray(datos.campos_extra) ? datos.campos_extra : [],
        activo: true
    };
    const ref = await addDoc(collection(getDB(), 'eventos'), nuevoEvento);
    return { exito: true, evento: { id: ref.id, ...nuevoEvento } };
}

async function editarEvento(eventoId, datos) {
    const ref = doc(getDB(), 'eventos', eventoId);
    const snap = await getDoc(ref);
    if (!snap.exists) return { exito: false, error: 'Evento no encontrado' };
    await updateDoc(ref, {
        nombre: datos.nombre || '',
        fecha: datos.fecha || '',
        hora: datos.hora || '',
        ubicacion: datos.ubicacion || '',
        costo_extra: datos.costo_extra !== undefined ? datos.costo_extra : 0,
        incluye_desayuno: datos.incluye_desayuno || false,
        link_maps: datos.link_maps || '',
        campos_extra: Array.isArray(datos.campos_extra) ? datos.campos_extra : []
    });
    return { exito: true };
}

async function eliminarEvento(eventoId) {
    try {
        const ref = doc(getDB(), 'eventos', eventoId);
        await deleteDoc(ref);
        return { exito: true };
    } catch (err) {
        return { exito: false, error: err.message };
    }
}

async function cambiarEstadoEvento(eventoId, activo) {
    const ref = doc(getDB(), 'eventos', eventoId);
    const snap = await getDoc(ref);
    if (!snap.exists) return { exito: false, error: 'Evento no encontrado' };
    await updateDoc(ref, { activo });
    return { exito: true };
}

// ─── RETO 90 DÍAS ─────────────────────────────────────────────────────────────

async function obtenerTodosParticipantesReto() {
    const snap = await getDocs(collection(getDB(), 'reto90'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerParticipanteReto(usuarioId) {
    const q = query(collection(getDB(), 'reto90'), where('usuarioId', '==', usuarioId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
}

async function agregarMiembroReto(usuarioId) {
    const existente = await obtenerParticipanteReto(usuarioId);
    if (existente) return { exito: false, error: 'Este miembro ya está en el reto' };

    const usuarios = await obtenerTodosUsuarios();
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (!usuario) return { exito: false, error: 'Usuario no encontrado' };

    await addDoc(collection(getDB(), 'reto90'), {
        usuarioId,
        nombre: usuario.nombre,
        fechaIngreso: obtenerFechaHoy(),
        medidas_iniciales: null,
        medidas_finales: null
    });
    return { exito: true };
}

async function eliminarMiembroReto(usuarioId) {
    const participante = await obtenerParticipanteReto(usuarioId);
    if (!participante) return { exito: false, error: 'No encontrado' };
    await deleteDoc(doc(getDB(), 'reto90', participante.id));
    return { exito: true };
}

async function guardarMedidasReto(usuarioId, tipo, medidas) {
    const participante = await obtenerParticipanteReto(usuarioId);
    const medidasConFecha = { ...medidas, fecha: obtenerFechaHoy() };

    if (!participante) {
        const usuarios = await obtenerTodosUsuarios();
        const usuario = usuarios.find(u => u.id === usuarioId);
        const data = {
            usuarioId,
            nombre: usuario ? usuario.nombre : 'Desconocido',
            fechaIngreso: obtenerFechaHoy(),
            medidas_iniciales: tipo === 'inicial' ? medidasConFecha : null,
            medidas_finales: tipo === 'final' ? medidasConFecha : null
        };
        await addDoc(collection(getDB(), 'reto90'), data);
    } else {
        const campo = tipo === 'inicial' ? 'medidas_iniciales' : 'medidas_finales';
        await updateDoc(doc(getDB(), 'reto90', participante.id), { [campo]: medidasConFecha });
    }
    return { exito: true };
}

function calcularProgreso(participante) {
    const ini = participante.medidas_iniciales;
    const fin = participante.medidas_finales;
    if (!ini || !fin) return null;
    const delta = (a, b) => (!a || !b) ? null : ((b - a) / a * 100).toFixed(1);
    return {
        peso:    { inicial: ini.peso,     final: fin.peso,     cambio: delta(ini.peso, fin.peso) },
        estatura:{ inicial: ini.estatura,  final: fin.estatura, cambio: delta(ini.estatura, fin.estatura) },
        brazos:  { inicial: ini.brazos,    final: fin.brazos,   cambio: delta(ini.brazos, fin.brazos) },
        cintura: { inicial: ini.cintura,   final: fin.cintura,  cambio: delta(ini.cintura, fin.cintura) },
        cuello:  { inicial: ini.cuello,    final: fin.cuello,   cambio: delta(ini.cuello, fin.cuello) },
        piernas: { inicial: ini.piernas,   final: fin.piernas,  cambio: delta(ini.piernas, fin.piernas) }
    };
}

// ─── PUNTUACIONES DEL JUEGO ───────────────────────────────────────────────────

function obtenerPuntuaciones() {
    return JSON.parse(localStorage.getItem('fitmanyacts_scores')) || { maxScore: 0, lastScore: 0 };
}

function guardarPuntuacion(score) {
    const scores = obtenerPuntuaciones();
    scores.lastScore = score;
    if (score > scores.maxScore) scores.maxScore = score;
    scores.lastDate = obtenerFechaHoy();
    localStorage.setItem('fitmanyacts_scores', JSON.stringify(scores));
}

// ─── AGREGAR AL OBJETO STORAGE ────────────────────────────────────────────────

Object.assign(storage, {
    // Eventos
    obtenerTodosEventos,
    obtenerEventosActivos,
    obtenerEventoPorId,
    crearEvento,
    editarEvento,
    cambiarEstadoEvento,
    eliminarEvento,
    // Reto 90 días
    obtenerTodosParticipantesReto,
    obtenerParticipanteReto,
    agregarMiembroReto,
    eliminarMiembroReto,
    guardarMedidasReto,
    calcularProgreso,
    // Puntuaciones
    obtenerPuntuaciones,
    guardarPuntuacion
});
