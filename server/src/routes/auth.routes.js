const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const asyncHandler = require("../middleware/asyncHandler");
const requireDB = require("../middleware/requireDB");
const { validateBody } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth.middleware");
const { login, logout, me } = require("../controllers/auth.controller");
const { validateLogin } = require("../validators/auth.validator");

// Blunts brute-force credential guessing. Keyed by IP; friendly message,
// no details about which attempts failed or why.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." }
});

router.post("/login", loginLimiter, validateBody(validateLogin), requireDB, asyncHandler(login));
router.post("/logout", logout); // no DB needed - just clears the cookie
router.get("/me", requireAuth, me);

module.exports = router;
