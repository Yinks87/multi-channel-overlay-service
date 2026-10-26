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

// Overlay access tokens use a derived secret so they can never be used as API tokens.
const OVERLAY_JWT_SECRET = `${JWT_SECRET}:overlay-access`;
const OVERLAY_TOKEN_EXPIRY = config.OVERLAY_TOKEN_EXPIRY || '365d';

/**
 * Sign a long-lived token that grants access to a single protected overlay.
 * @param {{ userId: string, overlayId: string }} params
 * @returns {string}
 */
export function generateOverlayToken({ userId, overlayId }) {
  return jwt.sign({ sub: userId, overlayId }, OVERLAY_JWT_SECRET, {
    expiresIn: OVERLAY_TOKEN_EXPIRY,
  });
}

/**
 * Verify an overlay access token for a specific overlay.
 * @returns {{ sub: string, overlayId: string, exp: number } | null}
 */
export function verifyOverlayToken(token, overlayId) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, OVERLAY_JWT_SECRET);
    return payload.overlayId === overlayId ? payload : null;
  } catch {
    return null;
  }
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
