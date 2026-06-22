const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, floor, type } = req.query;
    let rooms;
    if (db.isSB()) {
      let q = db.sb().from('rooms').select('*');
      if (status) q = q.eq('status', status);
      if (floor) q = q.eq('floor', Number(floor));
      if (type) q = q.ilike('room_type', `%${type}%`);
      q = q.order('room_number');
      const { data } = await q;
      rooms = data || [];
    } else {
      let query = 'SELECT * FROM rooms'; const conds = []; const params = [];
      if (status) { conds.push('status = ?'); params.push(status); }
      if (floor) { conds.push('floor = ?'); params.push(Number(floor)); }
      if (type) { conds.push('room_type LIKE ?'); params.push(`%${type}%`); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY room_number';
      rooms = db.local().prepare(query).all(...params);
    }
    const stats = {
      total: await db.count('rooms'),
      available: await db.count('rooms', { status: 'available' }),
      occupied: await db.count('rooms', { status: 'occupied' }),
      maintenance: await db.count('rooms', { status: 'maintenance' }),
      reserved: await db.count('rooms', { status: 'reserved' }),
    };
    res.json({ rooms, stats });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const room = await db.findOne('rooms', { id: Number(req.params.id) });
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    let currentGuest = null;
    if (db.isSB()) {
      const { data } = await db.sb().from('checkins').select('*, guests(first_name, last_name, phone)').eq('room_id', room.id).eq('status', 'checked_in').order('checkin_date', { ascending: false }).limit(1);
      if (data?.[0]) { const c = data[0]; currentGuest = { ...c, first_name: c.guests?.first_name, last_name: c.guests?.last_name, phone: c.guests?.phone, guests: undefined }; }
    } else {
      currentGuest = db.local().prepare("SELECT c.*, g.first_name, g.last_name, g.phone FROM checkins c JOIN guests g ON c.guest_id = g.id WHERE c.room_id = ? AND c.status = 'checked_in' ORDER BY c.checkin_date DESC LIMIT 1").get(room.id);
    }
    res.json({ ...room, current_guest: currentGuest });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'occupied', 'maintenance', 'reserved', 'cleaning'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    await db.update('rooms', { id: Number(req.params.id) }, { status });
    const room = await db.findOne('rooms', { id: Number(req.params.id) });
    res.json(room);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
