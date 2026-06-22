const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function generateTransactionId() {
  const d = new Date();
  const ts = [d.getFullYear().toString().slice(-2), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('');
  const tm = [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0'), String(d.getSeconds()).padStart(2,'0')].join('');
  return `TXN-${ts}-${tm}-${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date, method, guest_id, limit = 100 } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('payments').select('*, guests(first_name, last_name), users!payments_received_by_fkey(full_name), checkins(rooms(room_number))');
      if (req.user.role !== 'admin') q = q.eq('received_by', req.user.id);
      if (date) { q = q.gte('payment_date', date + 'T00:00:00').lte('payment_date', date + 'T23:59:59'); }
      if (method) q = q.eq('payment_method', method);
      if (guest_id) q = q.eq('guest_id', Number(guest_id));
      q = q.order('payment_date', { ascending: false }).limit(Number(limit));
      const { data } = await q;
      const payments = (data || []).map(p => ({
        ...p, first_name: p.guests?.first_name, last_name: p.guests?.last_name,
        received_by_name: p.users?.full_name, room_number: p.checkins?.rooms?.room_number,
        guests: undefined, users: undefined, checkins: undefined,
      }));

      let tq = db.sb().from('payments').select('amount');
      const today = new Date().toISOString().split('T')[0];
      tq = tq.gte('payment_date', today + 'T00:00:00').lte('payment_date', today + 'T23:59:59');
      if (req.user.role !== 'admin') tq = tq.eq('received_by', req.user.id);
      const { data: todayData } = await tq;
      const todayTotal = (todayData || []).reduce((s, p) => s + Number(p.amount), 0);

      res.json({ payments, today_total: todayTotal });
    } else {
      let query = `SELECT p.*, g.first_name, g.last_name, u.full_name as received_by_name, r.room_number FROM payments p JOIN guests g ON p.guest_id = g.id LEFT JOIN users u ON p.received_by = u.id LEFT JOIN checkins c ON p.checkin_id = c.id LEFT JOIN rooms r ON c.room_id = r.id`;
      const conds = []; const params = [];
      if (req.user.role !== 'admin') { conds.push('p.received_by = ?'); params.push(req.user.id); }
      if (date) { conds.push('date(p.payment_date) = ?'); params.push(date); }
      if (method) { conds.push('p.payment_method = ?'); params.push(method); }
      if (guest_id) { conds.push('p.guest_id = ?'); params.push(Number(guest_id)); }
      if (conds.length) query += ' WHERE ' + conds.join(' AND ');
      query += ' ORDER BY p.payment_date DESC LIMIT ?'; params.push(Number(limit));
      const payments = db.local().prepare(query).all(...params);

      let todayQ = "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date(payment_date) = date('now')";
      const tp = [];
      if (req.user.role !== 'admin') { todayQ += ' AND received_by = ?'; tp.push(req.user.id); }
      const todayTotal = db.local().prepare(todayQ).get(...tp).total;
      res.json({ payments, today_total: todayTotal });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { checkin_id, reservation_id, guest_id, amount, payment_method, reference_number, description } = req.body;
    if (!guest_id || !amount || !payment_method) return res.status(400).json({ error: 'Guest, amount, and payment method are required.' });

    const payment = await db.insert('payments', {
      checkin_id: checkin_id ? Number(checkin_id) : null, reservation_id: reservation_id ? Number(reservation_id) : null,
      guest_id: Number(guest_id), amount: Number(amount), payment_method,
      reference_number: reference_number || null, description: description || null,
      received_by: req.user.id, transaction_id: generateTransactionId(),
    });

    const guest = await db.findOne('guests', { id: Number(guest_id) });
    res.status(201).json({ ...payment, first_name: guest?.first_name, last_name: guest?.last_name, received_by_name: req.user.full_name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
