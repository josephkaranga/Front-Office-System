/**
 * ============================================================
 *  LOCAL EXPRESS SERVER
 * ============================================================
 *
 *  This is the entry point for LOCAL development and desktop
 *  (Electron) mode. For Vercel deployment, /api/index.js is
 *  used instead.
 *
 *  Starts an Express server on PORT (default 3001).
 *  Serves both the API and the built frontend (dist/).
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database');
const { apiLimiter, sanitizeBody } = require('./middleware/security');
const config = require('./config');

// ── Route imports ──
const authRoutes = require('./routes/auth');
const guestRoutes = require('./routes/guests');
const roomRoutes = require('./routes/rooms');
const checkinRoutes = require('./routes/checkins');
const reservationRoutes = require('./routes/reservations');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const extrasRoutes = require('./routes/extras');
const housekeepingRoutes = require('./routes/housekeeping');
const receiptRoutes = require('./routes/receipts');

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(sanitizeBody);        // Strip HTML from inputs
app.use('/api', apiLimiter);  // Rate limit API

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/extras', extrasRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/receipts', receiptRoutes);

// ── Serve built frontend ──
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ──
async function start() {
  await initDatabase();
  console.log('Database initialized.');
  app.listen(config.PORT, () => {
    console.log(`KYSHAKEZ Front Office Server running on port ${config.PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });

module.exports = app;
