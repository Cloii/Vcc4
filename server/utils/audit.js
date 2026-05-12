import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Writes an audit log entry to Supabase.
 * @param {object} adminUser - The authenticated user (from req.user)
 * @param {string} action    - e.g. "CREATE", "UPDATE", "DELETE", "UPLOAD"
 * @param {string} resourceType - e.g. "building", "user", "path", "resource", "panorama"
 * @param {string} resourceId
 * @param {object|null} oldValues
 * @param {object|null} newValues
 */
export const logAudit = async (adminUser, action, resourceType, resourceId, oldValues, newValues) => {
  try {
    const id = uuidv4();
    const { error } = await supabase.from("audit_logs").insert({
      id,
      admin_id: adminUser?.id || null,
      admin_email: adminUser?.email || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues ? oldValues : null,
      new_values: newValues ? newValues : null,
      ip_address: null,
    });

    if (error) {
      console.error("Audit log error:", error.message);
    }
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
};

