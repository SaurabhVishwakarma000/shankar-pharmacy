const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "medicines");

// Ensure the upload directory exists before multer tries to write into it.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Random filename - never trust the client-supplied original filename
    // for anything beyond picking an extension.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : "";
    const randomName = crypto.randomBytes(16).toString("hex");
    cb(null, randomName + safeExt);
  }
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, or WEBP images are allowed"));
  }
  cb(null, true);
}

const uploadMedicineImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
}).single("image"); // form field name the frontend must use: "image"

/**
 * Wraps multer's callback-style middleware so upload errors (wrong type,
 * too large) reach the central error handler as a clean 400 instead of
 * multer's default behavior.
 */
function handleMedicineImageUpload(req, res, next) {
  uploadMedicineImage(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Image must be 2MB or smaller" });
      }
      return res.status(400).json({ error: "Image upload failed" });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Image upload failed" });
    }
    next();
  });
}

module.exports = { handleMedicineImageUpload, UPLOAD_DIR };
