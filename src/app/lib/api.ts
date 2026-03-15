import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase } from "./supabase";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e3faccbd`;

const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || publicAnonKey;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const req = async <T>(method: string, path: string, body?: any): Promise<T> => {
  const headers = await getAuthHeader();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
};

// Auth
export const signup = (data: { email: string; password: string; name: string; role?: string; adminCode?: string }) =>
  req("POST", "/auth/signup", data);

export const getMyRole = () => req<{ role: string; profile: any }>("GET", "/auth/role");

// Buildings
export const getBuildings = () => req<any[]>("GET", "/buildings");
export const getBuilding = (id: string) => req<any>("GET", `/buildings/${id}`);
export const createBuilding = (data: any) => req("POST", "/buildings", data);
export const updateBuilding = (id: string, data: any) => req("PUT", `/buildings/${id}`, data);
export const deleteBuilding = (id: string) => req("DELETE", `/buildings/${id}`);

// Panoramas
export const getPanoramas = (buildingId?: string) =>
  req<any[]>("GET", `/panoramas${buildingId ? `?buildingId=${buildingId}` : ""}`);
export const createPanorama = (data: any) => req("POST", "/panoramas", data);
export const updatePanorama = (id: string, data: any) => req("PUT", `/panoramas/${id}`, data);

// Paths
export const getPaths = () => req<any[]>("GET", "/paths");
export const createPath = (data: any) => req("POST", "/paths", data);
export const updatePath = (id: string, data: any) => req("PUT", `/paths/${id}`, data);
export const deletePath = (id: string) => req("DELETE", `/paths/${id}`);

// Resources
export const getResources = () => req<any[]>("GET", "/resources");
export const createResource = (data: any) => req("POST", "/resources", data);
export const updateResource = (id: string, data: any) => req("PUT", `/resources/${id}`, data);
export const deleteResource = (id: string) => req("DELETE", `/resources/${id}`);

// Activity Logs
export const logActivity = (data: { action: string; userId?: string; buildingId?: string; details?: any }) =>
  req("POST", "/activity-logs", data);
export const getActivityLogs = () => req<any[]>("GET", "/activity-logs");

// Security Alerts
export const getSecurityAlerts = () => req<any[]>("GET", "/security-alerts");
export const createSecurityAlert = (data: any) => req("POST", "/security-alerts", data);
export const resolveAlert = (id: string) => req("PUT", `/security-alerts/${id}/resolve`, {});

// Users
export const getUsers = () => req<any[]>("GET", "/users");
export const updateUserRole = (id: string, role: string) => req("PUT", `/users/${id}/role`, { role });

// Analytics
export const getAnalytics = () => req<any>("GET", "/analytics");

// Route
export const getRoute = (from: string, to: string, accessible?: boolean) =>
  req<{ found: boolean; path: string[]; distance: number; walkingTime: number }>(
    "GET", `/route?from=${from}&to=${to}&accessible=${accessible || false}`
  );
