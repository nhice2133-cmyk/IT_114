<?php
/**
 * ==============================================================================
 * AirSense - Individual Room Detailed Monitoring & Historical Telemetry
 * ==============================================================================
 * Dedicated room analytics page displaying live PMS5003 readings, persistent 
 * high-condition tracking, historical dust trends (/history/{sensorId}/), and 
 * preventive maintenance decision support.
 */
require_once __DIR__ . '/config/database.php';
$firebaseConfig = require __DIR__ . '/config/firebase.php';

$selectedSensor = $_GET['sensor_id'] ?? $firebaseConfig['defaultSensor'];
$activeUnits = $firebaseConfig['activeUnits'];

if (!isset($activeUnits[$selectedSensor])) {
    $selectedSensor = $firebaseConfig['defaultSensor'];
}

$activeRoom = $activeUnits[$selectedSensor];
$pageTitle = "AirSense | " . $activeRoom['name'] . " (" . $activeRoom['label'] . ") Monitoring";

require_once __DIR__ . '/includes/header.php';
?>

<!-- Critical Room Alert Banner (Visible ONLY when maintenance_alert == true from Firebase) -->
<div id="roomAlertBanner" class="apm-alert-strip hidden" role="alert">
  <div class="alert-strip-content">
    <span class="alert-icon">🔴</span>
    <span class="alert-bold">MAINTENANCE INSPECTION RECOMMENDED:</span>
    <span id="roomAlertMsg" class="alert-msg">Persistent high dust condition detected in <?php echo htmlspecialchars($activeRoom['name']); ?>. Inspect the AC filter and evaluate whether cleaning is necessary.</span>
  </div>
  <a href="maintenance.php?sensor_id=<?php echo urlencode($selectedSensor); ?>" class="btn-strip-ack">Record Maintenance Action</a>
</div>

<!-- ========================================================================= -->
<!-- 1. ROOM HEADER & STATUS STRIP                                             -->
<!-- ========================================================================= -->
<section class="room-details-header-strip">
  <div class="header-strip-left">
    <a href="dashboard.php" class="btn-back-link">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>Back to Office Overview</span>
    </a>
    <div class="header-title-group">
      <h1 class="room-main-title"><?php echo htmlspecialchars($activeRoom['name']); ?> Telemetry</h1>
      <span class="room-main-sub"><?php echo htmlspecialchars($activeRoom['label']); ?> · Node: <code class="code-sensor"><?php echo htmlspecialchars($selectedSensor); ?></code> · <?php echo htmlspecialchars($activeRoom['hardware']); ?></span>
    </div>
  </div>

  <div class="header-strip-right">
    <div id="roomConnectionBadge" class="connection-indicator-pill waiting">
      <span class="conn-dot"></span>
      <span id="roomConnectionText">Waiting for Sensor</span>
    </div>
    <div class="timestamp-box">
      <span class="ts-label">Last Updated:</span>
      <strong id="roomLastUpdated" class="ts-val">Waiting for sensor data...</strong>
    </div>
  </div>
</section>

<!-- Capstone Disclaimer Note -->
<div class="disclaimer-note-panel">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
  <span>This value represents the current sensor-based dust condition and does not directly represent the physical percentage of dust accumulated on the AC filter.</span>
</div>

