# Arcade Tournament Manager

A desktop application for managing arcade tournaments with RFID badge tracking. Players register, get assigned RFID badges, and scan in at arcade machines using ESP32 readers. The app tracks who is playing what in real-time.

## Features

- **Player Registration** - Sign up players and assign RFID badges
- **Tournament Management** - Create tournaments, track scores and brackets
- **Real-Time Game Tracking** - See who is playing which machine right now
- **RFID Badge System** - Players scan badges at machines to check in/out
- **ESP32 Integration** - WiFi-connected RFID readers report scans to the app
- **In-App Firmware Flashing** - Generate, build, and flash ESP32 firmware over USB from inside the app (installs PlatformIO/Python automatically)
- **OBS Live Player Names** - Push the current player's name to any OBS instance's text source per machine (obs-websocket 5.x)
- **Live Web Scoreboard** - `http://<ip>:3001/` rankings view for wall screens, with optional divisions
- **Dashboard** - Live stats: active players, scans today, current sessions
- **Cross-Platform** - Works on macOS, Windows, and Linux

## How It Works

```
Player scans RFID badge at machine
        |
        v
  ESP32 Reader reads badge UID
        |
        v
  POST to http://host:3001/api/scan
        |
        v
  Electron app logs scan, updates session tracking
        |
        v
  Dashboard shows player is now on that machine
```

## Download

Go to [Releases](https://github.com/spindaddy/arcade-tournament-manager/releases) and download the installer for your OS:

| Platform | File |
|----------|------|
| macOS (Intel) | `-mac-x64.dmg` |
| macOS (Apple Silicon) | `-mac-arm64.dmg` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` |

No additional software needs to be installed — Python and PlatformIO are
installed automatically by the app when you program your first ESP32 reader.

## Quick Start

1. Download and install the app for your OS
2. Launch the app
3. Register players and assign RFID badges
4. Register each arcade machine with its ESP32 reader ID
5. Go to **ESP32 Setup** and **ESP32 Program** to install the toolchain, generate
   firmware, and flash each ESP32 over USB (or use the manual example below)
6. Wire up the readers (see [INSTALL.md](INSTALL.md)) and they start reporting scans
7. Watch the dashboard for live activity; add an [OBS connection](INSTALL.md#obs-integration-live-player-names) for live player names

## ESP32 Firmware

A ready-to-use reference sketch is included in the repo:

```
esp32/arcade_rfid_reader/
  arcade_rfid_reader.ino   # Arduino IDE sketch
  platformio.ini           # PlatformIO configuration
```

This reads RFID badges, reports scans to the app, and beeps for 1 second on a
successful check-in (active buzzer on GPIO 4). The same firmware is generated
and flashed automatically by the app's **ESP32 Program** screen, so you normally
never need to open VS Code or the Arduino IDE.

- **In-app (recommended):** ESP32 Setup (auto-installs PlatformIO/Python) → ESP32 Program (Preview, Build & Flash, Serial Monitor)
- **Arduino IDE:** open `arcade_rfid_reader.ino`, set your WiFi credentials + server IP, flash
- **PlatformIO:** open the `esp32/arcade_rfid_reader/` folder in VS Code, click Upload

See [INSTALL.md](INSTALL.md) for full wiring diagrams, OBS and scoreboard setup.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/spindaddy/arcade-tournament-manager.git
cd arcade-tournament-manager
npm install
```

### Run in Development

```bash
npm start
```

This starts the API server (port 3001) and launches the Electron app.

### Build for Production

```bash
# Build renderer
npx vite build --config vite.config.js

# Build platform installer
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Build with GitHub Actions

Push a tag to trigger builds for all platforms:

```bash
git tag v1.0.0
git push --tags
```

Draft release with all platform binaries will be created automatically.

## Project Structure

```
arcade-tournament-manager/
  src/
    main/
      main.js            # Electron main process + embedded API server
      preload.js          # Secure IPC bridge
    api/
      server.js           # Standalone API server (for dev)
    database/
      schema.js           # SQLite schema + database setup
    firmware/
      generator.js        # ESP32 firmware generator (.ino + platformio.ini)
      prerequisites.js    # Python detection/install, PlatformIO install
      routes.js           # Firmware build/flash/monitor API routes
    obs/
      obs.js              # obs-websocket 5.x client (multi-server)
      routes.js           # OBS server CRUD + test/update routes
    renderer/
      App.jsx             # React app with routing
      index.html          # Entry HTML
      main.jsx            # React entry point
      index.css           # Global styles
      components/
        Dashboard.jsx     # Live stats overview
        Players.jsx       # Player registration + badge assignment
        Tournaments.jsx   # Tournament creation and management
        Machines.jsx      # Arcade machine registration
        ObsSetup.jsx      # OBS server configuration
        Esp32Setup.jsx    # Toolchain prerequisites (Python/PlatformIO)
        Esp32Program.jsx  # Firmware generate/build/flash/serial monitor
        ActiveSessions.jsx # Real-time active game tracking
  dist/renderer/          # Built React app (generated)
  release/                # Built installers (generated)
```

## API Endpoints

The app runs an Express API server on port 3001. ESP32 devices use these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Report an RFID badge scan |
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/players` | List all players |
| POST | `/api/players` | Register a new player |
| POST | `/api/badges/assign` | Assign RFID badge to player |
| GET | `/api/tournaments` | List tournaments |
| POST | `/api/tournaments` | Create a tournament |
| GET | `/api/machines` | List arcade machines |
| POST | `/api/machines` | Register an arcade machine |
| GET | `/api/sessions/active` | List active game sessions |

Additional endpoints back the OBS connection and ESP32 tooling screens
(`/api/obs/*` server CRUD + test/push, `/firmware/*` prerequisites, preview,
flash, ports, serial monitor streaming).

### Scan Request

```json
POST /api/scan
{
  "badge_uid": "AA:BB:CC:DD:EE:FF",
  "reader_id": "reader-01"
}
```

### Scan Responses

```json
{ "status": "checked_in", "player_name": "John", "machine": "Pac-Man" }
{ "status": "switched_game", "player_name": "John", "new_machine": "Galaga" }
{ "status": "already_checkedin", "player_name": "John", "machine": "Pac-Man" }
{ "status": "unknown_badge", "badge_uid": "AA:BB:CC:DD:EE:FF" }
```

## Tech Stack

- **Electron 35** - Desktop app framework
- **React 18** - UI components
- **Vite 5** - Build tooling
- **Express** - API server for ESP32 communication
- **SQLite** (better-sqlite3) - Local database
- **ESP32 + MFRC522** - RFID badge readers

## License

MIT
