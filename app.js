/**
 * ==============================================================================
 * AirSense - Real-Time Air Quality Monitoring Dashboard
 * ==============================================================================
 * Project: ESP32 + PMS5003 Air Quality Sensor Monitor
 * Backend: Firebase Realtime Database & Firebase Anonymous Authentication
 * Database Path: /sensors/sensor1
 * 
 * This script initializes Firebase, performs anonymous authentication,
 * and sets up a real-time listener (onValue) to automatically update
 * the UI whenever new sensor readings are received.
 */

// -----------------------------------------------------------------------------
// 1. Firebase Modular SDK Imports (Browser CDN)
// -----------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// -----------------------------------------------------------------------------
// 2. Firebase Configuration
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCBHaLqf5MqXBCJPsU1BJwqM6P2mi6AU-w",
  authDomain: "airsense-ba372.firebaseapp.com",
  databaseURL: "https://airsense-ba372-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "airsense-ba372",
  storageBucket: "airsense-ba372.firebasestorage.app",
  messagingSenderId: "409387199979",
  appId: "1:409387199979:web:8efa7cbb7c631f6a84bdae"
};

// -----------------------------------------------------------------------------
// 3. Initialize Firebase Services
// -----------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// -----------------------------------------------------------------------------
// 4. DOM Element References
// -----------------------------------------------------------------------------
const elements = {
  // Connection Badges & Alerts
  connectionBadge: document.getElementById("connectionBadge"),
  connectionText: document.getElementById("connectionText"),
  metaConnection: document.getElementById("metaConnection"),
  errorAlert: document.getElementById("errorAlert"),
  alertTitle: document.getElementById("alertTitle"),
  alertMessage: document.getElementById("alertMessage"),

  // PM Sensor Numerical Display
  pm1Value: document.getElementById("pm1Value"),
  pm25Value: document.getElementById("pm25Value"),
  pm10Value: document.getElementById("pm10Value"),

  // Meter Progress Bars
  pm1Bar: document.getElementById("pm1Bar"),
  pm25Bar: document.getElementById("pm25Bar"),
  pm10Bar: document.getElementById("pm10Bar"),

  // Air Quality Status Box
  aqiStatusBadge: document.getElementById("aqiStatusBadge"),
  aqiStatusText: document.getElementById("aqiStatusText"),
  adviceIcon: document.getElementById("adviceIcon"),
  adviceTitle: document.getElementById("adviceTitle"),
  adviceDetail: document.getElementById("adviceDetail"),

  // Metadata
  lastUpdatedText: document.getElementById("lastUpdatedText")
};

// -----------------------------------------------------------------------------
// 5. Status Determination & Health Advisory Helpers
// -----------------------------------------------------------------------------

/**
 * Categorize air quality based on the PM2.5 concentration level
 * Thresholds:
 *   0 - 12.0  : GOOD
 *  12.1 - 35.4 : MODERATE
 *  35.5 - 55.4 : UNHEALTHY
 *  55.5+       : VERY UNHEALTHY
 */
function getAirQualityCategory(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
    return {
      status: "AWAITING DATA",
      className: "status-neutral",
      icon: "⏳",
      title: "Waiting for Sensor Data",
      description: "Sensor data has not yet been received from Firebase."
    };
  }

  const value = Number(pm25);

  if (value <= 12.0) {
    return {
      status: "GOOD",
      className: "status-good",
      icon: "🌿",
      title: "Air Quality is Great",
      description: "Air pollution poses little or no health risk. Ideal conditions for outdoor activities."
    };
  } else if (value <= 35.4) {
    return {
      status: "MODERATE",
      className: "status-moderate",
      icon: "🌤️",
      title: "Air Quality is Moderate",
      description: "Air quality is acceptable. Very sensitive individuals may consider reducing prolonged outdoor exertion."
    };
  } else if (value <= 55.4) {
    return {
      status: "UNHEALTHY",
      className: "status-unhealthy",
      icon: "😷",
      title: "Air Quality is Unhealthy",
      description: "Sensitive groups (asthma, children, elderly) should limit outdoor exposure. Wear a mask if needed."
    };
  } else {
    return {
      status: "VERY UNHEALTHY",
      className: "status-very-unhealthy",
      icon: "⚠️",
      title: "Air Quality is Very Unhealthy",
      description: "Health alert: The risk of health effects is increased for everyone. Avoid prolonged outdoor activities."
    };
  }
}

