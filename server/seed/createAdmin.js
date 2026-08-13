require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { connectDB } = require("../src/config/db");
const Admin = require("../src/models/Admin");
const { validateCreateAdmin } = require("../src/validators/auth.validator");

/**
 * Creates (or, with --force, resets the password of) the first admin
 * account for a pharmacy. Credentials come ONLY from environment
 * variables (ADMIN_USERNAME, ADMIN_PASSWORD) - never hardcoded here and
 * never printed back out in plaintext.
 *
 * Usage:
 *   ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run create-admin
 *   npm run create-admin -- --force     (resets password if the account already exists)
 */
const PHARMACY_SLUG = process.env.DEFAULT_PHARMACY_SLUG || "shankar-pharmacy";
const FORCE = process.argv.includes("--force");

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "[create-admin] ADMIN_USERNAME and ADMIN_PASSWORD must be set in your environment (.env). Aborting - no account created."
    );
    process.exit(1);
  }

  const { error } = validateCreateAdmin({ username, password });
  if (error) {
    console.error(`[create-admin] ${error.details[0].message}. Aborting.`);
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error("[create-admin] Could not connect to MongoDB. Aborting.");
    process.exit(1);
  }

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await Admin.findOne({ username: normalizedUsername, pharmacyId: PHARMACY_SLUG });

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    if (!FORCE) {
      console.error(
        `[create-admin] An admin with username "${normalizedUsername}" already exists for "${PHARMACY_SLUG}". ` +
          "No changes made. Re-run with --force to reset that account's password."
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(
      `[create-admin] Password reset for existing admin "${normalizedUsername}" (pharmacy: "${PHARMACY_SLUG}").`
    );
  } else {
    await Admin.create({
      username: normalizedUsername,
      passwordHash,
      pharmacyId: PHARMACY_SLUG,
      role: "admin"
    });
    console.log(
      `[create-admin] Admin account "${normalizedUsername}" created for pharmacy "${PHARMACY_SLUG}".`
    );
  }

  console.log("[create-admin] Done. The password was not logged.");
  await mongoose.disconnect();
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error("[create-admin] Failed:", err.message);
  process.exit(1);
});
