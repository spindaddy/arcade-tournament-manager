# Installation & Setup Guide

This guide covers installing the Arcade Tournament Manager, setting up the network, and programming ESP32 RFID readers.

---

## Table of Contents

1. [Installing the App](#installing-the-app)
2. [Network Setup](#network-setup)
3. [ESP32 Hardware](#esp32-hardware)
4. [Programming the ESP32](#programming-the-esp32)
5. [Configuring Readers in the App](#configuring-readers-in-the-app)
6. [Testing the Setup](#testing-the-setup)
7. [Tournament Day Checklist](#tournament-day-checklist)

---

## Installing the App

### macOS

1. Download `Arcade Tournament Manager-x.x.x-mac-arm64.dmg` from [Releases](https://github.com/spindaddy/arcade-tournament-manager/releases)
2. Open the `.dmg` file
3. Drag **Arcade Tournament Manager** to your Applications folder
4. On first launch, macOS may block it. Go to **System Settings > Privacy & Security** and click **Open Anyway**
5. The app is self-contained - no additional software is needed

### Windows

1. Download `Arcade Tournament Manager-x.x.x-win-x64.exe` from [Releases](https://github.com/spindaddy/arcade-tournament-manager/releases)
2. Run the installer
3. Choose install location (default is fine)
4. Launch from Start Menu or desktop shortcut
5. Windows Defender may flag it - click **More info > Run anyway** (unsigned app)

### Linux

**AppImage (any distro):**
```bash
chmod +x Arcade\ Tournament\ Manager-x.x.x-linux-x64.AppImage
./Arcade\ Tournament\ Manager-x.x.x-linux-x64.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i arcade-tournament-manager_x.x.x_amd64.deb
```

---

## Network Setup

The ESP32 RFID readers communicate with the app over WiFi. Both the computer running the app and all ESP32 devices must be on the same network.

### Option A: Same WiFi Network (Simple)

Best for: Home setups, small venues, single-room tournaments.

```
+-----------+          +-----------+          +-----------+
|  ESP32 #1 |          |  ESP32 #2 |          |  ESP32 #3 |
|  reader-01|          |  reader-02|          |  reader-03|
+-----+-----+          +-----+-----+          +-----+-----+
      |                      |                      |
      +----------+-----------+-----------+----------+
                 |                      |
            WiFi Router          Computer running
                              Tournament Manager
                              (192.168.1.100)
```

1. Connect your computer to your WiFi network
2. Note your computer's local IP address:
   - **macOS**: System Settings > WiFi > Details > TCP/IP
   - **Windows**: Settings > Network & Internet > Properties
   - **Linux**: `ip addr show` or `ifconfig`
3. Connect all ESP32 devices to the same WiFi network
4. In the ESP32 firmware, set the server IP to your computer's IP

### Option B: Dedicated Hotspot (Recommended for Events)

Best for: Venues with unreliable WiFi, outdoor events, multi-day tournaments.

1. Create a hotspot from your phone or a travel router
2. Connect your computer to the hotspot
3. Connect all ESP32 devices to the same hotspot
4. Use your computer's hotspot IP as the server address

**Recommended travel router:** GL.iNet travel routers ($20-40) are small, cheap, and reliable for this purpose.

### Option C: Direct AP Mode (No Router)

Some ESP32 boards can create their own WiFi access point. This is the simplest setup but limits you to one ESP32 at a time unless you set up mesh networking.

### Network Requirements

| Requirement | Details |
|-------------|---------|
| Band | 2.4 GHz (ESP32 does not support 5 GHz) |
| Protocol | HTTP (port 3001) |
| Latency | Under 500ms is ideal |
| Internet | Not required - local network only |
| Max devices | ~20 ESP32s per network works reliably |

### Finding Your Computer's IP

**macOS:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter.

**Linux:**
```bash
hostname -I
```

The IP will look like `192.168.1.100` or `10.0.0.50`. This is what you put in the ESP32 firmware as `SERVER_IP`.

---

## ESP32 Hardware

### Parts Needed (Per Reader Station)

| Component | Approximate Cost | Notes |
|-----------|-----------------|-------|
| ESP32 Dev Board | $5-10 | ESP32-WROOM-32 or ESP32-S3 recommended |
| MFRC522 RFID Module | $2-5 | Comes with blank cards/tags |
| RFID Cards/Tags | $0.50-1 each | NTAG213 or MIFARE Classic 1K |
| USB Cable | $2-5 | Micro-USB or USB-C depending on board |
| Breadboard or Perfboard | $3-5 | For permanent installations |
| Jumper Wires | $2-3 | Male-to-female for ESP32 to MFRC522 |

**Total per reader: ~$15-30**

### Wiring

Connect the MFRC522 to the ESP32:

```
MFRC522 Pin    ESP32 Pin
-----------    ---------
SDA (SS)   ->  GPIO 5
SCK        ->  GPIO 18
MOSI       ->  GPIO 23
MISO       ->  GPIO 19
IRQ        ->  Not connected
GND        ->  GND
RST        ->  GPIO 27
3.3V       ->  3.3V
```

**Important:** The MFRC522 runs on 3.3V. Do NOT connect it to 5V.

### Common ESP32 Boards

| Board | WiFi | Bluetooth | Price | Notes |
|-------|------|-----------|-------|-------|
| ESP32-WROOM-32 | 2.4 GHz | Yes | ~$5 | Most common, great for this project |
| ESP32-S3 | 2.4 GHz | Yes | ~$8 | Newer, more GPIO pins |
| ESP32-C3 | 2.4 GHz | Yes | ~$4 | RISC-V, cheaper but fewer pins |
| NodeMCU-32S | 2.4 GHz | Yes | ~$6 | breadboard-friendly |

---

## Programming the ESP32

### Prerequisites

Install [PlatformIO](https://platformio.org/) in VS Code, or use the Arduino IDE with ESP32 board support.

**Using Arduino IDE:**
1. Install Arduino IDE 2.x
2. Go to **File > Preferences > Additional Board Manager URLs**
3. Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
4. Go to **Tools > Board > Board Manager**, search "esp32", install
5. Go to **Tools > Manage Libraries**, search and install `MFRC522` by GithubCommunity

**Using PlatformIO (Recommended):**
1. Install VS Code
2. Install PlatformIO extension
3. Create a new project, select ESP32 board

### ESP32 Firmware Code

Copy this code into your ESP32 project. Update the WiFi credentials and server IP for each reader.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ====== CONFIGURE THESE FOR EACH READER ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "http://192.168.1.100:3001/api/scan";
const char* READER_ID      = "reader-01";  // Unique per reader!

#define SS_PIN    5
#define RST_PIN   27

MFRC522 rfid(SS_PIN, RST_PIN);
String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_MS = 3000;  // Ignore same badge for 3 seconds

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Arcade RFID Reader ===");
  Serial.print("Reader ID: ");
  Serial.println(READER_ID);

  SPI.begin();
  rfid.PCD_Init();
  delay(100);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  Serial.println("Ready to scan badges...");
  Serial.println();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
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

  Serial.print("Badge scanned: ");
  Serial.println(uid);

  sendScan(uid);
}

void sendScan(String uid) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"badge_uid\":\"" + uid + "\",\"reader_id\":\"" + READER_ID + "\"}";

  Serial.print("Sending to server... ");
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("OK (");
    Serial.print(httpCode);
    Serial.println(")");
    Serial.println("Response: " + response);
  } else {
    Serial.print("FAILED (");
    Serial.print(http.errorToString(httpCode));
    Serial.println(")");
  }

  http.end();
}
```

### PlatformIO Configuration

If using PlatformIO, create `platformio.ini`:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps =
    miguelbalboa/MFRC522@^1.4.10
```

### Flashing Each Reader

You need one ESP32 per arcade machine. For each reader:

1. Change `READER_ID` to a unique value (e.g., `reader-01`, `reader-02`, etc.)
2. Make sure `WIFI_SSID` and `WIFI_PASSWORD` match your network
3. Make sure `SERVER_URL` points to your computer's IP
4. Flash the code to the ESP32
5. Open Serial Monitor to verify it connects and shows "Ready to scan badges..."
6. Test by scanning a badge - you should see the server response

**Tip:** Use a spreadsheet to track reader IDs:

| Reader ID | Arcade Machine | Location |
|-----------|---------------|----------|
| reader-01 | Pac-Man | Left wall |
| reader-02 | Galaga | Left wall |
| reader-03 | Street Fighter II | Back corner |
| reader-04 | Mortal Kombat | Back corner |
| reader-05 | Pinball - Addams Family | Right side |

---

## Configuring Readers in the App

1. Launch the Arcade Tournament Manager
2. Go to **Machines** in the sidebar
3. Click **+ Add Machine**
4. Enter:
   - **Name**: The arcade machine name (e.g., "Pac-Man")
   - **Reader ID**: Must match `READER_ID` in the ESP32 firmware exactly (e.g., `reader-01`)
   - **Location**: Optional (e.g., "Left wall")
5. Click **Add Machine**
6. Repeat for each arcade machine/reader pair

---

## Testing the Setup

### Step 1: Verify API Server

The app runs an API server on port 3001. From any device on the same network:

```bash
curl http://COMPUTER_IP:3001/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}
```

### Step 2: Test a Scan Manually

Register a player in the app, then assign them a badge. Get the badge UID from the ESP32 serial output, or test manually:

```bash
curl -X POST http://COMPUTER_IP:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"badge_uid": "AA:BB:CC:DD:EE:FF", "reader_id": "reader-01"}'
```

### Step 3: Test ESP32 Connectivity

Open the ESP32 Serial Monitor and scan a badge. You should see:
```
Badge scanned: AA:BB:CC:DD:EE:FF
Sending to server... OK (200)
Response: {"status":"checked_in","player_name":"John","machine":"Pac-Man"}
```

### Step 4: Check the Dashboard

After a successful scan, the Dashboard in the app should show:
- The player listed under "Active Players"
- The "Currently Playing" count should increase
- The scan should appear in "Scans Today"

---

## Tournament Day Checklist

### Before the Event

- [ ] Computer with the app installed and tested
- [ ] All ESP32 readers flashed and tested
- [ ] WiFi network set up (hotspot or router)
- [ ] Player registration forms ready
- [ ] Blank RFID cards/tags for each player
- [ ] USB cables for ESP32 power (battery packs work too)
- [ ] Printed list mapping Reader IDs to Machine Names

### Setup at Venue

- [ ] Connect computer to WiFi network
- [ ] Launch the app and verify API server is running
- [ ] Power on each ESP32 reader and verify WiFi connection (check Serial Monitor)
- [ ] Register all arcade machines in the app under **Machines**
- [ ] Test each reader by scanning a test badge
- [ ] Register all players and assign badges
- [ ] Verify Dashboard shows active sessions when players scan in

### During the Event

- [ ] Monitor the Dashboard for live activity
- [ ] If a reader goes offline, check its Serial Monitor for WiFi errors
- [ ] Register any late players as they arrive
- [ ] Keep a backup of the database file (`data/tournament.db`)

### Power Tips

- ESP32 boards can be powered from USB battery packs (5V/1A is enough)
- A 10,000mAh battery pack runs an ESP32 for ~8-10 hours
- Velcro or tape the ESP32 + reader combo to each machine

---

## Troubleshooting

### ESP32 won't connect to WiFi
- Make sure you're on 2.4 GHz (not 5 GHz)
- Check SSID and password are correct
- Move closer to the router
- Some captive portals (hotel/airport WiFi) won't work - use your own hotspot

### Badge scans but app doesn't show it
- Check the ESP32 Serial Monitor for HTTP error codes
- Verify the server IP is correct in the firmware
- Make sure port 3001 is not blocked by firewall
- Check that the Reader ID in the firmware matches what's registered in the app

### "Unknown Badge" response
- The badge hasn't been assigned to a player yet
- Go to Players > click **Assign Badge** on the player > enter the badge UID

### App won't launch on macOS
- Right-click the app > Open (bypasses Gatekeeper)
- Or: System Settings > Privacy & Security > Open Anyway

### App won't launch on Windows
- Windows Defender may block unsigned apps
- Click More info > Run anyway
- Or temporarily disable real-time protection

### Multiple badges triggering at once
- Keep RFID readers at least 2 feet apart to avoid cross-reads
- Use屏蔽材料 (metal foil) between readers if they're mounted close together
