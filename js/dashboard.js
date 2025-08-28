// Configuración global del dashboard
const DASHBOARD_CONFIG = {
    ANIMATION_DURATION: 300,
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    NOTIFICATION_DURATION: 5000
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

// Manejar logout
function handleLogout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        // Limpiar datos de sesión
        sessionStorage.removeItem('currentUser');

        // Opcional: limpiar localStorage parcialmente
        const keysToKeep = ['sidebarCollapsed', 'rememberedMatricula'];
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });

        // Mostrar mensaje de despedida
        showNotification('Sesión cerrada correctamente', 'success');

        // Redireccionar al login después de un breve delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
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