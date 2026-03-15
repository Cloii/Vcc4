import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Edit2, Trash2, Building2, Save, X, Lock, Unlock } from "lucide-react";
import { getBuildings, createBuilding, updateBuilding, deleteBuilding } from "../../lib/api";

const defaultForm = {
  name: "", lat: 9.6546, lng: 123.8547, description: "",
  category: "academic", sensitivityLevel: "public", imageUrl: ""
};

export default function AdminBuildings() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getBuildings().then(setBuildings).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleEdit = (b: any) => {
    setEditingId(b.id);
    setForm({ name: b.name, lat: b.lat, lng: b.lng, description: b.description, category: b.category, sensitivityLevel: b.sensitivityLevel, imageUrl: b.imageUrl || "" });
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) await updateBuilding(editingId, form);
      else await createBuilding(form);
      setShowForm(false); setEditingId(null); setForm({ ...defaultForm });
      load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building? This will also remove associated panoramas.")) return;
    await deleteBuilding(id);
    load();
  };

  const catColor: Record<string, string> = {
    admin: "bg-blue-100 text-blue-700",
    academic: "bg-green-100 text-green-700",
    facilities: "bg-purple-100 text-purple-700",
    services: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Building Management</h2>
          <p className="text-gray-500 text-sm">Add, edit, and remove campus buildings</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({...defaultForm}); }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all">
          <Plus size={18} /> Add Building
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800">{editingId ? "Edit Building" : "Add New Building"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Building Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="e.g. School of Engineering"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Latitude</label>
              <input type="number" step="0.0001" value={form.lat} onChange={e => setForm(f => ({...f, lat: Number(e.target.value)}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Longitude</label>
              <input type="number" step="0.0001" value={form.lng} onChange={e => setForm(f => ({...f, lng: Number(e.target.value)}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="admin">Administration</option>
                <option value="academic">Academic</option>
                <option value="facilities">Facilities</option>
                <option value="services">Services</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Sensitivity Level</label>
              <select value={form.sensitivityLevel} onChange={e => setForm(f => ({...f, sensitivityLevel: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="public">Public (Everyone)</option>
                <option value="student">Students+</option>
                <option value="staff">Staff & Admin Only</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Image URL</label>
              <input value={form.imageUrl} onChange={e => setForm(f => ({...f, imageUrl: e.target.value}))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                rows={3} placeholder="Describe this building..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || !form.name}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {editingId ? "Update" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:6}).map((_,i) => <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((b, idx) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {b.imageUrl && (
                  <div className="h-36 overflow-hidden">
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-gray-800 text-sm leading-tight">{b.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {b.sensitivityLevel !== "public" && <Lock size={13} className="text-orange-500" title={`Sensitivity: ${b.sensitivityLevel}`} />}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${catColor[b.category] || "bg-gray-100 text-gray-600"}`}>{b.category}</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">{b.description}</p>
                  <div className="text-xs text-gray-400 mb-3">{b.lat?.toFixed(4)}°N, {b.lng?.toFixed(4)}°E</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(b)} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-xl transition-colors">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2 rounded-xl transition-colors">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}