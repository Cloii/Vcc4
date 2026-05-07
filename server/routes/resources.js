import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const mapResource = (r) => ({
  id: r.id,
  name: r.name,
  buildingId: r.building_id,
  location: r.location,
  contactInfo: r.contact_info,
  operatingHours: r.operating_hours,
  category: r.category,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// GET /api/resources
router.get("/", (req, res) => {
  try {
    const resources = db.prepare("SELECT * FROM resources ORDER BY name ASC").all();
    return res.json(resources.map(mapResource));
  } catch (e) {
    return res.status(500).json({ error: "Resources fetch error: " + e.message });
  }
});

// POST /api/resources
router.post("/", requireAdmin, (req, res) => {
  try {
    const { name, buildingId, location, contactInfo, operatingHours, category, description } = req.body;
    if (!name) return res.status(400).json({ error: "Resource name is required" });
    const id = uuidv4();
    db.prepare(
      `INSERT INTO resources (id, name, building_id, location, contact_info, operating_hours, category, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, buildingId || null, location || "", contactInfo || "", operatingHours || "", category || "services", description || "");
    const resource = db.prepare("SELECT * FROM resources WHERE id = ?").get(id);
    logAudit(req.user, "CREATE", "resource", id, null, req.body);
    return res.status(201).json(mapResource(resource));
  } catch (e) {
    return res.status(500).json({ error: "Create resource error: " + e.message });
  }
});

// PUT /api/resources/:id
router.put("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM resources WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Resource not found" });
    const { name, buildingId, location, contactInfo, operatingHours, category, description } = req.body;
    db.prepare(
      `UPDATE resources SET name=?, building_id=?, location=?, contact_info=?, operating_hours=?, category=?, description=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      name ?? existing.name,
      buildingId ?? existing.building_id,
      location ?? existing.location,
      contactInfo ?? existing.contact_info,
      operatingHours ?? existing.operating_hours,
      category ?? existing.category,
      description ?? existing.description,
      id
    );
    const updated = db.prepare("SELECT * FROM resources WHERE id = ?").get(id);
    logAudit(req.user, "UPDATE", "resource", id, existing, req.body);
    return res.json(mapResource(updated));
  } catch (e) {
    return res.status(500).json({ error: "Update resource error: " + e.message });
  }
});

// DELETE /api/resources/:id
router.delete("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM resources WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Resource not found" });
    db.prepare("DELETE FROM resources WHERE id = ?").run(id);
    logAudit(req.user, "DELETE", "resource", id, existing, null);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Delete resource error: " + e.message });
  }
});

export default router;
