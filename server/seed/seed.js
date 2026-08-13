require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");
const Medicine = require("../src/models/Medicine");

/**
 * Demo data for Shankar Pharmacy (the current demo tenant).
 * This is the ONLY place this system's demo inventory data lives -
 * the Medicine schema itself has no pharmacy-specific data in it.
 * A future pharmacy client would get its own seed data (or would add
 * medicines through the admin dashboard once that stage is built).
 */
const SHANKAR_PHARMACY_SLUG = process.env.DEFAULT_PHARMACY_SLUG || "shankar-pharmacy";

const demoMedicines = [
  { name: "Dolo 650", price: 30, stock: 120 },
  { name: "Crocin", price: 25, stock: 80 },
  { name: "Cetirizine", price: 15, stock: 0 },
  { name: "Paracetamol", price: 20, stock: 200 },
  { name: "Azithromycin", price: 85, stock: 0 }
].map((m) => ({ ...m, pharmacyId: SHANKAR_PHARMACY_SLUG }));

async function seed() {
  const connected = await connectDB();
  if (!connected) {
    console.error("[seed] Could not connect to MongoDB. Aborting seed.");
    process.exit(1);
  }

  await Medicine.deleteMany({ pharmacyId: SHANKAR_PHARMACY_SLUG });
  // Use create() (not insertMany) so the pre("save") hook runs and
  // derives `available` from `stock` for each document.
  const inserted = await Medicine.create(demoMedicines);

  console.log(`[seed] Inserted ${inserted.length} demo medicines for "${SHANKAR_PHARMACY_SLUG}"`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
