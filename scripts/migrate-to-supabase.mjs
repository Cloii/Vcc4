import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join("server", "vcc.db");
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join("public", "uploads");
const BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || "uploads";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function isLocalUploadUrl(url) {
  if (!url) return false;
  return url.includes("/uploads/");
}

function fileNameFromUrl(url) {
  const idx = url.lastIndexOf("/uploads/");
  if (idx >= 0) return url.slice(idx + "/uploads/".length);
  return null;
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error: cErr } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (cErr) throw cErr;
}

async function uploadIfExists(filename) {
  const abs = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(abs)) return null;
  const file = fs.readFileSync(abs);
  const { error } = await supabase.storage.from(BUCKET).upload(filename, file, {
    upsert: true,
    contentType: undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  await ensureBucket();

  const db = new Database(SQLITE_PATH, { readonly: true });

  const buildings = db.prepare("select * from buildings").all();
  const panoramas = db.prepare("select * from panoramas").all();
  const pathsRows = db.prepare("select * from paths").all();
  const resources = db.prepare("select * from resources").all();
  const site = db.prepare("select * from site_content").all();

  console.log(`Buildings: ${buildings.length}, Panoramas: ${panoramas.length}, Paths: ${pathsRows.length}, Resources: ${resources.length}, Site: ${site.length}`);

  // Buildings
  if (buildings.length) {
    const payload = buildings.map((b) => ({
      id: b.id,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      description: b.description,
      category: b.category,
      sensitivity_level: b.sensitivity_level,
      image_url: b.image_url || null,
      created_at: b.created_at ? new Date(b.created_at).toISOString() : undefined,
      updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
    }));
    const { error } = await supabase.from("buildings").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    console.log("✅ buildings migrated");
  }

  // Panoramas (+ upload mapping)
  if (panoramas.length) {
    const mapped = [];
    for (const p of panoramas) {
      let imageUrl = p.image_url;
      if (isLocalUploadUrl(imageUrl)) {
        const fn = fileNameFromUrl(imageUrl);
        if (fn) {
          const publicUrl = await uploadIfExists(fn);
          if (publicUrl) imageUrl = publicUrl;
        }
      }
      mapped.push({
        id: p.id,
        building_id: p.building_id,
        name: p.name,
        image_url: imageUrl,
        hotspots: (() => {
          try {
            return typeof p.hotspots === "string" ? JSON.parse(p.hotspots) : p.hotspots || [];
          } catch {
            return [];
          }
        })(),
        sort_order: p.sort_order ?? 0,
        created_at: p.created_at ? new Date(p.created_at).toISOString() : undefined,
        updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
      });
    }
    const { error } = await supabase.from("panoramas").upsert(mapped, { onConflict: "id" });
    if (error) throw error;
    console.log("✅ panoramas migrated");
  }

  // Paths
  if (pathsRows.length) {
    const payload = pathsRows.map((p) => ({
      id: p.id,
      from_building: p.from_building,
      to_building: p.to_building,
      status: p.status,
      accessible: p.accessible === 1 || p.accessible === true,
      distance: p.distance,
      description: p.description,
      created_at: p.created_at ? new Date(p.created_at).toISOString() : undefined,
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
    }));
    const { error } = await supabase.from("paths").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    console.log("✅ paths migrated");
  }

  // Resources
  if (resources.length) {
    const payload = resources.map((r) => ({
      id: r.id,
      name: r.name,
      building_id: r.building_id || null,
      location: r.location,
      contact_info: r.contact_info,
      operating_hours: r.operating_hours,
      category: r.category,
      description: r.description,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    }));
    const { error } = await supabase.from("resources").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    console.log("✅ resources migrated");
  }

  // Site content
  if (site.length) {
    const payload = site.map((s) => ({
      key: s.key,
      value: (() => {
        try {
          return typeof s.value === "string" ? JSON.parse(s.value) : s.value;
        } catch {
          return s.value;
        }
      })(),
      updated_at: s.updated_at ? new Date(s.updated_at).toISOString() : undefined,
    }));
    const { error } = await supabase.from("site_content").upsert(payload, { onConflict: "key" });
    if (error) throw error;
    console.log("✅ site_content migrated");
  }

  console.log("\nDone. Note: users/passwords are NOT migrated into Supabase Auth automatically.");
  console.log("Create accounts via Supabase Auth (signup) and set admin/staff roles via codes.");
}

main().catch((e) => {
  console.error("Migration failed:", e?.message || e);
  process.exit(1);
});

