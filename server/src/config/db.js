const mongoose = require("mongoose");

/**
 * Connects to MongoDB using MONGODB_URI from environment variables.
 * Does not crash the process if the DB is unreachable - logs the error
 * and lets the caller decide what to do (the health-check route reports
 * DB status separately from server-up status).
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("[db] MONGODB_URI is not set. Check your .env file.");
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("[db] Connected to MongoDB");
    return true;
  } catch (err) {
    console.error("[db] Failed to connect to MongoDB:", err.message);
    return false;
  }
}

function getDBStatus() {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  return stateMap[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDB, getDBStatus };
