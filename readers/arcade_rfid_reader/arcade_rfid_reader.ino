/*
 * Arcade Tournament Manager - ESP8266 NodeMCU RFID Reader
 * =======================================================
 * Reads RFID badges and reports scans to the Arcade Tournament Manager app.
 * MFRC522 init/read flow (SPI.begin -> PCD_Init -> delay(500) -> getid())
 * is the one proven on live arcade hardware.
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
 * Piezo buzzer (short beep on successful check-in). Active-LOW: sounds when
 * the pin is LOW, silent when HIGH, so idle is HIGH (off) and each scan
 * pulses LOW briefly:
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
#define BUZZER_PIN   D0   // GPIO16 (active-low piezo: sounds when LOW)
#define LED_PIN      D4   // GPIO2 onboard blue LED (active-low) or external LED

#define LED_ON   LOW
#define LED_OFF  HIGH

// Piezo is active-LOW (sounds when the pin is LOW, silent when HIGH).
#define BUZZER_ON   LOW
#define BUZZER_OFF  HIGH

// Recognized-scan feedback knobs (set from the Reader Program UI):
// FEEDBACK_BEEP_ENABLED = 1 -> buzzer chirps, 0 -> silent
// FEEDBACK_LED_ENABLED  = 1 -> LED flashes,   0 -> no flash
// FEEDBACK_COUNT        = how many beep/flash pulses (1-9)
#define FEEDBACK_BEEP_ENABLED  1
#define FEEDBACK_LED_ENABLED   1
#define FEEDBACK_COUNT         2

MFRC522 mfrc522(SS_PIN, RST_PIN);
WiFiClient client;

String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_MS = 3000;  // Ignore same badge for 3 seconds

int readsuccess;          // Was a card present and read this pass?
char str[32] = "";        // Scratch buffer for hex formatting
String StrUID = "";       // UID of the last scan

void flashLed(int onMs) {
  digitalWrite(LED_PIN, LED_ON);
  delay(onMs);
  digitalWrite(LED_PIN, LED_OFF);
}

// Recognized badge (checked_in / already_checkedin / switched_game)
void recognizedFeedback() {
  for (int i = 0; i < FEEDBACK_COUNT; i++) {
#if FEEDBACK_BEEP_ENABLED
    digitalWrite(BUZZER_PIN, BUZZER_ON);
#endif
#if FEEDBACK_LED_ENABLED
    digitalWrite(LED_PIN, LED_ON);
#endif
    delay(150);
#if FEEDBACK_BEEP_ENABLED
    digitalWrite(BUZZER_PIN, BUZZER_OFF);
#endif
#if FEEDBACK_LED_ENABLED
    digitalWrite(LED_PIN, LED_OFF);
#endif
    delay(250);
  }
}

// Badge not registered to any player
void unknownFeedback() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, BUZZER_ON); delay(80);
    digitalWrite(BUZZER_PIN, BUZZER_OFF);  delay(60);
    flashLed(60);
    delay(60);
  }
}

// Server unreachable / HTTP error
void failFeedback() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, BUZZER_ON); delay(60);
    digitalWrite(BUZZER_PIN, BUZZER_OFF);  delay(40);
    flashLed(50);
    delay(50);
  }
}

// Format a byte array as uppercase hex with ':' separators.
void array_to_string(byte array[], unsigned int len, char buffer[]) {
  unsigned int pos = 0;
  for (unsigned int i = 0; i < len; i++) {
    if (i > 0) buffer[pos++] = ':';
    byte nib1 = (array[i] >> 4) & 0x0F;
    byte nib2 = (array[i] >> 0) & 0x0F;
    buffer[pos++] = nib1 < 0xA ? '0' + nib1 : 'A' + nib1 - 0xA;
    buffer[pos++] = nib2 < 0xA ? '0' + nib2 : 'A' + nib2 - 0xA;
  }
  buffer[pos] = '\0';
}

// Read a new card and store its UID as a hex string in StrUID.
// Returns 1 on a fresh read, 0 if no card / read failed.
int getid() {
  if (!mfrc522.PICC_IsNewCardPresent()) return 0;
  if (!mfrc522.PICC_ReadCardSerial()) return 0;

  Serial.print("THE UID OF THE SCANNED CARD IS : ");
  array_to_string(mfrc522.uid.uidByte, mfrc522.uid.size, str);
  StrUID = String(str);
  Serial.println(StrUID);
  return 1;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_OFF);

  // Start the MFRC522 exactly like the proven reader sketch.
  SPI.begin();
  mfrc522.PCD_Init();
  delay(500);   // Give the RC522 module time to settle before first read

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

  readsuccess = getid();
  if (!readsuccess) return;

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  String uid = StrUID;
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
    if (response.indexOf("checked_in") != -1 ||
        response.indexOf("already_checkedin") != -1 ||
        response.indexOf("switched_game") != -1) {
      recognizedFeedback();
    } else if (response.indexOf("unknown_badge") != -1) {
      unknownFeedback();
    } else {
      failFeedback();
    }
  } else {
    Serial.println("FAILED: " + http.errorToString(httpCode));
    failFeedback();
  }
  http.end();
}