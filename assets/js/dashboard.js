/**
 * ==============================================================================
 * AirSense - 4-Room Office Real-Time Monitoring Engine (dashboard.js)
 * ==============================================================================
 * Concurrently monitors Room 1 (sensor1), Room 2 (sensor2), Room 3 (sensor3),
 * and Room 4 (sensor4) from Firebase Realtime Database.
 *
 * Implements:
 * - Dust Condition % (PM2.5 / 500 * 100)
 * - Status: LOW (0-39.9%), MODERATE (40-79.9%), HIGH (80-100%)
 * - Persistent High Condition Hours (high_condition_hours / 24 hrs)
 * - Maintenance Alert: Strictly follows Firebase maintenance_alert (no instant spikes)
 * - Clear Alert Hierarchy: Normal, Monitor, High Condition, Maintenance Recommended
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

// Rooms Configuration
const roomsConfig = window.ROOMS_CONFIG || {
  sensor1: { name: "Room 1", label: "Office AC Unit 1" },
  sensor2: { name: "Room 2", label: "Office AC Unit 2" },
  sensor3: { name: "Room 3", label: "Office AC Unit 3" },
  sensor4: { name: "Room 4", label: "Office AC Unit 4" }
};

// Internal State per room
const roomsState = {
  sensor1: { isConnected: false, isOnline: false, dustPct: 0, pm25: 0, pm1: 0, pm10: 0, status: "WAITING", isAlert: false, highHours: 0, lastTs: 0 },
  sensor2: { isConnected: false, isOnline: false, dustPct: 0, pm25: 0, pm1: 0, pm10: 0, status: "WAITING", isAlert: false, highHours: 0, lastTs: 0 },
  sensor3: { isConnected: false, isOnline: false, dustPct: 0, pm25: 0, pm1: 0, pm10: 0, status: "WAITING", isAlert: false, highHours: 0, lastTs: 0 },
  sensor4: { isConnected: false, isOnline: false, dustPct: 0, pm25: 0, pm1: 0, pm10: 0, status: "WAITING", isAlert: false, highHours: 0, lastTs: 0 }
};

// -----------------------------------------------------------------------------
// Format Local Timestamp Helper (Philippine Standard Time)
// Example: "August 28, 2026 – 7:35 PM"
// -----------------------------------------------------------------------------
function formatLocalTimestamp(rawTs) {
  if (!rawTs && rawTs !== 0) return "--";
  const num = Number(rawTs);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) +
           " – " +
           dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return String(rawTs);
}

// -----------------------------------------------------------------------------
// Status Classification Helper (Exact Capstone Wording)
// -----------------------------------------------------------------------------
function getStatusInfo(dustPct, explicitStatus, maintenanceAlert, highHours) {
  const pct = Number(dustPct) || 0;
  let status = explicitStatus ? String(explicitStatus).toUpperCase() : "";
  if (!status || status === "UNDEFINED") {
    if (pct >= 80) status = "HIGH";
    else if (pct >= 40) status = "MODERATE";
    else status = "LOW";
  }

  let actionText = "Normal monitoring";
  let badgeClass = "low";
  let recommendationText = "Normal monitoring. No maintenance inspection is currently recommended.";
  let alertBadgeClass = "ok";
  let alertBadgeText = "🟢 NO MAINTENANCE ALERT";

  if (status === "HIGH" || pct >= 80) {
    status = "HIGH";
    badgeClass = "high";
    actionText = "High dust condition detected";

    if (maintenanceAlert || highHours >= 24) {
      alertBadgeClass = "warn";
      alertBadgeText = "🔴 MAINTENANCE INSPECTION RECOMMENDED";
      recommendationText = "Persistent high dust condition detected. Inspect the AC filter and evaluate whether cleaning is necessary.";
    } else {
      alertBadgeClass = "ok";
      alertBadgeText = "🟢 NO MAINTENANCE ALERT";
      recommendationText = "High dust condition detected. Continue monitoring persistent conditions.";
    }
  } else if (status === "MODERATE" || pct >= 40) {
    status = "MODERATE";
    badgeClass = "moderate";
    actionText = "Continue monitoring";
    recommendationText = "Elevated dust condition. Continue monitoring.";
  } else {
    status = "LOW";
    badgeClass = "low";
    actionText = "Normal monitoring";
    recommendationText = "Normal monitoring. No maintenance inspection is currently recommended.";
  }

  // Hours subtext
  let hoursSubtext = "No persistent high condition detected.";
  if (highHours >= 24 || maintenanceAlert) {
    hoursSubtext = "Persistent high condition reached. Maintenance inspection recommended.";
  } else if (highHours > 0) {
    hoursSubtext = "High condition is being monitored.";
  }

  return { status, actionText, badgeClass, pct, recommendationText, alertBadgeClass, alertBadgeText, hoursSubtext };
}

// -----------------------------------------------------------------------------
// Update Office-Wide Summary Metrics
// -----------------------------------------------------------------------------
function updateOfficeSummary() {
  const sensorIds = Object.keys(roomsConfig);
  const total = sensorIds.length;

  let onlineCount = 0;
  let waitingCount = 0;
  let alertList = [];

  sensorIds.forEach(id => {
    const s = roomsState[id];
    if (s.isOnline) {
      onlineCount++;
    } else {
      waitingCount++;
    }

    // Alert strictly based on Firebase maintenance_alert === true
    if (s.isOnline && s.isAlert) {
      alertList.push({
        id,
        name: roomsConfig[id]?.name || id,
        dust: s.dustPct.toFixed(1),
        hours: s.highHours
      });
    }
  });

  // Top Summary Numbers
  const statTotal = document.getElementById("statTotalRooms");
  const statOnline = document.getElementById("statOnlineRooms");
  const statWaiting = document.getElementById("statWaitingRooms");
  const statAttention = document.getElementById("statAttentionRooms");

  if (statTotal) statTotal.textContent = total;
  if (statOnline) statOnline.textContent = onlineCount;
  if (statWaiting) statWaiting.textContent = waitingCount;
  if (statAttention) statAttention.textContent = alertList.length;

  // Global Header Live Pill
  const headerStatusDot = document.getElementById("headerStatusDot");
  const headerStatusText = document.getElementById("headerStatusText");
  if (headerStatusDot && headerStatusText) {
    if (onlineCount > 0) {
      headerStatusDot.className = "status-indicator-dot dot-online";
      headerStatusText.textContent = `${onlineCount} SENSOR${onlineCount > 1 ? "S" : ""} LIVE`;
    } else {
      headerStatusDot.className = "status-indicator-dot dot-amber";
      headerStatusText.textContent = "WAITING";
    }
  }

  // Office Alert Banner (Only appears when maintenance_alert == true)
  const banner = document.getElementById("officeAlertBanner");
  const bannerMsg = document.getElementById("officeAlertMsg");
  const navAlertBadge = document.getElementById("navAlertBadge");

  if (navAlertBadge) {
    if (alertList.length > 0) {
      navAlertBadge.textContent = alertList.length;
      navAlertBadge.classList.remove("hidden");
    } else {
      navAlertBadge.classList.add("hidden");
    }
  }

  if (banner && bannerMsg) {
    if (alertList.length === 1) {
      banner.classList.remove("hidden");
      bannerMsg.textContent = `Persistent high dust condition detected in ${alertList[0].name}. Inspect the AC filter and evaluate whether cleaning is necessary.`;
    } else if (alertList.length > 1) {
      banner.classList.remove("hidden");
      const listStr = alertList.map(a => `${a.name} (${a.dust}%)`).join(", ");
      bannerMsg.textContent = `Persistent high dust conditions detected in: ${listStr}. AC filter inspection recommended.`;
    } else {
      banner.classList.add("hidden");
    }
  }
}

// -----------------------------------------------------------------------------
// Update Room Card UI
// -----------------------------------------------------------------------------
function updateRoomCard(sensorId, data) {
  const card = document.getElementById(`roomCard_${sensorId}`);
  const onlineBody = document.getElementById(`onlineBody_${sensorId}`);
  const waitingBody = document.getElementById(`waitingBody_${sensorId}`);
  const badge = document.getElementById(`badge_${sensorId}`);
  const badgeText = document.getElementById(`badgeText_${sensorId}`);

  // Matrix table elements
  const matStatus = document.getElementById(`matStatus_${sensorId}`);
  const matPm25 = document.getElementById(`matPm25_${sensorId}`);
  const matDust = document.getElementById(`matDust_${sensorId}`);
  const matHours = document.getElementById(`matHours_${sensorId}`);
  const matMaint = document.getElementById(`matMaint_${sensorId}`);

  if (!card) return;

  if (!data || typeof data !== "object") {
    // Unconnected / Waiting State
    roomsState[sensorId] = { isConnected: false, isOnline: false, dustPct: 0, pm25: 0, pm1: 0, pm10: 0, status: "WAITING", isAlert: false, highHours: 0, lastTs: 0 };

    card.className = "room-card card-waiting";
    if (onlineBody) onlineBody.classList.remove("hidden");
    if (waitingBody) waitingBody.classList.add("hidden");

    if (badge && badgeText) {
      badge.className = "connection-indicator-pill waiting";
      badgeText.textContent = "Waiting for Sensor";
    }
    if (window.AC3D) window.AC3D.setState(sensorId, "waiting");

    // Populate Standby Metrics into full card structure
    const dustValEl = document.getElementById(`dustVal_${sensorId}`);
    const dustBadgeEl = document.getElementById(`dustBadge_${sensorId}`);
    const actionMsgEl = document.getElementById(`actionMsg_${sensorId}`);
    const progressBarEl = document.getElementById(`progressBar_${sensorId}`);
    const hoursTextEl = document.getElementById(`hoursText_${sensorId}`);
    const hoursBarEl = document.getElementById(`hoursBar_${sensorId}`);
    const hoursStatusMsgEl = document.getElementById(`hoursStatusMsg_${sensorId}`);
    const pm1El = document.getElementById(`pm1Val_${sensorId}`);
    const pm25El = document.getElementById(`pm25Val_${sensorId}`);
    const pm10El = document.getElementById(`pm10Val_${sensorId}`);
    const mStatusBadgeEl = document.getElementById(`mStatusBadge_${sensorId}`);
    const mStatusMsgEl = document.getElementById(`mStatusMsg_${sensorId}`);
    const lastUpdatedEl = document.getElementById(`lastUpdated_${sensorId}`);

    if (dustValEl) dustValEl.textContent = "--%";
    if (dustBadgeEl) {
      dustBadgeEl.className = "dust-status-badge waiting";
      dustBadgeEl.textContent = "WAITING";
    }
    if (actionMsgEl) actionMsgEl.textContent = "Awaiting sensor telemetry";
    if (progressBarEl) {
      progressBarEl.style.width = "0%";
      progressBarEl.className = "progress-bar-fill fill-low";
    }
    if (hoursTextEl) hoursTextEl.textContent = "0 / 24 hours";
    if (hoursBarEl) {
      hoursBarEl.style.width = "0%";
      hoursBarEl.className = "tracker-bar-fill";
    }
    if (hoursStatusMsgEl) hoursStatusMsgEl.textContent = "No persistent high condition detected.";
    if (pm1El) pm1El.textContent = "--";
    if (pm25El) pm25El.textContent = "--";
    if (pm10El) pm10El.textContent = "--";
    if (mStatusBadgeEl && mStatusMsgEl) {
      mStatusBadgeEl.className = "m-status-pill ok";
      mStatusBadgeEl.textContent = "🟢 NO MAINTENANCE ALERT";
      mStatusMsgEl.textContent = `Standby mode · Configured node listening on /sensors/${sensorId}/.`;
    }
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Waiting for sensor data...";

    if (matStatus) {
      matStatus.className = "connection-indicator-pill waiting";
      matStatus.innerHTML = '<span class="conn-dot"></span> Waiting';
    }
    if (matPm25) matPm25.textContent = "--";
    if (matDust) matDust.textContent = "--";
    if (matHours) matHours.textContent = "0 / 24 hrs";
    if (matMaint) matMaint.innerHTML = '<span class="val-ok">🟢 NO</span>';

    updateOfficeSummary();
    return;
  }

  // Parse Telemetry
  const pm1 = data.pm1_0 !== undefined ? Number(data.pm1_0) : 0;
  const pm25 = data.pm2_5 !== undefined ? Number(data.pm2_5) : 0;
  const pm10 = data.pm10 !== undefined ? Number(data.pm10) : 0;
  const dustPct = data.dust_percentage !== undefined ? Number(data.dust_percentage) : ((pm25 / 500) * 100);
  const rawStatus = data.status || "";
  const maintenanceAlert = Boolean(data.maintenance_alert);
  const highHours = data.high_condition_hours !== undefined ? Number(data.high_condition_hours) : (dustPct >= 80 ? 1 : 0);
  const timestamp = data.timestamp || 0;

  // Stale detection (over 5 mins = offline)
  let isOnline = true;
  if (timestamp > 0) {
    const tsMs = (Number(timestamp) > 1500000000 && Number(timestamp) < 9999999999) ? Number(timestamp) * 1000 : Number(timestamp);
    const ageMinutes = (Date.now() - tsMs) / (1000 * 60);
    if (ageMinutes > 5) isOnline = false;
  }

  const info = getStatusInfo(dustPct, rawStatus, maintenanceAlert, highHours);

  // Save to State
  roomsState[sensorId] = {
    isConnected: true,
    isOnline,
    dustPct,
    pm25,
    pm1,
    pm10,
    status: info.status,
    isAlert: maintenanceAlert,
    highHours,
    lastTs: timestamp
  };

  // Card classes (only alert-high if maintenanceAlert is TRUE)
  card.className = `room-card ${maintenanceAlert ? "card-alert-high" : (isOnline ? "card-online" : "card-offline")}`;
  if (onlineBody) onlineBody.classList.remove("hidden");
  if (waitingBody) waitingBody.classList.add("hidden");

  // Connection badge
  if (badge && badgeText) {
    badge.className = `connection-indicator-pill ${isOnline ? "online" : "offline"}`;
    badgeText.textContent = isOnline ? "Sensor Online" : "Sensor Offline";
  }

  // 3D AC visualization follows live room state (supporting visual only)
  if (window.AC3D) {
    const acMode = !isOnline ? "offline" : (dustPct >= 80 ? "high" : "online");
    window.AC3D.setState(sensorId, acMode);
  }

  // Dust Condition Values
  const dustValEl = document.getElementById(`dustVal_${sensorId}`);
  const dustBadgeEl = document.getElementById(`dustBadge_${sensorId}`);
  const actionMsgEl = document.getElementById(`actionMsg_${sensorId}`);
  const progressBarEl = document.getElementById(`progressBar_${sensorId}`);

  if (dustValEl) dustValEl.textContent = `${dustPct.toFixed(1)}%`;
  if (dustBadgeEl) {
    dustBadgeEl.className = `dust-status-badge ${info.badgeClass}`;
    dustBadgeEl.textContent = info.status;
  }
  if (actionMsgEl) actionMsgEl.textContent = info.actionText;

  if (progressBarEl) {
    progressBarEl.style.width = `${Math.min(100, Math.max(0, dustPct))}%`;
    progressBarEl.className = `progress-bar-fill fill-${info.badgeClass}`;
  }

  // High Condition Progress Bar (high_condition_hours / 24)
  const hoursTextEl = document.getElementById(`hoursText_${sensorId}`);
  const hoursBarEl = document.getElementById(`hoursBar_${sensorId}`);
  const hoursStatusMsgEl = document.getElementById(`hoursStatusMsg_${sensorId}`);

  if (hoursTextEl) hoursTextEl.textContent = `${Math.min(24, Math.max(0, highHours))} / 24 hours`;
  if (hoursBarEl) {
    const hoursPct = Math.min(100, (highHours / 24) * 100);
    hoursBarEl.style.width = `${hoursPct}%`;
    hoursBarEl.className = `tracker-bar-fill ${hoursPct >= 100 || maintenanceAlert ? "fill-critical" : (hoursPct > 0 ? "fill-active" : "")}`;
  }
  if (hoursStatusMsgEl) {
    hoursStatusMsgEl.textContent = info.hoursSubtext;
  }

  // Particulate Matter
  const pm1El = document.getElementById(`pm1Val_${sensorId}`);
  const pm25El = document.getElementById(`pm25Val_${sensorId}`);
  const pm10El = document.getElementById(`pm10Val_${sensorId}`);

  if (pm1El) pm1El.textContent = pm1.toFixed(1);
  if (pm25El) pm25El.textContent = pm25.toFixed(1);
  if (pm10El) pm10El.textContent = pm10.toFixed(1);

  // Maintenance Decision Support Section
  const mStatusBadgeEl = document.getElementById(`mStatusBadge_${sensorId}`);
  const mStatusMsgEl = document.getElementById(`mStatusMsg_${sensorId}`);

  if (mStatusBadgeEl && mStatusMsgEl) {
    mStatusBadgeEl.className = `m-status-pill ${info.alertBadgeClass}`;
    mStatusBadgeEl.textContent = info.alertBadgeText;
    mStatusMsgEl.textContent = info.recommendationText;
  }

  // Last Updated
  const lastUpdatedEl = document.getElementById(`lastUpdated_${sensorId}`);
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = formatLocalTimestamp(timestamp);
  }

  // Matrix Table Row
  if (matStatus) {
    matStatus.className = `connection-indicator-pill ${isOnline ? "online" : "offline"}`;
    matStatus.innerHTML = `<span class="conn-dot"></span> ${isOnline ? "Sensor Online" : "Sensor Offline"}`;
  }
  if (matPm25) matPm25.textContent = `${pm25.toFixed(1)} µg/m³`;
  if (matDust) matDust.textContent = `${dustPct.toFixed(1)}%`;
  if (matHours) matHours.textContent = `${highHours} / 24 hrs`;
  if (matMaint) {
    if (maintenanceAlert) {
      matMaint.innerHTML = '<span class="val-warn">🔴 YES</span>';
    } else {
      matMaint.innerHTML = '<span class="val-ok">🟢 NO</span>';
    }
  }

  updateOfficeSummary();
}

// -----------------------------------------------------------------------------
// Setup Listeners for All 4 Rooms
// -----------------------------------------------------------------------------
function setup4RoomListeners() {
  const sensorIds = Object.keys(roomsConfig);

  sensorIds.forEach(sensorId => {
    const sensorRef = ref(db, `sensors/${sensorId}`);

    onValue(sensorRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        updateRoomCard(sensorId, val);
      } else {
        updateRoomCard(sensorId, null);
      }
    }, (err) => {
      console.warn(`Error reading /sensors/${sensorId}:`, err);
      updateRoomCard(sensorId, null);
    });
  });
}

// -----------------------------------------------------------------------------
// Live Clock (Philippine Standard Time)
// -----------------------------------------------------------------------------
function startLiveClock() {
  const clockEl = document.getElementById("officeClock");
  if (!clockEl) return;
  const update = () => {
    clockEl.textContent = new Date().toLocaleTimeString(undefined, { hour12: true });
  };
  update();
  setInterval(update, 1000);
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();

  onAuthStateChanged(auth, (user) => {
    if (user) setup4RoomListeners();
  });

  signInAnonymously(auth).catch((err) => {
    console.error("Firebase auth error on dashboard:", err);
    setup4RoomListeners();
  });
});
