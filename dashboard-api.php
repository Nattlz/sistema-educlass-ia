<?php
// dashboard-api.php - API específica para datos del dashboard
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

// Verificar autenticación
function requireAuth() {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Sesión requerida']);
        exit;
    }
}

// Clase para manejar entregas de estudiantes
class StudentSubmissionManager {
    private $pdo;
    
    public function __construct() {
        $this->pdo = DatabaseManager::getInstance()->getConnection();
    }
    
    // Procesar entrega de tarea de estudiante
    public function submitTask($studentId, $taskId, $submissionData) {
        try {
            $this->pdo->beginTransaction();
            
            // Verificar que el estudiante puede entregar esta tarea
            if (!$this->canSubmitTask($studentId, $taskId)) {
                $this->pdo->rollBack();
                return ['success' => false, 'message' => 'No puedes entregar esta tarea'];
            }
            
            // Verificar si ya existe una entrega
            $existingSubmission = $this->getExistingSubmission($studentId, $taskId);
            if ($existingSubmission) {
                $this->pdo->rollBack();
                return ['success' => false, 'message' => 'Ya has entregado esta tarea'];
            }
            
            // Procesar archivos adjuntos (si los hay)
            $attachments = [];
            if (!empty($submissionData['files'])) {
                $attachments = $this->processFileUploads($submissionData['files']);
            }
            
            // Crear registro de entrega
            $sql = "
                INSERT INTO entregas_tareas 
                (tarea_id, estudiante_id, comentarios_estudiante, archivos_adjuntos, estado)
                VALUES (?, ?, ?, ?, 'entregada')
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $taskId,
                $studentId,
                $submissionData['comments'] ?? '',
                json_encode($attachments)
            ]);
            
            $submissionId = $this->pdo->lastInsertId();
            
            $this->pdo->commit();
            
            // Registrar actividad
            $this->logStudentActivity($studentId, 'task_submitted', [
                'task_id' => $taskId,
                'submission_id' => $submissionId
            ]);
            
            return [
                'success' => true,
                'message' => 'Tarea entregada exitosamente',
                'submission_id' => $submissionId
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            Utils::log('Error submitting student task: ' . $e->getMessage(), 'ERROR');
            return ['success' => false, 'message' => 'Error al entregar la tarea'];
        }
    }
    
    private function canSubmitTask($studentId, $taskId) {
        $sql = "
            SELECT 1 FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            JOIN inscripciones_materias im ON m.id = im.materia_id
            WHERE t.id = ? 
            AND im.estudiante_id = ? 
            AND im.estado = 'activa'
            AND t.activa = 1
            AND t.visible_estudiantes = 1
            AND (t.fecha_entrega > NOW() OR (t.permite_entrega_tardia = 1 AND t.fecha_limite_entrega > NOW()))
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$taskId, $studentId]);
        
        return $stmt->fetchColumn() !== false;
    }
    
    private function getExistingSubmission($studentId, $taskId) {
        $sql = "SELECT id FROM entregas_tareas WHERE estudiante_id = ? AND tarea_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId, $taskId]);
        
        return $stmt->fetch();
    }
    
    private function processFileUploads($files) {
        // En un sistema real, aquí se procesarían los archivos subidos
        // Por ahora solo simular la estructura
        $attachments = [];
        
        foreach ($files as $file) {
            $attachments[] = [
                'original_name' => $file['name'],
                'stored_name' => uniqid() . '_' . $file['name'],
                'size' => $file['size'],
                'type' => $file['type'],
                'upload_time' => date('Y-m-d H:i:s')
            ];
        }
        
        return $attachments;
    }
    
    private function logStudentActivity($studentId, $action, $details) {
        try {
            $sql = "INSERT INTO user_activity (usuario_id, action, details) VALUES (?, ?, ?)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$studentId, $action, json_encode($details)]);
        } catch (Exception $e) {
            // Log error but don't fail the main operation
            Utils::log('Error logging student activity: ' . $e->getMessage(), 'ERROR');
        }
    }
}

class DashboardAPI {
    private $pdo;
    private $submissionManager;
    
    public function __construct() {
        $this->pdo = DatabaseManager::getInstance()->getConnection();
        $this->submissionManager = new StudentSubmissionManager();
    }
    
