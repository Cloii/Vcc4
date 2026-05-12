import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs/promises";
import { requireAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { capImageFileForWebGL } from "../utils/capImageForWebGL.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "../../public/uploads");

// Configure multer — disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|gif|webp|svg|insp/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const extOk = allowedExts.test(ext);
  // .insp files from Insta360 cameras may arrive as octet-stream or image/jpeg
  const allowedMimes = /image\/|application\/octet-stream/;
  const mimeOk = allowedMimes.test(file.mimetype);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpg, png, gif, webp, svg, insp)"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — supports large 360° panoramas
});

const router = Router();

// POST /api/upload/image
router.post("/image", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const absPath =
      typeof req.file.path === "string" ? req.file.path : path.join(UPLOADS_DIR, req.file.filename);

    try {
      const capped = await capImageFileForWebGL(absPath);
      if (capped.resized) {
        console.log(`[upload] Downscaled panorama for WebGL: ${req.file.filename} → ${capped.width}×${capped.height}`);
        const st = await fs.stat(absPath);
        req.file.size = st.size;
      }
    } catch (capErr) {
      console.warn(`[upload] WebGL-safe resize skipped for ${req.file.filename}: ${capErr?.message}`);
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    await logAudit(req.user, "UPLOAD", "file", req.file.filename, null, {
      originalName: req.file.originalname,
      size: req.file.size,
      url: fileUrl,
    });

    return res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });
});

export default router;
