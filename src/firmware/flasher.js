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
  const homedir = os.homedir();
  const pkgs = path.join(homedir, '.platformio', 'packages', 'tool-esptoolpy');
  const penvBin = path.join(homedir, '.platformio', 'penv', 'bin');
  if (process.platform === 'win32') {
    for (const c of [
      path.join(pkgs, 'esptool.exe'),
      path.join(homedir, '.platformio', 'penv', 'Scripts', 'esptool.exe'),
      path.join(homedir, '.platformio', 'penv', 'Scripts', 'esptool.py')
    ]) {
      if (fs.existsSync(c)) return c;
    }
    return 'esptool.exe';
  }
  for (const c of [
    path.join(pkgs, 'esptool.py'),
    path.join(pkgs, 'esptool'),
    path.join(penvBin, 'esptool.py'),
    path.join(penvBin, 'esptool')
  ]) {
    if (fs.existsSync(c)) return c;
  }
  return 'esptool.py'; // fall back to PATH
}

// Penv interpreter used to run esptool.py.
function findPenvPython() {
  const base = path.join(os.homedir(), '.platformio', 'penv');
  if (process.platform === 'win32') {
    return path.join(base, 'Scripts', 'python.exe');
  }
  const posix = path.join(base, 'bin', 'python3');
  return fs.existsSync(posix) ? posix : path.join(base, 'bin', 'python');
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

// Identify the chip on a serial port using esptool (`chip_id`).
// Returns { ok, chipType, module, chipId, mac, error, output }.
function probeChip(port) {
  return new Promise((resolve) => {
    let child, out = '', done = false;

    const finish = (extra) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child && child.kill(); } catch (e) { /* ignore */ }
      const text = out;
      const chipTypeMatch = text.match(/detecting chip type\.\.\.\s*(\S+)/i);
      const moduleMatch = text.match(/Chip is\s+([^(]+)/i);
      const chipIdMatch = text.match(/chip [iI]d:\s*(?:0x)?([0-9a-f]+)/i);
      const macMatch = text.match(/MAC:\s*([0-9a-f:]+)/i);
      const fatal = /fatal error|failed to connect|no compatible chip/i.test(text);

      const chipType = chipTypeMatch ? chipTypeMatch[1] : null;
      const module = moduleMatch ? moduleMatch[1].trim() : null;
      const ok = !fatal && !!(chipType || module);

      return resolve({
        ok,
        chipType,
        module: module || chipType || null,
        chipId: chipIdMatch ? chipIdMatch[1] : null,
        mac: macMatch ? macMatch[1] : null,
        error: ok ? null : (extra.error || 'Could not identify the chip.'),
        output: text.trim()
      });
    };

    try {
      const esptool = findEsptool();
      const isPy = /\.py$/i.test(esptool);
      const cmd = isPy ? findPenvPython() : esptool;
      const args = isPy ? [esptool, '--port', port, 'chip_id'] : ['--port', port, 'chip_id'];
      child = spawn(cmd, args, {});
    } catch (e) {
      return finish({ error: e.message });
    }

    const onData = (d) => (out += d.toString());
    child.stdout && child.stdout.on('data', onData);
    child.stderr && child.stderr.on('data', onData);
    child.on('error', (err) => finish({ error: err.message }));
    child.on('close', (code) => finish({ error: code === 0 ? null : `esptool exited with code ${code}` }));

    const timer = setTimeout(() => finish({ error: 'Timed out waiting for the chip.' }), 25000);
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
    s = serial.Serial('${port.replace(/'/g, "\\'")}', 74880, timeout=0.1)
    sys.stdout.write('Listening on ${port.replace(/'/g, "\\'")} @ 74880...\\n')
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

module.exports = { findPio, findEsptool, platformioAvailable, buildFirmware, flashFirmware, runStream, listPorts, probeChip, startMonitor };
