/**
 * ==============================================================================
 * AirSense - Analytics & Historical Telemetry Engine (Redesigned)
 * ==============================================================================
 * Easy-to-read historical trends with Day 1, Day 2, Day 3... labels
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
  sensor1: { name: "Room 1", label: "Office AC Unit 1" },
  sensor2: { name: "Room 2", label: "Office AC Unit 2" },
  sensor3: { name: "Room 3", label: "Office AC Unit 3" },
  sensor4: { name: "Room 4", label: "Office AC Unit 4" }
};

const urlParams = new URLSearchParams(window.location.search);
const sensorId = urlParams.get("sensor_id") || window.ACTIVE_SENSOR_ID || "sensor1";
const activeRoom = roomsConfig[sensorId] || roomsConfig.sensor1;

// Dynamically update headings
if (document.getElementById("pageTitle")) document.getElementById("pageTitle").textContent = `AirSense | ${activeRoom.name} Historical Trends & Analytics`;
if (document.getElementById("analyticsTitle")) document.getElementById("analyticsTitle").textContent = `Dust Condition & PM2.5 Trends: ${activeRoom.name}`;
if (document.getElementById("analyticsDesc")) document.getElementById("analyticsDesc").innerHTML = `Visualizing long-term particulate patterns at the AC air intake for <strong>${activeRoom.name} (${activeRoom.label})</strong> to distinguish temporary sensor spikes from persistent conditions.`;
if (document.getElementById("sensorSelect")) document.getElementById("sensorSelect").value = sensorId;

// UI Elements
const avgDustEl = document.getElementById("statAvgDust");
const maxDustEl = document.getElementById("statMaxDust");
const alertCountEl = document.getElementById("statAlertCount");
const accumRateEl = document.getElementById("statAccumRate");

let dustTrendChartInstance = null;
let pmTrendChartInstance = null;
let allRecords = [];
let currentDaysFilter = 7;

// Global function for time range buttons
window.changeTimeRange = function(days) {
  currentDaysFilter = days;

  // Update button states
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-days') == days) {
      btn.classList.add('active');
    }
  });

  // Re-render charts with filtered data
  if (allRecords.length > 0) {
    updateAnalyticsCharts(allRecords);
  }
};

// -----------------------------------------------------------------------------
// Format Day Labels (Day 1, Day 2, etc.)
// -----------------------------------------------------------------------------
function formatDayLabel(timestamp, allTimestamps) {
  if (!timestamp) return "Day ?";

  const num = Number(timestamp);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);

  if (isNaN(dateObj.getTime())) return "Day ?";

  // Find the earliest timestamp to calculate day numbers
  const earliestTimestamp = Math.min(...allTimestamps);
  const earliestDate = new Date(earliestTimestamp > 1500000000 && earliestTimestamp < 9999999999 ? earliestTimestamp * 1000 : earliestTimestamp);

  // Calculate day difference
  const daysDiff = Math.floor((dateObj - earliestDate) / (1000 * 60 * 60 * 24));
  const dayNumber = daysDiff + 1;

  return `Day ${dayNumber}`;
}

// Format full date for tooltips
function formatFullDate(timestamp) {
  if (!timestamp) return "Unknown";
  const num = Number(timestamp);
  const dateObj = new Date(num > 1500000000 && num < 9999999999 ? num * 1000 : num);
  if (isNaN(dateObj.getTime())) return "Unknown";
  return dateObj.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Get status badge
function getStatusBadge(dustPercentage) {
  if (dustPercentage < 40) {
    return '<span class="status-badge status-low">Low</span>';
  } else if (dustPercentage < 80) {
    return '<span class="status-badge status-moderate">Moderate</span>';
  } else {
    return '<span class="status-badge status-high">High</span>';
  }
}

// Get status color
function getStatusColor(dustPercentage) {
  if (dustPercentage < 40) return '#059669';
  else if (dustPercentage < 80) return '#f59e0b';
  else return '#dc2626';
}

// -----------------------------------------------------------------------------
// Populate Daily Readings Table
// -----------------------------------------------------------------------------
function populateDailyReadingsTable(records) {
  const tableBody = document.getElementById('readingsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (records.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">No historical data available</td></tr>';
    return;
  }

  const timestamps = records.map(r => r.timestamp);

  records.forEach((record, index) => {
    const row = document.createElement('tr');
    const dayLabel = formatDayLabel(record.timestamp, timestamps);
    const fullDate = formatFullDate(record.timestamp);
    const dateObj = new Date(record.timestamp > 1500000000 && record.timestamp < 9999999999 ? record.timestamp * 1000 : record.timestamp);

    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    row.innerHTML = `
      <td class="day-label"><strong>${dayLabel}</strong></td>
      <td>${dateStr}</td>
      <td>${timeStr}</td>
      <td><span style="color: ${getStatusColor(record.dust_percentage)}; font-weight: 700; font-size: 1.125rem;">${record.dust_percentage.toFixed(1)}%</span></td>
      <td>${record.pm2_5.toFixed(1)}</td>
      <td>${record.pm1_0.toFixed(1)}</td>
      <td>${record.pm10.toFixed(1)}</td>
      <td>${getStatusBadge(record.dust_percentage)}</td>
    `;

    tableBody.appendChild(row);
  });
}

// -----------------------------------------------------------------------------
// Render / Update Charts with Day Labels
// -----------------------------------------------------------------------------
function updateAnalyticsCharts(records) {
  if (!records || records.length === 0) return;

  // Filter records based on selected time range
  let filteredRecords = records;
  if (currentDaysFilter !== 'all') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - currentDaysFilter);
    const cutoffTimestamp = cutoffDate.getTime();

    filteredRecords = records.filter(r => {
      const recordTime = r.timestamp > 1500000000 && r.timestamp < 9999999999 ? r.timestamp * 1000 : r.timestamp;
      return recordTime >= cutoffTimestamp;
    });
  }

  if (filteredRecords.length === 0) {
    filteredRecords = records.slice(-7); // Show at least last 7 records
  }

  const timestamps = filteredRecords.map(r => r.timestamp);
  const labels = filteredRecords.map(r => formatDayLabel(r.timestamp, timestamps));
  const fullDates = filteredRecords.map(r => formatFullDate(r.timestamp));

  const dustData = filteredRecords.map(r => Number(r.dust_percentage.toFixed(1)));
  const pm1Data = filteredRecords.map(r => Number(r.pm1_0.toFixed(1)));
  const pm25Data = filteredRecords.map(r => Number(r.pm2_5.toFixed(1)));
  const pm10Data = filteredRecords.map(r => Number(r.pm10.toFixed(1)));

  // Calculate KPIs
  const sumDust = dustData.reduce((a, b) => a + b, 0);
  const avgDust = (sumDust / dustData.length).toFixed(1);
  const maxDust = Math.max(...dustData).toFixed(1);
  const highPointsCount = dustData.filter(d => d >= 80).length;

  let trendTrajectory = "Stable Condition";
  if (dustData.length >= 2) {
    const diff = dustData[dustData.length - 1] - dustData[0];
    if (diff > 5) trendTrajectory = "↗ Increasing";
    else if (diff < -5) trendTrajectory = "↘ Decreasing";
    else if (highPointsCount > 0 && dustData[dustData.length - 1] < 80) trendTrajectory = "⚡ Temporary Spike";
    else trendTrajectory = "→ Stable";
  }

  if (avgDustEl) avgDustEl.textContent = `${avgDust}%`;
  if (maxDustEl) maxDustEl.textContent = `${maxDust}%`;
  if (alertCountEl) alertCountEl.textContent = `${highPointsCount} hrs`;
  if (accumRateEl) accumRateEl.textContent = trendTrajectory;

  // Populate table
  populateDailyReadingsTable(filteredRecords);

  // 1. Chart 1: Dust Condition Trend with Day Labels
  const ctxDust = document.getElementById("dustTrendChart")?.getContext("2d");
  if (ctxDust) {
    if (dustTrendChartInstance) {
      dustTrendChartInstance.destroy();
    }

    dustTrendChartInstance = new Chart(ctxDust, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Dust Condition (%)",
            data: dustData,
            borderColor: "#2d6e52",
            backgroundColor: "rgba(45, 110, 82, 0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: dustData.map(d => getStatusColor(d)),
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: "80% High Threshold",
            data: labels.map(() => 80),
            borderColor: "#dc2626",
            borderDash: [8, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: "40% Moderate Threshold",
            data: labels.map(() => 40),
            borderColor: "#f59e0b",
            borderDash: [6, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#1f2937",
              font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            borderColor: "#2d6e52",
            borderWidth: 2,
            titleColor: "#1f2937",
            bodyColor: "#4b5563",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (ctx) => `${ctx[0].label} - ${fullDates[ctx[0].dataIndex]}`,
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
              afterLabel: (ctx) => {
                if (ctx.datasetIndex === 0) {
                  const val = ctx.parsed.y;
                  if (val < 40) return 'Status: Low - Normal condition';
                  else if (val < 80) return 'Status: Moderate - Monitor closely';
                  else return 'Status: High - Requires attention';
                }
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: "Dust Condition (%)",
              color: "#4b5563",
              font: { size: 13, weight: 600 }
            },
            ticks: {
              color: "#6b7280",
              font: { size: 11, weight: 600 },
              callback: (value) => value + '%'
            },
            grid: { color: "rgba(0, 0, 0, 0.06)" }
          },
          x: {
            title: {
              display: true,
              text: "Timeline (Days)",
              color: "#4b5563",
              font: { size: 13, weight: 600 }
            },
            ticks: {
              color: "#1f2937",
              font: { size: 12, weight: 700 },
              maxRotation: 45,
              minRotation: 0
            },
            grid: { color: "rgba(0, 0, 0, 0.04)" }
          }
        }
      }
    });
  }

  // 2. Chart 2: PM2.5 and Particulate Spectrum with Day Labels
  const ctxPM = document.getElementById("pmTrendChart")?.getContext("2d");
  if (ctxPM) {
    if (pmTrendChartInstance) {
      pmTrendChartInstance.destroy();
    }

    pmTrendChartInstance = new Chart(ctxPM, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "PM2.5 (Reference Driver)",
            data: pm25Data,
            borderColor: "#2d6e52",
            backgroundColor: "rgba(45, 110, 82, 0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#2d6e52",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: "PM1.0 (Ultra-Fine)",
            data: pm1Data,
            borderColor: "#9333ea",
            backgroundColor: "transparent",
            borderWidth: 2.5,
            tension: 0.4,
            pointBackgroundColor: "#9333ea",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: "PM10 (Coarse Dust)",
            data: pm10Data,
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderWidth: 2.5,
            tension: 0.4,
            pointBackgroundColor: "#f59e0b",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#1f2937",
              font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            borderColor: "#2d6e52",
            borderWidth: 2,
            titleColor: "#1f2937",
            bodyColor: "#4b5563",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (ctx) => `${ctx[0].label} - ${fullDates[ctx[0].dataIndex]}`,
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} µg/m³`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            title: {
              display: true,
              text: "Concentration (µg/m³)",
              color: "#4b5563",
              font: { size: 13, weight: 600 }
            },
            ticks: {
              color: "#6b7280",
              font: { size: 11, weight: 600 }
            },
            grid: { color: "rgba(0, 0, 0, 0.06)" }
          },
          x: {
            title: {
              display: true,
              text: "Timeline (Days)",
              color: "#4b5563",
              font: { size: 13, weight: 600 }
            },
            ticks: {
              color: "#1f2937",
              font: { size: 12, weight: 700 },
              maxRotation: 45,
              minRotation: 0
            },
            grid: { color: "rgba(0, 0, 0, 0.04)" }
          }
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// Load Historical Data from Firebase /history/{sensorId}/
// -----------------------------------------------------------------------------
function loadFirebaseHistory() {
  const historyPath = `history/${sensorId}`;
  const historyRef = ref(db, historyPath);

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
      allRecords = records;

      if (records.length > 0) {
        updateAnalyticsCharts(records);
      }
    }
  }, (err) => {
    console.warn("Firebase history read warning:", err);
  });
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) loadFirebaseHistory();
  });
  signInAnonymously(auth).catch((err) => {
    console.error("Auth error on analytics:", err);
    loadFirebaseHistory();
  });
});
