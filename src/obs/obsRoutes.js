const express = require('express');
const { v4: uuidv4 } = require('uuid');
const obsManager = require('./obsManager');

function registerObsRoutes(app, db) {
  const router = express.Router();

  function toSafeServer(row) {
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      password: row.password ? '******' : '',
      connected: obsManager.clientStatus(row.id)
    };
  }

  // List all OBS servers (password masked).
  router.get('/servers', (req, res) => {
    const rows = db.prepare('SELECT * FROM obs_servers ORDER BY name').all();
    res.json(rows.map(toSafeServer));
  });

  // Get a single server.
  router.get('/servers/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Server not found' });
    res.json(toSafeServer(row));
  });

  // Create a server.
  router.post('/servers', (req, res) => {
    const { name, host, port, password } = req.body || {};
    if (!name || !host) return res.status(400).json({ error: 'name and host required' });
    const id = uuidv4();
    db.prepare(`INSERT INTO obs_servers (id, name, host, port, password) VALUES (?, ?, ?, ?, ?)`)
      .run(id, name, host, parseInt(port, 10) || 4455, password || '');
    res.json({ ok: true, id });
  });

  // Update a server.
  router.put('/servers/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Server not found' });
    const { name, host, port, password } = req.body || {};
    // If the password wasn't sent (masked), keep the existing one.
    const newPassword = password === undefined || password === '******' ? row.password : password;
    db.prepare(`UPDATE obs_servers SET name = ?, host = ?, port = ?, password = ? WHERE id = ?`)
      .run(name || row.name, host || row.host, parseInt(port, 10) || row.port, newPassword, row.id);
    obsManager.disconnect(row.id);
    res.json(db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(row.id));
  });

  // Delete a server and detach any machines using it.
  router.delete('/servers/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Server not found' });
    db.prepare(`UPDATE arcade_machines SET obs_server_id = NULL WHERE obs_server_id = ?`).run(row.id);
    obsManager.disconnect(row.id);
    db.prepare(`DELETE FROM obs_servers WHERE id = ?`).run(row.id);
    res.json({ ok: true, id: row.id });
  });

  // Test connection to a specific server.
  router.post('/test', async (req, res) => {
    const { serverId } = req.body || {};
    const row = serverId
      ? db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(serverId)
      : db.prepare('SELECT * FROM obs_servers ORDER BY name LIMIT 1').get();
    if (!row) return res.json({ ok: false, error: 'No OBS server configured' });
    try {
      const result = await obsManager.testConnection(row);
      res.json({ ok: true, serverId: row.id, result });
    } catch (e) {
      res.json({ ok: false, serverId: row.id, error: e.message || e.code || 'Connection failed' });
    }
  });

  // Push sample text to a source on a specific server.
  router.post('/test-update', async (req, res) => {
    const { serverId, sourceName } = req.body || {};
    if (!sourceName) return res.json({ ok: false, error: 'sourceName is required' });
    const row = serverId
      ? db.prepare('SELECT * FROM obs_servers WHERE id = ?').get(serverId)
      : db.prepare('SELECT * FROM obs_servers ORDER BY name LIMIT 1').get();
    if (!row) return res.json({ ok: false, error: 'No OBS server configured' });
    try {
      await obsManager.updateTextSource(row, sourceName, 'Test Player - ' + new Date().toLocaleTimeString());
      res.json({ ok: true, serverId: row.id, sourceName });
    } catch (e) {
      res.json({ ok: false, serverId: row.id, error: e.message || e.code || 'Update failed' });
    }
  });

  // Disconnect one (or all) servers.
  router.post('/disconnect', (req, res) => {
    const { serverId } = req.body || {};
    if (serverId) obsManager.disconnect(serverId);
    else obsManager.disconnectAll();
    res.json({ ok: true });
  });

  app.use('/api/obs', router);
}

module.exports = { registerObsRoutes };