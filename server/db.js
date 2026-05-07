import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, "vcc.db");
export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'academic',
    sensitivity_level TEXT NOT NULL DEFAULT 'public',
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS paths (
    id TEXT PRIMARY KEY,
    from_building TEXT NOT NULL,
    to_building TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    accessible INTEGER NOT NULL DEFAULT 1,
    distance REAL NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    building_id TEXT,
    location TEXT,
    contact_info TEXT,
    operating_hours TEXT,
    category TEXT NOT NULL DEFAULT 'services',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS panoramas (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    hotspots TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    user_id TEXT,
    building_id TEXT,
    details TEXT,
    ip_address TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS security_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    resolved_by TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    admin_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seed_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Lightweight migrations ────────────────────────────────────────────────────
// Add `sort_order` to panoramas for stable admin-controlled ordering.
try {
  const cols = db.prepare("PRAGMA table_info(panoramas)").all();
  const hasSortOrder = cols.some((c) => c.name === "sort_order");
  if (!hasSortOrder) {
    db.exec(`ALTER TABLE panoramas ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`);
    // Initialize order per building by name for existing rows.
    const rows = db.prepare("SELECT id, building_id FROM panoramas ORDER BY building_id ASC, name ASC").all();
    const byBuilding = new Map();
    for (const r of rows) {
      const k = r.building_id;
      const list = byBuilding.get(k) || [];
      list.push(r.id);
      byBuilding.set(k, list);
    }
    const upd = db.prepare("UPDATE panoramas SET sort_order=? WHERE id=?");
    const tx = db.transaction(() => {
      for (const [_, ids] of byBuilding.entries()) {
        ids.forEach((id, idx) => upd.run(idx, id));
      }
    });
    tx();
  }
} catch (e) {
  console.warn("[db] Migration check failed:", e?.message || e);
}

// ─── Seed Data ─────────────────────────────────────────────────────────────────
const alreadySeeded = db.prepare("SELECT value FROM seed_meta WHERE key = 'seeded'").get();

if (!alreadySeeded) {
  console.log("🌱 Seeding database...");

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`
  );
  const insertBuilding = db.prepare(
    `INSERT OR IGNORE INTO buildings (id, name, lat, lng, description, category, sensitivity_level, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPath = db.prepare(
    `INSERT OR IGNORE INTO paths (id, from_building, to_building, status, accessible, distance, description) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertResource = db.prepare(
    `INSERT OR IGNORE INTO resources (id, name, building_id, location, contact_info, operating_hours, category, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPanorama = db.prepare(
    `INSERT OR IGNORE INTO panoramas (id, building_id, name, image_url, hotspots) VALUES (?, ?, ?, ?, ?)`
  );

  const seedAll = db.transaction(() => {
    // Default users
    insertUser.run("user-admin", "admin@ub.edu.ph", bcrypt.hashSync("admin123", 10), "System Administrator", "admin");
    insertUser.run("user-staff", "staff@ub.edu.ph", bcrypt.hashSync("staff123", 10), "Campus Staff", "staff");
    insertUser.run("user-student", "student@ub.edu.ph", bcrypt.hashSync("student123", 10), "Sample Student", "student");

    // Buildings
    const buildings = [
      ["bldg-1", "Main Administration Building", 9.6546, 123.8547, "The heart of the University of Bohol, housing the Office of the President, Registrar, and key administrative offices.", "admin", "public", "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800"],
      ["bldg-2", "School of Engineering", 9.6551, 123.8553, "Home to Civil, Mechanical, Electrical, and Computer Engineering programs with state-of-the-art laboratories.", "academic", "public", "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800"],
      ["bldg-3", "School of Sciences", 9.6542, 123.8553, "Biology, Chemistry, Physics, and Mathematics departments equipped with modern research facilities.", "academic", "public", "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800"],
      ["bldg-4", "University Library", 9.6540, 123.8545, "A comprehensive library with over 50,000 volumes, digital resources, and quiet study areas for students and faculty.", "facilities", "public", "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=800"],
      ["bldg-5", "University Gymnasium", 9.6548, 123.8540, "Multi-purpose gymnasium hosting sports events, university assemblies, and student recreational activities.", "facilities", "public", "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=800"],
      ["bldg-6", "University Chapel", 9.6543, 123.8547, "A peaceful sanctuary for prayer, reflection, and spiritual activities open to all campus members.", "facilities", "public", "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=800"],
      ["bldg-7", "Campus Canteen & Cafeteria", 9.6546, 123.8550, "The main dining facility offering affordable and nutritious meals for students, faculty, and staff.", "services", "public", "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800"],
      ["bldg-8", "Student Center", 9.6553, 123.8545, "Hub for student organizations, student government offices, and extracurricular activities.", "services", "public", "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=800"],
      ["bldg-9", "Health Services Center", 9.6538, 123.8550, "Campus clinic providing basic medical care, counseling services, and health education programs.", "services", "staff", "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=800"],
      ["bldg-10", "School of Information Technology", 9.6553, 123.8557, "Cutting-edge computer laboratories for IT, Computer Science, and Information Systems students.", "academic", "public", "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=800"],
    ];
    buildings.forEach(b => insertBuilding.run(...b));

    // Paths
    const paths = [
      ["path-1", "bldg-1", "bldg-2", "open", 1, 150, "Main entrance walkway to Engineering"],
      ["path-2", "bldg-1", "bldg-3", "open", 1, 130, "Science corridor path"],
      ["path-3", "bldg-1", "bldg-4", "open", 1, 110, "Library access road"],
      ["path-4", "bldg-1", "bldg-6", "open", 0, 60, "Chapel garden path"],
      ["path-5", "bldg-1", "bldg-7", "construction", 0, 80, "Canteen pathway (under renovation)"],
      ["path-6", "bldg-2", "bldg-3", "open", 1, 100, "Engineering-Science bridge path"],
      ["path-7", "bldg-4", "bldg-8", "open", 1, 170, "Library to Student Center walkway"],
      ["path-8", "bldg-7", "bldg-5", "open", 1, 120, "Canteen to Gymnasium path"],
      ["path-9", "bldg-3", "bldg-9", "open", 1, 140, "Science to Health Center"],
      ["path-10", "bldg-8", "bldg-10", "closed", 0, 160, "Student Center to IT (closed)"],
      ["path-11", "bldg-2", "bldg-10", "open", 1, 100, "Engineering to IT Building"],
      ["path-12", "bldg-6", "bldg-7", "open", 0, 70, "Chapel to Canteen path"],
    ];
    paths.forEach(p => insertPath.run(...p));

    // Resources
    const resources = [
      ["res-1", "Registrar's Office", "bldg-1", "Main Building, Ground Floor", "(038) 501-7080", "Mon-Fri 8:00AM-5:00PM", "admin", "Enrollment, records, and transcript requests"],
      ["res-2", "Office of the President", "bldg-1", "Main Building, 3rd Floor", "(038) 501-7000", "Mon-Fri 8:00AM-5:00PM", "admin", "University executive offices"],
      ["res-3", "Engineering Library", "bldg-2", "Engineering Building, 2nd Floor", "(038) 501-7082", "Mon-Sat 7:30AM-6:00PM", "academic", "Specialized engineering references and journals"],
      ["res-4", "Science Research Lab", "bldg-3", "Sciences Building, 3rd Floor", "(038) 501-7084", "Mon-Fri 8:00AM-5:00PM", "academic", "Research facilities for science students"],
      ["res-5", "Main Library", "bldg-4", "Library Building", "(038) 501-7090", "Mon-Sat 7:30AM-7:00PM", "facilities", "Main campus library with 50,000+ volumes"],
      ["res-6", "Sports Office", "bldg-5", "Gymnasium, Ground Floor", "(038) 501-7095", "Mon-Sat 7:00AM-8:00PM", "facilities", "Sports registration and equipment lending"],
      ["res-7", "Campus Ministry", "bldg-6", "Chapel", "(038) 501-7096", "Daily 6:00AM-8:00PM", "services", "Spiritual guidance and campus ministry"],
      ["res-8", "Student Affairs Office", "bldg-8", "Student Center, 2nd Floor", "(038) 501-7098", "Mon-Fri 8:00AM-5:00PM", "services", "Student organizations and extracurricular coordination"],
      ["res-9", "Health Services Clinic", "bldg-9", "Health Center", "(038) 501-7099", "Mon-Fri 7:30AM-5:30PM", "services", "Medical consultations and first aid"],
      ["res-10", "IT Support Help Desk", "bldg-10", "IT Building, Ground Floor", "(038) 501-7100", "Mon-Fri 8:00AM-5:00PM", "academic", "Technical support for students and faculty"],
    ];
    resources.forEach(r => insertResource.run(...r));

    // Panoramas
    const panoramas = [
      ["pano-1", "bldg-1", "Main Lobby", "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", JSON.stringify([{ x: 30, y: 50, label: "Go to Library", targetPanoId: "pano-4" }, { x: 70, y: 50, label: "Go to Chapel", targetPanoId: "pano-6" }])],
      ["pano-2", "bldg-2", "Engineering Hall", "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=1600", JSON.stringify([{ x: 20, y: 60, label: "Engineering Lab", targetPanoId: "pano-3" }])],
      ["pano-3", "bldg-3", "Science Laboratory", "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", JSON.stringify([{ x: 80, y: 40, label: "Back to Engineering", targetPanoId: "pano-2" }])],
      ["pano-4", "bldg-4", "Library Reading Hall", "https://images.unsplash.com/photo-1637455587265-2a3c2cbbcc84?w=1600", JSON.stringify([{ x: 50, y: 70, label: "Back to Main", targetPanoId: "pano-1" }])],
      ["pano-5", "bldg-5", "Gymnasium Floor", "https://images.unsplash.com/photo-1761775446037-f4233aa9b8f3?w=1600", JSON.stringify([])],
      ["pano-6", "bldg-6", "Chapel Interior", "https://images.unsplash.com/photo-1629119025912-2bcd014a950e?w=1600", JSON.stringify([{ x: 50, y: 80, label: "Back to Main", targetPanoId: "pano-1" }])],
      ["pano-7", "bldg-7", "Cafeteria", "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", JSON.stringify([])],
      ["pano-8", "bldg-8", "Student Center Lobby", "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600", JSON.stringify([])],
      ["pano-9", "bldg-9", "Health Services", "https://images.unsplash.com/photo-1720067234000-22ba9b130c56?w=1600", JSON.stringify([])],
      ["pano-10", "bldg-10", "IT Computer Lab", "https://images.unsplash.com/photo-1743529056479-82e136be95ed?w=1600", JSON.stringify([])],
    ];
    panoramas.forEach(p => insertPanorama.run(...p));

    db.prepare("INSERT OR IGNORE INTO seed_meta (key, value) VALUES ('seeded', 'true')").run();
  });

  seedAll();
  console.log("✅ Database seeded successfully.");
} else {
  console.log("✅ Database already seeded.");
}

export default db;
