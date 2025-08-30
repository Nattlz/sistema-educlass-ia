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

-- Extensión de la base de datos para el sistema de tareas académicas
USE sistema_login;

-- Tabla de materias
CREATE TABLE materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    creditos INT DEFAULT 3,
    semestre INT,
    profesor_id INT NOT NULL,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id)
);

-- Tabla de bloques/unidades temáticas
CREATE TABLE bloques_tematicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    materia_id INT NOT NULL,
    numero_bloque INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    objetivos TEXT,
    duracion_semanas INT DEFAULT 4,
    orden INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- Tabla de sesiones de clase
CREATE TABLE sesiones_clase (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bloque_id INT NOT NULL,
    numero_sesion INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    subtema VARCHAR(300),
    contenido TEXT,
    objetivos_especificos TEXT,
    recursos_necesarios TEXT,
    duracion_minutos INT DEFAULT 90,
    fecha_programada DATE,
    fecha_realizada DATE,
    estado ENUM('programada', 'en_curso', 'completada', 'cancelada') DEFAULT 'programada',
    notas_profesor TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bloque_id) REFERENCES bloques_tematicos(id) ON DELETE CASCADE
);

-- Tabla de tareas/actividades
CREATE TABLE tareas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sesion_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    instrucciones TEXT,
    tipo_evaluacion ENUM('rubrica', 'examen', 'proyecto', 'participacion', 'tarea') DEFAULT 'tarea',
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega DATETIME NOT NULL,
    fecha_limite_entrega DATETIME,
    puntaje_maximo DECIMAL(5,2) DEFAULT 10.00,
    permite_entrega_tardia BOOLEAN DEFAULT FALSE,
    descuento_entrega_tardia DECIMAL(3,2) DEFAULT 0.10,
    archivos_requeridos BOOLEAN DEFAULT FALSE,
    formatos_permitidos JSON,
    tamano_maximo_mb INT DEFAULT 10,
    activa BOOLEAN DEFAULT TRUE,
    visible_estudiantes BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sesion_id) REFERENCES sesiones_clase(id) ON DELETE CASCADE
);

-- Tabla de rúbricas
CREATE TABLE rubricas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tarea_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    instrucciones_evaluacion TEXT,
    puntaje_total DECIMAL(5,2) DEFAULT 50.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE
);

-- Tabla de criterios de rúbrica
CREATE TABLE criterios_rubrica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rubrica_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    peso_porcentaje DECIMAL(5,2) DEFAULT 20.00,
    orden INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (rubrica_id) REFERENCES rubricas(id) ON DELETE CASCADE
);

-- Tabla de niveles de desempeño
CREATE TABLE niveles_desempeno (
    id INT AUTO_INCREMENT PRIMARY KEY,
    criterio_id INT NOT NULL,
    nivel VARCHAR(50) NOT NULL, -- Excelente, Muy bueno, Aceptable, Regular, Reprobatorio
    descripcion TEXT NOT NULL,
    puntaje DECIMAL(4,2) NOT NULL,
    orden INT NOT NULL,
    color_codigo VARCHAR(7) DEFAULT '#007bff',
    FOREIGN KEY (criterio_id) REFERENCES criterios_rubrica(id) ON DELETE CASCADE
);

-- Tabla de inscripciones de estudiantes a materias
CREATE TABLE inscripciones_materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    materia_id INT NOT NULL,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('activa', 'completada', 'abandono', 'reprobada') DEFAULT 'activa',
    calificacion_final DECIMAL(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
    UNIQUE KEY unique_inscripcion (estudiante_id, materia_id)
);

