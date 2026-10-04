/**
 * ==============================================================================
 * AirSense - Maintenance Management Engine (maintenance.js)
 * ==============================================================================
 * Connects to Firebase Realtime Database (/maintenance_logs/) & local storage
 * to record and display AC servicing history without requiring PHP/MySQL.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// Extract query param if pre-selected
const urlParams = new URLSearchParams(window.location.search);
const targetSensor = urlParams.get("sensor_id") || urlParams.get("sensorId") || urlParams.get("sensor") || "";
const hasSensorFilter = Boolean(targetSensor && roomsConfig[targetSensor]);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("maintenanceForm");
  const sensorSelect = document.getElementById("sensor_id");
  const topSensorSelect = document.getElementById("sensorSelect");
  const alertBox = document.getElementById("alertBox");
  const tableBody = document.getElementById("maintTableBody");
  const serviceDateInput = document.getElementById("service_date");

  if (serviceDateInput) {
    serviceDateInput.value = new Date().toISOString().split("T")[0];
  }

  if (sensorSelect && targetSensor && roomsConfig[targetSensor]) {
    sensorSelect.value = targetSensor;
  }
  if (topSensorSelect && targetSensor && roomsConfig[targetSensor]) {
    topSensorSelect.value = targetSensor;
  }

  // Show selected-unit banner when filtered by ?sensor_id=
  if (hasSensorFilter) {
    const info = roomsConfig[targetSensor];
    const banner = document.getElementById("maintUnitBanner");
    const title = document.getElementById("maintUnitTitle");
    const desc = document.getElementById("maintUnitDesc");
    if (banner) banner.classList.remove("hidden");
    if (title) title.textContent = `${info.name} Maintenance Logs`;
    if (desc) desc.innerHTML = `Showing servicing history filtered to <strong>${info.name} (${info.label})</strong>. Remove the filter to view all units.`;
  }

  // Listen to Firebase /maintenance_logs/
  const logsRef = ref(db, "maintenance_logs");
  onValue(logsRef, (snapshot) => {
    const data = snapshot.val();
    const logs = [];
    if (data) {
      Object.keys(data).forEach(key => {
        logs.push({ id: key, ...data[key] });
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.service_date || b.timestamp) - new Date(a.service_date || a.timestamp));
    }
    renderLogsTable(logs);
  }, (err) => {
    console.warn("Firebase logs read error, fallback to localStorage:", err);
    const localLogs = JSON.parse(localStorage.getItem("airsense_maintenance_logs") || "[]");
    renderLogsTable(localLogs);
  });

  // Handle Form Submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const selectedUnit = sensorSelect.value;
      const unitInfo = roomsConfig[selectedUnit] || { name: selectedUnit, label: "AC Unit" };
      const dustBefore = parseFloat(document.getElementById("dust_level_before").value) || 0;
      const actionTaken = document.getElementById("action_taken").value;
      const notes = document.getElementById("notes").value;
      const techName = document.getElementById("technician_name").value;
      const serviceDate = serviceDateInput.value;

      const newLog = {
        sensor_id: selectedUnit,
        ac_unit: `${unitInfo.name} (${unitInfo.label})`,
        service_date: serviceDate,
        dust_level_before: dustBefore,
        action_taken: actionTaken,
        performed_by: techName,
        notes: notes,
        timestamp: Date.now()
      };

      try {
        // Save to Firebase
        const newLogRef = push(logsRef);
        await set(newLogRef, newLog);

        // Also save to localStorage as backup
        const existing = JSON.parse(localStorage.getItem("airsense_maintenance_logs") || "[]");
        existing.unshift(newLog);
        localStorage.setItem("airsense_maintenance_logs", JSON.stringify(existing));

        showAlert("Maintenance record saved successfully to Firebase!", "success");
        form.reset();
        serviceDateInput.value = new Date().toISOString().split("T")[0];
        sensorSelect.value = selectedUnit;
      } catch (err) {
        console.error("Save error:", err);
        // Fallback localStorage
        const existing = JSON.parse(localStorage.getItem("airsense_maintenance_logs") || "[]");
        existing.unshift(newLog);
        localStorage.setItem("airsense_maintenance_logs", JSON.stringify(existing));
        renderLogsTable(existing);
        showAlert("Maintenance record saved locally.", "success");
      }
    });
  }

  function showAlert(msg, type) {
    if (!alertBox) return;
    alertBox.className = `alert-box ${type}`;
    alertBox.innerHTML = `<span class="icon">${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
    alertBox.classList.remove("hidden");
    setTimeout(() => {
      alertBox.classList.add("hidden");
    }, 5000);
  }

  function renderLogsTable(logs) {
    if (!tableBody) return;
    const visible = hasSensorFilter ? (logs || []).filter((l) => (l.sensor_id || "") === targetSensor) : (logs || []);
    if (!visible || visible.length === 0) {
      tableBody.innerHTML = hasSensorFilter
        ? `<tr><td colspan="6" class="text-center empty-state">No maintenance records for ${roomsConfig[targetSensor].name} yet.</td></tr>`
        : `<tr><td colspan="6" class="text-center empty-state">No maintenance records logged yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = visible.map(log => {
      const dustVal = Number(log.dust_level_before) || 0;
      const pillClass = dustVal >= 80 ? "high" : (dustVal >= 40 ? "moderate" : "low");
      const formattedDate = log.service_date ? new Date(log.service_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

      return `
        <tr>
          <td class="font-medium">${formattedDate}</td>
          <td>${log.ac_unit || log.sensor_id}</td>
          <td><span class="badge-action">${log.action_taken}</span></td>
          <td><span class="dust-pill ${pillClass}">${dustVal.toFixed(1)}%</span></td>
          <td>${log.performed_by || "Technician"}</td>
          <td class="cell-notes" title="${log.notes || ""}">${log.notes || "—"}</td>
        </tr>
      `;
    }).join("");
  }
});

// Authenticate anonymously
signInAnonymously(auth).catch(() => {});
