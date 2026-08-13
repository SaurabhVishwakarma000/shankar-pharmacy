const path = require("path");
const fs = require("fs");
const Medicine = require("../models/Medicine");
const {
  validateListQuery,
  validateObjectId,
  validateCreateMedicine,
  validateUpdateMedicine
} = require("../validators/medicine.validator");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Deletes a previously-uploaded medicine image from disk. Never throws -
// a missing/already-deleted file is not an error worth failing the
// request over.
function deleteImageFile(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/medicines/")) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(__dirname, "..", "..", "uploads", "medicines", filename);
  fs.unlink(filePath, () => {}); // fire-and-forget, ignore errors
}

/**
 * GET /api/admin/medicines?search=<query>
 * Protected. Lists all medicines for the authenticated admin's own
 * pharmacy - pharmacyId always comes from req.admin (the verified JWT
 * payload), never from a query param or the request body, so one admin
 * can never read or modify another pharmacy's inventory.
 */
async function listAllMedicines(req, res) {
  const { error, value } = validateListQuery(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const filter = { pharmacyId: req.admin.pharmacyId };
  if (value.search) {
    filter.name = { $regex: escapeRegex(value.search), $options: "i" };
  }

  const medicines = await Medicine.find(filter).sort({ name: 1 }).lean();
  res.json({ count: medicines.length, medicines });
}

/**
 * POST /api/admin/medicines
 * Protected. Creates a medicine under the authenticated admin's pharmacy.
 * `available` is never accepted from the client - Medicine's pre("save")
 * hook derives it from `stock`. The image (if any) has already been
 * written to disk by the upload middleware before this handler runs;
 * req.file.filename gives us the server-generated name.
 */
async function createMedicine(req, res) {
  const { error, value } = validateCreateMedicine(req.body);
  if (error) {
    if (req.file) deleteImageFile("/uploads/medicines/" + req.file.filename);
    return res.status(400).json({ error: error.details[0].message });
  }

  const imageUrl = req.file ? "/uploads/medicines/" + req.file.filename : "";

  const medicine = new Medicine({
    ...value,
    imageUrl,
    pharmacyId: req.admin.pharmacyId
  });
  await medicine.save();

  res.status(201).json({ medicine });
}

/**
 * PUT /api/admin/medicines/:id
 * Protected. Partial update - only fields present in the body are
 * changed. Ownership is checked (medicine.pharmacyId must match the
 * admin's pharmacyId); a mismatch returns 404, not 403, so an admin
 * cannot even confirm another pharmacy's medicine id exists. A new
 * uploaded image replaces the old one; the old file is deleted from disk.
 */
async function updateMedicine(req, res) {
  const { error: idError } = validateObjectId(req.params.id);
  if (idError) {
    if (req.file) deleteImageFile("/uploads/medicines/" + req.file.filename);
    return res.status(400).json({ error: idError.details[0].message });
  }

  const { error, value } = validateUpdateMedicine(req.body);
  if (error) {
    if (req.file) deleteImageFile("/uploads/medicines/" + req.file.filename);
    return res.status(400).json({ error: error.details[0].message });
  }

  if (Object.keys(value).length === 0 && !req.file) {
    return res.status(400).json({ error: "At least one field or an image must be provided to update" });
  }

  const medicine = await Medicine.findById(req.params.id);
  if (!medicine || medicine.pharmacyId !== req.admin.pharmacyId) {
    if (req.file) deleteImageFile("/uploads/medicines/" + req.file.filename);
    return res.status(404).json({ error: "Medicine not found" });
  }

  const previousImageUrl = medicine.imageUrl;

  Object.assign(medicine, value);
  if (req.file) {
    medicine.imageUrl = "/uploads/medicines/" + req.file.filename;
  }
  await medicine.save(); // triggers pre("save") - re-derives `available`

  if (req.file && previousImageUrl) {
    deleteImageFile(previousImageUrl);
  }

  res.json({ medicine });
}

/**
 * DELETE /api/admin/medicines/:id
 * Protected. Same ownership check as update. Also removes the medicine's
 * uploaded image file from disk, if any.
 */
async function deleteMedicine(req, res) {
  const { error } = validateObjectId(req.params.id);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const medicine = await Medicine.findById(req.params.id);
  if (!medicine || medicine.pharmacyId !== req.admin.pharmacyId) {
    return res.status(404).json({ error: "Medicine not found" });
  }

  await medicine.deleteOne();
  deleteImageFile(medicine.imageUrl);

  res.json({ message: "Medicine deleted" });
}

module.exports = { listAllMedicines, createMedicine, updateMedicine, deleteMedicine };
