/**
 * ==============================================================================
 * AirSense - Room Detailed Monitoring Engine (room.js)
 * ==============================================================================
 * Real-time telemetry, persistent high condition hours, dual-metric historical charts,
 * and Maintenance Decision Support tracking for individual office rooms from Firebase.
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

const roomsConfig = {
  sensor1: { name: "Room 1", label: "Office AC Unit 1", hardware: "ESP32 + PMS5003" },
  sensor2: { name: "Room 2", label: "Office AC Unit 2", hardware: "ESP32 + PMS5003" },
  sensor3: { name: "Room 3", label: "Office AC Unit 3", hardware: "ESP32 + PMS5003" },
  sensor4: { name: "Room 4", label: "Office AC Unit 4", hardware: "ESP32 + PMS5003" }
};

const urlParams = new URLSearchParams(window.location.search);
const sensorId = urlParams.get("sensor_id") || window.ACTIVE_ROOM_SENSOR || "sensor1";
const activeRoom = roomsConfig[sensorId] || roomsConfig.sensor1;
const roomName = activeRoom.name;

// Update page headers dynamically
if (document.getElementById("pageTitle")) document.getElementById("pageTitle").textContent = `AirSense | ${roomName} (${activeRoom.label}) Monitoring`;
if (document.getElementById("roomMainTitle")) document.getElementById("roomMainTitle").textContent = `${roomName} Telemetry`;
if (document.getElementById("roomMainSub")) document.getElementById("roomMainSub").innerHTML = `${activeRoom.label} · Node: <code class="code-sensor">${sensorId}</code> · ${activeRoom.hardware}`;
if (document.getElementById("chartRoomTitle")) document.getElementById("chartRoomTitle").textContent = `${roomName} Historical Telemetry Trend`;
if (document.getElementById("chartRoomSub")) document.getElementById("chartRoomSub").innerHTML = `Chronological time series from <code>/history/${sensorId}/</code>`;
if (document.getElementById("panelRoomTitle")) document.getElementById("panelRoomTitle").textContent = `${roomName} Maintenance Profile`;
if (document.getElementById("panelUnitLabel")) document.getElementById("panelUnitLabel").textContent = activeRoom.label;
if (document.getElementById("sensorSelect")) document.getElementById("sensorSelect").value = sensorId;
if (document.getElementById("btnRecordMaint")) document.getElementById("btnRecordMaint").href = `maintenance.html?sensor_id=${sensorId}`;
if (document.getElementById("btnRecordServiceLink")) document.getElementById("btnRecordServiceLink").href = `maintenance.html?sensor_id=${sensorId}`;

// DOM References
const DOM = {
  roomAlertBanner: document.getElementById("roomAlertBanner"),
  roomAlertMsg: document.getElementById("roomAlertMsg"),
  roomConnectionBadge: document.getElementById("roomConnectionBadge"),
  roomConnectionText: document.getElementById("roomConnectionText"),
  roomLastUpdated: document.getElementById("roomLastUpdated"),

  roomPm1Val: document.getElementById("roomPm1Val"),
  roomPm25Val: document.getElementById("roomPm25Val"),
  roomPm10Val: document.getElementById("roomPm10Val"),
  roomDustVal: document.getElementById("roomDustVal"),
  roomDustBadge: document.getElementById("roomDustBadge"),
  roomActionMsg: document.getElementById("roomActionMsg"),

  roomHoursTag: document.getElementById("roomHoursTag"),
  roomHoursBar: document.getElementById("roomHoursBar"),
  roomHoursStatusText: document.getElementById("roomHoursStatusText"),

  // Decision Support Elements
  roomMDecisionBadge: document.getElementById("roomMDecisionBadge"),
  dDustVal: document.getElementById("dDustVal"),
  dStatusVal: document.getElementById("dStatusVal"),
  dHoursVal: document.getElementById("dHoursVal"),
  dAlertVal: document.getElementById("dAlertVal"),
  roomRecommendationText: document.getElementById("roomRecommendationText"),

  roomMCondition: document.getElementById("roomMCondition"),
  roomMAlert: document.getElementById("roomMAlert"),
  roomLastCleaned: document.getElementById("roomLastCleaned"),
  roomLastCleanedNotes: document.getElementById("roomLastCleanedNotes"),
  roomNextSchedule: document.getElementById("roomNextSchedule"),

  noHistoryOverlay: document.getElementById("noHistoryOverlay")
};

let roomHistoryChart = null;
let currentMetric = "dust";
let historicalRecords = [];

// -----------------------------------------------------------------------------
// Format Local Timestamp Helper (Philippine Standard Time)
// -----------------------------------------------------------------------------
function formatLocalTimestamp(rawTs) {
  if (!rawTs && rawTs !== 0) return "Waiting for sensor data...";
  const num = Number(rawTs);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) +
           " – " +
           dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return String(rawTs);
}

function formatChartTime(rawTs) {
  if (!rawTs) return "";
  const num = Number(rawTs);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
           dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return String(rawTs);
}

// -----------------------------------------------------------------------------
// Status Classification Helper (Exact Capstone Rules)
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
  let alertValText = "NO";

  if (status === "HIGH" || pct >= 80) {
    status = "HIGH";
    badgeClass = "high";
    actionText = "High dust condition detected";

    if (maintenanceAlert || highHours >= 24) {
      alertBadgeClass = "warn";
      alertBadgeText = "🔴 MAINTENANCE INSPECTION RECOMMENDED";
      alertValText = "YES";
      recommendationText = "Maintenance inspection recommended. Inspect the AC filter and determine whether cleaning is necessary.";
    } else {
      alertBadgeClass = "ok";
      alertBadgeText = "🟢 NO MAINTENANCE ALERT";
      alertValText = "NO";
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

  return { status, actionText, badgeClass, pct, recommendationText, alertBadgeClass, alertBadgeText, alertValText, hoursSubtext };
}

// -----------------------------------------------------------------------------
// Live Telemetry Listener (/sensors/{sensorId}/)
// -----------------------------------------------------------------------------
function listenToLiveRoomSensor() {
  const sensorRef = ref(db, `sensors/${sensorId}`);

  onValue(sensorRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setRoomWaitingState();
        return;
      }

      const pm1 = data.pm1_0 !== undefined ? Number(data.pm1_0) : 0;
      const pm25 = data.pm2_5 !== undefined ? Number(data.pm2_5) : 0;
      const pm10 = data.pm10 !== undefined ? Number(data.pm10) : 0;
      const dustPct = data.dust_percentage !== undefined ? Number(data.dust_percentage) : ((pm25 / 500) * 100);
      const rawStatus = data.status || "";
      const maintenanceAlert = Boolean(data.maintenance_alert);
      const highHours = data.high_condition_hours !== undefined ? Number(data.high_condition_hours) : (dustPct >= 80 ? 1 : 0);
      const timestamp = data.timestamp || 0;

      // Online status check (within 5 minutes = Online, else Offline)
      let isOnline = true;
      if (timestamp > 0) {
        const tsMs = (Number(timestamp) > 1500000000 && Number(timestamp) < 9999999999) ? Number(timestamp) * 1000 : Number(timestamp);
        const ageMinutes = (Date.now() - tsMs) / (1000 * 60);
        if (ageMinutes > 5) isOnline = false;
      }

      // Update Connection Badge
      if (DOM.roomConnectionBadge && DOM.roomConnectionText) {
        DOM.roomConnectionBadge.className = `connection-indicator-pill ${isOnline ? "online" : "offline"}`;
        DOM.roomConnectionText.textContent = isOnline ? "Sensor Online" : "Sensor Offline";
      }

      if (DOM.roomLastUpdated) {
        DOM.roomLastUpdated.textContent = formatLocalTimestamp(timestamp);
      }

      // Update Metric Values
      if (DOM.roomPm1Val) DOM.roomPm1Val.textContent = pm1.toFixed(1);
      if (DOM.roomPm25Val) DOM.roomPm25Val.textContent = pm25.toFixed(1);
      if (DOM.roomPm10Val) DOM.roomPm10Val.textContent = pm10.toFixed(1);
      if (DOM.roomDustVal) DOM.roomDustVal.textContent = `${dustPct.toFixed(1)}%`;

      const info = getStatusInfo(dustPct, rawStatus, maintenanceAlert, highHours);

      if (DOM.roomDustBadge) {
        DOM.roomDustBadge.className = `dust-status-badge ${info.badgeClass}`;
        DOM.roomDustBadge.textContent = info.status;
      }

      if (DOM.roomActionMsg) {
        DOM.roomActionMsg.textContent = info.actionText;
      }

      // High Condition Tracker (high_condition_hours / 24)
      if (DOM.roomHoursTag) {
        DOM.roomHoursTag.textContent = `${Math.min(24, Math.max(0, highHours))} / 24 Hours`;
      }
      if (DOM.roomHoursBar) {
        const hoursPct = Math.min(100, (highHours / 24) * 100);
        DOM.roomHoursBar.style.width = `${hoursPct}%`;
        DOM.roomHoursBar.className = `tracker-bar-fill ${hoursPct >= 100 || maintenanceAlert ? "fill-critical" : (hoursPct > 0 ? "fill-active" : "")}`;
      }
      if (DOM.roomHoursStatusText) {
        DOM.roomHoursStatusText.textContent = info.hoursSubtext;
      }

      // Decision Support Section
      if (DOM.roomMDecisionBadge) {
        DOM.roomMDecisionBadge.className = `m-status-pill ${info.alertBadgeClass}`;
        DOM.roomMDecisionBadge.textContent = info.alertBadgeText;
      }
      if (DOM.dDustVal) DOM.dDustVal.textContent = `${dustPct.toFixed(1)}%`;
      if (DOM.dStatusVal) DOM.dStatusVal.textContent = info.status;
      if (DOM.dHoursVal) DOM.dHoursVal.textContent = `${Math.min(24, Math.max(0, highHours))} / 24 hours`;
      if (DOM.dAlertVal) {
        DOM.dAlertVal.textContent = info.alertValText;
        DOM.dAlertVal.className = `d-val ${maintenanceAlert ? "text-red" : "text-green"}`;
      }
      if (DOM.roomRecommendationText) {
        DOM.roomRecommendationText.textContent = info.recommendationText;
      }

      // Right Maintenance Profile Panel
      if (DOM.roomMCondition) {
        DOM.roomMCondition.textContent = info.status;
        DOM.roomMCondition.className = `m-status-value cond-${info.badgeClass}`;
      }

      if (DOM.roomMAlert) {
        DOM.roomMAlert.textContent = info.alertValText;
        DOM.roomMAlert.className = `m-status-value ${maintenanceAlert ? "alert-warn" : "alert-ok"}`;
      }

      // Critical Warning Banner (Only when maintenance_alert == true)
      if (DOM.roomAlertBanner && DOM.roomAlertMsg) {
        if (maintenanceAlert) {
          DOM.roomAlertBanner.classList.remove("hidden");
          DOM.roomAlertMsg.textContent = `Persistent high dust condition detected in ${roomName}. Inspect the AC filter and evaluate whether cleaning is necessary.`;
        } else {
          DOM.roomAlertBanner.classList.add("hidden");
        }
      }

    } else {
      setRoomWaitingState();
    }
  }, (err) => {
    console.warn(`Error reading sensor ${sensorId}:`, err);
    setRoomWaitingState();
  });
}

function setRoomWaitingState() {
  if (DOM.roomConnectionBadge && DOM.roomConnectionText) {
    DOM.roomConnectionBadge.className = "connection-indicator-pill waiting";
    DOM.roomConnectionText.textContent = "Waiting for Sensor";
  }
  if (DOM.roomLastUpdated) DOM.roomLastUpdated.textContent = "Waiting for sensor data...";
  if (DOM.roomPm1Val) DOM.roomPm1Val.textContent = "--";
  if (DOM.roomPm25Val) DOM.roomPm25Val.textContent = "--";
  if (DOM.roomPm10Val) DOM.roomPm10Val.textContent = "--";
  if (DOM.roomDustVal) DOM.roomDustVal.textContent = "--%";
  if (DOM.roomDustBadge) {
    DOM.roomDustBadge.className = "dust-status-badge";
    DOM.roomDustBadge.textContent = "WAITING";
  }
  if (DOM.roomActionMsg) DOM.roomActionMsg.textContent = "Waiting for sensor data...";
  if (DOM.roomAlertBanner) DOM.roomAlertBanner.classList.add("hidden");
}

// -----------------------------------------------------------------------------
// History Listener (/history/{sensorId}/)
// -----------------------------------------------------------------------------
function listenToRoomHistory() {
  const historyRef = ref(db, `history/${sensorId}`);

  onValue(historyRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.val();
      const records = [];
      Object.keys(raw).forEach((k) => {
        const item = raw[k];
        if (item && typeof item === "object") {
          records.push({
            id: k,
            pm1_0: Number(item.pm1_0 || 0),
            pm2_5: Number(item.pm2_5 || 0),
            pm10: Number(item.pm10 || 0),
            dust_percentage: item.dust_percentage !== undefined ? Number(item.dust_percentage) : ((Number(item.pm2_5 || 0) / 500) * 100),
            timestamp: item.timestamp || 0
          });
        }
      });

      records.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
      historicalRecords = records.slice(-60);

      if (historicalRecords.length > 0) {
        if (DOM.noHistoryOverlay) DOM.noHistoryOverlay.classList.add("hidden");
        renderHistoryChart();
        return;
      }
    }

    // No Data State
    historicalRecords = [];
    if (DOM.noHistoryOverlay) DOM.noHistoryOverlay.classList.remove("hidden");
    if (roomHistoryChart) {
      roomHistoryChart.destroy();
      roomHistoryChart = null;
    }
  }, (err) => {
    console.warn(`History fetch error for ${sensorId}:`, err);
    if (DOM.noHistoryOverlay) DOM.noHistoryOverlay.classList.remove("hidden");
  });
}

// -----------------------------------------------------------------------------
// Render Historical Multi-Chart with Metric Switcher
// -----------------------------------------------------------------------------
function renderHistoryChart() {
  const ctx = document.getElementById("roomHistoryChart")?.getContext("2d");
  if (!ctx || historicalRecords.length === 0) return;

  const labels = historicalRecords.map(r => formatChartTime(r.timestamp));
  const dustData = historicalRecords.map(r => Number(r.dust_percentage.toFixed(1)));
  const pm1Data = historicalRecords.map(r => Number(r.pm1_0.toFixed(1)));
  const pm25Data = historicalRecords.map(r => Number(r.pm2_5.toFixed(1)));
  const pm10Data = historicalRecords.map(r => Number(r.pm10.toFixed(1)));

  let datasets = [];

  if (currentMetric === "dust") {
    datasets = [
      {
        label: "Dust Condition (%)",
        data: dustData,
        borderColor: "#0284c7",
        backgroundColor: "rgba(2, 132, 199, 0.12)",
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#0284c7",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 7,
        order: 1
      },
      {
        label: "80% Alert Threshold (Needs Cleaning)",
        data: labels.map(() => 80),
        borderColor: "#ef4444",
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 2
      },
      {
        label: "40% Moderate Dust Threshold",
        data: labels.map(() => 40),
        borderColor: "#f59e0b",
        borderDash: [5, 4],
        borderWidth: 1.8,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        order: 3
      }
    ];
  } else if (currentMetric === "pm25") {
    datasets = [{
      label: "PM2.5 (Reference Driver) µg/m³",
      data: pm25Data,
      borderColor: "#0284c7",
      backgroundColor: "rgba(2, 132, 199, 0.12)",
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#0284c7",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 7
    }];
  } else if (currentMetric === "pm1") {
    datasets = [{
      label: "PM1.0 (Ultra-Fine) µg/m³",
      data: pm1Data,
      borderColor: "#8b5cf6",
      backgroundColor: "rgba(139, 92, 246, 0.12)",
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#8b5cf6",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 7
    }];
  } else if (currentMetric === "pm10") {
    datasets = [{
      label: "PM10 (Coarse Dust) µg/m³",
      data: pm10Data,
      borderColor: "#d97706",
      backgroundColor: "rgba(217, 119, 6, 0.12)",
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#d97706",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 7
    }];
  } else if (currentMetric === "all") {
    datasets = [
      {
        label: "PM1.0",
        data: pm1Data,
        borderColor: "#8b5cf6",
        backgroundColor: "transparent",
        borderWidth: 2.2,
        tension: 0.35,
        pointRadius: 2.5
      },
      {
        label: "PM2.5",
        data: pm25Data,
        borderColor: "#0284c7",
        backgroundColor: "transparent",
        borderWidth: 2.8,
        tension: 0.35,
        pointRadius: 2.5
      },
      {
        label: "PM10",
        data: pm10Data,
        borderColor: "#d97706",
        backgroundColor: "transparent",
        borderWidth: 2.2,
        tension: 0.35,
        pointRadius: 2.5
      }
    ];
  }

  if (roomHistoryChart) {
    roomHistoryChart.data.labels = labels;
    roomHistoryChart.data.datasets = datasets;
    roomHistoryChart.options.scales.y.title.text = currentMetric === "dust" ? "Dust Condition (%)" : "Concentration (µg/m³)";
    if (currentMetric === "dust") {
      roomHistoryChart.options.scales.y.min = 0;
      roomHistoryChart.options.scales.y.max = 100;
      roomHistoryChart.options.scales.y.ticks.stepSize = 20;
    } else {
      delete roomHistoryChart.options.scales.y.max;
      delete roomHistoryChart.options.scales.y.ticks.stepSize;
    }
    roomHistoryChart.update();
  } else {
    roomHistoryChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: { 
            position: "top", 
            align: "end",
            labels: { 
              color: "#1e293b",
              font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
              padding: 14,
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 8,
              boxHeight: 8
            } 
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderWidth: 1,
            titleColor: "#ffffff",
            titleFont: { family: "'Inter', sans-serif", size: 12, weight: 700 },
            bodyColor: "#e2e8f0",
            bodyFont: { family: "'Inter', sans-serif", size: 11 },
            padding: 12,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: (item) => {
                const val = item.parsed.y;
                if (currentMetric === "dust") {
                  if (item.dataset.label.includes("Threshold")) {
                    return `${item.dataset.label}: ${val}%`;
                  }
                  let statusText = val >= 80 ? " (HIGH - Needs Cleaning)" : (val >= 40 ? " (MODERATE - Monitor)" : " (LOW - Normal)");
                  return `${item.dataset.label}: ${val}%${statusText}`;
                }
                return `${item.dataset.label}: ${val} µg/m³`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: currentMetric === "dust" ? 100 : undefined,
            title: { 
              display: true, 
              text: currentMetric === "dust" ? "Dust Condition (%)" : "Concentration (µg/m³)",
              color: "#1e293b",
              font: { family: "'Inter', sans-serif", size: 12, weight: 700 },
              padding: { bottom: 8 }
            },
            ticks: { 
              color: "#475569",
              font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
              stepSize: currentMetric === "dust" ? 20 : undefined,
              callback: (value) => currentMetric === "dust" ? `${value}%` : value
            },
            grid: { 
              color: "rgba(0, 0, 0, 0.06)",
              drawBorder: false
            }
          },
          x: { 
            ticks: { 
              color: "#475569",
              font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
              maxTicksLimit: 7,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              padding: 8
            },
            grid: { 
              color: "rgba(0, 0, 0, 0.04)",
              drawBorder: false
            } 
          }
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// Maintenance Logs Listener for Room
// -----------------------------------------------------------------------------
function listenToRoomMaintenance() {
  const mRef = ref(db, `maintenance/${sensorId}`);

  onValue(mRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const logs = [];
      Object.keys(data).forEach(k => {
        const item = data[k];
        if (item && typeof item === "object") logs.push(item);
      });

      if (logs.length > 0) {
        logs.sort((a, b) => new Date(b.service_date) - new Date(a.service_date));
        const latest = logs[0];
        if (DOM.roomLastCleaned) {
          DOM.roomLastCleaned.textContent = latest.service_date || "Date not recorded";
          DOM.roomLastCleaned.className = "m-status-value";
        }
        if (DOM.roomLastCleanedNotes) {
          DOM.roomLastCleanedNotes.textContent = latest.action_taken ? `${latest.action_taken} (${latest.performed_by || "Staff"})` : "Servicing performed";
        }
        if (DOM.roomNextSchedule && latest.service_date) {
          const nextDate = new Date(latest.service_date);
          nextDate.setDate(nextDate.getDate() + 30);
          DOM.roomNextSchedule.textContent = nextDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          DOM.roomNextSchedule.className = "m-status-value text-teal font-bold";
        }
        return;
      }
    }

    // Default clean state if no records have been logged by staff
    if (DOM.roomLastCleaned) {
      DOM.roomLastCleaned.textContent = "Cleaning date not recorded";
      DOM.roomLastCleaned.className = "m-status-value text-muted";
    }
    if (DOM.roomLastCleanedNotes) {
      DOM.roomLastCleanedNotes.textContent = "No maintenance record available";
    }
    if (DOM.roomNextSchedule) {
      DOM.roomNextSchedule.textContent = "Schedule not set";
      DOM.roomNextSchedule.className = "m-status-value text-muted";
    }
  });
}

// -----------------------------------------------------------------------------
// Metric Switcher Buttons
// -----------------------------------------------------------------------------
function setupMetricSwitcher() {
  const buttons = document.querySelectorAll(".btn-metric-toggle");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentMetric = btn.getAttribute("data-metric") || "dust";
      if (historicalRecords.length > 0) {
        renderHistoryChart();
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupMetricSwitcher();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      listenToLiveRoomSensor();
      listenToRoomHistory();
      listenToRoomMaintenance();
    }
  });

  signInAnonymously(auth).catch((err) => {
    console.error("Auth error in room.js:", err);
    listenToLiveRoomSensor();
    listenToRoomHistory();
    listenToRoomMaintenance();
  });
});
