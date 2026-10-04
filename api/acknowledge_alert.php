<?php
/**
 * ==============================================================================
 * AirSense - API: Acknowledge Alert
 * ==============================================================================
 * Allows authorized maintenance personnel to mark an alert as acknowledged.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$alertId = intval($input['alert_id'] ?? 0);
$sensorId = trim($input['sensor_id'] ?? '');

$user = getCurrentUser();
$acknowledgedBy = $user ? $user['full_name'] . " (" . ucfirst($user['role']) . ")" : "Authorized Maintenance Personnel";

if (isset($input['acknowledged_by']) && !empty(trim($input['acknowledged_by']))) {
    $acknowledgedBy = trim($input['acknowledged_by']);
}

try {
    $pdo = getDBConnection();

    if (!$pdo) {
        echo json_encode(['success' => false, 'error' => 'MySQL offline. Cannot acknowledge alerts without database.']);
        exit;
    }

    if ($alertId > 0) {
        $stmt = $pdo->prepare("
            UPDATE alert_notifications 
            SET is_acknowledged = 1, 
                alert_status = 'ACKNOWLEDGED', 
                acknowledged_by = :acknowledged_by, 
                acknowledged_at = NOW() 
            WHERE id = :alert_id
        ");
        $stmt->execute([
            ':acknowledged_by' => $acknowledgedBy,
            ':alert_id'        => $alertId
        ]);
    } else if (!empty($sensorId)) {
        // Acknowledge all active alerts for this sensor
        $stmt = $pdo->prepare("
            UPDATE alert_notifications 
            SET is_acknowledged = 1, 
                alert_status = 'ACKNOWLEDGED', 
                acknowledged_by = :acknowledged_by, 
                acknowledged_at = NOW() 
            WHERE sensor_id = :sensor_id AND is_acknowledged = 0
        ");
        $stmt->execute([
            ':acknowledged_by' => $acknowledgedBy,
            ':sensor_id'       => $sensorId
        ]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing alert_id or sensor_id parameter']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Alert successfully acknowledged.',
        'acknowledged_by' => $acknowledgedBy,
        'acknowledged_at' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
