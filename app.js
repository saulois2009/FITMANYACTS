// app.js - Lógica principal (Firestore async/await)

document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splashScreen');
    if (splash) {
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 650);
        }, 2000);
    }

    // Esperar a que firebase-init.js (type=module) termine antes de arrancar
    let appIniciada = false;
    function arrancarApp() {
        if (appIniciada) return;
        appIniciada = true;
        initializeApp();
    }

    window.addEventListener('firebaseReady', arrancarApp, { once: true });

    // Fallback: si Firebase ya estaba listo antes de que este listener se registrara
    if (window.db && window.firestoreSDK) {
        arrancarApp();
    }
});

async function initializeApp() {
    await storage.limpiarReservasPasadas();
    setupEventListeners();

    // Usar Firebase Auth para saber si hay sesión activa
    window.authSDK.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            const usuario = await storage.buscarUsuarioPorEmail(firebaseUser.email);
            if (usuario) {
                window._usuarioActual = usuario;
                if (usuario.estado === 'pendiente') {
                    // Primera vez — mostrar modal para cambiar contraseña
                    mostrarPantalla('dashboard');
                    await cargarDashboard(usuario);
                    document.getElementById('cambiarPasswordModalOverlay').classList.add('active');
                } else {
                    mostrarPantalla('dashboard');
                    await cargarDashboard(usuario);
                }
            } else {
                mostrarPantalla('login');
            }
        } else {
            window._usuarioActual = null;
            mostrarPantalla('login');
        }
    });
}

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleLogin(); });

    const toggleRegisterBtn = document.getElementById('toggleRegister');
    if (toggleRegisterBtn) toggleRegisterBtn.addEventListener('click', () => mostrarPantalla('register'));

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', e => { e.preventDefault(); handleRegister(); });

    const toggleLoginBtn = document.getElementById('toggleLogin');
    if (toggleLoginBtn) toggleLoginBtn.addEventListener('click', () => mostrarPantalla('login'));

    const menuBtn = document.getElementById('menuBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (menuBtn) menuBtn.addEventListener('click', () => menuOverlay.classList.add('active'));
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', () => menuOverlay.classList.remove('active'));
    if (menuOverlay) menuOverlay.addEventListener('click', e => { if (e.target === menuOverlay) menuOverlay.classList.remove('active'); });
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        await storage.cerrarSesion();
        window._usuarioActual = null;
        menuOverlay.classList.remove('active');
        // onAuthStateChanged detecta el signOut y muestra el login automáticamente
    });

    const menuItems = document.querySelectorAll('.menu-item[data-screen]');
    menuItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            cambiarSeccion(item.getAttribute('data-screen'));
            menuOverlay.classList.remove('active');
        });
    });

    const playGameBtn = document.getElementById('playGameBtn');
    const backGameBtn = document.getElementById('backGameBtn');
    const restartGameBtn = document.getElementById('restartGameBtn');
    if (playGameBtn) playGameBtn.addEventListener('click', () => {
        mostrarPantalla('game');
        if (!game) game = new FlappyBirdGame('gameCanvas');
    });
    if (backGameBtn) backGameBtn.addEventListener('click', async () => {
        mostrarPantalla('dashboard');
        await cargarPuntuaciones();
    });
    if (restartGameBtn) restartGameBtn.addEventListener('click', () => { if (game) game.restart(); });

    const addCoachForm = document.getElementById('addCoachForm');
    if (addCoachForm) addCoachForm.addEventListener('submit', e => { e.preventDefault(); handleAddCoach(); });

    setupRosterModalListeners();

    const membersSearchInput = document.getElementById('membersSearchInput');
    if (membersSearchInput) membersSearchInput.addEventListener('input', cargarMiembros);

    const agregarMiembroBtn = document.getElementById('agregarMiembroBtn');
    if (agregarMiembroBtn) agregarMiembroBtn.addEventListener('click', () => {
        document.getElementById('invitarNombre').value = '';
        document.getElementById('invitarEmail').value = '';
        document.getElementById('invitarResult').style.display = 'none';
        document.getElementById('invitarMiembroModalOverlay').classList.add('active');
    });

    const coachesSearchInput = document.getElementById('coachesSearchInput');
    if (coachesSearchInput) coachesSearchInput.addEventListener('input', cargarCoaches);

    setupEventModalListeners();
    setupChallengeListeners();
    setupInvitarMiembroListeners();
    setupCambiarPasswordListeners();

    const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn');
    const ICONO_OJO = '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const ICONO_OJO_TACHADO = '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = ICONO_OJO_TACHADO;
                btn.classList.add('active');
            } else {
                input.type = 'password';
                btn.innerHTML = ICONO_OJO;
                btn.classList.remove('active');
            }
        });
    });

    setupEventModalListeners();
}

// ─── LOGIN / REGISTRO ─────────────────────────────────────────────────────────

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { alert('Por favor completa todos los campos'); return; }
    const usuario = await storage.validarLogin(email, password);
    if (usuario) {
        window._usuarioActual = usuario;
        document.getElementById('loginForm').reset();
        // onAuthStateChanged en initializeApp maneja la navegación automáticamente
    } else {
        alert('Email o contraseña incorrectos');
    }
}

