/**
 * ============================================================
 *  SECURITY MIDDLEWARE
 * ============================================================
 *
 *  1. Rate Limiting — Prevents brute force attacks
 *     - Login: 10 attempts per 15 minutes
 *     - API: 200 requests per minute
 *
 *  2. Input Sanitization — Strips HTML tags from all inputs
 *
 *  3. Token Invalidation — In-memory blacklist for suspended
 *     users. When admin suspends a user, their active JWT
 *     is immediately rejected.
 * ============================================================
 */

const rateLimit = require('express-rate-limit');

/** Login endpoint: 10 attempts per 15 min window */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API: 200 requests per minute */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests.' },
});

/** Strip angle brackets to prevent XSS */
function sanitize(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[<>]/g, '').trim();
}

/** Express middleware: sanitize all string values in req.body */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }
  next();
}

// ── Token Invalidation (in-memory) ──
// Stores user IDs whose tokens should be rejected
const invalidatedTokens = new Set();

function invalidateUserTokens(userId) { invalidatedTokens.add(String(userId)); }
function isTokenInvalidated(userId) { return invalidatedTokens.has(String(userId)); }
function clearInvalidation(userId) { invalidatedTokens.delete(String(userId)); }

module.exports = { loginLimiter, apiLimiter, sanitizeBody, invalidateUserTokens, isTokenInvalidated, clearInvalidation };
