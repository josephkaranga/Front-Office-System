const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all extras for a checkin, plus the full folio summary
router.get('/checkin/:checkinId', authenticateToken, async (req, res) => {
  try {
    const checkinId = Number(req.params.checkinId);

    let checkin, guest, room, extras;
    if (db.isSB()) {
      const { data: c } = await db.sb().from('checkins').select('*, guests(first_name, last_name, phone, vip_status), rooms(room_number, room_type, rate_per_night, image_url)').eq('id', checkinId).single();
      if (!c) return res.status(404).json({ error: 'Check-in not found.' });
      checkin = c; guest = c.guests; room = c.rooms;

      const { data: ex } = await db.sb().from('extras').select('*, users!extras_added_by_fkey(full_name)').eq('checkin_id', checkinId).order('added_at', { ascending: false });
      extras = (ex || []).map(e => ({ ...e, added_by_name: e.users?.full_name, users: undefined }));
    } else {
      checkin = db.local().prepare('SELECT * FROM checkins WHERE id = ?').get(checkinId);
      if (!checkin) return res.status(404).json({ error: 'Check-in not found.' });
      guest = db.local().prepare('SELECT first_name, last_name, phone, vip_status FROM guests WHERE id = ?').get(checkin.guest_id);
      room = db.local().prepare('SELECT room_number, room_type, rate_per_night, image_url FROM rooms WHERE id = ?').get(checkin.room_id);
      extras = db.local().prepare('SELECT e.*, u.full_name as added_by_name FROM extras e LEFT JOIN users u ON e.added_by = u.id WHERE e.checkin_id = ? ORDER BY e.added_at DESC').all(checkinId);
    }

    // Get existing payments for this checkin
    let payments = [];
    if (db.isSB()) {
      const { data: pm } = await db.sb().from('payments').select('*').eq('checkin_id', checkinId).order('payment_date');
      payments = pm || [];
    } else {
      payments = db.local().prepare('SELECT * FROM payments WHERE checkin_id = ? ORDER BY payment_date').all(checkinId);
    }
    const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

    const now = new Date();
    const checkinDate = new Date(checkin.checkin_date);
    const nights = Math.max(1, Math.ceil((now - checkinDate) / 86400000));

    const originalRate = Number(checkin.original_rate || room.rate_per_night);
    const chargedRate = Number(checkin.charged_rate || originalRate);
    const discountPN = Number(checkin.discount_per_night || 0);

    const roomTotal = nights * chargedRate;
    const extrasTotal = extras.reduce((s, e) => s + Number(e.total_price), 0);

    // Group extras by day
    const dailyBreakdown = [];
    for (let d = 0; d < nights; d++) {
      const dayDate = new Date(checkinDate);
      dayDate.setDate(dayDate.getDate() + d);
      const dayStr = dayDate.toISOString().split('T')[0];
      const dayExtras = extras.filter(e => {
        const eDate = (e.added_at || '').split('T')[0];
        return eDate === dayStr;
      });
      const dayExtrasTotal = dayExtras.reduce((s, e) => s + Number(e.total_price), 0);
      dailyBreakdown.push({
        day: d + 1,
        date: dayStr,
        room_charge: chargedRate,
        extras: dayExtras,
        extras_total: dayExtrasTotal,
        day_total: chargedRate + dayExtrasTotal,
      });
    }

    // Category summary
    const categorySummary = {};
    extras.forEach(e => {
      if (!categorySummary[e.category]) categorySummary[e.category] = { category: e.category, count: 0, total: 0 };
      categorySummary[e.category].count += e.quantity;
      categorySummary[e.category].total += Number(e.total_price);
    });

    const grandTotal = roomTotal + extrasTotal;
    const balance = grandTotal - paidTotal;

    res.json({
      checkin,
      guest,
      room: { ...room, charged_rate: chargedRate },
      extras,
      payments,
      nights,
      original_rate: originalRate,
      charged_rate: chargedRate,
      discount_per_night: discountPN,
      discount_reason: checkin.discount_reason || null,
      has_discount: discountPN > 0,
      total_discount: nights * discountPN,
      room_total: roomTotal,
      extras_total: extrasTotal,
      grand_total: grandTotal,
      paid_total: paidTotal,
      balance: balance,
      is_fully_paid: balance <= 0,
      daily_breakdown: dailyBreakdown,
      category_summary: Object.values(categorySummary),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load folio.' }); }
});

// Add an extra charge
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { checkin_id, category, item_name, quantity, unit_price, notes } = req.body;
    if (!checkin_id || !category || !item_name || !unit_price) {
      return res.status(400).json({ error: 'Check-in, category, item name, and price are required.' });
    }

    const qty = Number(quantity) || 1;
    const price = Number(unit_price);
    const total = qty * price;

    const extra = await db.insert('extras', {
      checkin_id: Number(checkin_id),
      category,
      item_name,
      quantity: qty,
      unit_price: price,
      total_price: total,
      notes: notes || null,
      added_by: req.user.id,
    });

    res.status(201).json(extra);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to add extra.' }); }
});

// Delete an extra
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (db.isSB()) {
      await db.sb().from('extras').delete().eq('id', id);
    } else {
      db.local().prepare('DELETE FROM extras WHERE id = ?').run(id);
    }
    res.json({ message: 'Extra removed.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
