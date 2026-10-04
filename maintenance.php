<?php
/**
 * ==============================================================================
 * AirSense - Maintenance Logs & Servicing Records
 * ==============================================================================
 * Allows authorized maintenance personnel to record filter wash & servicing actions.
 */
require_once __DIR__ . '/config/database.php';
$firebaseConfig = require __DIR__ . '/config/firebase.php';

$pageTitle = "AirSense | AC Preventive Maintenance Logs";
$selectedSensor = $_GET['sensor_id'] ?? $firebaseConfig['defaultSensor'];
$activeUnits = $firebaseConfig['activeUnits'];

$currentUser = getCurrentUser();
$successMessage = '';
$errorMessage = '';

// Maintenance logs will be loaded from Firebase via JavaScript
$logs = [];


require_once __DIR__ . '/includes/header.php';
?>

<main class="maintenance-page">

  <!-- Header Banner -->
  <section class="page-header-banner">
    <div class="banner-title-group">
      <div class="unit-tag">PREVENTIVE MAINTENANCE & SERVICING</div>
      <h1 class="page-title">AC Maintenance & Filter Cleaning Logs</h1>
      <p class="page-desc">
        Record servicing activities, mesh washing, and coil sanitization to track the lifecycle and maintenance accountability of monitored AC units.
      </p>
    </div>
  </section>

  <!-- Notification Messages -->
  <?php if (!empty($successMessage)): ?>
    <div class="alert-box success">
      <span class="icon">✅</span>
      <span><?php echo htmlspecialchars($successMessage); ?></span>
    </div>
  <?php endif; ?>

  <?php if (!empty($errorMessage)): ?>
    <div class="alert-box critical">
      <span class="icon">⚠️</span>
      <span><?php echo htmlspecialchars($errorMessage); ?></span>
    </div>
  <?php endif; ?>

  <div class="maintenance-layout">
    
    <!-- Left Column: Log Maintenance Action Form -->
    <div class="form-column">
      <div class="card form-card">
        <div class="card-header-simple">
          <h3 class="card-title">Log Servicing Action</h3>
          <p class="card-desc">Record a filter wash or AC servicing event</p>
        </div>

        <form method="POST" action="maintenance.php" class="maintenance-form">
          <input type="hidden" name="action" value="add_log">

          <div class="form-group">
            <label for="sensor_id" class="form-label">Target AC Unit / Sensor</label>
            <select id="sensor_id" name="sensor_id" class="form-input">
              <?php foreach ($activeUnits as $id => $unit): ?>
                <option value="<?php echo htmlspecialchars($id); ?>" <?php echo ($selectedSensor === $id) ? 'selected' : ''; ?>>
                  <?php echo htmlspecialchars($unit['name']); ?> (<?php echo htmlspecialchars($unit['location']); ?>)
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label for="service_date" class="form-label">Date Serviced</label>
              <input type="date" id="service_date" name="service_date" class="form-input" value="<?php echo date('Y-m-d'); ?>" required>
            </div>

            <div class="form-group col-half">
              <label for="dust_level_before" class="form-label">Dust Level Before Clean (%)</label>
              <input type="number" step="0.1" min="0" max="100" id="dust_level_before" name="dust_level_before" class="form-input" placeholder="e.g. 84.5" required>
            </div>
          </div>

          <div class="form-group">
            <label for="action_taken" class="form-label">Action Performed</label>
            <select id="action_taken" name="action_taken" class="form-input">
              <option value="Filter Cleaning & Mesh Wash">Filter Cleaning & Mesh Wash</option>
              <option value="Evaporator Coil Chemical Wash">Evaporator Coil Chemical Wash</option>
              <option value="Blower Wheel & Drain Pan Flush">Blower Wheel & Drain Pan Flush</option>
              <option value="Complete Preventive Maintenance (PM)">Complete Preventive Maintenance (PM)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="notes" class="form-label">Technician Notes & Observations</label>
            <textarea id="notes" name="notes" rows="3" class="form-input" placeholder="e.g., Heavy lint buildup removed from upper mesh filter. Airflow restored to nominal." required></textarea>
          </div>

          <div class="form-group">
            <label for="technician_name" class="form-label">Technician / Personnel Name</label>
            <input type="text" id="technician_name" name="technician_name" class="form-input" value="Lead HVAC Technician" required>
          </div>

          <button type="submit" class="btn-primary-action">
            <span>Save Maintenance Record</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </form>

      </div>
    </div>

    <!-- Right Column: Historical Maintenance Records Table -->
    <div class="table-column">
      <div class="card table-card">
        <div class="card-header-simple">
          <h3 class="card-title">Maintenance History & Servicing Archive</h3>
          <p class="card-desc">All historical servicing logs stored securely in MySQL</p>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>AC Unit</th>
                <th>Action Taken</th>
                <th>Dust Before</th>
                <th>Technician</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <?php if (empty($logs)): ?>
                <tr>
                  <td colspan="6" class="text-center empty-state">No maintenance records logged yet.</td>
                </tr>
              <?php else: ?>
                <?php foreach ($logs as $log): ?>
                  <tr>
                    <td class="font-medium"><?php echo date('M d, Y', strtotime($log['service_date'])); ?></td>
                    <td><?php echo htmlspecialchars($log['ac_unit']); ?></td>
                    <td><span class="badge-action"><?php echo htmlspecialchars($log['action_taken']); ?></span></td>
                    <td>
                      <span class="dust-pill <?php echo ($log['dust_level_before'] >= 80) ? 'high' : (($log['dust_level_before'] >= 40) ? 'moderate' : 'low'); ?>">
                        <?php echo htmlspecialchars($log['dust_level_before']); ?>%
                      </span>
                    </td>
                    <td><?php echo htmlspecialchars($log['performed_by']); ?></td>
                    <td class="cell-notes" title="<?php echo htmlspecialchars($log['notes']); ?>">
                      <?php echo htmlspecialchars($log['notes']); ?>
                    </td>
                  </tr>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

</main>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
