import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { motion } from "motion/react";
import {
  Camera, Plus, Edit2, Trash2, Save, X, Upload, Image,
  Building2, ExternalLink, Check, AlertCircle, Eye, ChevronDown, ChevronUp, Compass, MapPin
} from "lucide-react";
import {
  getPanoramas, createPanorama, updatePanorama, deletePanorama, getBuildings, uploadImage,
  getCampusTourSettings, updateCampusTourSettings,
  SERVER_URL,
} from "../../lib/api";
import { invalidatePanoramasCache } from "../TourDetail";
import { reorderPanoramas } from "../../lib/api";
import { HotspotEditor, type EditableHotspot } from "../../components/admin/HotspotEditor";

const resolveUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

const defaultForm = { buildingId: "", name: "", imageUrl: "", hotspots: [] as EditableHotspot[] };

// ── Mini Panorama Preview ─────────────────────────────────────────────────────
const MiniPreview = memo(({ url, name }: { url: string; name: string }) => {
  const [offset, setOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const cur = useRef(0);
  const resolved = resolveUrl(url);

  const norm = ((offset % 100) + 100) % 100;
  const tx = -(norm / 100) * 50;

  return (
    <div
      className="relative h-32 rounded-xl overflow-hidden bg-gray-900 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={e => { dragging.current = true; startX.current = e.clientX; }}
      onMouseMove={e => {
        if (!dragging.current) return;
        setOffset(cur.current - (e.clientX - startX.current) * 0.3);
      }}
      onMouseUp={() => { dragging.current = false; cur.current = offset; }}
      onMouseLeave={() => { dragging.current = false; cur.current = offset; }}
    >
      <img
        src={resolved} alt={name}
        className="absolute top-0 left-0 h-full pointer-events-none"
        style={{ width: "200%", transform: `translateX(${tx}%)`, transition: dragging.current ? "none" : "transform 0.2s" }}
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white/70 text-xs">
        <Camera size={10} /> Drag to preview
      </div>
    </div>
  );
});
MiniPreview.displayName = "MiniPreview";

// ── Image Uploader ────────────────────────────────────────────────────────────
const PanoUploader = memo(({ value, onChange }: { value: string; onChange: (url: string) => void }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ["jpg", "jpeg", "png", "gif", "webp", "insp"];
    if (!allowed.includes(ext) && !file.type.startsWith("image/")) {
      setError("Accepted: jpg, png, gif, webp, insp"); return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("File must be under 100MB"); return;
    }
    setError(""); setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(resolveUrl(url));
    } catch (e: any) { setError(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const resolved = resolveUrl(value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        {(["upload", "url"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t === "upload" ? "📁 Upload File" : "🔗 Image URL"}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div
          className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
          onClick={() => document.getElementById("pano-file-input")?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input id="pano-file-input" type="file" accept="image/*,.insp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload size={24} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">Drop 360° image or click to browse</p>
              <p className="text-xs text-gray-400">JPG, PNG, WebP, INSP — max 100MB</p>
            </div>
          )}
        </div>
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://example.com/panorama.jpg"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm" />
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {resolved && (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <MiniPreview url={resolved} name="Preview" />
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
            <span className="text-xs text-green-700 font-semibold flex items-center gap-1"><Check size={11} /> Image set</span>
            <a href={resolved} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
              <ExternalLink size={11} /> Open
            </a>
          </div>
        </div>
      )}
    </div>
  );
});
PanoUploader.displayName = "PanoUploader";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPanoramas() {
  const [panoramas, setPanoramas] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [filterBuilding, setFilterBuilding] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getPanoramas(),
      getBuildings(),
    ])
      .then(([p, b]) => {
        setPanoramas(p);
        setBuildings(b);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ✅ O(1) lookup map instead of O(n) find on every render
  const buildingMap = useMemo(
    () => new Map(buildings.map(b => [b.id, b.name])),
    [buildings]
  );
  const getBuildingName = useCallback(
    (id: string) => buildingMap.get(id) ?? id,
    [buildingMap]
  );

  const panoOptions = useMemo(
    () => panoramas.map(p => ({
      id: p.id,
      name: p.name,
      buildingId: p.buildingId,
      buildingName: buildingMap.get(p.buildingId),
    })),
    [panoramas, buildingMap]
  );

  // ✅ Memoized filtering + grouping — avoids recompute on unrelated state changes
  const grouped = useMemo(() => {
    const src = filterBuilding
      ? panoramas.filter(p => p.buildingId === filterBuilding)
      : panoramas;

    const map: Record<string, any[]> = {};
    for (const p of src) {
      if (!map[p.buildingId]) map[p.buildingId] = [];
      map[p.buildingId].push(p);
    }
    for (const bid of Object.keys(map)) {
      map[bid].sort(
        (a, b) =>
          (Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      );
    }
    return map;
  }, [panoramas, filterBuilding]);



  const handleEdit = useCallback((p: any) => {
    setEditingId(p.id);
    setForm({ buildingId: p.buildingId, name: p.name, imageUrl: p.imageUrl, hotspots: p.hotspots || [] });
    setShowForm(true);
    window.scrollTo(0, 0);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.buildingId || !form.name || !form.imageUrl) return;
    setSaving(true);
    try {
      if (editingId) {
        await updatePanorama(editingId, form);
      } else {
        // ✅ FIX: generate a UUID client-side so the DB "id NOT NULL" constraint is satisfied
        await createPanorama({ ...form, id: crypto.randomUUID() });
      }
      invalidatePanoramasCache(); // Clear cache so cross-building hotspots see new/updated panoramas
      setShowForm(false);
      setEditingId(null);
      setForm({ ...defaultForm });
      showToast(editingId ? "Panorama updated!" : "Panorama created!");
      load();
    } catch (e: any) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, showToast, load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this panorama?")) return;
    try {
      await deletePanorama(id);
      showToast("Panorama deleted!");
      load();
    } catch (e: any) {
      showToast(e.message || "Delete failed", "error");
    }
  }, [showToast, load]);

  const reorderInBuilding = useCallback(async (buildingId: string, fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;

    const current = panoramas.filter(p => p.buildingId === buildingId);
    const sorted = [...current].sort(
      (a, b) =>
        (Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    );

    const fromIdx = sorted.findIndex(p => p.id === fromId);
    const toIdx = sorted.findIndex(p => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...sorted];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Optimistic local update
    setPanoramas(all =>
      all.map(p => {
        if (p.buildingId !== buildingId) return p;
        const idx = next.findIndex(x => x.id === p.id);
        return idx >= 0 ? { ...p, sortOrder: idx } : p;
      })
    );

    try {
      const updated = await reorderPanoramas(buildingId, next.map(p => p.id));
      setPanoramas(all => [
        ...all.filter(p => p.buildingId !== buildingId),
        ...updated,
      ]);
      showToast("Reordered panoramas!");
    } catch (e: any) {
      showToast(e?.message || "Reorder failed", "error");
      load();
    }
  }, [panoramas, showToast, load]);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
  }, []);

  const formIsValid = form.buildingId && form.name && form.imageUrl;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-xl text-sm font-semibold text-white
            ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {toast.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800">Panorama Management</h2>
          <p className="text-gray-500 text-sm">{panoramas.length} panorama(s) · Manage 360° tour images per building</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none bg-white">
            <option value="">All Buildings</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...defaultForm }); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
          >
            <Plus size={18} /> Add Panorama
          </button>
        </div>
      </div>

      {/* How-to banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <div className="text-2xl shrink-0">💡</div>
        <div>
          <p className="font-black text-blue-900 text-sm">Upload-to-Tour Pipeline</p>
          <p className="text-blue-700 text-xs mt-1 leading-relaxed">
            1. <strong>Upload your 360° image</strong> (equirectangular format recommended, .insp also supported) ·
            2. <strong>Select the building</strong> it belongs to ·
            3. <strong>Give it a name</strong> (e.g. "Main Entrance") ·
            4. Click <strong>Create</strong> — it will immediately appear in the Virtual Tour for that building.
          </p>
        </div>
      </div>



      {/* Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border-2 border-blue-200 p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4 sm:mb-5 gap-3">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
              <Camera size={18} className="text-blue-600" />
              {editingId ? "Edit Panorama" : "Add New Panorama"}
            </h3>
            <button onClick={cancelForm}>
              <X size={20} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Building *</label>
              <select value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                <option value="">Select a building…</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Viewpoint Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Main Entrance, Room 101, Rooftop"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 block mb-1">360° Image *</label>
              <PanoUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
            </div>

            {form.imageUrl && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPin size={14} className="text-blue-600" /> Hotspots / Arrows
                  </label>
                  <span className="text-xs text-gray-500">Click on the panorama to place each arrow.</span>
                </div>
                <HotspotEditor
                  imageUrl={form.imageUrl}
                  selfPanoId={editingId}
                  panoOptions={panoOptions}
                  hotspots={form.hotspots}
                  onChange={next => setForm(f => ({ ...f, hotspots: next }))}
                />
              </div>
            )}
          </div>

          {!formIsValid && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3">
              ⚠️ Building, name, and image are all required before saving.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || !formIsValid}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save size={16} />
              }
              {editingId ? "Update Panorama" : "Create Panorama"}
            </button>
            <button onClick={cancelForm}
              className="w-full sm:w-auto px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Grouped panoramas */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-24 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Camera size={52} className="mx-auto mb-3 opacity-30" />
          <p className="font-black text-lg">No panoramas yet</p>
          <p className="text-sm mt-1">Click "Add Panorama" to upload your first 360° image.</p>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...defaultForm }); }}
            className="mt-4 inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl"
          >
            <Plus size={16} /> Add Panorama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([buildingId, panos]) => {
            const isExpanded = expandedId === buildingId || !!filterBuilding;
            return (
              <div key={buildingId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded && !filterBuilding ? null : buildingId)}
                  className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 size={18} className="text-blue-700" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-800">{getBuildingName(buildingId)}</p>
                      <p className="text-xs text-gray-500">{panos.length} panorama{panos.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
                      {panos.map((pano, idx) => (
                        <motion.div key={pano.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                          <div
                            className="rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow bg-gray-50"
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", pano.id);
                            }}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                            onDrop={e => {
                              e.preventDefault();
                              const fromId = e.dataTransfer.getData("text/plain");
                              void reorderInBuilding(buildingId, fromId, pano.id);
                            }}
                            title="Drag to reorder"
                          >
                            {pano.imageUrl ? (
                              <MiniPreview url={resolveUrl(pano.imageUrl)} name={pano.name} />
                            ) : (
                              <div className="h-32 flex items-center justify-center bg-gray-200">
                                <Image size={28} className="text-gray-300" />
                              </div>
                            )}
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-black text-gray-800 text-sm leading-tight pr-1">{pano.name}</p>
                                <a href={`/tours/${pano.buildingId}`} target="_blank" rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800 flex-shrink-0 p-1 -m-1" title="View in Tour">
                                  <Eye size={14} />
                                </a>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1 font-semibold">↕ Drag to reorder · first = cover</p>
                              {pano.hotspots?.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">🔵 {pano.hotspots.length} hotspot{pano.hotspots.length !== 1 ? "s" : ""}</p>
                              )}
                              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                <button onClick={() => handleEdit(pano)}
                                  className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-lg">
                                  <Edit2 size={12} /> Edit
                                </button>
                                <button onClick={() => handleDelete(pano.id)}
                                  className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2 rounded-lg">
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Add more button */}
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <button
                          onClick={() => { setForm({ ...defaultForm, buildingId }); setShowForm(true); window.scrollTo(0, 0); }}
                          className="h-full min-h-[160px] sm:min-h-[180px] w-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <Plus size={22} />
                          <span className="text-xs font-semibold">Add Panorama</span>
                        </button>
                      </motion.div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}