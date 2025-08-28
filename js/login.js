// Configuración y variables globales
const LOGIN_CONFIG = {
    MAX_ATTEMPTS: 3,
    LOCKOUT_TIME: 300000, // 5 minutos en milisegundos
    ANIMATION_DURATION: 300
};

// Usuarios de prueba (en producción esto vendría de la base de datos)
const TEST_USERS = {
    '2021001': { password: 'password123', name: 'Juan Pérez', role: 'estudiante' },
    '2021002': { password: 'password123', name: 'María González', role: 'estudiante' },
    'PROF001': { password: 'password123', name: 'Dr. Carlos Rodríguez', role: 'profesor' },
    'ADMIN01': { password: 'password123', name: 'Ana Administradora', role: 'admin' }
};

// Estado de la aplicación
let loginAttempts = 0;
let isLocked = false;
let lockoutTimer = null;

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const matriculaInput = document.getElementById('matricula');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const rememberCheckbox = document.getElementById('remember');

// Inicialización cuando el DOM está cargado
document.addEventListener('DOMContentLoaded', function () {
    initializeLogin();
});

// Función principal de inicialización
function initializeLogin() {
    setupEventListeners();
    checkLockoutStatus();
    loadRememberedUser();
    addInputAnimations();
}

// Configurar todos los event listeners
function setupEventListeners() {
    // Formulario de login
    loginForm.addEventListener('submit', handleLogin);

    // Toggle de contraseña
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);

    // Validación en tiempo real
    matriculaInput.addEventListener('input', validateMatricula);
    passwordInput.addEventListener('input', validatePassword);

    // Efectos visuales
    matriculaInput.addEventListener('focus', () => addFocusEffect(matriculaInput));
    passwordInput.addEventListener('focus', () => addFocusEffect(passwordInput));
    matriculaInput.addEventListener('blur', () => removeFocusEffect(matriculaInput));
    passwordInput.addEventListener('blur', () => removeFocusEffect(passwordInput));

    // Enter key en campos
    matriculaInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });

    // Recordar usuario
    rememberCheckbox.addEventListener('change', handleRememberUser);

    // Prevenir copiar/pegar en campos sensibles (opcional)
    passwordInput.addEventListener('paste', function (e) {
        // Permitir paste pero mostrar advertencia
        setTimeout(() => {
            showTooltip(passwordInput, 'Contraseña pegada. Verifica que sea correcta.');
        }, 100);
    });
}

// Manejar el envío del formulario de login
async function handleLogin(event) {
    event.preventDefault();

    if (isLocked) {
        showError('Cuenta bloqueada temporalmente. Intenta más tarde.');
        return;
    }

    const matricula = matriculaInput.value.trim();
    const password = passwordInput.value;

    if (!validateForm(matricula, password)) {
        return;
    }

    setLoadingState(true);
    hideError();

    try {
        // Simular llamada a API (reemplazar con llamada real)
        const loginResult = await authenticateUser(matricula, password);

        if (loginResult.success) {
            handleLoginSuccess(loginResult.user);
        } else {
            handleLoginFailure(loginResult.message);
        }
    } catch (error) {
        console.error('Error en login:', error);
        showError('Error de conexión. Intenta nuevamente.');
    } finally {
        setLoadingState(false);
    }
}

// Simular autenticación (reemplazar con API real)
function authenticateUser(matricula, password) {
    return new Promise((resolve) => {
        // Simular delay de red
        setTimeout(() => {
            const user = TEST_USERS[matricula];

            if (!user) {
                resolve({ success: false, message: 'Matrícula no encontrada' });
                return;
            }

            if (user.password !== password) {
                resolve({ success: false, message: 'Contraseña incorrecta' });
                return;
            }

            resolve({
                success: true,
                user: {
                    matricula: matricula,
                    name: user.name,
                    role: user.role
                }
            });
        }, 1000);
    });
}

// Manejar login exitoso
function handleLoginSuccess(user) {
    // Guardar datos del usuario
    sessionStorage.setItem('currentUser', JSON.stringify(user));

    if (rememberCheckbox.checked) {
        localStorage.setItem('rememberedMatricula', user.matricula);
    }

    // Reset intentos de login
    loginAttempts = 0;
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('lockoutTime');

    // Animación de éxito
    showSuccess('¡Bienvenido! Redirigiendo...');

    // Redireccionar al dashboard
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1500);
}

// Manejar fallo de login
function handleLoginFailure(message) {
    loginAttempts++;
    localStorage.setItem('loginAttempts', loginAttempts.toString());

    if (loginAttempts >= LOGIN_CONFIG.MAX_ATTEMPTS) {
        lockAccount();
        showError(`Demasiados intentos fallidos. Cuenta bloqueada por ${LOGIN_CONFIG.LOCKOUT_TIME / 60000} minutos.`);
    } else {
        const remainingAttempts = LOGIN_CONFIG.MAX_ATTEMPTS - loginAttempts;
        showError(`${message}. Te quedan ${remainingAttempts} intento(s).`);
    }

    // Animación de error
    shakeForm();
}

// Bloquear cuenta temporalmente
function lockAccount() {
    isLocked = true;
    const lockoutTime = Date.now() + LOGIN_CONFIG.LOCKOUT_TIME;
    localStorage.setItem('lockoutTime', lockoutTime.toString());

    // Deshabilitar formulario
    setFormEnabled(false);

    // Configurar timer para desbloquear
    lockoutTimer = setTimeout(() => {
        unlockAccount();
    }, LOGIN_CONFIG.LOCKOUT_TIME);

    // Mostrar cuenta regresiva
    startLockoutCountdown(lockoutTime);
}

