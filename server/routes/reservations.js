const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, from_date, to_date } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('reservations').select('*, guests(first_name, last_name, phone, email, vip_status, id_type, id_number, nationality), rooms(room_number, room_type, rate_per_night), users!reservations_created_by_fkey(full_name)');
      if (status) q = q.eq('status', status);
      if (from_date) q = q.gte('checkin_date', from_date);
      if (to_date) q = q.lte('checkin_date', to_date);
      q = q.order('checkin_date');
      const { data } = await q;
      const mapped = (data || []).map(r => ({
        ...r, first_name: r.guests?.first_name, last_name: r.guests?.last_name, phone: r.guests?.phone,
        email: r.guests?.email, vip_status: r.guests?.vip_status, id_type: r.guests?.id_type,
        id_number: r.guests?.id_number, nationality: r.guests?.nationality,
        room_number: r.rooms?.room_number, room_type: r.rooms?.room_type, rate_per_night: r.rooms?.rate_per_night,
        created_by_name: r.users?.full_name, guests: undefined, rooms: undefined, users: undefined,
      }));
      res.json(mapped);
    } else {
      let query = `SELECT res.*, g.first_name, g.last_name, g.phone, g.email, g.vip_status, g.id_type, g.id_number, g.nationality, r.room_number, r.room_type, r.rate_per_night, u.full_name as created_by_name FROM reservations res JOIN guests g ON res.guest_id = g.id JOIN rooms r ON res.room_id = r.id LEFT JOIN users u ON res.created_by = u.id`;
      const conds = []; const params = [];
      if (status) { conds.push('res.status = ?'); params.push(status); }
      if (from_date) { conds.push('res.checkin_date >= ?'); params.push(from_date); }
      if (to_date) { conds.push('res.checkin_date <= ?'); params.push(to_date); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY res.checkin_date ASC';
      res.json(db.local().prepare(query).all(...params));
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { guest_id, room_id, checkin_date, checkout_date, num_guests, stay_type, notes, car_registration } = req.body;
    if (!guest_id || !room_id || !checkin_date || !checkout_date) return res.status(400).json({ error: 'Guest, room, check-in date, and checkout date are required.' });
    const reservation = await db.insert('reservations', {
      guest_id: Number(guest_id), room_id: Number(room_id), checkin_date, checkout_date,
      num_guests: num_guests || 1, stay_type: stay_type || 'night', notes: notes || null,
      created_by: req.user.id, car_registration: car_registration || null,
    });
    const guest = await db.findOne('guests', { id: Number(guest_id) });
    const room = await db.findOne('rooms', { id: Number(room_id) });
    res.status(201).json({ ...reservation, first_name: guest?.first_name, last_name: guest?.last_name, room_number: room?.room_number, room_type: room?.room_type });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    await db.update('reservations', { id: Number(req.params.id) }, { status: 'cancelled' });
    res.json({ message: 'Reservation cancelled.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