-- Tabla de entregas de tareas
CREATE TABLE entregas_tareas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tarea_id INT NOT NULL,
    estudiante_id INT NOT NULL,
    fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comentarios_estudiante TEXT,
    archivos_adjuntos JSON,
    estado ENUM('borrador', 'entregada', 'tarde', 'calificada', 'revisada') DEFAULT 'entregada',
    calificacion DECIMAL(5,2),
    comentarios_profesor TEXT,
    fecha_calificacion TIMESTAMP NULL,
    calificado_por INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (calificado_por) REFERENCES usuarios(id),
    UNIQUE KEY unique_entrega (tarea_id, estudiante_id)
);

-- Tabla de evaluaciones por rúbrica
CREATE TABLE evaluaciones_rubrica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entrega_id INT NOT NULL,
    criterio_id INT NOT NULL,
    nivel_id INT NOT NULL,
    puntaje_obtenido DECIMAL(4,2) NOT NULL,
    comentarios TEXT,
    evaluado_por INT NOT NULL,
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entrega_id) REFERENCES entregas_tareas(id) ON DELETE CASCADE,
    FOREIGN KEY (criterio_id) REFERENCES criterios_rubrica(id),
    FOREIGN KEY (nivel_id) REFERENCES niveles_desempeno(id),
    FOREIGN KEY (evaluado_por) REFERENCES usuarios(id),
    UNIQUE KEY unique_evaluacion (entrega_id, criterio_id)
);

