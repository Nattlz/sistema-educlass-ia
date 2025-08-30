// Configuración y variables globales
const LOGIN_CONFIG = {
    MAX_ATTEMPTS: 3,
    LOCKOUT_TIME: 300000, // 5 minutos en milisegundos
    ANIMATION_DURATION: 300
};

// Configuración de la API
const API_CONFIG = {
    BASE_URL: window.location.origin + '/',
    AUTH_ENDPOINT: 'auth.php'
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
document.addEventListener('DOMContentLoaded', function() {
    initializeLogin();
});

// Verificar token de "recordarme" al cargar la página
async function checkRememberToken() {
    const rememberToken = localStorage.getItem('rememberToken');
    if (!rememberToken) return;

    try {
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.AUTH_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'remember_me',
                token: rememberToken
            })
        });

        const data = await response.json();
        
        if (data.success) {
            // Auto-login exitoso
            handleLoginSuccess(data.data);
        } else {
            // Token inválido o expirado
            localStorage.removeItem('rememberToken');
        }
    } catch (error) {
        console.error('Error verificando token remember:', error);
        localStorage.removeItem('rememberToken');
    }
}

// Función principal de inicialización (actualizada)
function initializeLogin() {
    setupEventListeners();
    loadRememberedUser();
    addInputAnimations();
    checkLockoutStatus();
    
    // Verificar token de recordar al cargar
    checkRememberToken();
}

