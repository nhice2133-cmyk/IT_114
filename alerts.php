<?php
/**
 * ==============================================================================
 * AirSense - Office Alerts & Maintenance Warnings Log
 * ==============================================================================
 * Real-time alert notifications derived directly from Firebase telemetry 
 * for Room 1, Room 2, Room 3, and Room 4. Follows the persistent high condition
 * criteria (maintenance_alert == true) to prevent false alerts from temporary spikes.
 */
require_once __DIR__ . '/config/database.php';
$firebaseConfig = require __DIR__ . '/config/firebase.php';

$pageTitle = "AirSense | Office Maintenance Alerts";
$activeUnits = $firebaseConfig['activeUnits'];

require_once __DIR__ . '/includes/header.php';
?>

<main class="alerts-page">

  <!-- Header Banner -->
  <section class="page-header-banner">
    <div class="banner-title-group">
      <div class="unit-tag">OFFICE ALERTS · DECISION SUPPORT SYSTEM</div>
      <h1 class="page-title">Air Conditioning Maintenance Alerts</h1>
      <p class="page-desc">
        Maintenance recommendations generated when a monitored room records <strong>persistent high dust conditions</strong> (24 hours at ≥ 80% reference range), avoiding unnecessary cleaning caused by temporary particulate spikes.
      </p>
    </div>
  </section>

  <!-- Active Alerts Feed Section -->
  <section class="alerts-feed-section">
    <div class="card-bar-header" style="margin-bottom: 16px;">
      <h3 class="card-bar-title">Active Maintenance Recommendations</h3>
      <span id="alertsCountBadge" class="connection-indicator-pill online">● 0 ACTIVE RECOMMENDATIONS</span>
    </div>

    <!-- Active Alerts Container (Populated dynamically from Firebase) -->
    <div id="activeAlertsContainer" class="active-alerts-list">
      <!-- Loading State -->
      <div id="alertsLoading" class="alert-loading-box">
        <div class="conn-dot" style="animation: pulse-dot 1.5s infinite;"></div>
        <span>Connecting to Firebase real-time stream...</span>
      </div>

      <!-- No Alerts State (Default clean state) -->
      <div id="noAlertsBox" class="no-alerts-state-box hidden">
        <div class="no-alerts-icon">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h3 class="no-alerts-title">✓ No active maintenance alerts</h3>
        <p class="no-alerts-desc">No persistent high dust conditions detected. All monitored rooms are in normal operating condition.</p>
      </div>

      <!-- Live Alert Cards Target -->
      <div id="alertCardsGrid" class="alert-cards-grid"></div>
    </div>
  </section>

  <!-- 4-Room Telemetry & Persistent Monitoring Table -->
  <section class="apm-card" style="margin-top: 24px;">
    <div class="card-bar-header">
      <h3 class="card-bar-title">Room-by-Room Persistent Monitoring Status</h3>
      <span class="tag-live">REAL-TIME</span>
    </div>
    <div class="table-responsive" style="padding: 0 16px 16px 16px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Office Room</th>
            <th>Sensor ID</th>
            <th>Connection</th>
            <th>Dust Condition</th>
            <th>High Hours</th>
            <th>Maintenance Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="alertsTableBody">
          <?php foreach ($activeUnits as $sensorId => $unit): ?>
            <tr id="alertRow_<?php echo htmlspecialchars($sensorId); ?>">
              <td><strong><?php echo htmlspecialchars($unit['name']); ?></strong> <span class="text-muted">(<?php echo htmlspecialchars($unit['label']); ?>)</span></td>
              <td><code><?php echo htmlspecialchars($sensorId); ?></code></td>
              <td><span id="connBadge_<?php echo htmlspecialchars($sensorId); ?>" class="connection-indicator-pill waiting"><span class="conn-dot"></span> Waiting</span></td>
              <td id="tblDust_<?php echo htmlspecialchars($sensorId); ?>">--</td>
              <td id="tblHours_<?php echo htmlspecialchars($sensorId); ?>">0 / 24 hrs</td>
              <td id="tblAlert_<?php echo htmlspecialchars($sensorId); ?>"><span class="val-ok">🟢 No inspection required</span></td>
              <td>
                <a href="room.php?sensor_id=<?php echo urlencode($sensorId); ?>" class="btn-table-action">View Telemetry</a>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>

</main>

<script>
  window.ROOMS_CONFIG = <?php echo json_encode($activeUnits); ?>;
</script>

<script type="module" src="assets/js/alerts.js"></script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
