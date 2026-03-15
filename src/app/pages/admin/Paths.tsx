import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Edit2, Trash2, CheckCircle, AlertTriangle, XCircle, Route, Save, X } from "lucide-react";
import { getPaths, getBuildings, createPath, updatePath, deletePath } from "../../lib/api";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open: { label: "Open", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle },
  construction: { label: "Construction", color: "text-yellow-700", bg: "bg-yellow-100", icon: AlertTriangle },
  closed: { label: "Closed", color: "text-red-700", bg: "bg-red-100", icon: XCircle },
};

const defaultForm = { fromBuilding: "", toBuilding: "", status: "open", accessible: true, distance: 100, description: "" };

export default function AdminPaths() {
  const [paths, setPaths] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = () => {
    setLoading(true);
    Promise.all([getPaths(), getBuildings()])
      .then(([p, b]) => { setPaths(p); setBuildings(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || id;

  const handleEdit = (path: any) => {
    setEditingId(path.id);
    setForm({ fromBuilding: path.fromBuilding, toBuilding: path.toBuilding, status: path.status, accessible: path.accessible, distance: path.distance, description: path.description || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) await updatePath(editingId, form);
      else await createPath(form);
      setShowForm(false); setEditingId(null); setForm(defaultForm);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this path?")) return;
    await deletePath(id);
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updatePath(id, { status });
    load();
  };

  const filtered = filterStatus === "all" ? paths : paths.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Path Management</h2>
          <p className="text-gray-500 text-sm mt-0.5">Control campus walkway statuses and routing</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all">
          <Plus size={18} /> Add Path
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = paths.filter(p => p.status === status).length;
          const Icon = cfg.icon;
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
              className={`bg-white rounded-xl border-2 p-4 flex items-center gap-3 transition-all hover:shadow-md ${filterStatus === status ? "border-blue-500" : "border-gray-100"}`}>
              <div className={`${cfg.bg} p-2 rounded-lg`}><Icon size={20} className={cfg.color} /></div>
              <div><p className="font-black text-gray-800 text-lg">{count}</p><p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p></div>
            </button>
          );
        })}
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800">{editingId ? "Edit Path" : "Add New Path"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">From Building</label>
              <select value={form.fromBuilding} onChange={e => setForm(f => ({...f, fromBuilding: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="">Select...</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">To Building</label>
              <select value={form.toBuilding} onChange={e => setForm(f => ({...f, toBuilding: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="">Select...</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="open">Open</option>
                <option value="construction">Under Construction</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Distance (meters)</label>
              <input type="number" value={form.distance} onChange={e => setForm(f => ({...f, distance: Number(e.target.value)}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                placeholder="Brief description of this path..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="accessible" checked={form.accessible} onChange={e => setForm(f => ({...f, accessible: e.target.checked}))} className="w-4 h-4 accent-blue-600" />
              <label htmlFor="accessible" className="text-sm font-medium text-gray-700">Wheelchair Accessible</label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || !form.fromBuilding || !form.toBuilding}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {editingId ? "Update" : "Create"} Path
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Paths Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-bold text-gray-600">From</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">To</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Distance</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Accessible</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.map(path => {
                const sc = statusConfig[path.status] || statusConfig.open;
                const StatusIcon = sc.icon;
                return (
                  <tr key={path.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{getBuildingName(path.fromBuilding)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{getBuildingName(path.toBuilding)}</td>
                    <td className="px-4 py-3">
                      <select value={path.status} onChange={e => handleStatusChange(path.id, e.target.value)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-full border-0 ${sc.bg} ${sc.color} cursor-pointer`}>
                        <option value="open">Open</option>
                        <option value="construction">Construction</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{path.distance}m</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${path.accessible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {path.accessible ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(path)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(path.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Route size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No paths found</p>
          </div>
        )}
      </div>
    </div>
  );
}
