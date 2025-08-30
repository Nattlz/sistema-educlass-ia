// Task Management JavaScript
// Sistema de gestión de tareas para profesores

// Estado global de la aplicación
let currentUser = null;
let currentTask = null;
let currentRubric = null;
let evaluationData = {};

// Configuración de la API
const TASK_CONFIG = {
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    MAX_FILE_SIZE: 100, // MB
    ALLOWED_FORMATS: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'ppt', 'pptx', 'xls', 'xlsx'],
    API_BASE_URL: window.location.origin + '/',
    TASKS_ENDPOINT: 'tasks.php',
    AUTH_ENDPOINT: 'auth.php'
};

// Inicialización cuando el DOM está cargado
document.addEventListener('DOMContentLoaded', function() {
    initializeTaskManagement();
});

// Función principal de inicialización
function initializeTaskManagement() {
    checkAuthentication();
    setupEventListeners();
    loadInitialData();
    setupAutoSave();
}

// Verificar autenticación
function checkAuthentication() {
    const userData = sessionStorage.getItem('currentUser');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        if (currentUser.role !== 'profesor' && currentUser.role !== 'admin') {
            showNotification('Acceso denegado. Solo profesores pueden acceder a esta sección.', 'error');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            return;
        }
        updateUserInfo();
    } catch (error) {
        console.error('Error parsing user data:', error);
        window.location.href = 'index.html';
    }
}

// Actualizar información del usuario en la interfaz
function updateUserInfo() {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) userName.textContent = currentUser.name;
    if (userRole) userRole.textContent = 'Profesor';
    
    if (userAvatar) {
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userAvatar.src = `https://via.placeholder.com/40x40/4F46E5/white?text=${initials}`;
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Navigation tabs
    setupTabNavigation();
    
    // Form interactions
    setupFormInteractions();
    
    // Modal interactions
    setupModalInteractions();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Configurar navegación por tabs
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Remover clase active de todos los tabs y contenido
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activar tab y contenido seleccionado
            this.classList.add('active');
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Cargar datos específicos del tab si es necesario
                loadTabContent(tabId);
            }
        });
    });
}

// Configurar interacciones del formulario
function setupFormInteractions() {
    // Checkbox para entregas tardías
    const allowLateCheckbox = document.getElementById('allowLate');
    const latePenaltyGroup = document.getElementById('latePenaltyGroup');
    
    if (allowLateCheckbox && latePenaltyGroup) {
        allowLateCheckbox.addEventListener('change', function() {
            latePenaltyGroup.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Checkbox para archivos requeridos
    const requireFilesCheckbox = document.getElementById('requireFiles');
    const fileConfigGroup = document.getElementById('fileConfigGroup');
    
    if (requireFilesCheckbox && fileConfigGroup) {
        requireFilesCheckbox.addEventListener('change', function() {
            fileConfigGroup.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Form submission
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmission);
    }
    
    // Auto-resize textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', autoResizeTextarea);
    });
}

// Configurar interacciones de modals
function setupModalInteractions() {
    // Cerrar modal al hacer click fuera
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
    
    // Configurar evaluación por rúbrica
    setupRubricEvaluation();
}

// Configurar evaluación por rúbrica
function setupRubricEvaluation() {
    const criterionRadios = document.querySelectorAll('input[name^="criterion"]');
    criterionRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            updateCriterionPoints(this);
            calculateFinalGrade();
        });
    });
}

// Cargar datos iniciales
function loadInitialData() {
    // Cargar estadísticas del overview
    loadOverviewStats();
    
    // Cargar datos de la materia Base de Datos
    loadSubjectData();
    
    // Configurar fechas por defecto en formularios
    setupDefaultDates();
}

