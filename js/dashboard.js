// Actualizar estadísticas del estudiante (actualizado)
function updateStudentStats(stats) {
    animateCounter('#studentMaterias', stats.materias_inscritas || 0);
    animateCounter('#studentPromedio', stats.promedio_general || 0);
    animateCounter('#studentTareasPendientes', stats.tareas_pendientes || 0);
    animateCounter('#studentCreditos', stats.creditos_obtenidos || 0);
}

// Actualizar materias del estudiante
function updateStudentSubjects(subjects) {
    // Buscar la tarjeta de Base de Datos específicamente
    const bdSubject = subjects.find(s => s.codigo === 'BD001');
    if (bdSubject) {
        updateBDSubjectCard(bdSubject);
    }

    // Actualizar sección de materias completa
    updateSubjectsGrid(subjects);
}

// Actualizar tarjeta específica de Base de Datos
function updateBDSubjectCard(subject) {
    const bdCard = document.querySelector('.subject-card');
    if (!bdCard) return;

    // Actualizar progreso
    const progressText = bdCard.querySelector('.progress-info span:last-child');
    const progressBar = bdCard.querySelector('.progress-fill');

    if (subject.total_sesiones > 0) {
        const progressPercent = Math.round((subject.sesiones_completadas / subject.total_sesiones) * 100);

        if (progressText) {
            progressText.textContent = `${progressPercent}% (${subject.sesiones_completadas}/${subject.total_sesiones} sesiones)`;
        }

        if (progressBar) {
            progressBar.style.width = progressPercent + '%';
        }
    }

    // Actualizar información del profesor
    const professorInfo = bdCard.querySelector('.current-topic p:nth-child(3)');
    if (professorInfo) {
        professorInfo.innerHTML = `<strong>Profesor:</strong> ${subject.profesor_nombre}`;
    }

    // Actualizar contador de tareas pendientes
    const pendingTasksCount = bdCard.querySelector('.pending-tasks h5');
    if (pendingTasksCount && subject.tareas_pendientes !== undefined) {
        pendingTasksCount.textContent = `Tareas Pendientes (${subject.tareas_pendientes}):`;
    }
}

// Actualizar grid de materias
function updateSubjectsGrid(subjects) {
    const subjectsGrid = document.querySelector('.subjects-grid');
    if (!subjectsGrid) return;

    subjectsGrid.innerHTML = '';

    subjects.forEach(subject => {
        const subjectCard = document.createElement('div');
        subjectCard.className = 'subject-card';

        const progressPercent = subject.total_sesiones > 0 ?
            Math.round((subject.sesiones_completadas / subject.total_sesiones) * 100) : 0;

        const gradeColor = subject.calificacion_final >= 8 ? '#10B981' :
            subject.calificacion_final >= 7 ? '#F59E0B' : '#EF4444';

        subjectCard.innerHTML = `
            <div class="subject-header">
                <div class="subject-icon">
                    <i class="fas ${getSubjectIcon(subject.codigo)}"></i>
                </div>
                <div class="subject-info">
                    <h3>${subject.nombre}</h3>
                    <p>${subject.codigo} • ${subject.profesor_nombre}</p>
                </div>
                <div class="subject-grade" style="color: ${gradeColor}">
                    ${subject.calificacion_final || '-'}
                </div>
            </div>
            
            <div class="subject-progress">
                <div class="progress-info">
                    <span>Progreso</span>
                    <span>${progressPercent}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>
            
            <div class="subject-stats">
                <div class="stat">
                    <span>${subject.creditos}</span>
                    <label>Créditos</label>
                </div>
                <div class="stat">
                    <span>${subject.tareas_pendientes || 0}</span>
                    <label>Tareas pendientes</label>
                </div>
                <div class="stat">
                    <span>${subject.total_sesiones || 0}</span>
                    <label>Sesiones</label>
                </div>
            </div>
        `;

        subjectsGrid.appendChild(subjectCard);
    });
}

// Obtener icono por código de materia
function getSubjectIcon(codigo) {
    const iconMap = {
        'BD001': 'fa-database',
        'MAT301': 'fa-calculator',
        'PROG201': 'fa-code',
        'LIT101': 'fa-book',
        'ENG201': 'fa-language',
        'FIS301': 'fa-atom'
    };

    return iconMap[codigo] || 'fa-book-open';
}

