<?php
/**
 * ==============================================================================
 * AirSense - Historical Analytics & Telemetry Trends
 * ==============================================================================
 * Analyzes long-term dust condition trends and PM2.5 particulate patterns 
 * to support preventive maintenance decision-making across office rooms.
 */
require_once __DIR__ . '/config/database.php';
$firebaseConfig = require __DIR__ . '/config/firebase.php';

$selectedSensor = $_GET['sensor_id'] ?? $firebaseConfig['defaultSensor'];
$activeUnits = $firebaseConfig['activeUnits'];

if (!isset($activeUnits[$selectedSensor])) {
    $selectedSensor = $firebaseConfig['defaultSensor'];
}

$activeUnit = $activeUnits[$selectedSensor];
$pageTitle = "AirSense | " . $activeUnit['name'] . " Historical Trends & Analytics";

require_once __DIR__ . '/includes/header.php';
?>

<main class="analytics-page">

  <!-- Analytics Header Banner -->
  <section class="page-header-banner">
    <div class="banner-title-group">
      <div class="unit-tag">HISTORICAL TELEMETRY & DECISION SUPPORT</div>
      <h1 class="page-title">Dust Condition & PM2.5 Trends: <?php echo htmlspecialchars($activeUnit['name']); ?></h1>
      <p class="page-desc">
        Visualizing long-term particulate patterns at the AC intake grill for <strong><?php echo htmlspecialchars($activeUnit['name']); ?> (<?php echo htmlspecialchars($activeUnit['label']); ?>)</strong> to distinguish temporary sensor spikes from persistent conditions.
      </p>
    </div>
  </section>

  <!-- Key Performance Indicators (KPIs) -->
  <section class="kpi-grid">
    
    <div class="kpi-card">
      <div class="kpi-icon-wrap bg-blue">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Average Dust Condition</span>
        <span id="statAvgDust" class="kpi-value">--%</span>
        <span class="kpi-sub">Across recorded operational cycles</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap bg-purple">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Peak Dust Condition</span>
        <span id="statMaxDust" class="kpi-value">--%</span>
        <span class="kpi-sub">Maximum recorded level</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap bg-red">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path></svg>
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Persistent High Hours</span>
        <span id="statAlertCount" class="kpi-value">--</span>
        <span class="kpi-sub">Hours recorded at ≥ 80%</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap bg-emerald">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      </div>
      <div class="kpi-info">
        <span class="kpi-label">Condition Trend</span>
        <span id="statAccumRate" class="kpi-value">--</span>
        <span class="kpi-sub">Trend trajectory assessment</span>
      </div>
    </div>

  </section>

  <!-- Analytics Charts Grid -->
  <section class="charts-grid">
    
    <!-- Chart 1: Dust Condition Percentage Trend -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">Sensor-Based Dust Condition (%) vs Time</h3>
          <p class="chart-subtitle">Long-term condition comparison relative to 40% (Moderate) and 80% (Reference) thresholds</p>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="dustTrendChart"></canvas>
      </div>
    </div>

    <!-- Chart 2: PM2.5, PM1.0, PM10 Particulate Spectrum -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">PM2.5 (Reference Driver) & Particulate Spectrum</h3>
          <p class="chart-subtitle">Chronological concentration breakdown of PM1.0, PM2.5, and PM10 at AC air intake</p>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="pmTrendChart"></canvas>
      </div>
    </div>

  </section>

</main>

<script>
  window.ACTIVE_SENSOR_ID = "<?php echo htmlspecialchars($selectedSensor); ?>";
</script>
<script type="module" src="assets/js/analytics.js"></script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
