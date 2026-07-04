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
        const ref = await addDoc(collection(getDB(), 'usuarios'), nuevoUsuario);
        return { exito: true, usuario: { id: ref.id, ...nuevoUsuario } };
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
    if (!datos.nombre || !datos.email || !datos.contraseña) {
        return { exito: false, error: 'Por favor complete todos los campos' };
    }
    if (datos.contraseña.length < 6) {
        return { exito: false, error: 'La contraseña debe tener mínimo 6 caracteres' };
    }
    const existente = await buscarUsuarioPorEmail(datos.email);
    if (existente) return { exito: false, error: 'Este email ya está registrado' };

    const nuevoCoach = {
        nombre: datos.nombre,
        email: datos.email.toLowerCase(),
        contraseña: datos.contraseña,
        rol: 'entrenador',
        estado: 'activo',
        fecha_registro: obtenerFechaHoy()
    };
    const ref = await addDoc(collection(getDB(), 'usuarios'), nuevoCoach);
    return { exito: true, usuario: { id: ref.id, ...nuevoCoach } };
}

async function eliminarCoach(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().rol !== 'entrenador') {
        return { exito: false, error: 'Coach no encontrado' };
    }
    await deleteDoc(ref);
    return { exito: true };
}

async function eliminarMiembro(usuarioId) {
    const ref = doc(getDB(), 'usuarios', usuarioId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().rol !== 'usuario') {
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
    if (!snap.exists()) return { exito: false, error: 'Usuario no encontrado' };
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
    if (!snap.exists()) return { exito: false, error: 'Usuario no encontrado' };

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

    // Verificar si ya existe en Firestore
    const existente = await buscarUsuarioPorEmail(email);
    if (existente) return { exito: false, error: 'Este email ya está registrado' };

    const passwordTemporal = generarPasswordTemporal();

    try {
        // Crear en Firebase Auth con contraseña temporal
        const cred = await window.authSDK.createUserWithEmailAndPassword(email, passwordTemporal);
        const uid = cred.user.uid;

        // Guardar en Firestore con estado "pendiente"
        const nuevoMiembro = {
            uid,
            nombre,
            email,
            rol: 'usuario',
            estado: 'pendiente',
            fecha_registro: obtenerFechaHoy(),
            membresia_vence: sumarMeses(obtenerFechaHoy(), 1)
        };
        await addDoc(collection(getDB(), 'usuarios'), nuevoMiembro);

        // Cerrar sesión del nuevo usuario (para no cerrar sesión del coach)
        await window.authSDK.signOut();

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

        // Actualizar estado en Firestore de "pendiente" a "activo"
        const usuario = await buscarUsuarioPorEmail(user.email);
        if (usuario) {
            const ref = window.firestoreSDK.doc(getDB(), 'usuarios', usuario.id);
            await window.firestoreSDK.updateDoc(ref, { estado: 'activo' });
        }
        return { exito: true };
    } catch (err) {
        return { exito: false, error: err.message };
    }
}


const storage = {
    // Sesión
    guardarUsuarioActual,
    obtenerUsuarioActual,
    cerrarSesion,
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
    if (!snap.exists()) return null;
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
        activo: true
    };
    const ref = await addDoc(collection(getDB(), 'eventos'), nuevoEvento);
    return { exito: true, evento: { id: ref.id, ...nuevoEvento } };
}

async function editarEvento(eventoId, datos) {
    const ref = doc(getDB(), 'eventos', eventoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { exito: false, error: 'Evento no encontrado' };
    await updateDoc(ref, {
        nombre: datos.nombre || '',
        fecha: datos.fecha || '',
        hora: datos.hora || '',
        ubicacion: datos.ubicacion || '',
        costo_extra: datos.costo_extra !== undefined ? datos.costo_extra : 0,
        incluye_desayuno: datos.incluye_desayuno || false,
        link_maps: datos.link_maps || ''
    });
    return { exito: true };
}

async function cambiarEstadoEvento(eventoId, activo) {
    const ref = doc(getDB(), 'eventos', eventoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { exito: false, error: 'Evento no encontrado' };
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
