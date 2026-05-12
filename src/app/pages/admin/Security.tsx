import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, AlertTriangle, CheckCircle, Eye, RefreshCw,
  Clock, User, Monitor, Camera, Code2, Navigation, Wifi,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

// ── Config ────────────────────────────────────────────────────────────────────

const severityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low:    { color: "text-yellow-700", bg: "bg-yellow-100",  border: "border-yellow-200", label: "Low" },
  medium: { color: "text-orange-700", bg: "bg-orange-100",  border: "border-orange-200", label: "Medium" },
  high:   { color: "text-red-700",    bg: "bg-red-100",     border: "border-red-200",    label: "High" },
};

// Icon + label per alert type (new detection types from SecurityMonitor)
const alertTypeMeta: Record<string, { icon: React.ElementType; label: string }> = {
  screen_share_detected:    { icon: Monitor,    label: "Screen Share Detected" },
  screenshot_attempt:       { icon: Camera,     label: "Screenshot Attempt" },
  screen_recording_suspected: { icon: Camera,   label: "Screen Recording Suspected" },
  devtools_opened:          { icon: Code2,      label: "DevTools Opened" },
  rapid_navigation:         { icon: Navigation, label: "Rapid Navigation" },
};

const LOG_ACTION_FILTERS = [
  "all", "page_view", "tour_view", "route_search",
  "building_view", "campus_tour_view",
  "screen_share_detected", "screenshot_attempt",
  "screen_recording_suspected", "devtools_opened", "rapid_navigation",
];

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export default function AdminSecurity() {
  const [alerts, setAlerts]           = useState<any[]>([]);
  const [logs, setLogs]               = useState<any[]>([]);
  const [totalLogs, setTotalLogs]     = useState(0);
  const [logsPage, setLogsPage]       = useState(0);         // 0-based page index
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"alerts" | "logs">("alerts");
  const [filter, setFilter]           = useState("all");
  const [resolving, setResolving]     = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Initial data load ────────────────────────────────────────────────────────
  const load = async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setLogsPage(0);
    try {
      const [alertsRes, logsRes] = await Promise.all([
        supabase.from("security_alerts").select("*").order("timestamp", { ascending: false }),
        // Use count:"exact" to get the real total without fetching every row
        supabase
          .from("activity_logs")
          .select("*", { count: "exact" })
          .order("timestamp", { ascending: false })
          .range(0, PAGE_SIZE - 1),
      ]);

      if (abortRef.current?.signal.aborted) return;
      if (alertsRes.error) throw alertsRes.error;
      if (logsRes.error)   throw logsRes.error;

      setAlerts(alertsRes.data || []);
      setLogs(logsRes.data || []);
      setTotalLogs(logsRes.count ?? 0);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Failed to load security data:", e.message);
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  };

  // ── Load next page of logs ───────────────────────────────────────────────────
  const loadMoreLogs = async () => {
    const nextPage = logsPage + 1;
    const from = nextPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setLogs(prev => [...prev, ...(data || [])]);
      setLogsPage(nextPage);
    } catch (e: any) {
      console.error("Failed to load more logs:", e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Supabase Realtime ────────────────────────────────────────────────────────
  // New alerts and logs pushed by SecurityMonitor appear instantly without
  // requiring a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel("security_realtime")
      // New security alert inserted
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "security_alerts" },
        (payload) => {
          setAlerts(prev => [payload.new as any, ...prev]);
        },
      )
      // Alert resolved (UPDATE)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "security_alerts" },
        (payload) => {
          setAlerts(prev =>
            prev.map(a => a.id === (payload.new as any).id ? { ...a, ...(payload.new as any) } : a),
          );
        },
      )
      // New activity log inserted
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          setLogs(prev => [payload.new as any, ...prev]);
          setTotalLogs(prev => prev + 1);
        },
      )
      .subscribe((status) => {
        setLiveConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Resolve alert ─────────────────────────────────────────────────────────────
  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      const { error } = await supabase
        .from("security_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      // Realtime UPDATE will also propagate this, but optimistic update feels faster
      setAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a),
      );
    } catch (e: any) {
      console.error("Resolve failed:", e.message);
    } finally {
      setResolving(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filteredAlerts = alerts.filter(a => {
    if (filter === "active")   return !a.resolved;
    if (filter === "resolved") return a.resolved;
    if (filter === "high")     return a.severity === "high";
    if (filter === "medium")   return a.severity === "medium";
    return true;
  });

  const filteredLogs = logs.filter(l =>
    filter === "all" || l.action === filter,
  );

  const activeCount    = alerts.filter(a => !a.resolved).length;
  const resolvedCount  = alerts.filter(a => a.resolved).length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Security Monitor</h2>
          <p className="text-gray-500 text-sm flex items-center gap-2">
            Activity logs and security alerts
            {/* Live indicator — green when Supabase Realtime is connected */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
              ${liveConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              <Wifi size={10} />
              {liveConnected ? "Live" : "Connecting…"}
            </span>
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 text-sm">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Active Alerts",  value: activeCount,   color: "bg-red-600",   icon: AlertTriangle },
          { label: "Resolved",       value: resolvedCount, color: "bg-green-600", icon: CheckCircle },
          { label: "Activity Logs",  value: totalLogs,     color: "bg-blue-600",  icon: Eye },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className={`${color} w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        {[
          { k: "alerts", label: "Security Alerts" },
          { k: "logs",   label: "Activity Logs"   },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => { setTab(k as any); setFilter("all"); }}
            className={`pb-2 font-semibold text-sm transition-colors
              ${tab === k ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
            {k === "alerts" && activeCount > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {tab === "alerts" ? (
          ["all", "active", "resolved", "high", "medium"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all
                ${filter === f ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))
        ) : (
          LOG_ACTION_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${filter === f ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f.replace(/_/g, " ")}
            </button>
          ))
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>

      ) : tab === "alerts" ? (
        /* ── Alerts tab ── */
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Shield size={40} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold">No alerts found</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredAlerts.map((alert) => {
                const sev  = severityConfig[alert.severity] ?? severityConfig.low;
                const meta = alertTypeMeta[alert.type] ?? { icon: AlertTriangle, label: alert.type?.replace(/_/g, " ") };
                const TypeIcon = meta.icon;

                return (
                  <motion.div key={alert.id}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    className={`bg-white rounded-xl border-2 p-4
                      ${alert.resolved ? "border-gray-100 opacity-60" : `${sev.border}`}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`${alert.resolved ? "bg-gray-100" : sev.bg} p-2 rounded-lg flex-shrink-0`}>
                        <TypeIcon size={16} className={alert.resolved ? "text-gray-400" : sev.color} />
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm capitalize">
                            {meta.label}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
                            {sev.label}
                          </span>
                          {alert.resolved && (
                            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs mb-1.5 leading-relaxed">{alert.description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          {alert.user_id && (
                            <span className="flex items-center gap-1">
                              <User size={10} /> {alert.user_id.slice(0, 8)}…
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {new Date(alert.timestamp).toLocaleString()}
                          </span>
                          {alert.resolved_at && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle size={10} /> Resolved {new Date(alert.resolved_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Resolve button */}
                      {!alert.resolved && (
                        <button onClick={() => handleResolve(alert.id)} disabled={resolving === alert.id}
                          className="flex-shrink-0 flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {resolving === alert.id
                            ? <div className="w-3 h-3 border-2 border-green-700/30 border-t-green-700 rounded-full animate-spin" />
                            : <CheckCircle size={12} />}
                          Resolve
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

      ) : (
        /* ── Logs tab ── */
        <div className="space-y-2">
          {/* Showing X of Y counter */}
          {!loading && totalLogs > 0 && (
            <p className="text-xs text-gray-400 pb-1">
              Showing <span className="font-semibold text-gray-600">{logs.length.toLocaleString()}</span> of{" "}
              <span className="font-semibold text-gray-600">{totalLogs.toLocaleString()}</span> logs
              {filter !== "all" && ` · filtered to "${filter.replace(/_/g, " ")}"`}
            </p>
          )}

          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Eye size={40} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold">No logs found</p>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => {
                  // Security-related logs get a different colour to stand out
                  const isSecurityLog = [
                    "screen_share_detected", "screenshot_attempt",
                    "screen_recording_suspected", "devtools_opened",
                  ].includes(log.action);

                  return (
                    <motion.div key={log.id}
                      initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3
                        ${isSecurityLog ? "border-orange-200 bg-orange-50" : "border-gray-100"}`}
                    >
                      <div className={`w-8 h-8 ${isSecurityLog ? "bg-orange-100" : "bg-blue-50"} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        {isSecurityLog
                          ? <AlertTriangle size={14} className="text-orange-500" />
                          : <Eye size={14} className="text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold capitalize ${isSecurityLog ? "text-orange-700" : "text-gray-700"}`}>
                          {log.action?.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          {log.user_id && (
                            <span className="flex items-center gap-1">
                              <User size={10} /> {log.user_id.slice(0, 12)}…
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.building_id && (
                            <span>Building: {log.building_id.slice(0, 8)}…</span>
                          )}
                          {log.details?.path && (
                            <span className="font-mono">{log.details.path}</span>
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Load More button — only shown when there are more logs to fetch */}
              {logs.length < totalLogs && filter === "all" && (
                <div className="pt-2 text-center">
                  <button
                    onClick={loadMoreLogs}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-50 text-sm disabled:opacity-50 transition-all"
                  >
                    {loadingMore
                      ? <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                      : <RefreshCw size={14} />}
                    {loadingMore
                      ? "Loading…"
                      : `Load more (${(totalLogs - logs.length).toLocaleString()} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}