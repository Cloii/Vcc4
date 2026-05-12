import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3, Building2, Map, BookOpen, Users, Shield, AlertTriangle,
  TrendingUp, Eye, Route, Server, Database, CheckCircle2, ClipboardList,
  RefreshCw, Wifi, WifiOff, Clock,
} from "lucide-react";
import { getAnalytics, getBuildings, getPaths, getResources, getSecurityAlerts, getUsers } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  buildings: number;
  paths: number;
  resources: number;
  users: number;
  alerts: number;
}

interface Analytics {
  totalLogs: number;
  uniqueUsers: number;
  totalAlerts: number;
  recentSignups: number;
  popularBuildings: { id: string; name: string; views: number }[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, color, link, loading,
}: {
  icon: any; label: string; value: number; color: string; link: string; loading?: boolean;
}) => (
  <Link to={link}>
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        {loading ? (
          <>
            <Skeleton className="h-7 w-12 mb-1" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : (
          <>
            <motion.p
              key={value}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-black text-gray-800"
            >
              {value.toLocaleString()}
            </motion.p>
            <p className="text-sm text-gray-500">{label}</p>
          </>
        )}
      </div>
    </motion.div>
  </Link>
);

// ─── Pulse dot ────────────────────────────────────────────────────────────────
const LiveDot = ({ active }: { active: boolean }) => (
  <span className="relative flex h-2.5 w-2.5">
    {active && (
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
    )}
    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-green-400" : "bg-gray-400"}`} />
  </span>
);

// ─── Refresh interval (ms) ────────────────────────────────────────────────────
const REFRESH_INTERVAL = 30_000; // 30 s

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stats, setStats] = useState<Stats>({ buildings: 0, paths: 0, resources: 0, users: 0, alerts: 0 });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  // ✅ Three loading states: initial skeleton, background refresh, alerts
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Core fetch (reusable for both initial + refresh) ───────────────────────
  const fetchCoreStats = useCallback(async (signal: AbortSignal, isBackground = false) => {
    try {
      if (!isBackground) setAlertsLoading(true);

      const [analyticsData, buildings, paths, resources, users, alerts] = await Promise.all([
        getAnalytics(),
        getBuildings(),
        getPaths(),
        getResources(),
        getUsers().catch(() => [] as any[]),
        getSecurityAlerts().catch(() => [] as any[]),
      ]);

      if (signal.aborted) return;

      setAnalytics(analyticsData);
      setStats({
        buildings: buildings.length,
        paths: paths.length,
        resources: resources.length,
        users: users.length,
        alerts: alerts.filter((a: any) => !a.resolved).length,
      });
      setRecentAlerts(alerts.slice(0, 5));
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError("Failed to fetch latest data.");
    } finally {
      if (!signal.aborted) {
        setInitialLoading(false);
        setRefreshing(false);
        setAlertsLoading(false);
      }
    }
  }, []);

  // ─── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current = new AbortController();
    fetchCoreStats(abortRef.current.signal, false);
    return () => abortRef.current?.abort();
  }, [fetchCoreStats]);

  // ─── Auto-refresh every 30 s ───────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        fetchCoreStats(abortRef.current.signal, true);
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCoreStats]);

  // ─── Re-fetch on tab focus ─────────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        fetchCoreStats(abortRef.current.signal, true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchCoreStats]);

  // ─── Online/offline detection ──────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      fetchCoreStats(abortRef.current.signal, true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [fetchCoreStats]);

  // ─── Manual refresh ────────────────────────────────────────────────────────
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    fetchCoreStats(abortRef.current.signal, true);
    // Reset the auto-refresh timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        fetchCoreStats(abortRef.current.signal, true);
      }
    }, REFRESH_INTERVAL);
  };

  // ─── Skeleton for initial load ─────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black mb-1">Admin Dashboard</h2>
            <p className="text-blue-200 text-sm">University of Bohol — Virtual Campus Companion</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-blue-300">
              <span className="flex items-center gap-1.5">
                <LiveDot active={online} />
                {online ? "System operational" : "Offline — showing cached data"}
              </span>
              <span>·</span>
              <span>
                {new Date().toLocaleDateString("en-PH", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </span>
              {lastUpdated && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    Updated {lastUpdated.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Manual refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh now"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>

            <div className="hidden sm:flex flex-col items-end gap-1.5">
              <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ${online ? "bg-green-500/20 text-green-200" : "bg-yellow-500/20 text-yellow-200"}`}>
                {online ? <><CheckCircle2 size={13} /> Backend Online</> : <><WifiOff size={13} /> Offline</>}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-300">
                <Database size={12} /> Supabase Database
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-300">
                <Server size={12} /> Supabase Edge Functions
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-300/70">
                <Wifi size={12} /> Auto-refresh every 30s
              </div>
            </div>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center justify-between bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2 text-xs text-red-200"
            >
              <span>{error}</span>
              <button onClick={handleRefresh} className="underline ml-2">Retry</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Buildings"     value={stats.buildings} color="bg-blue-600"   link="/admin/buildings" />
        <StatCard icon={Map}       label="Campus Paths"  value={stats.paths}     color="bg-green-600"  link="/admin/paths" />
        <StatCard icon={BookOpen}  label="Resources"     value={stats.resources} color="bg-purple-600" link="/admin/resources" />
        <StatCard icon={Users}     label="Users"         value={stats.users}     color="bg-orange-500" link="/admin/users" />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={stats.alerts}
          color={stats.alerts > 0 ? "bg-red-600" : "bg-gray-400"}
          link="/admin/security"
        />
      </div>

      {/* ── Middle row ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" /> Activity Summary
            </h3>
            <Link to="/admin/analytics" className="text-blue-600 text-xs font-semibold hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "Total Activity Logs",   value: analytics?.totalLogs    ?? 0, icon: Eye,    color: "bg-blue-100 text-blue-700" },
              { label: "Unique Active Users",    value: analytics?.uniqueUsers  ?? 0, icon: Users,  color: "bg-green-100 text-green-700" },
              { label: "Security Alerts",        value: analytics?.totalAlerts  ?? 0, icon: Shield, color: "bg-red-100 text-red-700" },
              { label: "New Signups (7 days)",   value: analytics?.recentSignups ?? 0, icon: Users,  color: "bg-purple-100 text-purple-700" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={`${color} p-1.5 rounded-lg`}><Icon size={14} /></span>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <motion.span key={value} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-black text-gray-800">
                  {value.toLocaleString()}
                </motion.span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <Shield size={18} className="text-red-600" /> Recent Alerts
              {alertsLoading && <RefreshCw size={12} className="animate-spin text-gray-400" />}
            </h3>
            <Link to="/admin/security" className="text-blue-600 text-xs font-semibold hover:underline">View All</Link>
          </div>

          <AnimatePresence mode="wait">
            {alertsLoading ? (
              <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </motion.div>
            ) : recentAlerts.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 text-gray-400">
                <Shield size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No security alerts</p>
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {recentAlerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-3 rounded-xl border ${alert.resolved ? "bg-gray-50 border-gray-100" : "bg-red-50 border-red-100"}`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className={alert.resolved ? "text-gray-400 mt-0.5" : "text-red-500 mt-0.5"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{alert.type?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{alert.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${alert.resolved ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>
                        {alert.resolved ? "Resolved" : "Active"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-black text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Manage Paths",  icon: Route,         to: "/admin/paths",     color: "from-green-500 to-green-700" },
            { label: "Add Building",  icon: Building2,     to: "/admin/buildings", color: "from-blue-500 to-blue-700" },
            { label: "View Analytics",icon: BarChart3,     to: "/admin/analytics", color: "from-purple-500 to-purple-700" },
            { label: "Security Logs", icon: Shield,        to: "/admin/security",  color: "from-red-500 to-red-700" },
            { label: "Manage Users",  icon: Users,         to: "/admin/users",     color: "from-orange-500 to-orange-700" },
            { label: "Audit Log",     icon: ClipboardList, to: "/admin/audit",     color: "from-slate-600 to-slate-800" },
          ].map(({ label, icon: Icon, to, color }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-2 bg-gradient-to-br ${color} text-white py-4 px-3 rounded-xl hover:shadow-lg transition-all hover:scale-105`}>
              <Icon size={22} />
              <span className="text-xs font-semibold text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Popular Buildings ───────────────────────────────────────────────── */}
      {(analytics?.popularBuildings?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" /> Most Visited Buildings
          </h3>
          <div className="space-y-2">
            {analytics!.popularBuildings.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-black text-gray-400">{i + 1}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (b.views / (analytics!.popularBuildings[0]?.views || 1)) * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.07 }}
                  />
                </div>
                <span className="text-sm text-gray-700 font-semibold w-40 truncate">{b.name}</span>
                <span className="text-xs text-gray-500 w-16 text-right">{b.views.toLocaleString()} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}