async function handleRegister() {
    const nombre = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const contraseña = document.getElementById('registerPassword').value;
    const contraseñaConfirm = document.getElementById('registerPasswordConfirm').value;
    const rol = document.getElementById('registerRole').value;

    if (!nombre || !email || !contraseña || !contraseñaConfirm || !rol) {
        alert('Por favor complete todos los campos'); return;
    }
    if (contraseña.length < 6) { alert('La contraseña debe tener mínimo 6 caracteres'); return; }
    if (contraseña !== contraseñaConfirm) { alert('Las contraseñas no coinciden'); return; }

    const resultado = await storage.registrarUsuario({ nombre, email, contraseña, rol });
    if (resultado.exito) {
        alert('Cuenta creada exitosamente. Ahora inicie sesión');
        mostrarPantalla('login');
        document.getElementById('registerForm').reset();
    } else {
        alert(resultado.error);
    }
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

function mostrarPantalla(nombrePantalla) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const ids = { login: 'loginScreen', register: 'registerScreen', dashboard: 'dashboardScreen', game: 'gameScreen' };
    const pantalla = document.getElementById(ids[nombrePantalla]);
    if (pantalla) pantalla.classList.add('active');
}

async function cambiarSeccion(nombreSeccion) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const mapa = {
        profile: async () => { document.getElementById('profileSection').classList.add('active'); await cargarPerfil(); },
        classes: async () => { document.getElementById('classesSection').classList.add('active'); await cargarClases(); },
        events:  async () => { document.getElementById('eventsSection').classList.add('active'); await cargarEventos(); },
        games:   async () => { document.getElementById('gamesSection').classList.add('active'); await cargarPuntuaciones(); },
        members: async () => { document.getElementById('membersSection').classList.add('active'); await cargarMiembros(); },
        coaches: async () => { document.getElementById('coachesSection').classList.add('active'); await cargarCoaches(); },
        challenge: async () => { document.getElementById('challengeSection').classList.add('active'); await cargarReto(); }
    };
    if (mapa[nombreSeccion]) await mapa[nombreSeccion]();
}

// ─── PERFIL / DASHBOARD ───────────────────────────────────────────────────────

function pintarPerfil(usuario) {
    document.getElementById('profileName').textContent = usuario.nombre;
    document.getElementById('profileEmail').textContent = usuario.email;
    const rolText = { usuario: 'Miembro', entrenador: 'Entrenador', dueño: 'Dueño' }[usuario.rol] || usuario.rol;
    document.getElementById('profileRole').textContent = rolText;

    const ageRow = document.getElementById('profileAgeRow');
    const membershipRow = document.getElementById('profileMembershipRow');

    if (usuario.rol === 'usuario') {
        if (ageRow) ageRow.style.display = '';
        if (membershipRow) membershipRow.style.display = '';
        const vigente = storage.membresiaVigente(usuario);
        const el = document.getElementById('profileMembership');
        if (el) { el.textContent = vigente ? 'Vigente' : 'Vencida'; el.style.color = vigente ? 'var(--success-color)' : 'var(--danger-color)'; }
        const venceEl = document.getElementById('profileMembershipVence');
        if (venceEl) venceEl.textContent = usuario.membresia_vence ? `(hasta ${usuario.membresia_vence})` : '';
    } else {
        if (ageRow) ageRow.style.display = 'none';
        if (membershipRow) membershipRow.style.display = 'none';
    }
}

async function cargarDashboard(usuario) {
    pintarPerfil(usuario);
    const coachesMenuItem = document.getElementById('coachesMenuItem');
    if (coachesMenuItem) coachesMenuItem.style.display = usuario.rol === 'dueño' ? 'block' : 'none';
    const membersMenuItem = document.getElementById('membersMenuItem');
    if (membersMenuItem) membersMenuItem.style.display = (usuario.rol === 'entrenador' || usuario.rol === 'dueño') ? 'block' : 'none';
    const challengeMenuItem = document.getElementById('challengeMenuItem');
    if (challengeMenuItem) challengeMenuItem.style.display = (usuario.rol === 'entrenador' || usuario.rol === 'dueño') ? 'block' : 'none';
    await cambiarSeccion('profile');
}

async function cargarPerfil() {
    const usuario = window._usuarioActual;
    if (usuario) pintarPerfil(usuario);
}

// ─── CLASES ───────────────────────────────────────────────────────────────────

function obtenerProximosDiasHabiles(n) {
    const dias = [];
    const nombres = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    let cursor = new Date();
    while (dias.length < n) {
        const dia = cursor.getDay();
        if (dia >= 1 && dia <= 5) {
            const y = cursor.getFullYear();
            const m = String(cursor.getMonth()+1).padStart(2,'0');
            const d = String(cursor.getDate()).padStart(2,'0');
            dias.push({ fecha: `${y}-${m}-${d}`, etiqueta: `${nombres[dia]} ${d}/${m}` });
        }
        cursor = new Date(cursor.getTime() + 86400000);
    }
    return dias;
}

let diaSeleccionadoClases = 0;

