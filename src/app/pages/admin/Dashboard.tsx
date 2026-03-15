import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { BarChart3, Building2, Map, BookOpen, Users, Shield, AlertTriangle, TrendingUp, Eye, Route } from "lucide-react";
import { getAnalytics, getBuildings, getPaths, getResources, getSecurityAlerts, getUsers } from "../../lib/api";

const StatCard = ({ icon: Icon, label, value, color, link }: any) => (
  <Link to={link}>
    <motion.div whileHover={{ scale: 1.02 }} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </motion.div>
  </Link>
);

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [stats, setStats] = useState({ buildings: 0, paths: 0, resources: 0, users: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getAnalytics(),
      getBuildings(),
      getPaths(),
      getResources(),
      getUsers().catch(() => []),
      getSecurityAlerts(),
    ]).then(([analytics, buildings, paths, resources, users, alerts]) => {
      setAnalytics(analytics);
      setStats({
        buildings: buildings.length,
        paths: paths.length,
        resources: resources.length,
        users: users.length,
        alerts: alerts.filter((a: any) => !a.resolved).length,
      });
      setRecentAlerts(alerts.slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const openPaths = analytics?.actionCounts;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-black mb-1">Admin Dashboard</h2>
        <p className="text-blue-200 text-sm">University of Bohol — Virtual Campus Companion</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-blue-300">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          System operational · {new Date().toLocaleDateString("en-PH", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Buildings" value={stats.buildings} color="bg-blue-600" link="/admin/buildings" />
        <StatCard icon={Map} label="Campus Paths" value={stats.paths} color="bg-green-600" link="/admin/paths" />
        <StatCard icon={BookOpen} label="Resources" value={stats.resources} color="bg-purple-600" link="/admin/resources" />
        <StatCard icon={Users} label="Users" value={stats.users} color="bg-orange-500" link="/admin/users" />
        <StatCard icon={AlertTriangle} label="Active Alerts" value={stats.alerts} color="bg-red-600" link="/admin/security" />
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Activity Summary</h3>
            <Link to="/admin/analytics" className="text-blue-600 text-xs font-semibold hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "Total Activity Logs", value: analytics?.totalLogs || 0, icon: Eye, color: "bg-blue-100 text-blue-700" },
              { label: "Unique Users", value: analytics?.uniqueUsers || 0, icon: Users, color: "bg-green-100 text-green-700" },
              { label: "Security Alerts", value: analytics?.totalAlerts || 0, icon: Shield, color: "bg-red-100 text-red-700" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={`${color} p-1.5 rounded-lg`}><Icon size={14} /></span>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <span className="font-black text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800 flex items-center gap-2"><Shield size={18} className="text-red-600" /> Recent Alerts</h3>
            <Link to="/admin/security" className="text-blue-600 text-xs font-semibold hover:underline">View All</Link>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No security alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-xl border ${alert.resolved ? "bg-gray-50 border-gray-100" : "bg-red-50 border-red-100"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className={alert.resolved ? "text-gray-400" : "text-red-500"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{alert.type?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{alert.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${alert.resolved ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"}`}>
                      {alert.resolved ? "Resolved" : "Active"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-black text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Manage Paths", icon: Route, to: "/admin/paths", color: "from-green-500 to-green-700" },
            { label: "Add Building", icon: Building2, to: "/admin/buildings", color: "from-blue-500 to-blue-700" },
            { label: "View Analytics", icon: BarChart3, to: "/admin/analytics", color: "from-purple-500 to-purple-700" },
            { label: "Security Logs", icon: Shield, to: "/admin/security", color: "from-red-500 to-red-700" },
          ].map(({ label, icon: Icon, to, color }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-2 bg-gradient-to-br ${color} text-white py-4 px-3 rounded-xl hover:shadow-lg transition-all hover:scale-105`}>
              <Icon size={22} />
              <span className="text-sm font-semibold text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
