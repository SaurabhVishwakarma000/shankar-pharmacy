const express = require("express");
const router = express.Router();

const asyncHandler = require("../middleware/asyncHandler");
const requireDB = require("../middleware/requireDB");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");
const { handleMedicineImageUpload } = require("../middleware/upload");
const {
  listAllMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine
} = require("../controllers/adminMedicines.controller");

// Every route here requires a valid admin session. requireAuth verifies
// the JWT; requireAdmin checks the role. Both run before requireDB, so
// an unauthenticated request is rejected with 401 even if the database
// happens to be unavailable - auth failures are never masked by DB status.
router.use(requireAuth, requireAdmin);

router.get("/", requireDB, asyncHandler(listAllMedicines));
router.post("/", handleMedicineImageUpload, requireDB, asyncHandler(createMedicine));
router.put("/:id", handleMedicineImageUpload, requireDB, asyncHandler(updateMedicine));
router.delete("/:id", requireDB, asyncHandler(deleteMedicine));

module.exports = router;
