import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Camera, Search, Filter, Building2, ChevronRight, PlayCircle } from "lucide-react";
import { getBuildings } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../lib/api";
import { preloadBuildingPanoramas } from "../lib/panoramaPreloader"; // ← ADD THIS

// FIX #1: Use environment variable instead of hardcoded localhost
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";
const resolveImageUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  academic: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  facilities: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  services: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
};

export default function Tours() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  // Load buildings once — do NOT depend on `user` object identity: Supabase
  // `onAuthStateChange` (e.g. token refresh when the tab regains focus) calls
  // `setUser({...})` with a new object each time, which would otherwise re-run
  // this effect on every tab switch even though the account is unchanged.
  useEffect(() => {
    let cancelled = false;

    const load = (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      getBuildings()
        .then((list) => {
          if (cancelled) return;
          setBuildings(Array.isArray(list) ? list : []);
        })
        .catch((err) => {
          if (cancelled) return;
          if (import.meta.env.DEV) console.error("[Tours] getBuildings failed:", err);
          if (showSpinner) setBuildings([]);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    };

    load(true);

    const onVisible = () => {
      if (document.hidden || cancelled) return;
      // Recover when the tab wakes from sleep / discard / throttled background fetch
      load(false);
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !cancelled) load(false);
    };

    const onOnline = () => {
      if (!cancelled) load(false);
    };

    const onResume = () => {
      if (cancelled) return;
      load(false);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    document.addEventListener("resume", onResume);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("resume", onResume);
    };
  }, []);

  useEffect(() => {
    if (user?.id) logActivity({ action: "tours_page_view", userId: user.id }).catch(() => {});
  }, [user?.id]);

  const filtered = buildings.filter(b => {
    const term = search.toLowerCase();
    const matchSearch =
      (b.name?.toLowerCase() ?? "").includes(term) ||
      (b.description?.toLowerCase() ?? "").includes(term);
    const matchCat = category === "all" || b.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center">
            <Camera size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-blue-900">Virtual Campus Tours</h1>
            <p className="text-gray-500 text-sm">Explore the University of Bohol in immersive 360°</p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search buildings..."
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="pl-10 pr-8 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-white min-w-[180px] appearance-none"
          >
            <option value="all">All Categories</option>
            <option value="admin">Administration</option>
            <option value="academic">Academic</option>
            <option value="facilities">Facilities</option>
            <option value="services">Services</option>
          </select>
        </div>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Camera size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-lg font-medium">No buildings found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((b, idx) => {
            const colors = categoryColors[b.category] || categoryColors.services;
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
              >
                <Link
                  to={`/tours/${b.id}`}
                  className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group"
                  // ↓ Preload this building's panoramas when the user hovers the card
                  onMouseEnter={() => preloadBuildingPanoramas(b.id)}
                  // ↓ Also works on mobile (touch = intent to navigate)
                  onTouchStart={() => preloadBuildingPanoramas(b.id)}
                  onClick={() => user?.id && logActivity({ action: "tour_start", userId: user.id, buildingId: b.id }).catch(() => {})}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img src={resolveImageUrl(b.imageUrl)} alt={b.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Play button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-xl">
                        <PlayCircle size={28} className="text-blue-900" />
                      </div>
                    </div>
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {b.category}
                      </span>
                    </div>
                    {/* 360° badge */}
                    <div className="absolute top-3 right-3 bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      360°
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-black text-gray-800 text-base mb-1 group-hover:text-blue-700 transition-colors">{b.name}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{b.description}</p>
                    <div className="flex items-center gap-1 text-blue-600 text-sm font-semibold mt-3">
                      <Camera size={14} /> Start Tour <ChevronRight size={14} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Count */}
      {!loading && (
        <p className="text-center text-gray-400 text-sm mt-8">
          Showing {filtered.length} of {buildings.length} buildings
        </p>
      )}
    </div>
  );
}