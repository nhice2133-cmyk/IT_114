
#include <WiFi.h>
#include <HardwareSerial.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

// Firebase helper libraries
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// =====================================================
// WI-FI SETTINGS
// =====================================================

const char* ssid = "Sinjirosinju";
const char* password = "12345678";

// =====================================================
// FIREBASE SETTINGS
// =====================================================

#define API_KEY "AIzaSyCBHaLqf5MqXBCJPsU1BJwqM6P2mi6AU-w"
#define DATABASE_URL "https://airsense-ba372-default-rtdb.asia-southeast1.firebasedatabase.app"

// =====================================================
// FIREBASE OBJECTS
// =====================================================

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// =====================================================
// PMS5003
// =====================================================

// PMS5003 TX -> ESP32 GPIO16 RX
// PMS5003 RX -> ESP32 GPIO17 TX

HardwareSerial pmsSerial(2);

// =====================================================
// SENSOR ID
// =====================================================

// For your first device use sensor1.
// Later devices can use sensor2, sensor3, sensor4.

const char* SENSOR_ID = "sensor1";

// =====================================================
// DUST CONDITION SETTINGS
// =====================================================

// Capstone reference range
// PM2.5 = 0 to 500 ug/m3

const float PM25_REFERENCE_MAX = 500.0;

// 80% remains the HIGH condition threshold

const float HIGH_THRESHOLD = 80.0;

// =====================================================
// SENSOR AVERAGING
// =====================================================

// 12 valid PMS5003 readings are averaged.

const int AVERAGE_SAMPLES = 12;

// =====================================================
// FIREBASE TIMING
// =====================================================

// Current sensor information sent every 1 minute.
const unsigned long CURRENT_DATA_INTERVAL = 60000;

// Historical information saved every 15 minutes.
const unsigned long HISTORY_INTERVAL = 900000;

// =====================================================
// LONG-TERM HIGH CONDITION
// =====================================================
//
// A temporary high reading should NOT trigger maintenance.
// The system checks the condition every hour.
// A HIGH condition must persist for 24 hourly checks 
// before maintenance is recommended.
//
// =====================================================

const int REQUIRED_HIGH_HOURS = 24;
const unsigned long HIGH_CHECK_INTERVAL = 3600000;

// =====================================================
// DAILY SUMMARY
// =====================================================
//
// The system keeps track of readings during the current day.
// The daily summary is uploaded periodically.
//
// =====================================================

const unsigned long DAILY_SUMMARY_INTERVAL = 3600000;

// =====================================================
// VARIABLES
// =====================================================

unsigned long lastCurrentDataSend = 0;
unsigned long lastHistorySend = 0;
unsigned long lastHighCheck = 0;
unsigned long lastDailySummarySend = 0;

bool firebaseSignupOK = false;

// SENSOR AVERAGING
long pm1Sum = 0;
long pm25Sum = 0;
long pm10Sum = 0;
int sampleCount = 0;

// CURRENT SENSOR VALUES
int currentPM1 = 0;
int currentPM25 = 0;
int currentPM10 = 0;
float currentDustPercentage = 0.0;
String currentStatus = "LOW";
unsigned long currentTimestamp = 0;

// LONG-TERM CONDITION
int highConditionHours = 0;
bool maintenanceAlert = false;

// DAILY DATA
long dailyPM1Sum = 0;
long dailyPM25Sum = 0;
long dailyPM10Sum = 0;
float dailyDustSum = 0.0;
int dailySamples = 0;
float dailyAveragePM25 = 0.0;
float dailyAverageDust = 0.0;
String currentDate = "";

// =====================================================
// FUNCTION: GET UNIX TIMESTAMP
// =====================================================

unsigned long getTimestamp() {
  time_t now;
  time(&now);
  return (unsigned long)now;
}

// =====================================================
// FUNCTION: GET CURRENT DATE
// =====================================================

String getCurrentDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "unknown";
  }
  char dateBuffer[11];
  strftime(dateBuffer, sizeof(dateBuffer), "%Y-%m-%d", &timeinfo);
  return String(dateBuffer);
}

// =====================================================
// FUNCTION: CALCULATE DUST CONDITION
// =====================================================

float calculateDustPercentage(int pm25) {
  float percentage = ((float)pm25 / PM25_REFERENCE_MAX) * 100.0;
  if (percentage < 0.0) percentage = 0.0;
  if (percentage > 100.0) percentage = 100.0;
  return percentage;
}

