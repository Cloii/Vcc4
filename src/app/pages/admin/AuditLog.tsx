import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  ClipboardList, Search, RefreshCw, Download, Filter,
  Building2, Users, Map, BookOpen, Image, Upload, Shield, User,
  ArrowRight, ImageIcon, Tag, MapPin, FileText, Hash, Globe,
  AlignLeft, Layers, Link2
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const resourceIcons: Record<string, any> = {
  building: Building2, user: Users, path: Map,
  resource: BookOpen, panorama: Image, file: Upload,
};

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  UPLOAD: "bg-purple-100 text-purple-700",
  UPDATE_ROLE: "bg-yellow-100 text-yellow-700",
};

// Maps field names → human-readable label + icon
const fieldMeta: Record<string, { label: string; icon: React.FC<any>; isMedia?: boolean }> = {
  name:        { label: "name",        icon: Tag },
  title:       { label: "title",       icon: Tag },
  category:    { label: "category",    icon: Layers },
  description: { label: "description", icon: AlignLeft },
  image_url:   { label: "photo",       icon: ImageIcon, isMedia: true },
  thumbnail:   { label: "thumbnail",   icon: ImageIcon, isMedia: true },
  lat:         { label: "latitude",    icon: MapPin },
  lng:         { label: "longitude",   icon: MapPin },
  floor:       { label: "floor",       icon: Hash },
  url:         { label: "URL",         icon: Link2 },
  file_url:    { label: "file",        icon: FileText, isMedia: true },
  status:      { label: "status",      icon: Globe },
  role:        { label: "role",        icon: User },
  order:       { label: "order",       icon: Hash },
};

function isUrl(val: unknown): boolean {
  return typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"));
}

function friendlyValue(val: unknown, isMedia = false): string {
  if (val === null || val === undefined || val === "") return "empty";
  if (isMedia && isUrl(val)) return "image";
  if (isUrl(val as string)) return `"${(val as string).slice(0, 40)}…"`;
  if (typeof val === "object") return JSON.stringify(val);
  return `"${String(val)}"`;
}

interface ChangeItem {
  icon: React.FC<any>;
  label: string;
  oldVal: unknown;
  newVal: unknown;
  isMedia: boolean;
  key: string;
}

/**
 * Diffs old_values vs new_values and returns plain-English change items.
 */
