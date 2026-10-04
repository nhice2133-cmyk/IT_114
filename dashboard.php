<?php
/**
 * ==============================================================================
 * AirSense - IoT-Based Air Conditioning Dust Accumulation Monitoring System
 * ==============================================================================
 * Multi-room monitoring dashboard providing real-time dust condition indicators,
 * persistent high-condition tracking (high_condition_hours / 24), and preventive
 * maintenance decision support across 4 office rooms.
 */
require_once __DIR__ . '/config/database.php';
$firebaseConfig = require __DIR__ . '/config/firebase.php';

$pageTitle = "AirSense | Office AC Dust Accumulation Monitoring System";
$activeUnits = $firebaseConfig['activeUnits'];

require_once __DIR__ . '/includes/header.php';
?>

<!-- Office-Wide Critical Warning Banner (Triggered ONLY when maintenance_alert == true from Firebase) -->
<div id="officeAlertBanner" class="apm-alert-strip hidden" role="alert">
  <div class="alert-strip-content">
    <span class="alert-icon">🔴</span>
    <span class="alert-bold">MAINTENANCE INSPECTION RECOMMENDED:</span>
    <span id="officeAlertMsg" class="alert-msg">Persistent high dust condition detected. Inspect the AC filter and evaluate whether cleaning is necessary.</span>
  </div>
  <a href="alerts.php" class="btn-strip-ack">View Alert Details</a>
</div>

<!-- ========================================================================= -->
<!-- 1. DASHBOARD HERO & CAPSTONE PURPOSE BANNER                                -->
<!-- ========================================================================= -->
<section class="dashboard-hero-banner">
  <div class="hero-left">
    <div class="hero-tag">AIRSENSE · DECISION SUPPORT SYSTEM</div>
    <h1 class="hero-title">IoT-Based Air Conditioning Dust Accumulation Monitoring System</h1>
    <p class="hero-subtitle">
      The system monitors particulate conditions at the AC air intake and analyzes current and historical sensor data to support maintenance decisions.
    </p>
    <div class="disclaimer-note">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      <span>This value represents the current sensor-based dust condition and does not directly represent the physical percentage of dust accumulated on the AC filter.</span>
    </div>
  </div>
  <div class="hero-right">
    <div class="hero-timestamp-card">
      <span class="ts-label">Current System Time</span>
      <span id="officeClock" class="ts-val">--:--:--</span>
      <span class="ts-sub">Philippine Standard Time</span>
    </div>
  </div>
</section>

<!-- ========================================================================= -->
<!-- 2. OFFICE-WIDE STATUS SUMMARY BAR                                         -->
<!-- ========================================================================= -->
<section class="office-status-bar">
  <div class="office-stat-item">
    <span class="stat-num" id="statTotalRooms">4</span>
    <span class="stat-lbl">MONITORED ROOMS</span>
  </div>
  <div class="stat-divider"></div>
  <div class="office-stat-item">
    <span class="stat-num text-green" id="statOnlineRooms">0</span>
    <span class="stat-lbl">SENSORS ONLINE</span>
  </div>
  <div class="stat-divider"></div>
  <div class="office-stat-item">
    <span class="stat-num text-amber" id="statWaitingRooms">4</span>
    <span class="stat-lbl">WAITING FOR SENSOR</span>
  </div>
  <div class="stat-divider"></div>
  <div class="office-stat-item">
    <span class="stat-num text-red" id="statAttentionRooms">0</span>
    <span class="stat-lbl">MAINTENANCE RECOMMENDED</span>
  </div>
</section>

