/**
 * ============================================================================
 * AirSense - AC3DVisualization (reusable room-card component)
 * ============================================================================
 * RoomCard -> AC3DVisualization
 * Lightweight CSS/SVG wall-mounted split-type AC + AirSense intake sensor.
 * Auto-injects a centered full-width stage into every
 * `.room-card[data-sensor]` right below `.room-card-header`
 * (same centered position in all cards).
 *
 * States (set from live Firebase data in dashboard.js):
 *   waiting  - no telemetry yet: AC visible, sensor inactive, no animation
 *   offline  - stale telemetry: same inactive treatment
 *   online   - sensor active: gentle airflow + soft particle drift
 *   high     - elevated particulates: slightly stronger particles (calm, no flash)
 */
(function () {
  var STATES = ['waiting', 'offline', 'online', 'high'];

  function vizHTML(sensorId, roomNo) {
    return '' +
      '<div class="ac3d" data-state="waiting" data-ac3d="' + sensorId + '" role="img" ' +
      'aria-label="Wall-mounted Split AC with AirSense particulate sensor for Room ' + roomNo + '">' +
      '<div class="ac3d-scene">' +
      '<div class="ac3d-body">' +
      '  <div class="ac3d-top-bevel">' +
      '    <div class="ac3d-top-intake ac3d-intake-left"></div>' +
      '    <div class="ac3d-top-divider"></div>' +
      '    <div class="ac3d-top-intake ac3d-intake-right"></div>' +
      '  </div>' +
      '  <div class="ac3d-front-panel">' +
      '    <div class="ac3d-brand-badge">' +
      '      <span class="ac3d-brand-icon">▲</span>' +
      '      <span class="ac3d-brand-name">AIRSENSE</span>' +
      '    </div>' +
      '    <div class="ac3d-panel-seam"></div>' +
      '    <div class="ac3d-display-cluster">' +
      '      <span class="ac3d-display-temp">24°</span>' +
      '      <span class="ac3d-led-dot"></span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="ac3d-discharge-vent">' +
      '    <div class="ac3d-louver-flap"></div>' +
      '  </div>' +
      '  <div class="ac3d-sensor" title="AirSense Intake Sensor (ESP32 + PMS5003)">' +
      '    <span class="ac3d-sled"></span>' +
      '    <span class="ac3d-stag">PMS5003</span>' +
      '  </div>' +
      '</div>' +
      '</div>' +
      '<svg class="ac3d-flow" viewBox="0 0 280 22" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M50 2 C 80 8, 130 9, 170 19" />' +
      '<path d="M80 2 C 110 9, 160 10, 200 20" />' +
      '<path d="M110 2 C 140 9, 185 11, 230 20" />' +
      '</svg>' +
      '<div class="ac3d-dust" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div class="ac3d-cap">AIR INTAKE &rarr; ESP32 + PMS5003 PARTICULATE SENSING</div>' +
      '</div>';
  }

  function buildAll() {
    var cards = document.querySelectorAll('.room-card[data-sensor]');
    cards.forEach(function (card) {
      if (card.querySelector('[data-ac3d]')) return; // already injected
      var header = card.querySelector('.room-card-header');
      if (!header) return;
      var sensorId = card.getAttribute('data-sensor') || '';
      var roomNo = sensorId.replace('sensor', '') || '?';
      var stage = document.createElement('div');
      stage.className = 'ac3d-stage';
      var wrap = document.createElement('div');
      wrap.className = 'ac3d-wrap';
      wrap.innerHTML = vizHTML(sensorId, roomNo);
      stage.appendChild(wrap);
      header.insertAdjacentElement('afterend', stage);
    });
  }

  function setState(sensorId, state) {
    if (STATES.indexOf(state) === -1) state = 'waiting';
    var el = document.querySelector('[data-ac3d="' + sensorId + '"]');
    if (el) el.setAttribute('data-state', state);
  }

  window.AC3D = { buildAll: buildAll, setState: setState };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildAll);
  } else {
    buildAll();
  }
})();