// Cargar estadísticas del overview desde la base de datos
async function loadOverviewStats() {
    try {
        const response = await fetch(TASK_CONFIG.API_BASE_URL + TASK_CONFIG.TASKS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_stats'
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const stats = data.data;
                
                // Actualizar elementos en la interfaz con datos reales
                animateCounter('#totalTasks', stats.total_tasks || 0);
                animateCounter('#pendingReview', stats.pending_review || 0);
                animateCounter('#totalStudents', stats.total_students || 0);
                animateCounter('#averageGrade', stats.average_grade || 0);
            } else {
                throw new Error(data.message);
            }
        } else {
            throw new Error('Error de comunicación con el servidor');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showNotification('Error al cargar estadísticas: ' + error.message, 'error');
        
        // Usar valores por defecto en caso de error
        animateCounter('#totalTasks', 0);
        animateCounter('#pendingReview', 0);
        animateCounter('#totalStudents', 0);
        animateCounter('#averageGrade', 0);
    }
}

// Cargar datos de la materia
function loadSubjectData() {
    // En producción, esto vendría de la base de datos
    console.log('Loading subject data for Base de Datos...');
    
    // Actualizar progreso de bloques
    updateBlockProgress();
}

// Configurar fechas por defecto
function setupDefaultDates() {
    const dueDateInput = document.getElementById('dueDate');
    const lateDateInput = document.getElementById('lateDate');
    
    if (dueDateInput) {
        // Fecha de entrega por defecto: una semana desde ahora
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        dueDateInput.value = formatDateTimeLocal(oneWeekFromNow);
    }
    
    if (lateDateInput) {
        // Fecha límite por defecto: 3 días después de la entrega
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        lateDateInput.value = formatDateTimeLocal(tenDaysFromNow);
    }
}

// Funciones de navegación por contenido
function loadTabContent(tabId) {
    switch (tabId) {
        case 'overview':
            loadOverviewStats();
            break;
        case 'create-task':
            resetTaskForm();
            break;
        case 'rubrics':
            loadRubricsData();
            break;
        case 'submissions':
            loadSubmissionsData();
            break;
        default:
            console.log(`Loading content for tab: ${tabId}`);
    }
}

// Funciones para gestión de tareas
function createTask(sessionId) {
    // Cambiar a tab de crear tarea
    const createTaskTab = document.querySelector('[data-tab="create-task"]');
    const createTaskContent = document.getElementById('create-task');
    
    if (createTaskTab && createTaskContent) {
        // Activar tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        createTaskTab.classList.add('active');
        createTaskContent.classList.add('active');
        
        // Pre-seleccionar la sesión
        const sessionSelect = document.getElementById('taskSession');
        if (sessionSelect) {
            sessionSelect.value = sessionId;
        }
        
        // Scroll al top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetTaskForm() {
    const form = document.getElementById('taskForm');
    if (form) {
        form.reset();
        
        // Restablecer fechas por defecto
        setupDefaultDates();
        
        // Ocultar secciones condicionales
        document.getElementById('latePenaltyGroup').style.display = 'none';
        document.getElementById('fileConfigGroup').style.display = 'none';
    }
}

// Manejar envío del formulario de tareas a la base de datos
async function handleTaskSubmission(e) {
    e.preventDefault();
    
    if (!validateTaskForm()) {
        return false;
    }
    
    const formData = collectTaskFormData();
    
    showLoading('Creando tarea...');
    
    try {
        const response = await fetch(TASK_CONFIG.API_BASE_URL + TASK_CONFIG.TASKS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'create_task',
                ...formData
            })
        });

        const data = await response.json();
        
        if (data.success) {
            hideLoading();
            showNotification('Tarea creada exitosamente', 'success');
            
            // Limpiar formulario
            resetTaskForm();
            
            // Volver al tab de overview
            const overviewTab = document.querySelector('[data-tab="overview"]');
            if (overviewTab) {
                overviewTab.click();
            }
            
            // Actualizar datos
            await loadOverviewStats();
            await loadSubjectData();
        } else {
            hideLoading();
            showNotification('Error: ' + data.message, 'error');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error creating task:', error);
        showNotification('Error de conexión al crear la tarea', 'error');
    }
}