// =====================================================
// FUNCTION: DETERMINE STATUS
// =====================================================

String determineStatus(float percentage) {
  if (percentage >= 80.0) {
    return "HIGH";
  } else if (percentage >= 40.0) {
    return "MODERATE";
  } else {
    return "LOW";
  }
}

// =====================================================
// FUNCTION: UPDATE DAILY DATA
// =====================================================

void updateDailyData() {
  String newDate = getCurrentDate();

  // Detect a new day.
  if (currentDate != "" && newDate != currentDate) {
    Serial.println("\nNew day detected.");
    Serial.println("Resetting daily statistics.");

    dailyPM1Sum = 0;
    dailyPM25Sum = 0;
    dailyPM10Sum = 0;
    dailyDustSum = 0.0;
    dailySamples = 0;
  }

  currentDate = newDate;

  // Add current reading.
  dailyPM1Sum += currentPM1;
  dailyPM25Sum += currentPM25;
  dailyPM10Sum += currentPM10;
  dailyDustSum += currentDustPercentage;
  dailySamples++;

  // Calculate daily averages.
  if (dailySamples > 0) {
    dailyAveragePM25 = (float)dailyPM25Sum / dailySamples;
    dailyAverageDust = dailyDustSum / dailySamples;
  }
}

// =====================================================
// FUNCTION: UPDATE LONG-TERM CONDITION
// =====================================================

void updateLongTermCondition() {
  if (millis() - lastHighCheck < HIGH_CHECK_INTERVAL) {
    return;
  }

  lastHighCheck = millis();

  Serial.println("\n========== LONG-TERM CONDITION CHECK ==========");

  if (currentDustPercentage >= HIGH_THRESHOLD) {
    highConditionHours++;

    Serial.print("Persistent HIGH period: ");
    Serial.print(highConditionHours);
    Serial.print("/");
    Serial.println(REQUIRED_HIGH_HOURS);

    if (highConditionHours >= REQUIRED_HIGH_HOURS) {
      maintenanceAlert = true;
      Serial.println("\nMAINTENANCE INSPECTION RECOMMENDED");
      Serial.println("Persistent HIGH dust condition detected.");
    }
  } else {
    Serial.println("Current condition is below 80%.");
    Serial.println("Persistent HIGH counter reset.");

    highConditionHours = 0;
    maintenanceAlert = false;
  }

  Serial.println("================================================");
}

// =====================================================
// FUNCTION: SEND CURRENT DATA
// =====================================================

void sendCurrentData() {
  if (!firebaseSignupOK || !Firebase.ready()) {
    Serial.println("Firebase is not ready.");
    return;
  }

  String basePath = "/sensors/";
  basePath += SENSOR_ID;

  Serial.println("\nUpdating current Firebase data...");

  Firebase.RTDB.setInt(&fbdo, basePath + "/pm1_0", currentPM1);
  Firebase.RTDB.setInt(&fbdo, basePath + "/pm2_5", currentPM25);
  Firebase.RTDB.setInt(&fbdo, basePath + "/pm10", currentPM10);
  Firebase.RTDB.setFloat(&fbdo, basePath + "/dust_percentage", currentDustPercentage);
  Firebase.RTDB.setString(&fbdo, basePath + "/status", currentStatus);
  Firebase.RTDB.setBool(&fbdo, basePath + "/maintenance_alert", maintenanceAlert);
  Firebase.RTDB.setInt(&fbdo, basePath + "/high_condition_hours", highConditionHours);
  Firebase.RTDB.setFloat(&fbdo, basePath + "/daily_average_pm25", dailyAveragePM25);
  Firebase.RTDB.setFloat(&fbdo, basePath + "/daily_average_dust", dailyAverageDust);
  Firebase.RTDB.setString(&fbdo, basePath + "/current_date", currentDate);
  Firebase.RTDB.setInt(&fbdo, basePath + "/timestamp", currentTimestamp);

  Serial.println("Current Firebase data updated.");
}

// =====================================================
// FUNCTION: SAVE HISTORY
// =====================================================