-- Tabla de recomendaciones para docentes
CREATE TABLE recomendaciones_docentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rubrica_id INT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    tips_observacion TEXT,
    sugerencias_retroalimentacion TEXT,
    estrategias_motivacion TEXT,
    orden INT DEFAULT 1,
    FOREIGN KEY (rubrica_id) REFERENCES rubricas(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX idx_materias_profesor ON materias(profesor_id);
CREATE INDEX idx_materias_codigo ON materias(codigo);
CREATE INDEX idx_bloques_materia ON bloques_tematicos(materia_id, numero_bloque);
CREATE INDEX idx_sesiones_bloque ON sesiones_clase(bloque_id, numero_sesion);
CREATE INDEX idx_tareas_sesion ON tareas(sesion_id);
CREATE INDEX idx_tareas_fecha_entrega ON tareas(fecha_entrega);
CREATE INDEX idx_inscripciones_estudiante ON inscripciones_materias(estudiante_id);
CREATE INDEX idx_inscripciones_materia ON inscripciones_materias(materia_id);
CREATE INDEX idx_entregas_tarea ON entregas_tareas(tarea_id);
CREATE INDEX idx_entregas_estudiante ON entregas_tareas(estudiante_id);
CREATE INDEX idx_evaluaciones_entrega ON evaluaciones_rubrica(entrega_id);

-- Insertar datos iniciales para Base de Datos

-- 1. Crear materia de Base de Datos
INSERT INTO materias (codigo, nombre, descripcion, creditos, semestre, profesor_id) VALUES
('BD001', 'Base de Datos', 'Curso fundamental sobre diseño, implementación y gestión de bases de datos relacionales', 4, 3, 
    (SELECT id FROM usuarios WHERE matricula = 'PROF001' LIMIT 1));

SET @materia_bd_id = LAST_INSERT_ID();

-- 2. Crear Bloque 1: Fundamentos de las bases de datos
INSERT INTO bloques_tematicos (materia_id, numero_bloque, titulo, descripcion, objetivos, orden) VALUES
(@materia_bd_id, 1, 'Fundamentos de las bases de datos', 
'Introducción a los conceptos fundamentales de las bases de datos y el lenguaje SQL básico',
'Al finalizar este bloque, el estudiante será capaz de: 1) Comprender los conceptos básicos de las bases de datos, 2) Aplicar sintaxis básica de SQL, 3) Realizar operaciones CRUD básicas',
1);

SET @bloque1_id = LAST_INSERT_ID();

-- 3. Crear las 3 sesiones del Bloque 1
INSERT INTO sesiones_clase (bloque_id, numero_sesion, titulo, subtema, contenido, objetivos_especificos, duracion_minutos) VALUES
(@bloque1_id, 1, 'Introducción a las bases de datos y lenguaje SQL', 'Conceptos básicos de bases de datos',
'Definición de base de datos, SGBD, tipos de datos, entidades, atributos, relaciones, normalización básica',
'Identificar los componentes fundamentales de una base de datos y comprender la importancia de la organización de datos', 90),

(@bloque1_id, 2, 'Introducción a las bases de datos y lenguaje SQL', 'Sintaxis básica de SQL: SELECT, FROM, WHERE',
'Estructura de consultas SQL, cláusulas básicas, operadores de comparación, filtros simples y complejos',
'Construir consultas SQL básicas para extraer información específica de una base de datos', 90),

(@bloque1_id, 3, 'Operaciones básicas en SQL (CRUD)', 'INSERT, UPDATE, DELETE',
'Operaciones de inserción, actualización y eliminación de datos, transacciones básicas, integridad referencial',
'Ejecutar operaciones CRUD de manera segura y eficiente en una base de datos', 90);

-- 4. Crear tarea para la Sesión 1 con evaluación por rúbrica
INSERT INTO tareas (sesion_id, titulo, descripcion, instrucciones, tipo_evaluacion, fecha_entrega, puntaje_maximo, visible_estudiantes) VALUES
((SELECT id FROM sesiones_clase WHERE bloque_id = @bloque1_id AND numero_sesion = 1), 
'Presentación Grupal: Conceptos Fundamentales de Bases de Datos',
'Los estudiantes trabajarán en equipos para investigar y presentar los conceptos fundamentales de las bases de datos',
'1. Formar equipos de 3-4 estudiantes
2. Investigar sobre: definición de BD, tipos de SGBD, ventajas de usar BD
3. Preparar presentación de 10 minutos
4. Incluir ejemplos prácticos
5. Fomentar participación de todos los miembros
6. Entregar síntesis escrita de 2 páginas',
'rubrica',
DATE_ADD(NOW(), INTERVAL 7 DAY),
10.00,
TRUE);

SET @tarea1_id = LAST_INSERT_ID();

-- 5. Crear rúbrica para la tarea
INSERT INTO rubricas (tarea_id, titulo, descripcion, instrucciones_evaluacion, puntaje_total) VALUES
(@tarea1_id, 'Rúbrica de Evaluación: Presentación Conceptos Fundamentales de BD',
'Rúbrica para evaluar la presentación grupal sobre conceptos básicos de bases de datos',
'Evalúe cada criterio según los niveles de desempeño. Observe la participación individual y grupal. Proporcione retroalimentación constructiva.',
50.00);

SET @rubrica1_id = LAST_INSERT_ID();

-- 6. Crear criterios de la rúbrica
INSERT INTO criterios_rubrica (rubrica_id, nombre, descripcion, peso_porcentaje, orden) VALUES
(@rubrica1_id, 'Dominio del tema', 'Conocimiento y comprensión del contenido técnico presentado', 25.00, 1),
(@rubrica1_id, 'Participación en equipo', 'Nivel de contribución y colaboración de cada miembro del equipo', 20.00, 2),
(@rubrica1_id, 'Argumentación y claridad', 'Capacidad para explicar conceptos de forma clara y coherente', 20.00, 3),
(@rubrica1_id, 'Trabajo colaborativo', 'Evidencia de trabajo coordinado y distribución equitativa de tareas', 20.00, 4),
(@rubrica1_id, 'Actitud/disposición', 'Motivación, interés y profesionalismo durante la presentación', 15.00, 5);

-- 7. Crear niveles de desempeño para cada criterio
-- Criterio 1: Dominio del tema
SET @criterio1_id = (SELECT id FROM criterios_rubrica WHERE rubrica_id = @rubrica1_id AND nombre = 'Dominio del tema');
INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) VALUES
(@criterio1_id, 'Excelente', 'Demuestra dominio completo del tema. Explica conceptos con precisión técnica y puede responder preguntas complejas sin dificultad.', 10.00, 1, '#28a745'),
(@criterio1_id, 'Muy bueno', 'Muestra buen conocimiento del tema. Explica la mayoría de conceptos correctamente con pequeñas imprecisiones.', 9.00, 2, '#17a2b8'),
(@criterio1_id, 'Aceptable', 'Conocimiento básico del tema. Explica conceptos fundamentales pero con algunas confusiones menores.', 8.00, 3, '#ffc107'),
(@criterio1_id, 'Regular', 'Conocimiento limitado. Dificultades para explicar conceptos básicos y responder preguntas simples.', 7.00, 4, '#fd7e14'),
(@criterio1_id, 'Reprobatorio', 'Conocimiento insuficiente. No puede explicar conceptos básicos o presenta información incorrecta.', 6.00, 5, '#dc3545');