async function cargarClases() {
    const usuario = window._usuarioActual;
    const classesList = document.getElementById('classesList');
    const selectorContainer = document.getElementById('classesDaySelector');
    classesList.innerHTML = '<p class="empty-state">Cargando clases...</p>';

    const dias = obtenerProximosDiasHabiles(7);

    if (selectorContainer) {
        selectorContainer.innerHTML = '';
        dias.forEach((dia, index) => {
            const btn = document.createElement('button');
            btn.className = 'day-chip' + (index === diaSeleccionadoClases ? ' active' : '');
            btn.textContent = index === 0 ? `Hoy (${dia.etiqueta})` : dia.etiqueta;
            btn.addEventListener('click', () => { diaSeleccionadoClases = index; cargarClases(); });
            selectorContainer.appendChild(btn);
        });
    }

    const diaActual = dias[diaSeleccionadoClases];
    const horarios = storage.obtenerHorariosClases();
    const esCoachODueño = usuario.rol === 'entrenador' || usuario.rol === 'dueño';
    classesList.innerHTML = '';

    for (const horario of horarios) {
        const classItem = document.createElement('div');
        classItem.className = 'class-item';

        const cupos = await storage.cuposDisponibles(diaActual.fecha, horario.hora);
        const yaPaso = storage.claseYaPaso(diaActual.fecha, horario.hora);
        const puedeModificar = storage.puedeModificarReserva(diaActual.fecha, horario.hora);
        const anotado = usuario.rol === 'usuario' && await storage.usuarioEstaAnotado(usuario.id, diaActual.fecha, horario.hora);

        let infoHtml = `<div class="class-time">${horario.etiqueta}</div>
            <div class="class-status">Cupos disponibles: ${cupos} / 20</div>`;
        if (yaPaso) infoHtml += `<div class="class-status">Esta clase ya pasó</div>`;
        else if (anotado) infoHtml += `<div class="class-status" style="color:var(--success-color);">✓ Estás anotado</div>`;
        if (!puedeModificar && !yaPaso && anotado) infoHtml += `<div class="class-status">Ya no puedes desanotarte (faltan menos de 15 min)</div>`;

        classItem.innerHTML = infoHtml;

        if (esCoachODueño) {
            const totalAnotados = await storage.contarReservas(diaActual.fecha, horario.hora);
            const summary = document.createElement('div');
            summary.className = 'attendee-summary';
            summary.innerHTML = `<span class="attendee-summary-text">${totalAnotados} anotado${totalAnotados === 1 ? '' : 's'}</span><span class="attendee-summary-arrow">Ver lista ›</span>`;
            summary.addEventListener('click', () => abrirModalClase(diaActual, horario, yaPaso));
            classItem.appendChild(summary);
        }

        if (usuario.rol === 'usuario' && !yaPaso) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'btn btn-primary';
            actionBtn.style.marginTop = '10px';
            actionBtn.style.width = '100%';
            if (anotado) {
                actionBtn.textContent = 'Desanotarme';
                actionBtn.style.backgroundColor = 'var(--danger-color)';
                actionBtn.disabled = !puedeModificar;
                actionBtn.addEventListener('click', async () => {
                    const r = await storage.desanotarClase(usuario.id, diaActual.fecha, horario.hora);
                    if (r.exito) cargarClases(); else alert(r.error);
                });
            } else {
                actionBtn.textContent = cupos > 0 ? 'Anotarme' : 'Sin cupo';
                actionBtn.disabled = cupos <= 0;
                actionBtn.addEventListener('click', async () => {
                    const r = await storage.reservarClase(usuario.id, diaActual.fecha, horario.hora);
                    if (r.exito) cargarClases(); else alert(r.error);
                });
            }
            classItem.appendChild(actionBtn);
        }

        classesList.appendChild(classItem);
    }
}

// ─── MODAL: LISTA DE ANOTADOS ─────────────────────────────────────────────────

let modalClaseActual = null;

async function abrirModalClase(diaActual, horario, yaPaso) {
    modalClaseActual = { fecha: diaActual.fecha, etiquetaDia: diaActual.etiqueta, hora: horario.hora, etiquetaHora: horario.etiqueta, yaPaso };
    const titleEl = document.getElementById('rosterModalTitle');
    if (titleEl) titleEl.textContent = `${horario.etiqueta} · ${diaActual.etiqueta}`;
    document.getElementById('rosterSearchInput').value = '';
    document.getElementById('rosterAddSearchInput').value = '';
    await renderRosterModal();
    document.getElementById('rosterModalOverlay').classList.add('active');
}

function cerrarModalClase() {
    modalClaseActual = null;
    document.getElementById('rosterModalOverlay').classList.remove('active');
}

async function renderRosterModal() {
    if (!modalClaseActual) return;
    const { fecha, hora, yaPaso } = modalClaseActual;
    const rosterList = document.getElementById('rosterList');
    const rosterCount = document.getElementById('rosterCount');
    const filtroAnotados = document.getElementById('rosterSearchInput').value.trim().toLowerCase();
    const filtroAgendar = document.getElementById('rosterAddSearchInput').value.trim().toLowerCase();

    const anotados = await storage.obtenerListaAnotadosConId(fecha, hora);
    if (rosterCount) rosterCount.textContent = anotados.length;

    rosterList.innerHTML = '';
    const filtrados = anotados.filter(a => a.nombre.toLowerCase().includes(filtroAnotados));
    if (filtrados.length === 0) {
        rosterList.innerHTML = `<div class="roster-empty">${anotados.length === 0 ? 'Nadie anotado aún' : 'Sin resultados'}</div>`;
    } else {
        filtrados.forEach(a => {
            const row = document.createElement('div');
            row.className = 'roster-row';
            row.innerHTML = `<span>${a.nombre}</span>`;
            if (!yaPaso) {
                const btn = document.createElement('button');
                btn.className = 'roster-remove-btn';
                btn.textContent = '✕';
                btn.addEventListener('click', async () => {
                    const r = await storage.desanotarClaseAdmin(a.usuarioId, fecha, hora);
                    if (r.exito) { await renderRosterModal(); cargarClases(); } else alert(r.error);
                });
                row.appendChild(btn);
            }
            rosterList.appendChild(row);
        });
    }

    const addList = document.getElementById('rosterAddList');
    addList.innerHTML = '';
    const cupos = await storage.cuposDisponibles(fecha, hora);
    if (yaPaso) { addList.innerHTML = '<div class="roster-empty">Esta clase ya pasó</div>'; return; }
    if (cupos <= 0) { addList.innerHTML = '<div class="roster-empty">No hay cupos disponibles</div>'; return; }

    const miembros = (await storage.obtenerMiembros()).filter(m => !anotados.some(a => a.usuarioId === m.id) && m.nombre.toLowerCase().includes(filtroAgendar));
    if (miembros.length === 0) { addList.innerHTML = '<div class="roster-empty">Sin resultados</div>'; return; }
    miembros.forEach(m => {
        const row = document.createElement('div');
        row.className = 'roster-row';
        row.innerHTML = `<span>${m.nombre}</span>`;
        const btn = document.createElement('button');
        btn.className = 'roster-add-btn';
        btn.textContent = 'Agregar';
        btn.addEventListener('click', async () => {
            const r = await storage.reservarClaseAdmin(m.id, fecha, hora);
            if (r.exito) { await renderRosterModal(); cargarClases(); } else alert(r.error);
        });
        row.appendChild(btn);
        addList.appendChild(row);
    });
}

