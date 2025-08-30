<?php
// tasks.php - Backend para sistema de gestión de tareas
session_start();

// Headers CORS y JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Incluir configuración y autenticación
require_once 'config.php';

// Verificar autenticación
function requireAuth() {
    if (empty($_SESSION['user_id']) || empty($_SESSION['user_role'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Autenticación requerida']);
        exit;
    }
    
    // Solo profesores y admins pueden gestionar tareas
    if (!in_array($_SESSION['user_role'], ['profesor', 'admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
        exit;
    }
}

// Clase principal para gestión de tareas
class TaskManager {
    private $pdo;
    
    public function __construct() {
        $this->pdo = DatabaseManager::getInstance()->getConnection();
    }
    
    // Crear nueva tarea
    public function createTask($data) {
        try {
            requireAuth();
            
            // Validar datos requeridos
            $required = ['sesion_id', 'titulo', 'tipo_evaluacion', 'fecha_entrega'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return $this->jsonResponse(false, "El campo {$field} es requerido");
                }
            }
            
            // Verificar que la sesión pertenece al profesor
            if (!$this->verifySessionOwnership($data['sesion_id'])) {
                return $this->jsonResponse(false, 'No tienes permiso para crear tareas en esta sesión', 403);
            }
            
            // Preparar datos para inserción
            $taskData = [
                'sesion_id' => (int)$data['sesion_id'],
                'titulo' => Utils::sanitizeInput($data['titulo']),
                'descripcion' => Utils::sanitizeInput($data['descripcion'] ?? ''),
                'instrucciones' => Utils::sanitizeInput($data['instrucciones'] ?? ''),
                'tipo_evaluacion' => $data['tipo_evaluacion'],
                'fecha_entrega' => $data['fecha_entrega'],
                'puntaje_maximo' => (float)($data['puntaje_maximo'] ?? 10.0),
                'permite_entrega_tardia' => isset($data['permite_entrega_tardia']) ? 1 : 0,
                'descuento_entrega_tardia' => (float)($data['descuento_entrega_tardia'] ?? 0.10),
                'archivos_requeridos' => isset($data['archivos_requeridos']) ? 1 : 0,
                'tamano_maximo_mb' => (int)($data['tamano_maximo_mb'] ?? 10)
            ];
            
            // Manejar fecha límite opcional
            if (!empty($data['fecha_limite_entrega'])) {
                $taskData['fecha_limite_entrega'] = $data['fecha_limite_entrega'];
            }
            
            // Manejar formatos permitidos
            if (!empty($data['formatos_permitidos']) && is_array($data['formatos_permitidos'])) {
                $taskData['formatos_permitidos'] = json_encode($data['formatos_permitidos']);
            }
            
            // Insertar tarea
            $sql = "INSERT INTO tareas (" . implode(', ', array_keys($taskData)) . ") 
                    VALUES (:" . implode(', :', array_keys($taskData)) . ")";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($taskData);
            
            $taskId = $this->pdo->lastInsertId();
            
            // Si es evaluación por rúbrica, crear rúbrica básica
            if ($data['tipo_evaluacion'] === 'rubrica') {
                $this->createBasicRubric($taskId, $data);
            }
            
            // Log de actividad
            $this->logActivity('task_created', ['task_id' => $taskId, 'title' => $taskData['titulo']]);
            
            return $this->jsonResponse(true, 'Tarea creada exitosamente', 201, [
                'task_id' => $taskId,
                'redirect_to' => 'overview'
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error creating task: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al crear la tarea', 500);
        }
    }
    
    // Obtener tareas del profesor
    public function getProfessorTasks($professorId = null) {
        try {
            requireAuth();
            
            $professorId = $professorId ?: $_SESSION['user_id'];
            
            $sql = "
                SELECT 
                    t.*,
                    s.titulo as sesion_titulo,
                    s.numero_sesion,
                    b.titulo as bloque_titulo,
                    b.numero_bloque,
                    m.nombre as materia_nombre,
                    m.codigo as materia_codigo,
                    COUNT(DISTINCT et.id) as total_entregas,
                    COUNT(DISTINCT CASE WHEN et.estado = 'entregada' THEN et.id END) as entregas_pendientes,
                    COUNT(DISTINCT CASE WHEN et.estado = 'calificada' THEN et.id END) as entregas_calificadas,
                    AVG(et.calificacion) as promedio_calificaciones
                FROM tareas t
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                LEFT JOIN entregas_tareas et ON t.id = et.tarea_id
                WHERE m.profesor_id = ? AND t.activa = 1
                GROUP BY t.id
                ORDER BY t.fecha_entrega ASC
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            
            $tasks = $stmt->fetchAll();
            
            return $this->jsonResponse(true, 'Tareas obtenidas exitosamente', 200, [
                'tasks' => $tasks,
                'total' => count($tasks)
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error getting professor tasks: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener las tareas', 500);
        }
    }
    
    // Obtener entregas de una tarea
    public function getTaskSubmissions($taskId) {
        try {
            requireAuth();
            
            // Verificar que la tarea pertenece al profesor
            if (!$this->verifyTaskOwnership($taskId)) {
                return $this->jsonResponse(false, 'No tienes permiso para ver estas entregas', 403);
            }
            
            $sql = "
                SELECT 
                    et.*,
                    u.nombre as estudiante_nombre,
                    u.matricula as estudiante_matricula,
                    u.email as estudiante_email,
                    t.titulo as tarea_titulo,
                    t.puntaje_maximo,
                    CASE 
                        WHEN et.fecha_entrega > t.fecha_entrega THEN 'tarde'
                        WHEN et.estado = 'calificada' THEN 'calificada'
                        WHEN et.estado = 'entregada' THEN 'pendiente'
                        ELSE et.estado
                    END as estado_display
                FROM entregas_tareas et
                JOIN usuarios u ON et.estudiante_id = u.id
                JOIN tareas t ON et.tarea_id = t.id
                WHERE et.tarea_id = ?
                ORDER BY et.fecha_entrega DESC
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$taskId]);
            
            $submissions = $stmt->fetchAll();
            
            return $this->jsonResponse(true, 'Entregas obtenidas exitosamente', 200, [
                'submissions' => $submissions,
                'total' => count($submissions)
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error getting task submissions: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener las entregas', 500);
        }
    }
    
    // Calificar entrega por rúbrica
    public function gradeSubmissionByRubric($submissionId, $evaluationData) {
        try {
            requireAuth();
            
            $this->pdo->beginTransaction();
            
            // Verificar que la entrega existe y pertenece al profesor
            $submission = $this->getSubmissionDetails($submissionId);
            if (!$submission) {
                $this->pdo->rollBack();
                return $this->jsonResponse(false, 'Entrega no encontrada', 404);
            }
            
            // Verificar propiedad
            if (!$this->verifyTaskOwnership($submission['tarea_id'])) {
                $this->pdo->rollBack();
                return $this->jsonResponse(false, 'No tienes permiso para calificar esta entrega', 403);
            }
            
            // Obtener rúbrica de la tarea
            $rubric = $this->getTaskRubric($submission['tarea_id']);
            if (!$rubric) {
                $this->pdo->rollBack();
                return $this->jsonResponse(false, 'No se encontró la rúbrica para esta tarea', 404);
            }
            
            // Procesar evaluación por criterios
            $totalScore = 0;
            $totalWeight = 0;
            
            foreach ($evaluationData['criteria'] as $criterionName => $criterionData) {
                // Obtener información del criterio
                $criterion = $this->getCriterionByName($rubric['id'], $criterionName);
                if (!$criterion) continue;
                
                // Obtener nivel seleccionado
                $level = $this->getPerformanceLevel($criterion['id'], $criterionData['levelId']);
                if (!$level) continue;
                
                // Calcular puntos ponderados
                $weightedScore = $level['puntaje'] * ($criterion['peso_porcentaje'] / 100);
                $totalScore += $weightedScore;
                $totalWeight += $criterion['peso_porcentaje'] / 100;
                
                // Guardar evaluación del criterio
                $this->saveRubricEvaluation(
                    $submissionId, 
                    $criterion['id'], 
                    $level['id'], 
                    $level['puntaje'],
                    $criterionData['comments'] ?? ''
                );
            }
            
            // Calcular calificación final (escala de 10)
            $finalGrade = $totalWeight > 0 ? ($totalScore / $totalWeight) : 0;
            
            // Actualizar entrega con calificación
            $updateSql = "
                UPDATE entregas_tareas 
                SET calificacion = ?, 
                    comentarios_profesor = ?, 
                    estado = 'calificada',
                    fecha_calificacion = NOW(),
                    calificado_por = ?
                WHERE id = ?
            ";
            
            $stmt = $this->pdo->prepare($updateSql);
            $stmt->execute([
                round($finalGrade, 2),
                $evaluationData['generalComments'] ?? '',
                $_SESSION['user_id'],
                $submissionId
            ]);
            
            $this->pdo->commit();
            
            // Log de actividad
            $this->logActivity('submission_graded', [
                'submission_id' => $submissionId,
                'student_id' => $submission['estudiante_id'],
                'final_grade' => round($finalGrade, 2)
            ]);
            
            return $this->jsonResponse(true, 'Entrega calificada exitosamente', 200, [
                'final_grade' => round($finalGrade, 2),
                'submission_id' => $submissionId
            ]);
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            Utils::log('Error grading submission: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al calificar la entrega', 500);
        }
    }
    
    // Obtener estadísticas del profesor
    public function getProfessorStats($professorId = null) {
        try {
            requireAuth();
            
            $professorId = $professorId ?: $_SESSION['user_id'];
            
            $stats = [];
            
            // Total de tareas activas
            $sql = "
                SELECT COUNT(*) as total_tasks
                FROM tareas t
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                WHERE m.profesor_id = ? AND t.activa = 1
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            $stats['total_tasks'] = $stmt->fetchColumn();
            
            // Entregas pendientes de revisar
            $sql = "
                SELECT COUNT(*) as pending_review
                FROM entregas_tareas et
                JOIN tareas t ON et.tarea_id = t.id
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                WHERE m.profesor_id = ? AND et.estado IN ('entregada', 'tarde')
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            $stats['pending_review'] = $stmt->fetchColumn();
            
            // Total de estudiantes
            $sql = "
                SELECT COUNT(DISTINCT im.estudiante_id) as total_students
                FROM inscripciones_materias im
                JOIN materias m ON im.materia_id = m.id
                WHERE m.profesor_id = ? AND im.estado = 'activa'
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            $stats['total_students'] = $stmt->fetchColumn();
            
            // Promedio general de calificaciones
            $sql = "
                SELECT AVG(et.calificacion) as average_grade
                FROM entregas_tareas et
                JOIN tareas t ON et.tarea_id = t.id
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                WHERE m.profesor_id = ? AND et.calificacion IS NOT NULL
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            $stats['average_grade'] = round($stmt->fetchColumn() ?: 0, 1);
            
            return $this->jsonResponse(true, 'Estadísticas obtenidas exitosamente', 200, $stats);
            
        } catch (Exception $e) {
            Utils::log('Error getting professor stats: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener estadísticas', 500);
        }
    }
    
    // Obtener rúbricas del profesor
    public function getProfessorRubrics($professorId = null) {
        try {
            requireAuth();
            
            $professorId = $professorId ?: $_SESSION['user_id'];
            
            $sql = "
                SELECT 
                    r.*,
                    t.titulo as tarea_titulo,
                    s.titulo as sesion_titulo,
                    m.nombre as materia_nombre,
                    COUNT(DISTINCT cr.id) as total_criterios,
                    COUNT(DISTINCT et.id) as total_evaluaciones,
                    AVG(et.calificacion) as promedio_calificaciones
                FROM rubricas r
                JOIN tareas t ON r.tarea_id = t.id
                JOIN sesiones_clase s ON t.sesion_id = s.id
                JOIN bloques_tematicos b ON s.bloque_id = b.id
                JOIN materias m ON b.materia_id = m.id
                LEFT JOIN criterios_rubrica cr ON r.id = cr.rubrica_id
                LEFT JOIN entregas_tareas et ON t.id = et.tarea_id AND et.estado = 'calificada'
                WHERE m.profesor_id = ?
                GROUP BY r.id
                ORDER BY r.created_at DESC
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$professorId]);
            
            $rubrics = $stmt->fetchAll();
            
            return $this->jsonResponse(true, 'Rúbricas obtenidas exitosamente', 200, [
                'rubrics' => $rubrics,
                'total' => count($rubrics)
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error getting professor rubrics: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener las rúbricas', 500);
        }
    }
    
    // Obtener detalles completos de una rúbrica
    public function getRubricDetails($rubricId) {
        try {
            requireAuth();
            
            // Verificar propiedad
            if (!$this->verifyRubricOwnership($rubricId)) {
                return $this->jsonResponse(false, 'No tienes permiso para ver esta rúbrica', 403);
            }
            
            // Obtener información de la rúbrica
            $sql = "
                SELECT r.*, t.titulo as tarea_titulo
                FROM rubricas r
                JOIN tareas t ON r.tarea_id = t.id
                WHERE r.id = ?
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$rubricId]);
            $rubric = $stmt->fetch();
            
            if (!$rubric) {
                return $this->jsonResponse(false, 'Rúbrica no encontrada', 404);
            }
            
            // Obtener criterios con niveles de desempeño
            $sql = "
                SELECT 
                    cr.*,
                    nd.id as nivel_id,
                    nd.nivel,
                    nd.descripcion as nivel_descripcion,
                    nd.puntaje as nivel_puntaje,
                    nd.orden as nivel_orden,
                    nd.color_codigo
                FROM criterios_rubrica cr
                LEFT JOIN niveles_desempeno nd ON cr.id = nd.criterio_id
                WHERE cr.rubrica_id = ? AND cr.activo = 1
                ORDER BY cr.orden ASC, nd.orden ASC
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$rubricId]);
            $criteriaData = $stmt->fetchAll();
            
            // Organizar criterios con sus niveles
            $criteria = [];
            foreach ($criteriaData as $row) {
                $criterionId = $row['id'];
                
                if (!isset($criteria[$criterionId])) {
                    $criteria[$criterionId] = [
                        'id' => $row['id'],
                        'nombre' => $row['nombre'],
                        'descripcion' => $row['descripcion'],
                        'peso_porcentaje' => $row['peso_porcentaje'],
                        'orden' => $row['orden'],
                        'niveles' => []
                    ];
                }
                
                if ($row['nivel_id']) {
                    $criteria[$criterionId]['niveles'][] = [
                        'id' => $row['nivel_id'],
                        'nivel' => $row['nivel'],
                        'descripcion' => $row['nivel_descripcion'],
                        'puntaje' => $row['nivel_puntaje'],
                        'orden' => $row['nivel_orden'],
                        'color_codigo' => $row['color_codigo']
                    ];
                }
            }
            
            // Obtener recomendaciones para docentes
            $sql = "
                SELECT * FROM recomendaciones_docentes 
                WHERE rubrica_id = ? 
                ORDER BY orden ASC
            ";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$rubricId]);
            $recommendations = $stmt->fetchAll();
            
            $rubric['criterios'] = array_values($criteria);
            $rubric['recomendaciones'] = $recommendations;
            
            return $this->jsonResponse(true, 'Detalles de rúbrica obtenidos exitosamente', 200, [
                'rubric' => $rubric
            ]);
            
        } catch (Exception $e) {
            Utils::log('Error getting rubric details: ' . $e->getMessage(), 'ERROR');
            return $this->jsonResponse(false, 'Error al obtener los detalles de la rúbrica', 500);
        }
    }
    
    // MÉTODOS PRIVADOS DE APOYO
    
    private function verifySessionOwnership($sessionId) {
        $sql = "
            SELECT 1 FROM sesiones_clase s
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE s.id = ? AND m.profesor_id = ?
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$sessionId, $_SESSION['user_id']]);
        return $stmt->fetchColumn() !== false;
    }
    
    private function verifyTaskOwnership($taskId) {
        $sql = "
            SELECT 1 FROM tareas t
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE t.id = ? AND m.profesor_id = ?
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$taskId, $_SESSION['user_id']]);
        return $stmt->fetchColumn() !== false;
    }
    
    private function verifyRubricOwnership($rubricId) {
        $sql = "
            SELECT 1 FROM rubricas r
            JOIN tareas t ON r.tarea_id = t.id
            JOIN sesiones_clase s ON t.sesion_id = s.id
            JOIN bloques_tematicos b ON s.bloque_id = b.id
            JOIN materias m ON b.materia_id = m.id
            WHERE r.id = ? AND m.profesor_id = ?
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$rubricId, $_SESSION['user_id']]);
        return $stmt->fetchColumn() !== false;
    }
    
    private function createBasicRubric($taskId, $taskData) {
        // Crear rúbrica básica para Base de Datos
        $rubricData = [
            'tarea_id' => $taskId,
            'titulo' => 'Rúbrica: ' . $taskData['titulo'],
            'descripcion' => 'Rúbrica de evaluación para ' . $taskData['titulo'],
            'instrucciones_evaluacion' => 'Evalúe cada criterio según los niveles de desempeño indicados.',
            'puntaje_total' => 50.00
        ];
        
        $sql = "INSERT INTO rubricas (tarea_id, titulo, descripcion, instrucciones_evaluacion, puntaje_total) 
                VALUES (:tarea_id, :titulo, :descripcion, :instrucciones_evaluacion, :puntaje_total)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($rubricData);
        
        $rubricId = $this->pdo->lastInsertId();
        
        // Crear criterios básicos
        $this->createBasicCriteria($rubricId);
        
        return $rubricId;
    }
    
    private function createBasicCriteria($rubricId) {
        $criteria = [
            [
                'nombre' => 'Dominio del tema',
                'descripcion' => 'Conocimiento y comprensión del contenido técnico',
                'peso_porcentaje' => 25.00,
                'orden' => 1
            ],
            [
                'nombre' => 'Participación en equipo',
                'descripcion' => 'Nivel de contribución y colaboración de cada miembro',
                'peso_porcentaje' => 20.00,
                'orden' => 2
            ],
            [
                'nombre' => 'Argumentación y claridad',
                'descripcion' => 'Capacidad para explicar conceptos de forma clara y coherente',
                'peso_porcentaje' => 20.00,
                'orden' => 3
            ],
            [
                'nombre' => 'Trabajo colaborativo',
                'descripcion' => 'Evidencia de trabajo coordinado y distribución equitativa',
                'peso_porcentaje' => 20.00,
                'orden' => 4
            ],
            [
                'nombre' => 'Actitud/disposición',
                'descripcion' => 'Motivación, interés y profesionalismo durante la presentación',
                'peso_porcentaje' => 15.00,
                'orden' => 5
            ]
        ];
        
        foreach ($criteria as $criterion) {
            $criterion['rubrica_id'] = $rubricId;
            
            $sql = "INSERT INTO criterios_rubrica (rubrica_id, nombre, descripcion, peso_porcentaje, orden) 
                    VALUES (:rubrica_id, :nombre, :descripcion, :peso_porcentaje, :orden)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($criterion);
            
            $criterionId = $this->pdo->lastInsertId();
            
            // Crear niveles de desempeño para cada criterio
            $this->createPerformanceLevels($criterionId);
        }
    }
    
    private function createPerformanceLevels($criterionId) {
        $levels = [
            ['nivel' => 'Excelente', 'puntaje' => 10.00, 'orden' => 1, 'color_codigo' => '#28a745'],
            ['nivel' => 'Muy bueno', 'puntaje' => 9.00, 'orden' => 2, 'color_codigo' => '#17a2b8'],
            ['nivel' => 'Aceptable', 'puntaje' => 8.00, 'orden' => 3, 'color_codigo' => '#ffc107'],
            ['nivel' => 'Regular', 'puntaje' => 7.00, 'orden' => 4, 'color_codigo' => '#fd7e14'],
            ['nivel' => 'Reprobatorio', 'puntaje' => 6.00, 'orden' => 5, 'color_codigo' => '#dc3545']
        ];
        
        $descriptions = [
            'Dominio del tema' => [
                'Demuestra dominio completo del tema. Explica conceptos con precisión técnica.',
                'Muestra buen conocimiento del tema con pequeñas imprecisiones.',
                'Conocimiento básico con algunas confusiones menores.',
                'Conocimiento limitado, dificultades con conceptos básicos.',
                'Conocimiento insuficiente o información incorrecta.'
            ],
            'Participación en equipo' => [
                'Todos participan activamente y equilibradamente.',
                'Mayoría participa activamente con pequeñas diferencias.',
                'Participación desigual pero todos contribuyen.',
                'Participación muy desigual, algunos dominan.',
                'Participación inadecuada, trabajo individual.'
            ]
            // ... más descripciones específicas por criterio
        ];
        
        foreach ($levels as $index => $level) {
            $level['criterio_id'] = $criterionId;
            $level['descripcion'] = 'Descripción del nivel ' . $level['nivel'];
            
            $sql = "INSERT INTO niveles_desempeno (criterio_id, nivel, descripcion, puntaje, orden, color_codigo) 
                    VALUES (:criterio_id, :nivel, :descripcion, :puntaje, :orden, :color_codigo)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($level);
        }
    }
    
    private function getSubmissionDetails($submissionId) {
        $sql = "SELECT * FROM entregas_tareas WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$submissionId]);
        return $stmt->fetch();
    }
    
    private function getTaskRubric($taskId) {
        $sql = "SELECT * FROM rubricas WHERE tarea_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$taskId]);
        return $stmt->fetch();
    }
    
    private function getCriterionByName($rubricId, $criterionName) {
        // Mapear nombres de criterios del frontend a IDs
        $criterionMap = [
            'criterion1' => 'Dominio del tema',
            'criterion2' => 'Participación en equipo',
            'criterion3' => 'Argumentación y claridad',
            'criterion4' => 'Trabajo colaborativo',
            'criterion5' => 'Actitud/disposición'
        ];
        
        $criterionRealName = $criterionMap[$criterionName] ?? $criterionName;
        
        $sql = "SELECT * FROM criterios_rubrica WHERE rubrica_id = ? AND nombre = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$rubricId, $criterionRealName]);
        return $stmt->fetch();
    }
    
    private function getPerformanceLevel($criterionId, $levelValue) {
        $sql = "SELECT * FROM niveles_desempeno WHERE criterio_id = ? AND puntaje = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$criterionId, $levelValue]);
        return $stmt->fetch();
    }
    
    private function saveRubricEvaluation($submissionId, $criterionId, $levelId, $score, $comments) {
        $sql = "
            INSERT INTO evaluaciones_rubrica (entrega_id, criterio_id, nivel_id, puntaje_obtenido, comentarios, evaluado_por)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            nivel_id = VALUES(nivel_id),
            puntaje_obtenido = VALUES(puntaje_obtenido),
            comentarios = VALUES(comentarios),
            evaluado_por = VALUES(evaluado_por),
            fecha_evaluacion = NOW()
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$submissionId, $criterionId, $levelId, $score, $comments, $_SESSION['user_id']]);
    }
    
    private function logActivity($action, $details) {
        $sql = "INSERT INTO user_activity (usuario_id, action, details) VALUES (?, ?, ?)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$_SESSION['user_id'], $action, json_encode($details)]);
    }
    
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
    $taskManager = new TaskManager();
    
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $getData = $_GET ?? [];
    
    // Combinar datos
    $data = array_merge($getData, $input);
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'create_task':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido']);
                exit;
            }
            $taskManager->createTask($data);
            break;
            
        case 'get_tasks':
            $professorId = $data['professor_id'] ?? null;
            $taskManager->getProfessorTasks($professorId);
            break;
            
        case 'get_submissions':
            if (empty($data['task_id'])) {
                echo json_encode(['success' => false, 'message' => 'Task ID requerido']);
                exit;
            }
            $taskManager->getTaskSubmissions($data['task_id']);
            break;
            
        case 'grade_submission':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Método no permitido']);
                exit;
            }
            
            if (empty($data['submission_id']) || empty($data['evaluation'])) {
                echo json_encode(['success' => false, 'message' => 'Datos de evaluación requeridos']);
                exit;
            }
            
            $taskManager->gradeSubmissionByRubric($data['submission_id'], $data['evaluation']);
            break;
            
        case 'get_stats':
            $professorId = $data['professor_id'] ?? null;
            $taskManager->getProfessorStats($professorId);
            break;
            
        case 'get_rubrics':
            $professorId = $data['professor_id'] ?? null;
            $taskManager->getProfessorRubrics($professorId);
            break;
            
        case 'get_rubric_details':
            if (empty($data['rubric_id'])) {
                echo json_encode(['success' => false, 'message' => 'Rubric ID requerido']);
                exit;
            }
            $taskManager->getRubricDetails($data['rubric_id']);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Acción no válida',
                'available_actions' => [
                    'create_task' => 'Crear nueva tarea',
                    'get_tasks' => 'Obtener tareas del profesor',
                    'get_submissions' => 'Obtener entregas de una tarea',
                    'grade_submission' => 'Calificar entrega por rúbrica',
                    'get_stats' => 'Obtener estadísticas del profesor',
                    'get_rubrics' => 'Obtener rúbricas del profesor',
                    'get_rubric_details' => 'Obtener detalles de una rúbrica'
                ]
            ]);
            break;
    }
    
} catch (Exception $e) {
    Utils::log('Tasks API Error: ' . $e->getMessage(), 'ERROR');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno del servidor',
        'timestamp' => date('c')
    ]);
}
?>