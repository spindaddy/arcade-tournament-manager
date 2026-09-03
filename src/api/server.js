const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/schema');

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

const db = getDatabase();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  const { name, email, phone } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO players (id, name, email, phone)
    VALUES (?, ?, ?, ?)
  `).run(id, name, email || null, phone || null);

  res.json({ id, name, email, phone });
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

// Get tournaments
app.get('/api/tournaments', (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
  res.json(tournaments);
});

// Create tournament
app.post('/api/tournaments', (req, res) => {
  const { name, description, start_date, end_date } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (id, name, description, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, start_date || null, end_date || null);

  res.json({ id, name, description, start_date, end_date });
});

// Get arcade machines
app.get('/api/machines', (req, res) => {
  const machines = db.prepare('SELECT * FROM arcade_machines ORDER BY name').all();
  res.json(machines);
});

// Register arcade machine
app.post('/api/machines', (req, res) => {
  const { name, reader_id, location } = req.body;

  if (!name || !reader_id) {
    return res.status(400).json({ error: 'name and reader_id required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO arcade_machines (id, name, reader_id, location)
    VALUES (?, ?, ?, ?)
  `).run(id, name, reader_id, location || null);

  res.json({ id, name, reader_id, location });
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

module.exports = app;
