const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const { COOKIE_NAME, getCookieOptions, signToken } = require("../config/auth");

const DEFAULT_PHARMACY_SLUG = process.env.DEFAULT_PHARMACY_SLUG || "shankar-pharmacy";

// Generic message for any credential failure. Deliberately does not say
// whether the username or the password was wrong - avoids leaking which
// usernames exist (user enumeration).
const INVALID_CREDENTIALS_MSG = "Invalid username or password";

/**
 * POST /api/auth/login
 * req.body is already validated by the validateBody(validateLogin)
 * middleware before this handler runs.
 */
async function login(req, res) {
  const username = req.body.username.trim().toLowerCase();
  const { password } = req.body;

  // .select("+passwordHash") because the schema excludes it by default.
  const admin = await Admin.findOne({
    username,
    pharmacyId: DEFAULT_PHARMACY_SLUG
  }).select("+passwordHash");

  if (!admin) {
    // Still run a bcrypt.compare against a dummy hash so responding to a
    // nonexistent username takes about the same time as a wrong password -
    // avoids leaking username existence via response timing.
    await bcrypt.compare(password, "$2b$12$invalidsaltinvalidsaltinvalidsal.");
    return res.status(401).json({ error: INVALID_CREDENTIALS_MSG });
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_MSG });
  }

  const token = signToken({
    adminId: admin._id.toString(),
    pharmacyId: admin.pharmacyId,
    username: admin.username,
    role: admin.role
  });

  res.cookie(COOKIE_NAME, token, getCookieOptions());
  res.json({
    admin: {
      username: admin.username,
      pharmacyId: admin.pharmacyId,
      role: admin.role
    }
  });
}

/**
 * POST /api/auth/logout
 */
function logout(req, res) {
  // clearCookie should not receive maxAge/expires - only the identifying
  // attributes (path/domain/secure/sameSite/httpOnly) are needed to match
  // the cookie for removal.
  const { maxAge, ...clearOptions } = getCookieOptions();
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ message: "Logged out" });
}

/**
 * GET /api/auth/me
 * Protected by requireAuth - req.admin is the decoded JWT payload.
 */
function me(req, res) {
  res.json({ admin: req.admin });
}

module.exports = { login, logout, me };