<!-- ========================================================================= -->
<!-- 2. CURRENT CONDITION: REAL-TIME TELEMETRY & PERSISTENCE METRICS           -->
<!-- ========================================================================= -->
<section class="apm-grid-row top-row" style="margin-top: 14px;">
  
  <!-- PM1.0 Card -->
  <div class="apm-card metric-box">
    <div class="card-bar-title">PM1.0 (Ultra-Fine)</div>
    <div class="metric-value-wrap">
      <span id="roomPm1Val" class="metric-big-num">--</span>
      <span class="metric-unit">µg/m³</span>
    </div>
    <div class="metric-sub-label">Particulates ≤ 1.0 µm</div>
  </div>

  <!-- PM2.5 Card -->
  <div class="apm-card metric-box featured">
    <div class="card-bar-title">PM2.5 (Reference Driver)</div>
    <div class="metric-value-wrap">
      <span id="roomPm25Val" class="metric-big-num text-teal">--</span>
      <span class="metric-unit">µg/m³</span>
    </div>
    <div class="metric-sub-label">Particulates ≤ 2.5 µm</div>
  </div>

  <!-- PM10 Card -->
  <div class="apm-card metric-box">
    <div class="card-bar-title">PM10 (Coarse Dust)</div>
    <div class="metric-value-wrap">
      <span id="roomPm10Val" class="metric-big-num">--</span>
      <span class="metric-unit">µg/m³</span>
    </div>
    <div class="metric-sub-label">Coarse Particulates ≤ 10 µm</div>
  </div>

  <!-- Dust Condition Indicator Hero Card -->
  <div class="apm-card metric-box featured">
    <div class="card-bar-title">Dust Condition Indicator</div>
    <div class="metric-value-wrap">
      <span id="roomDustVal" class="metric-big-num text-teal">--%</span>
    </div>
    <div class="metric-sub-classification">
      <span class="badge-status-wrap">
        <span id="roomDustBadge" class="dust-status-badge low">LOW</span>
      </span>
      <span id="roomActionMsg" class="status-action-text">Normal monitoring</span>
    </div>
  </div>

</section>

<!-- ========================================================================= -->
<!-- 3. MAINTENANCE DECISION SUPPORT PANEL & 24-HOUR TRACKER                   -->
<!-- ========================================================================= -->
<section class="apm-grid-row" style="margin-top: 14px; display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 14px;">
  
  <!-- Left: High Condition Hours Progress Tracker -->
  <div class="apm-card" style="padding: 16px;">
    <div class="card-bar-header" style="margin-bottom: 8px;">
      <h3 class="card-bar-title">Persistent High Condition</h3>
      <span id="roomHoursTag" class="badge-action">0 / 24 Hours</span>
    </div>
    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px;">
      The system requires persistent HIGH readings before generating a maintenance recommendation.
    </p>
    <div class="tracker-bar-bg" style="height: 10px; margin-bottom: 6px;">
      <div id="roomHoursBar" class="tracker-bar-fill" style="width: 0%;"></div>
    </div>
    <span id="roomHoursStatusText" style="font-size: 0.6875rem; color: var(--text-sub);">No persistent high condition detected.</span>
  </div>

  <!-- Right: Maintenance Decision Support Table -->
  <div class="apm-card" style="padding: 16px;">
    <div class="card-bar-header" style="margin-bottom: 10px;">
      <h3 class="card-bar-title">Maintenance Decision Support</h3>
      <span id="roomMDecisionBadge" class="m-status-pill ok">🟢 NO MAINTENANCE ALERT</span>
    </div>
    
    <div class="decision-support-grid">
      <div class="decision-item">
        <span class="d-lbl">Dust Condition:</span>
        <strong id="dDustVal" class="d-val">--%</strong>
      </div>
      <div class="decision-item">
        <span class="d-lbl">Status:</span>
        <strong id="dStatusVal" class="d-val">LOW</strong>
      </div>
      <div class="decision-item">
        <span class="d-lbl">Persistent High Condition:</span>
        <strong id="dHoursVal" class="d-val">0 / 24 hours</strong>
      </div>
      <div class="decision-item">
        <span class="d-lbl">Maintenance Alert:</span>
        <strong id="dAlertVal" class="d-val text-green">NO</strong>
      </div>
    </div>

    <div class="decision-recommendation-box" style="margin-top: 10px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid var(--apm-teal); border-radius: 3px;">
      <span style="font-size: 0.6875rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Recommendation:</span>
      <p id="roomRecommendationText" style="font-size: 0.8125rem; font-weight: 600; color: var(--text-title); margin-top: 2px;">
        Normal monitoring. No maintenance inspection is currently recommended.
      </p>
    </div>
  </div>

</section>

