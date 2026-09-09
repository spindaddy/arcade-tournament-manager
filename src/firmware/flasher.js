const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeWorkspace } = require('./generator');

function spawnOpts(cmd, extra = {}) {
  const opts = { windowsHide: true, ...extra };
  if (process.platform === 'win32' && typeof cmd === 'string' && /\.(cmd|bat)$/i.test(cmd)) {
    opts.shell = true;
  }
  return opts;
}

function findPioPython() {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'python.exe');
  }
  return path.join(os.homedir(), '.platformio', 'penv', 'bin', 'python3');
}

// Locate the PlatformIO CLI. Prefer the common install under ~/.platformio/penv,
// otherwise fall back to whatever is on PATH.
function findPio() {
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? [
        path.join(home, '.platformio', 'penv', 'Scripts', 'platformio.exe'),
        path.join(home, '.platformio', 'penv', 'Scripts', 'pio.exe'),
        path.join(home, '.platformio', 'penv', 'Scripts', 'platformio.cmd'),
        path.join(home, '.platformio', 'penv', 'Scripts', 'pio.cmd')
      ]
    : [
        path.join(home, '.platformio', 'penv', 'bin', 'pio'),
        path.join(home, '.platformio', 'penv', 'bin', 'platformio')
      ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }
  return process.platform === 'win32' ? 'platformio.exe' : 'pio';
}

function platformioAvailable() {
  return new Promise((resolve) => {
    const pio = findPio();
    const child = spawn(pio, ['--version'], spawnOpts(pio, { stdio: 'ignore' }));
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
    setTimeout(() => { child.kill(); resolve(false); }, 10000);
  });
}

// Run a command and stream each stdout/stderr line to onLog.
// Returns a promise resolving {code}.
function runStream(cmd, args, opts, onLog) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, spawnOpts(cmd, { ...opts }));
    } catch (e) {
      onLog && onLog(`[error] ${e.message}`);
      return resolve({ code: -1 });
    }

    const emit = (data) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);
      for (const l of lines) {
        if (l.trim()) onLog && onLog(l);
      }
    };
    child.stdout && child.stdout.on('data', emit);
    child.stderr && child.stderr.on('data', emit);

    child.on('error', (err) => {
      onLog && onLog(`[error] ${err.message}`);
      resolve({ code: -1 });
    });
    child.on('close', (code) => resolve({ code }));
  });
}

// Compile the firmware (no flash). Returns { code, dir }.
async function buildFirmware(config, onLog) {
  const dir = path.join(os.tmpdir(), 'atm-firmware-' + Date.now());
  const { inoPath } = writeWorkspace(dir, config);
  onLog && onLog(`Generated firmware: ${inoPath}`);
  onLog && onLog(`Building with PlatformIO (this may take a while on first run)...`);
  const pio = findPio();
  return {
    code: (await runStream(pio, ['run', '--project-dir', dir], {}, onLog)).code,
    dir
  };
}

// Build then flash over USB.
async function flashFirmware(config, onLog) {
  const { code: buildCode, dir } = await buildFirmware(config, onLog);
  if (buildCode !== 0) {
    onLog && onLog('\nBuild failed — not flashing.');
    return { code: buildCode, dir, flashed: false };
  }
  const pio = findPio();
  const args = ['run', '--project-dir', dir, '-t', 'upload'];
  if (config.port) {
    args.push('--upload-port', config.port);
    onLog && onLog(`\nUsing serial port: ${config.port}`);
  }
  onLog && onLog('\nFlashing to reader over USB...');
  const tail = [];
  const onLogTail = (l) => {
    tail.push(l);
    if (tail.length > 25) tail.shift();
    onLog && onLog(l);
  };
  const flashCode = (await runStream(pio, args, {}, onLogTail)).code;
  if (flashCode !== 0) {
    const blob = tail.join('\n');
    if (/Invalid head of packet|Failed to connect|No response|Cannot open port|readiness to read|already in use|timed out/i.test(blob)) {
      onLog && onLog('\nHint: the board did not enter its bootloader (or the port is busy).');
      onLog && onLog('  1) Unplug and replug the USB cable to power-cycle the board.');
      onLog && onLog('  2) Click Build &amp; Flash again, and when the log shows "Connecting...." tap the RST button once.');
      onLog && onLog('  (If RST is hard to reach: hold FLASH, tap RST once, release FLASH, then flash.');
      onLog && onLog('   Some NodeMCU clones do not wire the auto-reset pins, so a manual reset is required.)');
    }
  }
  return { code: flashCode, dir, flashed: flashCode === 0 };
}