function validateTaskForm() {
    const requiredFields = [
        'taskSession',
        'taskType',
        'taskTitle',
        'dueDate'
    ];
    
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            showFieldError(field, 'Este campo es requerido');
            isValid = false;
        } else if (field) {
            clearFieldError(field);
        }
    });
    
    // Validar fecha de entrega
    const dueDate = document.getElementById('dueDate');
    if (dueDate && dueDate.value) {
        const dueDateValue = new Date(dueDate.value);
        const now = new Date();
        
        if (dueDateValue <= now) {
            showFieldError(dueDate, 'La fecha de entrega debe ser futura');
            isValid = false;
        }
    }
    
    // Validar fecha límite si está habilitada
    const allowLate = document.getElementById('allowLate');
    const lateDate = document.getElementById('lateDate');
    
    if (allowLate && allowLate.checked && lateDate && lateDate.value) {
        const lateDateValue = new Date(lateDate.value);
        const dueDateValue = new Date(dueDate.value);
        
        if (lateDateValue <= dueDateValue) {
            showFieldError(lateDate, 'La fecha límite debe ser posterior a la fecha de entrega');
            isValid = false;
        }
    }
    
    return isValid;
}

function collectTaskFormData() {
    const form = document.getElementById('taskForm');
    const formData = new FormData(form);
    
    // Convertir FormData a objeto
    const data = {};
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Recoger formatos permitidos si están seleccionados
    const formatCheckboxes = form.querySelectorAll('input[name="formats"]:checked');
    data.formatos_permitidos = Array.from(formatCheckboxes).map(cb => cb.value);
    
    return data;
}

function saveTaskAsDraft() {
    if (!currentUser) return;
    
    const formData = collectTaskFormData();
    formData.estado = 'borrador';
    
    showNotification('Borrador guardado automáticamente', 'info');
    
    // Guardar en localStorage temporalmente
    localStorage.setItem(`draft_task_${Date.now()}`, JSON.stringify(formData));
}

function cancelTaskCreation() {
    if (confirm('¿Estás seguro de que deseas cancelar? Se perderán los cambios no guardados.')) {
        resetTaskForm();
        
        // Volver al tab de overview
        const overviewTab = document.querySelector('[data-tab="overview"]');
        if (overviewTab) {
            overviewTab.click();
        }
    }
}

// Cargar datos de rúbricas desde la base de datos
async function loadRubricsData() {
    try {
        const response = await fetch(TASK_CONFIG.API_BASE_URL + TASK_CONFIG.TASKS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_rubrics'
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateRubricsDisplay(data.data.rubrics);
            } else {
                console.error('Error loading rubrics:', data.message);
            }
        }
    } catch (error) {
        console.error('Error loading rubrics:', error);
        showNotification('Error al cargar las rúbricas', 'error');
    }
}

// Cargar datos de entregas desde la base de datos
async function loadSubmissionsData() {
    try {
        // Por ahora cargar todas las entregas del profesor
        const response = await fetch(TASK_CONFIG.API_BASE_URL + TASK_CONFIG.TASKS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_tasks' // Esto dará información de tareas con entregas
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateSubmissionsDisplay(data.data.tasks);
            }
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error al cargar las entregas', 'error');
    }
}


function viewRubric(rubricId) {
    currentRubric = rubricId;
    showModal('rubricModal');
}

function editRubric(rubricId) {
    currentRubric = rubricId;
    showNotification('Funcionalidad de edición en desarrollo', 'info');
}

function viewFullRubric(rubricId) {
    currentRubric = rubricId;
    showModal('rubricModal');
}

function createNewRubric() {
    showNotification('Funcionalidad de crear rúbrica en desarrollo', 'info');
}

// Funciones para entregas
function loadSubmissionsData() {
    console.log('Loading submissions data...');
    // En producción cargaría datos del servidor
}

