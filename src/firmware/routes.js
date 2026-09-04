const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { platformioAvailable, buildFirmware, flashFirmware, findPio, findEsptool, listPorts, startMonitor } = require('./flasher');
const { checkPrereqs, installPlatformio } = require('./prerequisites');
const { generateIno } = require('./generator');

// In-memory flash job store. Both the standalone API and the Electron server
// are single-process, so module state is fine.
const jobs = new Map();
// Serial monitor handles (to allow stop)
const monitors = new Map();

function registerFirmwareRoutes(app) {
  const router = express.Router();

  // Check that the flash tooling is present.
  router.get('/status', async (req, res) => {
    const available = await platformioAvailable();
    res.json({ available, pio: findPio(), esptool: findEsptool() });
  });

  // List available serial ports.
  router.get('/ports', async (req, res) => {
    const ports = await listPorts();
    res.json({ ports });
  });

  // Check for ESP32-programming prerequisites.
  router.get('/prereqs', async (req, res) => {
    const report = await checkPrereqs();
    res.json(report);
  });

  // Install PlatformIO (the main prerequisite). Streaming install job.
  router.post('/prereqs/install', (req, res) => {
    const id = uuidv4();
    const job = { id, lines: [], status: 'running', since: new Date().toISOString() };
    jobs.set(id, job);
    const onLog = (line) => {
      job.lines.push(line);
      if (job.lines.length > 5000) job.lines.splice(0, job.lines.length - 5000);
    };
    installPlatformio(onLog).then(async (result) => {
      // The installer may exit non-zero on an optional final step (e.g. shell
      // command setup). Re-check whether PlatformIO is actually usable before
      // deciding success.
      const usable = await platformioAvailable();
      job.status = (result.code === 0 || usable) ? 'success' : 'error';
      job.result = { code: result.code, installed: usable };
    }).catch((err) => {
      job.status = 'error';
      job.result = { code: -1, error: err.message };
    });
    res.json({ id, status: 'running' });
  });

  // Return the .ino that WOULD be generated (no build, no flash).
  router.post('/preview', (req, res) => {
    res.json({ ino: generateIno(req.body || {}) });
  });

  // Start a build+flash job. Body: { config, flash (bool) }.
  router.post('/flash', (req, res) => {
    const { config, flash } = req.body || {};
    const id = uuidv4();
    const job = {
      id,
      lines: [],
      status: 'running',
      result: null,
      since: new Date().toISOString()
    };
    jobs.set(id, job);

    const onLog = (line) => {
      job.lines.push(line);
      if (job.lines.length > 5000) job.lines.splice(0, job.lines.length - 5000);
    };

    const runner = flash ? flashFirmware(config, onLog) : buildFirmware(config, onLog);

    runner.then((result) => {
      job.status = result.code === 0 ? 'success' : 'error';
      job.result = result;
    }).catch((err) => {
      job.status = 'error';
      job.result = { code: -1, error: err.message };
    });

    res.json({ id, status: 'running' });
  });

  // SSE stream for a flash job.
  router.get('/flash/:id/stream', (req, res) => {
    const job = jobs.get(req.params.id);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(': connected\n\n');

    // Send any lines already buffered, then any new ones.
    let index = 0;
    const send = () => {
      while (index < job.lines.length) {
        const line = job.lines[index++];
        res.write(`data: ${JSON.stringify({ type: 'line', line })}\n\n`);
      }
      if (job.status !== 'running') {
        res.write(`data: ${JSON.stringify({ type: 'done', status: job.status })}\n\n`);
        res.end();
      }
    };

    const timer = setInterval(() => {
      send();
      if (job.status !== 'running') {
        clearInterval(timer);
      }
    }, 150);

    req.on('close', () => clearInterval(timer));
  });

  // Polling status fallback.
  router.get('/flash/:id/status', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'job not found' });
    res.json({ status: job.status, lines: job.lines, result: job.result });
  });

  // Start a serial monitor on a port. Body: { port }
  router.post('/monitor/start', (req, res) => {
    const { port } = req.body || {};
    if (!port) return res.status(400).json({ error: 'port required' });
    const id = uuidv4();
    const job = { id, lines: [], status: 'running', since: new Date().toISOString() };
    jobs.set(id, job);
    const handle = startMonitor(port, (line) => {
      job.lines.push(line);
      if (job.lines.length > 10000) job.lines.splice(0, job.lines.length - 10000);
    });
    monitors.set(id, handle);
    res.json({ id, status: 'running' });
  });

  // Stop a running serial monitor.
  router.post('/monitor/:id/stop', (req, res) => {
    const id = req.params.id;
    const handle = monitors.get(id);
    const job = jobs.get(id);
    if (handle) handle.stop();
    if (job) job.status = 'stopped';
    monitors.delete(id);
    res.json({ ok: true });
  });

  app.use('/api/firmware', router);
}

module.exports = { registerFirmwareRoutes, jobs, monitors };
