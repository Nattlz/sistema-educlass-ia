<?php
// config.php - Configuración general del sistema

// Configuración de errores (desarrollo vs producción)
if ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['HTTP_HOST'] === '127.0.0.1') {
    // Modo desarrollo
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    define('ENVIRONMENT', 'development');
} else {
    // Modo producción
    error_reporting(0);
    ini_set('display_errors', 0);
    define('ENVIRONMENT', 'production');
}

// Configuración de zona horaria
date_default_timezone_set('America/Mexico_City');

// Configuración de sesiones
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on');
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Lax');

// Configuración de la base de datos
class DatabaseConfig {
    private static $configs = [
        'development' => [
            'host' => 'localhost',
            'dbname' => 'sistema_login',
            'username' => 'root',
            'password' => 'YWizardB0309',
            'charset' => 'utf8mb4',
            'port' => 3306
        ],
        'production' => [
            'host' => 'localhost', // Cambiar por servidor de producción
            'dbname' => 'sistema_login_prod',
            'username' => 'prod_user',
            'password' => 'secure_password', // Usar variable de entorno
            'charset' => 'utf8mb4',
            'port' => 3306
        ]
    ];
    
    public static function get($environment = null) {
        $env = $environment ?? ENVIRONMENT;
        return self::$configs[$env] ?? self::$configs['development'];
    }
}

// Configuración de seguridad
class SecurityConfig {
    const PASSWORD_MIN_LENGTH = 8;
    const PASSWORD_REQUIRE_UPPERCASE = true;
    const PASSWORD_REQUIRE_LOWERCASE = true;
    const PASSWORD_REQUIRE_NUMBER = true;
    const PASSWORD_REQUIRE_SPECIAL = false;
    
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 300; // 5 minutos
    const SESSION_TIMEOUT = 3600; // 1 hora
    const REMEMBER_ME_DURATION = 2592000; // 30 días
    
    const CSRF_TOKEN_LENGTH = 32;
    const API_RATE_LIMIT = 100; // requests per hour
    
    // Headers de seguridad
    public static function setSecurityHeaders() {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
        }
    }
    
    // Validar fortaleza de contraseña
    public static function validatePassword($password) {
        $errors = [];
        
        if (strlen($password) < self::PASSWORD_MIN_LENGTH) {
            $errors[] = "La contraseña debe tener al menos " . self::PASSWORD_MIN_LENGTH . " caracteres";
        }
        
        if (self::PASSWORD_REQUIRE_UPPERCASE && !preg_match('/[A-Z]/', $password)) {
            $errors[] = "La contraseña debe contener al menos una letra mayúscula";
        }
        
        if (self::PASSWORD_REQUIRE_LOWERCASE && !preg_match('/[a-z]/', $password)) {
            $errors[] = "La contraseña debe contener al menos una letra minúscula";
        }
        
        if (self::PASSWORD_REQUIRE_NUMBER && !preg_match('/[0-9]/', $password)) {
            $errors[] = "La contraseña debe contener al menos un número";
        }
        
        if (self::PASSWORD_REQUIRE_SPECIAL && !preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors[] = "La contraseña debe contener al menos un carácter especial";
        }
        
        return empty($errors) ? true : $errors;
    }
    
    // Generar token CSRF
    public static function generateCSRFToken() {
        return bin2hex(random_bytes(self::CSRF_TOKEN_LENGTH));
    }
    
    // Validar token CSRF
    public static function validateCSRFToken($token, $sessionToken) {
        return hash_equals($sessionToken, $token);
    }
}

// Configuración de la aplicación
class AppConfig {
    const APP_NAME = 'Sistema Universitario';
    const APP_VERSION = '1.0.0';
    const APP_DESCRIPTION = 'Portal estudiantil universitario';
    
    // URLs base
    const BASE_URL = 'http://localhost/sistema-login/'; // Cambiar en producción
    const API_URL = self::BASE_URL . 'api/';
    const ASSETS_URL = self::BASE_URL . 'assets/';
    
    // Configuración de archivos
    const UPLOAD_MAX_SIZE = 5242880; // 5MB
    const ALLOWED_FILE_TYPES = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
    const UPLOAD_PATH = 'uploads/';
    
