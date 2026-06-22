/**
 * ============================================================
 *  VERCEL SERVERLESS API ENTRY POINT
 * ============================================================
 *
 *  This file wraps the Express server as a Vercel serverless
 *  function. All /api/* requests are routed here.
 *
 *  Vercel runs this as a Node.js function — no persistent
 *  server process. Each request boots the app, handles it,
 *  and returns.
 *
 *  IMPORTANT: On Vercel, DB_MODE must be 'supabase' since
 *  there is no persistent filesystem for SQLite.
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('../server/database');
const { apiLimiter, sanitizeBody } = require('../server/middleware/security');

// ── Route imports ──
const authRoutes = require('../server/routes/auth');
const guestRoutes = require('../server/routes/guests');
const roomRoutes = require('../server/routes/rooms');
const checkinRoutes = require('../server/routes/checkins');
const reservationRoutes = require('../server/routes/reservations');
const paymentRoutes = require('../server/routes/payments');
const reportRoutes = require('../server/routes/reports');
const settingsRoutes = require('../server/routes/settings');
const extrasRoutes = require('../server/routes/extras');
const housekeepingRoutes = require('../server/routes/housekeeping');
const receiptRoutes = require('../server/routes/receipts');

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(sanitizeBody);
app.use('/api', apiLimiter);

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

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Initialize database on cold start ──
let dbInitialized = false;
const handler = async (req, res) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  return app(req, res);
};

module.exports = handler;