    // Obtener datos del dashboard para estudiantes
    public function getStudentDashboard($studentId) {
        try {
            requireAuth();
            
            $data = [];
            
            // Estadísticas del estudiante
            $data['stats'] = $this->getStudentStats($studentId);
            
            // Materias inscritas
            $data['subjects'] = $this->getStudentSubjects($studentId);
            
            // Tareas pendientes
            $data['pending_tasks'] = $this->getStudentPendingTasks($studentId);
            
            // Próximas clases
            $data['upcoming_classes'] = $this->getUpcomingClasses($studentId);
            
            // Calificaciones recientes
            $data['recent_grades'] = $this->getRecentGrades($studentId);
            
            return $this->jsonResponse(true, 'Datos del dashboard obtenidos exitosamente', 200, $data);
            
        } catch (Exception $e) {
            Utils::log('Error getting student dashboard: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al cargar el dashboard', 500);
        }
    }
    
    // Obtener estadísticas del estudiante
    private function getStudentStats($studentId) {
        $stats = [];
        
        // Número de materias inscritas
        $sql = "SELECT COUNT(*) FROM inscripciones_materias WHERE estudiante_id = ? AND estado = 'activa'";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId]);
        $stats['materias_inscritas'] = $stmt->fetchColumn();
        
        // Promedio general
        $sql = "
            SELECT AVG(et.calificacion) as promedio
            FROM entregas_tareas et
            JOIN tareas t ON et.tarea_id = t.id
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            JOIN inscripciones_materias im ON m.id = im.materia_id
            WHERE im.estudiante_id = ? AND et.calificacion IS NOT NULL AND im.estado = 'activa'
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId]);
        $stats['promedio_general'] = round($stmt->fetchColumn() ?: 0, 1);
        
        // Tareas pendientes
        $sql = "
            SELECT COUNT(*) as pendientes
            FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            JOIN inscripciones_materias im ON m.id = im.materia_id
            LEFT JOIN entregas_tareas et ON t.id = et.tarea_id AND et.estudiante_id = ?
            WHERE im.estudiante_id = ? 
            AND im.estado = 'activa'
            AND t.activa = 1 
            AND t.fecha_entrega > NOW()
            AND et.id IS NULL
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId, $studentId]);
        $stats['tareas_pendientes'] = $stmt->fetchColumn();
        
        // Créditos obtenidos
        $sql = "
            SELECT SUM(m.creditos) as creditos
            FROM inscripciones_materias im
            JOIN materias m ON im.materia_id = m.id
            WHERE im.estudiante_id = ? AND im.estado IN ('activa', 'completada')
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId]);
        $stats['creditos_obtenidos'] = $stmt->fetchColumn() ?: 0;
        
        return $stats;
    }
    
    // Obtener materias del estudiante
    private function getStudentSubjects($studentId) {
        $sql = "
            SELECT 
                m.*,
                im.estado as estado_inscripcion,
                im.calificacion_final,
                u.nombre as profesor_nombre,
                COUNT(DISTINCT t.id) as total_tareas,
                COUNT(DISTINCT CASE WHEN et.id IS NULL AND t.fecha_entrega > NOW() THEN t.id END) as tareas_pendientes,
                COUNT(DISTINCT s.id) as total_sesiones,
                COUNT(DISTINCT CASE WHEN s.fecha_realizada IS NOT NULL THEN s.id END) as sesiones_completadas
            FROM inscripciones_materias im
            JOIN materias m ON im.materia_id = m.id
            JOIN usuarios u ON m.profesor_id = u.id
            LEFT JOIN bloques_tematicos b ON m.id = b.materia_id
            LEFT JOIN sesiones_clase s ON b.id = s.bloque_id
            LEFT JOIN tareas t ON s.id = t.sesion_id AND t.activa = 1
            LEFT JOIN entregas_tareas et ON t.id = et.tarea_id AND et.estudiante_id = ?
            WHERE im.estudiante_id = ? AND im.estado = 'activa'
            GROUP BY m.id
            ORDER BY m.nombre
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId, $studentId]);
        
        return $stmt->fetchAll();
    }
    
    // Obtener tareas pendientes del estudiante
    private function getStudentPendingTasks($studentId) {
        $sql = "
            SELECT 
                t.*,
                s.titulo as sesion_titulo,
                s.subtema,
                b.titulo as bloque_titulo,
                b.numero_bloque,
                m.nombre as materia_nombre,
                m.codigo as materia_codigo,
                u.nombre as profesor_nombre,
                r.id as rubrica_id,
                CASE 
                    WHEN t.fecha_entrega <= DATE_ADD(NOW(), INTERVAL 2 DAY) THEN 'urgent'
                    WHEN t.fecha_entrega <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'soon'
                    ELSE 'normal'
                END as urgency_level
            FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            JOIN usuarios u ON m.profesor_id = u.id
            JOIN inscripciones_materias im ON m.id = im.materia_id
            LEFT JOIN rubricas r ON t.id = r.tarea_id
            LEFT JOIN entregas_tareas et ON t.id = et.tarea_id AND et.estudiante_id = ?
            WHERE im.estudiante_id = ? 
            AND im.estado = 'activa'
            AND t.activa = 1 
            AND t.visible_estudiantes = 1
            AND t.fecha_entrega > NOW()
            AND et.id IS NULL
            ORDER BY t.fecha_entrega ASC
            LIMIT 10
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId, $studentId]);
        
        return $stmt->fetchAll();
    }
    
    // Obtener próximas clases
    private function getUpcomingClasses($studentId) {
        // Por ahora retorna datos simulados, en el futuro conectar con sistema de horarios
        return [
            [
                'hora' => '10:00 AM',
                'materia' => 'Base de Datos',
                'aula' => 'Aula 201',
                'profesor' => 'Prof. Ana Martínez',
                'tema' => 'Sintaxis básica de SQL',
                'fecha' => date('Y-m-d H:i:s', strtotime('next Wednesday 10:00'))
            ],
            [
                'hora' => '02:00 PM',
                'materia' => 'Matemáticas Avanzadas',
                'aula' => 'Aula 305',
                'profesor' => 'Prof. García',
                'tema' => 'Cálculo diferencial',
                'fecha' => date('Y-m-d H:i:s', strtotime('next Wednesday 14:00'))
            ]
        ];
    }
    
    // Obtener calificaciones recientes
    private function getRecentGrades($studentId) {
        $sql = "
            SELECT 
                et.calificacion,
                et.fecha_calificacion,
                et.comentarios_profesor,
                t.titulo as tarea_titulo,
                t.puntaje_maximo,
                m.nombre as materia_nombre,
                m.codigo as materia_codigo
            FROM entregas_tareas et
            JOIN tareas t ON et.tarea_id = t.id
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE et.estudiante_id = ? 
            AND et.calificacion IS NOT NULL
            ORDER BY et.fecha_calificacion DESC
            LIMIT 5
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$studentId]);
        
        return $stmt->fetchAll();
    }
    
    // Obtener dashboard de profesor
    public function getProfessorDashboard($professorId) {
        try {
            requireAuth();
            
            $data = [];
            
            // Estadísticas del profesor
            $data['stats'] = $this->getProfessorStats($professorId);
            
            // Materias que imparte
            $data['subjects'] = $this->getProfessorSubjects($professorId);
            
            // Actividad reciente
            $data['recent_activity'] = $this->getRecentActivity($professorId);
            
            // Tareas que requieren atención
            $data['tasks_needing_attention'] = $this->getTasksNeedingAttention($professorId);
            
            return $this->jsonResponse(true, 'Dashboard del profesor cargado exitosamente', 200, $data);
            
        } catch (Exception $e) {
            Utils::log('Error getting professor dashboard: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al cargar el dashboard', 500);
        }
    }
    
    // Estadísticas del profesor
    private function getProfessorStats($professorId) {
        $stats = [];
        
        // Materias impartidas
        $sql = "SELECT COUNT(*) FROM materias WHERE profesor_id = ? AND activa = 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        $stats['materias_impartidas'] = $stmt->fetchColumn();
        
        // Total de estudiantes
        $sql = "
            SELECT COUNT(DISTINCT im.estudiante_id) as total
            FROM inscripciones_materias im
            JOIN materias m ON im.materia_id = m.id
            WHERE m.profesor_id = ? AND im.estado = 'activa'
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        $stats['total_estudiantes'] = $stmt->fetchColumn();
        
        // Tareas activas
        $sql = "
            SELECT COUNT(*) as total
            FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE m.profesor_id = ? AND t.activa = 1
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        $stats['tareas_activas'] = $stmt->fetchColumn();
        
        // Entregas por revisar
        $sql = "
            SELECT COUNT(*) as por_revisar
            FROM entregas_tareas et
            JOIN tareas t ON et.tarea_id = t.id
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE m.profesor_id = ? AND et.estado IN ('entregada', 'tarde')
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        $stats['entregas_por_revisar'] = $stmt->fetchColumn();
        
        return $stats;
    }
    
    // Materias del profesor
    private function getProfessorSubjects($professorId) {
        $sql = "
            SELECT 
                m.*,
                COUNT(DISTINCT im.estudiante_id) as estudiantes_inscritos,
                COUNT(DISTINCT t.id) as total_tareas,
                COUNT(DISTINCT CASE WHEN et.estado IN ('entregada', 'tarde') THEN et.id END) as entregas_pendientes,
                AVG(CASE WHEN et.calificacion IS NOT NULL THEN et.calificacion END) as promedio_materia
            FROM materias m
            LEFT JOIN inscripciones_materias im ON m.id = im.materia_id AND im.estado = 'activa'
            LEFT JOIN bloques_tematicos b ON m.id = b.materia_id
            LEFT JOIN sesiones_clase s ON b.id = s.bloque_id
            LEFT JOIN tareas t ON s.id = t.sesion_id AND t.activa = 1
            LEFT JOIN entregas_tareas et ON t.id = et.tarea_id
            WHERE m.profesor_id = ? AND m.activa = 1
            GROUP BY m.id
            ORDER BY m.nombre
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        
        return $stmt->fetchAll();
    }
    
    // Actividad reciente del profesor
    private function getRecentActivity($professorId) {
        $sql = "
            SELECT 
                'entrega' as tipo,
                et.fecha_entrega as fecha,
                CONCAT('Nueva entrega: ', t.titulo) as descripcion,
                u.nombre as estudiante_nombre,
                m.nombre as materia_nombre
            FROM entregas_tareas et
            JOIN tareas t ON et.tarea_id = t.id
            JOIN usuarios u ON et.estudiante_id = u.id
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE m.profesor_id = ? 
            AND et.fecha_entrega >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            
            UNION ALL
            
            SELECT 
                'tarea_creada' as tipo,
                t.created_at as fecha,
                CONCAT('Tarea creada: ', t.titulo) as descripcion,
                NULL as estudiante_nombre,
                m.nombre as materia_nombre
            FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE m.profesor_id = ? 
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            
            ORDER BY fecha DESC
            LIMIT 10
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId, $professorId]);
        
        return $stmt->fetchAll();
    }
    
    // Obtener tareas que necesitan atención
    private function getTasksNeedingAttention($professorId) {
        $sql = "
            SELECT 
                t.*,
                s.titulo as sesion_titulo,
                m.nombre as materia_nombre,
                m.codigo as materia_codigo,
                COUNT(DISTINCT et.id) as entregas_pendientes,
                MIN(et.fecha_entrega) as primera_entrega
            FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            JOIN entregas_tareas et ON t.id = et.tarea_id
            WHERE m.profesor_id = ? 
            AND et.estado IN ('entregada', 'tarde')
            GROUP BY t.id
            HAVING entregas_pendientes > 0
            ORDER BY primera_entrega ASC
            LIMIT 5
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$professorId]);
        
        return $stmt->fetchAll();
    }
    
    // Obtener detalles de una tarea específica para estudiantes
    public function getTaskDetails($taskId, $studentId) {
        try {
            requireAuth();
            
            // Verificar que el estudiante está inscrito en la materia
            $sql = "
                SELECT 
                    t.*,
                    s.titulo as sesion_titulo,
                    s.subtema,
                    s.contenido as sesion_contenido,
                    b.titulo as bloque_titulo,
                    m.nombre as materia_nombre,
                    m.codigo as materia_codigo,
                    u.nombre as profesor_nombre,
                    r.id as rubrica_id,
                    et.id as entrega_id,
                    et.estado as estado_entrega,
                    et.fecha_entrega as fecha_entrega_real,
                    et.calificacion
                FROM tareas t
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                JOIN usuarios u ON m.profesor_id = u.id
                JOIN inscripciones_materias im ON m.id = im.materia_id
                LEFT JOIN rubricas r ON t.id = r.tarea_id
                LEFT JOIN entregas_tareas et ON t.id = et.tarea_id AND et.estudiante_id = ?
                WHERE t.id = ? 
                AND im.estudiante_id = ? 
                AND im.estado = 'activa'
                AND t.visible_estudiantes = 1
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$studentId, $taskId, $studentId]);
            $taskDetails = $stmt->fetch();
            
            if (!$taskDetails) {
                return $this->jsonResponse(false, 'Tarea no encontrada o sin acceso', 404);
            }
            
            // Si tiene rúbrica, obtener sus detalles
            if ($taskDetails['rubrica_id']) {
                $taskDetails['rubrica'] = $this->getRubricForStudent($taskDetails['rubrica_id']);
            }
            
            return $this->jsonResponse(true, 'Detalles de tarea obtenidos exitosamente', 200, [
                'task' => $taskDetails
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error getting task details: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener detalles de la tarea', 500);
        }
    }
    
    // Obtener rúbrica para estudiante (vista simplificada)
    private function getRubricForStudent($rubricId) {
        $sql = "
            SELECT 
                r.*,
                cr.nombre as criterio_nombre,
                cr.descripcion as criterio_descripcion,
                cr.peso_porcentaje,
                cr.orden as criterio_orden,
                nd.nivel,
                nd.descripcion as nivel_descripcion,
                nd.puntaje,
                nd.orden as nivel_orden
            FROM rubricas r
            JOIN criterios_rubrica cr ON r.id = cr.rubrica_id
            JOIN niveles_desempeno nd ON cr.id = nd.criterio_id
            WHERE r.id = ? AND cr.activo = 1
            ORDER BY cr.orden ASC, nd.orden ASC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$rubricId]);
        $rubricData = $stmt->fetchAll();
        
        // Organizar datos de la rúbrica
        $rubric = [
            'id' => $rubricId,
            'criterios' => []
        ];
        
        $currentCriterion = null;
        
        foreach ($rubricData as $row) {
            if ($currentCriterion === null || $currentCriterion['nombre'] !== $row['criterio_nombre']) {
                if ($currentCriterion !== null) {
                    $rubric['criterios'][] = $currentCriterion;
                }
                
                $currentCriterion = [
                    'nombre' => $row['criterio_nombre'],
                    'descripcion' => $row['criterio_descripcion'],
                    'peso_porcentaje' => $row['peso_porcentaje'],
                    'niveles' => []
                ];
                
                $rubric['titulo'] = $row['titulo'];
                $rubric['descripcion'] = $row['descripcion'];
            }
            
            $currentCriterion['niveles'][] = [
                'nivel' => $row['nivel'],
                'descripcion' => $row['nivel_descripcion'],
                'puntaje' => $row['puntaje']
            ];
        }
        
        if ($currentCriterion !== null) {
            $rubric['criterios'][] = $currentCriterion;
        }
        
        return $rubric;
    }
    
    // Manejar entregas de estudiantes
    public function submitStudentTask($studentId, $data) {
        if (empty($data['task_id'])) {
            return $this->jsonResponse(false, 'Task ID requerido', 400);
        }
        
        $result = $this->submissionManager->submitTask($studentId, $data['task_id'], $data);
        
        if ($result['success']) {
            return $this->jsonResponse(true, $result['message'], 201, [
                'submission_id' => $result['submission_id']
            ]);
        } else {
            return $this->jsonResponse(false, $result['message'], 400);
        }
    }
    
    // Enviar respuesta JSON
    private function jsonResponse($success, $message, $code = 200, $data = null) {
        http_response_code($code);
        
        $response = [
            'success' => $success,
            'message' => $message,
            'timestamp' => date('c')
        ];
        
        if ($data !== null) {
            $response['data'] = $data;
        }
        
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ROUTER PRINCIPAL
try {
    $dashboardAPI = new DashboardAPI();
    
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $getData = $_GET ?? [];
    
    $data = array_merge($getData, $input);
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'get_student_dashboard':
            $studentId = $data['student_id'] ?? $_SESSION['user_id'];
            if ($_SESSION['user_role'] !== 'estudiante' && $_SESSION['user_id'] != $studentId) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
                exit;
            }
            $dashboardAPI->getStudentDashboard($studentId);
            break;
            
        case 'get_professor_dashboard':
            $professorId = $data['professor_id'] ?? $_SESSION['user_id'];
            if (!in_array($_SESSION['user_role'], ['profesor', 'admin']) && $_SESSION['user_id'] != $professorId) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
                exit;
            }
            $dashboardAPI->getProfessorDashboard($professorId);
            break;
            
        case 'get_task_details':
            if (empty($data['task_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Task ID requerido']);
                exit;
            }
            
            $studentId = $_SESSION['user_role'] === 'estudiante' ? $_SESSION['user_id'] : $data['student_id'];
            $dashboardAPI->getTaskDetails($data['task_id'], $studentId);
            break;
            
        case 'submit_student_task':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido']);
                exit;
            }
            
            if ($_SESSION['user_role'] !== 'estudiante') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Solo estudiantes pueden entregar tareas']);
                exit;
            }
            
            $dashboardAPI->submitStudentTask($_SESSION['user_id'], $data);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Acción no válida',
                'available_actions' => [
                    'get_student_dashboard' => 'Obtener dashboard del estudiante',
                    'get_professor_dashboard' => 'Obtener dashboard del profesor',
                    'get_task_details' => 'Obtener detalles de una tarea',
                    'submit_student_task' => 'Entregar tarea (solo estudiantes)'
                ]
            ]);
            break;
    }
    
} catch (Exception $e) {
    Utils::log('Dashboard API Error: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno del servidor',
        'timestamp' => date('c')
    ]);
}

