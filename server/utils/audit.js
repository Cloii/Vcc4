import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Writes an audit log entry to the database.
 * @param {object} adminUser - The authenticated user (from req.user)
 * @param {string} action    - e.g. "CREATE", "UPDATE", "DELETE", "UPLOAD"
 * @param {string} resourceType - e.g. "building", "user", "path"
 * @param {string} resourceId
 * @param {object|null} oldValues
 * @param {object|null} newValues
 */
export const logAudit = (adminUser, action, resourceType, resourceId, oldValues, newValues) => {
  try {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, resource_type, resource_id, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      adminUser?.id || null,
      adminUser?.email || null,
      action,
      resourceType,
      resourceId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    );
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
};
