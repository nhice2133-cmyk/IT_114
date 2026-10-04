(function () {
  function getSensor() {
    try {
      var q = new URLSearchParams(window.location.search);
      return q.get('sensor_id') || q.get('sensorId') || q.get('sensor') || '';
    } catch (e) { return ''; }
  }
  var sensor = getSensor();
  var path = '';
  try { path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase(); } catch (e) {}
  var page = 'dashboard';
  if (path.indexOf('analytics') === 0) page = 'analytics';
  else if (path.indexOf('maintenance') === 0) page = 'maintenance';
  else if (path.indexOf('alerts') === 0) page = 'alerts';
  else if (path.indexOf('room') === 0) page = 'room';

  var names = {
    sensor1: ['Room 1', 'Office AC Unit 1'],
    sensor2: ['Room 2', 'Office AC Unit 2'],
    sensor3: ['Room 3', 'Office AC Unit 3'],
    sensor4: ['Room 4', 'Office AC Unit 4']
  };
  var hasRoom = Boolean(sensor && names[sensor]);

  // 1. Office menu NEVER keeps sensor — always office-wide.
  var officeLinks = document.querySelectorAll('.apm-side-nav .side-nav-link');
  officeLinks.forEach(function (a) {
    var base = (a.getAttribute('href') || '').split('?')[0];
    a.setAttribute('href', base);
    a.classList.remove('active');
  });
  // Only highlight office menu when NOT inside a room.
  if (!hasRoom) {
    officeLinks.forEach(function (a) {
      if (a.getAttribute('data-nav') === page) a.classList.add('active');
    });
  }

  // 2. Room switcher highlight.
  document.querySelectorAll('.sidebar-room-links .side-nav-link').forEach(function (a) {
    if (a.getAttribute('data-room') === sensor) a.classList.add('active');
    else a.classList.remove('active');
  });

  // 3. Room context section.
  var ctx = document.getElementById('sidebarRoomCtx');
  var nav = document.getElementById('sidebarRoomNav');
  var roomLabel = document.getElementById('roomNavLabel');
  var rn = document.getElementById('sidebarRoomName');
  var rs = document.getElementById('sidebarRoomSub');
  var clearBtn = document.getElementById('sidebarClearRoom');

  if (hasRoom) {
    if (ctx) ctx.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');
    if (rn) rn.textContent = names[sensor][0];
    if (rs) rs.textContent = names[sensor][1];
    if (roomLabel) roomLabel.textContent = names[sensor][0] + ' Pages';
    var map = {
      sideLinkRoom: 'room.html',
      sideLinkAnalytics: 'analytics.html',
      sideLinkMaint: 'maintenance.html',
      sideLinkAlerts: 'alerts.html'
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('href', map[id] + '?sensor_id=' + sensor);
    });
    // Highlight ONLY the room sub-link — never the office menu at the same time.
    var sub = 'room';
    if (page === 'analytics' || page === 'maintenance' || page === 'alerts') sub = page;
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var want = map[id].replace('.html', '');
      if ((want === 'room' && sub === 'room') || want === sub) el.classList.add('active');
      else el.classList.remove('active');
    });
    // "x All units" goes back to the office version of the current page.
    if (clearBtn) {
      var back = 'index.html';
      if (page === 'analytics') back = 'analytics.html';
      else if (page === 'maintenance') back = 'maintenance.html';
      else if (page === 'alerts') back = 'alerts.html';
      else back = 'index.html';
      clearBtn.setAttribute('href', back);
    }
  } else {
    if (ctx) ctx.classList.add('hidden');
    if (nav) nav.classList.add('hidden');
  }

  var sel = document.getElementById('sensorSelect');
  if (sel && hasRoom) { try { sel.value = sensor; } catch (e) {} }
})();