function setupRosterModalListeners() {
    const overlay = document.getElementById('rosterModalOverlay');
    const closeBtn = document.getElementById('rosterModalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', cerrarModalClase);
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) cerrarModalClase(); });
    document.getElementById('rosterSearchInput')?.addEventListener('input', renderRosterModal);
    document.getElementById('rosterAddSearchInput')?.addEventListener('input', renderRosterModal);
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────

async function cargarEventos() {
    const usuario = window._usuarioActual;
    const eventsList = document.getElementById('eventsList');
    const addEventBtn = document.getElementById('addEventBtn');
    eventsList.innerHTML = '<p class="empty-state">Cargando...</p>';

    const esCoachODueño = usuario.rol === 'entrenador' || usuario.rol === 'dueño';
    if (addEventBtn) addEventBtn.style.display = esCoachODueño ? 'block' : 'none';

    const eventos = esCoachODueño ? await storage.obtenerTodosEventos() : await storage.obtenerEventosActivos();
    eventsList.innerHTML = '';

    if (eventos.length === 0) {
        eventsList.innerHTML = `<p class="empty-state">${esCoachODueño ? 'No hay eventos. Usa "Crear Evento".' : 'No hay eventos por el momento'}</p>`;
        return;
    }

    eventos.forEach(evento => {
        const item = document.createElement('div');
        item.className = 'event-item';
        if (esCoachODueño && !evento.activo) item.style.opacity = '0.55';

        item.innerHTML = `
            <div class="event-name">${evento.nombre}${esCoachODueño && !evento.activo ? ' <span style="color:var(--text-light);font-size:12px;">(Inactivo)</span>' : ''}</div>
            <div class="event-detail">📅 ${evento.fecha} a las ${evento.hora}</div>
            <div class="event-detail">📍 ${evento.ubicacion}</div>
            <div class="event-detail">💰 Costo adicional: $${evento.costo_extra}</div>
            <div class="event-detail">🍽️ ${evento.incluye_desayuno ? 'Incluye desayuno y bebida' : 'Sin desayuno'}</div>
        `;

        if (evento.link_maps) {
            const a = document.createElement('a');
            a.href = evento.link_maps; a.target = '_blank';
            a.className = 'btn btn-primary';
            a.style.cssText = 'display:block;text-align:center;margin-top:10px;text-decoration:none;';
            a.textContent = 'Ver ubicación en Google Maps';
            item.appendChild(a);
        }

        if (esCoachODueño) {
            const controls = document.createElement('div');
            controls.style.cssText = 'display:flex;gap:8px;margin-top:10px;';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn';
            editBtn.textContent = 'Editar';
            editBtn.style.cssText = 'flex:1;background-color:var(--border-color);color:var(--text-dark);';
            editBtn.addEventListener('click', () => abrirModalEvento(evento.id));

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn';
            toggleBtn.style.flex = '1';
            toggleBtn.textContent = evento.activo ? 'Desactivar' : 'Activar';
            toggleBtn.style.backgroundColor = evento.activo ? 'var(--danger-color)' : 'var(--primary-color)';
            toggleBtn.style.color = '#000';
            toggleBtn.addEventListener('click', async () => {
                const r = await storage.cambiarEstadoEvento(evento.id, !evento.activo);
                if (r.exito) cargarEventos(); else alert(r.error);
            });

            controls.appendChild(editBtn);
            controls.appendChild(toggleBtn);
            item.appendChild(controls);
        }

        eventsList.appendChild(item);
    });
}

// ─── MODAL EVENTO ─────────────────────────────────────────────────────────────

const CAMPOS_EVENTO = [
    { id: 'eventName', label: 'Nombre del evento', key: 'nombre' },
    { id: 'eventDate', label: 'Fecha', key: 'fecha' },
    { id: 'eventTime', label: 'Hora', key: 'hora' },
    { id: 'eventLocation', label: 'Ubicación', key: 'ubicacion' },
    { id: 'eventCost', label: 'Costo adicional', key: 'costo_extra' },
    { id: 'eventMapsLink', label: 'Link de Google Maps', key: 'link_maps' }
];