<!-- ========================================================================= -->
<!-- 4. HISTORICAL TREND: DUST CONDITION & PM2.5 CHARTS                        -->
<!-- ========================================================================= -->
<section class="apm-grid-row middle-row" style="margin-top: 16px;">
  
  <!-- Historical Chart Panel -->
  <div class="apm-card chart-card-lg" style="flex: 2;">
    <div class="card-bar-header">
      <div class="chart-header-title-group">
        <h3 class="card-bar-title"><?php echo htmlspecialchars($activeRoom['name']); ?> Historical Telemetry Trend</h3>
        <span class="card-subtitle">Chronological time series from <code>/history/<?php echo htmlspecialchars($selectedSensor); ?>/</code></span>
      </div>

      <!-- Metric Switcher Buttons -->
      <div class="chart-metric-switcher">
        <button id="btnMetricDust" class="btn-metric-toggle active" data-metric="dust">Dust Condition (%)</button>
        <button id="btnMetricPm25" class="btn-metric-toggle" data-metric="pm25">PM2.5 History</button>
        <button id="btnMetricPm1" class="btn-metric-toggle" data-metric="pm1">PM1.0 History</button>
        <button id="btnMetricPm10" class="btn-metric-toggle" data-metric="pm10">PM10 History</button>
        <button id="btnMetricAll" class="btn-metric-toggle" data-metric="all">All Particulates</button>
      </div>
    </div>

    <!-- Chart Canvas Container -->
    <div class="chart-box-large" style="position: relative; height: 320px; padding: 12px 16px;">
      <canvas id="roomHistoryChart"></canvas>
      
      <!-- No Data State (Clean message, no fake records) -->
      <div id="noHistoryOverlay" class="no-history-overlay hidden">
        <div class="no-history-content">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span class="no-history-title">No historical data available.</span>
          <span class="no-history-sub">Historical points will appear automatically once sensor records are received from Firebase.</span>
        </div>
      </div>
    </div>

  </div>

  <!-- Right Panel: Room Maintenance Record -->
  <div class="apm-card maintenance-status-panel" style="flex: 1;">
    <div class="card-bar-header">
      <h3 class="card-bar-title"><?php echo htmlspecialchars($activeRoom['name']); ?> Maintenance Profile</h3>
      <a href="maintenance.php?sensor_id=<?php echo urlencode($selectedSensor); ?>" class="card-link-btn">Record Service +</a>
    </div>

    <div class="maintenance-status-body">
      
      <div class="m-status-row">
        <span class="m-status-label">Assigned AC Unit:</span>
        <span class="m-status-value"><?php echo htmlspecialchars($activeRoom['label']); ?></span>
      </div>

      <div class="m-status-row">
        <span class="m-status-label">Current Dust Condition:</span>
        <span id="roomMCondition" class="m-status-value cond-low">--</span>
      </div>

      <div class="m-status-row">
        <span class="m-status-label">Maintenance Alert:</span>
        <span id="roomMAlert" class="m-status-value alert-ok">NO</span>
      </div>

      <div class="m-status-divider"></div>

      <div class="m-status-row">
        <span class="m-status-label">Last Cleaning Record:</span>
        <span id="roomLastCleaned" class="m-status-value text-muted">Cleaning date not recorded</span>
      </div>
      <div class="m-status-subtext" id="roomLastCleanedNotes">No maintenance record available</div>

      <div class="m-status-divider"></div>

      <div class="m-status-row">
        <span class="m-status-label">Next Scheduled PM:</span>
        <span id="roomNextSchedule" class="m-status-value text-muted">Schedule not set</span>
      </div>
      <div class="m-status-subtext">Routine preventive maintenance schedule</div>

    </div>
  </div>

</section>

<!-- Inject Room Details Configuration for JS -->
<script>
  window.ACTIVE_ROOM_SENSOR = "<?php echo htmlspecialchars($selectedSensor); ?>";
  window.ACTIVE_ROOM_NAME = "<?php echo htmlspecialchars($activeRoom['name']); ?>";
  window.ACTIVE_ROOM_LABEL = "<?php echo htmlspecialchars($activeRoom['label']); ?>";
</script>

<!-- Room Details JS Controller -->
<script type="module" src="assets/js/room.js"></script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
