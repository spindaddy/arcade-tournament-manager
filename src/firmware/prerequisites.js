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

// Python version we install on Windows when none is present.
const PYTHON_VERSION = '3.12.8';

// Where the silent per-user python.org install lands.
function pythonInstallDir() {
  if (process.platform !== 'win32') return null;
  const majorMinor = PYTHON_VERSION.split('.').slice(0, 2).join('');
  return path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', `Python${majorMinor}`);
}

// Ordered candidate interpreters.
function pythonCandidates() {
  const penv = path.join(os.homedir(), '.platformio', 'penv');
  if (process.platform === 'win32') {
    const selfInstalled = pythonInstallDir();
    const candidates = [
      { cmd: path.join(penv, 'Scripts', 'python.exe'), args: [] }
    ];
    if (selfInstalled && fs.existsSync(path.join(selfInstalled, 'python.exe'))) {
      candidates.push({ cmd: path.join(selfInstalled, 'python.exe'), args: [] });
    }
    candidates.push({ cmd: 'py', args: ['-3'] });       // official Windows launcher
    candidates.push({ cmd: 'python', args: [] });
    candidates.push({ cmd: 'python3', args: [] });
    return candidates;
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

// Download a file over HTTPS with Node (no Python needed). Streams progress.
function downloadFile(url, destPath, onLog) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        onLog && onLog(`Server responded HTTP ${res.statusCode} for ${url}`);
        return resolve(false);
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total && Math.floor(received / (1024 * 1024)) !== Math.floor((received - chunk.length) / (1024 * 1024))) {
          onLog && onLog(`  ${Math.floor(received / (1024 * 1024))}/${Math.floor(total / (1024 * 1024))} MB`);
        }
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(true)));
      out.on('error', () => {
        onLog && onLog('Download failed: write error');
        resolve(false);
      });
    });
    req.on('error', (e) => {
      onLog && onLog('Download failed: ' + e.message);
      resolve(false);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// Download get-platformio.py (Python is only needed to run it afterwards).
async function downloadInstaller(scriptPath, onLog) {
  const url = 'https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py';
  return downloadFile(url, scriptPath, onLog);
}

// Install PlatformIO using its official cross-platform standalone installer.
// It downloads a private Python + PlatformIO into ~/.platformio/penv.
async function installPlatformio(onLog) {
  const python = await findUsablePython();
  if (!python) {
    onLog && onLog('Python 3 is required to run the PlatformIO installer, but none was found.');
    if (process.platform === 'win32') {
      onLog && onLog('  -> Click "Install Python" on the ESP32 Setup screen and this app will install it automatically.');
      onLog && onLog('  -> Or install it from https://www.python.org/downloads/ and tick "Add Python to PATH" during setup.');
      onLog && onLog('Note: the "python" shortcut in the Microsoft Store is only a stub and will not work.');
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

// Install Python 3 on Windows silently (per-user, no admin) using the
// official python.org installer. Works when no Python is present at all.
async function installPython(onLog) {
  if (process.platform !== 'win32') {
    onLog && onLog('Automatic Python install is only supported on Windows.');
    onLog && onLog('On macOS/Linux install Python 3 (e.g. brew install python or apt install python3), then re-check.');
    return { code: 1, reason: 'unsupported-platform' };
  }

  const archUrl = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const url = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-${archUrl}.exe`;
  onLog && onLog(`Python 3 not found. Downloading ${url.split('/').join('/').slice(0, 90)}...`);

  const exePath = path.join(os.tmpdir(), `python-${PYTHON_VERSION}-installer.exe`);
  const downloaded = await downloadFile(url, exePath, onLog);
  if (!downloaded) {
    onLog && onLog('Failed to download the Python installer. Check your internet connection and retry.');
    return { code: 1, reason: 'download-failed' };
  }

  onLog && onLog('Running silent installer (per-user, adds Python to PATH)...');
  const code = await runStream(exePath, [
    '/quiet',
    'InstallAllUsers=0',
    'PrependPath=1',
    'Include_launcher=1',
    'Include_pip=1',
    'Include_test=0',
    'SimpleInstall=1'
  ], {}, onLog);
  try { fs.unlinkSync(exePath); } catch (e) {}

  if (code === 0) {
    const dir = pythonInstallDir();
    // Make the fresh Python visible to this app without a restart.
    if (dir && fs.existsSync(dir)) {
      const add = dir + ';' + path.join(dir, 'Scripts');
      for (const key of ['Path', 'PATH', 'Path_HKLM', 'Path_HKLM_current']) {
        const cur = process.env[key];
        if (cur !== undefined && !cur.includes(dir)) process.env[key] = add + ';' + cur;
      }
    }
    const usable = await findUsablePython();
    onLog && onLog(usable
      ? `\nPython installed: ${usable.cmd} ${usable.args.join(' ')} (${usable.version})`
      : '\nPython installer finished but the install could not be verified.');
    return { code: usable ? 0 : 1, dir: dir || null };
  }
  onLog && onLog('\nPython installer reported a non-zero exit code. It may have been blocked — try installing from python.org manually.');
  return { code };
}

module.exports = { checkPrereqs, installPlatformio, installPython, findPython, findUsablePython, pythonAvailable };