-- Criterio 2: Participación en equipo
SET @criterio2_id = (SELECT id FROM criterios_rubrica WHERE rubrica_id = @rubrica1_id AND nombre = 'Participación en equipo');
INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) VALUES
(@criterio2_id, 'Excelente', 'Todos los miembros participan activamente y de manera equilibrada. Se evidencia preparación individual.', 10.00, 1, '#28a745'),
(@criterio2_id, 'Muy bueno', 'La mayoría de miembros participa activamente con pequeñas diferencias en el nivel de contribución.', 9.00, 2, '#17a2b8'),
(@criterio2_id, 'Aceptable', 'Participación desigual pero todos los miembros contribuyen en alguna medida a la presentación.', 8.00, 3, '#ffc107'),
(@criterio2_id, 'Regular', 'Participación muy desigual. Algunos miembros dominan mientras otros apenas participan.', 7.00, 4, '#fd7e14'),
(@criterio2_id, 'Reprobatorio', 'Participación inadecuada. Uno o dos miembros realizan todo el trabajo mientras otros no contribuyen.', 6.00, 5, '#dc3545');

-- Criterio 3: Argumentación y claridad
SET @criterio3_id = (SELECT id FROM criterios_rubrica WHERE rubrica_id = @rubrica1_id AND nombre = 'Argumentación y claridad');
INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) VALUES
(@criterio3_id, 'Excelente', 'Argumentación lógica y coherente. Ideas organizadas secuencialmente con ejemplos relevantes y lenguaje técnico apropiado.', 10.00, 1, '#28a745'),
(@criterio3_id, 'Muy bueno', 'Argumentación clara con estructura lógica. Algunos ejemplos efectivos y uso adecuado del lenguaje técnico.', 9.00, 2, '#17a2b8'),
(@criterio3_id, 'Aceptable', 'Argumentación básica con estructura reconocible. Ejemplos simples y uso limitado del lenguaje técnico.', 8.00, 3, '#ffc107'),
(@criterio3_id, 'Regular', 'Argumentación confusa o desorganizada. Pocos ejemplos y uso inadecuado del lenguaje técnico.', 7.00, 4, '#fd7e14'),
(@criterio3_id, 'Reprobatorio', 'Argumentación incoherente o inexistente. Sin ejemplos relevantes y lenguaje inapropiado.', 6.00, 5, '#dc3545');

-- Criterio 4: Trabajo colaborativo
SET @criterio4_id = (SELECT id FROM criterios_rubrica WHERE rubrica_id = @rubrica1_id AND nombre = 'Trabajo colaborativo');
INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) VALUES
(@criterio4_id, 'Excelente', 'Evidencia clara de trabajo coordinado. Transiciones fluidas entre participantes y complementación de ideas.', 10.00, 1, '#28a745'),
(@criterio4_id, 'Muy bueno', 'Buen trabajo en equipo con coordinación visible. Algunas transiciones efectivas entre miembros.', 9.00, 2, '#17a2b8'),
(@criterio4_id, 'Aceptable', 'Trabajo en equipo básico. Distribución de tareas evidente pero poca integración de contenidos.', 8.00, 3, '#ffc107'),
(@criterio4_id, 'Regular', 'Trabajo individual disfrazado de grupal. Poca evidencia de colaboración efectiva.', 7.00, 4, '#fd7e14'),
(@criterio4_id, 'Reprobatorio', 'Sin evidencia de trabajo colaborativo. Presentación fragmentada sin coordinación.', 6.00, 5, '#dc3545');

