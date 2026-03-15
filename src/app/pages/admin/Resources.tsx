import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Edit2, Trash2, BookOpen, Save, X, Phone, Clock, MapPin } from "lucide-react";
import { getResources, getBuildings, createResource, updateResource, deleteResource } from "../../lib/api";

const defaultForm = {
  name: "", buildingId: "", location: "", contactInfo: "",
  operatingHours: "", category: "services", description: ""
};

const catColors: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  academic: "bg-green-100 text-green-700",
  facilities: "bg-purple-100 text-purple-700",
  services: "bg-orange-100 text-orange-700",
};

export default function AdminResources() {
  const [resources, setResources] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([getResources(), getBuildings()])
      .then(([r, b]) => { setResources(r); setBuildings(b); })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ name: r.name, buildingId: r.buildingId || "", location: r.location, contactInfo: r.contactInfo, operatingHours: r.operatingHours, category: r.category, description: r.description });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) await updateResource(editingId, form);
      else await createResource(form);
      setShowForm(false); setEditingId(null); setForm({ ...defaultForm });
      load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    await deleteResource(id);
    load();
  };

  const filtered = resources.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Resource Management</h2>
          <p className="text-gray-500 text-sm">Manage campus facilities, offices, and services</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({...defaultForm}); }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all">
          <Plus size={18} /> Add Resource
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-800">{editingId ? "Edit Resource" : "Add New Resource"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}><X size={20} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { key: "name", label: "Resource Name *", placeholder: "e.g. Registrar's Office" },
              { key: "location", label: "Location", placeholder: "e.g. Main Building, 2nd Floor" },
              { key: "contactInfo", label: "Contact Info", placeholder: "(038) 501-XXXX" },
              { key: "operatingHours", label: "Operating Hours", placeholder: "Mon-Fri 8AM-5PM" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-sm font-semibold text-gray-700 block mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
              </div>
            ))}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Building</label>
              <select value={form.buildingId} onChange={e => setForm(f => ({...f, buildingId: e.target.value}))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="">Select building...</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
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
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                rows={2} placeholder="Brief description..."
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

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search resources..." 
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
      />

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-bold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Building</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">Hours</th>
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
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {r.location}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${catColors[r.category] || "bg-gray-100 text-gray-600"}`}>{r.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{getBuildingName(r.buildingId)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs flex items-center gap-1"><Phone size={10} /> {r.contactInfo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs"><Clock size={10} className="inline mr-1" />{r.operatingHours}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400"><BookOpen size={32} className="mx-auto mb-2 opacity-50" /><p>No resources found</p></div>
        )}
      </div>
    </div>
  );
}
