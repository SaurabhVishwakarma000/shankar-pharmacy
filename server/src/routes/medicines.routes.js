const express = require("express");
const router = express.Router();

const asyncHandler = require("../middleware/asyncHandler");
const requireDB = require("../middleware/requireDB");
const { listMedicines, getMedicineById } = require("../controllers/medicines.controller");

// Public, read-only routes.
// Admin write routes (add/edit/delete/update stock) are added in a later
// stage once authentication/authorization exist.
router.get("/", requireDB, asyncHandler(listMedicines));
router.get("/:id", requireDB, asyncHandler(getMedicineById));

module.exports = router;