-- Criterio 5: Actitud/disposición
SET @criterio5_id = (SELECT id FROM criterios_rubrica WHERE rubrica_id = @rubrica1_id AND nombre = 'Actitud/disposición');
INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) VALUES
(@criterio5_id, 'Excelente', 'Actitud muy profesional y entusiasta. Demuestra interés genuino y respeto hacia la audiencia.', 10.00, 1, '#28a745'),
(@criterio5_id, 'Muy bueno', 'Actitud profesional y positiva. Muestra interés y mantiene buena interacción con la audiencia.', 9.00, 2, '#17a2b8'),
(@criterio5_id, 'Aceptable', 'Actitud apropiada pero sin entusiasmo notable. Cumple con las expectativas básicas de presentación.', 8.00, 3, '#ffc107'),
(@criterio5_id, 'Regular', 'Actitud poco profesional o desinteresada. Poca conexión con la audiencia.', 7.00, 4, '#fd7e14'),
(@criterio5_id, 'Reprobatorio', 'Actitud inapropiada o irrespetuosa. Desinterés evidente o comportamiento disruptivo.', 6.00, 5, '#dc3545');

-- 8. Recomendaciones para docentes
INSERT INTO recomendaciones_docentes (rubrica_id, categoria, titulo, descripcion, tips_observacion, sugerencias_retroalimentacion, estrategias_motivacion, orden) VALUES
(@rubrica1_id, 'Evaluación General', 'Guía para docentes no especialistas en bases de datos',
'Esta rúbrica está diseñada para ser utilizada por docentes que pueden no tener experiencia profunda en bases de datos técnicas.',
'Observe: 1) Si los estudiantes pueden explicar qué es una base de datos en términos simples, 2) Si mencionan ejemplos cotidianos (redes sociales, bancos), 3) Si distinguen entre archivos simples y bases de datos organizadas',
'Proporcione retroalimentación inmediata: "Excelente ejemplo del banco como base de datos", "¿Podrías dar otro ejemplo de la vida diaria?", "¿Qué pasaría si no tuviéramos bases de datos organizadas?"',
'Motive preguntando: "¿Qué bases de datos usas diariamente sin darte cuenta?", "¿Cómo crees que WhatsApp guarda todos los mensajes?", Celebre cuando conecten conceptos con su experiencia personal.',
1),

(@rubrica1_id, 'Dominio del Tema', 'Cómo evaluar conocimiento técnico básico',
'Enfócate en la comprensión conceptual más que en la precisión técnica avanzada.',
'Busque: definiciones simples y correctas, ejemplos del mundo real, capacidad de responder preguntas básicas como "¿para qué sirve una base de datos?"',
'Diga: "Me gusta que hayas usado el ejemplo de...", "¿Podrías explicar eso con otras palabras?", "¿Qué ventaja tiene eso sobre usar archivos de Word?"',
'Conecte con experiencias: "¿Has notado cómo Netflix recuerda lo que viste?", "¿Por qué crees que es importante organizar información?"',
2),

(@rubrica1_id, 'Participación', 'Observando trabajo en equipo efectivo',
'La participación equilibrada es más importante que la perfección técnica.',
'Observe: rotación natural de participantes, escucha activa entre compañeros, construcción sobre ideas de otros, apoyo mutuo durante dudas',
'Comente: "Veo que todos contribuyeron", "Me gustó cómo te apoyaste en la respuesta de tu compañero", "¿Todos están de acuerdo con esta explicación?"',
'Fomente: "¿Qué opina el resto del equipo?", "¿Alguien más tiene un ejemplo diferente?", Reconozca esfuerzos de incluir a compañeros tímidos.',
3),

