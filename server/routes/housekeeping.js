const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('housekeeping').select('*, rooms(room_number, room_type, floor, image_url), assigned:users!housekeeping_assigned_to_fkey(full_name), creator:users!housekeeping_created_by_fkey(full_name)');
      if (status) q = q.eq('status', status);
      if (priority) q = q.eq('priority', priority);
      q = q.order('created_at', { ascending: false });
      const { data } = await q;
      res.json((data || []).map(h => ({ ...h, room_number: h.rooms?.room_number, room_type: h.rooms?.room_type, floor: h.rooms?.floor, room_image: h.rooms?.image_url, assigned_to_name: h.assigned?.full_name, created_by_name: h.creator?.full_name, rooms: undefined, assigned: undefined, creator: undefined })));
    } else {
      let query = `SELECT h.*, r.room_number, r.room_type, r.floor, r.image_url as room_image, u1.full_name as assigned_to_name, u2.full_name as created_by_name FROM housekeeping h JOIN rooms r ON h.room_id = r.id LEFT JOIN users u1 ON h.assigned_to = u1.id LEFT JOIN users u2 ON h.created_by = u2.id`;
      const conds = []; const params = [];
      if (status) { conds.push('h.status = ?'); params.push(status); }
      if (priority) { conds.push('h.priority = ?'); params.push(priority); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY h.created_at DESC';
      res.json(db.local().prepare(query).all(...params));
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { room_id, task_type, priority, assigned_to, notes } = req.body;
    if (!room_id) return res.status(400).json({ error: 'Room is required.' });
    const task = await db.insert('housekeeping', {
      room_id: Number(room_id), task_type: task_type || 'cleaning',
      priority: priority || 'normal', assigned_to: assigned_to ? Number(assigned_to) : null,
      notes: notes || null, created_by: req.user.id,
    });
    await db.update('rooms', { id: Number(room_id) }, { status: task_type === 'maintenance' ? 'maintenance' : 'cleaning' });
    res.status(201).json(task);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/:id/start', authenticateToken, async (req, res) => {
  try {
    await db.update('housekeeping', { id: Number(req.params.id) }, { status: 'in_progress', started_at: new Date().toISOString(), assigned_to: req.user.id });
    const task = await db.findOne('housekeeping', { id: Number(req.params.id) });
    res.json(task);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const task = await db.findOne('housekeeping', { id: Number(req.params.id) });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    await db.update('housekeeping', { id: Number(req.params.id) }, { status: 'completed', completed_at: new Date().toISOString() });
    await db.update('rooms', { id: task.room_id }, { status: 'available' });
    res.json({ message: 'Task completed. Room set to available.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (db.isSB()) { await db.sb().from('housekeeping').delete().eq('id', Number(req.params.id)); }
    else { db.local().prepare('DELETE FROM housekeeping WHERE id = ?').run(Number(req.params.id)); }
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
