# Installation & Setup Guide

This guide covers installing the Arcade Tournament Manager, setting up the network, and programming NodeMCU ESP8266 RFID readers.

---

## Table of Contents

1. [Installing the App](#installing-the-app)
2. [Network Setup](#network-setup)
3. [Reader Hardware](#reader-hardware)
4. [Programming the Reader](#programming-the-reader)
5. [Configuring Readers in the App](#configuring-readers-in-the-app)
6. [OBS Integration (Live Player Names)](#obs-integration-live-player-names)
7. [Live Scoreboard](#live-scoreboard)
8. [Testing the Setup](#testing-the-setup)
9. [Tournament Day Checklist](#tournament-day-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Installing the App

### macOS

1. Download `Arcade Tournament Manager-x.x.x-mac-arm64.dmg` (Apple Silicon) or `-mac-x64.dmg` (Intel) from [Releases](https://github.com/spindaddy/arcade-tournament-manager/releases)
2. Open the `.dmg` file
3. Drag **Arcade Tournament Manager** to your Applications folder
4. **Right-click** the app in Applications → **Open** → **Open** (a regular double-click may say the app is damaged)
5. If it still will not open, download **Open Arcade Tournament Manager.command** from the same release and double-click it, or run this once in Terminal:

   ```bash
   xattr -cr "/Applications/Arcade Tournament Manager.app"
   ```

6. The app is self-contained — no additional software is needed

### Windows

1. Download `Arcade Tournament Manager-x.x.x-win-x64.exe` from [Releases](https://github.com/spindaddy/arcade-tournament-manager/releases)
2. Run the installer
3. Choose install location (default is fine)
4. Launch from Start Menu or desktop shortcut
5. Windows Defender may flag it - click **More info > Run anyway** (unsigned app)

### Linux

**AppImage (any distro — this is the packaged Linux build):**
```bash
chmod +x Arcade\ Tournament\ Manager-1.3.7-linux-x86_64.AppImage
./Arcade\ Tournament\ Manager-1.3.7-linux-x86_64.AppImage
```

> Note: a `.deb` package is not currently produced (the cross-platform deb
> generator produces an empty archive on macOS). Use the AppImage on Debian/Ubuntu.

### First Launch

When the app starts it launches the management window **and** a local API server
on `http://localhost:3001`. The app keeps all of its data (players, machines,
tournaments, settings) in a single SQLite database:

- **macOS/Linux:** `~/Library/Application Support/arcade-tournament-manager/data/tournament.db`
- **Windows:** `%APPDATA%\arcade-tournament-manager\data\tournament.db`

Back this file up before events.

---

## Network Setup

The ESP8266 RFID readers communicate with the app over WiFi. Both the computer running the app and all readers must be on the same 2.4 GHz network.

### Option A: Same WiFi Network (Simple)

Best for: Home setups, small venues, single-room tournaments.

```
+-----------+          +-----------+          +-----------+
| Reader #1 |          | Reader #2 |          | Reader #3 |
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
3. Connect all readers to the same WiFi network
4. In the reader firmware, set the server IP to your computer's IP

### Option B: Dedicated Hotspot (Recommended for Events)

Best for: Venues with unreliable WiFi, outdoor events, multi-day tournaments.

1. Create a hotspot from your phone or a travel router
2. Connect your computer to the hotspot
3. Connect all readers to the same hotspot
4. Use your computer's hotspot IP as the server address

**Recommended travel router:** GL.iNet travel routers ($20-40) are small, cheap, and reliable for this purpose.

### Network Requirements

| Requirement | Details |
|-------------|---------|
| Band | 2.4 GHz (ESP8266 does not support 5 GHz) |
| Protocol | HTTP (port 3001) |
| Latency | Under 500ms is ideal |
| Internet | Not required - local network only |
| Max devices | ~20 readers per network works reliably |

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

The IP will look like `192.168.1.100` or `10.0.0.50`. This is what you put in the reader firmware as `SERVER_IP`.

---

## Reader Hardware

### Parts Needed (Per Reader Station)

| Component | Approximate Cost | Notes |
|-----------|-----------------|-------|
| NodeMCU ESP8266 Board | $5-8 | ESP-12E NodeMCU (CP2102 USB chip) |
| MFRC522 RFID Module | $2-5 | Comes with blank cards/tags |
| RFID Cards/Tags | $0.50-1 each | NTAG213 or MIFARE Classic 1K |
| USB Cable | $2-5 | Micro-USB for the NodeMCU |
| Breadboard or Perfboard | $3-5 | For permanent installations |
| Jumper Wires | $2-3 | Male-to-female for NodeMCU to MFRC522 |

**Total per reader: ~$15-30**

### Wiring

Connect the MFRC522 to the NodeMCU using these pins (these are the exact default
pins the app's generated firmware uses):

```
MFRC522 Pin    NodeMCU Pin
-----------    -----------
SDA (SS)   ->  D2 (GPIO 4)
SCK        ->  D5 (GPIO 14)
MOSI       ->  D7 (GPIO 13)
MISO       ->  D6 (GPIO 12)
IRQ        ->  Not connected
GND        ->  GND
RST        ->  D1 (GPIO 5)
3.3V       ->  3.3V
```

**Important:** The MFRC522 runs on 3.3V. Do NOT connect it to 5V.

### Buzzer (optional)

Wire an **active** buzzer to D0 to get a 1-second beep when a player
successfully checks in.

```
Active Buzzer    NodeMCU Pin
-------------    -----------
Positive (+) ->  D0 (GPIO 16)
Negative (-) ->  GND
```

An active buzzer beeps whenever it has power, so the firmware drives D0 HIGH for 1 second only when the server confirms a successful check-in. Skip this section if you don't want the beep.

---

## Programming the Reader

There are two ways to program the readers:

- **Option A (recommended): in-app** — the app generates finished firmware and
  flashes it over USB itself. Targets the **NodeMCU ESP8266 (ESP-12E)** board.
- **Option B: manual** — traditional VS Code + PlatformIO or Arduino IDE.

### Option A: In-App Programming (Recommended)

The app's **Reader Setup** and **Reader Program** screens handle the whole
toolchain automatically.

1. Go to **Reader Setup** in the sidebar. It checks the requirements automatically:
   - **PlatformIO** — if missing, click **Install PlatformIO**. The app downloads
     the official installer itself (takes a few minutes on first run).
   - **Python** — on Windows, if Python 3 is not installed, click **Install Python**.
     The app silently installs the official python.org 3.12 build (per-user, no
     admin rights needed, added to PATH automatically). The "python" shortcut in
     the Microsoft Store is only a stub and will not work — always use the app's
     install button (or python.org).
   - **Serial port available** — connect the board over USB; the app lists ports
     and flags ones that look like a reader (CP210x/CH340). On Windows the port
     is `COMx` (not `/dev/...`). If nothing appears, open Device Manager and
     install the CH340 or CP2102 driver so the board shows up as a COM port.
2. Connect the board to your computer with a USB cable.
3. In **Reader Program**, select the reader's serial port.
4. Fill in:
   - **WiFi Name** and **WiFi Password** (2.4 GHz network — see [Network Setup](#network-setup)).
   - **Server URL** — auto-filled as `http://<your-IP>:3001/api/scan`; adjust if needed.
   - **Reader ID** — a unique ID per reader (e.g. `reader-01`). This must match the
     **Reader ID** you register for that machine in the app later.
5. Click **Preview** to inspect the generated `.ino` source if you like.
6. Click **Build & Flash** — the app compiles and uploads the firmware over USB.
7. Use the **Serial Monitor** to watch live output at 115200 baud
   (`Ready to scan badges...` means it connected to your WiFi and is working).

Repeat for each reader, changing only the **Reader ID**.

The generated firmware uses the wiring pins further up (SS on D2, RST on D1,
buzzer on D0) and beeps 1 second on a successful check-in.

### Option B: Manual (VS Code / Arduino IDE)

Useful if you want to customize the firmware yourself.

**Prerequisites**

Install [PlatformIO](https://platformio.org/) in VS Code, or use the Arduino IDE with ESP8266 board support.

**Using Arduino IDE:**
1. Install Arduino IDE 2.x
2. Go to **File > Preferences > Additional Board Manager URLs**
3. Add: `https://arduino.esp8266.com/stable/package_esp8266com_index.json`
4. Go to **Tools > Board > Board Manager**, search "esp8266", install
5. Go to **Tools > Manage Libraries**, search and install `MFRC522` by GithubCommunity

**Using PlatformIO:**
1. Install VS Code
2. Install PlatformIO extension
3. Create a new project — select the **NodeMCU 1.0 (ESP-12E)** board

### ESP8266 Firmware Code

Copy this code into your reader project. Update the WiFi credentials and server IP for each reader.

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ====== CONFIGURE THESE FOR EACH READER ======
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL     = "http://192.168.1.100:3001/api/scan";
const char* READER_ID      = "reader-01";  // Unique per reader!

#define SS_PIN      D2   // GPIO4
#define RST_PIN     D1   // GPIO5
#define BUZZER_PIN  D0   // GPIO16

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
  http.begin(client, SERVER_URL);
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

    // Beep for 1 second only on a successful check-in
    if (response.indexOf("checked_in") != -1) {
      successBeep();
    }
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
[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
monitor_speed = 115200
lib_deps =
    miguelbalboa/MFRC522@^1.4.10
```

### Flashing Each Reader (manual path)

You need one reader per arcade machine. For each reader (if you are not using the
in-app programmer from Option A):

1. Change `READER_ID` to a unique value (e.g., `reader-01`, `reader-02`, etc.)
2. Make sure `WIFI_SSID` and `WIFI_PASSWORD` match your network
3. Make sure `SERVER_URL` points to your computer's IP
4. Flash the code to the reader
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
   - **Reader ID**: Must match `READER_ID` in the reader firmware exactly (e.g., `reader-01`)
   - **Location**: Optional (e.g., "Left wall")
   - **OBS Server** and **OBS Source Name**: Optional — see [OBS Integration](#obs-integration-live-player-names)
5. Click **Add Machine**
6. Repeat for each arcade machine/reader pair

To check a reader: add a player, assign a badge (Players > Assign Badge), then
scan the badge on the reader. The machine's player name updates in OBS (if
configured) and appears on the Dashboard > Active Players.

---

## OBS Integration (Live Player Names)

Version 1.3+ can show the **current player's name on each machine** in OBS.
When a badge is scanned on a machine, the app updates a text source in OBS with
that player's name — perfect for "Now Playing" overlays.

### Requirements

- OBS Studio 28+ with the **obs-websocket 5.x** feature enabled
  (Settings > Tools > WebSocket Server, default port `4455`, auth can be on or off).
- The computer running the app does **not** need to be running OBS itself — the
  app connects to any OBS instance on your network (e.g. the streaming PC).

### Setup

1. In the sidebar, open **OBS Connection**.
2. Add a server: name, host/IP of the OBS machine, port (default `4455`), and
   the WebSocket password (if auth is enabled; stored locally).
3. Click **Test** to verify the connection. Use **Test Text** to push a sample
   string into a text source to confirm it lands in OBS.
4. In **Machines**, set each machine's **OBS Server** (choose the server) and
   **OBS Source Name** (the text source name in OBS, e.g. `Player Name`).
5. In OBS, add a **Text (GDI+)** source with exactly that name for the machine's
   overlay, and set its content to anything (the app overwrites it on each scan).
6. Done — on every successful check-in the source text becomes the player's name.
   It is cleared/updated when the player switches machines.

### Notes

- Support for multiple OBS servers: each machine can point at a different server/source.
- Connections are made on demand; if OBS is offline the scan still works, the
  text just isn't updated.

---

## Live Scoreboard

The app serves a web scoreboard you can put on any screen (browser, smart TV,
second monitor):

1. Open the sidebar **Scoreboard** to see the built-in view, or click
   **Open Scoreboard ↗** in the sidebar to open the external page.
2. The scoreboard URL is `http://<your-computer-IP>:3001/` — open it from any
   device on the same network (e.g. a wall-mounted TV in kiosk/fullscreen mode).
3. The scoreboard shows live rankings by total score, best score, and who is
   currently playing. Your LAN IP is shown on the Reader Setup screen if you need it.
4. Optional divisions: add divisions in **Settings** (e.g. "Beginner", "Pro") and
   the sidebar gets per-division scoreboard links.

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

Register a player in the app, then assign them a badge. Get the badge UID from the reader's serial output, or test manually:

```bash
curl -X POST http://COMPUTER_IP:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"badge_uid": "AA:BB:CC:DD:EE:FF", "reader_id": "reader-01"}'
```

### Step 3: Test Reader Connectivity

Open the reader's Serial Monitor and scan a badge. You should see:
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
- [ ] All readers flashed and tested
- [ ] WiFi network set up (hotspot or router)
- [ ] Player registration forms ready
- [ ] Blank RFID cards/tags for each player
- [ ] USB cables for reader power (battery packs work too)
- [ ] Printed list mapping Reader IDs to Machine Names

### Setup at Venue

- [ ] Connect computer to WiFi network
- [ ] Launch the app and verify API server is running
- [ ] Power on each reader and verify WiFi connection (check Serial Monitor)
- [ ] Register all arcade machines in the app under **Machines**
- [ ] Test each reader by scanning a test badge
- [ ] Register all players and assign badges
- [ ] Verify Dashboard shows active sessions when players scan in

### During the Event

- [ ] Monitor the Dashboard for live activity
- [ ] If a reader goes offline, check its Serial Monitor for WiFi errors
- [ ] Register any late players as they arrive
- [ ] Keep a backup of the database file (`data/tournament.db` in the app's data folder, see [First Launch](#first-launch))

### Power Tips

- ESP8266 boards can be powered from USB battery packs (5V/1A is enough)
- A 10,000mAh battery pack runs a reader for ~10-15 hours
- Velcro or tape the reader + NodeMCU combo to each machine

---

## Troubleshooting

### Reader won't connect to WiFi
- Make sure you're on 2.4 GHz (not 5 GHz)
- Check SSID and password are correct
- Move closer to the router
- Some captive portals (hotel/airport WiFi) won't work - use your own hotspot

### Badge scans but app doesn't show it
- Check the reader's Serial Monitor for HTTP error codes
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

### OBS player name isn't updating
- On **OBS Connection**, click **Test** — fix host/port/password until it succeeds
- Confirm the machine's **OBS Server** and **OBS Source Name** are set on the machine
- Make sure the text source name in OBS matches the machine's **OBS Source Name** exactly
- Open OBS > Tools > WebSocket Server Settings and confirm the server is enabled
  (and the port matches)
- Scans still work even if OBS is offline — the name just won't update

### Multiple badges triggering at once
- Keep RFID readers at least 2 feet apart to avoid cross-reads
- Use metal foil between readers if they're mounted close together