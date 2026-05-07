import { Router } from "express";
import db from "../db.js";

const router = Router();

// GET /api/route?from=bldg-1&to=bldg-5&accessible=false
router.get("/", (req, res) => {
  try {
    const { from, to, accessible } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const allPaths = db.prepare("SELECT * FROM paths").all();
    const availablePaths = allPaths.filter(p => {
      if (p.status === "closed") return false;
      if (accessible === "true" && !p.accessible) return false;
      return true;
    });

    // Build adjacency list
    const graph = {};
    for (const p of availablePaths) {
      if (!graph[p.from_building]) graph[p.from_building] = [];
      if (!graph[p.to_building]) graph[p.to_building] = [];
      graph[p.from_building].push({ to: p.to_building, pathId: p.id, distance: p.distance });
      graph[p.to_building].push({ to: p.from_building, pathId: p.id, distance: p.distance });
    }

    // Dijkstra BFS for shortest path
    const queue = [{ node: from, path: [from], distance: 0 }];
    const visited = new Set();

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const { node, path, distance } = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      if (node === to) {
        const walkingTime = Math.ceil(distance / 80); // ~80m/min walking speed
        return res.json({ found: true, path, distance, walkingTime });
      }
      for (const neighbor of (graph[node] || [])) {
        if (!visited.has(neighbor.to)) {
          queue.push({ node: neighbor.to, path: [...path, neighbor.to], distance: distance + neighbor.distance });
        }
      }
    }
    return res.json({ found: false, path: [], distance: 0, walkingTime: 0 });
  } catch (e) {
    return res.status(500).json({ error: "Route calculation error: " + e.message });
  }
});

export default router;
