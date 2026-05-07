import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { requireAdmin, requireSuperAdmin } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const mapUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  createdAt: u.created_at,
  lastLogin: u.last_login,
});

// GET /api/users
router.get("/", requireAdmin, (req, res) => {
  try {
    const users = db.prepare(
      "SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC"
    ).all();
    return res.json(users.map(mapUser));
  } catch (e) {
    return res.status(500).json({ error: "Users fetch error: " + e.message });
  }
});

// POST /api/users — create user directly (admin only)
router.post("/", requireSuperAdmin, (req, res) => {
  try {
    const { email, password, name, role = "student" } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Email, password, and name are required" });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)"
    ).run(id, email.toLowerCase(), password_hash, name, role);

    const user = db.prepare("SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ?").get(id);
    logAudit(req.user, "CREATE", "user", id, null, { email, name, role });
    return res.status(201).json(mapUser(user));
  } catch (e) {
    return res.status(500).json({ error: "Create user error: " + e.message });
  }
});

// PUT /api/users/:id/role
router.put("/:id/role", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!["admin", "staff", "student"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be admin, staff, or student" });
    }
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "User not found" });
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
    logAudit(req.user, "UPDATE_ROLE", "user", id, { role: existing.role }, { role });
    return res.json({ success: true, role });
  } catch (e) {
    return res.status(500).json({ error: "Role update error: " + e.message });
  }
});

// PUT /api/users/:id — update user details
router.put("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "User not found" });

    let password_hash = existing.password_hash;
    if (password && password.length >= 6) {
      password_hash = bcrypt.hashSync(password, 10);
    }

    db.prepare(
      "UPDATE users SET name=?, email=?, role=?, password_hash=? WHERE id=?"
    ).run(name ?? existing.name, email ?? existing.email, role ?? existing.role, password_hash, id);

    const updated = db.prepare("SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ?").get(id);
    logAudit(req.user, "UPDATE", "user", id, existing, { name, email, role });
    return res.json(mapUser(updated));
  } catch (e) {
    return res.status(500).json({ error: "Update user error: " + e.message });
  }
});

// DELETE /api/users/:id
router.delete("/:id", requireSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: "Cannot delete your own account" });
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "User not found" });
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    logAudit(req.user, "DELETE", "user", id, existing, null);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Delete user error: " + e.message });
  }
});

export default router;