<!-- ========================================================================= -->
<!-- 3. FOUR ROOM OVERVIEW CARDS (2x2 Grid)                                    -->
<!-- ========================================================================= -->
<section class="rooms-grid-section">
  <div class="section-title-wrap">
    <div>
      <h2 class="section-heading">Office Rooms · Current Dust Conditions</h2>
      <span class="section-subtext">Real-time telemetry and persistent high condition monitoring from ESP32 + PMS5003</span>
    </div>
  </div>

  <div class="rooms-grid">
    <?php foreach ($activeUnits as $sensorId => $unit): ?>
      <!-- Room Card Component: <?php echo htmlspecialchars($unit['name']); ?> (<?php echo htmlspecialchars($sensorId); ?>) -->
      <div id="roomCard_<?php echo htmlspecialchars($sensorId); ?>" class="room-card card-waiting" data-sensor="<?php echo htmlspecialchars($sensorId); ?>">
        
        <!-- Room Card Header -->
        <div class="room-card-header">
          <div class="room-header-left">
            <h3 class="room-name"><?php echo htmlspecialchars($unit['name']); ?></h3>
            <span class="room-subtag"><?php echo htmlspecialchars($unit['label']); ?> · <code class="code-sensor"><?php echo htmlspecialchars($sensorId); ?></code></span>
          </div>
          <div class="room-header-right">
            <span id="badge_<?php echo htmlspecialchars($sensorId); ?>" class="connection-indicator-pill waiting">
              <span class="conn-dot"></span>
              <span id="badgeText_<?php echo htmlspecialchars($sensorId); ?>">Waiting for Sensor</span>
            </span>
          </div>
        </div>

        <!-- Room Card Body: Online State (Active Firebase Data) -->
        <div id="onlineBody_<?php echo htmlspecialchars($sensorId); ?>" class="room-card-body online-content hidden">
          
          <!-- Dust Condition Indicator Hero -->
          <div class="room-dust-hero">
            <div class="dust-hero-main">
              <span class="dust-hero-label">Dust Condition</span>
              <div class="dust-hero-value-row">
                <span id="dustVal_<?php echo htmlspecialchars($sensorId); ?>" class="dust-hero-val text-teal">--%</span>
                <span id="dustBadge_<?php echo htmlspecialchars($sensorId); ?>" class="dust-status-badge low">LOW</span>
              </div>
            </div>
            <div class="dust-hero-action">
              <span class="action-caption">Assessment:</span>
              <span id="actionMsg_<?php echo htmlspecialchars($sensorId); ?>" class="action-text">Normal monitoring</span>
            </div>
          </div>

          <!-- Dust Condition Level Scale (0 - 100%) -->
          <div class="room-progress-wrap">
            <div class="progress-bar-bg">
              <div id="progressBar_<?php echo htmlspecialchars($sensorId); ?>" class="progress-bar-fill fill-low" style="width: 0%;"></div>
            </div>
            <div class="progress-ticks">
              <span>0% LOW</span>
              <span class="tick-mod">40% MODERATE</span>
              <span class="tick-crit">80% HIGH</span>
              <span>100%</span>
            </div>
          </div>

          <!-- Persistent High Condition Hours Progress Indicator (high_condition_hours / 24) -->
          <div class="high-condition-tracker-box">
            <div class="tracker-header">
              <span class="tracker-title">Persistent High Condition</span>
              <span id="hoursText_<?php echo htmlspecialchars($sensorId); ?>" class="tracker-hours-val">0 / 24 hours</span>
            </div>
            <div class="tracker-bar-bg">
              <div id="hoursBar_<?php echo htmlspecialchars($sensorId); ?>" class="tracker-bar-fill" style="width: 0%;"></div>
            </div>
            <span id="hoursStatusMsg_<?php echo htmlspecialchars($sensorId); ?>" class="tracker-subtext">No persistent high condition detected.</span>
          </div>

          <!-- Particulate Matter 3-Column Metrics -->
          <div class="pm-metrics-row">
            <div class="pm-col">
              <span class="pm-col-lbl">PM1.0 (Ultra-Fine)</span>
              <span id="pm1Val_<?php echo htmlspecialchars($sensorId); ?>" class="pm-col-val">--</span>
              <span class="pm-col-unit">µg/m³</span>
            </div>
            <div class="pm-col highlight">
              <span class="pm-col-lbl">PM2.5 (Reference)</span>
              <span id="pm25Val_<?php echo htmlspecialchars($sensorId); ?>" class="pm-col-val">--</span>
              <span class="pm-col-unit">µg/m³</span>
            </div>
            <div class="pm-col">
              <span class="pm-col-lbl">PM10 (Coarse Dust)</span>
              <span id="pm10Val_<?php echo htmlspecialchars($sensorId); ?>" class="pm-col-val">--</span>
              <span class="pm-col-unit">µg/m³</span>
            </div>
          </div>

          <!-- Maintenance Decision Support Section -->
          <div class="maintenance-decision-strip">
            <div class="m-decision-header">
              <span class="m-decision-lbl">Maintenance Decision Support:</span>
              <span id="mStatusBadge_<?php echo htmlspecialchars($sensorId); ?>" class="m-status-pill ok">
                🟢 NO MAINTENANCE ALERT
              </span>
            </div>
            <p id="mStatusMsg_<?php echo htmlspecialchars($sensorId); ?>" class="m-decision-msg">
              Normal monitoring. No maintenance inspection is currently recommended.
            </p>
          </div>

          <!-- Last Updated Timestamp -->
          <div class="room-card-meta">
            <div class="meta-row">
              <span class="meta-lbl">Last Updated:</span>
              <span id="lastUpdated_<?php echo htmlspecialchars($sensorId); ?>" class="meta-val font-mono">--</span>
            </div>
          </div>

        </div>

        <!-- Room Card Body: Waiting State (When Sensor is not yet deployed / no data) -->
        <div id="waitingBody_<?php echo htmlspecialchars($sensorId); ?>" class="room-card-body waiting-content">
          <div class="waiting-placeholder">
            <div class="waiting-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h4 class="waiting-title">Sensor not connected</h4>
            <p class="waiting-desc">Waiting for ESP32 PMS5003 telemetry to be transmitted...</p>
            <span class="waiting-subtext">Configured path: <code>/sensors/<?php echo htmlspecialchars($sensorId); ?>/</code></span>
          </div>
        </div>

        <!-- Room Card Footer Actions -->
        <div class="room-card-footer">
          <a href="room.php?sensor_id=<?php echo urlencode($sensorId); ?>" class="btn-room-details">
            <span>View Details & History</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </a>
        </div>

      </div>
    <?php endforeach; ?>
  </div>