// Configurar todos los event listeners
function setupEventListeners() {
    // Formulario de login
    loginForm.addEventListener('submit', handleLogin);
    
    // Toggle de contraseña
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    }
    
    // Validación en tiempo real
    if (matriculaInput) {
        matriculaInput.addEventListener('input', validateMatricula);
        matriculaInput.addEventListener('focus', () => addFocusEffect(matriculaInput));
        matriculaInput.addEventListener('blur', () => removeFocusEffect(matriculaInput));
        matriculaInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', validatePassword);
        passwordInput.addEventListener('focus', () => addFocusEffect(passwordInput));
        passwordInput.addEventListener('blur', () => removeFocusEffect(passwordInput));
        passwordInput.addEventListener('paste', function(e) {
            setTimeout(() => {
                showTooltip(passwordInput, 'Contraseña pegada. Verifica que sea correcta.');
            }, 100);
        });
    }
    
    // Recordar usuario
    if (rememberCheckbox) {
        rememberCheckbox.addEventListener('change', handleRememberUser);
    }
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
    const remember = rememberCheckbox ? rememberCheckbox.checked : false; // FIX: Definir la variable remember
    
    if (!validateForm(matricula, password)) {
        return;
    }
    
    setLoadingState(true);
    hideError();
    
    try {
        // Llamar a la API real de autenticación
        const loginResult = await authenticateUser(matricula, password, remember);
        
        if (loginResult.success) {
            handleLoginSuccess(loginResult.data);
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

// Autenticar usuario con la API
async function authenticateUser(matricula, password, remember = false) {
    try {
        console.log('Enviando solicitud de autenticación...'); // Debug
        
        const requestBody = {
            action: 'login',
            matricula: matricula,
            password: password,
            remember: remember
        };
        
        console.log('Request body:', requestBody); // Debug
        
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.AUTH_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status); // Debug
        console.log('Response headers:', response.headers); // Debug

        if (!response.ok) {
            // Intentar leer el contenido del error para más información
            let errorText;
            try {
                errorText = await response.text();
                console.error('Error response text:', errorText);
            } catch (e) {
                errorText = 'No se pudo leer la respuesta del error';
            }
            
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data:', data); // Debug
        return data;

    } catch (error) {
        console.error('Authentication error:', error);
        
        // Mensaje más específico según el tipo de error
        if (error.message.includes('Failed to fetch')) {
            return {
                success: false,
                message: 'No se puede conectar con el servidor. Verifica tu conexión a internet.'
            };
        } else if (error.message.includes('500')) {
            return {
                success: false,
                message: 'Error interno del servidor. Contacta al administrador del sistema.'
            };
        } else {
            return {
                success: false,
                message: 'Error de conexión con el servidor. Inténtalo nuevamente.'
            };
        }
    }
}

// Manejar login exitoso
function handleLoginSuccess(data) {
    // Guardar datos del usuario y sesión
    const userData = {
        id: data.user.id,
        matricula: data.user.matricula,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        session_token: data.session.token
    };
    
    sessionStorage.setItem('currentUser', JSON.stringify(userData));
    
    // Guardar token de recordar si existe
    if (data.remember_token && rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('rememberToken', data.remember_token.token);
        localStorage.setItem('rememberedMatricula', userData.matricula);
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
    showError(message);
    shakeForm();
    
    // Si el mensaje indica bloqueo, manejar el estado local
    if (message.includes('bloqueada') || message.includes('Cuenta bloqueada')) {
        isLocked = true;
        setFormEnabled(false);
        
        // Intentar extraer tiempo de bloqueo del mensaje
        const timeMatch = message.match(/(\d+)\s*minuto/);
        if (timeMatch) {
            const minutes = parseInt(timeMatch[1]);
            setTimeout(() => {
                isLocked = false;
                setFormEnabled(true);
                hideError();
                showSuccess('Cuenta desbloqueada. Puedes intentar nuevamente.');
            }, minutes * 60 * 1000);
        }
    }
    
    // Limpiar contraseña por seguridad
    if (passwordInput) {
        passwordInput.value = '';
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
    if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
}

// Validaciones del formulario
function validateForm(matricula, password) {
    if (!matricula) {
        showError('La matrícula es requerida');
        if (matriculaInput) matriculaInput.focus();
        return false;
    }
    
    if (!password) {
        showError('La contraseña es requerida');
        if (passwordInput) passwordInput.focus();
        return false;
    }
    
    if (matricula.length < 4) {
        showError('La matrícula debe tener al menos 4 caracteres');
        if (matriculaInput) matriculaInput.focus();
        return false;
    }
    
    if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres');
        if (passwordInput) passwordInput.focus();
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
    if (!field) return;
    
    if (field.value === '') {
        field.style.borderColor = '#E5E7EB';
        return;
    }
    
    field.style.borderColor = isValid ? '#10B981' : '#EF4444';
}

// Cargar usuario recordado
function loadRememberedUser() {
    const rememberedMatricula = localStorage.getItem('rememberedMatricula');
    if (rememberedMatricula && matriculaInput) {
        matriculaInput.value = rememberedMatricula;
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
        if (passwordInput) {
            passwordInput.focus();
        }
    }
}

// Manejar checkbox "Recordarme"
function handleRememberUser() {
    if (!rememberCheckbox || !rememberCheckbox.checked) {
        localStorage.removeItem('rememberedMatricula');
    }
}

// Estados de carga
function setLoadingState(isLoading) {
    if (loginBtn) {
        loginBtn.classList.toggle('loading', isLoading);
    }
    setFormEnabled(!isLoading);
}

// Habilitar/deshabilitar formulario
function setFormEnabled(enabled) {
    const elements = [matriculaInput, passwordInput, loginBtn, rememberCheckbox, togglePasswordBtn];
    elements.forEach(element => {
        if (element) {
            element.disabled = !enabled;
        }
    });
}

// Mostrar mensaje de error
function showError(message) {
    if (!errorMessage) return;
    
    // Resetear estilos a error
    errorMessage.style.color = '#EF4444';
    errorMessage.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    errorMessage.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

// Ocultar mensaje de error
function hideError() {
    if (errorMessage) {
        errorMessage.classList.remove('show');
    }
}

// Mostrar mensaje de éxito
function showSuccess(message) {
    if (!errorMessage) return;
    
    errorMessage.textContent = message;
    errorMessage.style.color = '#10B981';
    errorMessage.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    errorMessage.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    errorMessage.classList.add('show');
}

// Animación de shake para errores
function shakeForm() {
    if (loginForm) {
        loginForm.classList.add('shake');
        setTimeout(() => {
            loginForm.classList.remove('shake');
        }, 500);
    }
}

// Efectos visuales
function addFocusEffect(input) {
    if (input && input.parentElement) {
        input.parentElement.classList.add('focused');
    }
}

function removeFocusEffect(input) {
    if (input && input.parentElement && !input.value) {
        input.parentElement.classList.remove('focused');
    }
}

// Animaciones de entrada para los inputs
function addInputAnimations() {
    const inputs = [matriculaInput, passwordInput].filter(Boolean);
    inputs.forEach((input, index) => {
        if (input) {
            input.style.opacity = '0';
            input.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                input.style.transition = 'all 0.5s ease';
                input.style.opacity = '1';
                input.style.transform = 'translateY(0)';
            }, 200 + (index * 100));
        }
    });
}

// Mostrar tooltip
function showTooltip(element, message) {
    if (!element) return;
    
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
            if (document.body.contains(tooltip)) {
                document.body.removeChild(tooltip);
            }
        }, 300);
    }, 3000);
}

// Función para probar la conexión con el servidor
async function testServerConnection() {
    try {
        console.log('Probando conexión con:', API_CONFIG.BASE_URL + API_CONFIG.AUTH_ENDPOINT);
        
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.AUTH_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'session_info'
            })
        });
        
        console.log('Test response status:', response.status);
        
        const text = await response.text();
        console.log('Test response text:', text);
        
        try {
            const json = JSON.parse(text);
            console.log('Test response JSON:', json);
        } catch (e) {
            console.error('Response is not valid JSON:', e);
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
    }
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

.loading {
    position: relative;
    pointer-events: none;
}

.loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

// Inyectar CSS adicional
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Agregar función de prueba de conexión al objeto window para debug
window.testServerConnection = testServerConnection;