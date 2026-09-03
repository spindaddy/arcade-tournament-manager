const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/schema');
const { scoreboardPageHtml } = require('./scoreboardPage');

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Live scoreboard web page
app.get('/', (req, res) => {
  res.type('html').send(scoreboardPageHtml());
});

const db = getDatabase();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// App settings (theme, etc.)
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const entries = req.body || {};
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  Object.keys(entries).forEach(key => stmt.run(key, String(entries[key])));
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// Consolidated app meta for web page + title
app.get('/api/meta', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
  const settings = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => { settings[r.key] = r.value; });
  res.json({ title: tournament ? tournament.name : 'Arcade Tournament', theme: settings.theme || 'dark', tournament });
});

// ESP32 RFID scan endpoint
app.post('/api/scan', (req, res) => {
  const { badge_uid, reader_id } = req.body;

  if (!badge_uid || !reader_id) {
    return res.status(400).json({ error: 'badge_uid and reader_id required' });
  }

  try {
    const logId = uuidv4();
    
    db.prepare(`
      INSERT INTO scan_logs (id, badge_uid, reader_id, scan_time, event_type)
      VALUES (?, ?, ?, datetime('now'), 'scan')
    `).run(logId, badge_uid, reader_id);

    const badge = db.prepare('SELECT * FROM badges WHERE rfid_uid = ?').get(badge_uid);
    const machine = db.prepare('SELECT * FROM arcade_machines WHERE reader_id = ?').get(reader_id);

    if (!badge || !badge.player_id) {
      return res.json({ 
        status: 'unknown_badge', 
        message: 'Badge not registered to any player',
        badge_uid 
      });
    }

    const activeSession = db.prepare(`
      SELECT * FROM game_sessions 
      WHERE player_id = ? AND end_time IS NULL
      ORDER BY start_time DESC LIMIT 1
    `).get(badge.player_id);

    if (activeSession) {
      if (activeSession.machine_id !== (machine ? machine.id : reader_id)) {
        db.prepare(`UPDATE game_sessions SET end_time = datetime('now') WHERE id = ?`)
          .run(activeSession.id);
        
        const newSessionId = uuidv4();
        db.prepare(`
          INSERT INTO game_sessions (id, player_id, machine_id, start_time)
          VALUES (?, ?, ?, datetime('now'))
        `).run(newSessionId, badge.player_id, machine ? machine.id : reader_id);

        return res.json({
          status: 'switched_game',
          player_id: badge.player_id,
          new_machine: machine ? machine.name : reader_id,
          previous_machine_id: activeSession.machine_id
        });
      }
      return res.json({
        status: 'already_checkedin',
        player_id: badge.player_id,
        machine: machine ? machine.name : reader_id
      });
    }

    const sessionId = uuidv4();
    db.prepare(`
      INSERT INTO game_sessions (id, player_id, machine_id, start_time)
      VALUES (?, ?, ?, datetime('now'))
    `).run(sessionId, badge.player_id, machine ? machine.id : reader_id);

    const player = db.prepare('SELECT name FROM players WHERE id = ?').get(badge.player_id);

    res.json({
      status: 'checked_in',
      player_name: player ? player.name : 'Unknown',
      machine: machine ? machine.name : reader_id,
      session_id: sessionId
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active sessions
app.get('/api/sessions/active', (req, res) => {
  const sessions = db.prepare(`
    SELECT 
      gs.id,
      gs.start_time,
      p.name as player_name,
      p.id as player_id,
      am.name as machine_name,
      am.reader_id
    FROM game_sessions gs
    JOIN players p ON gs.player_id = p.id
    LEFT JOIN arcade_machines am ON gs.machine_id = am.id
    WHERE gs.end_time IS NULL
    ORDER BY gs.start_time DESC
  `).all();

  res.json(sessions);
});

// Get all players
app.get('/api/players', (req, res) => {
  const players = db.prepare('SELECT * FROM players ORDER BY name').all();
  res.json(players);
});

// Register player
app.post('/api/players', (req, res) => {
  const { name, email, phone, twitch_name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO players (id, name, email, phone, twitch_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, email || null, phone || null, twitch_name || null);

  res.json({ id, name, email, phone, twitch_name });
});

// Update player
app.put('/api/players/:id', (req, res) => {
  const { name, email, phone, twitch_name } = req.body;
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  db.prepare(`UPDATE players SET name = ?, email = ?, phone = ?, twitch_name = ?, updated_at = datetime('now') WHERE id = ?`).run(name || player.name, email !== undefined ? email : player.email, phone !== undefined ? phone : player.phone, twitch_name !== undefined ? twitch_name : player.twitch_name, player.id);
  res.json(db.prepare('SELECT * FROM players WHERE id = ?').get(player.id));
});

// Delete player
app.delete('/api/players/:id', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  db.prepare(`DELETE FROM game_sessions WHERE player_id = ?`).run(player.id);
  db.prepare(`DELETE FROM tournament_players WHERE player_id = ?`).run(player.id);
  db.prepare(`DELETE FROM badges WHERE player_id = ?`).run(player.id);
  db.prepare(`DELETE FROM players WHERE id = ?`).run(player.id);
  res.json({ ok: true, id: player.id });
});

// Assign RFID badge to player
app.post('/api/badges/assign', (req, res) => {
  const { player_id, rfid_uid } = req.body;

  if (!player_id || !rfid_uid) {
    return res.status(400).json({ error: 'player_id and rfid_uid required' });
  }

  const existingBadge = db.prepare('SELECT * FROM badges WHERE rfid_uid = ?').get(rfid_uid);
  if (existingBadge) {
    return res.status(400).json({ error: 'Badge already assigned to another player' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO badges (id, rfid_uid, player_id)
    VALUES (?, ?, ?)
  `).run(id, rfid_uid, player_id);

  db.prepare('UPDATE players SET rfid_uid = ? WHERE id = ?').run(rfid_uid, player_id);

  res.json({ id, rfid_uid, player_id });
});

// Get tournaments (single current tournament)
app.get('/api/tournaments', (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
  res.json(tournaments.map(t => ({ ...t, single: true })));
});

// Create or update the single tournament
app.post('/api/tournaments', (req, res) => {
  const { name, description, start_date, end_date } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const existing = db.prepare('SELECT id FROM tournaments LIMIT 1').get();
  if (existing && !req.body.force) {
    return res.status(409).json({ error: 'Only one tournament is allowed. Use the edit control to update it.' });
  }

  if (existing) {
    db.prepare(`UPDATE tournaments SET name = ?, description = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`).run(name, description || null, start_date || null, end_date || null, existing.id);
    return res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(existing.id));
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (id, name, description, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, name, description || null, start_date || null, end_date || null);

  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id));
});

// Current tournament lookup (single record)
app.get('/api/tournament/current', (req, res) => {
  const row = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
  res.json(row || null);
});

app.put('/api/tournaments', (req, res) => {
  const { name, description, start_date, end_date } = req.body;
  const row = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
  if (!row) return res.status(404).json({ error: 'No tournament exists yet' });
  db.prepare(`UPDATE tournaments SET name = ?, description = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`).run(name || row.name, description !== undefined ? description : row.description, start_date !== undefined ? start_date : row.start_date, end_date !== undefined ? end_date : row.end_date, row.id);
  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(row.id));
});

// Get arcade machines
app.get('/api/machines', (req, res) => {
  const machines = db.prepare('SELECT * FROM arcade_machines ORDER BY name').all();
  res.json(machines);
});

// Register arcade machine
app.post('/api/machines', (req, res) => {
  const { name, reader_id, location, is_active } = req.body;

  if (!name || !reader_id) {
    return res.status(400).json({ error: 'name and reader_id required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO arcade_machines (id, name, reader_id, location, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, reader_id, location || null, is_active !== undefined ? (is_active ? 1 : 0) : 1);

  res.json({ id, name, reader_id, location });
});

// Update arcade machine
app.put('/api/machines/:id', (req, res) => {
  const { name, reader_id, location, is_active } = req.body;
  const machine = db.prepare('SELECT * FROM arcade_machines WHERE id = ?').get(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  db.prepare(`UPDATE arcade_machines SET name = ?, reader_id = ?, location = ?, is_active = ? WHERE id = ?`).run(name || machine.name, reader_id || machine.reader_id, location !== undefined ? location : machine.location, is_active !== undefined ? (is_active ? 1 : 0) : machine.is_active, machine.id);
  res.json(db.prepare('SELECT * FROM arcade_machines WHERE id = ?').get(machine.id));
});

// Delete arcade machine
app.delete('/api/machines/:id', (req, res) => {
  const machine = db.prepare('SELECT * FROM arcade_machines WHERE id = ?').get(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  db.prepare(`UPDATE game_sessions SET machine_id = NULL WHERE machine_id = ?`).run(machine.id);
  db.prepare(`DELETE FROM arcade_machines WHERE id = ?`).run(machine.id);
  res.json({ ok: true, id: machine.id });
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
  const activeSessions = db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE end_time IS NULL').get().count;
  const todayScans = db.prepare(`
    SELECT COUNT(*) as count FROM scan_logs 
    WHERE DATE(scan_time) = DATE('now')
  `).get().count;
  const activeTournaments = db.prepare(`
    SELECT COUNT(*) as count FROM tournaments WHERE status = 'active'
  `).get().count;

  res.json({
    playerCount,
    activeSessions,
    todayScans,
    activeTournaments
  });
});

// Scoreboard - rank players by total score
app.get('/api/scoreboard', (req, res) => {
  const rows = db.prepare(`
    SELECT
      p.id AS player_id,
      p.name AS player_name,
      COALESCE(SUM(gs.score), 0) AS total_score,
      COUNT(DISTINCT CASE WHEN gs.end_time IS NOT NULL THEN gs.id END) AS games_played,
      MAX(gs.score) AS best_score,
      COUNT(CASE WHEN gs.end_time IS NULL THEN 1 END) AS currently_playing
    FROM players p
    LEFT JOIN game_sessions gs ON gs.player_id = p.id
    GROUP BY p.id
    ORDER BY total_score DESC, best_score DESC
  `).all();

  const ranked = rows.map((row, index) => ({ rank: index + 1, ...row }));
  res.json(ranked);
});

// Add a score to a player's running total
app.post('/api/score', (req, res) => {
  const { player_id, score } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id required' });
  if (typeof score !== 'number' || isNaN(score)) return res.status(400).json({ error: 'score must be a number' });

  const player = db.prepare('SELECT id FROM players WHERE id = ?').get(player_id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const activeSession = db.prepare(`SELECT * FROM game_sessions WHERE player_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`).get(player_id);

  if (activeSession) {
    db.prepare(`UPDATE game_sessions SET score = ? WHERE id = ?`).run(score, activeSession.id);
    const updated = db.prepare(`SELECT score FROM game_sessions WHERE id = ?`).get(activeSession.id);
    return res.json({ ok: true, player_id, score: updated.score });
  }

  const sessionId = uuidv4();
  db.prepare(`INSERT INTO game_sessions (id, player_id, score, start_time) VALUES (?, ?, ?, datetime('now'))`).run(sessionId, player_id, score);
  res.json({ ok: true, player_id, score });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

module.exports = app;
