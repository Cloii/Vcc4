import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, Phone, Clock, MapPin, BookOpen, Building2, ChevronRight, X } from "lucide-react";
import { getResources, getBuildings, logActivity } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: "Administration", color: "text-blue-700", bg: "bg-blue-100" },
  academic: { label: "Academic", color: "text-green-700", bg: "bg-green-100" },
  facilities: { label: "Facilities", color: "text-purple-700", bg: "bg-purple-100" },
  services: { label: "Services", color: "text-orange-700", bg: "bg-orange-100" },
};

export default function Directory() {
  const { user } = useAuth();
  const [resources, setResources] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  // ✅ Abort controller ref for cleanup
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();

    Promise.all([getResources(), getBuildings()])
      .then(([r, b]) => {
        if (abortRef.current?.signal.aborted) return;
        setResources(r);
        setBuildings(b);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error(err);
      })
      .finally(() => {
        if (!abortRef.current?.signal.aborted) setLoading(false);
      });

    // ✅ Log activity only once, don't re-run on user change
    if (user) logActivity({ action: "directory_view", userId: user.id }).catch(() => {});

    // ✅ Cleanup on unmount
    return () => {
      abortRef.current?.abort();
    };
  }, []); // ✅ Empty deps — fetch once only

  const filtered = resources.filter(r => {
    const term = search.toLowerCase();
    const match = r.name?.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term) || r.location?.toLowerCase().includes(term);
    const cat = category === "all" || r.category === category;
    return match && cat;
  });

  const getBuilding = (id: string) => buildings.find(b => b.id === id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <BookOpen size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-blue-900">Resource Directory</h1>
            <p className="text-gray-500 text-sm">Find campus facilities, offices, and services</p>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          {/* Search & Filter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search resources, offices..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16} /></button>}
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-white min-w-[160px]">
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </motion.div>

          {/* Category pills */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {[{k:"all",label:"All"}, ...Object.entries(categoryConfig).map(([k,v]) => ({k,label:v.label}))].map(({k,label}) => (
              <button key={k} onClick={() => setCategory(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${category === k ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({length:5}).map((_,i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No resources found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r, idx) => {
                const cfg = categoryConfig[r.category] || categoryConfig.services;
                const bldg = getBuilding(r.buildingId || r.building_id);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                  >
                    <button
                      onClick={() => {
                        setSelected(selected?.id === r.id ? null : r);
                        if (user) logActivity({ action: "resource_view", userId: user.id, details: { resourceId: r.id } }).catch(() => {});
                      }}
                      className={`w-full text-left bg-white rounded-xl border-2 transition-all p-4 hover:shadow-md ${
                        selected?.id === r.id ? "border-blue-500 shadow-md" : "border-gray-100 hover:border-blue-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2.5 py-1 rounded-full capitalize flex-shrink-0 mt-0.5`}>
                          {r.category}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 text-sm">{r.name}</h3>
                          <p className="text-gray-500 text-xs mt-0.5 truncate">{r.description}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin size={11} className="text-red-500" /> {r.location}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={11} className="text-blue-500" /> {r.operating_hours || r.operatingHours}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${selected?.id === r.id ? "rotate-90" : ""}`} />
                      </div>

                      {/* Expanded */}
                      <AnimatePresence>
                        {selected?.id === r.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-gray-100 grid sm:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-bold text-gray-500 mb-1">CONTACT</p>
                                <a href={`tel:${r.contact_info || r.contactInfo}`} className="flex items-center gap-1.5 text-sm text-blue-700 font-medium hover:underline">
                                  <Phone size={13} /> {r.contact_info || r.contactInfo}
                                </a>
                              </div>
                              {bldg && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-1">BUILDING</p>
                                  <Link to={`/tours/${bldg.id}`} className="flex items-center gap-1.5 text-sm text-blue-700 font-medium hover:underline" onClick={e => e.stopPropagation()}>
                                    <Building2 size={13} /> {bldg.name}
                                  </Link>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
          <p className="text-gray-400 text-xs mt-4 text-center">Showing {filtered.length} of {resources.length} resources</p>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats by category */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-black text-gray-800 text-sm mb-3">By Category</h3>
            {Object.entries(categoryConfig).map(([k, cfg]) => {
              const count = resources.filter(r => r.category === k).length;
              return (
                <button key={k} onClick={() => setCategory(k === category ? "all" : k)}
                  className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl mb-1.5 transition-all ${
                    category === k ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2 py-0.5 rounded-full`}>{cfg.label}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-600">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-4 text-white">
            <h3 className="font-black text-sm mb-3">Quick Navigation</h3>
            <div className="space-y-2">

              <Link to="/tours" className="flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors">
                <BookOpen size={14} /> Take Virtual Tour
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}