import { Router } from "express";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const DEFAULT_LANDING = {
  heroBadge: "University of Bohol",
  heroTitle: "Virtual Campus",
  heroTitleAccent: "Companion",
  heroSubtitle:
    "Explore, navigate, and discover the University of Bohol campus through immersive 360° tours and interactive maps.",
  heroImageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600&q=80",
  campusImageUrl: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800&q=80",
  campusCardTitle: "Main Administration Building",
  campusCardSubtitle: "Click to start tour →",
  campusSectionBadge: "360° Virtual Tours",
  campusSectionTitle: "Explore Campus Without Leaving Home",
  campusSectionBody:
    "Navigate through our immersive panoramic tours of all major buildings. Click hotspots to walk through corridors, visit labs, and discover hidden gems of the UB campus.",
  ctaTitle: "Ready to Explore UB Campus?",
  ctaBody: "Sign up for free and unlock the full campus experience with your student or staff account.",
  ctaPrimaryLabel: "Get Started Free",
  ctaPrimaryTo: "/signup",
  ctaSecondaryLabel: "View Virtual Tours",
  ctaSecondaryTo: "/tours",
  stats: [
    { label: "Campus Buildings", value: "10+" },
    { label: "Virtual Tours", value: "10" },
    { label: "Campus Resources", value: "50+" },
    { label: "Active Students", value: "5000+" },
  ],
};

const DEFAULT_CAMPUS_TOUR = {
  startPanoId: null,
};

const DEFAULTS_BY_KEY = {
  landing: DEFAULT_LANDING,
  campus_tour: DEFAULT_CAMPUS_TOUR,
};

const readContent = (key) => {
  const fallback = DEFAULTS_BY_KEY[key] ?? null;
  const row = db.prepare("SELECT value, updated_at FROM site_content WHERE key = ?").get(key);
  if (!row) return { value: fallback, updated_at: null };
  try {
    return { value: JSON.parse(row.value), updated_at: row.updated_at };
  } catch {
    return { value: fallback, updated_at: row.updated_at };
  }
};

const upsertContent = (key, valueObj) => {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO site_content (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
  ).run(key, JSON.stringify(valueObj), now);
  return now;
};

// GET /api/site/landing (public)
router.get("/landing", (req, res) => {
  const { value, updated_at } = readContent("landing");
  res.json({ content: value, updatedAt: updated_at });
});

// PUT /api/site/landing (admin/staff)
router.put("/landing", requireAdmin, (req, res) => {
  const { value: oldValue } = readContent("landing");

  const incoming = req.body?.content;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "Invalid payload. Expected { content: {...} }" });
  }

  // Merge with defaults so missing fields don't break the landing page.
  const merged = {
    ...DEFAULT_LANDING,
    ...incoming,
    stats: Array.isArray(incoming.stats) ? incoming.stats : DEFAULT_LANDING.stats,
  };

  const updatedAt = upsertContent("landing", merged);
  logAudit(req.user, "UPDATE", "site_content", "landing", oldValue, merged);

  res.json({ ok: true, content: merged, updatedAt });
});

// GET /api/site/campus-tour (public)
router.get("/campus-tour", (req, res) => {
  const { value, updated_at } = readContent("campus_tour");
  res.json({ content: value || DEFAULT_CAMPUS_TOUR, updatedAt: updated_at });
});

// PUT /api/site/campus-tour (admin/staff)
router.put("/campus-tour", requireAdmin, (req, res) => {
  const { value: oldValue } = readContent("campus_tour");

  const incoming = req.body?.content;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "Invalid payload. Expected { content: {...} }" });
  }

  const startPanoId =
    typeof incoming.startPanoId === "string" && incoming.startPanoId.length > 0
      ? incoming.startPanoId
      : null;

  if (startPanoId) {
    const exists = db.prepare("SELECT id FROM panoramas WHERE id = ?").get(startPanoId);
    if (!exists) return res.status(400).json({ error: "Selected start panorama does not exist" });
  }

  const merged = { ...DEFAULT_CAMPUS_TOUR, startPanoId };
  const updatedAt = upsertContent("campus_tour", merged);
  logAudit(req.user, "UPDATE", "site_content", "campus_tour", oldValue, merged);

  res.json({ ok: true, content: merged, updatedAt });
});

export default router;

