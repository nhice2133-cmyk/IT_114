<?php
/**
 * ==============================================================================
 * AirSense - API: Save Live Sensor Telemetry to History
 * ==============================================================================
 * Periodically archives real-time sensor snapshots into MySQL for trends.
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
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$sensorId = trim($input['sensor_id'] ?? 'sensor1');
$pm1_0    = floatval($input['pm1_0'] ?? 0);
$pm2_5    = floatval($input['pm2_5'] ?? 0);
$pm10     = floatval($input['pm10'] ?? 0);
$dustPct  = floatval($input['dust_percentage'] ?? 0);
$class    = trim($input['classification'] ?? 'LOW');

try {
    $pdo = getDBConnection();

    if (!$pdo) {
        echo json_encode(['success' => false, 'error' => 'MySQL offline. Data is still stored in Firebase.']);
        exit;
    }

    // Prevent excessive logging: Only insert if last record was at least 60 seconds ago
    $checkStmt = $pdo->prepare("
        SELECT id FROM sensor_history 
        WHERE sensor_id = :sensor_id 
          AND recorded_at >= (NOW() - INTERVAL 60 SECOND)
        LIMIT 1
    ");
    $checkStmt->execute([':sensor_id' => $sensorId]);
    if ($checkStmt->fetch()) {
        echo json_encode(['success' => true, 'throttled' => true, 'message' => 'Rate limit throttled (1 min)']);
        exit;
    }

    $insert = $pdo->prepare("
        INSERT INTO sensor_history 
        (sensor_id, pm1_0, pm2_5, pm10, dust_percentage, classification, recorded_at)
        VALUES 
        (:sensor_id, :pm1_0, :pm2_5, :pm10, :dust_percentage, :classification, NOW())
    ");

    $insert->execute([
        ':sensor_id'        => $sensorId,
        ':pm1_0'            => $pm1_0,
        ':pm2_5'            => $pm2_5,
        ':pm10'             => $pm10,
        ':dust_percentage'  => $dustPct,
        ':classification'   => $class
    ]);

    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
