const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/tournament.db');

let db;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      twitch_name TEXT,
      division TEXT,
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
      obs_source_name TEXT,
      obs_server_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS obs_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 4455,
      password TEXT,
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
    if (!playerCols.find(c => c.name === 'division')) {
      db.exec(`ALTER TABLE players ADD COLUMN division TEXT`);
    }
  } catch (migrationError) {
    console.error('twitch_name migration skipped:', migrationError.message);
  }

  // Migration: add obs_source_name to arcade_machines
  try {
    const machineCols = db.prepare(`PRAGMA table_info(arcade_machines)`).all();
    if (!machineCols.find(c => c.name === 'obs_source_name')) {
      db.exec(`ALTER TABLE arcade_machines ADD COLUMN obs_source_name TEXT`);
    }
    if (!machineCols.find(c => c.name === 'obs_server_id')) {
      db.exec(`ALTER TABLE arcade_machines ADD COLUMN obs_server_id TEXT`);
    }
  } catch (migrationError) {
    console.error('obs_source_name migration skipped:', migrationError.message);
  }

  // Migration: create obs_servers table for databases predating it
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS obs_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 4455,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (migrationError) {
    console.error('obs_servers migration skipped:', migrationError.message);
  }

  // Migration: import legacy single-OBS settings (obs_host/obs_port/obs_password) into a default server
  try {
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM obs_servers').get().count;
    if (serverCount === 0) {
      const row = db.prepare('SELECT key, value FROM settings WHERE key = ?').get('obs_host');
      if (row && row.value) {
        const portRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('obs_port');
        const passRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('obs_password');
        const { v4: uuidv4 } = require('uuid');
        db.prepare(`INSERT INTO obs_servers (id, name, host, port, password) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), 'Default', row.value, parseInt(portRow && portRow.value, 10) || 4455, (passRow && passRow.value) || '');
      }
      // Point machines that had an OBS source at the default server
      if (row && row.value) {
        const defaultServer = db.prepare('SELECT id FROM obs_servers ORDER BY created_at LIMIT 1').get();
        if (defaultServer) {
          db.prepare(`UPDATE arcade_machines SET obs_server_id = ? WHERE obs_source_name IS NOT NULL`).run(defaultServer.id);
        }
      }
    }
  } catch (migrationError) {
    console.error('obs_servers settings migration skipped:', migrationError.message);
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
}

module.exports = { getDatabase };
