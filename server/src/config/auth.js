const jwt = require("jsonwebtoken");

const COOKIE_NAME = "pharmacy_admin_token";

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // not readable by frontend JS - protects against XSS token theft
    secure: isProduction, // HTTPS-only in production
    // Frontend (Netlify) and backend (Render) live on different domains,
    // so the cookie must be sent cross-site. That requires SameSite=None,
    // which browsers only allow when Secure is also true (i.e. in production).
    // Locally (http://127.0.0.1) both run on the same origin, so "lax" is fine.
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000 // 1 day; kept in sync with JWT_EXPIRES_IN default
  };
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Check your .env file.");
  }
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Check your .env file.");
  }
  return jwt.verify(token, secret);
}

module.exports = { COOKIE_NAME, getCookieOptions, signToken, verifyToken };
