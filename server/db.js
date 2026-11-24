import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'ashcore.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    reg_no TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    state TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,
    period_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT,
    note TEXT,
    previous_version_id TEXT,
    payload TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_company
    ON snapshots(company_id, period_label, period_type);
`);

const statements = {
  listCompanies: db.prepare(
    'SELECT id, name, reg_no AS regNo, created_at AS createdAt, updated_at AS updatedAt FROM companies ORDER BY updated_at DESC'
  ),
  getCompany: db.prepare(
    'SELECT id, name, reg_no AS regNo, created_at AS createdAt, updated_at AS updatedAt, state FROM companies WHERE id = ?'
  ),
  insertCompany: db.prepare(
    'INSERT INTO companies (name, reg_no, created_at, updated_at, state) VALUES (?, ?, ?, ?, ?)'
  ),
  updateCompanyState: db.prepare(
    'UPDATE companies SET state = ?, updated_at = ?, name = ?, reg_no = ? WHERE id = ?'
  ),
  deleteCompany: db.prepare('DELETE FROM companies WHERE id = ?'),

  listSnapshots: db.prepare(
    `SELECT id, period_label AS periodLabel, period_type AS periodType, version,
            created_at AS createdAt, created_by AS createdBy, note,
            previous_version_id AS previousVersionId
     FROM snapshots WHERE company_id = ? ORDER BY created_at DESC`
  ),
  getSnapshot: db.prepare(
    `SELECT id, company_id AS companyId, period_label AS periodLabel, period_type AS periodType, version,
            created_at AS createdAt, created_by AS createdBy, note,
            previous_version_id AS previousVersionId, payload
     FROM snapshots WHERE company_id = ? AND id = ?`
  ),
  insertSnapshot: db.prepare(
    `INSERT INTO snapshots
       (id, company_id, period_label, period_type, version, created_at, created_by, note, previous_version_id, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  deleteSnapshot: db.prepare('DELETE FROM snapshots WHERE company_id = ? AND id = ?'),
};

export { db, statements };
