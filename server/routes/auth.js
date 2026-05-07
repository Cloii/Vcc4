import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { signToken, verifyToken } from "../middleware/auth.js";

const router = Router();

const ADMIN_CODE = process.env.ADMIN_CODE || "UB-ADMIN-2024";
const STAFF_CODE = process.env.STAFF_CODE || "UB-STAFF-2024";

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role = "student", adminCode } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Validate role codes
    let assignedRole = "student";
    if (role === "admin" && adminCode === ADMIN_CODE) assignedRole = "admin";
    else if (role === "staff" && adminCode === STAFF_CODE) assignedRole = "staff";
    else if ((role === "admin" || role === "staff") && adminCode !== ADMIN_CODE && adminCode !== STAFF_CODE) {
      return res.status(400).json({ error: "Invalid access code" });
    }

    // Check if email already exists
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);

    db.prepare(
      "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)"
    ).run(id, email.toLowerCase(), password_hash, name, assignedRole);

    const token = signToken({ id, email: email.toLowerCase(), name, role: assignedRole });
    return res.status(201).json({
      token,
      user: { id, email: email.toLowerCase(), name, role: assignedRole },
    });
  } catch (e) {
    console.error("Signup error:", e);
    return res.status(500).json({ error: "Signup failed: " + e.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    // Update last login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Login failed: " + e.message });
  }
});

// GET /api/auth/role  — requires Bearer token
router.get("/role", verifyToken, (req, res) => {
  try {
    const user = db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ role: user.role, profile: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ error: "Role fetch error: " + e.message });
  }
});

export default router;
