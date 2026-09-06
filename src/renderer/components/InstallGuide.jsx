import React, { useState, useRef, useEffect } from 'react';

function InstallGuide() {
  const [activeSection, setActiveSection] = useState('installing-the-app');
  const contentRef = useRef(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleScroll = () => {
      const sections = el.querySelectorAll('h2[id]');
      let current = '';
      sections.forEach(h => {
        if (el.scrollTop >= h.offsetTop - 120) {
          current = h.id;
        }
      });
      if (current) setActiveSection(current);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = contentRef.current?.querySelector(`#${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sections = [
    { id: 'installing-the-app', label: 'Installing the App' },
    { id: 'network-setup', label: 'Network Setup' },
    { id: 'reader-hardware', label: 'Reader Hardware' },
    { id: 'programming-the-reader', label: 'Programming the Reader' },
    { id: 'configuring-readers', label: 'Configuring Readers' },
    { id: 'testing-the-setup', label: 'Testing the Setup' },
    { id: 'tournament-day-checklist', label: 'Tournament Checklist' },
    { id: 'troubleshooting', label: 'Troubleshooting' },
  ];

  return (
    <div className="install-guide-layout">
      <nav className="install-guide-nav">
        <h3>Guide Sections</h3>
        {sections.map(s => (
          <button
            key={s.id}
            className={`guide-nav-btn ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="install-guide-content" ref={contentRef}>

        <h2 id="installing-the-app">Installing the App</h2>

        <h3>macOS</h3>
        <ol>
          <li>Download <code>.dmg</code> from <strong>Releases</strong></li>
          <li>Open the <code>.dmg</code> file</li>
          <li>Drag <strong>Arcade Tournament Manager</strong> to Applications</li>
          <li>On first launch, macOS may block it. Go to <strong>System Settings &gt; Privacy &amp; Security</strong> &gt; <strong>Open Anyway</strong></li>
        </ol>

        <h3>Windows</h3>
        <ol>
          <li>Download <code>.exe</code> installer from <strong>Releases</strong></li>
          <li>Run the installer, choose install location</li>
          <li>Launch from Start Menu or desktop shortcut</li>
          <li>Windows Defender may flag it &mdash; click <strong>More info &gt; Run anyway</strong></li>
        </ol>

        <h3>Linux</h3>
        <p><strong>AppImage:</strong></p>
        <pre><code>{`chmod +x Arcade\\ Tournament\\ Manager-*.AppImage\n./Arcade\\ Tournament\\ Manager-*.AppImage`}</code></pre>
        <p><strong>Debian/Ubuntu:</strong></p>
        <pre><code>{`sudo dpkg -i arcade-tournament-manager_*.deb`}</code></pre>

        <h2 id="network-setup">Network Setup</h2>
        <p>The ESP8266 RFID readers communicate with the app over WiFi. Both the computer running the app and all reader devices must be on the same 2.4 GHz network.</p>

        <h3>Option A: Same WiFi Network (Simple)</h3>
        <p>Best for: Home setups, small venues, single-room tournaments.</p>
        <ol>
          <li>Connect your computer to your WiFi network</li>
          <li>Note your computer's local IP address</li>
          <li>Connect all readers to the same WiFi</li>
          <li>In the reader firmware, set the server IP to your computer's IP</li>
        </ol>

        <h3>Option B: Dedicated Hotspot (Recommended for Events)</h3>
        <p>Best for: Venues with unreliable WiFi, outdoor events, multi-day tournaments.</p>
        <ol>
          <li>Create a hotspot from your phone or a travel router</li>
          <li>Connect your computer to the hotspot</li>
          <li>Connect all readers to the same hotspot</li>
          <li>Use your computer's hotspot IP as the server address</li>
        </ol>
        <p>Recommended: GL.iNet travel routers ($20-40) are small and reliable.</p>

        <h3>Finding Your Computer's IP</h3>
        <p><strong>macOS:</strong></p>
        <pre><code>ipconfig getifaddr en0</code></pre>
        <p><strong>Windows:</strong></p>
        <pre><code>ipconfig</code></pre>
        <p>Look for "IPv4 Address" under your WiFi adapter.</p>
        <p><strong>Linux:</strong></p>
        <pre><code>hostname -I</code></pre>

        <h3>Network Requirements</h3>
        <table>
          <thead><tr><th>Requirement</th><th>Details</th></tr></thead>
          <tbody>
            <tr><td>Band</td><td>2.4 GHz (ESP8266 does not support 5 GHz)</td></tr>
            <tr><td>Protocol</td><td>HTTP (port 3001)</td></tr>
            <tr><td>Latency</td><td>Under 500ms is ideal</td></tr>
            <tr><td>Internet</td><td>Not required &mdash; local network only</td></tr>
            <tr><td>Max devices</td><td>~20 readers per network works reliably</td></tr>
          </tbody>
        </table>

        <h2 id="reader-hardware">Reader Hardware</h2>

        <h3>Parts Needed (Per Reader Station)</h3>
        <table>
          <thead><tr><th>Component</th><th>Cost</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>NodeMCU ESP8266 Board</td><td>$5-8</td><td>ESP-12E NodeMCU (CP2102)</td></tr>
            <tr><td>MFRC522 RFID Module</td><td>$2-5</td><td>Comes with blank cards/tags</td></tr>
            <tr><td>RFID Cards/Tags</td><td>$0.50-1 ea</td><td>NTAG213 or MIFARE Classic 1K</td></tr>
            <tr><td>USB Cable</td><td>$2-5</td><td>Micro-USB for the NodeMCU</td></tr>
            <tr><td>Breadboard or Perfboard</td><td>$3-5</td><td>For permanent installations</td></tr>
            <tr><td>Jumper Wires</td><td>$2-3</td><td>Male-to-female for NodeMCU to MFRC522</td></tr>
          </tbody>
        </table>
        <p><strong>Total per reader: ~$15-30</strong></p>

        <h3>Wiring</h3>
        <p>Connect the MFRC522 to the NodeMCU (all signals are 3.3V logic):</p>
        <table>
          <thead><tr><th>MFRC522 Pin</th><th>NodeMCU Pin</th></tr></thead>
          <tbody>
            <tr><td>SDA (SS)</td><td>D2 (GPIO 4)</td></tr>
            <tr><td>SCK</td><td>D5 (GPIO 14)</td></tr>
            <tr><td>MOSI</td><td>D7 (GPIO 13)</td></tr>
            <tr><td>MISO</td><td>D6 (GPIO 12)</td></tr>
            <tr><td>IRQ</td><td>Not connected</td></tr>
            <tr><td>GND</td><td>GND</td></tr>
            <tr><td>RST</td><td>D1 (GPIO 5)</td></tr>
            <tr><td>3.3V</td><td>3.3V</td></tr>
          </tbody>
        </table>
        <p><strong>Important:</strong> The MFRC522 runs on 3.3V. Do NOT connect it to 5V.</p>

        <h3>Buzzer (optional)</h3>
        <p>Wire an active buzzer to D0 to get a 1-second beep when a player successfully checks in.</p>
        <table>
          <thead><tr><th>Buzzer Pin</th><th>NodeMCU Pin</th></tr></thead>
          <tbody>
            <tr><td>Positive (+)</td><td>D0 (GPIO 16)</td></tr>
            <tr><td>Negative (-)</td><td>GND</td></tr>
          </tbody>
        </table>
        <p>An <strong>active</strong> buzzer beeps whenever it has power, so driving D0 HIGH makes it beep. The firmware below beeps for 1 second only when the server confirms a successful check-in.</p>

        <h2 id="programming-the-reader">Programming the Reader</h2>

        <h3>Recommended: Flash from the App</h3>
        <ol>
          <li>Open the <strong>Reader Setup</strong> screen in the app and install PlatformIO if it's missing</li>
          <li>On the <strong>Reader Program</strong> screen, pick the reader's serial port</li>
          <li>Enter the WiFi credentials and server URL, then click <strong>Compile &amp; Flash</strong></li>
        </ol>

        <h3>Prerequisites (manual)</h3>
        <p>Install <strong>PlatformIO</strong> in VS Code (recommended), or use the Arduino IDE with ESP8266 board support.</p>
        <p><strong>Arduino IDE:</strong></p>
        <ol>
          <li>Install Arduino IDE 2.x</li>
          <li><strong>File &gt; Preferences &gt; Additional Board Manager URLs</strong></li>
          <li>Add: <code>https://arduino.esp8266.com/stable/package_esp8266com_index.json</code></li>
          <li><strong>Tools &gt; Board &gt; Board Manager</strong>, search "esp8266", install</li>
          <li><strong>Tools &gt; Manage Libraries</strong>, search and install <strong>MFRC522</strong></li>
        </ol>

        <h3>Firmware Code</h3>
        <p>Copy this into your reader project. Update WiFi credentials and server IP for each reader. Keeps the same wiring used by the app: SS on D2, RST on D1, buzzer on D0.</p>
        <pre><code>{`#include <ESP8266WiFi.h>
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
const unsigned long DEBOUNCE_MS = 3000;

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
  Serial.println("\\nConnected! IP: " + WiFi.localIP().toString());
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

  String payload = "{\\"badge_uid\\":\\"" + uid
    + "\\",\\"reader_id\\":\\"" + READER_ID + "\\"}";

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
}`}</code></pre>

        <h3>PlatformIO Configuration</h3>
        <pre><code>{`[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
monitor_speed = 115200
lib_deps =
    miguelbalboa/MFRC522@^1.4.10`}</code></pre>

        <h3>Flashing Each Reader</h3>
        <p>For each reader:</p>
        <ol>
          <li>Change <code>READER_ID</code> to a unique value (e.g., <code>reader-01</code>, <code>reader-02</code>)</li>
          <li>Set <code>WIFI_SSID</code> and <code>WIFI_PASSWORD</code> to your network</li>
          <li>Set <code>SERVER_URL</code> to your computer's IP</li>
          <li>Flash the code to the reader</li>
          <li>Open Serial Monitor to verify "Ready to scan badges..."</li>
          <li>Test by scanning a badge</li>
        </ol>

        <h2 id="configuring-readers">Configuring Readers in the App</h2>
        <ol>
          <li>Launch the Arcade Tournament Manager</li>
          <li>Go to <strong>Machines</strong> in the sidebar</li>
          <li>Click <strong>+ Add Machine</strong></li>
          <li>Enter the machine name (e.g., "Pac-Man")</li>
          <li>Enter the Reader ID &mdash; must match <code>READER_ID</code> in the reader firmware exactly</li>
          <li>Optionally enter a location</li>
          <li>Click <strong>Add Machine</strong></li>
          <li>Repeat for each arcade machine/reader pair</li>
        </ol>

        <h2 id="testing-the-setup">Testing the Setup</h2>

        <h3>Step 1: Verify API Server</h3>
        <p>From any device on the same network:</p>
        <pre><code>{`curl http://COMPUTER_IP:3001/api/health`}</code></pre>
        <p>Expected: <code>{`{"status":"ok","timestamp":"..."}`}</code></p>

        <h3>Step 2: Test a Scan Manually</h3>
        <pre><code>{`curl -X POST http://COMPUTER_IP:3001/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{"badge_uid":"AA:BB:CC:DD:EE:FF","reader_id":"reader-01"}'`}</code></pre>

        <h3>Step 3: Check the Dashboard</h3>
        <p>After a successful scan, the Dashboard should show the player under "Active Players" and the "Currently Playing" count should increase.</p>

        <h2 id="tournament-day-checklist">Tournament Day Checklist</h2>

        <h3>Before the Event</h3>
        <ul>
          <li>Computer with the app installed and tested</li>
          <li>All readers flashed and tested</li>
          <li>WiFi network set up (hotspot or router)</li>
          <li>Player registration forms ready</li>
          <li>Blank RFID cards/tags for each player</li>
          <li>USB cables for reader power (battery packs work too)</li>
          <li>Printed list mapping Reader IDs to Machine Names</li>
        </ul>

        <h3>Setup at Venue</h3>
        <ul>
          <li>Connect computer to WiFi network</li>
          <li>Launch the app and verify API server is running</li>
          <li>Power on each reader and verify WiFi connection</li>
          <li>Register all arcade machines in the app under <strong>Machines</strong></li>
          <li>Test each reader by scanning a test badge</li>
          <li>Register all players and assign badges</li>
          <li>Verify Dashboard shows active sessions</li>
        </ul>

        <h3>During the Event</h3>
        <ul>
          <li>Monitor the Dashboard for live activity</li>
          <li>If a reader goes offline, check its Serial Monitor</li>
          <li>Register any late players as they arrive</li>
          <li>Keep a backup of the database file (<code>data/tournament.db</code>)</li>
        </ul>

        <h3>Power Tips</h3>
        <ul>
          <li>ESP8266 boards can be powered from USB battery packs (5V/1A)</li>
          <li>A 10,000mAh battery pack runs a reader for ~10-15 hours</li>
          <li>Velcro or tape the reader + NodeMCU combo to each machine</li>
        </ul>

        <h2 id="troubleshooting">Troubleshooting</h2>

        <div className="troubleshoot-item">
          <h4>Reader won't connect to WiFi</h4>
          <ul>
            <li>Make sure you're on 2.4 GHz (not 5 GHz)</li>
            <li>Check SSID and password are correct</li>
            <li>Move closer to the router</li>
            <li>Some captive portals (hotel/airport WiFi) won't work &mdash; use your own hotspot</li>
          </ul>
        </div>

        <div className="troubleshoot-item">
          <h4>Badge scans but app doesn't show it</h4>
          <ul>
            <li>Check the Serial Monitor for HTTP error codes</li>
            <li>Verify the server IP is correct in the firmware</li>
            <li>Make sure port 3001 is not blocked by firewall</li>
            <li>Check that the Reader ID matches what's registered in the app</li>
          </ul>
        </div>

        <div className="troubleshoot-item">
          <h4>"Unknown Badge" response</h4>
          <ul>
            <li>The badge hasn't been assigned to a player yet</li>
            <li>Go to <strong>Players</strong> &gt; click <strong>Assign Badge</strong> on the player &gt; enter the badge UID</li>
          </ul>
        </div>

        <div className="troubleshoot-item">
          <h4>App won't launch on macOS</h4>
          <ul>
            <li>Right-click the app &gt; Open (bypasses Gatekeeper)</li>
            <li>Or: System Settings &gt; Privacy &amp; Security &gt; Open Anyway</li>
          </ul>
        </div>

        <div className="troubleshoot-item">
          <h4>Multiple badges triggering at once</h4>
          <ul>
            <li>Keep RFID readers at least 2 feet apart to avoid cross-reads</li>
            <li>Use metal foil between readers if they're mounted close together</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default InstallGuide;