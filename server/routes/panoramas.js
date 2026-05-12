import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const mapPanorama = (p) => ({
  id: p.id,
  buildingId: p.building_id,
  name: p.name,
  imageUrl: p.image_url,
  hotspots: typeof p.hotspots === "string" ? JSON.parse(p.hotspots) : p.hotspots,
  sortOrder: p.sort_order ?? 0,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

// GET /api/panoramas?buildingId=xxx
router.get("/", (req, res) => {
  try {
    const { buildingId } = req.query;
    let panoramas;
    if (buildingId) {
      panoramas = db
        .prepare("SELECT * FROM panoramas WHERE building_id = ? ORDER BY sort_order ASC, name ASC")
        .all(buildingId);
    } else {
      panoramas = db.prepare("SELECT * FROM panoramas ORDER BY building_id ASC, sort_order ASC, name ASC").all();
    }
    return res.json(panoramas.map(mapPanorama));
  } catch (e) {
    return res.status(500).json({ error: "Panoramas fetch error: " + e.message });
  }
});

// PUT /api/panoramas/reorder
// Body: { buildingId: string, orderedIds: string[] }
router.put("/reorder", requireAdmin, async (req, res) => {
  try {
    const { buildingId, orderedIds } = req.body || {};
    if (!buildingId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: "buildingId and orderedIds[] are required" });
    }

    const existing = db
      .prepare("SELECT id FROM panoramas WHERE building_id = ? ORDER BY sort_order ASC, name ASC")
      .all(buildingId)
      .map((r) => r.id);

    const existingSet = new Set(existing);
    const unique = [];
    const seen = new Set();
    for (const id of orderedIds) {
      if (typeof id !== "string" || !existingSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
    // Append any missing panoramas to keep list complete.
    for (const id of existing) {
      if (!seen.has(id)) unique.push(id);
    }

    const upd = db.prepare("UPDATE panoramas SET sort_order=?, updated_at=datetime('now') WHERE id=? AND building_id=?");
    const tx = db.transaction(() => {
      unique.forEach((id, idx) => upd.run(idx, id, buildingId));
    });
    tx();

    await logAudit(req.user, "REORDER", "panorama", buildingId, null, { orderedIds: unique });
    const updated = db
      .prepare("SELECT * FROM panoramas WHERE building_id = ? ORDER BY sort_order ASC, name ASC")
      .all(buildingId);
    return res.json(updated.map(mapPanorama));
  } catch (e) {
    return res.status(500).json({ error: "Reorder panoramas error: " + e.message });
  }
});

// POST /api/panoramas
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { buildingId, name, imageUrl, hotspots } = req.body;
    if (!buildingId || !name || !imageUrl) return res.status(400).json({ error: "buildingId, name, and imageUrl are required" });
    const id = uuidv4();
    const nextOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM panoramas WHERE building_id = ?")
      .get(buildingId)?.next ?? 0;
    db.prepare(
      `INSERT INTO panoramas (id, building_id, name, image_url, hotspots, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, buildingId, name, imageUrl, JSON.stringify(hotspots || []), nextOrder);
    const panorama = db.prepare("SELECT * FROM panoramas WHERE id = ?").get(id);
    await logAudit(req.user, "CREATE", "panorama", id, null, req.body);
    return res.status(201).json(mapPanorama(panorama));
  } catch (e) {
    return res.status(500).json({ error: "Create panorama error: " + e.message });
  }
});

// PUT /api/panoramas/:id
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM panoramas WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Panorama not found" });
    const { buildingId, name, imageUrl, hotspots, sortOrder } = req.body;
    db.prepare(
      `UPDATE panoramas SET building_id=?, name=?, image_url=?, hotspots=?, sort_order=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      buildingId ?? existing.building_id,
      name ?? existing.name,
      imageUrl ?? existing.image_url,
      hotspots !== undefined ? JSON.stringify(hotspots) : existing.hotspots,
      typeof sortOrder === "number" ? sortOrder : existing.sort_order ?? 0,
      id
    );
    const updated = db.prepare("SELECT * FROM panoramas WHERE id = ?").get(id);
    await logAudit(req.user, "UPDATE", "panorama", id, existing, req.body);
    return res.json(mapPanorama(updated));
  } catch (e) {
    return res.status(500).json({ error: "Update panorama error: " + e.message });
  }
});

// DELETE /api/panoramas/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM panoramas WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Panorama not found" });
    db.prepare("DELETE FROM panoramas WHERE id = ?").run(id);
    await logAudit(req.user, "DELETE", "panorama", id, existing, null);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Delete panorama error: " + e.message });
  }
});

export default router;