// Actualizar tareas pendientes del estudiante
function updateStudentPendingTasks(pendingTasks) {
    const tasksContainer = document.querySelector('.tasks-container');
    if (!tasksContainer) return;

    // Limpiar contenedor existente
    tasksContainer.innerHTML = '';

    pendingTasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.urgency_level}`;

        const urgencyColor = task.urgency_level === 'urgent' ? '#EF4444' :
            task.urgency_level === 'soon' ? '#F59E0B' : '#64748B';

        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-subject">
                    <i class="fas ${getSubjectIcon(task.materia_codigo)}"></i>
                    <span>${task.materia_nombre}</span>
                </div>
                <div class="task-due-date" style="color: ${urgencyColor}">
                    <i class="fas fa-clock"></i>
                    <span>Vence: ${new Date(task.fecha_entrega).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="task-content">
                <h3>${task.titulo}</h3>
                <p class="task-description">${task.descripcion || 'Sin descripción disponible'}</p>
                
                <div class="task-details">
                    <div class="task-meta">
                        <span><i class="fas ${task.tipo_evaluacion === 'rubrica' ? 'fa-table' : 'fa-file-alt'}"></i> ${task.tipo_evaluacion.charAt(0).toUpperCase() + task.tipo_evaluacion.slice(1)}</span>
                        <span><i class="fas fa-star"></i> ${task.puntaje_maximo} puntos</span>
                        <span><i class="fas fa-user"></i> ${task.profesor_nombre}</span>
                    </div>
                </div>
                
                <div class="task-actions">
                    ${task.rubrica_id ? `
                        <button class="btn btn-outline-primary" onclick="viewTaskDetailsDB(${task.id})">
                            <i class="fas fa-eye"></i> Ver Detalles
                        </button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="submitTaskDB(${task.id})">
                        <i class="fas fa-upload"></i> Entregar Trabajo
                    </button>
                </div>
            </div>
        `;

        tasksContainer.appendChild(taskCard);
    });
}

// Actualizar próximas clases
function updateUpcomingClasses(classes) {
    const classesContainer = document.querySelector('.card-content');
    if (!classesContainer) return;

    const classesHTML = classes.map(clase => `
        <div class="class-item">
            <div class="class-time">${clase.hora}</div>
            <div class="class-info">
                <h4>${clase.materia}</h4>
                <p>${clase.aula} - ${clase.profesor}</p>
                <small>${clase.tema}</small>
            </div>
        </div>
    `).join('');

    classesContainer.innerHTML = classesHTML;
}

// Funciones para interactuar con tareas desde el dashboard
async function viewTaskDetailsDB(taskId) {
    try {
        const response = await fetch(DASHBOARD_CONFIG.API_BASE_URL + DASHBOARD_CONFIG.DASHBOARD_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_task_details',
                task_id: taskId
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showTaskDetailsModal(data.data.task);
            } else {
                showNotification('Error: ' + data.message, 'error');
            }
        }
    } catch (error) {
        console.error('Error loading task details:', error);
        showNotification('Error al cargar detalles de la tarea', 'error');
    }
}

// Mostrar modal con detalles de la tarea
function showTaskDetailsModal(task) {
    // Crear modal dinámicamente si no existe
    let modal = document.getElementById('taskDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'taskDetailsModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>${task.titulo}</h3>
                <button class="modal-close" onclick="closeModal('taskDetailsModal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="task-details-content">
                    <div class="task-info-section">
                        <h4>Información de la Tarea</h4>
                        <div class="info-grid">
                            <div><strong>Materia:</strong> ${task.materia_nombre} (${task.materia_codigo})</div>
                            <div><strong>Sesión:</strong> ${task.sesion_titulo}</div>
                            <div><strong>Subtema:</strong> ${task.subtema || 'No especificado'}</div>
                            <div><strong>Profesor:</strong> ${task.profesor_nombre}</div>
                            <div><strong>Fecha de entrega:</strong> ${new Date(task.fecha_entrega).toLocaleString()}</div>
                            <div><strong>Puntaje máximo:</strong> ${task.puntaje_maximo} puntos</div>
                        </div>
                    </div>
                    
                    ${task.descripcion ? `
                        <div class="task-description-section">
                            <h4>Descripción</h4>
                            <p>${task.descripcion}</p>
                        </div>
                    ` : ''}
                    
                    ${task.instrucciones ? `
                        <div class="task-instructions-section">
                            <h4>Instrucciones</h4>
                            <div class="instructions-content">${task.instrucciones.replace(/\n/g, '<br>')}</div>
                        </div>
                    ` : ''}
                    
                    ${task.rubrica ? `
                        <div class="rubric-preview-section">
                            <h4><i class="fas fa-table"></i> Rúbrica de Evaluación</h4>
                            ${generateRubricPreview(task.rubrica)}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('taskDetailsModal')">Cerrar</button>
                <button class="btn btn-primary" onclick="submitTaskDB(${task.id})">
                    <i class="fas fa-upload"></i> Entregar Trabajo
                </button>
            </div>
        </div>
    `;

    showModal('taskDetailsModal');
}

// Generar preview de la rúbrica
function generateRubricPreview(rubrica) {
    let html = `
        <div class="rubric-preview">
            <p><strong>Título:</strong> ${rubrica.titulo}</p>
            <p><strong>Descripción:</strong> ${rubrica.descripcion}</p>
            
            <div class="criteria-summary">
    `;

    rubrica.criterios.forEach(criterio => {
        html += `
            <div class="criterion-item">
                <span class="criterion-name">${criterio.nombre}</span>
                <span class="criterion-weight">${criterio.peso_porcentaje}%</span>
            </div>
        `;
    });

    html += `
            </div>
            
            <div class="performance-levels">
                <div class="level-badge level-excellent">Excelente (10)</div>
                <div class="level-badge level-very-good">Muy bueno (9)</div>
                <div class="level-badge level-acceptable">Aceptable (8)</div>
                <div class="level-badge level-regular">Regular (7)</div>
                <div class="level-badge level-failing">Reprobatorio (≤6)</div>
            </div>
            
            <div class="student-tips">
                <h5><i class="fas fa-lightbulb"></i> Consejos para el éxito:</h5>
                <ul>
    `;

    rubrica.criterios.forEach(criterio => {
        html += `<li><strong>${criterio.nombre}:</strong> ${getCriterionTip(criterio.nombre)}</li>`;
    });

    html += `
                </ul>
            </div>
        </div>
    `;

    return html;
}

// Obtener consejos específicos por criterio
function getCriterionTip(criterionName) {
    const tips = {
        'Dominio del tema': 'Investiga a fondo y practica explicar conceptos con ejemplos cotidianos',
        'Participación en equipo': 'Asegúrate de que todos los miembros participen equitativamente',
        'Argumentación y claridad': 'Usa un lenguaje claro y organiza las ideas secuencialmente',
        'Trabajo colaborativo': 'Practica las transiciones entre participantes y apóyense mutuamente',
        'Actitud/disposición': 'Muestra entusiasmo y mantén contacto visual con la audiencia'
    };

    return tips[criterionName] || 'Prepárate bien y da lo mejor de ti';
}

// Función para entregar tarea conectada a la BD
async function submitTaskDB(taskId) {
    // Cargar detalles de la tarea primero
    try {
        const response = await fetch(DASHBOARD_CONFIG.API_BASE_URL + DASHBOARD_CONFIG.DASHBOARD_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_task_details',
                task_id: taskId
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showSubmissionModal(data.data.task);
            } else {
                showNotification('Error: ' + data.message, 'error');
            }
        }
    } catch (error) {
        console.error('Error loading task for submission:', error);
        showNotification('Error al cargar la tarea', 'error');
    }
}

// Mostrar modal de entrega con datos de la tarea
function showSubmissionModal(task) {
    const modal = document.getElementById('submitTaskModal');
    if (!modal) return;

    // Actualizar título del modal
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = `Entregar Tarea: ${task.titulo}`;
    }

    // Actualizar información de la tarea en el modal
    const taskTopicInput = document.getElementById('presentationTopic');// Configuración global del dashboard (actualizada)
    const DASHBOARD_CONFIG = {
        ANIMATION_DURATION: 300,
        AUTO_SAVE_INTERVAL: 30000, // 30 segundos
        NOTIFICATION_DURATION: 5000,
        API_BASE_URL: window.location.origin + '/',
        TASKS_ENDPOINT: 'tasks.php',
        AUTH_ENDPOINT: 'auth.php',
        DASHBOARD_ENDPOINT: 'dashboard-api.php'
    };

    // Estado global de la aplicación
    let currentUser = null;
    let sidebarCollapsed = false;
    let activeSection = 'dashboard';
    let notifications = [];

    // Elementos del DOM
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuToggle = document.getElementById('menuToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const pageTitle = document.getElementById('pageTitle');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');

    // Inicialización cuando el DOM está cargado
    document.addEventListener('DOMContentLoaded', function () {
        initializeDashboard();
    });

    // Función principal de inicialización
    function initializeDashboard() {
        checkAuthentication();
        loadUserData();
        setupEventListeners();
        initializeNotifications();
        loadDashboardData();
        setupResponsiveHandlers();
        startAutoSave();

        // Validar sesión con el servidor periódicamente
        startSessionValidation();
    }

    // Validar sesión periódicamente
    function startSessionValidation() {
        setInterval(async () => {
            const isValid = await validateCurrentSession();
            if (!isValid) {
                showNotification('Sesión expirada. Redirigiendo al login...', 'warning');
                setTimeout(() => {
                    sessionStorage.clear();
                    window.location.href = 'index.html';
                }, 2000);
            }
        }, 300000); // Cada 5 minutos
    }

    // Validar sesión actual con el servidor
    async function validateCurrentSession() {
        const userData = sessionStorage.getItem('currentUser');
        if (!userData) return false;

        try {
            const user = JSON.parse(userData);
            const response = await fetch(DASHBOARD_CONFIG.API_BASE_URL + DASHBOARD_CONFIG.AUTH_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'validate',
                    token: user.session_token
                })
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error validating session:', error);
            return false;
        }
    }

    // Verificar autenticación
    function checkAuthentication() {
        const userData = sessionStorage.getItem('currentUser');

        if (!userData) {
            // Usuario no autenticado, redireccionar al login
            window.location.href = 'index.html';
            return;
        }

        try {
            currentUser = JSON.parse(userData);
        } catch (error) {
            console.error('Error parsing user data:', error);
            window.location.href = 'index.html';
            return;
        }
    }

    // Cargar datos del usuario en la interfaz
    function loadUserData() {
        if (!currentUser) return;

        userName.textContent = currentUser.name;
        userRole.textContent = capitalizeFirst(currentUser.role);

        // Generar avatar con iniciales
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userAvatar.src = `https://via.placeholder.com/40x40/4F46E5/white?text=${initials}`;
        userAvatar.alt = currentUser.name;

        // Personalizar interfaz según el rol
        customizeInterfaceByRole(currentUser.role);
    }

    // Personalizar interfaz según el rol del usuario
    function customizeInterfaceByRole(role) {
        const roleSpecificElements = {
            admin: ['usuarios', 'reportes', 'configuracion'],
            profesor: ['clases', 'estudiantes', 'evaluaciones'],
            estudiante: ['materias', 'calificaciones', 'horario']
        };

        // Mostrar/ocultar elementos según el rol
        const allowedSections = roleSpecificElements[role] || roleSpecificElements.estudiante;

        document.querySelectorAll('.nav-item').forEach(item => {
            const section = item.querySelector('a').dataset.section;
            if (!allowedSections.includes(section) && section !== 'dashboard' && section !== 'perfil') {
                item.style.display = 'none';
            }
        });
    }

    // Configurar event listeners
    function setupEventListeners() {
        // Navegación del sidebar
        setupSidebarNavigation();

        // Toggle del sidebar
        sidebarToggle.addEventListener('click', toggleSidebar);
        menuToggle.addEventListener('click', toggleMobileSidebar);

        // Logout
        logoutBtn.addEventListener('click', handleLogout);

        // Búsqueda
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
            searchInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    performSearch(this.value);
                }
            });
        }

        // Notificaciones
        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', toggleNotifications);
        }

        // Perfil dropdown
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.addEventListener('click', toggleProfileDropdown);
        }

        // Click fuera para cerrar dropdowns
        document.addEventListener('click', handleOutsideClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // Configurar navegación del sidebar
    function setupSidebarNavigation() {
        const navItems = document.querySelectorAll('.nav-item a');

        navItems.forEach(item => {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                const section = this.dataset.section;
                if (section) {
                    navigateToSection(section);
                }
            });
        });
    }

    // Navegar a una sección específica
    function navigateToSection(sectionName) {
        if (activeSection === sectionName) return;

        // Actualizar estado activo en navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeNavItem) {
            activeNavItem.parentElement.classList.add('active');
        }

        // Ocultar sección actual
        const currentSection = document.getElementById(`${activeSection}-section`);
        if (currentSection) {
            currentSection.classList.remove('active');
        }

        // Mostrar nueva sección
        const newSection = document.getElementById(`${sectionName}-section`);
        if (newSection) {
            newSection.classList.add('active');
            activeSection = sectionName;

            // Actualizar título
            pageTitle.textContent = capitalizeFirst(sectionName);

            // Cargar datos específicos de la sección
            loadSectionData(sectionName);

            // Actualizar URL sin recargar página
            updateURL(sectionName);
        }
    }

    // Cargar datos específicos de cada sección
    function loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'materias':
                loadMateriasData();
                break;
            case 'calificaciones':
                loadCalificacionesData();
                break;
            case 'horario':
                loadHorarioData();
                break;
            case 'perfil':
                loadPerfilData();
                break;
            default:
                console.log(`Loading data for ${sectionName}`);
        }
    }

    // Cargar datos del dashboard
    function loadDashboardData() {
        // Simular carga de datos
        updateStatsCards();
        loadRecentClasses();
        loadRecentTasks();
    }

    // Actualizar tarjetas de estadísticas
    function updateStatsCards() {
        const stats = {
            materias: Math.floor(Math.random() * 10) + 5,
            promedio: (Math.random() * 2 + 8).toFixed(1),
            tareas: Math.floor(Math.random() * 20) + 5,
            creditos: Math.floor(Math.random() * 50) + 120
        };

        // Animar contadores
        animateCounter('.stat-card:nth-child(1) h3', stats.materias);
        animateCounter('.stat-card:nth-child(2) h3', stats.promedio);
        animateCounter('.stat-card:nth-child(3) h3', stats.tareas);
        animateCounter('.stat-card:nth-child(4) h3', stats.creditos);
    }

    // Cargar clases recientes
    function loadRecentClasses() {
        const classes = [
            { time: '09:00 AM', subject: 'Matemáticas Avanzadas', location: 'Aula 201', professor: 'Prof. García' },
            { time: '11:00 AM', subject: 'Programación Web', location: 'Lab 3', professor: 'Prof. Martínez' },
            { time: '02:00 PM', subject: 'Base de Datos', location: 'Aula 305', professor: 'Prof. López' }
        ];

        const container = document.querySelector('.dashboard-card .card-content');
        if (container) {
            // Actualizar contenido de clases
            updateClassesList(container, classes);
        }
    }

    // Cargar tareas recientes
    function loadRecentTasks() {
        const tasks = [
            { title: 'Proyecto Final - Programación', dueDate: '25 de Agosto', status: 'pending' },
            { title: 'Ensayo - Literatura', dueDate: 'Entregado', status: 'completed' },
            { title: 'Examen - Matemáticas', dueDate: '28 de Agosto', status: 'pending' }
        ];

        const container = document.querySelectorAll('.dashboard-card .card-content')[1];
        if (container) {
            updateTasksList(container, tasks);
        }
    }

    // Toggle del sidebar
    function toggleSidebar() {
        sidebarCollapsed = !sidebarCollapsed;
        sidebar.classList.toggle('collapsed', sidebarCollapsed);

        // Guardar preferencia
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
    }

    // Toggle del sidebar móvil
    function toggleMobileSidebar() {
        sidebar.classList.toggle('show');

        // Agregar overlay en móvil
        if (sidebar.classList.contains('show')) {
            createMobileOverlay();
        } else {
            removeMobileOverlay();
        }
    }

    // Crear overlay para móvil
    function createMobileOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            removeMobileOverlay();
        });

        document.body.appendChild(overlay);
    }

    // Remover overlay móvil
    function removeMobileOverlay() {
        const overlay = document.querySelector('.mobile-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Manejar logout con API
    async function handleLogout() {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            try {
                const userData = sessionStorage.getItem('currentUser');
                if (userData) {
                    const user = JSON.parse(userData);

                    // Cerrar sesión en el servidor
                    await fetch(DASHBOARD_CONFIG.API_BASE_URL + DASHBOARD_CONFIG.AUTH_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'logout',
                            token: user.session_token
                        })
                    });
                }
            } catch (error) {
                console.error('Error during logout:', error);
            } finally {
                // Limpiar datos locales
                sessionStorage.clear();
                localStorage.removeItem('rememberToken');

                // Mostrar mensaje y redireccionar
                showNotification('Sesión cerrada correctamente', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        }
    }

    // Manejar búsqueda
    function handleSearch(e) {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) return;

        // Implementar lógica de búsqueda
        performSearch(query);
    }

    // Realizar búsqueda
    function performSearch(query) {
        console.log('Searching for:', query);
        // Implementar búsqueda real aquí
        showNotification(`Buscando: "${query}"`, 'info');
    }

    // Inicializar notificaciones
    function initializeNotifications() {
        // Simular notificaciones
        notifications = [
            { id: 1, title: 'Nueva tarea asignada', message: 'Proyecto final de programación', time: '5 min ago', read: false },
            { id: 2, title: 'Calificación disponible', message: 'Examen de matemáticas', time: '1 hour ago', read: false },
            { id: 3, title: 'Recordatorio', message: 'Clase en 30 minutos', time: '2 hours ago', read: true }
        ];

        updateNotificationBadge();
    }

    // Actualizar badge de notificaciones
    function updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        const unreadCount = notifications.filter(n => !n.read).length;

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    }

    // Toggle panel de notificaciones
    function toggleNotifications() {
        let panel = document.querySelector('.notifications-panel');

        if (!panel) {
            panel = createNotificationsPanel();
            document.body.appendChild(panel);
        }

        panel.classList.toggle('show');

        if (panel.classList.contains('show')) {
            renderNotifications(panel);
        }
    }

    // Crear panel de notificaciones
    function createNotificationsPanel() {
        const panel = document.createElement('div');
        panel.className = 'notifications-panel';
        panel.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        width: 320px;
        max-height: 400px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        overflow: hidden;
    `;

        return panel;
    }

    // Renderizar notificaciones
    function renderNotifications(panel) {
        const header = `
        <div class="notifications-header" style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Notificaciones</h3>
            <button onclick="markAllAsRead()" style="background: none; border: none; color: #4F46E5; cursor: pointer; font-size: 12px;">
                Marcar todo como leído
            </button>
        </div>
    `;

        const notificationsList = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : 'unread'}" 
             style="padding: 12px 20px; border-bottom: 1px solid #F1F5F9; cursor: pointer;"
             onclick="markAsRead(${notification.id})">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${notification.read ? '#E2E8F0' : '#4F46E5'}; margin-top: 6px; flex-shrink: 0;"></div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 500; color: #1E293B;">${notification.title}</h4>
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748B;">${notification.message}</p>
                    <span style="font-size: 11px; color: #94A3B8;">${notification.time}</span>
                </div>
            </div>
        </div>
    `).join('');

        panel.innerHTML = header + `<div class="notifications-list">${notificationsList}</div>`;

        // Mostrar panel con animación
        setTimeout(() => {
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
        }, 10);
    }

    // Marcar notificación como leída
    function markAsRead(id) {
        const notification = notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            updateNotificationBadge();

            // Re-renderizar panel si está visible
            const panel = document.querySelector('.notifications-panel');
            if (panel && panel.classList.contains('show')) {
                renderNotifications(panel);
            }
        }
    }

    // Marcar todas como leídas
    function markAllAsRead() {
        notifications.forEach(n => n.read = true);
        updateNotificationBadge();

        const panel = document.querySelector('.notifications-panel');
        if (panel) {
            renderNotifications(panel);
        }

        showNotification('Todas las notificaciones marcadas como leídas', 'success');
    }

    // Mostrar notificación toast
    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        max-width: 300px;
    `;

        // Colores según el tipo
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        toast.style.background = colors[type] || colors.info;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Mostrar toast
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Ocultar toast después del tiempo configurado
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, DASHBOARD_CONFIG.NOTIFICATION_DURATION);
    }

    // Manejar clicks fuera de elementos
    function handleOutsideClick(e) {
        // Cerrar panel de notificaciones
        const notificationsPanel = document.querySelector('.notifications-panel');
        const notificationBtn = document.querySelector('.notification-btn');

        if (notificationsPanel && !notificationsPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationsPanel.classList.remove('show');
            setTimeout(() => {
                if (!notificationsPanel.classList.contains('show')) {
                    notificationsPanel.remove();
                }
            }, 300);
        }
    }

    // Atajos de teclado
    function handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K para búsqueda
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.querySelector('.search-box input');
            if (searchInput) {
                searchInput.focus();
            }
        }

        // Esc para cerrar modals/panels
        if (e.key === 'Escape') {
            const panel = document.querySelector('.notifications-panel');
            if (panel) {
                panel.classList.remove('show');
            }

            const mobileOverlay = document.querySelector('.mobile-overlay');
            if (mobileOverlay) {
                sidebar.classList.remove('show');
                removeMobileOverlay();
            }
        }
    }

    // Configurar handlers responsive
    function setupResponsiveHandlers() {
        // Cargar preferencia del sidebar
        const savedCollapsed = localStorage.getItem('sidebarCollapsed');
        if (savedCollapsed === 'true') {
            sidebarCollapsed = true;
            sidebar.classList.add('collapsed');
        }

        // Manejar cambios de tamaño de ventana
        let resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(handleWindowResize, 250);
        });
    }

    // Manejar redimensionamiento de ventana
    function handleWindowResize() {
        const isMobile = window.innerWidth <= 1024;

        if (!isMobile) {
            sidebar.classList.remove('show');
            removeMobileOverlay();
        }
    }

    // Iniciar auto-guardado
    function startAutoSave() {
        setInterval(() => {
            // Implementar lógica de auto-guardado aquí
            console.log('Auto-saving data...');

            // Guardar estado actual en localStorage
            const dashboardState = {
                activeSection: activeSection,
                lastActivity: Date.now(),
                userPreferences: {
                    sidebarCollapsed: sidebarCollapsed
                }
            };

            localStorage.setItem('dashboardState', JSON.stringify(dashboardState));

        }, DASHBOARD_CONFIG.AUTO_SAVE_INTERVAL);
    }

    // Animar contador numérico
    function animateCounter(selector, endValue) {
        const element = document.querySelector(selector);
        if (!element) return;

        const startValue = 0;
        const duration = 1000;
        const increment = endValue / (duration / 16);
        let currentValue = startValue;

        const animate = () => {
            currentValue += increment;
            if (currentValue >= endValue) {
                element.textContent = endValue;
            } else {
                element.textContent = Math.floor(currentValue);
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Actualizar URL sin recargar
    function updateURL(section) {
        const url = new URL(window.location);
        url.searchParams.set('section', section);
        window.history.pushState({ section }, '', url);
    }

    // Capitalizar primera letra
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Funciones para cargar datos de otras secciones (placeholders)
    function loadMateriasData() {
        console.log('Loading materias data...');
        // Implementar carga de datos de materias
    }

    function loadCalificacionesData() {
        console.log('Loading calificaciones data...');
        // Implementar carga de datos de calificaciones
    }

    function loadHorarioData() {
        console.log('Loading horario data...');
        // Implementar carga de datos de horario
    }

    function loadPerfilData() {
        console.log('Loading perfil data...');
        // Implementar carga de datos de perfil
    }

    // Funciones auxiliares para actualizar listas
    function updateClassesList(container, classes) {
        // Implementar actualización de lista de clases
        console.log('Updating classes list', classes);
    }

    function updateTasksList(container, tasks) {
        // Implementar actualización de lista de tareas
        console.log('Updating tasks list', tasks);
    }

    // Exponer funciones globales necesarias
    window.markAsRead = markAsRead;
    window.markAllAsRead = markAllAsRead;

}