/**
 * Formats timestamps gracefully.
 * Handles:
 * - Real epoch timestamps (milliseconds or seconds)
 * - ISO date strings
 * - ESP32 millis() values (milliseconds since board boot)
 * - Missing or invalid values
 */
function formatTimestamp(rawTimestamp) {
  if (rawTimestamp === null || rawTimestamp === undefined || rawTimestamp === "") {
    return "Recently updated";
  }

  // If it's a numeric timestamp
  if (typeof rawTimestamp === "number" || (!isNaN(Number(rawTimestamp)) && !String(rawTimestamp).includes("-") && !String(rawTimestamp).includes(":"))) {
    let num = Number(rawTimestamp);

    // If in seconds (10 digits around year 2020+), convert to milliseconds
    if (num > 1500000000 && num < 9999999999) {
      num = num * 1000;
    }

    // Check if it represents a realistic calendar date (between 2020 and 2035)
    const minEpoch = 1577836800000; // Jan 1 2020
    const maxEpoch = 2051222400000; // Jan 1 2035

    if (num >= minEpoch && num <= maxEpoch) {
      const date = new Date(num);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      }) + " at " + date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }

    // Otherwise, the number is likely ESP32 millis() since boot
    const totalSeconds = Math.floor(num / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `Recently updated (${hours}h ${minutes % 60}m active)`;
    } else if (minutes > 0) {
      return `Recently updated (${minutes}m ${seconds}s active)`;
    } else {
      return `Recently updated (${seconds}s active)`;
    }
  }

  // If it's an ISO date string or formatted date string
  const parsedDate = new Date(rawTimestamp);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }) + " at " + parsedDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  return "Recently updated";
}

// -----------------------------------------------------------------------------
// 6. UI Update Functions
// -----------------------------------------------------------------------------

/**
 * Updates the connection status badge in the header and metadata strip
 */
function setConnectionStatus(status, message = null) {
  // Reset badge classes
  elements.connectionBadge.className = `status-badge ${status.toLowerCase()}`;
  elements.connectionText.textContent = status.toUpperCase();

  if (status.toUpperCase() === "ONLINE") {
    elements.metaConnection.textContent = "ONLINE";
    elements.metaConnection.className = "meta-value connection-state online";
    hideAlert();
  } else if (status.toUpperCase() === "CONNECTING") {
    elements.metaConnection.textContent = "CONNECTING";
    elements.metaConnection.className = "meta-value connection-state";
  } else {
    elements.metaConnection.textContent = "OFFLINE";
    elements.metaConnection.className = "meta-value connection-state";
    if (message) {
      showAlert("Firebase Connection Notice", message);
    }
  }
}

/**
 * Shows an alert banner with a friendly error/warning message
 */
function showAlert(title, message) {
  elements.alertTitle.textContent = title;
  elements.alertMessage.textContent = message;
  elements.errorAlert.classList.remove("hidden");
}

/**
 * Hides the alert banner
 */
function hideAlert() {
  elements.errorAlert.classList.add("hidden");
}

/**
 * Updates all sensor cards and the overall AQI status section
 */
