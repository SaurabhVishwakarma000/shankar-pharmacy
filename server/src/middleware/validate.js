/**
 * Generic Joi validation middleware factory. Runs before any DB-dependent
 * middleware, so a malformed request gets a clear 400 even if the
 * database happens to be unavailable - validation and DB status are
 * independent concerns and shouldn't mask each other.
 */
function validateBody(validatorFn) {
  return function (req, res, next) {
    const { error, value } = validatorFn(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    req.body = value;
    next();
  };
}

module.exports = { validateBody };
