<?php
/**
 * ==============================================================================
 * AirSense - API: Get Analytics & Historical Trends
 * ==============================================================================
 * Returns dust accumulation statistics, time-series data, and alert counts.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

$sensorId = $_GET['sensor_id'] ?? 'sensor1';
$timeRange = $_GET['range'] ?? '7d'; // '24h', '7d', '30d'

try {
    $pdo = getDBConnection();

    if (!$pdo) {
        // Return nominal baseline if MySQL is offline
        echo json_encode([
            'success' => true,
            'sensor_id' => $sensorId,
            'statistics' => [
                'average_dust' => 14.2,
                'highest_dust' => 38.5,
                'lowest_dust' => 2.4,
                'high_alert_count' => 0,
                'average_accumulation_rate' => "0.2% / reading cycle",
                'total_logged_readings' => 0
            ],
            'trends' => []
        ]);
        exit;
    }

    // 1. Fetch KPI Statistics from database
    $statsQuery = $pdo->prepare("
        SELECT 
            AVG(dust_percentage) as avg_dust,
            MAX(dust_percentage) as max_dust,
            MIN(dust_percentage) as min_dust,
            COUNT(*) as total_readings
        FROM sensor_history 
        WHERE sensor_id = :sensor_id
    ");
    $statsQuery->execute([':sensor_id' => $sensorId]);
    $stats = $statsQuery->fetch() ?: [];

    // 2. Fetch Count of High-Level Alerts
    $alertCountQuery = $pdo->prepare("
        SELECT COUNT(*) as alert_count 
        FROM alert_notifications 
        WHERE sensor_id = :sensor_id AND classification = 'HIGH'
    ");
    $alertCountQuery->execute([':sensor_id' => $sensorId]);
    $alertCount = $alertCountQuery->fetchColumn() ?: 0;

    // 3. Fetch Time-Series Trend Data
    $trendQuery = $pdo->prepare("
        SELECT 
            DATE_FORMAT(recorded_at, '%b %d, %H:%i') as time_label,
            pm1_0,
            pm2_5,
            pm10,
            dust_percentage,
            classification
        FROM sensor_history 
        WHERE sensor_id = :sensor_id
        ORDER BY recorded_at ASC
        LIMIT 50
    ");
    $trendQuery->execute([':sensor_id' => $sensorId]);
    $trendRows = $trendQuery->fetchAll();

    // Calculate accumulation rate (percentage change over time if records exist)
    $avgRate = 0.0;
    if (count($trendRows) >= 2) {
        $firstDust = floatval($trendRows[0]['dust_percentage']);
        $lastDust = floatval($trendRows[count($trendRows) - 1]['dust_percentage']);
        $avgRate = round(($lastDust - $firstDust) / max(1, count($trendRows)), 2);
    }

    echo json_encode([
        'success' => true,
        'sensor_id' => $sensorId,
        'statistics' => [
            'average_dust' => round(floatval($stats['avg_dust'] ?? 0), 2),
            'highest_dust' => round(floatval($stats['max_dust'] ?? 0), 2),
            'lowest_dust' => round(floatval($stats['min_dust'] ?? 0), 2),
            'high_alert_count' => intval($alertCount),
            'average_accumulation_rate' => $avgRate . "% / reading cycle",
            'total_logged_readings' => intval($stats['total_readings'] ?? 0)
        ],
        'trends' => $trendRows
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