function spawnCapture(cmd, args, extra = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, spawnOpts(cmd, extra));
    } catch (e) {
      return resolve({ code: -1, out: '' });
    }
    let out = '';
    child.stdout && child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr && child.stderr.on('data', (d) => (out += d.toString()));
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} }, 15000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, out: '' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

function asArray(parsed) {
  if (parsed == null || parsed === '') return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function tagPorts(ports) {
  return (ports || []).map((p) => {
    const port = String(p.port || p.device || '').trim();
    const description = p.description || '';
    const hardwareId = p.hardwareId || p.hwid || '';
    const text = `${port} ${description} ${hardwareId}`.toLowerCase();
    return {
      port,
      description,
      hardwareId,
      likelyReader: /esp32|esp8266|cp210|ch34|silicon|ftdi|usb.?serial|usb.?uart|wch|qinheng/i.test(text)
    };
  }).filter((p) => {
    if (!p.port) return false;
    const lower = p.port.toLowerCase();
    if (/bluetooth|debug-console|wlan/.test(lower)) return false;
    // macOS lists both /dev/cu.* and /dev/tty.*; flashing uses cu.
    if (process.platform === 'darwin' && /^\/dev\/tty\./.test(p.port)) return false;
    return true;
  });
}

function parsePioText(out) {
  const ports = [];
  let current = null;
  for (const raw of String(out || '').split(/\r?\n/)) {
    const line = raw.trim();
    const portMatch = line.match(/^(\/dev\/\S+|COM\d+)$/i);
    if (portMatch) {
      if (current) ports.push(current);
      current = { port: portMatch[1], description: '', hardwareId: '' };
      continue;
    }
    if (!current) continue;
    if (/^Description:/i.test(line)) {
      current.description = line.split(':').slice(1).join(':').trim();
    } else if (/^Hardware ID:/i.test(line)) {
      current.hardwareId = line.split(':').slice(1).join(':').trim();
    }
  }
  if (current) ports.push(current);
  return ports;
}

async function listPortsPyserial() {
  const script = [
    'import json,sys',
    'try:',
    ' from serial.tools.list_ports import comports',
    'except ImportError:',
    ' sys.stdout.write(json.dumps({"ok":False}))',
    ' sys.exit(0)',
    'ports=[{"port":p.device,"description":p.description or "","hardwareId":p.hwid or ""} for p in comports()]',
    'sys.stdout.write(json.dumps({"ok":True,"ports":ports}))'
  ].join('\n');

  const candidates = [];
  const pioPy = findPioPython();
  if (fs.existsSync(pioPy)) candidates.push({ cmd: pioPy, args: ['-c', script] });
  if (process.platform === 'win32') {
    candidates.push({ cmd: 'py', args: ['-3', '-c', script] });
    candidates.push({ cmd: 'python', args: ['-c', script] });
  } else {
    candidates.push({ cmd: 'python3', args: ['-c', script] });
    candidates.push({ cmd: 'python', args: ['-c', script] });
  }

  for (const c of candidates) {
    const { out } = await spawnCapture(c.cmd, c.args);
    const lines = String(out || '').trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed && parsed.ok) return tagPorts(parsed.ports || []);
      } catch (e) { /* not json */ }
    }
  }
  return null;
}

