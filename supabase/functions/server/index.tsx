import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";

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

// ── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => crypto.randomUUID();

const verifyToken = async (authHeader: string | null) => {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

const getUserRole = async (userId: string): Promise<string> => {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role || "student";
};

const requireAdmin = async (c: any) => {
  const user = await verifyToken(c.req.header("Authorization"));
  if (!user) return { user: null, role: null, error: c.json({ error: "Unauthorized" }, 401) };
  const role = await getUserRole(user.id);
  if (role !== "admin") return { user, role, error: c.json({ error: "Forbidden" }, 403) };
  return { user, role, error: null };
};

// ── Seed Data ─────────────────────────────────────────────────────────────────
const SEED_BUILDINGS = [
  { id: "bldg-1", name: "Main Administration Building", lat: 9.6546, lng: 123.8547, description: "The heart of the University of Bohol, housing the Office of the President, Registrar, and key administrative offices.", category: "admin", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800" },
  { id: "bldg-2", name: "School of Engineering", lat: 9.6551, lng: 123.8553, description: "Home to Civil, Mechanical, Electrical, and Computer Engineering programs with state-of-the-art laboratories.", category: "academic", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800" },
  { id: "bldg-3", name: "School of Sciences", lat: 9.6542, lng: 123.8553, description: "Biology, Chemistry, Physics, and Mathematics departments equipped with modern research facilities.", category: "academic", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800" },
  { id: "bldg-4", name: "University Library", lat: 9.6540, lng: 123.8545, description: "A comprehensive library with over 50,000 volumes, digital resources, and quiet study areas for students and faculty.", category: "facilities", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=800" },
  { id: "bldg-5", name: "University Gymnasium", lat: 9.6548, lng: 123.8540, description: "Multi-purpose gymnasium hosting sports events, university assemblies, and student recreational activities.", category: "facilities", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=800" },
  { id: "bldg-6", name: "University Chapel", lat: 9.6543, lng: 123.8547, description: "A peaceful sanctuary for prayer, reflection, and spiritual activities open to all campus members.", category: "facilities", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=800" },
  { id: "bldg-7", name: "Campus Canteen & Cafeteria", lat: 9.6546, lng: 123.8550, description: "The main dining facility offering affordable and nutritious meals for students, faculty, and staff.", category: "services", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800" },
  { id: "bldg-8", name: "Student Center", lat: 9.6553, lng: 123.8545, description: "Hub for student organizations, student government offices, and extracurricular activities.", category: "services", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800" },
  { id: "bldg-9", name: "Health Services Center", lat: 9.6538, lng: 123.8550, description: "Campus clinic providing basic medical care, counseling services, and health education programs.", category: "services", sensitivity_level: "staff", image_url: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800" },
  { id: "bldg-10", name: "School of Information Technology", lat: 9.6553, lng: 123.8557, description: "Cutting-edge computer laboratories for IT, Computer Science, and Information Systems students.", category: "academic", sensitivity_level: "public", image_url: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800" },
];

const SEED_PATHS = [
  { id: "path-1", from_building: "bldg-1", to_building: "bldg-2", status: "open", accessible: true, distance: 150, description: "Main entrance walkway to Engineering" },
  { id: "path-2", from_building: "bldg-1", to_building: "bldg-3", status: "open", accessible: true, distance: 130, description: "Science corridor path" },
  { id: "path-3", from_building: "bldg-1", to_building: "bldg-4", status: "open", accessible: true, distance: 110, description: "Library access road" },
  { id: "path-4", from_building: "bldg-1", to_building: "bldg-6", status: "open", accessible: false, distance: 60, description: "Chapel garden path" },
  { id: "path-5", from_building: "bldg-1", to_building: "bldg-7", status: "construction", accessible: false, distance: 80, description: "Canteen pathway (under renovation)" },
  { id: "path-6", from_building: "bldg-2", to_building: "bldg-3", status: "open", accessible: true, distance: 100, description: "Engineering-Science bridge path" },
  { id: "path-7", from_building: "bldg-4", to_building: "bldg-8", status: "open", accessible: true, distance: 170, description: "Library to Student Center walkway" },
  { id: "path-8", from_building: "bldg-7", to_building: "bldg-5", status: "open", accessible: true, distance: 120, description: "Canteen to Gymnasium path" },
  { id: "path-9", from_building: "bldg-3", to_building: "bldg-9", status: "open", accessible: true, distance: 140, description: "Science to Health Center" },
  { id: "path-10", from_building: "bldg-8", to_building: "bldg-10", status: "closed", accessible: false, distance: 160, description: "Student Center to IT (closed)" },
  { id: "path-11", from_building: "bldg-2", to_building: "bldg-10", status: "open", accessible: true, distance: 100, description: "Engineering to IT Building" },
  { id: "path-12", from_building: "bldg-6", to_building: "bldg-7", status: "open", accessible: false, distance: 70, description: "Chapel to Canteen path" },
];

const SEED_RESOURCES = [
  { id: "res-1", name: "Registrar's Office", building_id: "bldg-1", location: "Main Building, Ground Floor", contact_info: "(038) 501-7080", operating_hours: "Mon-Fri 8:00AM-5:00PM", category: "admin", description: "Enrollment, records, and transcript requests" },
  { id: "res-2", name: "Office of the President", building_id: "bldg-1", location: "Main Building, 3rd Floor", contact_info: "(038) 501-7000", operating_hours: "Mon-Fri 8:00AM-5:00PM", category: "admin", description: "University executive offices" },
  { id: "res-3", name: "Engineering Library", building_id: "bldg-2", location: "Engineering Building, 2nd Floor", contact_info: "(038) 501-7082", operating_hours: "Mon-Sat 7:30AM-6:00PM", category: "academic", description: "Specialized engineering references and journals" },
  { id: "res-4", name: "Science Research Lab", building_id: "bldg-3", location: "Sciences Building, 3rd Floor", contact_info: "(038) 501-7084", operating_hours: "Mon-Fri 8:00AM-5:00PM", category: "academic", description: "Research facilities for science students" },
  { id: "res-5", name: "Main Library", building_id: "bldg-4", location: "Library Building", contact_info: "(038) 501-7090", operating_hours: "Mon-Sat 7:30AM-7:00PM", category: "facilities", description: "Main campus library with 50,000+ volumes" },
  { id: "res-6", name: "Sports Office", building_id: "bldg-5", location: "Gymnasium, Ground Floor", contact_info: "(038) 501-7095", operating_hours: "Mon-Sat 7:00AM-8:00PM", category: "facilities", description: "Sports registration and equipment lending" },
  { id: "res-7", name: "Campus Ministry", building_id: "bldg-6", location: "Chapel", contact_info: "(038) 501-7096", operating_hours: "Daily 6:00AM-8:00PM", category: "services", description: "Spiritual guidance and campus ministry" },
  { id: "res-8", name: "Student Affairs Office", building_id: "bldg-8", location: "Student Center, 2nd Floor", contact_info: "(038) 501-7098", operating_hours: "Mon-Fri 8:00AM-5:00PM", category: "services", description: "Student organizations and extracurricular coordination" },
  { id: "res-9", name: "Health Services Clinic", building_id: "bldg-9", location: "Health Center", contact_info: "(038) 501-7099", operating_hours: "Mon-Fri 7:30AM-5:30PM", category: "services", description: "Medical consultations and first aid" },
  { id: "res-10", name: "IT Support Help Desk", building_id: "bldg-10", location: "IT Building, Ground Floor", contact_info: "(038) 501-7100", operating_hours: "Mon-Fri 8:00AM-5:00PM", category: "academic", description: "Technical support for students and faculty" },
];

const SEED_PANORAMAS = [
  { id: "pano-1", building_id: "bldg-1", name: "Main Lobby", image_url: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", hotspots: [{ x: 30, y: 50, label: "Go to Library", targetPanoId: "pano-4" }, { x: 70, y: 50, label: "Go to Chapel", targetPanoId: "pano-6" }], sort_order: 0 },
  { id: "pano-2", building_id: "bldg-2", name: "Engineering Hall", image_url: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=1600", hotspots: [{ x: 20, y: 60, label: "Engineering Lab", targetPanoId: "pano-3" }], sort_order: 0 },
  { id: "pano-3", building_id: "bldg-3", name: "Science Laboratory", image_url: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", hotspots: [{ x: 80, y: 40, label: "Back to Engineering", targetPanoId: "pano-2" }], sort_order: 0 },
  { id: "pano-4", building_id: "bldg-4", name: "Library Reading Hall", image_url: "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=1600", hotspots: [{ x: 50, y: 70, label: "Back to Main", targetPanoId: "pano-1" }], sort_order: 0 },
  { id: "pano-5", building_id: "bldg-5", name: "Gymnasium Floor", image_url: "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=1600", hotspots: [], sort_order: 0 },
  { id: "pano-6", building_id: "bldg-6", name: "Chapel Interior", image_url: "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=1600", hotspots: [{ x: 50, y: 80, label: "Back to Main", targetPanoId: "pano-1" }], sort_order: 0 },
  { id: "pano-7", building_id: "bldg-7", name: "Cafeteria", image_url: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", hotspots: [], sort_order: 0 },
  { id: "pano-8", building_id: "bldg-8", name: "Student Center Lobby", image_url: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", hotspots: [], sort_order: 0 },
  { id: "pano-9", building_id: "bldg-9", name: "Health Services", image_url: "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", hotspots: [], sort_order: 0 },
  { id: "pano-10", building_id: "bldg-10", name: "IT Computer Lab", image_url: "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", hotspots: [], sort_order: 0 },
];

// ── Seed on startup ───────────────────────────────────────────────────────────
(async () => {
  try {
    const { count, error: countErr } = await supabase
      .from("buildings")
      .select("*", { count: "exact", head: true });

    if (countErr) { console.log("Seed check error:", countErr.message); return; }
    if (count && count > 0) { console.log("Already seeded. Skipping."); return; }

    const { error: bErr } = await supabase.from("buildings").upsert(SEED_BUILDINGS);
    if (bErr) { console.log("Buildings seed error:", bErr.message); return; }

    const { error: pathErr } = await supabase.from("paths").upsert(SEED_PATHS);
    if (pathErr) { console.log("Paths seed error:", pathErr.message); return; }

    const { error: resErr } = await supabase.from("resources").upsert(SEED_RESOURCES);
    if (resErr) { console.log("Resources seed error:", resErr.message); return; }

    const { error: panoErr } = await supabase.from("panoramas").upsert(SEED_PANORAMAS);
    if (panoErr) { console.log("Panoramas seed error:", panoErr.message); return; }

    console.log("✅ Seed data inserted successfully.");
  } catch (e) { console.log("Seed error:", e); }
})();

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post("/make-server-e3faccbd/auth/signup", async (c) => {
  try {
    const { email, password, name, role = "student", adminCode } = await c.req.json();

    let assignedRole = "student";
    if (role === "admin" && adminCode === (Deno.env.get("ADMIN_CODE") || "UB-ADMIN-2024")) assignedRole = "admin";
    else if (role === "staff" && adminCode === (Deno.env.get("STAFF_CODE") || "UB-STAFF-2024")) assignedRole = "staff";

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true,
    });
    if (error) return c.json({ error: error.message }, 400);

    // Update profile role if not student (trigger already created the profile as 'student')
    if (assignedRole !== "student") {
      await supabase
        .from("profiles")
        .update({ role: assignedRole, name })
        .eq("id", data.user.id);
    } else {
      await supabase
        .from("profiles")
        .update({ name })
        .eq("id", data.user.id);
    }

    return c.json({ user: data.user, role: assignedRole });
  } catch (e) { return c.json({ error: `Signup error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/auth/role", async (c) => {
  try {
    const user = await verifyToken(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return c.json({ role: profile?.role || "student", profile });
  } catch (e) { return c.json({ error: `Role fetch error: ${e}` }, 500); }
});

// ── Buildings ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/buildings", async (c) => {
  try {
    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .order("name");
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Buildings fetch error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/buildings/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Building fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/buildings", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const building = { id: genId(), ...body };
    const { data, error } = await supabase.from("buildings").insert(building).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Create building error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/buildings/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase
      .from("buildings")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Update building error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/buildings/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("buildings").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete building error: ${e}` }, 500); }
});

// ── Panoramas ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/panoramas", async (c) => {
  try {
    const buildingId = c.req.query("buildingId");
    let query = supabase.from("panoramas").select("*").order("sort_order").order("name");
    if (buildingId) query = query.eq("building_id", buildingId);
    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Panoramas fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/panoramas", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const panorama = { id: genId(), ...body };
    const { data, error } = await supabase.from("panoramas").insert(panorama).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Create panorama error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/panoramas/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase
      .from("panoramas")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Update panorama error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/panoramas/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("panoramas").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete panorama error: ${e}` }, 500); }
});

// ── Paths ─────────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/paths", async (c) => {
  try {
    const { data, error } = await supabase.from("paths").select("*");
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Paths fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/paths", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const path = { id: genId(), ...body };
    const { data, error } = await supabase.from("paths").insert(path).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Create path error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/paths/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase
      .from("paths")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Update path error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/paths/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("paths").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete path error: ${e}` }, 500); }
});

// ── Resources ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/resources", async (c) => {
  try {
    const { data, error } = await supabase.from("resources").select("*").order("name");
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Resources fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/resources", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json();
    const resource = { id: genId(), ...body };
    const { data, error } = await supabase.from("resources").insert(resource).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Create resource error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/resources/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { data, error } = await supabase
      .from("resources")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Update resource error: ${e}` }, 500); }
});

app.delete("/make-server-e3faccbd/resources/:id", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: `Delete resource error: ${e}` }, 500); }
});

// ── Activity Logs ─────────────────────────────────────────────────────────────
app.post("/make-server-e3faccbd/activity-logs", async (c) => {
  try {
    const body = await c.req.json();
    const log = {
      id: `${Date.now()}-${genId().slice(0, 8)}`,
      action: body.action,
      user_id: body.userId || null,
      building_id: body.buildingId || null,
      details: body.details || null,
      ip_address: c.req.header("x-forwarded-for") || null,
    };
    const { data, error } = await supabase.from("activity_logs").insert(log).select().single();
    if (error) return c.json({ error: error.message }, 500);

    // Check for rapid navigation (suspicious activity)
    if (body.userId) {
      const tenSecsAgo = new Date(Date.now() - 10000).toISOString();
      const { count } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", body.userId)
        .gte("timestamp", tenSecsAgo);

      if (count && count > 8) {
        await supabase.from("security_alerts").insert({
          id: `${Date.now()}-${genId().slice(0, 8)}`,
          user_id: body.userId,
          type: "rapid_navigation",
          description: `User made ${count} actions in 10 seconds`,
          severity: "medium",
        });
      }
    }
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Log error: ${e}` }, 500); }
});

app.get("/make-server-e3faccbd/activity-logs", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Logs fetch error: ${e}` }, 500); }
});

// ── Security Alerts ───────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/security-alerts", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const { data, error } = await supabase
      .from("security_alerts")
      .select("*")
      .order("timestamp", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (e) { return c.json({ error: `Alerts fetch error: ${e}` }, 500); }
});

app.post("/make-server-e3faccbd/security-alerts", async (c) => {
  try {
    const body = await c.req.json();
    const alert = {
      id: `${Date.now()}-${genId().slice(0, 8)}`,
      user_id: body.userId || null,
      type: body.type,
      description: body.description || null,
      severity: body.severity || "medium",
    };
    const { data, error } = await supabase.from("security_alerts").insert(alert).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
  } catch (e) { return c.json({ error: `Alert error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/security-alerts/:id/resolve", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { data, error } = await supabase
      .from("security_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json(data);
  } catch (e) { return c.json({ error: `Resolve alert error: ${e}` }, 500); }
});

// ── Users / Roles ─────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/users", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return c.json({ error: error.message }, 400);

    const { data: profiles } = await supabase.from("profiles").select("*");
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

    const enriched = users.map((u) => {
      const profile = profileMap[u.id];
      return {
        id: u.id,
        email: u.email,
        role: profile?.role || "student",
        name: profile?.name || u.user_metadata?.name || u.email,
        createdAt: u.created_at,
      };
    });
    return c.json(enriched);
  } catch (e) { return c.json({ error: `Users fetch error: ${e}` }, 500); }
});

app.put("/make-server-e3faccbd/users/:id/role", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const id = c.req.param("id");
    const { role } = await c.req.json();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, role });
  } catch (e) { return c.json({ error: `Role update error: ${e}` }, 500); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
app.get("/make-server-e3faccbd/analytics", async (c) => {
  const { error: authErr } = await requireAdmin(c);
  if (authErr) return authErr;
  try {
    const [logsRes, alertsRes, buildingsRes] = await Promise.all([
      supabase.from("activity_logs").select("*").order("timestamp", { ascending: false }).limit(1000),
      supabase.from("security_alerts").select("id"),
      supabase.from("buildings").select("id, name"),
    ]);

    const logs = logsRes.data || [];
    const totalAlerts = alertsRes.data?.length || 0;
    const buildings = buildingsRes.data || [];

    const logsByDate: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const buildingViews: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const log of logs) {
      const date = log.timestamp?.split("T")[0];
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
        const bldg = buildings.find((b: any) => b.id === id);
        return { id, name: bldg?.name || id, views };
      });

    return c.json({
      totalLogs: logs.length,
      totalAlerts,
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
    const { data: paths, error } = await supabase.from("paths").select("*");
    if (error) return c.json({ error: error.message }, 500);

    const availablePaths = (paths || []).filter((p: any) => {
      if (p.status === "closed") return false;
      if (accessible === "true" && !p.accessible) return false;
      return true;
    });

    // Build adjacency list
    const graph: Record<string, Array<{ to: string; distance: number }>> = {};
    for (const p of availablePaths) {
      if (!graph[p.from_building]) graph[p.from_building] = [];
      if (!graph[p.to_building]) graph[p.to_building] = [];
      graph[p.from_building].push({ to: p.to_building, distance: p.distance });
      graph[p.to_building].push({ to: p.from_building, distance: p.distance });
    }

    // Dijkstra BFS for shortest path
    const queue: Array<{ node: string; path: string[]; distance: number }> = [
      { node: from, path: [from], distance: 0 },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const { node, path, distance } = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (node === to) {
        const walkingTime = Math.ceil(distance / 80);
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