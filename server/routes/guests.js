const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, vip, limit = 50, offset = 0 } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('guests').select('*, users!guests_registered_by_fkey(full_name)');
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,id_number.ilike.%${search}%`);
      if (vip) q = q.eq('vip_status', vip);
      q = q.order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
      const { data } = await q;
      const guests = (data || []).map(g => ({ ...g, registered_by_name: g.users?.full_name || null, users: undefined }));
      const total = await db.count('guests');
      res.json({ guests, total });
    } else {
      let query = 'SELECT g.*, u.full_name as registered_by_name FROM guests g LEFT JOIN users u ON g.registered_by = u.id';
      const conds = []; const params = [];
      if (search) { conds.push('(g.first_name LIKE ? OR g.last_name LIKE ? OR g.phone LIKE ? OR g.email LIKE ? OR g.id_number LIKE ?)'); const t = `%${search}%`; params.push(t,t,t,t,t); }
      if (vip) { conds.push('g.vip_status = ?'); params.push(vip); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?'; params.push(Number(limit), Number(offset));
      const guests = db.local().prepare(query).all(...params);
      const total = db.local().prepare('SELECT COUNT(*) as count FROM guests').get().count;
      res.json({ guests, total });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (db.isSB()) {
      const { data: guest } = await db.sb().from('guests').select('*, users!guests_registered_by_fkey(full_name)').eq('id', id).single();
      if (!guest) return res.status(404).json({ error: 'Guest not found.' });
      guest.registered_by_name = guest.users?.full_name || null; delete guest.users;

      const { data: checkins } = await db.sb().from('checkins').select('*, rooms(room_number, room_type), u1:users!checkins_checked_in_by_fkey(full_name), u2:users!checkins_checked_out_by_fkey(full_name)').eq('guest_id', id).order('checkin_date', { ascending: false });
      const mappedCheckins = (checkins || []).map(c => ({ ...c, room_number: c.rooms?.room_number, room_type: c.rooms?.room_type, checked_in_by_name: c.u1?.full_name, checked_out_by_name: c.u2?.full_name, rooms: undefined, u1: undefined, u2: undefined }));

      const { data: payments } = await db.sb().from('payments').select('*, users!payments_received_by_fkey(full_name)').eq('guest_id', id).order('payment_date', { ascending: false });
      const mappedPayments = (payments || []).map(p => ({ ...p, received_by_name: p.users?.full_name, users: undefined }));

      const { data: reservations } = await db.sb().from('reservations').select('*, rooms(room_number, room_type)').eq('guest_id', id).order('checkin_date', { ascending: false });
      const mappedRes = (reservations || []).map(r => ({ ...r, room_number: r.rooms?.room_number, room_type: r.rooms?.room_type, rooms: undefined }));

      res.json({ ...guest, checkins: mappedCheckins, payments: mappedPayments, reservations: mappedRes });
    } else {
      const guest = db.local().prepare('SELECT g.*, u.full_name as registered_by_name FROM guests g LEFT JOIN users u ON g.registered_by = u.id WHERE g.id = ?').get(id);
      if (!guest) return res.status(404).json({ error: 'Guest not found.' });
      const checkins = db.local().prepare('SELECT c.*, r.room_number, r.room_type, u1.full_name as checked_in_by_name, u2.full_name as checked_out_by_name FROM checkins c JOIN rooms r ON c.room_id = r.id LEFT JOIN users u1 ON c.checked_in_by = u1.id LEFT JOIN users u2 ON c.checked_out_by = u2.id WHERE c.guest_id = ? ORDER BY c.checkin_date DESC').all(id);
      const payments = db.local().prepare('SELECT p.*, u.full_name as received_by_name FROM payments p LEFT JOIN users u ON p.received_by = u.id WHERE p.guest_id = ? ORDER BY p.payment_date DESC').all(id);
      const reservations = db.local().prepare('SELECT res.*, r.room_number, r.room_type FROM reservations res JOIN rooms r ON res.room_id = r.id WHERE res.guest_id = ? ORDER BY res.checkin_date DESC').all(id);
      res.json({ ...guest, checkins, payments, reservations });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.post('/check-duplicate', authenticateToken, async (req, res) => {
  try {
    const { phone, id_number, first_name, last_name } = req.body;
    let matches = [];
    if (db.isSB()) {
      const conditions = [];
      if (phone) conditions.push(`phone.ilike.%${phone}%`);
      if (id_number) conditions.push(`id_number.ilike.%${id_number}%`);
      if (first_name && last_name) conditions.push(`and(first_name.ilike.%${first_name}%,last_name.ilike.%${last_name}%)`);
      if (conditions.length === 0) return res.json({ duplicates: [] });
      const { data } = await db.sb().from('guests').select('id, first_name, last_name, phone, id_number, nationality, email').or(conditions.join(',')).limit(5);
      matches = data || [];
    } else {
      const conds = []; const params = [];
      if (phone) { conds.push('g.phone LIKE ?'); params.push(`%${phone}%`); }
      if (id_number) { conds.push('g.id_number LIKE ?'); params.push(`%${id_number}%`); }
      if (first_name && last_name) { conds.push('(g.first_name LIKE ? AND g.last_name LIKE ?)'); params.push(`%${first_name}%`, `%${last_name}%`); }
      if (conds.length === 0) return res.json({ duplicates: [] });
      matches = db.local().prepare(`SELECT id, first_name, last_name, phone, id_number, nationality, email FROM guests g WHERE ${conds.join(' OR ')} LIMIT 5`).all(...params);
    }
    res.json({ duplicates: matches });
  } catch (err) { console.error(err); res.json({ duplicates: [] }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, id_type, id_number, nationality, phone, email, address, vip_status, notes, force } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First name and last name are required.' });

    if (!force) {
      let duplicates = [];
      if (db.isSB()) {
        const conditions = [];
        if (phone) conditions.push(`phone.eq.${phone}`);
        if (id_number) conditions.push(`id_number.eq.${id_number}`);
        if (conditions.length > 0) {
          const { data } = await db.sb().from('guests').select('id, first_name, last_name, phone, id_number').or(conditions.join(',')).limit(3);
          duplicates = data || [];
        }
      } else {
        const conds = []; const params = [];
        if (phone) { conds.push('phone = ?'); params.push(phone); }
        if (id_number) { conds.push('id_number = ?'); params.push(id_number); }
        if (conds.length > 0) {
          duplicates = db.local().prepare(`SELECT id, first_name, last_name, phone, id_number FROM guests WHERE ${conds.join(' OR ')} LIMIT 3`).all(...params);
        }
      }
      if (duplicates.length > 0) {
        return res.status(409).json({ error: 'A guest with this phone or ID already exists.', duplicates });
      }
    }

    const guest = await db.insert('guests', { first_name, last_name, id_type: id_type || null, id_number: id_number || null, nationality: nationality || null, phone: phone || null, email: email || null, address: address || null, vip_status: vip_status || 'regular', notes: notes || null, registered_by: req.user.id });
    res.status(201).json(guest);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, id_type, id_number, nationality, phone, email, address, vip_status, notes } = req.body;
    await db.update('guests', { id: Number(req.params.id) }, { first_name, last_name, id_type, id_number, nationality, phone, email, address, vip_status, notes });
    const guest = await db.findOne('guests', { id: Number(req.params.id) });
    res.json(guest);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
