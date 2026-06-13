import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = process.env.DB_FILE || path.join(__dirname, "data", "medication.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    timing TEXT NOT NULL,
    times TEXT NOT NULL,
    isImportant INTEGER NOT NULL DEFAULT 0,
    caution TEXT DEFAULT '',
    contraindication TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medication_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicineId INTEGER NOT NULL,
    medicineName TEXT NOT NULL,
    dosage TEXT NOT NULL,
    scheduledTime TEXT NOT NULL,
    actualTime TEXT,
    status TEXT NOT NULL CHECK (status IN ('DONE', 'SKIPPED', 'MISSED')),
    date TEXT NOT NULL,
    memo TEXT DEFAULT '',
    createdAt TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_history_once_per_slot
    ON medication_history (medicineId, scheduledTime, date);

  CREATE INDEX IF NOT EXISTS idx_history_date
    ON medication_history (date);
`);

export function serializeMedicine(row) {
  if (!row) return null;

  return {
    ...row,
    times: safeParseTimes(row.times),
    isImportant: Boolean(row.isImportant)
  };
}

export function serializeHistory(row) {
  if (!row) return null;

  return {
    ...row,
    isImportant: Boolean(row.isImportant)
  };
}

export function safeParseTimes(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