// Funciones auxiliares globales

/**
 * Verificar si el usuario tiene permisos para ver información de otro usuario
 */
function checkDashboardAccess($requestedUserId, $currentUserId, $currentRole) {
    // Los administradores pueden ver cualquier dashboard
    if ($currentRole === 'admin') {
        return true;
    }
    
    // Los usuarios solo pueden ver su propio dashboard
    if ($requestedUserId == $currentUserId) {
        return true;
    }
    
    // Los profesores pueden ver dashboards de sus estudiantes (implementar lógica específica)
    if ($currentRole === 'profesor') {
        // TODO: Verificar si el profesor tiene acceso al estudiante
        return false;
    }
    
    return false;
}

/**
 * Obtener configuración del dashboard según el rol del usuario
 */
function getDashboardConfig($userRole) {
    $configs = [
        'estudiante' => [
            'widgets' => ['stats', 'pending_tasks', 'subjects', 'recent_grades', 'upcoming_classes'],
            'refresh_interval' => 300, // 5 minutos
            'features' => ['task_submission', 'grade_view', 'schedule_view']
        ],
        'profesor' => [
            'widgets' => ['stats', 'subjects', 'tasks_needing_attention', 'recent_activity'],
            'refresh_interval' => 180, // 3 minutos
            'features' => ['task_management', 'grading', 'student_management']
        ],
        'admin' => [
            'widgets' => ['system_stats', 'user_management', 'reports', 'maintenance'],
            'refresh_interval' => 600, // 10 minutos
            'features' => ['user_management', 'system_config', 'reports', 'maintenance']
        ]
    ];
    
    return $configs[$userRole] ?? $configs['estudiante'];
}

