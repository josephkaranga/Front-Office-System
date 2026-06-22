const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/checkin/:checkinId', authenticateToken, async (req, res) => {
  try {
    const checkinId = Number(req.params.checkinId);
    const checkin = await db.findOne('checkins', { id: checkinId });
    if (!checkin) return res.status(404).json({ error: 'Not found.' });

    const guest = await db.findOne('guests', { id: checkin.guest_id });
    const room = await db.findOne('rooms', { id: checkin.room_id });

    let checkedInBy = null, checkedOutBy = null;
    if (checkin.checked_in_by) checkedInBy = await db.findOne('users', { id: checkin.checked_in_by });
    if (checkin.checked_out_by) checkedOutBy = await db.findOne('users', { id: checkin.checked_out_by });

    let extras = [];
    if (db.isSB()) {
      const { data } = await db.sb().from('extras').select('*').eq('checkin_id', checkinId).order('added_at');
      extras = data || [];
    } else {
      extras = db.local().prepare('SELECT * FROM extras WHERE checkin_id = ? ORDER BY added_at').all(checkinId);
    }

    let payments = [];
    if (db.isSB()) {
      const { data } = await db.sb().from('payments').select('*, users!payments_received_by_fkey(full_name)').eq('checkin_id', checkinId).order('payment_date');
      payments = (data || []).map(p => ({ ...p, received_by_name: p.users?.full_name, users: undefined }));
    } else {
      payments = db.local().prepare('SELECT p.*, u.full_name as received_by_name FROM payments p LEFT JOIN users u ON p.received_by = u.id WHERE p.checkin_id = ? ORDER BY p.payment_date').all(checkinId);
    }

    const settings = {};
    const settingsRows = await db.findAll('settings');
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const now = checkin.checkout_date ? new Date(checkin.checkout_date) : new Date();
    const nights = Math.max(1, Math.ceil((now - new Date(checkin.checkin_date)) / 86400000));

    const originalRate = Number(checkin.original_rate || room.rate_per_night);
    const chargedRate = Number(checkin.charged_rate || originalRate);
    const discountPN = Number(checkin.discount_per_night || 0);
    const hasDiscount = discountPN > 0;

    const roomSubtotal = nights * originalRate;
    const totalDiscount = nights * discountPN;
    const roomTotal = nights * chargedRate;
    const extrasTotal = extras.reduce((s, e) => s + Number(e.total_price), 0);
    const grandTotal = roomTotal + extrasTotal;
    const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = grandTotal - paidTotal;

    res.json({
      hotel: settings,
      guest, room, checkin, extras, payments,
      checked_in_by: checkedInBy?.full_name || null,
      checked_out_by: checkedOutBy?.full_name || null,
      served_by: checkedOutBy?.full_name || checkedInBy?.full_name || req.user.full_name,
      nights,
      original_rate: originalRate,
      charged_rate: chargedRate,
      discount_per_night: discountPN,
      discount_reason: checkin.discount_reason || null,
      has_discount: hasDiscount,
      room_subtotal: roomSubtotal,
      total_discount: totalDiscount,
      room_total: roomTotal,
      extras_total: extrasTotal,
      grand_total: grandTotal, paid_total: paidTotal, balance,
      receipt_number: `RCP-${String(checkinId).padStart(5, '0')}`,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
