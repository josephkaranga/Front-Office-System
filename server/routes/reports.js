const express = require('express');
const db = require('../db-helper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalRooms = await db.count('rooms');
    const occupied = await db.count('rooms', { status: 'occupied' });
    const available = await db.count('rooms', { status: 'available' });
    const maintenance = await db.count('rooms', { status: 'maintenance' });
    const reserved = await db.count('rooms', { status: 'reserved' });

    const today = new Date().toISOString().split('T')[0];
    let todayCheckins = 0, todayCheckouts = 0, currentGuests = 0, todayRevenue = 0, monthRevenue = 0;
    let upcomingReservations = [], recentCheckins = [], expectedCheckouts = [];

    if (db.isSB()) {
      const { count: ci } = await db.sb().from('checkins').select('*', { count: 'exact', head: true }).gte('checkin_date', today + 'T00:00:00').lte('checkin_date', today + 'T23:59:59');
      todayCheckins = ci || 0;
      const { count: co } = await db.sb().from('checkins').select('*', { count: 'exact', head: true }).gte('checkout_date', today + 'T00:00:00').lte('checkout_date', today + 'T23:59:59');
      todayCheckouts = co || 0;
      currentGuests = await db.count('checkins', { status: 'checked_in' });

      const { data: tPay } = await db.sb().from('payments').select('amount').gte('payment_date', today + 'T00:00:00').lte('payment_date', today + 'T23:59:59');
      todayRevenue = (tPay || []).reduce((s, p) => s + Number(p.amount), 0);
      const monthStart = today.slice(0, 7) + '-01';
      const { data: mPay } = await db.sb().from('payments').select('amount').gte('payment_date', monthStart + 'T00:00:00');
      monthRevenue = (mPay || []).reduce((s, p) => s + Number(p.amount), 0);

      const { data: ur } = await db.sb().from('reservations').select('*, guests(first_name, last_name), rooms(room_number, room_type)').eq('status', 'confirmed').gte('checkin_date', today).order('checkin_date').limit(10);
      upcomingReservations = (ur || []).map(r => ({ ...r, first_name: r.guests?.first_name, last_name: r.guests?.last_name, room_number: r.rooms?.room_number, room_type: r.rooms?.room_type, guests: undefined, rooms: undefined }));

      const { data: rc } = await db.sb().from('checkins').select('*, guests(first_name, last_name, vip_status), rooms(room_number, room_type)').eq('status', 'checked_in').order('checkin_date', { ascending: false }).limit(10);
      recentCheckins = (rc || []).map(c => ({ ...c, first_name: c.guests?.first_name, last_name: c.guests?.last_name, vip_status: c.guests?.vip_status, room_number: c.rooms?.room_number, room_type: c.rooms?.room_type, guests: undefined, rooms: undefined }));

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const { data: ec } = await db.sb().from('checkins').select('*, guests(first_name, last_name, phone), rooms(room_number, room_type)').eq('status', 'checked_in').lte('expected_checkout', tomorrow.toISOString().split('T')[0]).order('expected_checkout');
      expectedCheckouts = (ec || []).map(c => ({ ...c, first_name: c.guests?.first_name, last_name: c.guests?.last_name, phone: c.guests?.phone, room_number: c.rooms?.room_number, room_type: c.rooms?.room_type, guests: undefined, rooms: undefined }));
    } else {
      const l = db.local();
      todayCheckins = l.prepare("SELECT COUNT(*) as c FROM checkins WHERE date(checkin_date) = date('now')").get().c;
      todayCheckouts = l.prepare("SELECT COUNT(*) as c FROM checkins WHERE date(checkout_date) = date('now')").get().c;
      currentGuests = l.prepare("SELECT COUNT(*) as c FROM checkins WHERE status = 'checked_in'").get().c;
      todayRevenue = l.prepare("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE date(payment_date) = date('now')").get().t;
      monthRevenue = l.prepare("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE strftime('%Y-%m',payment_date) = strftime('%Y-%m','now')").get().t;
      upcomingReservations = l.prepare("SELECT res.*, g.first_name, g.last_name, r.room_number, r.room_type FROM reservations res JOIN guests g ON res.guest_id=g.id JOIN rooms r ON res.room_id=r.id WHERE res.status='confirmed' AND res.checkin_date>=date('now') ORDER BY res.checkin_date LIMIT 10").all();
      recentCheckins = l.prepare("SELECT c.*, g.first_name, g.last_name, g.vip_status, r.room_number, r.room_type FROM checkins c JOIN guests g ON c.guest_id=g.id JOIN rooms r ON c.room_id=r.id WHERE c.status='checked_in' ORDER BY c.checkin_date DESC LIMIT 10").all();
      expectedCheckouts = l.prepare("SELECT c.*, g.first_name, g.last_name, g.phone, r.room_number, r.room_type FROM checkins c JOIN guests g ON c.guest_id=g.id JOIN rooms r ON c.room_id=r.id WHERE c.status='checked_in' AND date(c.expected_checkout)<=date('now','+1 day') ORDER BY c.expected_checkout").all();
    }

    res.json({
      rooms: { total: totalRooms, occupied, available, maintenance, reserved },
      today: { checkins: todayCheckins, checkouts: todayCheckouts, current_guests: currentGuests },
      revenue: { today: todayRevenue, month: monthRevenue },
      upcoming_reservations: upcomingReservations, recent_checkins: recentCheckins, expected_checkouts: expectedCheckouts,
      occupancy_rate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Dashboard failed.' }); }
});

router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('payments').select('amount, payment_method, payment_date');
      if (from_date) q = q.gte('payment_date', from_date + 'T00:00:00');
      if (to_date) q = q.lte('payment_date', to_date + 'T23:59:59');
      const { data } = await q;

      const byDay = {}; const byMethod = {};
      (data || []).forEach(p => {
        const day = p.payment_date?.split('T')[0] || 'unknown';
        const key = `${day}|${p.payment_method}`;
        if (!byDay[key]) byDay[key] = { period: day, payment_method: p.payment_method, total: 0, transactions: 0 };
        byDay[key].total += Number(p.amount); byDay[key].transactions++;
        if (!byMethod[p.payment_method]) byMethod[p.payment_method] = { payment_method: p.payment_method, total: 0, count: 0 };
        byMethod[p.payment_method].total += Number(p.amount); byMethod[p.payment_method].count++;
      });

      const grandTotal = (data || []).reduce((s, p) => s + Number(p.amount), 0);
      res.json({
        data: Object.values(byDay).sort((a, b) => b.period.localeCompare(a.period)),
        summary: Object.values(byMethod),
        grand_total: { total: grandTotal, count: (data || []).length },
      });
    } else {
      const l = db.local();
      let w = ''; const p = [];
      if (from_date) { w += (w ? ' AND ' : ' WHERE ') + 'date(payment_date) >= ?'; p.push(from_date); }
      if (to_date) { w += (w ? ' AND ' : ' WHERE ') + 'date(payment_date) <= ?'; p.push(to_date); }
      const data = l.prepare(`SELECT strftime('%Y-%m-%d', payment_date) as period, SUM(amount) as total, COUNT(*) as transactions, payment_method FROM payments${w} GROUP BY period, payment_method ORDER BY period DESC`).all(...p);
      const summary = l.prepare(`SELECT payment_method, SUM(amount) as total, COUNT(*) as count FROM payments${w} GROUP BY payment_method`).all(...p);
      const gt = l.prepare(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM payments${w}`).get(...p);
      res.json({ data, summary, grand_total: gt });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.get('/occupancy', authenticateToken, async (req, res) => {
  try {
    if (db.isSB()) {
      const rooms = await db.findAll('rooms');
      const byType = {}; const byFloor = {};
      rooms.forEach(r => {
        if (!byType[r.room_type]) byType[r.room_type] = { room_type: r.room_type, total: 0, occupied: 0, available: 0 };
        byType[r.room_type].total++; if (r.status === 'occupied') byType[r.room_type].occupied++; if (r.status === 'available') byType[r.room_type].available++;
        if (!byFloor[r.floor]) byFloor[r.floor] = { floor: r.floor, total: 0, occupied: 0, available: 0 };
        byFloor[r.floor].total++; if (r.status === 'occupied') byFloor[r.floor].occupied++; if (r.status === 'available') byFloor[r.floor].available++;
      });
      res.json({ by_type: Object.values(byType), by_floor: Object.values(byFloor).sort((a,b) => a.floor - b.floor), checkin_history: [] });
    } else {
      const l = db.local();
      const { from_date, to_date } = req.query;
      const byType = l.prepare("SELECT room_type, COUNT(*) as total, SUM(CASE WHEN status='occupied' THEN 1 ELSE 0 END) as occupied, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available FROM rooms GROUP BY room_type").all();
      const byFloor = l.prepare("SELECT floor, COUNT(*) as total, SUM(CASE WHEN status='occupied' THEN 1 ELSE 0 END) as occupied, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available FROM rooms GROUP BY floor ORDER BY floor").all();
      let hw = ''; const hp = [];
      if (from_date) { hw += (hw ? ' AND ' : ' WHERE ') + 'date(checkin_date) >= ?'; hp.push(from_date); }
      if (to_date) { hw += (hw ? ' AND ' : ' WHERE ') + 'date(checkin_date) <= ?'; hp.push(to_date); }
      const hist = l.prepare(`SELECT date(checkin_date) as date, COUNT(*) as count FROM checkins${hw} GROUP BY date(checkin_date) ORDER BY date DESC LIMIT 30`).all(...hp);
      res.json({ by_type: byType, by_floor: byFloor, checkin_history: hist });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.get('/guest-history', authenticateToken, async (req, res) => {
  try {
    const { type = 'checkins', from_date, to_date, limit = 100 } = req.query;
    if (db.isSB()) {
      let q = db.sb().from('checkins').select('*, guests(first_name, last_name, phone, nationality, vip_status), rooms(room_number, room_type, rate_per_night), u1:users!checkins_checked_in_by_fkey(full_name), u2:users!checkins_checked_out_by_fkey(full_name)');
      if (type === 'checkouts') q = q.eq('status', 'checked_out');
      else if (type === 'active') q = q.eq('status', 'checked_in');
      if (from_date) q = q.gte('checkin_date', from_date + 'T00:00:00');
      if (to_date) q = q.lte('checkin_date', to_date + 'T23:59:59');
      q = q.order('checkin_date', { ascending: false }).limit(Number(limit));
      const { data } = await q;
      const mapped = (data || []).map(h => ({
        ...h, first_name: h.guests?.first_name, last_name: h.guests?.last_name, phone: h.guests?.phone,
        nationality: h.guests?.nationality, vip_status: h.guests?.vip_status,
        room_number: h.rooms?.room_number, room_type: h.rooms?.room_type, rate_per_night: h.rooms?.rate_per_night,
        checked_in_by_name: h.u1?.full_name, checked_out_by_name: h.u2?.full_name,
        guests: undefined, rooms: undefined, u1: undefined, u2: undefined,
      }));
      res.json(mapped);
    } else {
      const l = db.local(); const conds = []; const p = [];
      if (from_date) { conds.push('date(c.checkin_date) >= ?'); p.push(from_date); }
      if (to_date) { conds.push('date(c.checkin_date) <= ?'); p.push(to_date); }
      if (type === 'checkouts') conds.push("c.status = 'checked_out'");
      else if (type === 'active') conds.push("c.status = 'checked_in'");
      const w = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      const history = l.prepare(`SELECT c.*, g.first_name, g.last_name, g.phone, g.nationality, g.vip_status, r.room_number, r.room_type, r.rate_per_night, u1.full_name as checked_in_by_name, u2.full_name as checked_out_by_name FROM checkins c JOIN guests g ON c.guest_id=g.id JOIN rooms r ON c.room_id=r.id LEFT JOIN users u1 ON c.checked_in_by=u1.id LEFT JOIN users u2 ON c.checked_out_by=u2.id ${w} ORDER BY c.checkin_date DESC LIMIT ?`).all(...p, Number(limit));
      res.json(history);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
