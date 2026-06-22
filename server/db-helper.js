/**
 * ============================================================
 *  DATABASE HELPER — Unified Query Interface
 * ============================================================
 *
 *  Provides async CRUD methods that work identically on both
 *  Supabase and local SQLite. All route handlers use this
 *  instead of querying the database directly.
 *
 *  Methods:
 *    findAll(table, options)  → Array of rows
 *    findOne(table, where)   → Single row or null
 *    insert(table, row)      → Inserted row with ID
 *    update(table, where, data) → Updated rows
 *    count(table, where)     → Integer count
 *
 *  Route handlers also use isSB(), sb(), local() for
 *  complex queries that can't be abstracted.
 * ============================================================
 */

const { getSupabase, isSupabase, getLocalDb } = require('./database');

function sb() { return getSupabase(); }
function local() { return getLocalDb(); }
function isSB() { return isSupabase(); }

/**
 * Find all rows matching conditions.
 * @param {string} table - Table name
 * @param {Object} options - { where, like, order, limit, select }
 */
async function findAll(table, { where = {}, like = {}, order, limit, select = '*' } = {}) {
  if (isSB()) {
    let q = sb().from(table).select(select);
    for (const [k, v] of Object.entries(where)) { q = q.eq(k, v); }
    for (const [k, v] of Object.entries(like)) { q = q.ilike(k, `%${v}%`); }
    if (order) q = q.order(order.col, { ascending: order.asc !== false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } else {
    let sql = `SELECT ${select === '*' ? '*' : select} FROM ${table}`;
    const conds = []; const params = [];
    for (const [k, v] of Object.entries(where)) { conds.push(`${k} = ?`); params.push(v); }
    for (const [k, v] of Object.entries(like)) { conds.push(`${k} LIKE ?`); params.push(`%${v}%`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    if (order) sql += ` ORDER BY ${order.col} ${order.asc === false ? 'DESC' : 'ASC'}`;
    if (limit) { sql += ' LIMIT ?'; params.push(limit); }
    return local().prepare(sql).all(...params);
  }
}

/**
 * Find one row by exact match.
 * @param {string} table - Table name
 * @param {Object} where - { column: value } pairs
 */
async function findOne(table, where = {}, select = '*') {
  if (isSB()) {
    let q = sb().from(table).select(select);
    for (const [k, v] of Object.entries(where)) { q = q.eq(k, v); }
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
  } else {
    let sql = `SELECT * FROM ${table}`;
    const conds = []; const params = [];
    for (const [k, v] of Object.entries(where)) { conds.push(`${k} = ?`); params.push(v); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' LIMIT 1';
    return local().prepare(sql).get(...params);
  }
}

/**
 * Insert a row and return it with generated ID.
 * @param {string} table - Table name
 * @param {Object} row - Column:value pairs
 */
async function insert(table, row) {
  if (isSB()) {
    const { data, error } = await sb().from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  } else {
    const keys = Object.keys(row).filter(k => row[k] !== undefined);
    const vals = keys.map(k => row[k]);
    const placeholders = keys.map(() => '?').join(',');
    const result = local().prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).run(...vals);
    return local().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
  }
}

/**
 * Update rows matching conditions.
 * @param {string} table - Table name
 * @param {Object} where - Match conditions
 * @param {Object} updates - Columns to update
 */
async function update(table, where, updates) {
  if (isSB()) {
    let q = sb().from(table).update(updates);
    for (const [k, v] of Object.entries(where)) { q = q.eq(k, v); }
    const { data, error } = await q.select();
    if (error) throw error;
    return data;
  } else {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`);
    const setVals = Object.values(updates);
    const whereClauses = Object.keys(where).map(k => `${k} = ?`);
    const whereVals = Object.values(where);
    local().prepare(`UPDATE ${table} SET ${setClauses.join(',')} WHERE ${whereClauses.join(' AND ')}`).run(...setVals, ...whereVals);
    return local().prepare(`SELECT * FROM ${table} WHERE ${whereClauses.join(' AND ')}`).all(...whereVals);
  }
}

/**
 * Count rows matching conditions.
 * @param {string} table - Table name
 * @param {Object} where - Match conditions
 */
async function count(table, where = {}) {
  if (isSB()) {
    let q = sb().from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(where)) { q = q.eq(k, v); }
    const { count: c, error } = await q;
    if (error) throw error;
    return c || 0;
  } else {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const conds = []; const params = [];
    for (const [k, v] of Object.entries(where)) { conds.push(`${k} = ?`); params.push(v); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    return local().prepare(sql).get(...params).count;
  }
}

module.exports = { findAll, findOne, insert, update, count, isSB, sb, local };
