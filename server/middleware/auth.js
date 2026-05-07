import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vcc-ub-local-secret-2024";

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Attaches decoded payload to req.user.
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, name }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Requires admin or staff role.
 */
export const requireAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ error: "Forbidden: Admin/Staff access required" });
    }
    next();
  });
};

/**
 * Requires strictly admin role.
 */
export const requireSuperAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  });
};

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};
