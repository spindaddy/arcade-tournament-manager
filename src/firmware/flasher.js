const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeWorkspace } = require('./generator');

// Locate the PlatformIO CLI. Prefer the common install under ~/.platformio/penv,
// otherwise fall back to whatever is on PATH.
function findPio() {
  const candidates = [];
  const penv = path.join(os.homedir(), '.platformio', 'penv', 'bin');
  if (process.platform === 'win32') {
    candidates.push(path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'platformio.exe'));
    candidates.push(path.join(penv, 'platformio.exe'));
  } else {
    candidates.push(path.join(penv, 'pio'));
    candidates.push(path.join(penv, 'platformio'));
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }
  return 'pio'; // fall back to PATH
}

function findEsptool() {
  const penv = path.join(os.homedir(), '.platformio', 'penv', 'bin');
  if (process.platform === 'win32') {
    const c = path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'esptool.py');
    return fs.existsSync(c) ? c : 'esptool.py';
  }
  const c = path.join(penv, 'esptool.py');
  return fs.existsSync(c) ? c : 'esptool.py';
}

function platformioAvailable() {
  return new Promise((resolve) => {
    const pio = findPio();
    const child = spawn(pio, ['--version'], { stdio: 'ignore' });
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
      child = spawn(cmd, args, { ...opts });
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
  onLog && onLog('\nFlashing to ESP32 over USB...');
  const flashCode = (await runStream(pio, args, {}, onLog)).code;
  return { code: flashCode, dir, flashed: flashCode === 0 };
}

// List serial ports. Optionally probe each with esptool to flag ESP32 device ports.
function listPorts() {
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
        const port = lines.find((l) => /^\/dev\//.test(l.trim()));
        if (!port) continue;
        const description = lines.find((l) => /^Description:/i.test(l.trim()));
        const hwid = lines.find((l) => /^Hardware ID:/i.test(l.trim()));
        const text = (port + ' ' + (description || '') + ' ' + (hwid || '')).toLowerCase();
        ports.push({
          port: port.trim(),
          description: description ? description.split(':').slice(1).join(':').trim() : '',
          hardwareId: hwid ? hwid.split(':').slice(1).join(':').trim() : '',
          likelyEsp32: /esp32|cp210|ch34|silicon|ftdi|debug-console|usb/i.test(text)
        });
      }
      resolve(ports);
    });
  });
}

// Start a raw serial monitor on the given port (streams to onLog).
// Reads directly with pyserial (Python in the PlatformIO env) because
// `pio device monitor` requires a TTY that isn't available when spawned
// from the Node app.
function startMonitor(port, onLog) {
  const py = process.platform === 'win32'
    ? path.join(os.homedir(), '.platformio', 'penv', 'Scripts', 'python.exe')
    : path.join(os.homedir(), '.platformio', 'penv', 'bin', 'python3');

  const script = `
import serial, sys, time
try:
    s = serial.Serial('${port.replace(/'/g, "\\'")}', 115200, timeout=0.1)
    sys.stdout.write('Listening on ${port.replace(/'/g, "\\'")} @ 115200...\\n')
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
    child = spawn(py, ['-c', script], {});
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

module.exports = { findPio, findEsptool, platformioAvailable, buildFirmware, flashFirmware, runStream, listPorts, startMonitor };
