/**
 * ==============================================================================
 * AirSense - Alerts Engine (alerts.js)
 * ==============================================================================
 * Listens to all 4 office rooms in Firebase Realtime Database and generates
 * maintenance recommendation cards ONLY when maintenance_alert == true (persistent high dust).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBHaLqf5MqXBCJPsU1BJwqM6P2mi6AU-w",
  authDomain: "airsense-ba372.firebaseapp.com",
  databaseURL: "https://airsense-ba372-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "airsense-ba372",
  storageBucket: "airsense-ba372.firebasestorage.app",
  messagingSenderId: "409387199979",
  appId: "1:409387199979:web:8efa7cbb7c631f6a84bdae"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const roomsConfig = window.ROOMS_CONFIG || {
  sensor1: { name: "Room 1", label: "Office AC Unit 1" },
  sensor2: { name: "Room 2", label: "Office AC Unit 2" },
  sensor3: { name: "Room 3", label: "Office AC Unit 3" },
  sensor4: { name: "Room 4", label: "Office AC Unit 4" }
};

const alertsState = {};

const alertsParams = new URLSearchParams(window.location.search);
const alertsSensor = alertsParams.get("sensor_id") || alertsParams.get("sensorId") || alertsParams.get("sensor") || "";
const hasAlertsFilter = Boolean(alertsSensor && roomsConfig[alertsSensor]);

function applyAlertsUnitBanner() {
  if (!hasAlertsFilter) return;
  const info = roomsConfig[alertsSensor];
  const banner = document.getElementById("alertsUnitBanner");
  const title = document.getElementById("alertsUnitTitle");
  const desc = document.getElementById("alertsUnitDesc");
  if (banner) banner.classList.remove("hidden");
  if (title) title.textContent = `${info.name} Alert Records`;
  if (desc) desc.innerHTML = `Showing alert records filtered to <strong>${info.name} (${info.label})</strong>. Only this unit's maintenance recommendation and status row are highlighted below.`;
}

function formatLocalTimestamp(rawTs) {
  if (!rawTs && rawTs !== 0) return "--";
  const num = Number(rawTs);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) +
           " · " +
           dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return String(rawTs);
}

function renderAlertsFeed() {
  const loadingEl = document.getElementById("alertsLoading");
  const noAlertsBox = document.getElementById("noAlertsBox");
  const gridEl = document.getElementById("alertCardsGrid");
  const badgeCountEl = document.getElementById("alertsCountBadge");

  if (loadingEl) loadingEl.classList.add("hidden");

  const sensorIds = Object.keys(roomsConfig);
  const feedIds = hasAlertsFilter ? [alertsSensor] : sensorIds;
  const activeAlerts = [];

  feedIds.forEach(id => {
    const data = alertsState[id];
    if (data && data.isOnline && data.maintenanceAlert) {
      activeAlerts.push({
        sensorId: id,
        name: roomsConfig[id]?.name || id,
        label: roomsConfig[id]?.label || "",
        dustPct: data.dustPct,
        highHours: data.highHours,
        timestamp: data.timestamp
      });
    }
  });

  if (badgeCountEl) {
    if (activeAlerts.length > 0) {
      badgeCountEl.className = "connection-indicator-pill offline";
      badgeCountEl.textContent = `🔴 ${activeAlerts.length} ACTIVE RECOMMENDATION${activeAlerts.length > 1 ? "S" : ""}`;
    } else {
      badgeCountEl.className = "connection-indicator-pill online";
      badgeCountEl.textContent = "● 0 ACTIVE RECOMMENDATIONS";
    }
  }

  if (activeAlerts.length === 0) {
    if (noAlertsBox) noAlertsBox.classList.remove("hidden");
    if (gridEl) gridEl.innerHTML = "";
    return;
  }

  if (noAlertsBox) noAlertsBox.classList.add("hidden");
  if (!gridEl) return;

  gridEl.innerHTML = activeAlerts.map(a => `
    <div class="active-alert-card">
      <div class="alert-card-top">
        <div class="alert-card-header-left">
          <span class="alert-type-pill">🔴 PERSISTENT HIGH DUST CONDITION</span>
          <h3 class="alert-room-title">${a.name}</h3>
          <span class="alert-room-sub">${a.label} · <code>${a.sensorId}</code></span>
        </div>
        <div class="alert-dust-badge-wrap">
          <span class="dust-num-huge">${a.dustPct.toFixed(1)}%</span>
          <span class="dust-sub-caption">${a.highHours} / 24 hrs persistent</span>
        </div>
      </div>
      <div class="alert-card-body">
        <p class="alert-message-text">
          <strong>Persistent high dust condition detected. Inspection of the AC filter is recommended.</strong>
          The sensor recorded 24 consecutive hours of elevated particulate accumulation above the 80% reference range.
        </p>
        <span class="alert-timestamp">Triggered: ${formatLocalTimestamp(a.timestamp)}</span>
      </div>
      <div class="alert-card-footer">
        <a href="room.html?sensor_id=${encodeURIComponent(a.sensorId)}" class="btn-alert-action">View Room Telemetry</a>
        <a href="maintenance.html?sensor_id=${encodeURIComponent(a.sensorId)}" class="btn-alert-secondary">Record Servicing</a>
      </div>
    </div>
  `).join("");
}

function updateTableRow(sensorId, data) {
  const connBadge = document.getElementById(`connBadge_${sensorId}`);
  const tblDust = document.getElementById(`tblDust_${sensorId}`);
  const tblHours = document.getElementById(`tblHours_${sensorId}`);
  const tblAlert = document.getElementById(`tblAlert_${sensorId}`);

  if (!data || typeof data !== "object") {
    alertsState[sensorId] = { isOnline: false, dustPct: 0, maintenanceAlert: false, highHours: 0, timestamp: 0 };
    if (connBadge) {
      connBadge.className = "connection-indicator-pill waiting";
      connBadge.innerHTML = '<span class="conn-dot"></span> Waiting';
    }
    if (tblDust) tblDust.textContent = "--";
    if (tblHours) tblHours.textContent = "0 / 24 hrs";
    if (tblAlert) tblAlert.innerHTML = '<span class="val-ok">🟢 No inspection required</span>';
    return;
  }

  const pm25 = data.pm2_5 !== undefined ? Number(data.pm2_5) : 0;
  const dustPct = data.dust_percentage !== undefined ? Number(data.dust_percentage) : ((pm25 / 500) * 100);
  const maintenanceAlert = Boolean(data.maintenance_alert);
  const highHours = data.high_condition_hours !== undefined ? Number(data.high_condition_hours) : (dustPct >= 80 ? 1 : 0);
  const timestamp = data.timestamp || 0;

  let isOnline = true;
  if (timestamp > 0) {
    const tsMs = (Number(timestamp) > 1500000000 && Number(timestamp) < 9999999999) ? Number(timestamp) * 1000 : Number(timestamp);
    const ageMinutes = (Date.now() - tsMs) / (1000 * 60);
    if (ageMinutes > 5) isOnline = false;
  }

  alertsState[sensorId] = { isOnline, dustPct, maintenanceAlert, highHours, timestamp };

  if (connBadge) {
    connBadge.className = `connection-indicator-pill ${isOnline ? "online" : "offline"}`;
    connBadge.innerHTML = `<span class="conn-dot"></span> ${isOnline ? "Sensor Online" : "Sensor Offline"}`;
  }

  if (tblDust) tblDust.textContent = `${dustPct.toFixed(1)}%`;
  if (tblHours) tblHours.textContent = `${highHours} / 24 hrs`;

  if (tblAlert) {
    if (maintenanceAlert) {
      tblAlert.innerHTML = '<span class="val-warn">🔴 Inspection Recommended</span>';
    } else {
      tblAlert.innerHTML = '<span class="val-ok">🟢 No inspection required</span>';
    }
  }
}

function setupAlertsListeners() {
  const sensorIds = Object.keys(roomsConfig);

  sensorIds.forEach(id => {
    const sRef = ref(db, `sensors/${id}`);
    onValue(sRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        updateTableRow(id, val);
      } else {
        updateTableRow(id, null);
      }
      renderAlertsFeed();
    }, (err) => {
      console.warn(`Error on alerts listener for ${id}:`, err);
      updateTableRow(id, null);
      renderAlertsFeed();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyAlertsUnitBanner();
  const sel = document.getElementById("sensorSelect");
  if (sel && hasAlertsFilter) { try { sel.value = alertsSensor; } catch (e) {} }
  onAuthStateChanged(auth, (user) => {
    if (user) setupAlertsListeners();
  });
  signInAnonymously(auth).catch((err) => {
    console.error("Auth error in alerts.js:", err);
    setupAlertsListeners();
  });
});