async function abrirModalEvento(eventoId) {
    document.getElementById('eventForm').reset();
    const title = document.getElementById('eventModalTitle');
    const editIdInput = document.getElementById('eventEditId');
    if (eventoId) {
        const evento = await storage.obtenerEventoPorId(eventoId);
        if (!evento) return;
        title.textContent = 'Editar Evento';
        editIdInput.value = evento.id;
        document.getElementById('eventName').value = evento.nombre || '';
        document.getElementById('eventDate').value = evento.fecha || '';
        document.getElementById('eventTime').value = evento.hora || '';
        document.getElementById('eventLocation').value = evento.ubicacion || '';
        document.getElementById('eventCost').value = evento.costo_extra ?? '';
        document.getElementById('eventBreakfast').value = evento.incluye_desayuno ? 'si' : 'no';
        document.getElementById('eventMapsLink').value = evento.link_maps || '';
    } else {
        title.textContent = 'Crear Evento';
        editIdInput.value = '';
        document.getElementById('eventBreakfast').value = 'no';
    }
    document.getElementById('eventModalOverlay').classList.add('active');
}

function cerrarModalEvento() { document.getElementById('eventModalOverlay').classList.remove('active'); }

function recolectarDatosEvento() {
    return {
        nombre: document.getElementById('eventName').value.trim(),
        fecha: document.getElementById('eventDate').value.trim(),
        hora: document.getElementById('eventTime').value.trim(),
        ubicacion: document.getElementById('eventLocation').value.trim(),
        costo_extra: document.getElementById('eventCost').value.trim(),
        incluye_desayuno: document.getElementById('eventBreakfast').value === 'si',
        link_maps: document.getElementById('eventMapsLink').value.trim()
    };
}

async function guardarEventoConDatos(datos) {
    const editId = document.getElementById('eventEditId').value;
    const datosFinales = { ...datos, costo_extra: datos.costo_extra === '' ? 0 : parseFloat(datos.costo_extra) };
    const resultado = editId ? await storage.editarEvento(editId, datosFinales) : await storage.crearEvento(datosFinales);
    if (resultado.exito) { cerrarModalEvento(); cargarEventos(); } else alert(resultado.error);
}

function handleEventFormSubmit() {
    const datos = recolectarDatosEvento();
    const vacios = CAMPOS_EVENTO.filter(c => datos[c.key] === '' || datos[c.key] == null);
    if (vacios.length > 0) {
        mostrarConfirmacionCamposVacios(vacios.map(c => `"${c.label}"`).join(', '), () => guardarEventoConDatos(datos));
    } else {
        guardarEventoConDatos(datos);
    }
}

let onContinuarCamposVacios = null;

function mostrarConfirmacionCamposVacios(nombres, onContinuar) {
    document.getElementById('emptyFieldsMessage').textContent = `¿Quieres dejar ${nombres} en blanco?`;
    onContinuarCamposVacios = onContinuar;
    document.getElementById('emptyFieldsModalOverlay').classList.add('active');
}

function cerrarConfirmacionCamposVacios() {
    document.getElementById('emptyFieldsModalOverlay').classList.remove('active');
    onContinuarCamposVacios = null;
}

function setupEventModalListeners() {
    document.getElementById('addEventBtn')?.addEventListener('click', () => abrirModalEvento(null));
    document.getElementById('eventForm')?.addEventListener('submit', e => { e.preventDefault(); handleEventFormSubmit(); });
    document.getElementById('eventModalCloseBtn')?.addEventListener('click', cerrarModalEvento);
    document.getElementById('eventModalOverlay')?.addEventListener('click', e => { if (e.target.id === 'eventModalOverlay') cerrarModalEvento(); });
    document.getElementById('emptyFieldsContinueBtn')?.addEventListener('click', () => { const cb = onContinuarCamposVacios; cerrarConfirmacionCamposVacios(); if (cb) cb(); });
    document.getElementById('emptyFieldsEditBtn')?.addEventListener('click', cerrarConfirmacionCamposVacios);
    document.getElementById('emptyFieldsModalOverlay')?.addEventListener('click', e => { if (e.target.id === 'emptyFieldsModalOverlay') cerrarConfirmacionCamposVacios(); });
}

// ─── MIEMBROS ─────────────────────────────────────────────────────────────────

async function cargarMiembros() {
    const lista = document.getElementById('membersList');
    lista.innerHTML = '<p class="empty-state">Cargando...</p>';
    const filtro = document.getElementById('membersSearchInput')?.value.trim().toLowerCase() || '';
    const todos = await storage.obtenerMiembros();
    const miembros = todos.filter(m => m.nombre.toLowerCase().includes(filtro));

    if (todos.length === 0) { lista.innerHTML = '<p class="empty-state">No hay miembros registrados</p>'; return; }
    if (miembros.length === 0) { lista.innerHTML = '<p class="empty-state">Sin resultados</p>'; return; }

    lista.innerHTML = '';
    miembros.forEach(miembro => {
        const vigente = storage.membresiaVigente(miembro);
        const item = document.createElement('div');
        item.className = 'card';

        const info = document.createElement('div');
        info.style.marginBottom = '10px';
        info.innerHTML = `
            <p style="margin-bottom:4px;"><strong>${miembro.nombre}</strong></p>
            <p style="margin-bottom:4px;font-size:13px;color:var(--text-light);">${miembro.email}</p>
            <p style="margin-bottom:0;font-size:13px;">Membresía: <span style="color:${vigente ? 'var(--success-color)' : 'var(--danger-color)'};font-weight:600;">${vigente ? 'Vigente' : 'Vencida'}</span>${miembro.membresia_vence ? ` (hasta ${miembro.membresia_vence})` : ''}</p>
        `;

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;';

        const activateBtn = document.createElement('button');
        activateBtn.className = 'btn btn-primary';
        activateBtn.textContent = vigente ? 'Renovar +1 mes' : 'Activar membresía';
        activateBtn.style.flex = '1';
        activateBtn.addEventListener('click', async () => {
            const r = await storage.activarMembresia(miembro.id);
            if (r.exito) cargarMiembros(); else alert(r.error);
        });
        actions.appendChild(activateBtn);

        if (vigente) {
            const deactivateBtn = document.createElement('button');
            deactivateBtn.className = 'btn';
            deactivateBtn.textContent = 'Desactivar';
            deactivateBtn.style.cssText = 'flex:1;background-color:var(--danger-color);color:#000;';
            deactivateBtn.addEventListener('click', async () => {
                if (confirm(`¿Desactivar la membresía de ${miembro.nombre}?`)) {
                    const r = await storage.desactivarMembresia(miembro.id);
                    if (r.exito) cargarMiembros(); else alert(r.error);
                }
            });
            actions.appendChild(deactivateBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn';
        deleteBtn.textContent = 'Eliminar miembro';
        deleteBtn.style.cssText = 'margin-top:10px;width:100%;background:transparent;color:var(--danger-color);border:1px solid var(--danger-color);';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`¿Seguro que quieres remover a "${miembro.nombre}"?\n\nEsta acción es irreversible.`)) {
                const r = await storage.eliminarMiembro(miembro.id);
                if (r.exito) cargarMiembros(); else alert(r.error);
            }
        });

        item.appendChild(info);
        item.appendChild(actions);
        item.appendChild(deleteBtn);
        lista.appendChild(item);
    });
}

