import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const mapPath = (p) => ({
  id: p.id,
  fromBuilding: p.from_building,
  toBuilding: p.to_building,
  status: p.status,
  accessible: p.accessible === 1 || p.accessible === true,
  distance: p.distance,
  description: p.description,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

// GET /api/paths
router.get("/", (req, res) => {
  try {
    const paths = db.prepare("SELECT * FROM paths ORDER BY id ASC").all();
    return res.json(paths.map(mapPath));
  } catch (e) {
    return res.status(500).json({ error: "Paths fetch error: " + e.message });
  }
});

// POST /api/paths
router.post("/", requireAdmin, (req, res) => {
  try {
    const { fromBuilding, toBuilding, status, accessible, distance, description } = req.body;
    if (!fromBuilding || !toBuilding) return res.status(400).json({ error: "fromBuilding and toBuilding are required" });
    const id = uuidv4();
    db.prepare(
      `INSERT INTO paths (id, from_building, to_building, status, accessible, distance, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, fromBuilding, toBuilding, status || "open", accessible ? 1 : 0, distance || 0, description || "");
    const path = db.prepare("SELECT * FROM paths WHERE id = ?").get(id);
    logAudit(req.user, "CREATE", "path", id, null, req.body);
    return res.status(201).json(mapPath(path));
  } catch (e) {
    return res.status(500).json({ error: "Create path error: " + e.message });
  }
});

// PUT /api/paths/:id
router.put("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM paths WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Path not found" });
    const { fromBuilding, toBuilding, status, accessible, distance, description } = req.body;
    db.prepare(
      `UPDATE paths SET from_building=?, to_building=?, status=?, accessible=?, distance=?, description=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      fromBuilding ?? existing.from_building,
      toBuilding ?? existing.to_building,
      status ?? existing.status,
      accessible !== undefined ? (accessible ? 1 : 0) : existing.accessible,
      distance ?? existing.distance,
      description ?? existing.description,
      id
    );
    const updated = db.prepare("SELECT * FROM paths WHERE id = ?").get(id);
    logAudit(req.user, "UPDATE", "path", id, existing, req.body);
    return res.json(mapPath(updated));
  } catch (e) {
    return res.status(500).json({ error: "Update path error: " + e.message });
  }
});

// DELETE /api/paths/:id
router.delete("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM paths WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Path not found" });
    db.prepare("DELETE FROM paths WHERE id = ?").run(id);
    logAudit(req.user, "DELETE", "path", id, existing, null);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Delete path error: " + e.message });
  }
});

export default router;
