import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const mapBuilding = (b) => ({
  id: b.id,
  name: b.name,
  lat: b.lat,
  lng: b.lng,
  description: b.description,
  category: b.category,
  sensitivityLevel: b.sensitivity_level,
  imageUrl: b.image_url,
  createdAt: b.created_at,
  updatedAt: b.updated_at,
});

// GET /api/buildings
router.get("/", (req, res) => {
  try {
    const buildings = db.prepare("SELECT * FROM buildings ORDER BY name ASC").all();
    return res.json(buildings.map(mapBuilding));
  } catch (e) {
    return res.status(500).json({ error: "Buildings fetch error: " + e.message });
  }
});

// GET /api/buildings/:id
router.get("/:id", (req, res) => {
  try {
    const b = db.prepare("SELECT * FROM buildings WHERE id = ?").get(req.params.id);
    if (!b) return res.status(404).json({ error: "Building not found" });
    return res.json(mapBuilding(b));
  } catch (e) {
    return res.status(500).json({ error: "Building fetch error: " + e.message });
  }
});

// POST /api/buildings
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, lat, lng, description, category, sensitivityLevel, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: "Building name is required" });
    const id = uuidv4();
    db.prepare(
      `INSERT INTO buildings (id, name, lat, lng, description, category, sensitivity_level, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, lat || 0, lng || 0, description || "", category || "academic", sensitivityLevel || "public", imageUrl || "");

    const building = db.prepare("SELECT * FROM buildings WHERE id = ?").get(id);
    await logAudit(req.user, "CREATE", "building", id, null, req.body);
    return res.status(201).json(mapBuilding(building));
  } catch (e) {
    return res.status(500).json({ error: "Create building error: " + e.message });
  }
});

// PUT /api/buildings/:id
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM buildings WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Building not found" });

    const { name, lat, lng, description, category, sensitivityLevel, imageUrl } = req.body;
    db.prepare(
      `UPDATE buildings SET name=?, lat=?, lng=?, description=?, category=?, sensitivity_level=?, image_url=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(
      name ?? existing.name,
      lat ?? existing.lat,
      lng ?? existing.lng,
      description ?? existing.description,
      category ?? existing.category,
      sensitivityLevel ?? existing.sensitivity_level,
      imageUrl ?? existing.image_url,
      id
    );

    const updated = db.prepare("SELECT * FROM buildings WHERE id = ?").get(id);
    await logAudit(req.user, "UPDATE", "building", id, existing, req.body);
    return res.json(mapBuilding(updated));
  } catch (e) {
    return res.status(500).json({ error: "Update building error: " + e.message });
  }
});

// DELETE /api/buildings/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM buildings WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Building not found" });
    db.prepare("DELETE FROM buildings WHERE id = ?").run(id);
    db.prepare("DELETE FROM panoramas WHERE building_id = ?").run(id);
    await logAudit(req.user, "DELETE", "building", id, existing, null);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Delete building error: " + e.message });
  }
});

export default router;
