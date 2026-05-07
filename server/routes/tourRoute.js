import { Router } from "express";
import db from "../db.js";

const router = Router();

const parseHotspots = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Builds a directed adjacency list using each panorama's hotspots
 * as outgoing edges to `targetPanoId`.
 */
const buildPanoGraph = () => {
  const rows = db.prepare("SELECT id, name, building_id, hotspots FROM panoramas").all();
  const nodes = new Map();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      buildingId: row.building_id,
      hotspots: parseHotspots(row.hotspots),
    });
  }

  const graph = new Map();
  for (const node of nodes.values()) {
    const edges = [];
    for (const hs of node.hotspots) {
      const target = hs?.targetPanoId;
      if (!target || !nodes.has(target) || target === node.id) continue;
      edges.push({ to: target, label: hs?.label || null });
    }
    graph.set(node.id, edges);
  }

  return { nodes, graph };
};

/**
 * GET /api/tour-route?fromPanoId=...&toPanoId=...
 * BFS shortest path along hotspot edges. Returns step labels for guided UI.
 */
router.get("/", (req, res) => {
  try {
    const { fromPanoId, toPanoId } = req.query;
    if (!fromPanoId || !toPanoId) {
      return res.status(400).json({ error: "fromPanoId and toPanoId are required" });
    }

    const { nodes, graph } = buildPanoGraph();
    if (!nodes.has(fromPanoId)) return res.status(404).json({ error: "fromPanoId not found" });
    if (!nodes.has(toPanoId)) return res.status(404).json({ error: "toPanoId not found" });

    if (fromPanoId === toPanoId) {
      return res.json({ found: true, path: [fromPanoId], steps: [] });
    }

    const queue = [fromPanoId];
    const cameFrom = new Map();
    const labelByEdge = new Map();
    const visited = new Set([fromPanoId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === toPanoId) break;
      const edges = graph.get(current) || [];
      for (const edge of edges) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        cameFrom.set(edge.to, current);
        labelByEdge.set(`${current}->${edge.to}`, edge.label);
        queue.push(edge.to);
      }
    }

    if (!cameFrom.has(toPanoId) && fromPanoId !== toPanoId) {
      return res.json({ found: false, path: [], steps: [] });
    }

    const path = [toPanoId];
    let cursor = toPanoId;
    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor);
      path.unshift(cursor);
    }

    const steps = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const label = labelByEdge.get(`${from}->${to}`) || null;
      const fromNode = nodes.get(from);
      const toNode = nodes.get(to);
      steps.push({
        from,
        to,
        label,
        fromName: fromNode?.name || from,
        toName: toNode?.name || to,
      });
    }

    return res.json({ found: true, path, steps });
  } catch (e) {
    return res.status(500).json({ error: "Tour route error: " + e.message });
  }
});

export default router;
