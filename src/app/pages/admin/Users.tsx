import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import {
  Users, RefreshCw, Shield, GraduationCap, Briefcase, Crown,
  Search, Plus, Trash2, Edit2, X, Save, AlertCircle, Check, KeyRound
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const roleConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: "Admin", color: "text-red-700", bg: "bg-red-100", icon: Crown },
  staff: { label: "Staff", color: "text-blue-700", bg: "bg-blue-100", icon: Briefcase },
  student: { label: "Student", color: "text-green-700", bg: "bg-green-100", icon: GraduationCap },
};

const Toast: React.FC<{ msg: string; type: "success" | "error" }> = ({ msg, type }) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
    className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white
      ${type === "success" ? "bg-green-600" : "bg-red-600"}`}
  >
    {type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
    {msg}
  </motion.div>
);

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [createLoading, setCreateLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Edit modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "student", password: "" });

  // ✅ Abort ref + toast timer ref for cleanup
  const abortRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ✅ Load users directly from Supabase profiles table
  const load = async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (abortRef.current?.signal.aborted) return;
      if (error) throw error;

      setUsers(data || []);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Failed to load users:", e.message);
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ✅ Update role directly via Supabase (requires admin update policy in RLS)
  const handleRoleChange = async (userId: string, role: string) => {
    if (userId === currentUser?.id && !confirm("Change your own role? You may lose admin access.")) return;
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      showToast("Role updated!");
    } catch (e: any) {
      showToast(e.message || "Update failed", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // ✅ Create user via Supabase Auth (uses signUp, then update profile)
  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      showToast("All fields are required", "error"); return;
    }
    setCreateLoading(true);
    try {
      // Create the auth user
      const { data, error } = await supabase.auth.admin.createUser({
        email: createForm.email,
        password: createForm.password,
        user_metadata: { name: createForm.name },
        email_confirm: true,
      });
      if (error) throw error;

      // Update profile with name and role
      await supabase
        .from("profiles")
        .update({ name: createForm.name, role: createForm.role })
        .eq("id", data.user.id);

      showToast("User created successfully!");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "student" });
      load();
    } catch (e: any) {
      // Fallback: if admin API not available, use signUp
      // Save the current admin session first so we can restore it after signUp
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const adminSession = sessionData?.session;

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: createForm.email,
          password: createForm.password,
          options: { data: { name: createForm.name } },
        });
        if (signUpError) throw signUpError;

        if (signUpData.user) {
          // Update the new user's profile using the new user's session
          await supabase
            .from("profiles")
            .update({ name: createForm.name, role: createForm.role })
            .eq("id", signUpData.user.id);
        }

        // Restore the original admin session so the current user stays logged in
        if (adminSession) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          });
        }

        showToast("User created successfully!");
        setShowCreate(false);
        setCreateForm({ name: "", email: "", password: "", role: "student" });
        load();
      } catch (fallbackErr: any) {
        showToast(fallbackErr.message || "Create failed", "error");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // ✅ Edit user profile directly via Supabase
  const handleEditSave = async () => {
    if (!editingUser) return;
    setUpdatingId(editingUser.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: editForm.name, role: editForm.role })
        .eq("id", editingUser.id);
      if (error) throw error;

      showToast("User updated!");
      setEditingUser(null);
      load();
    } catch (e: any) {
      showToast(e.message || "Update failed", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // ✅ Delete user via Supabase Auth admin API
  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.id) { showToast("Cannot delete your own account", "error"); return; }
    if (!confirm("Permanently delete this user? This cannot be undone.")) return;
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      showToast("User deleted!");
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      showToast(e.message || "Delete failed", "error");
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">User Management</h2>
          <p className="text-gray-500 text-sm">Manage accounts, roles, and access</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
            <Plus size={16} /> New User
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-800">Create New User</h3>
            <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name *</label>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Juan dela Cruz"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Email *</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@ub.edu.ph"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Password *</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <KeyRound size={15} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Role</label>
              <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={createLoading}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              {createLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
              Create User
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-purple-200 shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-800">Edit User: {editingUser.name}</h3>
            <button onClick={() => setEditingUser(null)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name</label>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">Note: Email and password changes require Supabase Dashboard.</p>
          <div className="flex gap-3">
            <button onClick={handleEditSave} disabled={!!updatingId}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              {updatingId ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
              Save Changes
            </button>
            <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(roleConfig).map(([role, cfg]) => {
          const Icon = cfg.icon;
          const count = users.filter(u => u.role === role).length;
          return (
            <button key={role} onClick={() => setRoleFilter(roleFilter === role ? "all" : role)}
              className={`bg-white rounded-xl border-2 p-4 flex items-center gap-3 transition-all hover:shadow-md ${roleFilter === role ? "border-blue-500 shadow-md" : "border-gray-100"}`}>
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
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-bold text-gray-600">User</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Role</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Joined</th>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    ))}
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
                          {(u.name || u.email)?.[0]?.toUpperCase()}
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
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
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
                        <button onClick={() => {
                          setEditingUser(u);
                          setEditForm({ name: u.name || "", email: u.email || "", role: u.role || "student", password: "" });
                        }}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Edit user">
                          <Edit2 size={13} />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button onClick={() => handleDelete(u.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete user">
                            <Trash2 size={13} />
                          </button>
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
          <div className="text-center py-12 text-gray-400">
            <Users size={36} className="mx-auto mb-2 opacity-40" /><p>No users found</p>
          </div>
        )}
      </div>
      <p className="text-gray-400 text-xs text-center">Total: {users.length} users · Showing: {filtered.length}</p>
    </div>
  );
}