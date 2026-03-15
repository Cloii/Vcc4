import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, Users, Eye, Building2, RefreshCw } from "lucide-react";
import { getAnalytics } from "../../lib/api";

const COLORS = ["#1D4ED8", "#DC2626", "#F59E0B", "#16A34A", "#9333EA", "#EA580C"];

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getAnalytics().then(setData).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  const actionData = data?.actionCounts
    ? Object.entries(data.actionCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        value,
      }))
    : [];

  const dailyData = data?.dailyActivity || [];
  const popularBuildings = data?.popularBuildings || [];

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4`}>
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Usage Analytics</h2>
          <p className="text-gray-500 text-sm">Campus activity and engagement metrics</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-all text-sm">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="Total Actions" value={data?.totalLogs || 0} color="bg-blue-600" />
        <StatCard icon={Users} label="Unique Users" value={data?.uniqueUsers || 0} color="bg-green-600" />
        <StatCard icon={Building2} label="Popular Buildings" value={popularBuildings.length} color="bg-purple-600" />
        <StatCard icon={TrendingUp} label="Security Alerts" value={data?.totalAlerts || 0} color="bg-red-600" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Daily Activity (Last 14 Days)</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v, "Actions"]} labelFormatter={l => `Date: ${l}`} />
                <Line type="monotone" dataKey="count" stroke="#1D4ED8" strokeWidth={3} dot={{ fill: "#1D4ED8", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center"><BarChart3 size={40} className="mx-auto mb-2 opacity-30" /><p>No activity data yet</p></div>
            </div>
          )}
        </div>

        {/* Action Types */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-yellow-600" /> Actions by Type</h3>
          {actionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={actionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]}>
                  {actionData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center"><BarChart3 size={40} className="mx-auto mb-2 opacity-30" /><p>No action data yet</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Popular Buildings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} className="text-purple-600" /> Most Visited Buildings</h3>
          {popularBuildings.length > 0 ? (
            <div className="space-y-3">
              {popularBuildings.map((b: any, i: number) => (
                <motion.div key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-gray-500 w-5 text-right">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700 truncate">{b.name}</span>
                    <span className="text-sm font-black text-gray-800">{b.views}</span>
                  </div>
                  <div className="ml-8 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(b.views / (popularBuildings[0]?.views || 1)) * 100}%` }}
                      transition={{ delay: i * 0.1 + 0.3, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              <div className="text-center"><Building2 size={40} className="mx-auto mb-2 opacity-30" /><p>No tour data yet</p></div>
            </div>
          )}
        </div>

        {/* Pie Chart of Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><Eye size={18} className="text-blue-600" /> Activity Distribution</h3>
          {actionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={actionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.slice(0,12)}... ${(percent * 100).toFixed(0)}%`}>
                  {actionData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400">
              <div className="text-center"><Eye size={40} className="mx-auto mb-2 opacity-30" /><p>No data to display</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
