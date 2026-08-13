const Medicine = require("../models/Medicine");
const { validateListQuery, validateObjectId } = require("../validators/medicine.validator");

/**
 * Escapes regex special characters so user search input can be used
 * safely inside a MongoDB $regex without behaving like a regex pattern.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEFAULT_PHARMACY_SLUG = process.env.DEFAULT_PHARMACY_SLUG || "shankar-pharmacy";

/**
 * GET /api/medicines?search=<query>&pharmacy=<slug>
 * Public. Case-insensitive partial match on name, scoped to a pharmacy.
 * No search param -> returns all medicines for that pharmacy.
 */
async function listMedicines(req, res) {
  const { error, value } = validateListQuery(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const pharmacyId = value.pharmacy || DEFAULT_PHARMACY_SLUG;
  const filter = { pharmacyId };

  if (value.search) {
    filter.name = { $regex: escapeRegex(value.search), $options: "i" };
  }

  const medicines = await Medicine.find(filter).sort({ name: 1 }).lean();
  res.json({ count: medicines.length, medicines });
}

/**
 * GET /api/medicines/:id
 * Public. Fetch a single medicine by id.
 */
async function getMedicineById(req, res) {
  const { error } = validateObjectId(req.params.id);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const medicine = await Medicine.findById(req.params.id).lean();
  if (!medicine) {
    return res.status(404).json({ error: "Medicine not found" });
  }

  res.json({ medicine });
}

module.exports = { listMedicines, getMedicineById };