// ─── COACHES ──────────────────────────────────────────────────────────────────

async function handleAddCoach() {
    const nombre = document.getElementById('coachName').value;
    const email = document.getElementById('coachEmail').value;
    const contraseña = document.getElementById('coachPassword').value;
    const r = await storage.crearCoach({ nombre, email, contraseña });
    if (r.exito) { alert('Coach agregado exitosamente'); document.getElementById('addCoachForm').reset(); cargarCoaches(); }
    else alert(r.error);
}

async function cargarCoaches() {
    const lista = document.getElementById('coachesList');
    lista.innerHTML = '<p class="empty-state">Cargando...</p>';
    const filtro = document.getElementById('coachesSearchInput')?.value.trim().toLowerCase() || '';
    const todos = await storage.obtenerCoaches();
    const coaches = todos.filter(c => c.nombre.toLowerCase().includes(filtro));

    if (todos.length === 0) { lista.innerHTML = '<p class="empty-state">No hay coaches registrados</p>'; return; }
    if (coaches.length === 0) { lista.innerHTML = '<p class="empty-state">Sin resultados</p>'; return; }

    lista.innerHTML = '';
    coaches.forEach(coach => {
        const item = document.createElement('div');
        item.className = 'card';
        item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

        const info = document.createElement('div');
        info.innerHTML = `<p style="margin-bottom:4px;"><strong>${coach.nombre}</strong></p><p style="margin-bottom:0;font-size:13px;color:var(--text-light);">${coach.email}</p>`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn';
        removeBtn.textContent = 'Eliminar';
        removeBtn.style.cssText = 'background-color:var(--danger-color);color:#000;width:auto;flex:0 0 auto;';
        removeBtn.addEventListener('click', async () => {
            if (confirm(`¿Eliminar al coach ${coach.nombre}?`)) {
                const r = await storage.eliminarCoach(coach.id);
                if (r.exito) cargarCoaches(); else alert(r.error);
            }
        });

        item.appendChild(info);
        item.appendChild(removeBtn);
        lista.appendChild(item);
    });
}

// ─── PUNTUACIONES ─────────────────────────────────────────────────────────────

async function cargarPuntuaciones() {
    const scores = storage.obtenerPuntuaciones();
    const maxEl = document.getElementById('maxScore');
    const lastEl = document.getElementById('lastScore');
    if (maxEl) maxEl.textContent = scores.maxScore;
    if (lastEl) lastEl.textContent = scores.lastScore > 0 ? scores.lastScore : '-';
}

// ─── RETO 90 DÍAS ─────────────────────────────────────────────────────────────

let challengeParticipanteActual = null;

async function cargarReto() {
    const lista = document.getElementById('challengeParticipantsList');
    const addSearch = document.getElementById('challengeSearchInput');
    lista.innerHTML = '<p class="empty-state">Cargando...</p>';
    await renderChallengeAddList(addSearch?.value.trim().toLowerCase() || '');

    const participantes = await storage.obtenerTodosParticipantesReto();
    lista.innerHTML = '';

    if (participantes.length === 0) { lista.innerHTML = '<p class="empty-state">No hay participantes en el reto aún</p>'; return; }

    participantes.forEach(p => {
        const card = document.createElement('div');
        card.className = 'challenge-participant-card';
        const estado = p.medidas_iniciales && p.medidas_finales ? 'Inicial y final ✓' : p.medidas_iniciales ? 'Solo medidas iniciales' : 'Sin medidas';
        card.innerHTML = `<div class="challenge-participant-name">${p.nombre}</div><div class="challenge-participant-meta">Ingreso: ${p.fechaIngreso} · ${estado}</div>`;
        card.addEventListener('click', () => abrirModalReto(p.usuarioId));
        lista.appendChild(card);
    });
}

async function renderChallengeAddList(filtro) {
    const addList = document.getElementById('challengeAddList');
    if (!addList) return;
    addList.innerHTML = '';
    const participantes = await storage.obtenerTodosParticipantesReto();
    const ids = new Set(participantes.map(p => p.usuarioId));
    const miembros = (await storage.obtenerMiembros()).filter(m => !ids.has(m.id) && m.nombre.toLowerCase().includes(filtro));

    if (miembros.length === 0) { addList.innerHTML = '<div class="roster-empty">Sin resultados</div>'; return; }
    miembros.forEach(m => {
        const row = document.createElement('div');
        row.className = 'roster-row';
        row.innerHTML = `<span>${m.nombre}</span>`;
        const btn = document.createElement('button');
        btn.className = 'roster-add-btn';
        btn.textContent = 'Agregar';
        btn.addEventListener('click', async () => {
            const r = await storage.agregarMiembroReto(m.id);
            if (r.exito) cargarReto(); else alert(r.error);
        });
        row.appendChild(btn);
        addList.appendChild(row);
    });
}

