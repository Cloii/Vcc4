import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Users, RefreshCw, Shield, GraduationCap, Briefcase, Crown, Search } from "lucide-react";
import { getUsers, updateUserRole } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const roleConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: "Admin", color: "text-red-700", bg: "bg-red-100", icon: Crown },
  staff: { label: "Staff", color: "text-blue-700", bg: "bg-blue-100", icon: Briefcase },
  student: { label: "Student", color: "text-green-700", bg: "bg-green-100", icon: GraduationCap },
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");

  const load = () => {
    setLoading(true);
    getUsers().then(setUsers).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    if (userId === currentUser?.id && !confirm("Change your own role? You may lose admin access.")) return;
    setUpdatingId(userId);
    try {
      await updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (e) { console.error(e); }
    finally { setUpdatingId(null); }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">User Management</h2>
          <p className="text-gray-500 text-sm">Manage user accounts and role assignments</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 text-sm">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(roleConfig).map(([role, cfg]) => {
          const Icon = cfg.icon;
          const count = users.filter(u => u.role === role).length;
          return (
            <button key={role} onClick={() => setRoleFilter(roleFilter === role ? "all" : role)}
              className={`bg-white rounded-xl border-2 p-4 flex items-center gap-3 transition-all hover:shadow-md ${roleFilter === role ? "border-blue-500" : "border-gray-100"}`}>
              <div className={`${cfg.bg} p-2.5 rounded-xl`}><Icon size={20} className={cfg.color} /></div>
              <div><p className="font-black text-gray-800 text-xl">{count}</p><p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}s</p></div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-bold text-gray-600">User</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Current Role</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Joined</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({length:5}).map((_,j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.map((u, idx) => {
                const cfg = roleConfig[u.role] || roleConfig.student;
                const Icon = cfg.icon;
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${u.id === currentUser?.id ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                          {u.email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{u.name || "—"}</p>
                          {u.id === currentUser?.id && <span className="text-xs text-blue-600 font-medium">(You)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <Icon size={11} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-4">
                      <div className="relative">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          disabled={updatingId === u.id}
                          className="text-xs border-2 border-gray-200 rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:outline-none bg-white cursor-pointer disabled:opacity-50"
                        >
                          <option value="student">Student</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        {updatingId === u.id && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400"><Users size={36} className="mx-auto mb-2 opacity-40" /><p>No users found</p></div>
        )}
      </div>
      <p className="text-gray-400 text-xs text-center">Total: {users.length} users · Showing: {filtered.length}</p>
    </div>
  );
}
