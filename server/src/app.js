require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { getDBStatus } = require("./config/db");

const app = express();

// --- Core middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://127.0.0.1:5500",
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Serves uploaded medicine images (read-only static files). Images are
// never executable and filenames are server-generated random hex, never
// the client-supplied original filename - see middleware/upload.js.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// --- Health check (Stage 1) ---
// Reports server-up status and DB connection status separately, so the
// server can start and respond even if MongoDB is not reachable yet.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    server: "up",
    db: getDBStatus(),
    timestamp: new Date().toISOString()
  });
});

// --- Route mounts ---
app.use("/api/medicines", require("./routes/medicines.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/admin/medicines", require("./routes/adminMedicines.routes"));

// --- Future route mounts (added in later stages) ---
// app.use("/api/config", require("./routes/config.routes"));

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --- Central error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error"
  });
});

// This module only builds and exports the Express app - it does not
// connect to the database or start listening. That happens in server.js,
// so the app can be imported safely in tests without side effects.
module.exports = app;
