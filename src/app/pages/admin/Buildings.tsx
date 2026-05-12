import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Edit2, Trash2, Building2, Save, X, Lock,
  Upload, Image, ExternalLink, Check, AlertCircle, Camera
} from "lucide-react";
import { getBuildings, createBuilding, updateBuilding, deleteBuilding, uploadImage } from "../../lib/api";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

const defaultForm = {
  name: "", description: "",
  category: "academic", sensitivityLevel: "public", imageUrl: ""
};

const resolveUrl = (url: string) =>
  !url ? "" : url.startsWith("http") ? url : `${SERVER_URL}${url}`;

// ── Image Uploader ─────────────────────────────────────────────────────────────
const ImageUploader: React.FC<{ value: string; onChange: (url: string) => void }> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !["insp"].includes(file.name.split(".").pop()?.toLowerCase() || "")) {
      setUploadError("Only image files are accepted (jpg, png, gif, webp, svg, insp)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) { setUploadError("File must be under 100MB"); return; }
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(resolveUrl(url));
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

  const triggerPick = () => inputRef.current?.click();

  const preview = resolveUrl(value);

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex gap-2">
        {(["upload", "url"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
              ${tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t === "upload" ? "📁 Upload File" : "🔗 Image URL"}
          </button>
        ))}
      </div>

      <input ref={inputRef} id="img-file-input" type="file" accept="image/*,.insp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {tab === "upload" ? (
        /* ── If image already set: show preview with Change/Remove overlay ── */
        preview ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 h-40 group">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button type="button" onClick={triggerPick}
                className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors">
                {uploading
                  ? <div className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                  : <Camera size={13} />}
                {uploading ? "Uploading…" : "Change Photo"}
              </button>
              <a href={preview} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-white text-xs font-semibold bg-black/50 px-3 py-2 rounded-xl hover:bg-black/70">
                <ExternalLink size={12} /> Open
              </a>
              <button type="button" onClick={() => onChange("")}
                className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-600">
                <X size={12} /> Remove
              </button>
            </div>
            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
              <Check size={10} /> Image set
            </span>
          </div>
        ) : (
          /* ── Drop zone when no image ── */
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={triggerPick}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
              ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}>
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={28} className="text-gray-400" />
                <p className="text-sm font-semibold text-gray-600">Drop image here or click to browse</p>
                <p className="text-xs text-gray-400">JPG, PNG, WebP, GIF, INSP — max 100MB</p>
              </div>
            )}
          </div>
        )
      ) : (
        /* ── URL tab ── */
        <div className="space-y-2">
          <input value={value} onChange={e => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
          {preview && (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 h-36">
              <img src={preview} alt="Preview" className="w-full h-full object-cover"
                onError={e => (e.currentTarget.style.display = "none")} />
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle size={13} /> {uploadError}
        </div>
      )}
    </div>
  );
};

// ── Constants ──────────────────────────────────────────────────────────────────
const catColor: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  academic: "bg-green-100 text-green-700",
  facilities: "bg-purple-100 text-purple-700",
  services: "bg-orange-100 text-orange-700",
};

const normalizeBuilding = (b: any) => ({
  ...b,
  sensitivityLevel: b.sensitivity_level ?? b.sensitivityLevel ?? "public",
  imageUrl: resolveUrl(b.image_url ?? b.imageUrl ?? ""),
});

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type: "success" | "error" }> = ({ msg, type }) => (
  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
    className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white
      ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
    {type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
    {msg}
  </motion.div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminBuildings() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    toastTimer.current && clearTimeout(toastTimer.current);
    abortRef.current?.abort();
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    toastTimer.current && clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    getBuildings()
      .then(data => {
        if (abortRef.current?.signal.aborted) return;
        setBuildings(data.map(normalizeBuilding));
      })
      .catch(err => { if (err?.name !== "AbortError") console.error(err); })
      .finally(() => { if (!abortRef.current?.signal.aborted) setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({
      name: b.name ?? "",
      description: b.description ?? "",
      category: b.category ?? "academic",
      sensitivityLevel: b.sensitivityLevel ?? "public",
      imageUrl: b.imageUrl ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("Building name is required", "error"); return; }
    setSaving(true);
    try {
      // Keys MUST be camelCase — updateBuilding/createBuilding read data.imageUrl and
      // data.sensitivityLevel. Sending snake_case made both arrive as undefined so
      // Supabase silently skipped them, causing the photo change to not persist.
      const payload = {
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        sensitivityLevel: form.sensitivityLevel,  // was: sensitivity_level (wrong key)
        imageUrl: form.imageUrl || null,           // was: image_url        (wrong key)
      };
      if (editingId) {
        await updateBuilding(editingId, payload);
      } else {
        await createBuilding(payload);
      }
      load(); // re-fetch from DB to confirm what was persisted
      closeForm();
      showToast(editingId ? "Building updated!" : "Building created!");
    } catch (e: any) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building? Associated panoramas will also be removed.")) return;
    try {
      await deleteBuilding(id);
      setBuildings(prev => prev.filter(b => b.id !== id)); // ✅ Optimistic remove
      showToast("Building deleted!");
    } catch (e: any) {
      showToast(e.message || "Delete failed", "error");
    }
  };

  const filtered = buildings.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.category?.toLowerCase().includes(search.toLowerCase())
  );

  const field = (label: string, children: React.ReactNode, span2 = false) => (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="text-sm font-semibold text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  );

  const inputCls = "w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm";

  return (
    <div className="space-y-5">
      <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} />}</AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Building Management</h2>
          <p className="text-gray-500 text-sm">{buildings.length} buildings · Add, edit, and upload images</p>
        </div>
        <div className="flex gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search buildings…"
            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none" />
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap">
            <Plus size={18} /> Add Building
          </button>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                {editingId ? "Edit Building" : "Add New Building"}
              </h3>
              <button onClick={closeForm}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {field("Building Name *",
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. School of Engineering" className={inputCls} />, true)}

              {field("Category",
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                  <option value="admin">Administration</option>
                  <option value="academic">Academic</option>
                  <option value="facilities">Facilities</option>
                  <option value="services">Services</option>
                </select>)}

              {field("Sensitivity Level",
                <select value={form.sensitivityLevel} onChange={e => setForm(f => ({ ...f, sensitivityLevel: e.target.value }))} className={inputCls}>
                  <option value="public">Public (Everyone)</option>
                  <option value="student">Students+</option>
                  <option value="staff">Staff & Admin Only</option>
                  <option value="admin">Admin Only</option>
                </select>)}

              {field("Building Image",
                <ImageUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />, true)}

              {field("Description",
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Describe this building…"
                  className={`${inputCls} resize-none`} />, true)}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={16} />}
                {editingId ? "Update Building" : "Create Building"}
              </button>
              <button onClick={closeForm}
                className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{search ? "No buildings match your search" : "No buildings yet"}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((b, idx) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.03 }}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                  {/* Image */}
                  {b.imageUrl ? (
                    <div className="h-36 overflow-hidden relative flex-shrink-0">
                      <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = "none"; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                      <Image size={36} className="text-gray-300" />
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-black text-gray-800 text-sm leading-tight">{b.name}</h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {b.sensitivityLevel !== "public" && <Lock size={13} className="text-orange-500" />}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${catColor[b.category] || "bg-gray-100 text-gray-600"}`}>
                          {b.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 flex-1">{b.description || <span className="italic opacity-50">No description</span>}</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(b)}
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
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}