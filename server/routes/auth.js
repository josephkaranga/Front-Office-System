const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db-helper');
const { JWT_SECRET, authenticateToken, requireAdmin } = require('../middleware/auth');
const { loginLimiter, invalidateUserTokens, clearInvalidation } = require('../middleware/security');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ error: 'Full name, email, and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const existing = await db.findOne('users', { email });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
    const salt = bcrypt.genSaltSync(10);
    const user = await db.insert('users', { email, password: bcrypt.hashSync(password, salt), full_name, role: 'receptionist', is_active: false });
    res.status(201).json({ message: 'Account created. Please wait for admin approval before logging in.' });
  } catch (err) {
    if (err.message?.includes('unique') || err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error('Register error:', err); res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await db.findOne('users', { email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.is_active && user.is_active !== 1) {
      if (!user.last_login) return res.status(403).json({ error: 'Your account is pending approval. Contact the administrator.' });
      return res.status(403).json({ error: 'Your account has been suspended. Contact the administrator.' });
    }
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials.' });

    clearInvalidation(user.id);
    await db.update('users', { id: user.id }, { last_login: new Date().toISOString() });
    const shift = await db.insert('shifts', { user_id: user.id });

    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name, role: user.role, shift_id: shift.id },
      JWT_SECRET, { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      shift_id: shift.id,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Login failed.' }); }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    if (req.user.shift_id) await db.update('shifts', { id: req.user.shift_id }, { logout_time: new Date().toISOString() });
    res.json({ message: 'Logged out successfully.' });
  } catch (err) { res.status(500).json({ error: 'Logout failed.' }); }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.findOne('users', { id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// Change own password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required.' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const user = await db.findOne('users', { id: req.user.id });
    if (!bcrypt.compareSync(current_password, user.password)) return res.status(401).json({ error: 'Current password is incorrect.' });

    const salt = bcrypt.genSaltSync(10);
    await db.update('users', { id: req.user.id }, { password: bcrypt.hashSync(new_password, salt) });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// Admin: reset another user's password
router.put('/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const salt = bcrypt.genSaltSync(10);
    await db.update('users', { id: Number(req.params.id) }, { password: bcrypt.hashSync(new_password, salt) });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.findAll('users', { order: { col: 'created_at', asc: false } });
    const result = [];
    for (const u of users) {
      const { password, ...safe } = u;
      const totalShifts = await db.count('shifts', { user_id: u.id });
      const shifts = await db.findAll('shifts', { where: { user_id: u.id }, order: { col: 'login_time', asc: false }, limit: 1 });
      const lastShift = shifts[0] || null;
      const today = new Date().toISOString().split('T')[0];
      let todayShift = null;
      if (db.isSB()) {
        const { data } = await db.sb().from('shifts').select('*').eq('user_id', u.id).gte('login_time', today + 'T00:00:00').order('login_time', { ascending: false }).limit(1);
        todayShift = data?.[0] || null;
      } else {
        todayShift = db.local().prepare("SELECT * FROM shifts WHERE user_id = ? AND date(login_time) = date('now') ORDER BY login_time DESC LIMIT 1").get(u.id);
      }
      result.push({ ...safe, total_shifts: totalShifts, last_shift: lastShift, today_shift: todayShift });
    }
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.get('/users/:id/shifts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const limit = Number(req.query.limit) || 30;
    if (db.isSB()) {
      const { data } = await db.sb().from('shifts').select('*, users(full_name, email)').eq('user_id', userId).order('login_time', { ascending: false }).limit(limit);
      const mapped = (data || []).map(s => ({ ...s, full_name: s.users?.full_name, email: s.users?.email, users: undefined }));
      res.json(mapped);
    } else {
      res.json(db.local().prepare('SELECT s.*, u.full_name, u.email FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.user_id = ? ORDER BY s.login_time DESC LIMIT ?').all(userId, limit));
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    const user = await db.findOne('users', { id: userId });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await db.update('users', { id: userId }, { is_active: req.body.is_active });
    if (!req.body.is_active) invalidateUserTokens(userId);
    else clearInvalidation(userId);
    const updated = await db.findOne('users', { id: userId });
    const { password, ...safe } = updated;
    res.json(safe);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password, and full name are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const salt = bcrypt.genSaltSync(10);
    const user = await db.insert('users', { email, password: bcrypt.hashSync(password, salt), full_name, role: role || 'receptionist' });
    res.status(201).json({ id: user.id, email, full_name, role: role || 'receptionist' });
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('UNIQUE') || err.code === '23505') return res.status(409).json({ error: 'Email already exists.' });
    console.error('Create user error:', err); res.status(500).json({ error: err.message || 'Failed to create user.' });
  }
});

router.get('/shifts', authenticateToken, async (req, res) => {
  try {
    const { date, user_id } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('shifts').select('*, users(full_name, email)');
      if (req.user.role !== 'admin') q = q.eq('user_id', req.user.id);
      else if (user_id) q = q.eq('user_id', Number(user_id));
      if (date) { q = q.gte('login_time', date + 'T00:00:00').lte('login_time', date + 'T23:59:59'); }
      q = q.order('login_time', { ascending: false }).limit(50);
      const { data } = await q;
      res.json((data || []).map(s => ({ ...s, full_name: s.users?.full_name, email: s.users?.email, users: undefined })));
    } else {
      let query = 'SELECT s.*, u.full_name, u.email FROM shifts s JOIN users u ON s.user_id = u.id';
      const conds = []; const params = [];
      if (req.user.role !== 'admin') { conds.push('s.user_id = ?'); params.push(req.user.id); }
      else if (user_id) { conds.push('s.user_id = ?'); params.push(Number(user_id)); }
      if (date) { conds.push('date(s.login_time) = ?'); params.push(date); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY s.login_time DESC LIMIT 50';
      res.json(db.local().prepare(query).all(...params));
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