async function abrirModalReto(usuarioId) {
    challengeParticipanteActual = usuarioId;
    const participante = await storage.obtenerParticipanteReto(usuarioId);
    document.getElementById('challengeModalTitle').textContent = participante?.nombre || 'Participante';
    document.querySelectorAll('.challenge-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.challenge-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.challenge-tab-btn[data-tab="info"]').classList.add('active');
    document.getElementById('challengeTabInfo').classList.add('active');
    renderChallengeInfo(participante);
    rellenarFormularioReto('inicial', participante);
    rellenarFormularioReto('final', participante);
    document.getElementById('challengeModalOverlay').classList.add('active');
}

function cerrarModalReto() {
    challengeParticipanteActual = null;
    document.getElementById('challengeModalOverlay').classList.remove('active');
}

function renderChallengeInfo(participante) {
    const container = document.getElementById('challengeParticipantInfo');
    if (!container || !participante) return;
    const ini = participante.medidas_iniciales;
    const fin = participante.medidas_finales;
    const progreso = storage.calcularProgreso(participante);
    const campos = [
        { key: 'edad', label: 'Edad (años)' }, { key: 'peso', label: 'Peso (kg)' },
        { key: 'estatura', label: 'Estatura (cm)' }, { key: 'brazos', label: 'Brazos (cm)' },
        { key: 'cintura', label: 'Cintura (cm)' }, { key: 'cuello', label: 'Cuello (cm)' },
        { key: 'piernas', label: 'Piernas (cm)' }
    ];
    let html = '';
    if (!ini && !fin) {
        html = '<p class="empty-state">Aún no hay medidas registradas.<br>Usa las pestañas para agregar.</p>';
    } else {
        html = `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:flex-end;gap:24px;font-size:12px;color:var(--text-light);font-weight:600;margin-bottom:4px;"><span>Inicial</span><span>Final</span><span>Cambio</span></div>`;
        campos.forEach(campo => {
            const prog = progreso?.[campo.key];
            let deltaHtml = '<span style="color:var(--text-light);font-size:12px;">—</span>';
            if (prog?.cambio != null) {
                const delta = parseFloat(prog.cambio);
                deltaHtml = `<span class="challenge-stat-delta ${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${prog.cambio}%</span>`;
            }
            html += `<div class="challenge-stat-row"><span class="challenge-stat-label">${campo.label}</span><div class="challenge-stat-values"><span>${ini?.[campo.key] ?? '—'}</span><span>${fin?.[campo.key] ?? '—'}</span>${deltaHtml}</div></div>`;
        });
        html += '</div>';
    }
    html += `<button id="challengeRemoveBtn" class="btn" style="width:100%;margin-top:12px;background:transparent;color:var(--danger-color);border:1px solid var(--danger-color);">Quitar del reto</button>`;
    container.innerHTML = html;
    document.getElementById('challengeRemoveBtn')?.addEventListener('click', async () => {
        if (confirm(`¿Quitar a ${participante.nombre} del reto?`)) {
            await storage.eliminarMiembroReto(participante.usuarioId);
            cerrarModalReto();
            cargarReto();
        }
    });
}

function rellenarFormularioReto(tipo, participante) {
    const prefijo = tipo === 'inicial' ? 'cf_' : 'cff_';
    const medidas = tipo === 'inicial' ? participante?.medidas_iniciales : participante?.medidas_finales;
    ['edad','peso','estatura','brazos','cintura','cuello','piernas'].forEach(campo => {
        const input = document.getElementById(prefijo + campo);
        if (input) input.value = medidas?.[campo] ?? '';
    });
}

async function guardarMedidasReto(tipo) {
    if (!challengeParticipanteActual) return;
    const prefijo = tipo === 'inicial' ? 'cf_' : 'cff_';
    const medidas = {};
    ['edad','peso','estatura','brazos','cintura','cuello','piernas'].forEach(campo => {
        const input = document.getElementById(prefijo + campo);
        medidas[campo] = input?.value !== '' ? parseFloat(input.value) : null;
    });
    const r = await storage.guardarMedidasReto(challengeParticipanteActual, tipo, medidas);
    if (r.exito) {
        const p = await storage.obtenerParticipanteReto(challengeParticipanteActual);
        renderChallengeInfo(p);
        cargarReto();
        alert(`Medidas ${tipo === 'inicial' ? 'iniciales' : 'finales'} guardadas`);
    }
}

function setupChallengeListeners() {
    document.getElementById('analyzeBtn')?.addEventListener('click', analizarGanadoresConIA);
    document.getElementById('challengeModalCloseBtn')?.addEventListener('click', cerrarModalReto);
    document.getElementById('challengeModalOverlay')?.addEventListener('click', e => { if (e.target.id === 'challengeModalOverlay') cerrarModalReto(); });
    document.querySelectorAll('.challenge-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.challenge-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.challenge-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'challengeTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
            document.getElementById(tabId)?.classList.add('active');
        });
    });
    document.getElementById('challengeFormInicial')?.addEventListener('submit', e => { e.preventDefault(); guardarMedidasReto('inicial'); });
    document.getElementById('challengeFormFinal')?.addEventListener('submit', e => { e.preventDefault(); guardarMedidasReto('final'); });
    document.getElementById('challengeSearchInput')?.addEventListener('input', e => renderChallengeAddList(e.target.value.trim().toLowerCase()));
}