(@rubrica1_id, 'Comunicación', 'Evaluando claridad sin ser experto técnico',
'Priorice la capacidad de explicar conceptos complejos en términos simples.',
'Escuche: analogías efectivas, definiciones sin jerga técnica excesiva, respuestas a preguntas con paciencia, uso de ejemplos familiares',
'Retroalimente: "Esa analogía del archivo vs biblioteca fue muy clara", "¿Podrías explicar ese término técnico?", "Buen ejemplo cotidiano"',
'Anime: "¿Cómo lo explicarías a tu abuela?", "¿Qué ejemplo usarías para alguien de otra carrera?", Valore la simplicidad efectiva.',
4),

(@rubrica1_id, 'Actitud', 'Reconociendo engagement auténtico',
'La actitud positiva y el interés genuino son observables sin conocimiento técnico profundo.',
'Note: lenguaje corporal abierto, tono de voz variado, contacto visual, disposición a responder preguntas, paciencia con audiencia',
'Reconozca: "Se nota que investigaron a fondo", "Me gusta su entusiasmo por el tema", "Gracias por responder con tanta paciencia"',
'Motive: "¿Qué fue lo que más les sorprendió al investigar?", "¿Qué aplicación práctica les emocionó más?", Celebre curiosidad y preguntas.',
5);

-- 9. Inscribir algunos estudiantes de ejemplo a la materia
INSERT INTO inscripciones_materias (estudiante_id, materia_id) 
SELECT id, @materia_bd_id 
FROM usuarios 
WHERE rol = 'estudiante' 
LIMIT 3;

-- Vista para facilitar consultas de tareas con rúbricas
CREATE VIEW vista_tareas_completas AS
SELECT 
    t.id as tarea_id,
    t.titulo as tarea_titulo,
    t.descripcion as tarea_descripcion,
    t.fecha_entrega,
    t.puntaje_maximo,
    s.titulo as sesion_titulo,
    s.numero_sesion,
    b.titulo as bloque_titulo,
    b.numero_bloque,
    m.nombre as materia_nombre,
    m.codigo as materia_codigo,
    u.nombre as profesor_nombre,
    r.id as rubrica_id,
    r.titulo as rubrica_titulo,
    r.puntaje_total as rubrica_puntaje_total,
    COUNT(cr.id) as num_criterios
FROM tareas t
JOIN sesiones_clase s ON t.sesion_id = s.id
JOIN bloques_tematicos b ON s.bloque_id = b.id
JOIN materias m ON b.materia_id = m.id
JOIN usuarios u ON m.profesor_id = u.id
LEFT JOIN rubricas r ON t.id = r.tarea_id
LEFT JOIN criterios_rubrica cr ON r.id = cr.rubrica_id
WHERE t.activa = TRUE
GROUP BY t.id, r.id;

-- Procedimiento para calcular calificación final de rúbrica
DELIMITER //
CREATE PROCEDURE CalcularCalificacionRubrica(
    IN entrega_id_param INT,
    OUT calificacion_final DECIMAL(5,2)
)
BEGIN
    DECLARE total_puntaje DECIMAL(8,2) DEFAULT 0;
    DECLARE total_peso DECIMAL(8,2) DEFAULT 0;
    
    SELECT 
        SUM(er.puntaje_obtenido * (cr.peso_porcentaje / 100)) as puntaje_ponderado,
        SUM(cr.peso_porcentaje) as peso_total
    INTO total_puntaje, total_peso
    FROM evaluaciones_rubrica er
    JOIN criterios_rubrica cr ON er.criterio_id = cr.id
    WHERE er.entrega_id = entrega_id_param;
    
    -- Normalizar a escala de 10
    SET calificacion_final = (total_puntaje / total_peso) * 10;
END //
DELIMITER ;

COMMIT;