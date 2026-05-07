import { Router } from "express";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/analytics
router.get("/", requireAdmin, (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5000").all();
    const alerts = db.prepare("SELECT * FROM security_alerts ORDER BY timestamp DESC").all();
    const buildings = db.prepare("SELECT id, name FROM buildings").all();
    const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get();

    // Group logs by date
    const logsByDate = {};
    const actionCounts = {};
    const buildingViews = {};
    const uniqueUsers = new Set();

    for (const log of logs) {
      const date = log.timestamp?.split("T")[0] || log.timestamp?.split(" ")[0];
      if (date) logsByDate[date] = (logsByDate[date] || 0) + 1;
      if (log.action) actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      if (log.building_id) buildingViews[log.building_id] = (buildingViews[log.building_id] || 0) + 1;
      if (log.user_id) uniqueUsers.add(log.user_id);
    }

    const dailyActivity = Object.entries(logsByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    const popularBuildings = Object.entries(buildingViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, views]) => {
        const bldg = buildings.find(b => b.id === id);
        return { id, name: bldg?.name || id, views };
      });

    // Role distribution
    const roleStats = db.prepare(
      "SELECT role, COUNT(*) as cnt FROM users GROUP BY role"
    ).all();

    // Recent signups (last 7 days)
    const recentSignups = db.prepare(
      `SELECT COUNT(*) as cnt FROM users WHERE created_at > datetime('now', '-7 days')`
    ).get();

    return res.json({
      totalLogs: logs.length,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => !a.resolved).length,
      uniqueUsers: uniqueUsers.size,
      totalUsers: userCount.cnt,
      dailyActivity,
      actionCounts,
      popularBuildings,
      roleDistribution: roleStats,
      recentSignups: recentSignups.cnt,
    });
  } catch (e) {
    return res.status(500).json({ error: "Analytics error: " + e.message });
  }
});

export default router;
