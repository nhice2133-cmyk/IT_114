<?php
/**
 * ==============================================================================
 * AirSense - API: Record High Dust Alert (Prevent Duplicate Spam)
 * ==============================================================================
 * Called via POST JSON when dust accumulation percentage >= 80%.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit;
}

$sensorId   = trim($input['sensor_id'] ?? 'sensor1');
$acUnit     = trim($input['ac_unit'] ?? 'AC Unit 101');
$dustPct    = floatval($input['dust_percentage'] ?? 0);
$pm25       = floatval($input['pm25_value'] ?? 0);

if ($dustPct < 80.0) {
    echo json_encode(['success' => false, 'message' => 'Dust percentage below threshold (<80%). No alert created.']);
    exit;
}

try {
    $pdo = getDBConnection();

    if (!$pdo) {
        echo json_encode(['success' => false, 'error' => 'MySQL offline. Alert data is still available via Firebase.']);
        exit;
    }

    // Check if an unacknowledged/active alert was recorded in the last 15 minutes for this sensor to prevent duplicates
    $checkStmt = $pdo->prepare("
        SELECT id, triggered_at FROM alert_notifications 
        WHERE sensor_id = :sensor_id 
          AND is_acknowledged = 0 
          AND triggered_at >= (NOW() - INTERVAL 15 MINUTE)
        ORDER BY id DESC LIMIT 1
    ");
    $checkStmt->execute([':sensor_id' => $sensorId]);
    $existing = $checkStmt->fetch();

    if ($existing) {
        echo json_encode([
            'success' => true,
            'duplicate' => true,
            'message' => 'Active alert already exists for this sensor within the 15-minute window.',
            'alert_id' => $existing['id']
        ]);
        exit;
    }

    // Insert new critical alert
    $insertStmt = $pdo->prepare("
        INSERT INTO alert_notifications 
        (sensor_id, ac_unit, dust_percentage, pm25_value, classification, alert_status, triggered_at, is_acknowledged)
        VALUES 
        (:sensor_id, :ac_unit, :dust_percentage, :pm25_value, 'HIGH', 'ACTIVE', NOW(), 0)
    ");

    $insertStmt->execute([
        ':sensor_id'        => $sensorId,
        ':ac_unit'          => $acUnit,
        ':dust_percentage'  => $dustPct,
        ':pm25_value'       => $pm25
    ]);

    $newId = $pdo->lastInsertId();

    echo json_encode([
        'success'   => true,
        'duplicate' => false,
        'alert_id'  => $newId,
        'message'   => 'High Dust Accumulation alert recorded successfully.'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
