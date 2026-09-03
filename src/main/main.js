const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

const Store = require('electron-store');
const store = new Store();

let mainWindow;

function getDataDir() {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '../../public/icon.png')
  });

  const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');

  if (fs.existsSync(rendererPath)) {
    mainWindow.loadFile(rendererPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const dataDir = getDataDir();
  process.env.DATA_DIR = dataDir;

  createWindow();

  startApiServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

function startApiServer() {
  try {
    const express = require('express');
    const cors = require('cors');
    const { v4: uuidv4 } = require('uuid');
    const Database = require('better-sqlite3');
    const { scoreboardPageHtml } = require('../api/scoreboardPage');

    const apiApp = express();
    const PORT = 3001;
    const dataDir = getDataDir();
    const DB_PATH = path.join(dataDir, 'tournament.db');

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Live scoreboard web page
    apiApp.get('/', (req, res) => {
      res.type('html').send(scoreboardPageHtml());
    });

    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        twitch_name TEXT,
        rfid_uid TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY,
        rfid_uid TEXT UNIQUE NOT NULL,
        player_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATETIME,
        end_date DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tournament_players (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
      CREATE TABLE IF NOT EXISTS arcade_machines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reader_id TEXT UNIQUE NOT NULL,
        location TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS scan_logs (
        id TEXT PRIMARY KEY,
        badge_uid TEXT NOT NULL,
        reader_id TEXT NOT NULL,
        scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT DEFAULT 'checkin',
        FOREIGN KEY (badge_uid) REFERENCES badges(rfid_uid),
        FOREIGN KEY (reader_id) REFERENCES arcade_machines(reader_id)
      );
      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        machine_id TEXT,
        tournament_id TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        score INTEGER DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (machine_id) REFERENCES arcade_machines(id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Migration: add twitch_name column to players if missing
    try {
      const playerCols = db.prepare(`PRAGMA table_info(players)`).all();
      if (!playerCols.find(c => c.name === 'twitch_name')) {
        db.exec(`ALTER TABLE players ADD COLUMN twitch_name TEXT`);
      }
    } catch (migrationError) {
      console.error('twitch_name migration skipped:', migrationError.message);
    }

    // Migration: ensure machine_id is nullable on game_sessions
    try {
      const cols = db.prepare(`PRAGMA table_info(game_sessions)`).all();
      const machineCol = cols.find(c => c.name === 'machine_id');
      if (machineCol && machineCol.notnull === 1) {
        db.exec(`ALTER TABLE game_sessions RENAME TO game_sessions_old;`);
        db.exec(`
          CREATE TABLE game_sessions (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            machine_id TEXT,
            tournament_id TEXT,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            score INTEGER DEFAULT 0,
            FOREIGN KEY (player_id) REFERENCES players(id),
            FOREIGN KEY (machine_id) REFERENCES arcade_machines(id),
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
          );
        `);
        db.exec(`INSERT INTO game_sessions (id, player_id, machine_id, tournament_id, start_time, end_time, score) SELECT id, player_id, machine_id, tournament_id, start_time, end_time, score FROM game_sessions_old;`);
        db.exec(`DROP TABLE game_sessions_old;`);
      }
    } catch (migrationError) {
      console.error('game_sessions migration skipped:', migrationError.message);
    }

    apiApp.use(cors());
    apiApp.use(express.json());

    apiApp.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // App settings (theme, etc.)
    apiApp.get('/api/settings', (req, res) => {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      rows.forEach(r => { settings[r.key] = r.value; });
      res.json(settings);
    });

    apiApp.put('/api/settings', (req, res) => {
      const entries = req.body || {};
      const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
      Object.keys(entries).forEach(key => stmt.run(key, String(entries[key])));
      const rows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      rows.forEach(r => { settings[r.key] = r.value; });
      res.json(settings);
    });

    // Consolidated app meta for web page + title
    apiApp.get('/api/meta', (req, res) => {
      const tournament = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
      const settingsRows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      settingsRows.forEach(r => { settings[r.key] = r.value; });
      res.json({ title: tournament ? tournament.name : 'Arcade Tournament', theme: settings.theme || 'dark', tournament });
    });

    apiApp.post('/api/scan', (req, res) => {
      const { badge_uid, reader_id } = req.body;
      if (!badge_uid || !reader_id) {
        return res.status(400).json({ error: 'badge_uid and reader_id required' });
      }
      try {
        const logId = uuidv4();
        db.prepare(`INSERT INTO scan_logs (id, badge_uid, reader_id, scan_time, event_type) VALUES (?, ?, ?, datetime('now'), 'scan')`).run(logId, badge_uid, reader_id);

        const badge = db.prepare('SELECT * FROM badges WHERE rfid_uid = ?').get(badge_uid);
        const machine = db.prepare('SELECT * FROM arcade_machines WHERE reader_id = ?').get(reader_id);

        if (!badge || !badge.player_id) {
          return res.json({ status: 'unknown_badge', message: 'Badge not registered to any player', badge_uid });
        }

        const activeSession = db.prepare(`SELECT * FROM game_sessions WHERE player_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`).get(badge.player_id);

        if (activeSession) {
          if (activeSession.machine_id !== (machine ? machine.id : reader_id)) {
            db.prepare(`UPDATE game_sessions SET end_time = datetime('now') WHERE id = ?`).run(activeSession.id);
            const newSessionId = uuidv4();
            db.prepare(`INSERT INTO game_sessions (id, player_id, machine_id, start_time) VALUES (?, ?, ?, datetime('now'))`).run(newSessionId, badge.player_id, machine ? machine.id : reader_id);
            return res.json({ status: 'switched_game', player_id: badge.player_id, new_machine: machine ? machine.name : reader_id, previous_machine_id: activeSession.machine_id });
          }
          return res.json({ status: 'already_checkedin', player_id: badge.player_id, machine: machine ? machine.name : reader_id });
        }

        const sessionId = uuidv4();
        db.prepare(`INSERT INTO game_sessions (id, player_id, machine_id, start_time) VALUES (?, ?, ?, datetime('now'))`).run(sessionId, badge.player_id, machine ? machine.id : reader_id);
        const player = db.prepare('SELECT name FROM players WHERE id = ?').get(badge.player_id);
        res.json({ status: 'checked_in', player_name: player ? player.name : 'Unknown', machine: machine ? machine.name : reader_id, session_id: sessionId });
      } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    apiApp.get('/api/sessions/active', (req, res) => {
      const sessions = db.prepare(`SELECT gs.id, gs.start_time, p.name as player_name, p.id as player_id, am.name as machine_name, am.reader_id FROM game_sessions gs JOIN players p ON gs.player_id = p.id LEFT JOIN arcade_machines am ON gs.machine_id = am.id WHERE gs.end_time IS NULL ORDER BY gs.start_time DESC`).all();
      res.json(sessions);
    });

    apiApp.get('/api/players', (req, res) => {
      res.json(db.prepare('SELECT * FROM players ORDER BY name').all());
    });

    apiApp.post('/api/players', (req, res) => {
      const { name, email, phone, twitch_name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const id = uuidv4();
      db.prepare(`INSERT INTO players (id, name, email, phone, twitch_name) VALUES (?, ?, ?, ?, ?)`).run(id, name, email || null, phone || null, twitch_name || null);
      res.json({ id, name, email, phone, twitch_name });
    });

    apiApp.post('/api/badges/assign', (req, res) => {
      const { player_id, rfid_uid } = req.body;
      if (!player_id || !rfid_uid) return res.status(400).json({ error: 'player_id and rfid_uid required' });
      const existingBadge = db.prepare('SELECT * FROM badges WHERE rfid_uid = ?').get(rfid_uid);
      if (existingBadge) return res.status(400).json({ error: 'Badge already assigned to another player' });
      const id = uuidv4();
      db.prepare(`INSERT INTO badges (id, rfid_uid, player_id) VALUES (?, ?, ?)`).run(id, rfid_uid, player_id);
      db.prepare('UPDATE players SET rfid_uid = ? WHERE id = ?').run(rfid_uid, player_id);
      res.json({ id, rfid_uid, player_id });
    });

    apiApp.get('/api/tournaments', (req, res) => {
      const rows = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
      res.json(rows.map(t => ({ ...t, single: true })));
    });

    apiApp.post('/api/tournaments', (req, res) => {
      const { name, description, start_date, end_date } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const existing = db.prepare('SELECT id FROM tournaments LIMIT 1').get();
      if (existing && !req.body.force) {
        return res.status(409).json({ error: 'Only one tournament is allowed. Use the edit control to update it.' });
      }
      if (existing) {
        db.prepare(`UPDATE tournaments SET name = ?, description = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`).run(name, description || null, start_date || null, end_date || null, existing.id);
        const updated = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(existing.id);
        return res.json(updated);
      }
      const id = uuidv4();
      db.prepare(`INSERT INTO tournaments (id, name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, 'active')`).run(id, name, description || null, start_date || null, end_date || null);
      const created = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
      res.json(created);
    });

    // Current tournament lookup (single record)
    apiApp.get('/api/tournament/current', (req, res) => {
      const row = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
      res.json(row || null);
    });

    apiApp.put('/api/tournaments', (req, res) => {
      const { name, description, start_date, end_date } = req.body;
      const row = db.prepare('SELECT * FROM tournaments LIMIT 1').get();
      if (!row) return res.status(404).json({ error: 'No tournament exists yet' });
      db.prepare(`UPDATE tournaments SET name = ?, description = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`).run(name || row.name, description !== undefined ? description : row.description, start_date !== undefined ? start_date : row.start_date, end_date !== undefined ? end_date : row.end_date, row.id);
      const updated = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(row.id);
      res.json(updated);
    });

    apiApp.get('/api/machines', (req, res) => {
      res.json(db.prepare('SELECT * FROM arcade_machines ORDER BY name').all());
    });

    apiApp.post('/api/machines', (req, res) => {
      const { name, reader_id, location } = req.body;
      if (!name || !reader_id) return res.status(400).json({ error: 'name and reader_id required' });
      const id = uuidv4();
      db.prepare(`INSERT INTO arcade_machines (id, name, reader_id, location) VALUES (?, ?, ?, ?)`).run(id, name, reader_id, location || null);
      res.json({ id, name, reader_id, location });
    });

    apiApp.get('/api/stats', (req, res) => {
      const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
      const activeSessions = db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE end_time IS NULL').get().count;
      const todayScans = db.prepare(`SELECT COUNT(*) as count FROM scan_logs WHERE DATE(scan_time) = DATE('now')`).get().count;
      const activeTournaments = db.prepare(`SELECT COUNT(*) as count FROM tournaments WHERE status = 'active'`).get().count;
      res.json({ playerCount, activeSessions, todayScans, activeTournaments });
    });

    apiApp.get('/api/scoreboard', (req, res) => {
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

    apiApp.post('/api/score', (req, res) => {
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

    apiApp.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start API server:', error);
  }
}

ipcMain.handle('get-store', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
  store.set(key, value);
});
