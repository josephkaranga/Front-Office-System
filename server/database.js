/**
 * ============================================================
 *  DATABASE ADAPTER — Dual Mode (Supabase / SQLite)
 * ============================================================
 *
 *  This module initializes and exposes the database connection.
 *  It supports two modes:
 *
 *  1. SUPABASE (cloud) — Uses @supabase/supabase-js client.
 *     Required for Vercel deployment (no filesystem).
 *     Set DB_MODE=supabase in .env
 *
 *  2. LOCAL (offline) — Uses sql.js (SQLite in-memory with
 *     file persistence). Great for desktop/Electron use.
 *     Set DB_MODE=local in .env
 *
 *  Both modes expose the same interface via db-helper.js
 * ============================================================
 */

const config = require('./config');

let sb = null;      // Supabase client instance
let localDb = null; // SQLite adapter instance
let mode = 'local'; // Active mode

/**
 * Initialize the database based on DB_MODE config.
 * Must be called once before any queries.
 */
async function initDatabase() {
  if (config.DB_MODE === 'supabase' && config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_')) {
    const { createClient } = require('@supabase/supabase-js');
    sb = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
    mode = 'supabase';
    console.log('Connected to Supabase.');
  } else {
    localDb = await initLocal();
    mode = 'local';
    console.log('Using local SQLite database.');
  }
}

/** Get the Supabase client instance */
function getSupabase() { return sb; }

/** Check if running in Supabase mode */
function isSupabase() { return mode === 'supabase'; }

/** Get the local SQLite adapter */
function getLocalDb() { return localDb; }

// ── Local SQLite Initialization ──────────────────────────────
async function initLocal() {
  const initSqlJs = require('sql.js');
  const path = require('path');
  const fs = require('fs');

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'kyshakez.db');

  // Load or create database
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(dbPath)) { db = new SQL.Database(fs.readFileSync(dbPath)); }
  else { db = new SQL.Database(); }
  db.run('PRAGMA foreign_keys = ON');

  // Debounced save to disk (avoids excessive I/O)
  function saveDb() { fs.writeFileSync(dbPath, Buffer.from(db.export())); }
  let saveTimer = null;
  function debouncedSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveDb, 500); }

  /** Convert sql.js statement results to array of objects */
  function stmtToRows(stmt) {
    const rows = []; const cols = stmt.getColumnNames();
    while (stmt.step()) { const v = stmt.get(); const row = {}; cols.forEach((c, i) => { row[c] = v[i]; }); rows.push(row); }
    stmt.free(); return rows;
  }

  // ── Schema: Create all tables if they don't exist ──
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'receptionist', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), last_login TEXT)`,
    `CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, login_time TEXT DEFAULT (datetime('now')), logout_time TEXT, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, room_number TEXT UNIQUE NOT NULL, room_type TEXT NOT NULL, floor INTEGER NOT NULL, capacity INTEGER NOT NULL DEFAULT 2, rate_per_night REAL NOT NULL, rate_double REAL, status TEXT NOT NULL DEFAULT 'available', description TEXT, amenities TEXT, image_url TEXT)`,
    `CREATE TABLE IF NOT EXISTS guests (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, id_type TEXT, id_number TEXT, nationality TEXT, phone TEXT, email TEXT, address TEXT, vip_status TEXT DEFAULT 'regular', notes TEXT, registered_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, guest_id INTEGER NOT NULL, room_id INTEGER NOT NULL, checkin_date TEXT NOT NULL, checkout_date TEXT, expected_checkout TEXT NOT NULL, num_guests INTEGER DEFAULT 1, stay_type TEXT DEFAULT 'night', car_registration TEXT, purpose TEXT, status TEXT DEFAULT 'checked_in', checked_in_by INTEGER, checked_out_by INTEGER, special_requests TEXT, original_rate REAL, charged_rate REAL, discount_per_night REAL DEFAULT 0, discount_reason TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (guest_id) REFERENCES guests(id), FOREIGN KEY (room_id) REFERENCES rooms(id))`,
    `CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, guest_id INTEGER NOT NULL, room_id INTEGER NOT NULL, reservation_date TEXT DEFAULT (datetime('now')), checkin_date TEXT NOT NULL, checkout_date TEXT NOT NULL, num_guests INTEGER DEFAULT 1, stay_type TEXT DEFAULT 'night', status TEXT DEFAULT 'confirmed', notes TEXT, created_by INTEGER, car_registration TEXT, FOREIGN KEY (guest_id) REFERENCES guests(id), FOREIGN KEY (room_id) REFERENCES rooms(id))`,
    `CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, checkin_id INTEGER, reservation_id INTEGER, guest_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, payment_date TEXT DEFAULT (datetime('now')), reference_number TEXT, description TEXT, status TEXT DEFAULT 'completed', received_by INTEGER, transaction_id TEXT, FOREIGN KEY (guest_id) REFERENCES guests(id))`,
    `CREATE TABLE IF NOT EXISTS extras (id INTEGER PRIMARY KEY AUTOINCREMENT, checkin_id INTEGER NOT NULL, category TEXT NOT NULL, item_name TEXT NOT NULL, quantity INTEGER DEFAULT 1, unit_price REAL NOT NULL, total_price REAL NOT NULL, notes TEXT, added_by INTEGER, added_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (checkin_id) REFERENCES checkins(id), FOREIGN KEY (added_by) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS housekeeping (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL, task_type TEXT NOT NULL DEFAULT 'cleaning', priority TEXT DEFAULT 'normal', status TEXT DEFAULT 'pending', assigned_to INTEGER, notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')), started_at TEXT, completed_at TEXT, FOREIGN KEY (room_id) REFERENCES rooms(id), FOREIGN KEY (assigned_to) REFERENCES users(id), FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ];
  tables.forEach(t => db.run(t));

  // Default settings
  const defaults = [['hotel_name','KYSHAKEZ'],['hotel_tagline','Front Office System'],['currency','KES'],['country','Kenya'],['timezone','Africa/Nairobi']];
  for (const [k,v] of defaults) { try { db.run(`INSERT INTO settings (key,value) VALUES ('${k}','${v}')`); } catch(e){} }

  // Indexes for query performance
  try { db.run('CREATE INDEX IF NOT EXISTS idx_checkins_status ON checkins(status)'); } catch(e){}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)'); } catch(e){}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)'); } catch(e){}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(last_name, first_name)'); } catch(e){}
  saveDb();

  // ── SQLite Adapter Interface ──
  // Matches the API used by db-helper.js
  return {
    /** Prepare a SQL statement with positional params (?) */
    prepare(sql) {
      return {
        run(...params) { db.run(sql, params); debouncedSave(); const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]; return { lastInsertRowid: lastId, changes: db.getRowsModified() }; },
        get(...params) { const stmt = db.prepare(sql); if (params.length > 0) stmt.bind(params); return stmtToRows(stmt)[0] || null; },
        all(...params) { const stmt = db.prepare(sql); if (params.length > 0) stmt.bind(params); return stmtToRows(stmt); },
      };
    },
    exec(sql) { db.run(sql); debouncedSave(); },
    transaction(fn) {
      return (...args) => { db.run('BEGIN TRANSACTION'); try { const r = fn(...args); db.run('COMMIT'); debouncedSave(); return r; } catch (e) { db.run('ROLLBACK'); throw e; } };
    },
  };
}

module.exports = { initDatabase, getSupabase, isSupabase, getLocalDb };