// Desbloquear cuenta
function unlockAccount() {
    isLocked = false;
    loginAttempts = 0;

    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('lockoutTime');

    setFormEnabled(true);
    hideError();
    showSuccess('Cuenta desbloqueada. Puedes intentar nuevamente.');

    if (lockoutTimer) {
        clearTimeout(lockoutTimer);
        lockoutTimer = null;
    }
}

// Verificar estado de bloqueo al cargar
function checkLockoutStatus() {
    const lockoutTime = localStorage.getItem('lockoutTime');
    const attempts = localStorage.getItem('loginAttempts');

    if (lockoutTime) {
        const timeRemaining = parseInt(lockoutTime) - Date.now();

        if (timeRemaining > 0) {
            isLocked = true;
            loginAttempts = parseInt(attempts) || 0;
            setFormEnabled(false);

            lockoutTimer = setTimeout(() => {
                unlockAccount();
            }, timeRemaining);

            startLockoutCountdown(parseInt(lockoutTime));
        } else {
            unlockAccount();
        }
    } else {
        loginAttempts = parseInt(attempts) || 0;
    }
}

// Mostrar cuenta regresiva de bloqueo
function startLockoutCountdown(lockoutTime) {
    const updateCountdown = () => {
        const timeRemaining = lockoutTime - Date.now();

        if (timeRemaining <= 0) {
            return;
        }

        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);

        showError(`Cuenta bloqueada. Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`);

        setTimeout(updateCountdown, 1000);
    };

    updateCountdown();
}

// Toggle visibilidad de contraseña
function togglePasswordVisibility() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    const icon = togglePasswordBtn.querySelector('i');
    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// Validaciones del formulario
function validateForm(matricula, password) {
    if (!matricula) {
        showError('La matrícula es requerida');
        matriculaInput.focus();
        return false;
    }

    if (!password) {
        showError('La contraseña es requerida');
        passwordInput.focus();
        return false;
    }

    if (matricula.length < 4) {
        showError('La matrícula debe tener al menos 4 caracteres');
        matriculaInput.focus();
        return false;
    }

    if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres');
        passwordInput.focus();
        return false;
    }

    return true;
}

// Validación en tiempo real de matrícula
function validateMatricula() {
    const value = matriculaInput.value.trim();
    const isValid = value.length >= 4;

    updateFieldValidation(matriculaInput, isValid);
}

// Validación en tiempo real de contraseña
function validatePassword() {
    const value = passwordInput.value;
    const isValid = value.length >= 6;

    updateFieldValidation(passwordInput, isValid);
}

// Actualizar estado visual de validación
function updateFieldValidation(field, isValid) {
    if (field.value === '') {
        field.style.borderColor = '#E5E7EB';
        return;
    }

    field.style.borderColor = isValid ? '#10B981' : '#EF4444';
}

// Cargar usuario recordado
function loadRememberedUser() {
    const rememberedMatricula = localStorage.getItem('rememberedMatricula');
    if (rememberedMatricula) {
        matriculaInput.value = rememberedMatricula;
        rememberCheckbox.checked = true;
        passwordInput.focus();
    }
}

// Manejar checkbox "Recordarme"
function handleRememberUser() {
    if (!rememberCheckbox.checked) {
        localStorage.removeItem('rememberedMatricula');
    }
}

// Estados de carga
function setLoadingState(isLoading) {
    loginBtn.classList.toggle('loading', isLoading);
    setFormEnabled(!isLoading);
}

// Habilitar/deshabilitar formulario
function setFormEnabled(enabled) {
    matriculaInput.disabled = !enabled;
    passwordInput.disabled = !enabled;
    loginBtn.disabled = !enabled;
    rememberCheckbox.disabled = !enabled;
    togglePasswordBtn.disabled = !enabled;
}

// Mostrar mensaje de error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

// Ocultar mensaje de error
function hideError() {
    errorMessage.classList.remove('show');
}

// Mostrar mensaje de éxito
function showSuccess(message) {
    errorMessage.textContent = message;
    errorMessage.style.color = '#10B981';
    errorMessage.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    errorMessage.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    errorMessage.classList.add('show');
}

// Animación de shake para errores
function shakeForm() {
    loginForm.classList.add('shake');
    setTimeout(() => {
        loginForm.classList.remove('shake');
    }, 500);
}

// Efectos visuales
function addFocusEffect(input) {
    input.parentElement.classList.add('focused');
}

function removeFocusEffect(input) {
    if (!input.value) {
        input.parentElement.classList.remove('focused');
    }
}

// Animaciones de entrada para los inputs
function addInputAnimations() {
    const inputs = [matriculaInput, passwordInput];
    inputs.forEach((input, index) => {
        input.style.opacity = '0';
        input.style.transform = 'translateY(20px)';

        setTimeout(() => {
            input.style.transition = 'all 0.5s ease';
            input.style.opacity = '1';
            input.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });
}

// Mostrar tooltip
function showTooltip(element, message) {
    // Crear tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = message;
    tooltip.style.cssText = `
        position: absolute;
        background: #1F2937;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
        opacity: 0;
        transform: translateY(-5px);
        transition: all 0.3s ease;
        pointer-events: none;
    `;

    // Posicionar tooltip
    document.body.appendChild(tooltip);
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';

    // Mostrar tooltip
    setTimeout(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    }, 10);

    // Ocultar tooltip después de 3 segundos
    setTimeout(() => {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(-5px)';
        setTimeout(() => {
            document.body.removeChild(tooltip);
        }, 300);
    }, 3000);
}

// CSS adicional para animaciones
const additionalCSS = `
.shake {
    animation: shake 0.5s ease-in-out;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
}

.form-group.focused label {
    color: #4F46E5;
}

.form-group.focused label i {
    color: #4F46E5;
}
`;

// Inyectar CSS adicional
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);