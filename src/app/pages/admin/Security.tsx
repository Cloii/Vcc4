import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { Shield, AlertTriangle, CheckCircle, Eye, RefreshCw, Clock, User } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Low" },
  medium: { color: "text-orange-700", bg: "bg-orange-100", label: "Medium" },
  high: { color: "text-red-700", bg: "bg-red-100", label: "High" },
};

export default function AdminSecurity() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"alerts" | "logs">("alerts");
  const [filter, setFilter] = useState("all");
  const [resolving, setResolving] = useState<string | null>(null);

  // ✅ Abort ref + toast timer for cleanup
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ✅ Load directly from Supabase tables
  const load = async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const [alertsRes, logsRes] = await Promise.all([
        supabase
          .from("security_alerts")
          .select("*")
          .order("timestamp", { ascending: false }),
        supabase
          .from("activity_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(200),
      ]);

      if (abortRef.current?.signal.aborted) return;

      if (alertsRes.error) throw alertsRes.error;
      if (logsRes.error) throw logsRes.error;

      setAlerts(alertsRes.data || []);
      setLogs(logsRes.data || []);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Failed to load security data:", e.message);
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ✅ Resolve alert directly via Supabase
  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      const { error } = await supabase
        .from("security_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      // ✅ Update locally instead of re-fetching everything
      setAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a)
      );
    } catch (e: any) {
      console.error("Resolve failed:", e.message);
    } finally {
      setResolving(null);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === "active") return !a.resolved;
    if (filter === "resolved") return a.resolved;
    if (filter === "high") return a.severity === "high";
    return true;
  });

  const filteredLogs = logs.filter(l =>
    filter === "all" || l.action?.includes(filter)
  );

  const activeCount = alerts.filter(a => !a.resolved).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Security Monitor</h2>
          <p className="text-gray-500 text-sm">Activity logs and security alerts</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 text-sm">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Alert Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Active Alerts", value: activeCount, color: "bg-red-600", icon: AlertTriangle },
          { label: "Resolved", value: alerts.filter(a => a.resolved).length, color: "bg-green-600", icon: CheckCircle },
          { label: "Total Logs", value: logs.length, color: "bg-blue-600", icon: Eye },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className={`${color} w-11 h-11 rounded-xl flex items-center justify-center`}>
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
        {[{ k: "alerts", label: "Security Alerts" }, { k: "logs", label: "Activity Logs" }].map(({ k, label }) => (
          <button key={k} onClick={() => { setTab(k as any); setFilter("all"); }}
            className={`pb-2 font-semibold text-sm transition-colors ${tab === k ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
            {k === "alerts" && activeCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {tab === "alerts" ? (
          ["all", "active", "resolved", "high"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${filter === f ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))
        ) : (
          ["all", "page_view", "tour_view", "route_search", "building_view", "campus_tour_view"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
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
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Shield size={40} className="mx-auto mb-2 opacity-40" />
              <p>No alerts found</p>
            </div>
          ) : filteredAlerts.map((alert, idx) => {
            const sev = severityConfig[alert.severity] || severityConfig.low;
            return (
              <motion.div key={alert.id}
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                className={`bg-white rounded-xl border-2 p-4 ${alert.resolved ? "border-gray-100 opacity-70" : "border-red-100"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`${alert.resolved ? "bg-gray-100" : "bg-red-100"} p-2 rounded-lg flex-shrink-0`}>
                    <AlertTriangle size={16} className={alert.resolved ? "text-gray-400" : "text-red-600"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm capitalize">
                        {alert.type?.replace(/_/g, " ")}
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
                    <p className="text-gray-600 text-xs mb-1">{alert.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {alert.user_id && (
                        <span className="flex items-center gap-1">
                          <User size={10} /> {alert.user_id.slice(0, 8)}...
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <button onClick={() => handleResolve(alert.id)} disabled={resolving === alert.id}
                      className="flex-shrink-0 flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
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
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Eye size={40} className="mx-auto mb-2 opacity-40" />
              <p>No logs found</p>
            </div>
          ) : filteredLogs.map((log, idx) => (
            <motion.div key={log.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
              className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Eye size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 capitalize">
                  {log.action?.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
                  {log.user_id && (
                    <span><User size={10} className="inline" /> {log.user_id.slice(0, 12)}...</span>
                  )}
                  <span><Clock size={10} className="inline" /> {new Date(log.timestamp).toLocaleString()}</span>
                  {log.building_id && (
                    <span>Building: {log.building_id}</span>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}