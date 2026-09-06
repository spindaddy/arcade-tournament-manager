/*
 * Arcade Tournament Manager - ESP8266 NodeMCU RFID Reader
 * =======================================================
 * Reads RFID badges and reports scans to the Arcade Tournament Manager app.
 *
 * WIRING (MFRC522 -> ESP8266 NodeMCU):
 *   SDA (SS)  ->  D2 (GPIO 4)
 *   SCK       ->  D5 (GPIO 14)
 *   MOSI      ->  D7 (GPIO 13)
 *   MISO      ->  D6 (GPIO 12)
 *   IRQ       ->  not connected
 *   GND       ->  GND
 *   RST       ->  D1 (GPIO 5)
 *   3.3V      ->  3.3V
 *
 * OPTIONAL ACTIVE BUZZER (1s beep on successful check-in):
 *   Positive (+)  ->  D0 (GPIO 16)
 *   Negative (-)  ->  GND
 *
 * ========== CONFIGURE THESE FOR EACH READER ==========
 *   - SET WIFI_SSID / WIFI_PASSWORD to your network
 *   - SET SERVER_URL to http://<your-computer-ip>:3001/api/scan
 *   - SET READER_ID to a unique value per reader (reader-01, reader-02, ...)
 * ======================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ====== CONFIGURE THESE FOR EACH READER ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "http://192.168.1.100:3001/api/scan";
const char* READER_ID      = "reader-01";  // Unique per reader!

#define SS_PIN       D2   // GPIO4
#define RST_PIN      D1   // GPIO5
#define BUZZER_PIN   D0   // GPIO16

MFRC522 rfid(SS_PIN, RST_PIN);
WiFiClient client;
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
  http.begin(client, SERVER_URL);
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