</section>

<!-- ========================================================================= -->
<!-- 4. OFFICE ROOMS TELEMETRY MATRIX & CAPSTONE RESEARCH STANDARDS            -->
<!-- ========================================================================= -->
<section class="apm-grid-row bottom-row" style="margin-top: 24px;">
  
  <!-- Left Panel: Multi-Room Status Matrix -->
  <div class="apm-card" style="flex: 2;">
    <div class="card-bar-header">
      <h3 class="card-bar-title">Office Rooms Telemetry Matrix</h3>
      <span class="tag-live">REAL-TIME</span>
    </div>
    <div class="table-responsive" style="padding: 0 16px 16px 16px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Sensor ID</th>
            <th>Connection</th>
            <th>PM2.5</th>
            <th>Dust Condition</th>
            <th>High Hours</th>
            <th>Maintenance Alert</th>
          </tr>
        </thead>
        <tbody id="matrixTableBody">
          <?php foreach ($activeUnits as $sId => $u): ?>
            <tr id="matrixRow_<?php echo htmlspecialchars($sId); ?>">
              <td><strong><?php echo htmlspecialchars($u['name']); ?></strong> <span class="text-muted">(<?php echo htmlspecialchars($u['label']); ?>)</span></td>
              <td><code><?php echo htmlspecialchars($sId); ?></code></td>
              <td><span id="matStatus_<?php echo htmlspecialchars($sId); ?>" class="connection-indicator-pill waiting"><span class="conn-dot"></span> Waiting</span></td>
              <td id="matPm25_<?php echo htmlspecialchars($sId); ?>">--</td>
              <td id="matDust_<?php echo htmlspecialchars($sId); ?>">--</td>
              <td id="matHours_<?php echo htmlspecialchars($sId); ?>">0 / 24 hrs</td>
              <td id="matMaint_<?php echo htmlspecialchars($sId); ?>"><span class="val-ok">🟢 NO</span></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Right Panel: Capstone Classification & Maintenance Criteria -->
  <div class="apm-card" style="flex: 1;">
    <div class="card-bar-header">
      <h3 class="card-bar-title">Research Classification Criteria</h3>
      <span class="tag-live">STANDARDS</span>
    </div>
    <div class="pm-guidelines-body" style="padding: 16px;">
      <div class="guide-item">
        <div class="guide-badge-wrap"><span class="dust-status-badge low">0% – 39.9% LOW</span></div>
        <div class="guide-text">
          <strong>Normal monitoring</strong>
          <p>Normal dust condition. No inspection recommended.</p>
        </div>
      </div>
      <div class="guide-item">
        <div class="guide-badge-wrap"><span class="dust-status-badge moderate">40% – 79.9% MOD</span></div>
        <div class="guide-text">
          <strong>Continue monitoring</strong>
          <p>Elevated dust condition. Continue monitoring.</p>
        </div>
      </div>
      <div class="guide-item">
        <div class="guide-badge-wrap"><span class="dust-status-badge high">80% – 100% HIGH</span></div>
        <div class="guide-text">
          <strong>High dust condition detected</strong>
          <p>Requires 24 consecutive hourly checks before a maintenance recommendation is generated.</p>
        </div>
      </div>
      <div class="guide-note" style="margin-top: 12px; padding: 10px; background: #f8fafc; border-left: 3px solid var(--apm-teal); font-size: 0.75rem; color: var(--text-muted);">
        <strong>Decision Support Rule:</strong> 80% does NOT equal immediate cleaning. Persistent HIGH condition for 24 hours is required before recommending maintenance.
      </div>
    </div>
  </div>

</section>

<!-- Inject Active Units Configuration for JS -->
<script>
  window.ROOMS_CONFIG = <?php echo json_encode($activeUnits); ?>;
</script>

<!-- Real-Time 4-Room Dashboard Engine -->
<script type="module" src="assets/js/dashboard.js"></script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
