import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Plus, Edit2, Trash2, Building2, Save, X, Lock,
  Upload, Image, ExternalLink, Check, AlertCircle
} from "lucide-react";
import { getBuildings, createBuilding, updateBuilding, deleteBuilding, uploadImage, SERVER_URL } from "../../lib/api";

const defaultForm = {
  name: "", lat: 9.6546, lng: 123.8547, description: "",
  category: "academic", sensitivityLevel: "public", imageUrl: ""
};

// ── Image Upload Component ────────────────────────────────────────────────────
const ImageUploader: React.FC<{
  value: string;
  onChange: (url: string) => void;
}> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">("upload");

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "insp"];
    if (!allowedExts.includes(ext || "") && !file.type.startsWith("image/")) {
      setUploadError("Only image files are accepted (jpg, png, gif, webp, svg, insp)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError("File must be under 100MB");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(`${SERVER_URL}${url}`);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const resolvedPreview = value?.startsWith("http") ? value : value ? `${SERVER_URL}${value}` : "";

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        {["upload", "url"].map(t => (
          <button key={t} type="button"
            onClick={() => setTab(t as any)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t === "upload" ? "📁 Upload File" : "🔗 Image URL"}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
            ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
          onClick={() => document.getElementById("img-file-input")?.click()}
        >
          <input id="img-file-input" type="file" accept="image/*,.insp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={28} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">Drop image here or click to browse</p>
              <p className="text-xs text-gray-400">JPG, PNG, WebP, GIF, INSP — max 100MB</p>
            </div>
          )}
        </div>
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
        />
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle size={13} /> {uploadError}
        </div>
      )}

      {resolvedPreview && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 h-36">
          <img src={resolvedPreview} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <a href={resolvedPreview} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full">
              <ExternalLink size={12} /> Open
            </a>
          </div>
          <div className="absolute top-2 right-2">
            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} /> Image set
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const catColor: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  academic: "bg-green-100 text-green-700",
  facilities: "bg-purple-100 text-purple-700",
  services: "bg-orange-100 text-orange-700",
};

export default function AdminBuildings() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) await updateBuilding(editingId, form);
      else await createBuilding(form);
      setShowForm(false); setEditingId(null); setForm({ ...defaultForm });
      showToast(editingId ? "Building updated!" : "Building created!");
      load();
    } catch (e: any) {
      showToast(e.message || "Save failed", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building? Associated panoramas will also be removed.")) return;
    try {
      await deleteBuilding(id);
      showToast("Building deleted!");
      load();
    } catch (e: any) { showToast(e.message || "Delete failed", "error"); }
  };

  const filtered = buildings.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white
            ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {toast.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Building Management</h2>
          <p className="text-gray-500 text-sm">{buildings.length} buildings · Add, edit, and upload images</p>
        </div>
        <div className="flex gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search buildings..."
            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
          />
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...defaultForm }); }}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap">
            <Plus size={18} /> Add Building
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" />
              {editingId ? "Edit Building" : "Add New Building"}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X size={20} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Building Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. School of Engineering"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Latitude</label>
              <input type="number" step="0.0001" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Longitude</label>
              <input type="number" step="0.0001" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="admin">Administration</option>
                <option value="academic">Academic</option>
                <option value="facilities">Facilities</option>
                <option value="services">Services</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Sensitivity Level</label>
              <select value={form.sensitivityLevel} onChange={e => setForm(f => ({ ...f, sensitivityLevel: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="public">Public (Everyone)</option>
                <option value="student">Students+</option>
                <option value="staff">Staff & Admin Only</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Building Image</label>
              <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="Describe this building..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {editingId ? "Update Building" : "Create Building"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No buildings found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b, idx) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {b.imageUrl ? (
                  <div className="h-36 overflow-hidden relative">
                    <img src={b.imageUrl?.startsWith("http") ? b.imageUrl : `${SERVER_URL}${b.imageUrl}`}
                      alt={b.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                ) : (
                  <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Image size={36} className="text-gray-300" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-gray-800 text-sm leading-tight">{b.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {b.sensitivityLevel !== "public" && <Lock size={13} className="text-orange-500" />}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${catColor[b.category] || "bg-gray-100 text-gray-600"}`}>
                        {b.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">{b.description}</p>
                  <div className="text-xs text-gray-400 mb-3">{b.lat?.toFixed(4)}°N, {b.lng?.toFixed(4)}°E</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(b)}
                      className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-xl transition-colors">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(b.id)}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2 rounded-xl transition-colors">
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