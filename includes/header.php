<?php
/**
 * ==============================================================================
 * AirSense - Global Header Component (APM High-Density Dashboard Theme)
 * ==============================================================================
 */
require_once __DIR__ . '/../config/database.php';
$firebaseConfig = require __DIR__ . '/../config/firebase.php';

$currentPage = basename($_SERVER['PHP_SELF']);
$selectedSensor = $_GET['sensor_id'] ?? $firebaseConfig['defaultSensor'];
$activeUnits = $firebaseConfig['activeUnits'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="AirSense - IoT-Based Air Conditioning Dust Accumulation Monitoring System with Real-Time Web Analytics">
  <title><?php echo $pageTitle ?? 'AirSense | AC Dust Accumulation Monitoring System'; ?></title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">

  <!-- Chart.js (CDN for Real-time Multi-Charts) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <!-- Custom Stylesheet -->
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <div class="apm-layout">
    
    <!-- Top Global Header -->
    <header class="apm-navbar">
      <div class="navbar-left">
        <a href="dashboard.php" class="brand-wrap">
          <span class="brand-logo-cube">AS</span>
          <div class="brand-text">
            <span class="brand-name">AirSense</span>
            <span class="brand-badge">IoT Telemetry & AC Dust Monitor</span>
          </div>
        </a>
      </div>

      <!-- Navigation Tabs -->
      <nav class="apm-nav-tabs">
        <a href="dashboard.php" class="nav-tab <?php echo ($currentPage === 'dashboard.php' || $currentPage === 'index.php') ? 'active' : ''; ?>">
          Dashboard Overview
        </a>
        <a href="analytics.php" class="nav-tab <?php echo ($currentPage === 'analytics.php') ? 'active' : ''; ?>">
          Historical Trends
        </a>
        <a href="maintenance.php" class="nav-tab <?php echo ($currentPage === 'maintenance.php') ? 'active' : ''; ?>">
          Maintenance Logs
        </a>
        <a href="alerts.php" class="nav-tab <?php echo ($currentPage === 'alerts.php') ? 'active' : ''; ?>">
          Alert Records
        </a>
      </nav>

      <!-- Right Header Status Controls -->
      <div class="navbar-right">
        <div class="sensor-switch">
          <label for="sensorSelect" class="switch-label">Unit:</label>
          <select id="sensorSelect" class="switch-dropdown" onchange="window.location.href='<?php echo $currentPage; ?>?sensor_id='+this.value">
            <?php foreach ($activeUnits as $id => $unit): ?>
              <option value="<?php echo htmlspecialchars($id); ?>" <?php echo ($selectedSensor === $id) ? 'selected' : ''; ?>>
                <?php echo htmlspecialchars($unit['name']); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="live-status-pill">
          <span id="headerStatusDot" class="status-indicator-dot dot-online"></span>
          <span id="headerStatusText" class="status-indicator-text">LIVE</span>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <div class="apm-main-container">
