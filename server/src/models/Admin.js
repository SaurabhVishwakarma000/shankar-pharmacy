const mongoose = require("mongoose");

/**
 * Admin schema. Scoped by pharmacyId like Medicine, so this system can
 * support one admin (or more, later) per pharmacy client without schema
 * changes. Contains no Shankar-Pharmacy-specific data - the actual demo
 * admin account is created via seed/createAdmin.js from environment
 * variables, never hardcoded here.
 */
const adminSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100
    },
    passwordHash: {
      type: String,
      required: true,
      select: false // never returned by default on find/findOne queries
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin"
    }
  },
  { timestamps: true }
);

adminSchema.index({ pharmacyId: 1, username: 1 }, { unique: true });

// Belt-and-braces: even if passwordHash is ever selected explicitly,
// strip it (and __v) from any JSON response.
adminSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Admin", adminSchema);