function summarizeChanges(
  action: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): ChangeItem[] {
  if (action === "DELETE" || action === "CREATE" || (!oldValues && !newValues)) return [];

  const old_ = oldValues || {};
  const new_ = newValues || {};

  // Collect all keys that changed (ignoring `id` and `updated_at`)
  const skip = new Set(["id", "updated_at", "created_at"]);
  const keys = Array.from(
    new Set([...Object.keys(old_), ...Object.keys(new_)])
  ).filter(k => !skip.has(k) && old_[k] !== new_[k]);

  return keys.map(key => {
    const meta = fieldMeta[key];
    return {
      key,
      icon: meta?.icon ?? FileText,
      label: meta?.label ?? key.replace(/_/g, " "),
      oldVal: old_[key] ?? null,
      newVal: new_[key] ?? null,
      isMedia: meta?.isMedia ?? false,
    };
  });
}

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const load = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    try {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("timestamp", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (resourceType) query = query.eq("resource_type", resourceType);
      if (debouncedSearch) {
        query = query.or(
          `action.ilike.%${debouncedSearch}%,admin_email.ilike.%${debouncedSearch}%,resource_id.ilike.%${debouncedSearch}%`
        );
      }

      const { data, count, error } = await query;
      if (abortRef.current?.signal.aborted) return;
      if (error) throw error;

      setLogs(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Failed to load audit logs:", e.message);
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }, [debouncedSearch, resourceType, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(0);
  };

  const exportCSV = () => {
    const headers = ["Timestamp", "Admin Email", "Action", "Resource Type", "Resource ID"];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.admin_email || "—",
      l.action,
      l.resource_type || "—",
      l.resource_id || "—",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2">
              <ClipboardList size={22} /> Audit Log
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Complete record of all admin actions — {total.toLocaleString()} entries
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by action, admin, or resource..."
            className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400 ml-1" />
          <select
            value={resourceType}
            onChange={e => { setResourceType(e.target.value); setPage(0); }}
            className="px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm bg-white"
          >
            <option value="">All Resources</option>
            <option value="building">Buildings</option>
            <option value="user">Users</option>
            <option value="path">Paths</option>
            <option value="resource">Resources</option>
            <option value="panorama">Panoramas</option>
            <option value="file">Files</option>
          </select>
        </div>
        <button type="submit" className="px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors">
          Search
        </button>
      </form>

      {/* Log Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No audit log entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log, idx) => {
              const ResourceIcon = resourceIcons[log.resource_type] || Shield;
              const actionClass = actionColors[log.action] || "bg-gray-100 text-gray-600";
              const isExpanded = expanded === log.id;
              const changes = summarizeChanges(log.action, log.old_values, log.new_values);
              const hasDetail = changes.length > 0 || log.action === "CREATE" || log.action === "DELETE";

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`transition-colors ${hasDetail ? "cursor-pointer hover:bg-gray-50/80" : ""}`}
                  onClick={() => hasDetail && setExpanded(isExpanded ? null : log.id)}
                >
                  <div className="px-5 py-4 flex items-start gap-4">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ResourceIcon size={16} className="text-slate-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${actionClass}`}>
                          {log.action}
                        </span>
                        {log.resource_type && (
                          <span className="text-xs text-gray-500 font-semibold capitalize">
                            {log.resource_type}
                          </span>
                        )}
                        {log.resource_id && (
                          <span className="text-xs text-gray-400 font-mono truncate max-w-[160px]">
                            {log.resource_id}
                          </span>
                        )}

                        {/* Inline change pills — shown collapsed */}
                        {!isExpanded && changes.length > 0 && (
                          <span className="text-xs text-gray-400 italic">
                            · changed {changes.slice(0, 2).map(c => c.label).join(", ")}
                            {changes.length > 2 ? ` +${changes.length - 2} more` : ""}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User size={11} /> {log.admin_email || "system"}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString("en-PH")}</span>
                      </div>

                      {/* Expanded: human-readable diff */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 space-y-2"
                        >
                          {log.action === "CREATE" && (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2 font-medium">
                              ✦ New {log.resource_type || "record"} created
                              {log.new_values?.name ? `: "${log.new_values.name}"` : ""}
                            </p>
                          )}

                          {log.action === "DELETE" && (
                            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 font-medium">
                              ✕ {log.resource_type || "Record"} deleted
                              {log.old_values?.name ? `: "${log.old_values.name}"` : ""}
                            </p>
                          )}

                          {changes.length > 0 && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                              {changes.map(({ key, icon: Icon, label, oldVal, newVal, isMedia }) => (
                                <div key={key} className="flex items-center gap-3 px-3 py-2.5 text-xs bg-white">
                                  <Icon size={13} className="text-gray-400 flex-shrink-0" />
                                  <span className="text-gray-500 font-semibold capitalize w-24 flex-shrink-0">
                                    {label}
                                  </span>
                                  {/* Old value */}
                                  {isMedia && isUrl(oldVal) ? (
                                    <img
                                      src={oldVal as string}
                                      alt="before"
                                      className="w-10 h-10 object-cover rounded-lg border border-red-200 opacity-60 flex-shrink-0"
                                    />
                                  ) : (
                                    <span className="text-red-500 line-through truncate max-w-[120px]">
                                      {friendlyValue(oldVal, isMedia)}
                                    </span>
                                  )}
                                  <ArrowRight size={11} className="text-gray-300 flex-shrink-0" />
                                  {/* New value */}
                                  {isMedia && isUrl(newVal) ? (
                                    <img
                                      src={newVal as string}
                                      alt="after"
                                      className="w-10 h-10 object-cover rounded-lg border border-green-200 flex-shrink-0"
                                    />
                                  ) : (
                                    <span className="text-green-600 font-medium truncate max-w-[160px]">
                                      {friendlyValue(newVal, isMedia)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {hasDetail && (
                      <div className={`text-gray-400 transition-transform mt-1 ${isExpanded ? "rotate-180" : ""}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page + 1} of {totalPages} · {total.toLocaleString()} total entries
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-sm font-semibold border-2 border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 text-sm font-semibold border-2 border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}