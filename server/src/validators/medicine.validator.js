const Joi = require("joi");

// GET /api/medicines?search=...
const listQuerySchema = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  pharmacy: Joi.string().trim().max(100).optional()
});

// Mongo ObjectId format check, used for :id route params
const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "Invalid medicine id format"
  });

// POST /api/admin/medicines
// `available` is deliberately not accepted here - it is always derived
// from `stock` server-side (see Medicine model), so it can never be set
// to a value that contradicts the stock count. `pharmacyId` is also
// deliberately not accepted - it always comes from the authenticated
// admin's session, never from the request body.
const createMedicineSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required().messages({
    "string.empty": "Medicine name is required",
    "any.required": "Medicine name is required"
  }),
  price: Joi.number().min(0).required().messages({
    "number.base": "Price must be a valid number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required"
  }),
  stock: Joi.number().integer().min(0).required().messages({
    "number.base": "Stock must be a valid whole number",
    "number.integer": "Stock must be a whole number",
    "number.min": "Stock cannot be negative",
    "any.required": "Stock is required"
  }),
  category: Joi.string().trim().max(100).allow("").optional(),
  description: Joi.string().trim().max(1000).allow("").optional()
});

// PUT /api/admin/medicines/:id
// Same field rules as create, but every field is optional - at least one
// updatable field must be present (checked in the controller/middleware).
const updateMedicineSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  price: Joi.number().min(0).optional().messages({
    "number.min": "Price cannot be negative"
  }),
  stock: Joi.number().integer().min(0).optional().messages({
    "number.integer": "Stock must be a whole number",
    "number.min": "Stock cannot be negative"
  }),
  category: Joi.string().trim().max(100).allow("").optional(),
  description: Joi.string().trim().max(1000).allow("").optional()
});
// Note: deliberately no .min(1) here - an update that only replaces the
// image (no other fields) is valid. The "at least one field OR an image"
// check happens in the controller, which knows whether req.file is set.

function validateListQuery(query) {
  return listQuerySchema.validate(query);
}

function validateObjectId(id) {
  return objectIdSchema.validate(id);
}

function validateCreateMedicine(body) {
  return createMedicineSchema.validate(body);
}

function validateUpdateMedicine(body) {
  return updateMedicineSchema.validate(body);
}

module.exports = {
  validateListQuery,
  validateObjectId,
  validateCreateMedicine,
  validateUpdateMedicine
};
