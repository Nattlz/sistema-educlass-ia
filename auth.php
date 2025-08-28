<?php
// auth.php - Sistema de autenticación completo
session_start();

// Headers para CORS y JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración de la base de datos
$db_config = [
    'host' => 'localhost',
    'dbname' => 'sistema_login',
    'username' => 'root',
    'password' => '',
    'charset' => 'utf8mb4',
    'port' => 3306
];

// Configuración de seguridad
$security_config = [
    'max_attempts' => 5,
    'lockout_time' => 300, // 5 minutos en segundos
    'session_timeout' => 3600, // 1 hora en segundos
    'remember_me_duration' => 2592000, // 30 días en segundos
    'password_min_length' => 6,
    'token_length' => 32
];

// Clase principal para manejar autenticación
class AuthManager {
    private $pdo;
    private $security_config;
    
    public function __construct($db_config, $security_config) {
        $this->security_config = $security_config;
        $this->connectDatabase($db_config);
        $this->initializeTables();
    }
    
    // Conectar a la base de datos
    private function connectDatabase($config) {
        try {
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false
            ];
            
            $this->pdo = new PDO($dsn, $config['username'], $config['password'], $options);
        } catch (PDOException $e) {
            error_log('Database connection error: ' . $e->getMessage());
            $this->sendResponse(false, 'Error de conexión a la base de datos', 500);
        }
    }
    
    // Inicializar tablas si no existen
    private function initializeTables() {
        try {
            // Tabla de intentos de login
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    matricula VARCHAR(20) NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    success BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_matricula_time (matricula, created_at),
                    INDEX idx_ip_time (ip_address, created_at)
                )
            ");
            
            // Tabla de tokens de recordar usuario
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS remember_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    INDEX idx_token (token),
                    INDEX idx_expires (expires_at)
                )
            ");
            
        } catch (PDOException $e) {
            error_log('Table initialization error: ' . $e->getMessage());
        }
    }
    
    // Método principal de login
    public function login($matricula, $password, $remember = false) {
        try {
            // Validar entrada
            if (empty($matricula) || empty($password)) {
                return $this->sendResponse(false, 'Matrícula y contraseña son requeridos');
            }
            
            // Limpiar matrícula
            $matricula = trim(strtoupper($matricula));
            
            // Verificar si la cuenta está bloqueada
            if ($this->isAccountLocked($matricula)) {
                $lockoutTime = $this->getLockoutTimeRemaining($matricula);
                return $this->sendResponse(false, "Cuenta bloqueada. Tiempo restante: {$lockoutTime} minutos", 423);
            }
            
            // Buscar usuario en la base de datos
            $user = $this->getUserByMatricula($matricula);
            
            if (!$user) {
                $this->recordLoginAttempt($matricula, false, 'Usuario no encontrado');
                return $this->sendResponse(false, 'Matrícula o contraseña incorrectos');
            }
            
            // Verificar si el usuario está activo
            if (!$user['activo']) {
                $this->recordLoginAttempt($matricula, false, 'Usuario inactivo');
                return $this->sendResponse(false, 'Cuenta desactivada. Contacta al administrador');
            }
            
            // Verificar contraseña
            if (!password_verify($password, $user['password_hash'])) {
                $this->recordLoginAttempt($matricula, false, 'Contraseña incorrecta');
                
                $attemptsRemaining = $this->getRemainingAttempts($matricula);
                if ($attemptsRemaining > 0) {
                    return $this->sendResponse(false, "Contraseña incorrecta. Te quedan {$attemptsRemaining} intento(s)");
                } else {
                    return $this->sendResponse(false, 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente');
                }
            }
            
            // Login exitoso
            $this->recordLoginAttempt($matricula, true, 'Login exitoso');
            $this->clearFailedAttempts($matricula);
            $this->updateLastAccess($user['id']);
            
            // Crear sesión
            $session_data = $this->createSession($user);
            
            // Crear token "recordarme" si es solicitado
            $remember_token = null;
            if ($remember) {
                $remember_token = $this->createRememberToken($user['id']);
            }
            
            return $this->sendResponse(true, 'Login exitoso', 200, [
                'user' => [
                    'id' => $user['id'],
                    'matricula' => $user['matricula'],
                    'name' => $user['nombre'],
                    'email' => $user['email'],
                    'role' => $user['rol'],
                    'last_access' => $user['ultimo_acceso']
                ],
                'session' => $session_data,
                'remember_token' => $remember_token
            ]);
            
        } catch (Exception $e) {
            error_log('Login error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error interno del servidor', 500);
        }
    }
    
    // Validar sesión existente
    public function validateSession($token = null) {
        try {
            // Usar token proporcionado o el de la sesión PHP
            $token = $token ?? ($_SESSION['session_token'] ?? null);
            
            if (empty($token)) {
                return $this->sendResponse(false, 'Token de sesión requerido', 401);
            }
            
            // Buscar sesión en la base de datos
            $stmt = $this->pdo->prepare("
                SELECT s.*, u.matricula, u.nombre, u.email, u.rol, u.ultimo_acceso
                FROM sesiones s 
                JOIN usuarios u ON s.usuario_id = u.id 
                WHERE s.token = ? AND s.activa = 1 AND s.fecha_expiracion > NOW() AND u.activo = 1
            ");
            $stmt->execute([$token]);
            $session = $stmt->fetch();
            
            if (!$session) {
                // Limpiar sesión PHP inválida
                if (isset($_SESSION['session_token'])) {
                    session_destroy();
                }
                return $this->sendResponse(false, 'Sesión inválida o expirada', 401);
            }
            
            // Actualizar tiempo de última actividad
            $this->updateSessionActivity($session['id']);
            
            return $this->sendResponse(true, 'Sesión válida', 200, [
                'user' => [
                    'id' => $session['usuario_id'],
                    'matricula' => $session['matricula'],
                    'name' => $session['nombre'],
                    'email' => $session['email'],
                    'role' => $session['rol'],
                    'last_access' => $session['ultimo_acceso']
                ],
                'session_info' => [
                    'expires_at' => $session['fecha_expiracion'],
                    'created_at' => $session['fecha_creacion']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Session validation error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error al validar sesión', 500);
        }
    }
    
    // Cerrar sesión
    public function logout($token = null) {
        try {
            $token = $token ?? ($_SESSION['session_token'] ?? null);
            
            if ($token) {
                // Desactivar sesión en la base de datos
                $stmt = $this->pdo->prepare('UPDATE sesiones SET activa = 0, fecha_cierre = NOW() WHERE token = ?');
                $stmt->execute([$token]);
                
                // Eliminar tokens de recordar del usuario
                $stmt = $this->pdo->prepare("
                    DELETE rt FROM remember_tokens rt 
                    JOIN sesiones s ON rt.usuario_id = s.usuario_id 
                    WHERE s.token = ?
                ");
                $stmt->execute([$token]);
            }
            
            // Limpiar sesión PHP
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_destroy();
            }
            
            return $this->sendResponse(true, 'Sesión cerrada correctamente');
            
        } catch (Exception $e) {
            error_log('Logout error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error al cerrar sesión', 500);
        }
    }
    
    // Registrar nuevo usuario
    public function register($data) {
        try {
            // Validar campos requeridos
            $required_fields = ['matricula', 'nombre', 'email', 'password'];
            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    return $this->sendResponse(false, "El campo '{$field}' es requerido");
                }
            }
            
            // Limpiar y validar datos
            $matricula = trim(strtoupper($data['matricula']));
            $nombre = trim($data['nombre']);
            $email = trim(strtolower($data['email']));
            $password = $data['password'];
            $rol = $data['rol'] ?? 'estudiante';
            
            // Validaciones específicas
            if (!preg_match('/^[A-Z0-9]{4,20}$/', $matricula)) {
                return $this->sendResponse(false, 'Formato de matrícula inválido (4-20 caracteres alfanuméricos)');
            }
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->sendResponse(false, 'Formato de email inválido');
            }
            
            if (strlen($password) < $this->security_config['password_min_length']) {
                return $this->sendResponse(false, "La contraseña debe tener al menos {$this->security_config['password_min_length']} caracteres");
            }
            
            if (!in_array($rol, ['estudiante', 'profesor', 'admin'])) {
                return $this->sendResponse(false, 'Rol inválido');
            }
            
            // Verificar si la matrícula ya existe
            if ($this->getUserByMatricula($matricula)) {
                return $this->sendResponse(false, 'La matrícula ya está registrada');
            }
            
            // Verificar si el email ya existe
            $stmt = $this->pdo->prepare('SELECT id FROM usuarios WHERE email = ?');
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                return $this->sendResponse(false, 'El email ya está registrado');
            }
            
            // Crear hash de contraseña
            $password_hash = password_hash($password, PASSWORD_DEFAULT);
            
            // Insertar usuario
            $stmt = $this->pdo->prepare("
                INSERT INTO usuarios (matricula, nombre, email, password_hash, rol, fecha_registro) 
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            
            $stmt->execute([$matricula, $nombre, $email, $password_hash, $rol]);
            
            $user_id = $this->pdo->lastInsertId();
            
            return $this->sendResponse(true, 'Usuario registrado correctamente', 201, [
                'user_id' => $user_id,
                'matricula' => $matricula
            ]);
            
        } catch (PDOException $e) {
            error_log('Registration error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error al registrar usuario', 500);
        }
    }
    
    // Cambiar contraseña
    public function changePassword($user_id, $current_password, $new_password) {
        try {
            // Validar nueva contraseña
            if (strlen($new_password) < $this->security_config['password_min_length']) {
                return $this->sendResponse(false, "La nueva contraseña debe tener al menos {$this->security_config['password_min_length']} caracteres");
            }
            
            // Obtener usuario actual
            $stmt = $this->pdo->prepare('SELECT id, password_hash FROM usuarios WHERE id = ? AND activo = 1');
            $stmt->execute([$user_id]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return $this->sendResponse(false, 'Usuario no encontrado', 404);
            }
            
            // Verificar contraseña actual
            if (!password_verify($current_password, $user['password_hash'])) {
                return $this->sendResponse(false, 'Contraseña actual incorrecta');
            }
            
            // No permitir usar la misma contraseña
            if (password_verify($new_password, $user['password_hash'])) {
                return $this->sendResponse(false, 'La nueva contraseña debe ser diferente a la actual');
            }
            
            // Actualizar contraseña
            $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);
            $stmt = $this->pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?');
            $stmt->execute([$new_password_hash, $user_id]);
            
            // Invalidar todas las sesiones del usuario excepto la actual
            $current_token = $_SESSION['session_token'] ?? null;
            $stmt = $this->pdo->prepare('UPDATE sesiones SET activa = 0 WHERE usuario_id = ? AND token != ?');
            $stmt->execute([$user_id, $current_token]);
            
            // Eliminar tokens de recordar
            $stmt = $this->pdo->prepare('DELETE FROM remember_tokens WHERE usuario_id = ?');
            $stmt->execute([$user_id]);
            
            return $this->sendResponse(true, 'Contraseña actualizada correctamente');
            
        } catch (Exception $e) {
            error_log('Password change error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error al cambiar contraseña', 500);
        }
    }
    
    // Verificar token de recordar usuario
    public function verifyRememberToken($token) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT rt.*, u.matricula, u.nombre, u.email, u.rol
                FROM remember_tokens rt
                JOIN usuarios u ON rt.usuario_id = u.id
                WHERE rt.token = ? AND rt.expires_at > NOW() AND u.activo = 1
            ");
            $stmt->execute([$token]);
            $remember_data = $stmt->fetch();
            
            if (!$remember_data) {
                return $this->sendResponse(false, 'Token de recordar inválido o expirado');
            }
            
            // Crear nueva sesión automáticamente
            $user = [
                'id' => $remember_data['usuario_id'],
                'matricula' => $remember_data['matricula'],
                'nombre' => $remember_data['nombre'],
                'email' => $remember_data['email'],
                'rol' => $remember_data['rol']
            ];
            
            $session_data = $this->createSession($user);
            
            return $this->sendResponse(true, 'Sesión restaurada automáticamente', 200, [
                'user' => $user,
                'session' => $session_data
            ]);
            
        } catch (Exception $e) {
            error_log('Remember token verification error: ' . $e->getMessage());
            return $this->sendResponse(false, 'Error al verificar token', 500);
        }
    }
    
    // MÉTODOS PRIVADOS DE APOYO
    
    // Obtener usuario por matrícula
    private function getUserByMatricula($matricula) {
        $stmt = $this->pdo->prepare('SELECT * FROM usuarios WHERE matricula = ?');
        $stmt->execute([$matricula]);
        return $stmt->fetch();
    }
    
    // Verificar si la cuenta está bloqueada
    private function isAccountLocked($matricula) {
        $stmt = $this->pdo->prepare("
            SELECT COUNT(*) as failed_attempts 
            FROM login_attempts 
            WHERE matricula = ? 
            AND success = FALSE 
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$matricula, $this->security_config['lockout_time']]);
        $result = $stmt->fetch();
        
        return $result['failed_attempts'] >= $this->security_config['max_attempts'];
    }
    
    // Obtener intentos restantes antes del bloqueo
    private function getRemainingAttempts($matricula) {
        $stmt = $this->pdo->prepare("
            SELECT COUNT(*) as failed_attempts 
            FROM login_attempts 
            WHERE matricula = ? 
            AND success = FALSE 
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$matricula, $this->security_config['lockout_time']]);
        $result = $stmt->fetch();
        
        return max(0, $this->security_config['max_attempts'] - $result['failed_attempts']);
    }
    
    // Obtener tiempo restante de bloqueo
    private function getLockoutTimeRemaining($matricula) {
        $stmt = $this->pdo->prepare("
            SELECT MAX(created_at) as last_attempt 
            FROM login_attempts 
            WHERE matricula = ? 
            AND success = FALSE 
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$matricula, $this->security_config['lockout_time']]);
        $result = $stmt->fetch();
        
        if ($result['last_attempt']) {
            $lockout_until = strtotime($result['last_attempt']) + $this->security_config['lockout_time'];
            $remaining_seconds = $lockout_until - time();
            return max(0, ceil($remaining_seconds / 60)); // Devolver minutos
        }
        
        return 0;
    }
    
    // Registrar intento de login
    private function recordLoginAttempt($matricula, $success, $details = '') {
        $ip_address = $this->getClientIP();
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
        
        $stmt = $this->pdo->prepare("
            INSERT INTO login_attempts (matricula, ip_address, user_agent, success, details) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$matricula, $ip_address, $user_agent, $success, $details]);
    }
    
    // Limpiar intentos fallidos
    private function clearFailedAttempts($matricula) {
        $stmt = $this->pdo->prepare('DELETE FROM login_attempts WHERE matricula = ? AND success = FALSE');
        $stmt->execute([$matricula]);
    }
    
    // Actualizar último acceso
    private function updateLastAccess($user_id) {
        $stmt = $this->pdo->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?');
        $stmt->execute([$user_id]);
    }
    
    // Crear sesión de usuario
    private function createSession($user) {
        $token = $this->generateSecureToken($this->security_config['token_length']);
        $expires_at = date('Y-m-d H:i:s', time() + $this->security_config['session_timeout']);
        
        // Limpiar sesiones expiradas
        $this->cleanExpiredSessions();
        
        // Crear nueva sesión en BD
        $stmt = $this->pdo->prepare("
            INSERT INTO sesiones (usuario_id, token, fecha_expiracion, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $ip_address = $this->getClientIP();
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
        
        $stmt->execute([$user['id'], $token, $expires_at, $ip_address, $user_agent]);
        
        // Configurar sesión PHP
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_matricula'] = $user['matricula'];
        $_SESSION['user_role'] = $user['rol'];
        $_SESSION['session_token'] = $token;
        $_SESSION['login_time'] = time();
        
        return [
            'token' => $token,
            'expires_at' => $expires_at,
            'timeout' => $this->security_config['session_timeout']
        ];
    }
    
    // Crear token de recordar usuario
    private function createRememberToken($user_id) {
        $token = $this->generateSecureToken(64);
        $expires_at = date('Y-m-d H:i:s', time() + $this->security_config['remember_me_duration']);
        
        $stmt = $this->pdo->prepare("
            INSERT INTO remember_tokens (usuario_id, token, expires_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$user_id, $token, $expires_at]);
        
        return [
            'token' => $token,
            'expires_at' => $expires_at
        ];
    }
    
    // Actualizar actividad de sesión
    private function updateSessionActivity($session_id) {
        $stmt = $this->pdo->prepare('UPDATE sesiones SET ultima_actividad = NOW() WHERE id = ?');
        $stmt->execute([$session_id]);
    }
    
    // Limpiar sesiones expiradas
    private function cleanExpiredSessions() {
        $stmt = $this->pdo->prepare('UPDATE sesiones SET activa = 0 WHERE fecha_expiracion < NOW() AND activa = 1');
        $stmt->execute();
        
        $stmt = $this->pdo->prepare('DELETE FROM remember_tokens WHERE expires_at < NOW()');
        $stmt->execute();
    }
    
    // Generar token seguro
    private function generateSecureToken($length = 32) {
        return bin2hex(random_bytes($length));
    }
    
    // Obtener IP real del cliente
    private function getClientIP() {
        $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP'];
        
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                return trim($ips[0]);
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    // Enviar respuesta JSON
    private function sendResponse($success, $message, $code = 200, $data = null) {
        http_response_code($code);
        
        $response = [
            'success' => $success,
            'message' => $message,
            'timestamp' => date('c'),
            'request_id' => uniqid()
        ];
        
        if ($data !== null) {
            $response['data'] = $data;
        }
        
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// MANEJO DE SOLICITUDES HTTP

try {
    // Crear instancia del manejador de autenticación
    $auth = new AuthManager($db_config, $security_config);
    
    // Obtener método HTTP y datos de entrada
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $get_data = $_GET ?? [];
    $post_data = $_POST ?? [];
    
    // Combinar todos los datos de entrada
    $data = array_merge($get_data, $post_data, $input);
    
    // Determinar la acción a ejecutar
    $action = $data['action'] ?? '';
    
    // Router principal
    switch ($action) {
        case 'login':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido. Use POST.']);
                exit;
            }
            
            $matricula = $data['matricula'] ?? '';
            $password = $data['password'] ?? '';
            $remember = isset($data['remember']) && $data['remember'];
            
            $auth->login($matricula, $password, $remember);
            break;
            
        case 'validate':
        case 'check_session':
            $token = $data['token'] ?? null;
            $auth->validateSession($token);
            break;
            
        case 'logout':
            $token = $data['token'] ?? null;
            $auth->logout($token);
            break;
            
        case 'register':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido. Use POST.']);
                exit;
            }
            
            $auth->register($data);
            break;
            
        case 'change_password':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido. Use POST.']);
                exit;
            }
            
            $user_id = $_SESSION['user_id'] ?? null;
            if (!$user_id) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Sesión requerida']);
                exit;
            }
            
            $current_password = $data['current_password'] ?? '';
            $new_password = $data['new_password'] ?? '';
            
            $auth->changePassword($user_id, $current_password, $new_password);
            break;
            
        case 'remember_me':
            $token = $data['token'] ?? '';
            $auth->verifyRememberToken($token);
            break;
            
        case 'session_info':
            // Información sobre la sesión actual
            if (empty($_SESSION['user_id'])) {
                echo json_encode([
                    'success' => false,
                    'message' => 'No hay sesión activa'
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'user_id' => $_SESSION['user_id'],
                        'matricula' => $_SESSION['user_matricula'],
                        'role' => $_SESSION['user_role'],
                        'login_time' => $_SESSION['login_time'] ?? null,
                        'session_active' => true
                    ]
                ]);
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Acción no especificada o inválida',
                'available_actions' => [
                    'login' => 'Iniciar sesión',
                    'validate' => 'Validar sesión existente', 
                    'logout' => 'Cerrar sesión',
                    'register' => 'Registrar nuevo usuario',
                    'change_password' => 'Cambiar contraseña',
                    'remember_me' => 'Verificar token de recordar',
                    'session_info' => 'Información de sesión actual'
                ],
                'request_method' => $method,
                'timestamp' => date('c')
            ]);
            break;
    }
    
} catch (Exception $e) {
    // Log del error completo para debugging
    error_log('Auth system error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    
    // Respuesta genérica para el cliente
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno del servidor',
        'error_id' => uniqid('err_'),
        'timestamp' => date('c')
    ]);
} finally {
    // Limpiar recursos si es necesario
    if (isset($auth)) {
        // Realizar limpieza automática ocasional (1% de probabilidad)
        if (random_int(1, 100) === 1) {
            try {
                $auth->performMaintenance();
            } catch (Exception $e) {
                error_log('Maintenance error: ' . $e->getMessage());
            }
        }
    }
}

