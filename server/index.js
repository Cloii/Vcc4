import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { mkdirSync } from "fs";

// Import DB (triggers schema creation + seeding)
import "./db.js";

// Routes
import authRoutes from "./routes/auth.js";
import buildingRoutes from "./routes/buildings.js";
import pathRoutes from "./routes/paths.js";
import resourceRoutes from "./routes/resources.js";
import panoramaRoutes from "./routes/panoramas.js";
import logsRoutes from "./routes/logs.js";
import usersRoutes from "./routes/users.js";
import analyticsRoutes from "./routes/analytics.js";
import routeCalcRoutes from "./routes/route.js";
import uploadRoutes from "./routes/upload.js";
import siteRoutes from "./routes/site.js";
import tourRouteRoutes from "./routes/tourRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

const app = express();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../public/uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin/non-browser requests (no Origin header)
    if (!origin) return cb(null, true);
    const ok =
      origin === "http://localhost:3000" ||
      /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin);
    return cb(ok ? null : new Error(`CORS blocked: ${origin}`), ok);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/paths", pathRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/panoramas", panoramaRoutes);
app.use("/api/activity-logs", logsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/route", routeCalcRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/site", siteRoutes);
app.use("/api/tour-route", tourRouteRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: "SQLite (local)",
  });
});

// ── Error Handler ──────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 VCC Local Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Uploads served at: http://localhost:${PORT}/uploads/\n`);
});