function viewSubmissions(taskId) {
    // Cambiar al tab de entregas
    const submissionsTab = document.querySelector('[data-tab="submissions"]');
    if (submissionsTab) {
        submissionsTab.click();
    }
    
    // Filtrar por tarea específica
    const taskFilter = document.getElementById('taskFilter');
    if (taskFilter) {
        taskFilter.value = taskId;
        // Trigger filter change
        filterSubmissions();
    }
}

function reviewSubmission(submissionId) {
    showNotification(`Revisando entrega ${submissionId}...`, 'info');
}

function gradeSubmission(submissionId) {
    showModal('gradeModal');
    loadSubmissionForGrading(submissionId);
}

function loadSubmissionForGrading(submissionId) {
    // En producción cargaría los datos de la entrega específica
    console.log(`Loading submission ${submissionId} for grading...`);
    
    // Resetear evaluación
    evaluationData = {
        submissionId: submissionId,
        criteria: {},
        finalGrade: 0,
        comments: ''
    };
}

function filterSubmissions() {
    const taskFilter = document.getElementById('taskFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    // En producción filtrarían los datos del servidor
    console.log('Filtering submissions:', {
        task: taskFilter ? taskFilter.value : 'all',
        status: statusFilter ? statusFilter.value : 'all'
    });
}

// Funciones de evaluación por rúbrica
function updateCriterionPoints(radio) {
    const points = parseFloat(radio.dataset.points);
    const criterionName = radio.name;
    const pointsDisplay = document.getElementById(`${criterionName}Points`);
    
    if (pointsDisplay) {
        pointsDisplay.textContent = points;
    }
    
    // Guardar en datos de evaluación
    evaluationData.criteria[criterionName] = {
        levelId: radio.value,
        points: points
    };
}

function calculateFinalGrade() {
    const criteria = evaluationData.criteria;
    
    // Pesos de criterios (deben coincidir con la rúbrica)
    const weights = {
        criterion1: 0.25, // Dominio del tema
        criterion2: 0.20, // Participación en equipo
        criterion3: 0.20, // Argumentación y claridad
        criterion4: 0.20, // Trabajo colaborativo
        criterion5: 0.15  // Actitud/disposición
    };
    
    let totalPoints = 0;
    let totalWeight = 0;
    
    for (const [criterionName, data] of Object.entries(criteria)) {
        if (weights[criterionName]) {
            totalPoints += data.points * weights[criterionName];
            totalWeight += weights[criterionName];
        }
    }
    
    const finalGrade = totalWeight > 0 ? totalPoints / totalWeight : 0;
    
    // Actualizar display
    const finalGradeDisplay = document.getElementById('finalGrade');
    if (finalGradeDisplay) {
        finalGradeDisplay.textContent = finalGrade.toFixed(1);
    }
    
    evaluationData.finalGrade = finalGrade;
}

function saveEvaluationDraft() {
    const comments = document.getElementById('generalComments').value;
    evaluationData.comments = comments;
    
    // Guardar criterios individuales
    const criterionComments = document.querySelectorAll('.criterion-comments');
    criterionComments.forEach((textarea, index) => {
        const criterionName = `criterion${index + 1}`;
        if (evaluationData.criteria[criterionName]) {
            evaluationData.criteria[criterionName].comments = textarea.value;
        }
    });
    
    showNotification('Borrador de evaluación guardado', 'info');
    
    // En producción guardaría en el servidor
    console.log('Saving evaluation draft:', evaluationData);
}

function submitEvaluation() {
    // Validar que todos los criterios estén evaluados
    const requiredCriteria = ['criterion1', 'criterion2', 'criterion3', 'criterion4', 'criterion5'];
    const missingCriteria = requiredCriteria.filter(criterion => !evaluationData.criteria[criterion]);
    
    if (missingCriteria.length > 0) {
        showNotification('Por favor evalúa todos los criterios antes de guardar', 'warning');
        return;
    }
    
    // Recoger comentarios finales
    const comments = document.getElementById('generalComments').value;
    evaluationData.comments = comments;
    
    showLoading('Guardando evaluación...');
    
    // Simular envío al servidor
    setTimeout(() => {
        hideLoading();
        showNotification('Evaluación guardada exitosamente', 'success');
        closeModal('gradeModal');
        
        // Actualizar datos de entregas
        loadSubmissionsData();
        loadOverviewStats();
        
    }, 1500);
}

// Funciones de utilidad
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

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
        z-index: 10001;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        max-width: 350px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    
    // Ocultar toast después de 5 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function showLoading(message = 'Cargando...') {
    let loadingElement = document.getElementById('loadingOverlay');
    
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingOverlay';
        loadingElement.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
                backdrop-filter: blur(4px);
            ">
                <div style="
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                ">
                    <div style="
                        width: 20px;
                        height: 20px;
                        border: 3px solid #4F46E5;
                        border-top: 3px solid transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                    <span style="color: #1E293B; font-weight: 500;">${message}</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(loadingElement);
    }
    
    loadingElement.style.display = 'flex';
}