function updateDashboardUI(data) {
  if (!data) {
    console.warn("Received empty data payload from Firebase");
    return;
  }

  // Parse sensor readings (PMS5003 values)
  const pm1 = data.pm1_0 !== undefined ? Number(data.pm1_0) : null;
  const pm25 = data.pm2_5 !== undefined ? Number(data.pm2_5) : null;
  const pm10 = data.pm10 !== undefined ? Number(data.pm10) : null;
  const rawTimestamp = data.timestamp;

  // 1. Update PM1.0
  if (pm1 !== null && !isNaN(pm1)) {
    elements.pm1Value.textContent = Math.round(pm1);
    const pm1Percent = Math.min(100, Math.max(0, (pm1 / 60) * 100));
    elements.pm1Bar.style.width = `${pm1Percent}%`;
  } else {
    elements.pm1Value.textContent = "--";
    elements.pm1Bar.style.width = "0%";
  }

  // 2. Update PM2.5 (Primary)
  if (pm25 !== null && !isNaN(pm25)) {
    elements.pm25Value.textContent = Math.round(pm25);
    const pm25Percent = Math.min(100, Math.max(0, (pm25 / 75) * 100));
    elements.pm25Bar.style.width = `${pm25Percent}%`;
  } else {
    elements.pm25Value.textContent = "--";
    elements.pm25Bar.style.width = "0%";
  }

  // 3. Update PM10
  if (pm10 !== null && !isNaN(pm10)) {
    elements.pm10Value.textContent = Math.round(pm10);
    const pm10Percent = Math.min(100, Math.max(0, (pm10 / 150) * 100));
    elements.pm10Bar.style.width = `${pm10Percent}%`;
  } else {
    elements.pm10Value.textContent = "--";
    elements.pm10Bar.style.width = "0%";
  }

  // 4. Determine and update overall Air Quality Status based on PM2.5
  const aqiInfo = getAirQualityCategory(pm25);
  elements.aqiStatusBadge.className = `aqi-badge ${aqiInfo.className}`;
  elements.aqiStatusText.textContent = aqiInfo.status;
  elements.adviceIcon.textContent = aqiInfo.icon;
  elements.adviceTitle.textContent = aqiInfo.title;
  elements.adviceDetail.textContent = aqiInfo.description;

  // 5. Update timestamp
  elements.lastUpdatedText.textContent = formatTimestamp(rawTimestamp);
}

// -----------------------------------------------------------------------------
// 7. Firebase Authentication & Realtime Listener Setup
// -----------------------------------------------------------------------------

/**
 * Attaches the Firebase Realtime Database listener on /sensors/sensor1
 */
function attachSensorListener() {
  const sensorRef = ref(db, "sensors/sensor1");

  console.log("Subscribing to real-time updates at /sensors/sensor1");

  onValue(
    sensorRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const sensorData = snapshot.val();
        console.log("Live sensor data received:", sensorData);
        setConnectionStatus("ONLINE");
        updateDashboardUI(sensorData);
      } else {
        console.warn("Sensor node /sensors/sensor1 exists but contains no data yet.");
        setConnectionStatus("ONLINE");
        elements.lastUpdatedText.textContent = "No data recorded at /sensors/sensor1 yet";
      }
    },
    (error) => {
      console.error("Firebase Realtime Database Error:", error);
      setConnectionStatus("OFFLINE", `Database read failed: ${error.message}. Please check Firebase Security Rules.`);
    }
  );

  // Monitor Firebase internal connection status (.info/connected)
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      console.log("Connected to Firebase Realtime Database server.");
      setConnectionStatus("ONLINE");
    } else {
      console.log("Disconnected from Firebase Realtime Database server.");
      setConnectionStatus("OFFLINE", "Disconnected from server. Reconnecting automatically...");
    }
  });
}

/**
 * Initializes Authentication and starts listening
 */
function startMonitoring() {
  setConnectionStatus("CONNECTING");

  // Track auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Authenticated anonymously with UID:", user.uid);
      attachSensorListener();
    }
  });

  // Perform Anonymous Authentication
  signInAnonymously(auth)
    .then((userCredential) => {
      console.log("Signed in anonymously:", userCredential.user.uid);
    })
    .catch((error) => {
      console.error("Authentication Error:", error);
      setConnectionStatus("OFFLINE", `Anonymous Sign-in failed: ${error.message}. Ensure Anonymous Auth is enabled in Firebase Console.`);
    });
}

// -----------------------------------------------------------------------------
// 8. Start Application on DOM Ready
// -----------------------------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMonitoring);
} else {
  startMonitoring();
}
