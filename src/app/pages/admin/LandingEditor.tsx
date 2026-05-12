import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Save, UploadCloud } from "lucide-react";
import { getLandingContent, SERVER_URL, updateLandingContent, uploadImage, type LandingContent } from "../../lib/api";

const DEFAULT_CONTENT: LandingContent = {
  heroBadge: "University of Bohol",
  heroTitle: "Virtual Campus",
  heroTitleAccent: "Companion",
  heroSubtitle:
    "Explore, navigate, and discover the University of Bohol campus through immersive 360° tours and interactive maps.",
  heroImageUrl: "https://images.unsplash.com/photo-1572162452011-08150287fc3a?w=1600&q=80",
  campusImageUrl: "https://images.unsplash.com/photo-1769589634324-cac82da5ac3a?w=800&q=80",
  campusCardTitle: "Main Administration Building",
  campusCardSubtitle: "Click to start tour →",
  campusSectionBadge: "360° Virtual Tours",
  campusSectionTitle: "Explore Campus Without Leaving Home",
  campusSectionBody:
    "Navigate through our immersive panoramic tours of all major buildings. Click hotspots to walk through corridors, visit labs, and discover hidden gems of the UB campus.",
  ctaTitle: "Ready to Explore UB Campus?",
  ctaBody: "Sign up for free and unlock the full campus experience with your student or staff account.",
  ctaPrimaryLabel: "Get Started Free",
  ctaPrimaryTo: "/signup",
  ctaSecondaryLabel: "View Virtual Tours",
  ctaSecondaryTo: "/tours",
  stats: [
    { label: "Campus Buildings", value: "10+" },
    { label: "Virtual Tours", value: "10" },
    { label: "Campus Resources", value: "50+" },
    { label: "Active Students", value: "5000+" },
  ],
};

const toDisplayUrl = (url: string) => (url?.startsWith("/uploads/") ? `${SERVER_URL}${url}` : url);

export default function LandingEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ hero?: boolean; campus?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<LandingContent>(DEFAULT_CONTENT);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getLandingContent()
      .then((r) => {
        if (!mounted) return;
        setForm({ ...DEFAULT_CONTENT, ...(r?.content || {}) });
      })
      .catch((e: any) => mounted && setError(e?.message || "Failed to load landing content"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const heroPreview = useMemo(() => toDisplayUrl(form.heroImageUrl), [form.heroImageUrl]);
  const campusPreview = useMemo(() => toDisplayUrl(form.campusImageUrl), [form.campusImageUrl]);

  const update = (patch: Partial<LandingContent>) => {
    setSuccess(null);
    setError(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateStat = (idx: number, patch: Partial<LandingContent["stats"][number]>) => {
    setSuccess(null);
    setError(null);
    setForm((prev) => {
      const next = [...prev.stats];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, stats: next };
    });
  };

  const handleUpload = async (type: "hero" | "campus", file?: File | null) => {
    if (!file) return;
    try {
      setUploading((u) => ({ ...u, [type]: true }));
      const r = await uploadImage(file);
      if (type === "hero") update({ heroImageUrl: r.url });
      else update({ campusImageUrl: r.url });
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading((u) => ({ ...u, [type]: false }));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await updateLandingContent(form);
      setForm(r.content);
      setSuccess("Landing page updated.");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">Landing Page Editor</h2>
            <p className="text-sm text-gray-500 mt-1">Edit landing page text and replace images. Changes apply immediately.</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {(error || success) && (
          <div className="mt-4">
            {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
            {success && <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-xl">{success}</div>}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-800">Hero Section</h3>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <ImageIcon size={14} /> Background image
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-100">
            <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${heroPreview})` }} />
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm font-semibold text-gray-700 transition-colors">
              <UploadCloud size={16} />
              {uploading.hero ? "Uploading..." : "Upload Hero Image"}
              <input
                type="file"
                accept="image/*,.insp"
                className="hidden"
                onChange={(e) => handleUpload("hero", e.target.files?.[0])}
                disabled={!!uploading.hero}
              />
            </label>
            <input
              value={form.heroImageUrl}
              onChange={(e) => update({ heroImageUrl: e.target.value })}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Hero image URL"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">Badge</label>
              <input value={form.heroBadge} onChange={(e) => update({ heroBadge: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Accent word</label>
              <input value={form.heroTitleAccent} onChange={(e) => update({ heroTitleAccent: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600">Title</label>
            <input value={form.heroTitle} onChange={(e) => update({ heroTitle: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600">Subtitle</label>
            <textarea value={form.heroSubtitle} onChange={(e) => update({ heroSubtitle: e.target.value })} rows={3} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Campus preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-800">Campus Preview Section</h3>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <ImageIcon size={14} /> Preview image
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-100">
            <img src={campusPreview} alt="Campus preview" className="w-full h-44 object-cover" />
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm font-semibold text-gray-700 transition-colors">
              <UploadCloud size={16} />
              {uploading.campus ? "Uploading..." : "Upload Preview Image"}
              <input
                type="file"
                accept="image/*,.insp"
                className="hidden"
                onChange={(e) => handleUpload("campus", e.target.files?.[0])}
                disabled={!!uploading.campus}
              />
            </label>
            <input
              value={form.campusImageUrl}
              onChange={(e) => update({ campusImageUrl: e.target.value })}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Preview image URL"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">Badge</label>
              <input value={form.campusSectionBadge} onChange={(e) => update({ campusSectionBadge: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Card title</label>
              <input value={form.campusCardTitle} onChange={(e) => update({ campusCardTitle: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600">Section title</label>
            <input value={form.campusSectionTitle} onChange={(e) => update({ campusSectionTitle: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600">Section body</label>
            <textarea value={form.campusSectionBody} onChange={(e) => update({ campusSectionBody: e.target.value })} rows={3} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">Card subtitle</label>
              <input value={form.campusCardSubtitle} onChange={(e) => update({ campusCardSubtitle: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats + CTA */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-black text-gray-800">Stats Row</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {form.stats.map((s, idx) => (
              <div key={idx} className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                <div className="text-xs font-bold text-gray-600 mb-2">Stat #{idx + 1}</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-bold text-gray-500">Label</label>
                    <input
                      value={s.label}
                      onChange={(e) => updateStat(idx, { label: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Value</label>
                    <input
                      value={s.value}
                      onChange={(e) => updateStat(idx, { value: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-black text-gray-800">CTA Section</h3>
          <div>
            <label className="text-xs font-bold text-gray-600">CTA Title</label>
            <input value={form.ctaTitle} onChange={(e) => update({ ctaTitle: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">CTA Body</label>
            <textarea value={form.ctaBody} onChange={(e) => update({ ctaBody: e.target.value })} rows={3} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">Primary button label</label>
              <input value={form.ctaPrimaryLabel} onChange={(e) => update({ ctaPrimaryLabel: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Primary link</label>
              <input value={form.ctaPrimaryTo} onChange={(e) => update({ ctaPrimaryTo: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">Secondary button label</label>
              <input value={form.ctaSecondaryLabel} onChange={(e) => update({ ctaSecondaryLabel: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Secondary link</label>
              <input value={form.ctaSecondaryTo} onChange={(e) => update({ ctaSecondaryTo: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}