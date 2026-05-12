import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import db from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const router = Router();

// ── Activity Logs ──────────────────────────────────────────────────────────────

// POST /api/activity-logs
router.post("/", (req, res) => {
  try {
    const { action, userId, buildingId, details } = req.body;
    const id = uuidv4();
    const ipAddress = req.ip || req.connection?.remoteAddress || "";
    db.prepare(
      `INSERT INTO activity_logs (id, action, user_id, building_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, action || "unknown", userId || null, buildingId || null, details ? JSON.stringify(details) : null, ipAddress);

    // Check for suspicious activity (>8 actions in 10 seconds from same user)
    if (userId) {
      const tenSecsAgo = new Date(Date.now() - 10000).toISOString();
      const recentCount = db.prepare(
        `SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = ? AND timestamp > ?`
      ).get(userId, tenSecsAgo);

      if (recentCount.cnt > 8) {
        const alertId = uuidv4();
        const existing = db.prepare(
          `SELECT id FROM security_alerts WHERE user_id = ? AND type = 'rapid_navigation' AND resolved = 0 AND timestamp > ?`
        ).get(userId, tenSecsAgo);
        if (!existing) {
          db.prepare(
            `INSERT INTO security_alerts (id, user_id, type, description, severity)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            alertId, userId, "rapid_navigation",
            `User made ${recentCount.cnt} actions in 10 seconds`,
            "medium"
          );
        }
      }
    }
    return res.status(201).json({ id, action, userId, buildingId });
  } catch (e) {
    return res.status(500).json({ error: "Log error: " + e.message });
  }
});

// GET /api/activity-logs
router.get("/", requireAdmin, (req, res) => {
  try {
    const logs = db.prepare(
      `SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 500`
    ).all();
    return res.json(logs.map(l => ({
      id: l.id,
      action: l.action,
      userId: l.user_id,
      buildingId: l.building_id,
      details: l.details ? JSON.parse(l.details) : null,
      ipAddress: l.ip_address,
      timestamp: l.timestamp,
    })));
  } catch (e) {
    return res.status(500).json({ error: "Logs fetch error: " + e.message });
  }
});

// ── Audit Logs ─────────────────────────────────────────────────────────────────

// GET /api/audit-logs
router.get("/audit", requireAdmin, async (req, res) => {
  try {
    const { limit = 200, offset = 0, search = "", resourceType = "" } = req.query;
    
    let query = supabase.from("audit_logs").select("*", { count: "exact" });

    // Add filters
    if (search) {
      query = query.or(`action.ilike.%${search}%,admin_email.ilike.%${search}%,resource_type.ilike.%${search}%`);
    }
    if (resourceType) {
      query = query.eq("resource_type", resourceType);
    }

    // Order and paginate
    query = query.order("timestamp", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("Audit logs fetch error:", error);
      return res.status(500).json({ error: "Audit logs fetch error: " + error.message });
    }

    return res.json({
      logs: (logs || []).map(l => ({
        id: l.id,
        adminId: l.admin_id,
        adminEmail: l.admin_email,
        action: l.action,
        resourceType: l.resource_type,
        resourceId: l.resource_id,
        oldValues: l.old_values ? (typeof l.old_values === 'string' ? JSON.parse(l.old_values) : l.old_values) : null,
        newValues: l.new_values ? (typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values) : null,
        ipAddress: l.ip_address,
        timestamp: l.timestamp,
      })),
      total: count || 0,
    });
  } catch (e) {
    console.error("Audit logs error:", e);
    return res.status(500).json({ error: "Audit logs fetch error: " + e.message });
  }
});

// ── Security Alerts ────────────────────────────────────────────────────────────

// GET /api/security-alerts
router.get("/security", requireAdmin, (req, res) => {
  try {
    const alerts = db.prepare(
      `SELECT * FROM security_alerts ORDER BY timestamp DESC`
    ).all();
    return res.json(alerts.map(a => ({
      id: a.id,
      userId: a.user_id,
      type: a.type,
      description: a.description,
      severity: a.severity,
      resolved: a.resolved === 1,
      resolvedAt: a.resolved_at,
      resolvedBy: a.resolved_by,
      timestamp: a.timestamp,
    })));
  } catch (e) {
    return res.status(500).json({ error: "Alerts fetch error: " + e.message });
  }
});

// POST /api/security-alerts
router.post("/security", (req, res) => {
  try {
    const { userId, type, description, severity } = req.body;
    const id = uuidv4();
    db.prepare(
      `INSERT INTO security_alerts (id, user_id, type, description, severity) VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId || null, type || "unknown", description || "", severity || "medium");
    return res.status(201).json({ id, userId, type, description, severity, resolved: false });
  } catch (e) {
    return res.status(500).json({ error: "Create alert error: " + e.message });
  }
});

// PUT /api/security-alerts/:id/resolve
router.put("/security/:id/resolve", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM security_alerts WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Alert not found" });
    const resolvedBy = req.user?.email || "admin";
    db.prepare(
      `UPDATE security_alerts SET resolved=1, resolved_at=datetime('now'), resolved_by=? WHERE id=?`
    ).run(resolvedBy, id);
    const updated = db.prepare("SELECT * FROM security_alerts WHERE id = ?").get(id);
    return res.json({ ...updated, resolved: true });
  } catch (e) {
    return res.status(500).json({ error: "Resolve alert error: " + e.message });
  }
});

export default router;