function hideLoading() {
    const loadingElement = document.getElementById('loadingOverlay');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showFieldError(field, message) {
    // Limpiar error anterior
    clearFieldError(field);
    
    // Agregar clase de error
    field.style.borderColor = '#EF4444';
    
    // Crear elemento de error
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: #EF4444;
        font-size: 12px;
        margin-top: 4px;
        font-weight: 500;
    `;
    
    // Insertar después del campo
    field.parentNode.appendChild(errorElement);
}

function clearFieldError(field) {
    field.style.borderColor = '#E5E7EB';
    
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

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

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function autoResizeTextarea(e) {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
}

function updateBlockProgress() {
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => {
            bar.style.width = width;
        }, 500);
    });
}

// Auto-guardado
function setupAutoSave() {
    setInterval(() => {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'create-task') {
            const form = document.getElementById('taskForm');
            if (form && isFormModified(form)) {
                saveTaskAsDraft();
            }
        }
        
        // Auto-guardar evaluación si está en progreso
        if (document.querySelector('.modal.show#gradeModal')) {
            saveEvaluationDraft();
        }
        
    }, TASK_CONFIG.AUTO_SAVE_INTERVAL);
}

function isFormModified(form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    return Array.from(inputs).some(input => {
        if (input.type === 'checkbox') return input.checked;
        if (input.type === 'radio') return input.checked;
        return input.value.trim() !== '';
    });
}

// Atajos de teclado
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + S para guardar
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'create-task') {
            saveTaskAsDraft();
        }
    }
    
    // Esc para cerrar modales
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
    
    // Ctrl/Cmd + N para nueva tarea
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const createTaskTab = document.querySelector('[data-tab="create-task"]');
        if (createTaskTab) {
            createTaskTab.click();
        }
    }
}

// Manejo de logout
function handleLogout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// Agregar CSS para animaciones
const additionalCSS = `
@keyframes spin {
    to { transform: rotate(360deg); }
}

.toast {
    animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.modal.show {
    animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.session-card {
    animation: cardSlideIn 0.5s ease-out;
}

@keyframes cardSlideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.form-section {
    animation: sectionFadeIn 0.4s ease-out;
}

@keyframes sectionFadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
`;

// Inyectar CSS adicional
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Exponer funciones globales necesarias
window.createTask = createTask;
window.viewRubric = viewRubric;
window.editRubric = editRubric;
window.viewFullRubric = viewFullRubric;
window.createNewRubric = createNewRubric;
window.viewSubmissions = viewSubmissions;
window.reviewSubmission = reviewSubmission;
window.gradeSubmission = gradeSubmission;
window.closeModal = closeModal;
window.saveTaskAsDraft = saveTaskAsDraft;
window.cancelTaskCreation = cancelTaskCreation;
window.saveEvaluationDraft = saveEvaluationDraft;
window.submitEvaluation = submitEvaluation;