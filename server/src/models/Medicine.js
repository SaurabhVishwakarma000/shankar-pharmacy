const mongoose = require("mongoose");

/**
 * Medicine schema.
 *
 * This schema is intentionally generic and contains no Shankar-Pharmacy-
 * specific data. Every document is scoped to a pharmacy via `pharmacyId`
 * (a slug, e.g. "shankar-pharmacy"), so the same collection can serve
 * multiple pharmacy clients later without any schema changes. Demo data
 * for Shankar Pharmacy lives only in seed/seed.js, never in this file.
 *
 * `available` is intentionally NOT settable directly by clients (admin or
 * public) - it is always derived from `stock` in the pre-save hook below,
 * so the two fields can never disagree (e.g. stock: 5, available: false).
 * Admin CRUD controls stock; availability follows automatically.
 */
const medicineSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    available: {
      type: Boolean,
      required: true,
      default: true
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    }
  },
  { timestamps: true }
);

// Supports case-insensitive partial-name search scoped to a pharmacy.
medicineSchema.index({ pharmacyId: 1, name: 1 });

// Single source of truth: available is always derived from stock, never
// set independently, so the two can never contradict each other.
medicineSchema.pre("save", function (next) {
  this.available = this.stock > 0;
  next();
});

module.exports = mongoose.model("Medicine", medicineSchema);