void saveHistory() {
  if (!firebaseSignupOK || !Firebase.ready()) {
    return;
  }

  String historyPath = "/history/";
  historyPath += SENSOR_ID;

  FirebaseJson historyData;
  historyData.set("pm1_0", currentPM1);
  historyData.set("pm2_5", currentPM25);
  historyData.set("pm10", currentPM10);
  historyData.set("dust_percentage", currentDustPercentage);
  historyData.set("status", currentStatus);
  historyData.set("maintenance_alert", maintenanceAlert);
  historyData.set("high_condition_hours", highConditionHours);
  historyData.set("timestamp", currentTimestamp);

  if (Firebase.RTDB.pushJSON(&fbdo, historyPath, &historyData)) {
    Serial.println("Historical reading: SUCCESS");
  } else {
    Serial.print("Historical reading: FAILED - ");
    Serial.println(fbdo.errorReason());
  }
}

// =====================================================
// FUNCTION: SAVE DAILY SUMMARY
// =====================================================

void saveDailySummary() {
  if (!firebaseSignupOK || !Firebase.ready()) {
    return;
  }

  if (dailySamples <= 0) {
    Serial.println("No daily samples available.");
    return;
  }

  String path = "/daily_summary/";
  path += SENSOR_ID;
  path += "/";
  path += currentDate;

  FirebaseJson dailyData;
  dailyData.set("average_pm1_0", (float)dailyPM1Sum / dailySamples);
  dailyData.set("average_pm2_5", dailyAveragePM25);
  dailyData.set("average_pm10", (float)dailyPM10Sum / dailySamples);
  dailyData.set("dust_percentage", dailyAverageDust);
  dailyData.set("status", determineStatus(dailyAverageDust));
  dailyData.set("high_condition_hours", highConditionHours);
  dailyData.set("maintenance_alert", maintenanceAlert);
  dailyData.set("sample_count", dailySamples);
  dailyData.set("timestamp", currentTimestamp);

  if (Firebase.RTDB.setJSON(&fbdo, path, &dailyData)) {
    Serial.println("\nDaily summary: SUCCESS");
    Serial.print("Date: ");
    Serial.println(currentDate);
  } else {
    Serial.print("Daily summary: FAILED - ");
    Serial.println(fbdo.errorReason());
  }
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);

  // START PMS5003
  pmsSerial.begin(9600, SERIAL_8N1, 16, 17);

  Serial.println("\n============================================");
  Serial.println("          AIRSENSE ESP32 SYSTEM");
  Serial.println("============================================\n");

  Serial.print("Sensor ID: ");
  Serial.println(SENSOR_ID);

  // WI-FI
  Serial.println("\nConnecting to Wi-Fi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Wi-Fi RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");

  // TIME SYNCHRONIZATION
  Serial.println("\nSynchronizing time...");
  configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  delay(2000);

  currentDate = getCurrentDate();
  currentTimestamp = getTimestamp();

  Serial.print("Current Date: ");
  Serial.println(currentDate);
  Serial.print("Unix Timestamp: ");
  Serial.println(currentTimestamp);

  // FIREBASE CONFIGURATION
  Serial.println("\nConfiguring Firebase...");
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  Firebase.reconnectNetwork(true);
  fbdo.setBSSLBufferSize(4096, 1024);

  // FIREBASE SIGN-IN
  Serial.println("\nSigning in anonymously...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase anonymous sign-in successful!");
    firebaseSignupOK = true;
  } else {
    Serial.println("Firebase anonymous sign-in FAILED.");
    Serial.print("Error: ");
    Serial.println(config.signer.signupError.message.c_str());
    firebaseSignupOK = false;
  }

  // START FIREBASE
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println();
  if (firebaseSignupOK) {
    Serial.println("Firebase initialized.");
  } else {
    Serial.println("Firebase authentication failed.");
  }

  // SYSTEM READY
  Serial.println("\nPMS5003 is ready...\n");
  Serial.println("============================================");
  Serial.println("             SYSTEM READY");
  Serial.println("============================================\n");

  Serial.println("Monitoring configuration:");
  Serial.println("- PMS5003 averaging: 12 readings");
  Serial.println("- Current data: every 1 minute");
  Serial.println("- Historical data: every 15 minutes");
  Serial.println("- HIGH condition: 80%");
  Serial.println("- Maintenance: persistent HIGH condition");
  Serial.println("- Daily summary: enabled\n");
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  // CHECK WI-FI
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWi-Fi disconnected!");
    Serial.println("Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    delay(5000);
    return;
  }

  // READ PMS5003
  while (pmsSerial.available() >= 32) {

    // FIND HEADER
    if (pmsSerial.read() != 0x42) continue;
    if (pmsSerial.read() != 0x4D) continue;

    // READ DATA
    uint8_t data[30];
    for (int i = 0; i < 30; i++) {
      data[i] = pmsSerial.read();
    }

    // EXTRACT PM VALUES
    int pm1 = (data[4] << 😎 | data[5];
    int pm25 = (data[6] << 😎 | data[7];
    int pm10 = (data[8] << 😎 | data[9];

    // ADD TO AVERAGE
    pm1Sum += pm1;
    pm25Sum += pm25;
    pm10Sum += pm10;
    sampleCount++;

    // WAIT FOR 12 READINGS
    if (sampleCount < AVERAGE_SAMPLES) {
      continue;
    }

    // CALCULATE SENSOR AVERAGE
    currentPM1 = pm1Sum / AVERAGE_SAMPLES;
    currentPM25 = pm25Sum / AVERAGE_SAMPLES;
    currentPM10 = pm10Sum / AVERAGE_SAMPLES;

    // RESET SENSOR AVERAGING
    sampleCount = 0;
    pm1Sum = 0;
    pm25Sum = 0;
    pm10Sum = 0;

    // CALCULATE DUST CONDITION & STATUS
    currentDustPercentage = calculateDustPercentage(currentPM25);
    currentStatus = determineStatus(currentDustPercentage);
    currentTimestamp = getTimestamp();

    // UPDATE DAILY AND LONG-TERM DATA
    updateDailyData();
    updateLongTermCondition();

    // DISPLAY SENSOR READING
    Serial.println("\n--------------------------------------------");
    Serial.println("          AIRSENSE SENSOR READING");
    Serial.println("--------------------------------------------");
    Serial.print("Sensor: ");
    Serial.println(SENSOR_ID);
    Serial.println();

    Serial.print("PM1.0: ");
    Serial.print(currentPM1);
    Serial.println(" ug/m3");

    Serial.print("PM2.5: ");
    Serial.print(currentPM25);
    Serial.println(" ug/m3");

    Serial.print("PM10 : ");
    Serial.print(currentPM10);
    Serial.println(" ug/m3\n");

    Serial.print("Dust Condition Indicator: ");
    Serial.print(currentDustPercentage, 1);
    Serial.println("%");

    Serial.print("Current Status: ");
    Serial.println(currentStatus);
    Serial.println();

    Serial.print("Daily Average PM2.5: ");
    Serial.print(dailyAveragePM25, 1);
    Serial.println(" ug/m3");

    Serial.print("Daily Average Dust: ");
    Serial.print(dailyAverageDust, 1);
    Serial.println("%\n");

    Serial.print("Persistent HIGH Hours: ");
    Serial.print(highConditionHours);
    Serial.print("/");
    Serial.println(REQUIRED_HIGH_HOURS);

    Serial.print("Maintenance Alert: ");
    if (maintenanceAlert) {
      Serial.println("YES\n");
      Serial.println("MAINTENANCE INSPECTION RECOMMENDED");
      Serial.println("Persistent HIGH dust condition detected.");
    } else {
      Serial.println("NO");
    }

    Serial.println();
    Serial.print("Date: ");
    Serial.println(currentDate);

    Serial.print("Timestamp: ");
    Serial.println(currentTimestamp);

    Serial.print("Wi-Fi RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    // FIREBASE UPDATES
    if (firebaseSignupOK && Firebase.ready()) {

      // CURRENT DATA
      if (millis() - lastCurrentDataSend >= CURRENT_DATA_INTERVAL) {
        lastCurrentDataSend = millis();
        sendCurrentData();
      }

      // HISTORICAL DATA
      if (millis() - lastHistorySend >= HISTORY_INTERVAL) {
        lastHistorySend = millis();
        Serial.println("\nSaving historical reading...");
        saveHistory();
      }

      // DAILY SUMMARY
      if (millis() - lastDailySummarySend >= DAILY_SUMMARY_INTERVAL) {
        lastDailySummarySend = millis();
        Serial.println("\nUpdating daily summary...");
        saveDailySummary();
      }

    } else {
      Serial.println("\nFirebase is not ready yet.");
    }

    Serial.println("\n--------------------------------------------\n");

    // Process this averaged reading
    break;
  }

  delay(100);
}