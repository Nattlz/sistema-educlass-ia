-- Base de datos para el sistema de login - ESQUEMA COMPLETO
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sistema_login CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_login;

-- Tabla de usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL,
    activo BOOLEAN DEFAULT TRUE,
    rol ENUM('estudiante', 'profesor', 'admin') DEFAULT 'estudiante',
    telefono VARCHAR(20) NULL,
    fecha_nacimiento DATE NULL,
    direccion TEXT NULL,
    foto_perfil VARCHAR(255) NULL,
    configuraciones JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de sesiones mejorada
CREATE TABLE sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    activa BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    dispositivo VARCHAR(100) NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de intentos de login
CREATE TABLE login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    success BOOLEAN DEFAULT FALSE,
    details VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de tokens para recordar usuario
CREATE TABLE remember_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de actividad del usuario (opcional)
CREATE TABLE user_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de configuraciones del sistema
CREATE TABLE system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de notificaciones
CREATE TABLE notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    leida BOOLEAN DEFAULT FALSE,
    url_accion VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para optimización de rendimiento
CREATE INDEX idx_usuarios_matricula ON usuarios(matricula);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

CREATE INDEX idx_sesiones_token ON sesiones(token);
CREATE INDEX idx_sesiones_usuario_activa ON sesiones(usuario_id, activa);
CREATE INDEX idx_sesiones_expiracion ON sesiones(fecha_expiracion);

CREATE INDEX idx_login_attempts_matricula ON login_attempts(matricula);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_time ON login_attempts(created_at);
CREATE INDEX idx_login_attempts_matricula_time ON login_attempts(matricula, created_at);

CREATE INDEX idx_remember_tokens_token ON remember_tokens(token);
CREATE INDEX idx_remember_tokens_expires ON remember_tokens(expires_at);
CREATE INDEX idx_remember_tokens_usuario ON remember_tokens(usuario_id);

CREATE INDEX idx_activity_usuario ON user_activity(usuario_id);
CREATE INDEX idx_activity_time ON user_activity(created_at);
CREATE INDEX idx_activity_action ON user_activity(action);

CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo);

-- Configuraciones iniciales del sistema
INSERT INTO system_config (config_key, config_value, description) VALUES
('app_name', 'Sistema Universitario', 'Nombre de la aplicación'),
('app_version', '1.0.0', 'Versión actual del sistema'),
('maintenance_mode', 'false', 'Modo de mantenimiento activado/desactivado'),
('max_login_attempts', '5', 'Máximo número de intentos de login'),
('lockout_duration', '300', 'Duración del bloqueo en segundos'),
('session_timeout', '3600', 'Tiempo de expiración de sesión en segundos'),
('password_min_length', '6', 'Longitud mínima de contraseña'),
('email_verification_required', 'false', 'Verificación de email requerida'),
('two_factor_auth_enabled', 'false', 'Autenticación de dos factores habilitada');