/**
 * Formatear datos para el dashboard
 */
function formatDashboardData($data, $userRole) {
    $formatted = $data;
    
    switch ($userRole) {
        case 'estudiante':
            // Formatear fechas para estudiantes
            if (isset($formatted['pending_tasks'])) {
                foreach ($formatted['pending_tasks'] as &$task) {
                    $task['fecha_entrega_formatted'] = date('d/m/Y H:i', strtotime($task['fecha_entrega']));
                    $task['dias_restantes'] = max(0, floor((strtotime($task['fecha_entrega']) - time()) / 86400));
                }
            }
            
            if (isset($formatted['recent_grades'])) {
                foreach ($formatted['recent_grades'] as &$grade) {
                    $grade['porcentaje'] = round(($grade['calificacion'] / $grade['puntaje_maximo']) * 100, 1);
                    $grade['fecha_formatted'] = date('d/m/Y', strtotime($grade['fecha_calificacion']));
                }
            }
            break;
            
        case 'profesor':
            // Formatear datos para profesores
            if (isset($formatted['tasks_needing_attention'])) {
                foreach ($formatted['tasks_needing_attention'] as &$task) {
                    $task['dias_desde_primera_entrega'] = floor((time() - strtotime($task['primera_entrega'])) / 86400);
                }
            }
            break;
    }
    
    return $formatted;
}

/**
 * Registrar actividad del dashboard
 */
function logDashboardActivity($userId, $action, $details = []) {
    try {
        $logData = [
            'user_id' => $userId,
            'action' => $action,
            'details' => json_encode($details),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        // En un sistema real, esto se guardaría en una tabla de logs
        error_log('Dashboard Activity: ' . json_encode($logData));
        
    } catch (Exception $e) {
        error_log('Error logging dashboard activity: ' . $e->getMessage());
    }
}

/**
 * Limpiar datos sensibles antes de enviar al frontend
 */
function sanitizeDashboardData($data, $userRole) {
    // Remover campos sensibles según el rol
    if ($userRole === 'estudiante') {
        // Los estudiantes no necesitan ver cierta información administrativa
        unset($data['internal_notes']);
        unset($data['admin_comments']);
    }
    
    return $data;
}

?>