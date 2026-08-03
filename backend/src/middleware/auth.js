import jwt from 'jsonwebtoken';
import config from '../config.js';

const JWT_SECRET = config.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET is not set. Add it to your .env file.');
}

const JWT_EXPIRY = config.JWT_EXPIRY || '7d';

/**
 * Sign a payload and return a JWT string.
 * @param {object} payload - Data to embed in the token.
 * @returns {string} Signed JWT.
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Express middleware that validates the Bearer JWT in the Authorization header.
 * If requiredRoles are supplied, the token's `roles` array must contain at
 * least one of them. Call with no arguments to require only a valid token.
 *
 * @param {...string} requiredRoles
 */
export function requireRole(...requiredRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ success: false, error: 'Unauthorized: missing token' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError'
          ? 'Unauthorized: token expired'
          : 'Unauthorized: invalid token';
      return res.status(401).json({ success: false, error: msg });
    }

    // If specific roles are required, check at least one matches
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) =>
        (payload.roles ?? []).includes(r),
      );
      if (!hasRole) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    req.currentUser = payload;
    next();
  };
}