-- Datos de usuarios de ejemplo (contraseñas: "password123")
INSERT INTO usuarios (matricula, nombre, email, password_hash, rol, telefono) VALUES
('2021001', 'Juan Pérez García', 'juan.perez@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'estudiante', '+52-555-0001'),
('2021002', 'María González López', 'maria.gonzalez@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'estudiante', '+52-555-0002'),
('2021003', 'Carlos Rodríguez Martínez', 'carlos.rodriguez@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'estudiante', '+52-555-0003'),
('PROF001', 'Dr. Ana Martínez Silva', 'ana.martinez@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesor', '+52-555-1001'),
('PROF002', 'Ing. Roberto López Torres', 'roberto.lopez@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesor', '+52-555-1002'),
('ADMIN01', 'Laura Administradora', 'admin@universidad.edu', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '+52-555-9001');

-- Notificaciones de ejemplo
INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) VALUES
(1, 'Bienvenido al sistema', '¡Bienvenido al portal universitario! Explora todas las funcionalidades disponibles.', 'info'),
(1, 'Nueva tarea asignada', 'Se ha asignado una nueva tarea en la materia de Programación Web', 'warning'),
(1, 'Calificación disponible', 'Ya está disponible la calificación del examen de Matemáticas', 'success'),
(2, 'Recordatorio importante', 'No olvides entregar tu proyecto final antes del viernes', 'warning'),
(2, 'Sistema actualizado', 'El sistema ha sido actualizado con nuevas funcionalidades', 'info');

-- Procedimientos almacenados útiles

-- Procedimiento para limpiar datos antiguos
DELIMITER //
CREATE PROCEDURE CleanOldData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    
    -- Limpiar intentos de login antiguos (más de 30 días)
    DELETE FROM login_attempts 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Limpiar sesiones inactivas muy antiguas (más de 90 días)
    DELETE FROM sesiones 
    WHERE activa = 0 AND fecha_creacion < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- Limpiar tokens de recordar expirados
    DELETE FROM remember_tokens 
    WHERE expires_at < NOW();
    
    -- Limpiar actividad antigua (más de 1 año)
    DELETE FROM user_activity 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    COMMIT;
END //
DELIMITER ;

-- Procedimiento para obtener estadísticas del sistema
DELIMITER //
CREATE PROCEDURE GetSystemStats()
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM usuarios WHERE activo = 1) as usuarios_activos,
        (SELECT COUNT(*) FROM sesiones WHERE activa = 1 AND fecha_expiracion > NOW()) as sesiones_activas,
        (SELECT COUNT(*) FROM login_attempts WHERE success = FALSE AND DATE(created_at) = CURDATE()) as intentos_fallidos_hoy,
        (SELECT COUNT(*) FROM login_attempts WHERE success = TRUE AND DATE(created_at) = CURDATE()) as logins_exitosos_hoy,
        (SELECT COUNT(*) FROM notificaciones WHERE leida = FALSE) as notificaciones_pendientes,
        (SELECT COUNT(*) FROM usuarios WHERE DATE(fecha_registro) = CURDATE()) as usuarios_nuevos_hoy;
END //
DELIMITER ;

-- Vista para obtener información completa de usuarios activos
CREATE VIEW vista_usuarios_activos AS
SELECT 
    u.id,
    u.matricula,
    u.nombre,
    u.email,
    u.rol,
    u.ultimo_acceso,
    u.fecha_registro,
    CASE 
        WHEN s.activa = 1 AND s.fecha_expiracion > NOW() THEN 'En línea'
        WHEN u.ultimo_acceso > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 'Reciente'
        ELSE 'Inactivo'
    END as estado_conexion,
    (SELECT COUNT(*) FROM notificaciones WHERE usuario_id = u.id AND leida = FALSE) as notificaciones_pendientes
FROM usuarios u
LEFT JOIN sesiones s ON u.id = s.usuario_id AND s.activa = 1
WHERE u.activo = 1;

-- Vista para estadísticas de login
CREATE VIEW vista_estadisticas_login AS
SELECT 
    DATE(created_at) as fecha,
    COUNT(*) as total_intentos,
    SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as intentos_exitosos,
    SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as intentos_fallidos,
    COUNT(DISTINCT matricula) as usuarios_unicos,
    COUNT(DISTINCT ip_address) as ips_unicas
FROM login_attempts 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Trigger para actualizar ultima_actividad en sesiones
DELIMITER //
CREATE TRIGGER update_session_activity
BEFORE UPDATE ON sesiones
FOR EACH ROW
BEGIN
    IF NEW.activa = 1 AND OLD.activa = 1 THEN
        SET NEW.ultima_actividad = NOW();
    END IF;
END //
DELIMITER ;

-- Trigger para registrar actividad al cambiar datos del usuario
DELIMITER //
CREATE TRIGGER log_user_changes
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF OLD.nombre != NEW.nombre OR OLD.email != NEW.email OR OLD.activo != NEW.activo THEN
        INSERT INTO user_activity (usuario_id, action, details)
        VALUES (NEW.id, 'profile_updated', JSON_OBJECT(
            'old_name', OLD.nombre,
            'new_name', NEW.nombre,
            'old_email', OLD.email,
            'new_email', NEW.email,
            'old_status', OLD.activo,
            'new_status', NEW.activo
        ));
    END IF;
END //
DELIMITER ;

-- Crear evento para limpieza automática (requiere habilitar el scheduler)
-- SET GLOBAL event_scheduler = ON;

DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_old_data
ON SCHEDULE EVERY 1 DAY
STARTS NOW()
DO
BEGIN
    CALL CleanOldData();
END //
DELIMITER ;

-- Comentarios y documentación
/*
NOTAS IMPORTANTES:

1. SEGURIDAD:
   - Todas las contraseñas están hasheadas con bcrypt
   - Los tokens de sesión son únicos y seguros
   - Se registran todos los intentos de login para auditoría
   - Índices optimizados para consultas de seguridad

2. RENDIMIENTO:
   - Índices estratégicos para todas las consultas frecuentes
   - Procedimientos almacenados para operaciones complejas
   - Limpieza automática de datos antiguos
   - Vistas optimizadas para reportes

3. MANTENIMIENTO:
   - Evento automático de limpieza diaria
   - Triggers para auditoría automática
   - Configuraciones centralizadas en system_config
   - Estructura preparada para escalabilidad

4. FUNCIONALIDADES:
   - Sistema completo de autenticación
   - Manejo de sesiones seguras
   - Tokens "recordarme" 
   - Sistema de notificaciones
   - Registro de actividad completo
   - Estadísticas en tiempo real

PRÓXIMOS PASOS:
- Configurar el servidor para habilitar eventos programados
- Ajustar configuraciones según el entorno de producción
- Implementar respaldos automáticos
- Configurar monitoring de la base de datos
*/