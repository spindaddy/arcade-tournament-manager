const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findPio, findEsptool, runStream, platformioAvailable } = require('./flasher');

// Locate a usable Python. Prefer PlatformIO's own env python, then system python.
function findPython() {
  const candidates = process.platform === 'win32'
    ? [
        path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'python.exe'),
        'python'
      ]
    : [
        path.join(os.homedir(), '.platformio', 'penv', 'bin', 'python3'),
        'python3',
        'python'
      ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }
  return 'python3';
}

function pythonAvailable() {
  return new Promise((resolve) => {
    const child = spawn(findPython(), ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
    setTimeout(() => { try { child.kill(); } catch (e) {} resolve(false); }, 10000);
  });
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
  const [platformio, python, ports] = await Promise.all([
    platformioAvailable(),
    pythonAvailable(),
    serialPorts().catch(() => [])
  ]);

  return {
    platform: process.platform,
    platformio: {
      installed: platformio,
      path: findPio()
    },
    python: {
      installed: python,
      path: findPython()
    },
    esptool: {
      installed: platformio, // esptool ships with PlatformIO
      path: findEsptool()
    },
    serialPorts: ports,
    serialPortsPresent: ports.length > 0
  };
}

// Install PlatformIO using its official cross-platform standalone installer.
// It downloads a private Python + PlatformIO into ~/.platformio/penv, no admin.
async function installPlatformio(onLog) {
  const python = findPython();
  onLog && onLog(`Using Python: ${python}`);
  onLog && onLog('Downloading PlatformIO standalone installer...');

  const scriptPath = path.join(os.tmpdir(), 'get-platformio.py');
  const download = spawn(python, ['-c', `
import urllib.request, ssl
ctx = ssl._create_unverified_context()
url = "https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py"
data = urllib.request.urlopen(url, timeout=120, context=ctx).read()
open(${JSON.stringify(scriptPath)}, "wb").write(data)
print("Installer downloaded.")
`], {});
  let dlerr = '';
  download.stderr && download.stderr.on('data', (d) => { dlerr += d.toString(); });
  const dlCode = await new Promise((resolve) => {
    download.on('error', () => resolve(-1));
    download.on('close', resolve);
  });
  if (dlCode !== 0) {
    onLog && onLog('Failed to download PlatformIO installer: ' + (dlerr || 'network error'));
    return { code: dlCode };
  }

  onLog && onLog('Running PlatformIO installer (may take several minutes)...');
  const code = await runStream(python, [scriptPath], {}, onLog);
  try { fs.unlinkSync(scriptPath); } catch (e) {}
  if (code === 0) {
    onLog && onLog('\nPlatformIO installed successfully.');
  } else {
    onLog && onLog('\nPlatformIO install reported a non-zero exit code.');
  }
  return { code };
}

module.exports = { checkPrereqs, installPlatformio, findPython, pythonAvailable };