// Clase adicional para tareas de mantenimiento
class MaintenanceManager {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    // Limpiar registros antiguos
    public function cleanOldRecords() {
        try {
            // Limpiar intentos de login antiguos (más de 7 días)
            $stmt = $this->pdo->prepare("
                DELETE FROM login_attempts 
                WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
            ");
            $stmt->execute();
            
            // Limpiar sesiones inactivas muy antiguas (más de 30 días)
            $stmt = $this->pdo->prepare("
                DELETE FROM sesiones 
                WHERE activa = 0 AND fecha_creacion < DATE_SUB(NOW(), INTERVAL 30 DAY)
            ");
            $stmt->execute();
            
            // Limpiar tokens de recordar expirados
            $stmt = $this->pdo->prepare("
                DELETE FROM remember_tokens 
                WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
            ");
            $stmt->execute();
            
            return true;
        } catch (Exception $e) {
            error_log('Cleanup error: ' . $e->getMessage());
            return false;
        }
    }
    
    // Obtener estadísticas del sistema
    public function getSystemStats() {
        try {
            $stats = [];
            
            // Usuarios activos
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as count FROM usuarios WHERE activo = 1");
            $stmt->execute();
            $stats['active_users'] = $stmt->fetch()['count'];
            
            // Sesiones activas
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as count FROM sesiones 
                WHERE activa = 1 AND fecha_expiracion > NOW()
            ");
            $stmt->execute();
            $stats['active_sessions'] = $stmt->fetch()['count'];
            
            // Intentos de login fallidos hoy
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as count FROM login_attempts 
                WHERE success = FALSE AND DATE(created_at) = CURDATE()
            ");
            $stmt->execute();
            $stats['failed_logins_today'] = $stmt->fetch()['count'];
            
            // Intentos de login exitosos hoy
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as count FROM login_attempts 
                WHERE success = TRUE AND DATE(created_at) = CURDATE()
            ");
            $stmt->execute();
            $stats['successful_logins_today'] = $stmt->fetch()['count'];
            
            return $stats;
        } catch (Exception $e) {
            error_log('Stats error: ' . $e->getMessage());
            return [];
        }
    }
}

// Agregar método de mantenimiento a AuthManager
if (class_exists('AuthManager')) {
    class_alias('AuthManager', 'AuthManagerBase');
    
    class AuthManager extends AuthManagerBase {
        public function performMaintenance() {
            $maintenance = new MaintenanceManager($this->pdo);
            return $maintenance->cleanOldRecords();
        }
        
        public function getStats() {
            $maintenance = new MaintenanceManager($this->pdo);
            return $maintenance->getSystemStats();
        }
    }
}

// Funciones auxiliares globales para uso en otras partes del sistema

/**
 * Verificar si el usuario tiene permisos para una acción
 */
function checkUserPermission($required_role, $user_role = null) {
    if ($user_role === null) {
        $user_role = $_SESSION['user_role'] ?? null;
    }
    
    if (!$user_role) {
        return false;
    }
    
    $role_hierarchy = [
        'admin' => 3,
        'profesor' => 2,
        'estudiante' => 1
    ];
    
    $user_level = $role_hierarchy[$user_role] ?? 0;
    $required_level = $role_hierarchy[$required_role] ?? 999;
    
    return $user_level >= $required_level;
}

/**
 * Obtener información del usuario actual
 */
function getCurrentUser() {
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    
    return [
        'id' => $_SESSION['user_id'],
        'matricula' => $_SESSION['user_matricula'] ?? null,
        'role' => $_SESSION['user_role'] ?? null,
        'login_time' => $_SESSION['login_time'] ?? null
    ];
}

/**
 * Verificar si hay una sesión activa
 */
function isLoggedIn() {
    return !empty($_SESSION['user_id']) && !empty($_SESSION['session_token']);
}

/**
 * Redirigir si no hay sesión activa
 */
function requireLogin($redirect_url = 'index.html') {
    if (!isLoggedIn()) {
        if (headers_sent()) {
            echo "<script>window.location.href = '{$redirect_url}';</script>";
        } else {
            header("Location: {$redirect_url}");
        }
        exit;
    }
}

/**
 * Verificar token CSRF (Cross-Site Request Forgery)
 */
function verifyCSRFToken($token) {
    $session_token = $_SESSION['csrf_token'] ?? null;
    return $session_token && hash_equals($session_token, $token);
}

/**
 * Generar token CSRF
 */
function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Sanitizar entrada de usuario
 */
function sanitizeInput($input, $type = 'string') {
    if ($input === null) {
        return null;
    }
    
    switch ($type) {
        case 'email':
            return filter_var(trim($input), FILTER_SANITIZE_EMAIL);
        case 'url':
            return filter_var(trim($input), FILTER_SANITIZE_URL);
        case 'int':
            return (int) filter_var($input, FILTER_SANITIZE_NUMBER_INT);
        case 'float':
            return (float) filter_var($input, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
        case 'alpha':
            return preg_replace('/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/', '', trim($input));
        case 'alphanumeric':
            return preg_replace('/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/', '', trim($input));
        case 'matricula':
            return strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', trim($input)));
        case 'string':
        default:
            return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}

/**
 * Validar formato de entrada
 */
function validateFormat($input, $type, $required = true) {
    if (empty($input) && $input !== '0') {
        return !$required;
    }
    
    switch ($type) {
        case 'email':
            return filter_var($input, FILTER_VALIDATE_EMAIL) !== false;
        case 'url':
            return filter_var($input, FILTER_VALIDATE_URL) !== false;
        case 'int':
            return filter_var($input, FILTER_VALIDATE_INT) !== false;
        case 'float':
            return filter_var($input, FILTER_VALIDATE_FLOAT) !== false;
        case 'matricula':
            return preg_match('/^[A-Z0-9]{4,20}$/', $input);
        case 'phone':
            return preg_match('/^\+?[1-9]\d{9,14}$/', $input);
        case 'date':
            return DateTime::createFromFormat('Y-m-d', $input) !== false;
        case 'datetime':
            return DateTime::createFromFormat('Y-m-d H:i:s', $input) !== false;
        default:
            return is_string($input) && strlen($input) <= 1000;
    }
}

/**
 * Registrar actividad del usuario
 */
function logUserActivity($action, $details = null) {
    $user = getCurrentUser();
    if (!$user) return false;
    
    try {
        $log_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_id' => $user['id'],
            'matricula' => $user['matricula'],
            'action' => $action,
            'details' => $details,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ];
        
        // Log en archivo (opcional: también en BD)
        $log_file = 'logs/user_activity_' . date('Y-m-d') . '.log';
        $log_dir = dirname($log_file);
        
        if (!is_dir($log_dir)) {
            mkdir($log_dir, 0755, true);
        }
        
        file_put_contents(
            $log_file, 
            json_encode($log_entry) . "\n", 
            FILE_APPEND | LOCK_EX
        );
        
        return true;
    } catch (Exception $e) {
        error_log('Activity logging error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Formatear respuesta de API consistente
 */
function apiResponse($success, $message, $data = null, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    
    $response = [
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c'),
        'version' => '1.0.0'
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return $response;
}

// Configuración final y headers de seguridad adicionales
if (!headers_sent()) {
    // Headers de seguridad adicionales
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    // CSP básico (ajustar según necesidades)
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
    
    // HSTS si es HTTPS
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }
}

?>