/**
 * ============================================================
 *  AUTHENTICATION MIDDLEWARE
 * ============================================================
 *
 *  JWT-based auth. Every protected route uses authenticateToken.
 *  Admin-only routes add requireAdmin after authenticateToken.
 *
 *  Token invalidation: When an admin suspends a user, their
 *  active token is invalidated immediately via the security
 *  module's in-memory blacklist.
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { isTokenInvalidated } = require('./security');

const JWT_SECRET = config.JWT_SECRET;

/**
 * Verify JWT token from Authorization header.
 * Sets req.user with decoded payload (id, email, role, shift_id).
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user's tokens were invalidated (e.g. suspended)
    if (isTokenInvalidated(decoded.id)) {
      return res.status(403).json({ error: 'Session invalidated. Please login again.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Require admin role. Must be used AFTER authenticateToken.
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
