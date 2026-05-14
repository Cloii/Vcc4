import { supabase } from "./supabaseClient";

const unwrap = <T>(data: T | null, error: any): T => {
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
};

/** List queries: never return null — avoids `.map` crashes if Supabase returns null `data` with no error */
const unwrapRows = <T>(data: T[] | null | undefined, error: any): T[] => {
  if (error) throw new Error(error.message || "Request failed");
  return Array.isArray(data) ? data : [];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
// Single source of truth for mapping a raw DB building row to the app shape.
// Previously duplicated identically in getBuildings() and getBuilding().
const mapBuilding = (b: any) => ({
  id: b.id,
  name: b.name,
  lat: b.lat,
  lng: b.lng,
  description: b.description,
  category: b.category,
  sensitivityLevel: b.sensitivity_level,
  imageUrl: b.image_url ?? null,
  createdAt: b.created_at,
  updatedAt: b.updated_at,
});

// Auth
export const signup = (_data: { email: string; password: string; name: string; role?: string; adminCode?: string }) =>
  Promise.reject(new Error("Use Supabase Auth (Signup page)"));

export const login = (_data: { email: string; password: string }) =>
  Promise.reject(new Error("Use Supabase Auth (Login page)"));

export const getMyRole = async () => {
  const u = (await supabase.auth.getUser()).data.user;
  if (!u) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("profiles").select("role, name, email, id").eq("id", u.id).single();
  unwrap(data, error);
  return { role: data!.role, profile: { id: data!.id, name: data!.name, email: data!.email } };
};

// Buildings
export const getBuildings = async () => {
  const { data, error } = await supabase.from("buildings").select("*").order("name");
  return unwrapRows<any>(data, error).map(mapBuilding);
};

export const getBuilding = async (id: string) => {
  const { data, error } = await supabase.from("buildings").select("*").eq("id", id).single();
  return mapBuilding(unwrap<any>(data, error));
};

export const createBuilding = async (data: any) => {
  const payload = {
    id: data.id,
    name: data.name,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    description: data.description || "",
    category: data.category || "academic",
    sensitivity_level: data.sensitivityLevel || "public",
    image_url: data.imageUrl || null,
  };
  const { data: out, error } = await supabase.from("buildings").insert(payload).select("*").single();
  return mapBuilding(unwrap(out, error));
};

export const updateBuilding = async (id: string, data: any) => {
  // Only include fields that are explicitly provided to avoid overwriting with undefined.
  // image_url uses data.imageUrl (camelCase) — callers must pass camelCase keys.
  const payload: Record<string, any> = {};
  if (data.name        !== undefined) payload.name             = data.name;
  if (data.lat         !== undefined) payload.lat              = data.lat;
  if (data.lng         !== undefined) payload.lng              = data.lng;
  if (data.description !== undefined) payload.description      = data.description;
  if (data.category    !== undefined) payload.category         = data.category;
  if (data.sensitivityLevel !== undefined) payload.sensitivity_level = data.sensitivityLevel;
  // Treat empty string the same as null so Supabase clears the old URL
  if (data.imageUrl !== undefined) payload.image_url = data.imageUrl || null;

  const { data: out, error } = await supabase
    .from("buildings")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  return mapBuilding(unwrap(out, error));
};

export const deleteBuilding = async (id: string) => {
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  unwrap(true, error);
  return { success: true };
};

// Panoramas
export const getPanoramas = (buildingId?: string) =>
  (async () => {
    let q = supabase.from("panoramas").select("*").order("sort_order").order("name");
    if (buildingId) q = q.eq("building_id", buildingId);
    const { data, error } = await q;
    return unwrapRows<any>(data, error).map((p: any) => ({
      id: p.id,
      buildingId: p.building_id,
      name: p.name,
      imageUrl: p.image_url,
      hotspots: p.hotspots || [],
      sortOrder: p.sort_order ?? 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  })();

export const createPanorama = async (data: any) => {
  const payload = {
    id: data.id,
    building_id: data.buildingId,
    name: data.name,
    image_url: data.imageUrl,
    hotspots: data.hotspots || [],
    sort_order: data.sortOrder ?? 0,
  };
  const { data: out, error } = await supabase.from("panoramas").insert(payload).select("*").single();
  return unwrap(out, error);
};

export const updatePanorama = async (id: string, data: any) => {
  const payload: any = {
    building_id: data.buildingId,
    name: data.name,
    image_url: data.imageUrl,
    hotspots: data.hotspots,
    sort_order: data.sortOrder,
  };
  const { data: out, error } = await supabase.from("panoramas").update(payload).eq("id", id).select("*").single();
  return unwrap(out, error);
};

export const deletePanorama = async (id: string) => {
  const { error } = await supabase.from("panoramas").delete().eq("id", id);
  unwrap(true, error);
  return { success: true };
};

export const reorderPanoramas = async (buildingId: string, orderedIds: string[]) => {
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from("panoramas")
        .update({ sort_order: idx })
        .eq("id", id)
        .eq("building_id", buildingId)
    )
  );
  return getPanoramas(buildingId);
};

// Paths
export const getPaths = async () => {
  const { data, error } = await supabase.from("paths").select("*").order("updated_at", { ascending: false });
  return unwrapRows<any>(data, error).map((p: any) => ({
    id: p.id,
    fromBuilding: p.from_building,
    toBuilding: p.to_building,
    status: p.status,
    accessible: !!p.accessible,
    distance: p.distance,
    description: p.description,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
};

export const createPath = async (data: any) => {
  const { data: out, error } = await supabase
    .from("paths")
    .insert({
      id: data.id,
      from_building: data.fromBuilding,
      to_building: data.toBuilding,
      status: data.status || "open",
      accessible: data.accessible ?? true,
      distance: data.distance ?? 0,
      description: data.description ?? "",
    })
    .select("*")
    .single();
  return unwrap(out, error);
};

export const updatePath = async (id: string, data: any) => {
  const { data: out, error } = await supabase
    .from("paths")
    .update({
      from_building: data.fromBuilding,
      to_building: data.toBuilding,
      status: data.status,
      accessible: data.accessible,
      distance: data.distance,
      description: data.description,
    })
    .eq("id", id)
    .select("*")
    .single();
  return unwrap(out, error);
};

export const deletePath = async (id: string) => {
  const { error } = await supabase.from("paths").delete().eq("id", id);
  unwrap(true, error);
  return { success: true };
};

// Resources
export const getResources = async () => {
  const { data, error } = await supabase.from("resources").select("*").order("updated_at", { ascending: false });
  return unwrapRows<any>(data, error).map((r: any) => ({
    id: r.id,
    name: r.name,
    buildingId: r.building_id,
    location: r.location,
    contactInfo: r.contact_info,
    operatingHours: r.operating_hours,
    category: r.category,
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const createResource = async (data: any) => {
  const { data: out, error } = await supabase
    .from("resources")
    .insert({
      id: data.id,
      name: data.name,
      building_id: data.buildingId || null,
      location: data.location || "",
      contact_info: data.contactInfo || "",
      operating_hours: data.operatingHours || "",
      category: data.category || "services",
      description: data.description || "",
    })
    .select("*")
    .single();
  return unwrap(out, error);
};

export const updateResource = async (id: string, data: any) => {
  const { data: out, error } = await supabase
    .from("resources")
    .update({
      name: data.name,
      building_id: data.buildingId || null,
      location: data.location,
      contact_info: data.contactInfo,
      operating_hours: data.operatingHours,
      category: data.category,
      description: data.description,
    })
    .eq("id", id)
    .select("*")
    .single();
  return unwrap(out, error);
};

export const deleteResource = async (id: string) => {
  const { error } = await supabase.from("resources").delete().eq("id", id);
  unwrap(true, error);
  return { success: true };
};

// Activity Logs
export const logActivity = async (data: { action: string; userId?: string; buildingId?: string; details?: any }) => {
  const { error } = await supabase.from("activity_logs").insert({
    id: crypto.randomUUID(),
    action: data.action,
    user_id: data.userId || null,
    building_id: data.buildingId || null,
    details: data.details || null,
  });
  if (error) throw new Error(error.message);
};

export const getActivityLogs = async () => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(5000);
  return unwrapRows<any>(data, error);
};

// Audit Logs
export const getAuditLogs = (params?: { limit?: number; offset?: number; search?: string; resourceType?: string }) => {
  const limit = params?.limit ?? 200;
  return supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("timestamp", { ascending: false })
    .limit(limit)
    .then(({ data, error, count }) => {
      unwrap(true, error);
      return { logs: data || [], total: count || 0 };
    });
};

// Security Alerts
export const getSecurityAlerts = async () => {
  const { data, error } = await supabase
    .from("security_alerts")
    .select("*")
    .order("timestamp", { ascending: false });
  return unwrapRows<any>(data, error);
};

export const createSecurityAlert = async (data: any) => {
  const { data: out, error } = await supabase
    .from("security_alerts")
    .insert({ ...data, id: data.id || crypto.randomUUID() })
    .select("*")
    .single();
  return unwrap(out, error);
};

export const resolveAlert = async (id: string) => {
  const { error } = await supabase
    .from("security_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
  unwrap(true, error);
  return { ok: true };
};

// Users
export const getUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, created_at")
    .order("created_at", { ascending: false });
  return unwrapRows<any>(data, error);
};

export const createUser = () => Promise.reject(new Error("Create users via Supabase Auth"));
export const updateUserRole = () => Promise.reject(new Error("Update roles via admin tooling (profiles)"));
export const updateUser = () => Promise.reject(new Error("Update users via Supabase"));
export const deleteUser = () => Promise.reject(new Error("Delete users via Supabase"));

// Analytics
export const getAnalytics = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalLogsCount, error: lCountErr },
    { data: recentLogs, error: lErr },
    { data: alerts, error: aErr },
    { data: buildings, error: bErr },
    { data: profiles, error: pErr },
  ] = await Promise.all([
    supabase.from("activity_logs").select("*", { count: "exact", head: true }),
    supabase
      .from("activity_logs")
      .select("user_id, building_id, action, timestamp")
      .order("timestamp", { ascending: false })
      .limit(1000),
    supabase.from("security_alerts").select("*").order("timestamp", { ascending: false }),
    supabase.from("buildings").select("id, name"),
    supabase.from("profiles").select("role, created_at"),
  ]);

  unwrap(true, lCountErr);
  unwrap(true, lErr);
  unwrap(true, aErr);
  unwrap(true, bErr);
  unwrap(true, pErr);

  const logsByDate: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  const buildingViews: Record<string, number> = {};
  const uniqueUsers = new Set<string>();

  for (const log of recentLogs || []) {
    const date = (log.timestamp || "").split("T")[0] || (log.timestamp || "").split(" ")[0];
    if (date) logsByDate[date] = (logsByDate[date] || 0) + 1;
    if (log.action) actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    if (log.building_id) buildingViews[log.building_id] = (buildingViews[log.building_id] || 0) + 1;
    if (log.user_id) uniqueUsers.add(log.user_id);
  }

  const dailyActivity = Object.entries(logsByDate)
    .sort(([a], [c]) => a.localeCompare(c))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));

  const popularBuildings = Object.entries(buildingViews)
    .sort(([, a], [, c]) => c - a)
    .slice(0, 5)
    .map(([id, views]) => ({
      id,
      name: (buildings || []).find((x: any) => x.id === id)?.name || id,
      views,
    }));

  const roleCounts: Record<string, number> = {};
  let recentSignups = 0;
  for (const pr of profiles || []) {
    roleCounts[pr.role] = (roleCounts[pr.role] || 0) + 1;
    if (pr.created_at && pr.created_at >= sevenDaysAgo) recentSignups++;
  }

  return {
    totalLogs: totalLogsCount ?? 0,
    uniqueUsers: uniqueUsers.size,
    totalAlerts: (alerts || []).length,
    unresolvedAlerts: (alerts || []).filter((x: any) => !x.resolved).length,
    recentSignups,
    dailyActivity,
    actionCounts,
    popularBuildings,
    roleStats: Object.entries(roleCounts).map(([role, cnt]) => ({ role, cnt })),
  };
};

// Route Calculation
export const getRoute = (from: string, to: string, accessible?: boolean) =>
  (async () => {
    const paths = await getPaths();
    const available = paths.filter((p: any) => {
      if (p.status === "closed") return false;
      if (accessible && !p.accessible) return false;
      return true;
    });
    const graph: Record<string, { to: string; distance: number }[]> = {};
    for (const p of available) {
      if (!graph[p.fromBuilding]) graph[p.fromBuilding] = [];
      if (!graph[p.toBuilding]) graph[p.toBuilding] = [];
      graph[p.fromBuilding].push({ to: p.toBuilding, distance: p.distance });
      graph[p.toBuilding].push({ to: p.fromBuilding, distance: p.distance });
    }
    const queue: { node: string; path: string[]; distance: number }[] = [
      { node: from, path: [from], distance: 0 },
    ];
    const visited = new Set<string>();
    while (queue.length) {
      queue.sort((a, b) => a.distance - b.distance);
      const cur = queue.shift()!;
      if (visited.has(cur.node)) continue;
      visited.add(cur.node);
      if (cur.node === to) {
        const walkingTime = Math.ceil(cur.distance / 80);
        return { found: true, path: cur.path, distance: cur.distance, walkingTime };
      }
      for (const n of graph[cur.node] || []) {
        if (!visited.has(n.to))
          queue.push({ node: n.to, path: [...cur.path, n.to], distance: cur.distance + n.distance });
      }
    }
    return { found: false, path: [], distance: 0, walkingTime: 0 };
  })();

// File Upload
// uploadImage returns a full Supabase public URL — store it as-is in the DB.
export const uploadImage = async (file: File): Promise<{ url: string; filename: string }> => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(filename, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("uploads").getPublicUrl(filename);
  return { url: data.publicUrl, filename };
};

export const SERVER_URL = "";

// Site Content
export type LandingContent = {
  heroBadge: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  heroImageUrl: string;
  campusImageUrl: string;
  campusCardTitle: string;
  campusCardSubtitle: string;
  campusSectionBadge: string;
  campusSectionTitle: string;
  campusSectionBody: string;
  ctaTitle: string;
  ctaBody: string;
  ctaPrimaryLabel: string;
  ctaPrimaryTo: string;
  ctaSecondaryLabel: string;
  ctaSecondaryTo: string;
  stats: { label: string; value: string }[];
};

export const getLandingContent = () =>
  (async () => {
    const { data, error } = await supabase
      .from("site_content")
      .select("value, updated_at")
      .eq("key", "landing")
      .maybeSingle();
    unwrap(true, error);
    return { content: (data?.value as any) || null, updatedAt: data?.updated_at || null };
  })();

export const updateLandingContent = (content: LandingContent) =>
  (async () => {
    const payload = { key: "landing", value: content };
    const { data, error } = await supabase
      .from("site_content")
      .upsert(payload, { onConflict: "key" })
      .select("value, updated_at")
      .single();
    unwrap(true, error);
    return { ok: true, content: data!.value as any, updatedAt: data!.updated_at };
  })();

export type CampusTourSettings = { startPanoId: string | null };

export const getCampusTourSettings = () =>
  (async () => {
    const { data, error } = await supabase
      .from("site_content")
      .select("value, updated_at")
      .eq("key", "campus_tour")
      .maybeSingle();
    unwrap(true, error);
    return {
      content: (data?.value as any) || { startPanoId: null },
      updatedAt: data?.updated_at || null,
    };
  })();

export const updateCampusTourSettings = (content: CampusTourSettings) =>
  (async () => {
    const payload = { key: "campus_tour", value: content };
    const { data, error } = await supabase
      .from("site_content")
      .upsert(payload, { onConflict: "key" })
      .select("value, updated_at")
      .single();
    unwrap(true, error);
    return { ok: true, content: data!.value as any, updatedAt: data!.updated_at };
  })();

export type TourRouteStep = {
  from: string;
  to: string;
  label: string | null;
  fromName: string;
  toName: string;
};

export const getTourRoute = (_fromPanoId: string, _toPanoId: string) =>
  Promise.reject(new Error("Tour route API not migrated yet"));