    // Configuración de email
    const SMTP_HOST = 'smtp.gmail.com';
    const SMTP_PORT = 587;
    const SMTP_USERNAME = 'sistema@universidad.edu'; // Configurar
    const SMTP_PASSWORD = ''; // Usar variable de entorno
    const EMAIL_FROM_NAME = self::APP_NAME;
    const EMAIL_FROM_ADDRESS = 'noreply@universidad.edu';
    
    // Configuración de logs
    const LOG_PATH = 'logs/';
    const LOG_LEVEL = ENVIRONMENT === 'development' ? 'DEBUG' : 'ERROR';
    
    // Roles del sistema
    const ROLES = [
        'admin' => [
            'name' => 'Administrador',
            'permissions' => ['*']
        ],
        'profesor' => [
            'name' => 'Profesor',
            'permissions' => ['view_students', 'manage_grades', 'view_reports']
        ],
        'estudiante' => [
            'name' => 'Estudiante',
            'permissions' => ['view_profile', 'view_grades', 'view_schedule']
        ]
    ];
    
    // Obtener configuración por ambiente
    public static function getEnvironmentConfig() {
        return [
            'app_name' => self::APP_NAME,
            'version' => self::APP_VERSION,
            'environment' => ENVIRONMENT,
            'base_url' => self::BASE_URL,
            'api_url' => self::API_URL,
            'debug' => ENVIRONMENT === 'development'
        ];
    }
}

// Configuración de base de datos específica para la aplicación
class DatabaseManager {
    private static $instance = null;
    private $pdo = null;
    
    private function __construct() {
        $config = DatabaseConfig::get();
        
        try {
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset={$config['charset']}";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$config['charset']} COLLATE {$config['charset']}_unicode_ci"
            ];
            
            $this->pdo = new PDO($dsn, $config['username'], $config['password'], $options);
            
        } catch (PDOException $e) {
            error_log('Database connection error: ' . $e->getMessage());
            throw new Exception('Error de conexión a la base de datos');
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->pdo;
    }
    
    // Prevenir clonación
    private function __clone() {}
    
    // Prevenir deserialización
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
}

// Utilidades generales
class Utils {
    // Sanitizar entrada de datos
    public static function sanitizeInput($input, $type = 'string') {
        switch ($type) {
            case 'email':
                return filter_var(trim($input), FILTER_SANITIZE_EMAIL);
            case 'url':
                return filter_var(trim($input), FILTER_SANITIZE_URL);
            case 'int':
                return filter_var($input, FILTER_SANITIZE_NUMBER_INT);
            case 'float':
                return filter_var($input, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
            case 'string':
            default:
                return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
        }
    }
    
    // Validar entrada de datos
    public static function validateInput($input, $type, $required = true) {
        if ($required && (empty($input) && $input !== '0')) {
            return false;
        }
        
        if (!$required && empty($input)) {
            return true;
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
                return preg_match('/^[A-Z0-9]{4,20}$/i', $input);
            case 'phone':
                return preg_match('/^\+?[1-9]\d{1,14}$/', $input);
            default:
                return is_string($input) && strlen($input) <= 1000;
        }
    }
    
    // Generar UUID v4
    public static function generateUUID() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
    
    // Formatear fecha
    public static function formatDate($date, $format = 'd/m/Y H:i') {
        if ($date instanceof DateTime) {
            return $date->format($format);
        }
        
        $dateTime = DateTime::createFromFormat('Y-m-d H:i:s', $date);
        return $dateTime ? $dateTime->format($format) : $date;
    }
    
    // Logging simple
    public static function log($message, $level = 'INFO') {
        $logFile = AppConfig::LOG_PATH . 'app_' . date('Y-m-d') . '.log';
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
        
        // Crear directorio si no existe
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        file_put_contents($logFile, $logMessage, FILE_APPEND | LOCK_EX);
    }
    
    // Respuesta JSON estandarizada
    public static function jsonResponse($success, $message, $data = null, $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        
        $response = [
            'success' => $success,
            'message' => $message,
            'timestamp' => date('c'),
            'version' => AppConfig::APP_VERSION
        ];
        
        if ($data !== null) {
            $response['data'] = $data;
        }
        
        return json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}

// Configuración de autoload para clases personalizadas
spl_autoload_register(function ($class_name) {
    $directories = [
        'classes/',
        'models/',
        'controllers/',
        'services/'
    ];
    
    foreach ($directories as $directory) {
        $file = $directory . $class_name . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// Aplicar headers de seguridad
SecurityConfig::setSecurityHeaders();
?>