const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, date, limit = 50 } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('checkins').select('*, guests(first_name, last_name, phone, vip_status), rooms(room_number, room_type, rate_per_night), users!checkins_checked_in_by_fkey(full_name)');
      if (status) q = q.eq('status', status);
      if (date) { q = q.gte('checkin_date', date + 'T00:00:00').lte('checkin_date', date + 'T23:59:59'); }
      q = q.order('created_at', { ascending: false }).limit(Number(limit));
      const { data } = await q;
      const mapped = (data || []).map(c => ({
        ...c, first_name: c.guests?.first_name, last_name: c.guests?.last_name, phone: c.guests?.phone, vip_status: c.guests?.vip_status,
        room_number: c.rooms?.room_number, room_type: c.rooms?.room_type, rate_per_night: c.rooms?.rate_per_night,
        checked_in_by_name: c.users?.full_name, guests: undefined, rooms: undefined, users: undefined,
      }));
      res.json(mapped);
    } else {
      let query = `SELECT c.*, g.first_name, g.last_name, g.phone, g.vip_status, r.room_number, r.room_type, r.rate_per_night, u.full_name as checked_in_by_name FROM checkins c JOIN guests g ON c.guest_id = g.id JOIN rooms r ON c.room_id = r.id LEFT JOIN users u ON c.checked_in_by = u.id`;
      const conds = []; const params = [];
      if (status) { conds.push('c.status = ?'); params.push(status); }
      if (date) { conds.push('date(c.checkin_date) = ?'); params.push(date); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY c.created_at DESC LIMIT ?'; params.push(Number(limit));
      res.json(db.local().prepare(query).all(...params));
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { guest_id, room_id, expected_checkout, num_guests, stay_type, car_registration, purpose, special_requests, original_rate, charged_rate, discount_per_night, discount_reason } = req.body;
    if (!guest_id || !room_id || !expected_checkout) return res.status(400).json({ error: 'Guest, room, and expected checkout date are required.' });

    const room = await db.findOne('rooms', { id: Number(room_id) });
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (room.status !== 'available' && room.status !== 'reserved') return res.status(400).json({ error: `Room ${room.room_number} is currently ${room.status}.` });

    const pax = Number(num_guests) || 1;
    const rackRate = (pax >= 2 && room.rate_double) ? Number(room.rate_double) : Number(room.rate_per_night);

    const checkin = await db.insert('checkins', {
      guest_id: Number(guest_id), room_id: Number(room_id), checkin_date: new Date().toISOString(),
      expected_checkout, num_guests: pax, stay_type: stay_type || 'night',
      car_registration: car_registration || null, purpose: purpose || null,
      checked_in_by: req.user.id, special_requests: special_requests || null,
      original_rate: original_rate || rackRate,
      charged_rate: charged_rate || rackRate,
      discount_per_night: discount_per_night || 0,
      discount_reason: discount_reason || null,
    });

    await db.update('rooms', { id: Number(room_id) }, { status: 'occupied' });

    const guest = await db.findOne('guests', { id: Number(guest_id) });
    res.status(201).json({ ...checkin, first_name: guest?.first_name, last_name: guest?.last_name, phone: guest?.phone, room_number: room.room_number, room_type: room.room_type });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Check-in failed.' }); }
});

router.post('/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const checkinRecord = await db.findOne('checkins', { id: Number(req.params.id) });
    if (!checkinRecord || checkinRecord.status !== 'checked_in') return res.status(404).json({ error: 'Active check-in not found.' });

    await db.update('checkins', { id: Number(req.params.id) }, { checkout_date: new Date().toISOString(), status: 'checked_out', checked_out_by: req.user.id });
    await db.update('rooms', { id: checkinRecord.room_id }, { status: 'available' });

    const updated = await db.findOne('checkins', { id: Number(req.params.id) });
    const guest = await db.findOne('guests', { id: checkinRecord.guest_id });
    const room = await db.findOne('rooms', { id: checkinRecord.room_id });
    res.json({ ...updated, first_name: guest?.first_name, last_name: guest?.last_name, room_number: room?.room_number, room_type: room?.room_type, rate_per_night: room?.rate_per_night });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Checkout failed.' }); }
});

module.exports = router;