async function listPortsPio() {
  const pio = findPio();
  const jsonResult = await spawnCapture(pio, ['device', 'list', '--json-output']);
  try {
    const parsed = JSON.parse(String(jsonResult.out || '').trim().split(/\r?\n/).filter(Boolean).pop());
    if (parsed) {
      return tagPorts(asArray(parsed).map((p) => ({
        port: p.port || p.device,
        description: p.description || '',
        hardwareId: p.hwid || p.hardwareId || ''
      })));
    }
  } catch (e) { /* fall through to text */ }
  const textResult = jsonResult.out && /COM\d+|\/dev\//i.test(jsonResult.out)
    ? jsonResult
    : await spawnCapture(pio, ['device', 'list']);
  return tagPorts(parsePioText(textResult.out));
}

async function listPortsWindows() {
  const ps = [
    "$ErrorActionPreference='SilentlyContinue'",
    '$items=@()',
    "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object {",
    "  $m=[regex]::Match($_.Name,'COM\\d+')",
    '  if ($m.Success) { $items += [pscustomobject]@{ port=$m.Value; description=$_.Name; hardwareId=$_.PNPDeviceID } }',
    '}',
    'if ($items.Count -eq 0) {',
    '  Get-CimInstance Win32_SerialPort | ForEach-Object {',
    '    $items += [pscustomobject]@{ port=$_.DeviceID; description=$_.Description; hardwareId=$_.PNPDeviceID }',
    '  }',
    '}',
    "if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress }"
  ].join('\n');
  const { out } = await spawnCapture('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  try {
    const parsed = JSON.parse(String(out || '').trim() || '[]');
    return tagPorts(asArray(parsed));
  } catch (e) {
    return [];
  }
}

// List serial ports, flagging those that look like reader/USB devices.
// Windows COM ports were previously ignored because parsing only matched /dev/.
async function listPorts() {
  const fromPy = await listPortsPyserial();
  if (fromPy && fromPy.length) return fromPy;
  if (process.platform === 'win32') {
    const win = await listPortsWindows();
    if (win.length) return win;
  }
  const fromPio = await listPortsPio();
  if (fromPio && fromPio.length) return fromPio;
  return fromPy || [];
}

// Start a raw serial monitor on the given port (streams to onLog).
// Reads directly with pyserial (Python in the PlatformIO env) because
// `pio device monitor` requires a TTY that isn't available when spawned
// from the Node app. Defaults to 115200 (the firmware's Serial.begin rate);
// 74880 is useful only for the ESP8266 ROM boot log after a reset.
function startMonitor(port, onLog, baud = 115200) {
  const py = fs.existsSync(findPioPython())
    ? findPioPython()
    : (process.platform === 'win32' ? 'python' : 'python3');

  const script = `
import serial, sys, time
try:
    s = serial.Serial('${port.replace(/'/g, "\\'")}', ${baud}, timeout=0.1)
    sys.stdout.write('Listening on ${port.replace(/'/g, "\\'")} @ ${baud}...\\n')
    sys.stdout.flush()
    while True:
        data = s.read(4096)
        if data:
            sys.stdout.write(data.decode('utf-8', errors='replace'))
            sys.stdout.flush()
except KeyboardInterrupt:
    sys.stdout.write('\\n[monitor stopped]\\n')
    sys.stdout.flush()
except Exception as e:
    sys.stderr.write('Serial error: %s\\n' % e)
`.trim();

  let child;
  try {
    child = spawn(py, ['-c', script], spawnOpts(py));
  } catch (e) {
    onLog && onLog(`[error] ${e.message}`);
    return { child: null, stop() {} };
  }

  const emit = (data) => {
    const text = data.toString();
    const lines = text.split(/\r?\n/);
    for (const l of lines) {
      if (l.trim()) onLog && onLog(l);
    }
  };
  child.stdout && child.stdout.on('data', emit);
  child.stderr && child.stderr.on('data', emit);
  child.on('error', (err) => onLog && onLog(`[error] ${err.message}`));
  child.on('close', (code) => onLog && onLog(`\n[monitor closed, code ${code}]`));

  let stopped = false;
  return {
    child,
    stop() {
      if (stopped) return;
      stopped = true;
      try { child.kill('SIGINT'); } catch (e) {}
      try { setTimeout(() => child.kill('SIGKILL'), 2000); } catch (e) {}
    }
  };
}

module.exports = { findPio, platformioAvailable, buildFirmware, flashFirmware, runStream, listPorts, startMonitor };
