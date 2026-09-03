/*
 * Arcade Tournament Manager - ESP32 RFID Reader
 * =============================================
 * Reads RFID badges and reports scans to the Arcade Tournament Manager app.
 *
 * WIRING (MFRC522 -> ESP32):
 *   SDA (SS)  ->  GPIO 5
 *   SCK       ->  GPIO 18
 *   MOSI      ->  GPIO 23
 *   MISO      ->  GPIO 19
 *   IRQ       ->  not connected
 *   GND       ->  GND
 *   RST       ->  GPIO 27
 *   3.3V      ->  3.3V
 *
 * OPTIONAL ACTIVE BUZZER (1s beep on successful check-in):
 *   Positive (+)  ->  GPIO 4
 *   Negative (-)  ->  GND
 *
 * ========== CONFIGURE THESE FOR EACH READER ==========
 *   - SET WIFI_SSID / WIFI_PASSWORD to your network
 *   - SET SERVER_URL to http://<your-computer-ip>:3001/api/scan
 *   - SET READER_ID to a unique value per ESP32 (reader-01, reader-02, ...)
 * ======================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ====== CONFIGURE THESE FOR EACH READER ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "http://192.168.1.100:3001/api/scan";
const char* READER_ID      = "reader-01";  // Unique per reader!

#define SS_PIN       5
#define RST_PIN      27
#define BUZZER_PIN   4

MFRC522 rfid(SS_PIN, RST_PIN);
String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_MS = 3000;  // Ignore same badge for 3 seconds

// Beep for 1 second on a successful check-in
void successBeep() {
  digitalWrite(BUZZER_PIN, HIGH);   // active buzzer = beep on
  delay(1000);
  digitalWrite(BUZZER_PIN, LOW);    // beep off
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  rfid.PCD_Init();
  delay(100);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
  Serial.println("Ready to scan badges...");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (uid == lastUID && millis() - lastScanTime < DEBOUNCE_MS) {
    return;
  }

  lastUID = uid;
  lastScanTime = millis();
  Serial.println("Badge scanned: " + uid);
  sendScan(uid);
}

void sendScan(String uid) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"badge_uid\":\"" + uid
    + "\",\"reader_id\":\"" + READER_ID + "\"}";

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Response: " + response);

    // Beep for 1 second only on a successful check-in
    if (response.indexOf("checked_in") != -1) {
      successBeep();
    }
  } else {
    Serial.println("FAILED: " + http.errorToString(httpCode));
  }
  http.end();
}
