const express = require('express');
const db = require('../db-helper');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await db.findAll('settings');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allowed = ['hotel_name', 'hotel_tagline', 'currency', 'country', 'timezone', 'hotel_logo', 'hotel_address', 'hotel_phone', 'hotel_email', 'hotel_tin'];
    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key) && value !== undefined) {
        const existing = await db.findOne('settings', { key });
        if (existing) {
          await db.update('settings', { key }, { value: String(value) });
        } else {
          await db.insert('settings', { key, value: String(value) });
        }
      }
    }
    const rows = await db.findAll('settings');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
