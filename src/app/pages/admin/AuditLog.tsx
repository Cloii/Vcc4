import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  ClipboardList, Search, RefreshCw, Download, Filter,
  Building2, Users, Map, BookOpen, Image, Upload, Shield, User
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

  // ✅ Abort ref and debounce timer for cleanup
  const abortRef = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ✅ Debounce search — API only fires 400ms after user stops typing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  // ✅ Load audit logs directly from Supabase with filtering + pagination
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

      // ✅ Filter by resource_type (snake_case for Supabase)
      if (resourceType) {
        query = query.eq("resource_type", resourceType);
      }

      // ✅ Search across action, admin_email, resource_id
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
              // ✅ All fields are snake_case from Supabase
              const ResourceIcon = resourceIcons[log.resource_type] || Shield;
              const actionClass = actionColors[log.action] || "bg-gray-100 text-gray-600";
              const isExpanded = expanded === log.id;

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
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
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User size={11} /> {log.admin_email || "system"}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString("en-PH")}</span>
                      </div>

                      {/* Expanded before/after diff */}
                      {isExpanded && (log.old_values || log.new_values) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 grid sm:grid-cols-2 gap-3"
                        >
                          {log.old_values && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                              <p className="text-xs font-black text-red-700 mb-1.5">Before</p>
                              <pre className="text-xs text-red-600 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                              <p className="text-xs font-black text-green-700 mb-1.5">After</p>
                              <pre className="text-xs text-green-600 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    <div className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
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