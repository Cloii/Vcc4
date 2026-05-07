import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminCode = process.env.ADMIN_CODE;
  const staffCode = process.env.STAFF_CODE;

  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ error: "Server misconfigured: missing Supabase env vars" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { role, code } = req.body || {};
  if (role !== "admin" && role !== "staff") return res.status(400).json({ error: "Invalid role" });
  if (typeof code !== "string" || code.length < 3) return res.status(400).json({ error: "Invalid code" });

  const expected = role === "admin" ? adminCode : staffCode;
  if (!expected) return res.status(500).json({ error: "Server misconfigured: missing role code env vars" });
  if (code !== expected) return res.status(400).json({ error: "Invalid access code" });

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  const uid = userData.user.id;
  const email = userData.user.email || null;
  const name = userData.user.user_metadata?.name || null;

  const { error: upErr } = await supabase
    .from("profiles")
    .upsert({ id: uid, email, name, role }, { onConflict: "id" });

  if (upErr) return res.status(500).json({ error: upErr.message });
  return res.json({ ok: true, role });
}

