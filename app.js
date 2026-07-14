// app.js - Lógica principal (Firestore async/await)

document.addEventListener('DOMContentLoaded', () => {
 const splash = document.getElementById('splashScreen');
 if (splash) {
 setTimeout(() => {
 splash.classList.add('fade-out');
 setTimeout(() => splash.remove(), 650);
 }, 1967);
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
 setupEventListeners();

 // Además de limpiar al iniciar sesión, repetir cada 10 min mientras la app
 // esté abierta: si alguien deja la app abierta todo el día, las reservas de
 // clases que ya pasaron igual se van borrando sin necesidad de recargar.
 setInterval(() => {
 if (window._usuarioActual) storage.limpiarReservasPasadas().catch(() => {});
 }, 10 * 60 * 1000);

 // Usar Firebase Auth para saber si hay sesión activa
 window.authSDK.onAuthStateChanged(async (firebaseUser) => {
 try {
 if (firebaseUser) {
 const usuario = await storage.buscarUsuarioPorEmail(firebaseUser.email);
 if (usuario) {
 window._usuarioActual = usuario;
 // Limpiar reservas pasadas solo cuando hay sesión activa
 storage.limpiarReservasPasadas().catch(() => {});
 if (usuario.estado === 'pendiente') {
 mostrarPantalla('dashboard');
 await cargarDashboard(usuario);
 document.getElementById('cambiarPasswordModalOverlay').classList.add('active');
 } else {
 mostrarPantalla('dashboard');
 await cargarDashboard(usuario);
 }
 } else {
 console.warn('Sesión de Firebase Auth activa pero no existe el documento en Firestore para:', firebaseUser.email);
 mostrarPantalla('login');
 }
 } else {
 window._usuarioActual = null;
 mostrarPantalla('login');
 }
 } catch (err) {
 console.error('Error al cargar la sesión:', err);
 mostrarPantalla('login');
 alert('No se pudo cargar tu perfil. Revisa tu conexión a internet e intenta de nuevo.');
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
 setupBannerEventoListeners();

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

}

// ─── LOGIN / REGISTRO ─────────────────────────────────────────────────────────

async function handleLogin() {
 const email = document.getElementById('loginEmail').value.trim();
 const password = document.getElementById('loginPassword').value;
 if (!email || !password) { alert('Por favor completa todos los campos'); return; }
 try {
 const usuario = await storage.validarLogin(email, password);
 if (usuario) {
 window._usuarioActual = usuario;
 document.getElementById('loginForm').reset();
 // onAuthStateChanged en initializeApp maneja la navegación automáticamente
 } else {
 alert('Email o contraseña incorrectos');
 }
 } catch (err) {
 console.error('Login: la contraseña era correcta pero falló la carga del perfil:', err);
 alert('Iniciaste sesión pero no pudimos cargar tu perfil. Revisa tu conexión e intenta de nuevo.');
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
 events: async () => { document.getElementById('eventsSection').classList.add('active'); await cargarEventos(); },
 games: async () => { document.getElementById('gamesSection').classList.add('active'); await cargarPuntuaciones(); },
 members: async () => { document.getElementById('membersSection').classList.add('active'); await cargarMiembros(); },
 coaches: async () => { document.getElementById('coachesSection').classList.add('active'); await cargarCoaches(); },
 challenge: async () => { document.getElementById('challengeSection').classList.add('active'); await cargarReto(); },
 myChallenge: async () => { document.getElementById('myChallengeSection').classList.add('active'); await cargarRetoPerfil(window._usuarioActual); },
 reporte: async () => { document.getElementById('reporteSection').classList.add('active'); await cargarReporte(); }
 };
 if (mapa[nombreSeccion]) await mapa[nombreSeccion]();
}

// ─── PERFIL / DASHBOARD ───────────────────────────────────────────────────────

function pintarPerfil(usuario) {
 const seccion = document.getElementById('profileSection');
 const rolText = { usuario: 'Miembro', entrenador: 'Entrenador', dueño: 'Dueño' }[usuario.rol] || usuario.rol;
 const vigente = usuario.rol === 'usuario' ? storage.membresiaVigente(usuario) : null;

 seccion.querySelector('.card').innerHTML = `
     <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06);">
         <div style="font-size:22px;font-weight:800;margin-bottom:4px;letter-spacing:-0.3px;">${usuario.nombre}</div>
         <div style="font-size:13px;color:var(--primary-color);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${rolText}</div>
     </div>
     <div class="profile-row">
         <span class="profile-row-label">Email</span>
         <span class="profile-row-value" style="font-size:14px;word-break:break-all;">${usuario.email}</span>
     </div>
     ${usuario.rol === 'usuario' && vigente !== null ? `
     <div class="profile-row">
         <span class="profile-row-label">Membresia</span>
         <span class="profile-row-value">
             <span class="badge ${vigente ? 'badge-active' : 'badge-inactive'}">${vigente ? 'Vigente' : 'Vencida'}</span>
             ${usuario.membresia_vence ? `<span style="font-size:12px;color:var(--text-light);margin-left:8px;">hasta ${usuario.membresia_vence}</span>` : ''}
         </span>
     </div>` : ''}
 `;
}

async function cargarDashboard(usuario) {
 pintarPerfil(usuario);
 const coachesMenuItem = document.getElementById('coachesMenuItem');
 if (coachesMenuItem) coachesMenuItem.style.display = usuario.rol === 'dueño' ? 'block' : 'none';
 const membersMenuItem = document.getElementById('membersMenuItem');
 if (membersMenuItem) membersMenuItem.style.display = (usuario.rol === 'entrenador' || usuario.rol === 'dueño') ? 'block' : 'none';
 const challengeMenuItem = document.getElementById('challengeMenuItem');
 if (challengeMenuItem) challengeMenuItem.style.display = (usuario.rol === 'entrenador' || usuario.rol === 'dueño') ? 'flex' : 'none';
 const myChallengeMenuItem = document.getElementById('myChallengeMenuItem');
 if (myChallengeMenuItem) {
 if (usuario.rol === 'usuario') {
 const participante = await storage.obtenerParticipanteReto(usuario.id);
 myChallengeMenuItem.style.display = participante ? 'flex' : 'none';
 } else {
 myChallengeMenuItem.style.display = 'none';
 }
 }

 // Mostrar nombre y rol en header del menú
 const menuUserName = document.getElementById('menuUserName');
 const menuUserRole = document.getElementById('menuUserRole');
 const rolText = { usuario: 'Miembro', entrenador: 'Entrenador', dueño: 'Dueño' }[usuario.rol] || usuario.rol;
 if (menuUserName) menuUserName.textContent = usuario.nombre;
 if (menuUserRole) menuUserRole.textContent = rolText;
 // Reporte oculto hasta activar
 // const reporteMenuItem = document.getElementById('reporteMenuItem');
 // if (reporteMenuItem) reporteMenuItem.style.display = usuario.rol === 'dueño' ? 'block' : 'none';
 await cambiarSeccion('profile');
 revisarBannerEvento();
}

// ─── BANNER DE EVENTO PRÓXIMO ──────────────────────────────────────────────────

let eventoBannerActual = null;

async function revisarBannerEvento() {
 const modal = document.getElementById('eventoBannerModalOverlay');
 if (!modal) return;

 // Solo para miembros: coaches y dueño no necesitan este recordatorio
 if (!window._usuarioActual || window._usuarioActual.rol !== 'usuario') {
 modal.classList.remove('active');
 return;
 }

 try {
 const eventos = await storage.obtenerEventosActivos();
 const hoy = new Date();
 hoy.setHours(0, 0, 0, 0);

 let candidato = null;
 let candidatoDiff = Infinity;

 eventos.forEach(evento => {
 if (!evento.fecha) return;
 const fechaEvento = new Date(evento.fecha + 'T00:00:00');
 const diffDias = Math.round((fechaEvento - hoy) / 86400000);
 if (diffDias < 0) return; // ya pasó, ignorar

 const yaVisto = localStorage.getItem('evento_visto_' + evento.id) === 'true';
 const esNuevo = !yaVisto;
 const enVentanaRecordatorio = diffDias <= 3;

 if ((esNuevo || enVentanaRecordatorio) && diffDias < candidatoDiff) {
 candidato = evento;
 candidatoDiff = diffDias;
 }
 });

 if (!candidato) {
 modal.classList.remove('active');
 eventoBannerActual = null;
 return;
 }

 eventoBannerActual = candidato;
 const sub = candidatoDiff === 0 ? '¡Es hoy!' : candidatoDiff === 1 ? 'Es mañana' : `Faltan ${candidatoDiff} días`;
 document.getElementById('eventoBannerTitulo').textContent = candidato.nombre || 'Evento';
 document.getElementById('eventoBannerSubtitulo').textContent = `${candidato.fecha}${candidato.hora ? ' a las ' + candidato.hora : ''} · ${sub}`;
 modal.classList.add('active');

 localStorage.setItem('evento_visto_' + candidato.id, 'true');
 } catch (err) {
 // Si algo falla, simplemente no se muestra el banner (no es crítico)
 }
}

function setupBannerEventoListeners() {
 document.getElementById('eventoBannerCerrarBtn')?.addEventListener('click', () => {
 document.getElementById('eventoBannerModalOverlay').classList.remove('active');
 });
 document.getElementById('eventoBannerModalOverlay')?.addEventListener('click', e => {
 if (e.target.id === 'eventoBannerModalOverlay') e.target.classList.remove('active');
 });
 document.getElementById('eventoBannerSaberMasBtn')?.addEventListener('click', async () => {
 const evento = eventoBannerActual;
 document.getElementById('eventoBannerModalOverlay').classList.remove('active');
 await cambiarSeccion('events');
 document.querySelectorAll('.menu-item[data-screen]').forEach(el => el.classList.remove('active'));
 document.getElementById('eventsMenuItem')?.classList.add('active');
 if (evento) {
 const el = document.getElementById('evento-' + evento.id);
 if (el) {
 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
 el.classList.add('evento-banner-highlight');
 setTimeout(() => el.classList.remove('evento-banner-highlight'), 2000);
 }
 }
 });
}

async function cargarPerfil() {
 const usuario = window._usuarioActual;
 if (usuario) {
     pintarPerfil(usuario);
 }
}

// ─── RETO 90 DÍAS (vista del miembro) ──────────────────────────────────────────

let graficaRetoMiembro = null;

async function cargarRetoPerfil(usuario) {
 const card = document.getElementById('retoMiembroCard');
 const contenido = document.getElementById('retoMiembroContenido');
 if (!card || !contenido || !usuario) return;

 const participante = await storage.obtenerParticipanteReto(usuario.id);
 if (!participante) {
     contenido.innerHTML = `<p class="empty-state">Aún no estás inscrito en el Reto 90 Días. Pregúntale a tu coach si quieres sumarte 💪</p>`;
     return;
 }

 const ini = participante.medidas_iniciales;
 const fin = participante.medidas_finales;

 if (!ini) {
     contenido.innerHTML = `<p class="empty-state">Ya estás inscrito en el reto (desde ${participante.fechaIngreso}). Tu coach registrará tus medidas iniciales en tu próxima sesión.</p>`;
     return;
 }

 const campos = [
     { key: 'peso',     label: 'Peso (kg)' },
     { key: 'estatura', label: 'Estatura (cm)' },
     { key: 'brazos',   label: 'Brazos (cm)' },
     { key: 'cintura',  label: 'Cintura (cm)' },
     { key: 'cuello',   label: 'Cuello (cm)' },
     { key: 'piernas',  label: 'Piernas (cm)' }
 ];

 if (!fin) {
     // Solo hay medidas iniciales todavía
     let html = `<p style="font-size:13px;color:var(--text-light);margin-bottom:12px;">Estas son tus medidas iniciales, tomadas el ${ini.fecha}. Cuando termines el reto, tu coach registrará tus medidas finales y aquí vas a poder ver tu comparación completa.</p>`;
     campos.forEach(campo => {
         html += `<div class="challenge-stat-row"><span class="challenge-stat-label">${campo.label}</span><div class="challenge-stat-values"><span>${ini[campo.key] ?? '—'}</span></div></div>`;
     });
     contenido.innerHTML = html;
     return;
 }

 // Ya hay medidas iniciales y finales: comparación completa + gráfica
 const progreso = storage.calcularProgreso(participante);

 let html = `<p style="font-size:13px;color:var(--text-light);margin-bottom:12px;">Del ${ini.fecha} al ${fin.fecha}. Así evolucionaron tus medidas:</p>`;
 html += `<div style="margin-bottom:16px;"><div style="display:flex;justify-content:flex-end;gap:24px;font-size:12px;color:var(--text-light);font-weight:600;margin-bottom:4px;"><span>Inicial</span><span>Final</span><span>Cambio</span></div>`;
 campos.forEach(campo => {
     const prog = progreso?.[campo.key];
     let deltaHtml = '<span style="color:var(--text-light);font-size:12px;">—</span>';
     if (prog?.cambio != null) {
         const delta = parseFloat(prog.cambio);
         deltaHtml = `<span class="challenge-stat-delta ${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${prog.cambio}%</span>`;
     }
     html += `<div class="challenge-stat-row"><span class="challenge-stat-label">${campo.label}</span><div class="challenge-stat-values"><span>${ini[campo.key] ?? '—'}</span><span>${fin[campo.key] ?? '—'}</span>${deltaHtml}</div></div>`;
 });
 html += '</div>';
 html += '<canvas id="graficaRetoMiembro" style="width:100%;max-height:240px;"></canvas>';
 contenido.innerHTML = html;

 // Gráfica: comparación inicial vs final (se excluye estatura, casi no cambia en 90 días)
 const camposGrafica = campos.filter(c => c.key !== 'estatura');
 const canvas = document.getElementById('graficaRetoMiembro');
 if (!canvas) return;

 if (graficaRetoMiembro) {
     graficaRetoMiembro.destroy();
     graficaRetoMiembro = null;
 }

 graficaRetoMiembro = new Chart(canvas, {
     type: 'bar',
     data: {
         labels: camposGrafica.map(c => c.label.replace(/\s*\(.*\)/, '')),
         datasets: [
             {
                 label: 'Inicial',
                 data: camposGrafica.map(c => ini[c.key] ?? 0),
                 backgroundColor: 'rgba(255,255,255,0.25)',
                 borderRadius: 4
             },
             {
                 label: 'Final',
                 data: camposGrafica.map(c => fin[c.key] ?? 0),
                 backgroundColor: '#c1fe40',
                 borderRadius: 4
             }
         ]
     },
     options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: {
             legend: { labels: { color: '#aaa', font: { size: 11 } } }
         },
         scales: {
             x: {
                 ticks: { color: '#888', font: { size: 10 } },
                 grid: { display: false }
             },
             y: {
                 ticks: { color: '#888' },
                 grid: { color: 'rgba(255,255,255,0.05)' },
                 beginAtZero: true
             }
         }
     }
 });
}

// ─── CLASES ───────────────────────────────────────────────────────────────────

function obtenerProximosDias(n) {
 const dias = [];
 const nombres = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 let cursor = new Date();
 while (dias.length < n) {
 const dia = cursor.getDay();
 const y = cursor.getFullYear();
 const m = String(cursor.getMonth()+1).padStart(2,'0');
 const d = String(cursor.getDate()).padStart(2,'0');
 dias.push({ fecha: `${y}-${m}-${d}`, etiqueta: `${nombres[dia]} ${d}/${m}` });
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

 const dias = obtenerProximosDias(7);

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

 // Fin de semana: no hay clases ese día, mostrar aviso y acceso directo al próximo día hábil
 if (!storage.esDiaHabil(diaActual.fecha)) {
 const indiceProximo = dias.findIndex((d, i) => i > diaSeleccionadoClases && storage.esDiaHabil(d.fecha));
 const fragment = document.createDocumentFragment();
 const aviso = document.createElement('div');
 aviso.className = 'empty-state';
 aviso.innerHTML = `Hoy no hay clases, pero puedes agendar para la próxima clase.`;
 fragment.appendChild(aviso);
 if (indiceProximo !== -1) {
 const btnProximo = document.createElement('button');
 btnProximo.className = 'btn btn-primary';
 btnProximo.style.marginTop = '10px';
 btnProximo.textContent = `Ver clases del ${dias[indiceProximo].etiqueta}`;
 btnProximo.addEventListener('click', () => { diaSeleccionadoClases = indiceProximo; cargarClases(); });
 fragment.appendChild(btnProximo);
 }
 classesList.innerHTML = '';
 classesList.appendChild(fragment);
 return;
 }

 const horarios = storage.obtenerHorariosClases();
 const esCoachODueño = usuario.rol === 'entrenador' || usuario.rol === 'dueño';

 // Traer TODAS las reservas del día en una sola consulta
 const todasReservas = await storage.obtenerReservasPorFecha(diaActual.fecha);
 const reservasUsuario = todasReservas.filter(r => r.usuarioId === usuario.id);

 // Construir todo en un fragment y luego insertar de una sola vez
 const fragment = document.createDocumentFragment();

 for (const horario of horarios) {
 const classItem = document.createElement('div');
 classItem.className = 'class-item';

 const reservasHora = todasReservas.filter(r => r.hora === horario.hora);
 const cupos = Math.max(0, 20 - reservasHora.length);
 const yaPaso = storage.claseYaPaso(diaActual.fecha, horario.hora);
 const puedeModificar = storage.puedeModificarReserva(diaActual.fecha, horario.hora);
 const anotado = usuario.rol === 'usuario' && reservasUsuario.some(r => r.hora === horario.hora);
 const totalAnotados = reservasHora.length;

 let infoHtml = `<div class="class-time">${horario.etiqueta}</div>
 <div class="class-status">Cupos disponibles: ${cupos} / 20</div>`;
 if (yaPaso) infoHtml += `<div class="class-status">Esta clase ya pasó</div>`;
 else if (anotado) infoHtml += `<div class="class-status" style="color:var(--success-color);">Estás anotado</div>`;
 if (!puedeModificar && !yaPaso && anotado) infoHtml += `<div class="class-status">Ya no puedes cancelar (faltan menos de 15 min)</div>`;

 classItem.innerHTML = infoHtml;

 if (esCoachODueño) {
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
 actionBtn.textContent = 'Cancelar';
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

 fragment.appendChild(classItem);
 }

 classesList.innerHTML = '';
 classesList.appendChild(fragment);
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
 item.id = 'evento-' + evento.id;
 if (esCoachODueño && !evento.activo) item.style.opacity = '0.55';

 let detallesHtml = `<div class="event-name">${evento.nombre || 'Evento'}${esCoachODueño && !evento.activo ? ' <span style="color:var(--text-light);font-size:12px;">(Inactivo)</span>' : ''}</div>`;

 if (evento.fecha) {
 detallesHtml += `<div class="event-detail"> ${evento.fecha}${evento.hora ? ' a las ' + evento.hora : ''}</div>`;
 }
 if (evento.ubicacion) {
 detallesHtml += `<div class="event-detail">📍 ${evento.ubicacion}</div>`;
 }
 if (evento.costo_extra) {
 detallesHtml += `<div class="event-detail"> Costo adicional: $${evento.costo_extra}</div>`;
 }
 if (evento.incluye_desayuno) {
 detallesHtml += `<div class="event-detail">🍽️ Incluye desayuno y bebida</div>`;
 }
 if (Array.isArray(evento.campos_extra)) {
 evento.campos_extra.forEach(campo => {
 if (campo && campo.titulo && campo.valor) {
 detallesHtml += `<div class="event-detail">${campo.titulo}: ${campo.valor}</div>`;
 }
 });
 }

 item.innerHTML = detallesHtml;

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

 const deleteBtn = document.createElement('button');
 deleteBtn.className = 'btn';
 deleteBtn.textContent = 'Eliminar';
 deleteBtn.style.cssText = 'flex:1;background-color:#333;color:var(--danger-color);border:1px solid var(--danger-color);';
 deleteBtn.addEventListener('click', async () => {
     if (!confirm('¿Seguro que deseas eliminar este evento? Esta accion no se puede deshacer.')) return;
     const r = await storage.eliminarEvento(evento.id);
     if (r.exito) cargarEventos(); else alert(r.error);
 });

 controls.appendChild(editBtn);
 controls.appendChild(toggleBtn);
 controls.appendChild(deleteBtn);
 item.appendChild(controls);
 }

 eventsList.appendChild(item);
 });
}

// ─── CAMPOS EXTRA DEL EVENTO (dinámicos) ───────────────────────────────────────

function crearFilaCampoExtra(titulo = '', valor = '') {
 const fila = document.createElement('div');
 fila.className = 'extra-field-row';
 fila.style.cssText = 'display:flex;gap:6px;align-items:center;';
 fila.innerHTML = `
 <input type="text" class="extra-field-titulo" placeholder="Título (ej. Requiere transporte)" value="${titulo.replace(/"/g, '&quot;')}" style="flex:1;">
 <input type="text" class="extra-field-valor" placeholder="Valor (ej. Sí, salimos 7am)" value="${valor.replace(/"/g, '&quot;')}" style="flex:1;">
 <button type="button" class="extra-field-remove" aria-label="Quitar campo" style="background:none;border:none;color:var(--danger-color);font-size:18px;cursor:pointer;padding:4px 8px;flex-shrink:0;">✕</button>
 `;
 fila.querySelector('.extra-field-remove').addEventListener('click', () => fila.remove());
 document.getElementById('extraFieldsContainer').appendChild(fila);
}

function recolectarCamposExtra() {
 const filas = document.querySelectorAll('#extraFieldsContainer .extra-field-row');
 const campos = [];
 filas.forEach(fila => {
 const titulo = fila.querySelector('.extra-field-titulo').value.trim();
 const valor = fila.querySelector('.extra-field-valor').value.trim();
 if (titulo && valor) campos.push({ titulo, valor });
 });
 return campos;
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
 document.getElementById('extraFieldsContainer').innerHTML = '';
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
 if (Array.isArray(evento.campos_extra)) {
 evento.campos_extra.forEach(campo => crearFilaCampoExtra(campo.titulo, campo.valor));
 }
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
 link_maps: document.getElementById('eventMapsLink').value.trim(),
 campos_extra: recolectarCamposExtra()
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
 document.getElementById('addExtraFieldBtn')?.addEventListener('click', () => crearFilaCampoExtra());
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

// ─── COMPARTIR CREDENCIALES (coach / miembro nuevo) ───────────────────────────

function mostrarCompartirCredenciales({ nombre, email, passwordTemporal, tipoLabel }) {
 const APP_URL = 'https://fit-manyacts.web.app';
 const mensaje = `¡Bienvenido a FITMANYACTS! 💪\n\n` +
 `Ya tienes acceso a la app como ${tipoLabel}.\n\n` +
 `App: ${APP_URL}\n` +
 `Correo: ${email}\n` +
 `Contraseña temporal: ${passwordTemporal}\n\n` +
 `Al iniciar sesión por primera vez te pedirá cambiarla.`;

 document.getElementById('compartirCredencialesTitulo').textContent = `${tipoLabel === 'coach' ? 'Coach' : 'Miembro'} agregado`;
 document.getElementById('compartirCredencialesEmail').textContent = email;
 document.getElementById('compartirCredencialesPassword').textContent = passwordTemporal;

 const overlay = document.getElementById('compartirCredencialesModalOverlay');
 overlay.classList.add('active');

 const shareBtn = document.getElementById('compartirCredencialesShareBtn');
 shareBtn.style.display = (navigator.share) ? 'block' : 'none';
 shareBtn.onclick = async () => {
 try {
 await navigator.share({ title: 'Acceso a FITMANYACTS', text: mensaje });
 } catch (err) {
 // El usuario cancelo el share o no fue soportado; no hacer nada
 }
 };

 document.getElementById('compartirCredencialesWhatsappBtn').onclick = () => {
 window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
 };

 document.getElementById('compartirCredencialesGmailBtn').onclick = () => {
 const asunto = encodeURIComponent('Tu acceso a FITMANYACTS');
 const cuerpo = encodeURIComponent(mensaje);
 window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${asunto}&body=${cuerpo}`, '_blank');
 };

 document.getElementById('compartirCredencialesCopiarBtn').onclick = async () => {
 const btn = document.getElementById('compartirCredencialesCopiarBtn');
 try {
 await navigator.clipboard.writeText(mensaje);
 const original = btn.textContent;
 btn.textContent = '✔ Copiado';
 setTimeout(() => { btn.textContent = original; }, 1500);
 } catch (err) {
 alert('No se pudo copiar. Copia el texto manualmente:\n\n' + mensaje);
 }
 };
}

document.getElementById('compartirCredencialesCloseBtn')?.addEventListener('click', () => {
 document.getElementById('compartirCredencialesModalOverlay').classList.remove('active');
});

// ─── COACHES ──────────────────────────────────────────────────────────────────

async function handleAddCoach() {
 const nombre = document.getElementById('coachName').value.trim();
 const email = document.getElementById('coachEmail').value.trim();
 const resultDiv = document.getElementById('coachResult');
 const btn = document.getElementById('addCoachBtn');

 if (!nombre || !email) {
     resultDiv.style.display = 'block';
     resultDiv.style.color = 'var(--danger-color)';
     resultDiv.textContent = 'Por favor completa nombre y email';
     return;
 }

 btn.disabled = true;
 btn.textContent = 'Agregando...';
 resultDiv.style.display = 'none';

 const r = await storage.crearCoach({ nombre, email });

 btn.disabled = false;
 btn.textContent = 'Agregar Coach';

 if (r.exito) {
     resultDiv.style.display = 'none';
     btn.style.display = '';
     document.getElementById('coachName').value = '';
     document.getElementById('coachEmail').value = '';
     cargarCoaches();
     mostrarCompartirCredenciales({
         nombre: r.usuario.nombre,
         email: r.usuario.email,
         passwordTemporal: r.passwordTemporal,
         tipoLabel: 'coach'
     });
 } else {
     resultDiv.style.display = 'block';
     resultDiv.style.color = 'var(--danger-color)';
     resultDiv.textContent = r.error;
 }
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

 // Solo el dueño puede ver el botón de verificar ganadores
 const analyzeBtn = document.getElementById('analyzeBtn');
 const proximamenteIA = document.getElementById('proximamenteIA');
 if (window._usuarioActual?.rol === 'dueño') {
     if (analyzeBtn) analyzeBtn.style.display = 'block';
     if (proximamenteIA) proximamenteIA.style.display = 'block';
 }

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
 const sexoSelect = document.getElementById(prefijo + 'sexo');
 if (sexoSelect) sexoSelect.value = medidas?.sexo ?? '';
}

async function guardarMedidasReto(tipo) {
 if (!challengeParticipanteActual) return;
 const prefijo = tipo === 'inicial' ? 'cf_' : 'cff_';
 const medidas = {};
 ['edad','peso','estatura','brazos','cintura','cuello','piernas'].forEach(campo => {
 const input = document.getElementById(prefijo + campo);
 medidas[campo] = input?.value !== '' ? parseFloat(input.value) : null;
 });
 const sexoInput = document.getElementById(prefijo + 'sexo');
 if (sexoInput?.value) medidas['sexo'] = sexoInput.value;
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

 if (completos.length < 2) {
     alert('Se necesitan al menos 2 participantes con medidas iniciales y finales.');
     return;
 }

 resultContainer.style.display = 'block';
 resultContent.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div>Calculando resultados...</div>';
 analyzeBtn.disabled = true;

 const campos = ['peso', 'brazos', 'cintura', 'cuello', 'piernas'];
 const resultados = completos.map(p => {
     const progreso = storage.calcularProgreso(p);
     let puntos = 0;
     let detalles = [];
     campos.forEach(campo => {
         const prog = progreso?.[campo];
         if (prog?.cambio != null) {
             const cambio = parseFloat(prog.cambio);
             const esBueno = (campo === 'cintura' || campo === 'peso') ? cambio < 0 : cambio > 0;
             const puntaje = esBueno ? Math.abs(cambio) : -Math.abs(cambio) * 0.5;
             puntos += puntaje;
             if (Math.abs(cambio) > 0) detalles.push(`${campo}: ${cambio > 0 ? '+' : ''}${cambio}%`);
         }
     });
     return { nombre: p.nombre, puntos: Math.round(puntos * 10) / 10, detalles };
 });

 resultados.sort((a, b) => b.puntos - a.puntos);

 const medallas = ['1er lugar', '2do lugar', '3er lugar'];
 const colores = ['#FFD700', '#C0C0C0', '#CD7F32'];
 const frases = [
     'Demostro el mayor progreso proporcional en sus medidas durante el reto.',
     'Logro una mejora consistente a lo largo de los 90 dias.',
     'Mostro avances positivos en su composicion corporal.'
 ];

 let html = '<div style="padding: 4px 0;">';
 resultados.slice(0, 3).forEach((r, i) => {
     html += `<div style="border-left: 3px solid ${colores[i]}; padding: 12px; margin-bottom: 12px; background: rgba(255,255,255,0.03); border-radius: 0 8px 8px 0;">
         <div style="font-weight: 700; color: ${colores[i]}; margin-bottom: 4px;">${medallas[i]}: ${r.nombre}</div>
         <div style="font-size: 13px; color: var(--text-light);">Puntuacion total: ${r.puntos > 0 ? '+' : ''}${r.puntos} pts</div>
         <div style="font-size: 12px; color: var(--text-light); margin-top: 4px;">${r.detalles.join(' - ') || 'Sin cambios registrados'}</div>
         <div style="font-size: 12px; color: var(--text-light); margin-top: 6px;">${r.puntos > 0 ? frases[i] || frases[2] : 'No se registraron mejoras significativas.'}</div>
     </div>`;
 });
 if (resultados.length > 3) {
     html += `<div style="font-size: 13px; color: var(--text-light); margin-top: 8px;">Otros participantes: ${resultados.slice(3).map(r => r.nombre).join(', ')}</div>`;
 }
 html += '</div>';
 resultContent.innerHTML = html;
 analyzeBtn.disabled = false;
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
 resultDiv.style.display = 'none';
 btn.style.display = '';
 document.getElementById('invitarNombre').value = '';
 document.getElementById('invitarEmail').value = '';
 await cargarMiembros();
 mostrarCompartirCredenciales({
     nombre: r.nombre,
     email: email,
     passwordTemporal: r.passwordTemporal,
     tipoLabel: 'miembro'
 });
 } else {
 resultDiv.style.color = 'var(--danger-color)';
 resultDiv.textContent = r.error;
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

// ─── REPORTE ──────────────────────────────────────────────────────────────────

async function cargarReporte() {
    // Mostrar cargando
    ['statMiembrosActivos','statMiembrosInactivos','statMiembrosNuevos','statMiembrosPendientes',
     'statTotalReservas','statOcupacion','statCoaches','statReto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    setupGraficaListeners();
    actualizarGraficaInscripciones('semana');

    const stats = await storage.obtenerEstadisticas();

    document.getElementById('statMiembrosActivos').textContent = stats.miembrosActivos;
    document.getElementById('statMiembrosInactivos').textContent = stats.miembrosInactivos;
    document.getElementById('statMiembrosNuevos').textContent = stats.miembrosNuevos;
    document.getElementById('statMiembrosPendientes').textContent = stats.miembrosPendientes;
    document.getElementById('statTotalReservas').textContent = stats.totalReservasSemana;
    document.getElementById('statOcupacion').textContent = stats.ocupacionPct + '%';
    document.getElementById('statCoaches').textContent = stats.totalCoaches;
    document.getElementById('statReto').textContent = stats.totalReto;
    document.getElementById('statClasePopular').textContent = stats.clasePopular;

    // Membresías por vencer
    const vencerEl = document.getElementById('statMembresiasVencer');
    if (stats.porVencer.length === 0) {
        vencerEl.textContent = 'Ninguna membresia vence en los proximos 7 dias';
    } else {
        vencerEl.innerHTML = stats.porVencer
            .map(m => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                <span>${m.nombre}</span>
                <span style="color:var(--danger-color);font-size:13px;">Vence: ${m.membresia_vence}</span>
            </div>`).join('');
    }
}

// ─── GRÁFICA INSCRIPCIONES ────────────────────────────────────────────────────

let graficaInscripciones = null;

async function actualizarGraficaInscripciones(rango) {
    const { labels, datos } = await storage.obtenerInscripcionesPorRango(rango);
    const canvas = document.getElementById('graficaInscripciones');
    if (!canvas) return;

    if (graficaInscripciones) {
        graficaInscripciones.destroy();
        graficaInscripciones = null;
    }

    graficaInscripciones = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Inscripciones',
                data: datos,
                borderColor: '#c1fe40',
                backgroundColor: 'rgba(193, 254, 64, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#c1fe40',
                pointRadius: 4,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#888', font: { size: 10 }, maxRotation: 45 },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#888', stepSize: 1 },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    beginAtZero: true
                }
            }
        }
    });

    // Actualizar botones
    document.querySelectorAll('.rango-btn').forEach(btn => {
        const activo = btn.dataset.rango === rango;
        btn.style.background = activo ? 'var(--primary-color)' : 'transparent';
        btn.style.color = activo ? '#000' : 'var(--text-light)';
        btn.style.borderColor = activo ? 'var(--primary-color)' : 'var(--border-color)';
    });
}

function setupGraficaListeners() {
    document.querySelectorAll('.rango-btn').forEach(btn => {
        btn.addEventListener('click', () => actualizarGraficaInscripciones(btn.dataset.rango));
    });
}
