import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

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
`);

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