// ─── ANÁLISIS IA ──────────────────────────────────────────────────────────────

async function analizarGanadoresConIA() {
    const participantes = await storage.obtenerTodosParticipantesReto();
    const completos = participantes.filter(p => p.medidas_iniciales && p.medidas_finales);
    const resultContainer = document.getElementById('aiResultContainer');
    const resultContent = document.getElementById('aiResultContent');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (completos.length < 2) { alert('Se necesitan al menos 2 participantes con medidas iniciales y finales.'); return; }

    resultContainer.style.display = 'block';
    resultContent.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div>Analizando resultados...</div>';
    analyzeBtn.disabled = true;

    const resumen = completos.map(p => {
        const ini = p.medidas_iniciales;
        const fin = p.medidas_finales;
        const progreso = storage.calcularProgreso(p);
        const campos = { peso:'Peso (kg)', estatura:'Estatura (cm)', brazos:'Brazos (cm)', cintura:'Cintura (cm)', cuello:'Cuello (cm)', piernas:'Piernas (cm)' };
        let detalles = '';
        Object.entries(campos).forEach(([key, label]) => {
            const prog = progreso?.[key];
            const cambio = prog?.cambio != null ? `(${prog.cambio > 0 ? '+' : ''}${prog.cambio}%)` : '(sin dato)';
            detalles += `  - ${label}: ${ini[key] ?? '?'} → ${fin[key] ?? '?'} ${cambio}\n`;
        });
        return `Participante: ${p.nombre}\nEdad: ${ini.edad ?? 'no especificada'} años\n${detalles}`;
    }).join('\n---\n');

    const prompt = `Eres experto en fitness. Analiza los resultados del Reto 90 días de FITMANYACTS y selecciona los 3 mejores considerando tipo de cuerpo y progreso proporcional.\n\nRESULTADOS:\n${resumen}\n\nAnaliza brevemente a cada participante y declara 1°, 2° y 3° lugar con explicación. Responde en español.`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
        });
        const data = await response.json();
        const texto = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        resultContent.innerHTML = `<div class="ai-result-text">${texto}</div>`;
    } catch (e) {
        resultContent.innerHTML = '<p style="color:var(--danger-color);">Error al conectar con la IA. Verifica tu conexión e intenta de nuevo.</p>';
    } finally {
        analyzeBtn.disabled = false;
    }
}

let game = null;

// ─── INVITAR MIEMBRO ──────────────────────────────────────────────────────────

function setupInvitarMiembroListeners() {
    document.getElementById('invitarMiembroCloseBtn')?.addEventListener('click', () => {
        document.getElementById('invitarMiembroModalOverlay').classList.remove('active');
    });

    document.getElementById('invitarMiembroBtn')?.addEventListener('click', async () => {
        const nombre = document.getElementById('invitarNombre').value.trim();
        const email = document.getElementById('invitarEmail').value.trim();
        const resultDiv = document.getElementById('invitarResult');
        const btn = document.getElementById('invitarMiembroBtn');

        if (!nombre || !email) { 
            resultDiv.style.display = 'block';
            resultDiv.style.color = 'var(--danger-color)';
            resultDiv.textContent = 'Por favor completa nombre y email';
            return; 
        }

        btn.disabled = true;
        btn.textContent = 'Agregando...';
        resultDiv.style.display = 'none';

        const r = await storage.invitarMiembro(nombre, email);

        btn.disabled = false;
        btn.textContent = 'Agregar y generar contraseña';
        resultDiv.style.display = 'block';

        if (r.exito) {
            resultDiv.style.color = 'var(--primary-color)';
            resultDiv.innerHTML = `✅ <strong>${r.nombre}</strong> agregado.<br>Contraseña temporal: <strong style="letter-spacing:2px;">${r.passwordTemporal}</strong><br><span style="font-size:12px;color:var(--text-light);">Compártela por WhatsApp. El miembro la cambiará al entrar por primera vez.</span>`;
            await cargarMiembros();
        } else {
            resultDiv.style.color = 'var(--danger-color)';
            resultDiv.textContent = '❌ ' + r.error;
        }
    });
}

// ─── CAMBIAR CONTRASEÑA PRIMERA VEZ ──────────────────────────────────────────

function setupCambiarPasswordListeners() {
    document.getElementById('cambiarPasswordBtn')?.addEventListener('click', async () => {
        const nueva = document.getElementById('nuevaPassword').value;
        const confirmar = document.getElementById('nuevaPasswordConfirm').value;
        const errorDiv = document.getElementById('cambiarPasswordError');
        const btn = document.getElementById('cambiarPasswordBtn');

        errorDiv.style.display = 'none';

        if (nueva.length < 6) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'La contraseña debe tener mínimo 6 caracteres';
            return;
        }
        if (nueva !== confirmar) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Las contraseñas no coinciden';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const r = await storage.cambiarPasswordPrimeraVez(nueva);

        btn.disabled = false;
        btn.textContent = 'Guardar contraseña';

        if (r.exito) {
            window._usuarioActual.estado = 'activo';
            document.getElementById('cambiarPasswordModalOverlay').classList.remove('active');
            document.getElementById('nuevaPassword').value = '';
            document.getElementById('nuevaPasswordConfirm').value = '';
        } else {
            errorDiv.style.display = 'block';
            errorDiv.textContent = r.error;
        }
    });
}
