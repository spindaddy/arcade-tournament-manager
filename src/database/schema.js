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
      machine_id TEXT NOT NULL,
      tournament_id TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      score INTEGER DEFAULT 0,
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (machine_id) REFERENCES arcade_machines(id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );
  `);
}

module.exports = { getDatabase };
