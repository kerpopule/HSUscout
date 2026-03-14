import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPin } from './lib/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scout.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS pit_data (
    team_number INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    last_updated INTEGER NOT NULL,
    source_device TEXT
  );

  CREATE TABLE IF NOT EXISTS match_data (
    id TEXT PRIMARY KEY,
    match_number INTEGER NOT NULL,
    team_number INTEGER NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    source_device TEXT,
    UNIQUE(match_number, team_number, timestamp)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tba_cache (
    cache_key TEXT PRIMARY KEY,
    etag TEXT,
    data TEXT NOT NULL,
    status INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL
  );
`);

// Clean up old single-PIN key
db.prepare('DELETE FROM app_settings WHERE key = ?').run('pin_hash');

// Seed edit PIN (8778) and admin PIN (1123) if not present
const editPinExists = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('edit_pin_hash') as { value: string } | undefined;
if (!editPinExists) {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('edit_pin_hash', hashPin('8778'));
}
const adminPinExists = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('admin_pin_hash') as { value: string } | undefined;
if (!adminPinExists) {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('admin_pin_hash', hashPin('1123'));
}

export const upsertPitData = db.prepare(`
  INSERT INTO pit_data (team_number, data, last_updated, source_device)
  VALUES (@team_number, @data, @last_updated, @source_device)
  ON CONFLICT(team_number) DO UPDATE SET
    data = CASE WHEN @last_updated > pit_data.last_updated THEN @data ELSE pit_data.data END,
    last_updated = CASE WHEN @last_updated > pit_data.last_updated THEN @last_updated ELSE pit_data.last_updated END,
    source_device = CASE WHEN @last_updated > pit_data.last_updated THEN @source_device ELSE pit_data.source_device END
`);

export const getAllPitData = db.prepare('SELECT team_number, data FROM pit_data');

export const insertMatchData = db.prepare(`
  INSERT OR IGNORE INTO match_data (id, match_number, team_number, data, timestamp, source_device)
  VALUES (@id, @match_number, @team_number, @data, @timestamp, @source_device)
`);

export const getAllMatchData = db.prepare('SELECT data FROM match_data ORDER BY timestamp DESC');

export const getSetting = db.prepare('SELECT value FROM app_settings WHERE key = ?');
export const setSetting = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (@key, @value)');

export const getTbaCache = db.prepare('SELECT etag, data, status, fetched_at FROM tba_cache WHERE cache_key = ?');
export const setTbaCache = db.prepare(`
  INSERT INTO tba_cache (cache_key, etag, data, status, fetched_at)
  VALUES (@cache_key, @etag, @data, @status, @fetched_at)
  ON CONFLICT(cache_key) DO UPDATE SET
    etag = excluded.etag,
    data = excluded.data,
    status = excluded.status,
    fetched_at = excluded.fetched_at
`);

export const deletePitByTeam = db.prepare('DELETE FROM pit_data WHERE team_number = ?');
export const deleteMatchById = db.prepare('DELETE FROM match_data WHERE id = ?');

export const updatePitData = db.prepare(`
  UPDATE pit_data SET data = @data, last_updated = @last_updated, source_device = @source_device
  WHERE team_number = @team_number
`);

export const updateMatchData = db.prepare(`
  UPDATE match_data SET data = @data, match_number = @match_number, team_number = @team_number,
  timestamp = @timestamp, source_device = @source_device WHERE id = @id
`);

export const clearAllData = db.transaction(() => {
  db.exec('DELETE FROM pit_data');
  db.exec('DELETE FROM match_data');
});

export const bulkSync = db.transaction((items: { type: 'pit' | 'match'; payload: any }[]) => {
  for (const item of items) {
    if (item.type === 'pit') {
      upsertPitData.run(item.payload);
    } else {
      insertMatchData.run(item.payload);
    }
  }
});

export default db;
