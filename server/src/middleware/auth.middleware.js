const { COOKIE_NAME, verifyToken } = require("../config/auth");

/**
 * Requires a valid admin session. Reads the JWT from the httpOnly cookie
 * (never from a header or the request body - the token is never exposed
 * to frontend JS). On success, attaches { adminId, pharmacyId, username,
 * role } to req.admin. On failure, responds 401 without leaking whether
 * the problem was "no token" vs "bad token" vs "expired token" - all look
 * the same to the client.
 */
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : undefined;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = verifyToken(token);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Not authenticated" });
  }
}

/**
 * Requires the authenticated principal to have the "admin" role.
 * Separated from requireAuth so future roles (e.g. "staff") can reuse
 * requireAuth while being denied by requireAdmin - authentication and
 * authorization are distinct checks even though only one role exists today.
 */
function requireAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
