const Joi = require("joi");

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Username is required",
    "any.required": "Username is required"
  }),
  password: Joi.string().min(1).max(200).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required"
  })
});

// Used only by the admin-creation script, not by the login route -
// enforces a minimum password strength when an admin account is created.
const createAdminSchema = Joi.object({
  username: Joi.string().trim().min(3).max(100).required(),
  password: Joi.string().min(8).max(200).required().messages({
    "string.min": "Password must be at least 8 characters long"
  })
});

function validateLogin(body) {
  return loginSchema.validate(body);
}

function validateCreateAdmin(data) {
  return createAdminSchema.validate(data);
}

module.exports = { validateLogin, validateCreateAdmin };
