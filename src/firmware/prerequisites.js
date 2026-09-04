const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { findPio, findEsptool, runStream, platformioAvailable } = require('./flasher');

// Output from the Windows "app execution alias" stub that just opens the
// Microsoft Store (signals Python is not actually installed).
const STORE_ALIAS_MARKERS = [
  'Python was not found',
  'Microsoft Store',
  'App execution aliases'
];

function isStoreAliasOutput(text) {
  const t = text.toLowerCase();
  return STORE_ALIAS_MARKERS.some((m) => t.includes(m.toLowerCase()));
}

// Ordered candidate interpreters.
function pythonCandidates() {
  const penv = path.join(os.homedir(), '.platformio', 'penv');
  if (process.platform === 'win32') {
    return [
      { cmd: path.join(penv, 'Scripts', 'python.exe'), args: [] },
      { cmd: 'py', args: ['-3'] },       // official Windows launcher
      { cmd: 'python', args: [] },
      { cmd: 'python3', args: [] }
    ];
  }
  return [
    { cmd: path.join(penv, 'bin', 'python3'), args: [] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] }
  ];
}

// Probe a candidate interpreter: it must exist AND actually run a real
// Python (i.e. not the Microsoft Store alias stub).
function probePython(candidate) {
  return new Promise((resolve) => {
    const child = spawn(candidate.cmd, [...candidate.args, '--version'], {});
    let out = '';
    const sink = (d) => (out += d.toString());
    child.stdout && child.stdout.on('data', sink);
    child.stderr && child.stderr.on('data', sink);

    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve(null);
    }, 10000);

    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const trimmed = out.trim();
      if (code !== 0 || !trimmed || isStoreAliasOutput(trimmed)) return resolve(null);
      const m = trimmed.match(/Python\s+(\d+\.\d+(\.[\d]+)?)/);
      resolve({
        cmd: candidate.cmd,
        args: candidate.args,
        version: m ? m[1] : trimmed
      });
    });
  });
}

// Find the first usable Python interpreter (Penv python, py launcher, python,
// python3). Returns { cmd, args, version } or null.
async function findUsablePython() {
  for (const candidate of pythonCandidates()) {
    try { if (fs.existsSync(candidate.cmd)) {} } catch (e) { /* ignore */ }
    const info = await probePython(candidate);
    if (info) return info;
  }
  return null;
}

// Locate a usable Python for display purposes (kept for backward-compat API).
function findPython() {
  return '';
}

async function pythonAvailable() {
  return (await findUsablePython()) !== null;
}

// Detect serial ports so we can surface whether a driver/device is present.
function serialPorts() {
  return new Promise((resolve) => {
    const pio = findPio();
    const child = spawn(pio, ['device', 'list'], {});
    let out = '';
    child.stdout && child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr && child.stderr.on('data', (d) => (out += d.toString()));
    child.on('error', () => resolve([]));
    child.on('close', () => {
      const ports = [];
      const blocks = out.split(/\n(?=\/dev\/)/);
      for (const block of blocks) {
        const lines = block.split(/\r?\n/);
        const port = lines.find((l) => /^\/dev\//.test(l.trim()) || /^COM\d+/.test(l.trim()));
        if (!port) continue;
        const hwid = lines.find((l) => /^Hardware ID:/i.test(l.trim()));
        ports.push({
          port: port.trim(),
          hardwareId: hwid ? hwid.split(':').slice(1).join(':').trim() : ''
        });
      }
      resolve(ports);
    });
  });
}

// Detect each prerequisite and return a status report.
async function checkPrereqs() {
  const [platformio, pythonInfo, ports] = await Promise.all([
    platformioAvailable(),
    findUsablePython(),
    serialPorts().catch(() => [])
  ]);

  const python = pythonInfo
    ? { installed: true, path: pythonInfo.cmd, version: pythonInfo.version }
    : { installed: false, path: null, version: null };

  if (!python.installed && process.platform === 'win32') {
    python.note = 'Python 3 was not found. Install it from python.org (check "Add Python to PATH" during setup), then retry. (The Microsoft Store "python" shortcut is NOT a real Python.)';
  } else if (!python.installed) {
    python.note = 'Python 3 was not found. Install it (e.g. `brew install python` or python.org) and retry.';
  }

  return {
    platform: process.platform,
    platformio: {
      installed: platformio,
      path: findPio()
    },
    python,
    esptool: {
      installed: platformio, // esptool ships with PlatformIO
      path: findEsptool()
    },
    serialPorts: ports,
    serialPortsPresent: ports.length > 0
  };
}

// Download get-platformio.py with Node's HTTPS (no Python needed for this
// step; Python is only needed to run the installer after).
function downloadInstaller(scriptPath, onLog) {
  return new Promise((resolve) => {
    const url = new URL('https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py');
    const req = https.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        onLog && onLog(`Failed to download PlatformIO installer: HTTP ${res.statusCode}`);
        return resolve(false);
      }
      const out = fs.createWriteStream(scriptPath);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(true)));
      out.on('error', () => {
        onLog && onLog('Failed to download PlatformIO installer: write error');
        resolve(false);
      });
    });
    req.on('error', (e) => {
      onLog && onLog('Failed to download PlatformIO installer: ' + e.message);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

// Install PlatformIO using its official cross-platform standalone installer.
// It downloads a private Python + PlatformIO into ~/.platformio/penv.
async function installPlatformio(onLog) {
  const python = await findUsablePython();
  if (!python) {
    onLog && onLog('Python 3 is required to run the PlatformIO installer, but none was found.');
    if (process.platform === 'win32') {
      onLog && onLog('On Windows: install Python from https://www.python.org/downloads/ and tick "Add Python to PATH" during setup.');
      onLog && onLog('Note: the "python" shortcut in the Microsoft Store is only a stub and will not work.');
      onLog && onLog('  - If `py` exists (installed with Python.org installer), this app will use it automatically.');
    } else {
      onLog && onLog('Install Python 3 (e.g. brew install python or apt install python3), then retry.');
    }
    return { code: 1, reason: 'no-python' };
  }

  onLog && onLog(`Using Python: ${python.cmd} ${python.args.join(' ')} (${python.version})`);
  onLog && onLog('Downloading PlatformIO standalone installer...');

  const scriptPath = path.join(os.tmpdir(), 'get-platformio.py');
  const ok = await downloadInstaller(scriptPath, onLog);
  if (!ok) return { code: 1, reason: 'download-failed' };

  onLog && onLog('Running PlatformIO installer (may take several minutes)...');
  const code = await runStream(python.cmd, [...python.args, scriptPath], {}, onLog);
  try { fs.unlinkSync(scriptPath); } catch (e) {}
  if (code === 0) {
    onLog && onLog('\nPlatformIO installed successfully.');
  } else {
    onLog && onLog('\nPlatformIO install reported a non-zero exit code.');
  }
  return { code };
}

module.exports = { checkPrereqs, installPlatformio, findPython, findUsablePython, pythonAvailable };