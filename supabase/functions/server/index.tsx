import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const genId = () => crypto.randomUUID();
const parse = <T>(val: string | null): T | null => {
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
};

const verifyToken = async (authHeader: string | null) => {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

const getUserRole = async (userId: string): Promise<string> => {
  const role = await kv.get(`role:${userId}`);
  return role || "student";
};

const requireAdmin = async (c: any) => {
  const user = await verifyToken(c.req.header("Authorization"));
  if (!user) return { user: null, role: null, error: c.json({ error: "Unauthorized" }, 401) };
  const role = await getUserRole(user.id);
  if (role !== "admin") return { user, role, error: c.json({ error: "Forbidden" }, 403) };
  return { user, role, error: null };
};

// ── Seed Data ────────────────────────────────────────────────────────────────
const SEED_BUILDINGS = [
  { id: "bldg-1", name: "Main Administration Building", lat: 9.6546, lng: 123.8547, description: "The heart of the University of Bohol, housing the Office of the President, Registrar, and key administrative offices.", category: "admin", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800" },
  { id: "bldg-2", name: "School of Engineering", lat: 9.6551, lng: 123.8553, description: "Home to Civil, Mechanical, Electrical, and Computer Engineering programs with state-of-the-art laboratories.", category: "academic", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800" },
  { id: "bldg-3", name: "School of Sciences", lat: 9.6542, lng: 123.8553, description: "Biology, Chemistry, Physics, and Mathematics departments equipped with modern research facilities.", category: "academic", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800" },
  { id: "bldg-4", name: "University Library", lat: 9.6540, lng: 123.8545, description: "A comprehensive library with over 50,000 volumes, digital resources, and quiet study areas for students and faculty.", category: "facilities", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=800" },
  { id: "bldg-5", name: "University Gymnasium", lat: 9.6548, lng: 123.8540, description: "Multi-purpose gymnasium hosting sports events, university assemblies, and student recreational activities.", category: "facilities", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=800" },
  { id: "bldg-6", name: "University Chapel", lat: 9.6543, lng: 123.8547, description: "A peaceful sanctuary for prayer, reflection, and spiritual activities open to all campus members.", category: "facilities", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=800" },
  { id: "bldg-7", name: "Campus Canteen & Cafeteria", lat: 9.6546, lng: 123.8550, description: "The main dining facility offering affordable and nutritious meals for students, faculty, and staff.", category: "services", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800" },
  { id: "bldg-8", name: "Student Center", lat: 9.6553, lng: 123.8545, description: "Hub for student organizations, student government offices, and extracurricular activities.", category: "services", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800" },
  { id: "bldg-9", name: "Health Services Center", lat: 9.6538, lng: 123.8550, description: "Campus clinic providing basic medical care, counseling services, and health education programs.", category: "services", sensitivityLevel: "staff", imageUrl: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800" },
  { id: "bldg-10", name: "School of Information Technology", lat: 9.6553, lng: 123.8557, description: "Cutting-edge computer laboratories for IT, Computer Science, and Information Systems students.", category: "academic", sensitivityLevel: "public", imageUrl: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800" },
];

const SEED_PATHS = [
  { id: "path-1", fromBuilding: "bldg-1", toBuilding: "bldg-2", status: "open", accessible: true, distance: 150, description: "Main entrance walkway to Engineering" },
  { id: "path-2", fromBuilding: "bldg-1", toBuilding: "bldg-3", status: "open", accessible: true, distance: 130, description: "Science corridor path" },
  { id: "path-3", fromBuilding: "bldg-1", toBuilding: "bldg-4", status: "open", accessible: true, distance: 110, description: "Library access road" },
  { id: "path-4", fromBuilding: "bldg-1", toBuilding: "bldg-6", status: "open", accessible: false, distance: 60, description: "Chapel garden path" },
  { id: "path-5", fromBuilding: "bldg-1", toBuilding: "bldg-7", status: "construction", accessible: false, distance: 80, description: "Canteen pathway (under renovation)" },
  { id: "path-6", fromBuilding: "bldg-2", toBuilding: "bldg-3", status: "open", accessible: true, distance: 100, description: "Engineering-Science bridge path" },
  { id: "path-7", fromBuilding: "bldg-4", toBuilding: "bldg-8", status: "open", accessible: true, distance: 170, description: "Library to Student Center walkway" },
  { id: "path-8", fromBuilding: "bldg-7", toBuilding: "bldg-5", status: "open", accessible: true, distance: 120, description: "Canteen to Gymnasium path" },
  { id: "path-9", fromBuilding: "bldg-3", toBuilding: "bldg-9", status: "open", accessible: true, distance: 140, description: "Science to Health Center" },
  { id: "path-10", fromBuilding: "bldg-8", toBuilding: "bldg-10", status: "closed", accessible: false, distance: 160, description: "Student Center to IT (closed)" },
  { id: "path-11", fromBuilding: "bldg-2", toBuilding: "bldg-10", status: "open", accessible: true, distance: 100, description: "Engineering to IT Building" },
  { id: "path-12", fromBuilding: "bldg-6", toBuilding: "bldg-7", status: "open", accessible: false, distance: 70, description: "Chapel to Canteen path" },
];

const SEED_RESOURCES = [
  { id: "res-1", name: "Registrar's Office", buildingId: "bldg-1", location: "Main Building, Ground Floor", contactInfo: "(038) 501-7080", operatingHours: "Mon-Fri 8:00AM-5:00PM", category: "admin", description: "Enrollment, records, and transcript requests" },
  { id: "res-2", name: "Office of the President", buildingId: "bldg-1", location: "Main Building, 3rd Floor", contactInfo: "(038) 501-7000", operatingHours: "Mon-Fri 8:00AM-5:00PM", category: "admin", description: "University executive offices" },
  { id: "res-3", name: "Engineering Library", buildingId: "bldg-2", location: "Engineering Building, 2nd Floor", contactInfo: "(038) 501-7082", operatingHours: "Mon-Sat 7:30AM-6:00PM", category: "academic", description: "Specialized engineering references and journals" },
  { id: "res-4", name: "Science Research Lab", buildingId: "bldg-3", location: "Sciences Building, 3rd Floor", contactInfo: "(038) 501-7084", operatingHours: "Mon-Fri 8:00AM-5:00PM", category: "academic", description: "Research facilities for science students" },
  { id: "res-5", name: "Main Library", buildingId: "bldg-4", location: "Library Building", contactInfo: "(038) 501-7090", operatingHours: "Mon-Sat 7:30AM-7:00PM", category: "facilities", description: "Main campus library with 50,000+ volumes" },
  { id: "res-6", name: "Sports Office", buildingId: "bldg-5", location: "Gymnasium, Ground Floor", contactInfo: "(038) 501-7095", operatingHours: "Mon-Sat 7:00AM-8:00PM", category: "facilities", description: "Sports registration and equipment lending" },
  { id: "res-7", name: "Campus Ministry", buildingId: "bldg-6", location: "Chapel", contactInfo: "(038) 501-7096", operatingHours: "Daily 6:00AM-8:00PM", category: "services", description: "Spiritual guidance and campus ministry" },
  { id: "res-8", name: "Student Affairs Office", buildingId: "bldg-8", location: "Student Center, 2nd Floor", contactInfo: "(038) 501-7098", operatingHours: "Mon-Fri 8:00AM-5:00PM", category: "services", description: "Student organizations and extracurricular coordination" },
  { id: "res-9", name: "Health Services Clinic", buildingId: "bldg-9", location: "Health Center", contactInfo: "(038) 501-7099", operatingHours: "Mon-Fri 7:30AM-5:30PM", category: "services", description: "Medical consultations and first aid" },
  { id: "res-10", name: "IT Support Help Desk", buildingId: "bldg-10", location: "IT Building, Ground Floor", contactInfo: "(038) 501-7100", operatingHours: "Mon-Fri 8:00AM-5:00PM", category: "academic", description: "Technical support for students and faculty" },
];

const SEED_PANORAMAS = [
  { id: "pano-1", buildingId: "bldg-1", name: "Main Lobby", imageUrl: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", hotspots: [{ x: 30, y: 50, label: "Go to Library", targetPanoId: "pano-4" }, { x: 70, y: 50, label: "Go to Chapel", targetPanoId: "pano-6" }] },
  { id: "pano-2", buildingId: "bldg-2", name: "Engineering Hall", imageUrl: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=1600", hotspots: [{ x: 20, y: 60, label: "Engineering Lab", targetPanoId: "pano-3" }] },
  { id: "pano-3", buildingId: "bldg-3", name: "Science Laboratory", imageUrl: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", hotspots: [{ x: 80, y: 40, label: "Back to Engineering", targetPanoId: "pano-2" }] },
  { id: "pano-4", buildingId: "bldg-4", name: "Library Reading Hall", imageUrl: "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=1600", hotspots: [{ x: 50, y: 70, label: "Back to Main", targetPanoId: "pano-1" }] },
  { id: "pano-5", buildingId: "bldg-5", name: "Gymnasium Floor", imageUrl: "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=1600", hotspots: [] },
  { id: "pano-6", buildingId: "bldg-6", name: "Chapel Interior", imageUrl: "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=1600", hotspots: [{ x: 50, y: 80, label: "Back to Main", targetPanoId: "pano-1" }] },
  { id: "pano-7", buildingId: "bldg-7", name: "Cafeteria", imageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", hotspots: [] },
  { id: "pano-8", buildingId: "bldg-8", name: "Student Center Lobby", imageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", hotspots: [] },
  { id: "pano-9", buildingId: "bldg-9", name: "Health Services", imageUrl: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", hotspots: [] },
  { id: "pano-10", buildingId: "bldg-10", name: "IT Computer Lab", imageUrl: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", hotspots: [] },
];

// Seed on startup
(async () => {
  try {
    const seeded = await kv.get("ub:seeded");
    if (seeded) { console.log("Already seeded."); return; }
    for (const b of SEED_BUILDINGS) await kv.set(`building:${b.id}`, JSON.stringify(b));
    for (const p of SEED_PATHS) await kv.set(`path:${p.id}`, JSON.stringify(p));
    for (const r of SEED_RESOURCES) await kv.set(`resource:${r.id}`, JSON.stringify(r));
    for (const pano of SEED_PANORAMAS) await kv.set(`panorama:${pano.id}`, JSON.stringify(pano));
    await kv.set("ub:seeded", "true");
    console.log("Seed data inserted.");
  } catch (e) { console.log("Seed error:", e); }
})();

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post("/make-server-e3faccbd/auth/signup", async (c) => {
  try {
    const { email, password, name, role = "student", adminCode } = await c.req.json();
    // Validate admin code
    let assignedRole = "student";
    if (role === "admin" && adminCode === (Deno.env.get("ADMIN_CODE") || "UB-ADMIN-2024")) assignedRole = "admin";
    else if (role === "staff" && adminCode === (Deno.env.get("STAFF_CODE") || "UB-STAFF-2024")) assignedRole = "staff";

    const { data, error } = await supabase.auth.admin.createUser({
      email, password,
      user_metadata: { name },
      email_confirm: true,
    });
    if (error) return c.json({ error: error.message }, 400);

    const userId = data.user.id;
    await kv.set(`role:${userId}`, assignedRole);
    await kv.set(`profile:${userId}`, JSON.stringify({ id: userId, name, email, createdAt: new Date().toISOString() }));
    return c.json({ user: data.user, role: assignedRole });
  } catch (e) { return c.json({ error: `Signup error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/auth/role", async (c) => {
  try {
    const user = await verifyToken(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const role = await getUserRole(user.id);
    const profileStr = await kv.get(`profile:${user.id}`);
    const profile = parse<any>(profileStr);
    return c.json({ role, profile });
  } catch (e) { return c.json({ error: `Role fetch error: ${e}` }, 500); }
});

// ── Buildings ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/buildings", async (c) => {
  try {
    const vals = await kv.getByPrefix("building:");
    const buildings = vals.map(v => parse<any>(v)).filter(Boolean);
    return c.json(buildings);
  } catch (e) { return c.json({ error: `Buildings fetch error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/buildings/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const val = await kv.get(`building:${id}`);
    if (!val) return c.json({ error: "Not found" }, 404);
    return c.json(parse(val));
  } catch (e) { return c.json({ error: `Building fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/buildings", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const id = genId();
    const building = { id, ...body, createdAt: new Date().toISOString() };
    await kv.set(`building:${id}`, JSON.stringify(building));
    return c.json(building, 201);
  } catch (e) { return c.json({ error: `Create building error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/buildings/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const existing = parse<any>(await kv.get(`building:${id}`));
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id };
    await kv.set(`building:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) { return c.json({ error: `Update building error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/buildings/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    await kv.del(`building:${id}`);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete building error: ${e}` }, 500); }
});

// ── Panoramas ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/panoramas", async (c) => {
  try {
    const buildingId = c.req.query("buildingId");
    const vals = await kv.getByPrefix("panorama:");
    let panoramas = vals.map(v => parse<any>(v)).filter(Boolean);
    if (buildingId) panoramas = panoramas.filter((p: any) => p.buildingId === buildingId);
    return c.json(panoramas);
  } catch (e) { return c.json({ error: `Panoramas fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/panoramas", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const id = genId();
    const panorama = { id, ...body };
    await kv.set(`panorama:${id}`, JSON.stringify(panorama));
    return c.json(panorama, 201);
  } catch (e) { return c.json({ error: `Create panorama error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/panoramas/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const existing = parse<any>(await kv.get(`panorama:${id}`));
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id };
    await kv.set(`panorama:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) { return c.json({ error: `Update panorama error: ${e}` }, 500); }
});

// ── Paths ─────────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/paths", async (c) => {
  try {
    const vals = await kv.getByPrefix("path:");
    const paths = vals.map(v => parse<any>(v)).filter(Boolean);
    return c.json(paths);
  } catch (e) { return c.json({ error: `Paths fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/paths", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const id = genId();
    const path = { id, ...body, createdAt: new Date().toISOString() };
    await kv.set(`path:${id}`, JSON.stringify(path));
    return c.json(path, 201);
  } catch (e) { return c.json({ error: `Create path error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/paths/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const existing = parse<any>(await kv.get(`path:${id}`));
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id };
    await kv.set(`path:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) { return c.json({ error: `Update path error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/paths/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    await kv.del(`path:${id}`);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete path error: ${e}` }, 500); }
});

// ── Resources ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/resources", async (c) => {
  try {
    const vals = await kv.getByPrefix("resource:");
    const resources = vals.map(v => parse<any>(v)).filter(Boolean);
    return c.json(resources);
  } catch (e) { return c.json({ error: `Resources fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/resources", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const id = genId();
    const resource = { id, ...body, createdAt: new Date().toISOString() };
    await kv.set(`resource:${id}`, JSON.stringify(resource));
    return c.json(resource, 201);
  } catch (e) { return c.json({ error: `Create resource error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/resources/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const existing = parse<any>(await kv.get(`resource:${id}`));
    if (!existing) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json();
    const updated = { ...existing, ...body, id };
    await kv.set(`resource:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) { return c.json({ error: `Update resource error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/resources/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    await kv.del(`resource:${id}`);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete resource error: ${e}` }, 500); }
});

// ── Activity Logs ─────────────────────────────────────────────────────────────
app.post("/make-server-e3faccbd/activity-logs", async (c) => {
  try {
    const body = await c.req.json();
    const id = `${Date.now()}-${genId().slice(0, 8)}`;
    const log = { id, ...body, timestamp: new Date().toISOString() };
    await kv.set(`log:${id}`, JSON.stringify(log));

    // Check for suspicious activity
    const userId = body.userId;
    if (userId) {
      const recentLogs = (await kv.getByPrefix("log:")).map(v => parse<any>(v)).filter((l: any) => l?.userId === userId);
      const last10Sec = recentLogs.filter((l: any) => l?.timestamp && (Date.now() - new Date(l.timestamp).getTime()) < 10000);
      if (last10Sec.length > 8) {
        const alertId = `${Date.now()}-${genId().slice(0, 8)}`;
        await kv.set(`alert:${alertId}`, JSON.stringify({
          id: alertId, userId, type: "rapid_navigation",
          description: `User made ${last10Sec.length} actions in 10 seconds`,
          severity: "medium", timestamp: new Date().toISOString(), resolved: false
        }));
      }
    }
    return c.json(log, 201);
  } catch (e) { return c.json({ error: `Log error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/activity-logs", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const vals = await kv.getByPrefix("log:");
    const logs = vals.map(v => parse<any>(v)).filter(Boolean)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);
    return c.json(logs);
  } catch (e) { return c.json({ error: `Logs fetch error: ${e}` }, 500); }
});

// ── Security Alerts ───────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/security-alerts", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const vals = await kv.getByPrefix("alert:");
    const alerts = vals.map(v => parse<any>(v)).filter(Boolean)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return c.json(alerts);
  } catch (e) { return c.json({ error: `Alerts fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/security-alerts", async (c) => {
  try {
    const body = await c.req.json();
    const id = `${Date.now()}-${genId().slice(0, 8)}`;
    const alert = { id, ...body, timestamp: new Date().toISOString() };
    await kv.set(`alert:${id}`, JSON.stringify(alert));
    return c.json(alert, 201);
  } catch (e) { return c.json({ error: `Alert error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/security-alerts/:id/resolve", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const existing = parse<any>(await kv.get(`alert:${id}`));
    if (!existing) return c.json({ error: "Not found" }, 404);
    const updated = { ...existing, resolved: true, resolvedAt: new Date().toISOString() };
    await kv.set(`alert:${id}`, JSON.stringify(updated));
    return c.json(updated);
  } catch (e) { return c.json({ error: `Resolve alert error: ${e}` }, 500); }
});

// ── Users / Roles ─────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/users", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return c.json({ error: error.message }, 400);
    const enriched = await Promise.all(users.map(async (u) => {
      const role = await getUserRole(u.id);
      const profileStr = await kv.get(`profile:${u.id}`);
      const profile = parse<any>(profileStr);
      return { id: u.id, email: u.email, role, name: profile?.name || u.user_metadata?.name || u.email, createdAt: u.created_at };
    }));
    return c.json(enriched);
  } catch (e) { return c.json({ error: `Users fetch error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/users/:id/role", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { role } = await c.req.json();
    await kv.set(`role:${id}`, role);
    return c.json({ success: true, role });
  } catch (e) { return c.json({ error: `Role update error: ${e}` }, 500); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/analytics", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const logs = (await kv.getByPrefix("log:")).map(v => parse<any>(v)).filter(Boolean);
    const alerts = (await kv.getByPrefix("alert:")).map(v => parse<any>(v)).filter(Boolean);
    const buildings = (await kv.getByPrefix("building:")).map(v => parse<any>(v)).filter(Boolean);

    // Group logs by date
    const logsByDate: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const buildingViews: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const log of logs) {
      if (!log) continue;
      const date = log.timestamp?.split("T")[0];
      if (date) logsByDate[date] = (logsByDate[date] || 0) + 1;
      if (log.action) actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      if (log.buildingId) buildingViews[log.buildingId] = (buildingViews[log.buildingId] || 0) + 1;
      if (log.userId) uniqueUsers.add(log.userId);
    }

    const dailyActivity = Object.entries(logsByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    const popularBuildings = Object.entries(buildingViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, views]) => {
        const bldg = buildings.find((b: any) => b?.id === id);
        return { id, name: bldg?.name || id, views };
      });

    return c.json({
      totalLogs: logs.length,
      totalAlerts: alerts.length,
      uniqueUsers: uniqueUsers.size,
      dailyActivity,
      actionCounts,
      popularBuildings,
    });
  } catch (e) { return c.json({ error: `Analytics error: ${e}` }, 500); }
});

// ── Route Calculation ─────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/route", async (c) => {
  try {
    const { from, to, accessible } = c.req.query();
    const pathVals = await kv.getByPrefix("path:");
    const paths = pathVals.map(v => parse<any>(v)).filter(Boolean);

    const availablePaths = paths.filter((p: any) => {
      if (p.status === "closed") return false;
      if (accessible === "true" && !p.accessible) return false;
      return true;
    });

    // Build adjacency list
    const graph: Record<string, Array<{ to: string; pathId: string; distance: number }>> = {};
    for (const p of availablePaths) {
      if (!graph[p.fromBuilding]) graph[p.fromBuilding] = [];
      if (!graph[p.toBuilding]) graph[p.toBuilding] = [];
      graph[p.fromBuilding].push({ to: p.toBuilding, pathId: p.id, distance: p.distance });
      graph[p.toBuilding].push({ to: p.fromBuilding, pathId: p.id, distance: p.distance });
    }

    // BFS to find shortest path
    const queue: Array<{ node: string; path: string[]; distance: number }> = [{ node: from, path: [from], distance: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const { node, path, distance } = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (node === to) {
        const walkingTime = Math.ceil(distance / 80); // avg 80m/min walking speed
        return c.json({ found: true, path, distance, walkingTime });
      }
      for (const neighbor of (graph[node] || [])) {
        if (!visited.has(neighbor.to)) {
          queue.push({ node: neighbor.to, path: [...path, neighbor.to], distance: distance + neighbor.distance });
        }
      }
    }
    return c.json({ found: false, path: [], distance: 0, walkingTime: 0 });
  } catch (e) { return c.json({ error: `Route error: ${e}` }, 500); }
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/health", (c) => c.json({ status: "ok" }));

Deno.serve(app.fetch);
