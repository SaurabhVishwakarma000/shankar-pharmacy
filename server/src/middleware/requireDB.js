const mongoose = require("mongoose");

/**
 * Guards routes that need the database. If MongoDB is not connected,
 * responds immediately with a clear 503 instead of letting the request
 * hang on a Mongoose operation that will eventually time out.
 */
function requireDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Database is currently unavailable. Please try again shortly."
    });
  }
  next();
}

module.exports = requireDB;
