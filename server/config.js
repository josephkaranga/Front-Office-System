/**
 * ============================================================
 *  SERVER CONFIGURATION
 * ============================================================
 *
 *  All secrets loaded from environment variables (.env file
 *  locally, Vercel env vars in production).
 *
 *  DB_MODE:
 *    'local'    → SQLite file in /data (offline, desktop)
 *    'supabase' → Cloud PostgreSQL (required for Vercel)
 * ============================================================
 */

require('dotenv').config();

module.exports = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  DB_MODE: process.env.DB_MODE || 'local',
  JWT_SECRET: process.env.JWT_SECRET || 'kyshakez-fallback-change-me-' + Date.now(),
  PORT: process.env.PORT || 3001,
};
