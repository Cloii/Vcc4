import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, MapPin, Building2, ChevronRight, Camera, Lock, Info, PlusCircle } from "lucide-react";
import { getBuilding, getPanoramas, logActivity } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PanoramaViewer } from "../components/tour/PanoramaViewer";
import { VirtualTourViewer } from "../components/tour/VirtualTourViewer";

// FIX #1: Use environment variable instead of hardcoded localhost
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";
const resolveImageUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

// FIX #2: Module-level cache so it persists across navigations and is never
// re-fetched after the first successful load, no matter how many times the
// user visits a tour page.
let globalPanosCache: any[] | null = null;

export default function TourDetail() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPanoId = searchParams.get("pano");

  const [building, setBuilding] = useState<any>(null);
  const [panoramas, setPanoramas] = useState<any[]>([]);
  const [currentPano, setCurrentPano] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);

  const buildingPanoIds = useMemo(() => new Set(panoramas.map((p) => p.id)), [panoramas]);

  useEffect(() => {
    if (!buildingId) return;
    Promise.all([
      getBuilding(buildingId),
      getPanoramas(buildingId),
    ]).then(([b, panos]) => {
      setBuilding(b);
      setPanoramas(panos);
      if (panos.length > 0) {
        const requested = requestedPanoId ? panos.find((p: any) => p.id === requestedPanoId) : null;
        setCurrentPano(requested || panos[0]);
      }

      // Check sensitivity
      if (b.sensitivityLevel === "staff" && role !== "staff" && role !== "admin") {
        setRestricted(true);
      }

      if (user) {
        logActivity({ action: "tour_view", userId: user.id, buildingId, details: { buildingName: b.name } }).catch(() => {});
      }
    }).catch(() => {
      // Server unavailable — show empty state gracefully
    }).finally(() => setLoading(false));
  }, [buildingId, role, requestedPanoId]);

  // FIX #2 (continued): Use the module-level cache instead of component state.
  // This means a global panorama fetch is only ever made once per browser session,
  // not once per tour page visit.
  const ensureAllPanos = async () => {
    if (globalPanosCache) return globalPanosCache;
    const all = await getPanoramas().catch(() => []);
    globalPanosCache = all;
    return all;
  };

  const jumpToPano = async (targetPanoId: string) => {
    // If it exists in the current building, just switch.
    const local = panoramas.find((p) => p.id === targetPanoId);
    if (local) {
      setCurrentPano(local);
      return;
    }

    // Otherwise, find it globally and navigate to its building tour page with ?pano=.
    const all = await ensureAllPanos();
    const target = all.find((p: any) => p.id === targetPanoId);
    if (!target?.buildingId) return;

    navigate(`/tours/${target.buildingId}?pano=${encodeURIComponent(targetPanoId)}`);
  };

  const handleHotspotClick = (targetPanoId: string) => {
    void jumpToPano(targetPanoId);
    if (user) logActivity({ action: "hotspot_click", userId: user.id, buildingId, details: { targetPanoId } }).catch(() => {});
  };

  const handleTourNodeChange = (panoId: string) => {
    const target = panoramas.find(p => p.id === panoId);
    if (target) setCurrentPano(target);
    if (user) logActivity({ action: "virtual_tour_node", userId: user.id, buildingId, details: { panoId } }).catch(() => {});
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500">Loading tour...</p>
      </div>
    </div>
  );

  if (!building) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Building2 size={48} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Building not found</p>
        <Link to="/tours" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to Tours</Link>
      </div>
    </div>
  );

  if (restricted) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-sm mx-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-red-600" />
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-2">Restricted Access</h2>
        <p className="text-gray-500 text-sm mb-5">This tour is only available to staff and administrators.</p>
        <div className="flex gap-3">
          <Link to="/tours" className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm text-center">Back</Link>
          <Link to="/login" className="flex-1 bg-blue-700 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 transition-colors text-sm text-center">Sign In</Link>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <Link to="/tours" className="hover:text-blue-600 flex items-center gap-1 font-medium">
          <ArrowLeft size={14} /> Tours
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-semibold">{building.name}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main viewer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Panorama Viewer */}
          <div className="h-80 md:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
            {panoramas.length > 1 ? (
              <div className="relative h-full w-full">
                <VirtualTourViewer
                  buildingName={building.name}
                  lng={building.lng}
                  lat={building.lat}
                  panoramas={panoramas}
                  activePanoId={currentPano?.id}
                  onExternalHotspotTarget={(targetPanoId) => {
                    void jumpToPano(targetPanoId);
                  }}
                  onNodeChange={handleTourNodeChange}
                />
              </div>
            ) : currentPano ? (
              <PanoramaViewer
                imageUrl={currentPano.imageUrl}
                name={currentPano.name}
                hotspots={currentPano.hotspots || []}
                onHotspotClick={handleHotspotClick}
              />
            ) : (
              // Fallback: show building image or a styled empty state
              <div className="h-full rounded-2xl overflow-hidden relative bg-gray-900">
                {building?.imageUrl ? (
                  <>
                    <img
                      src={resolveImageUrl(building.imageUrl)}
                      alt={building.name}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                        <Camera size={16} />
                        <span>No 360° panorama yet</span>
                      </div>
                      <p className="text-white font-black text-xl">{building.name}</p>
                      <p className="text-white/70 text-xs mt-1">Showing building preview image</p>
                    </div>
                    {(role === "admin" || role === "staff") && (
                      <div className="absolute top-4 right-4">
                        <Link
                          to="/admin/panoramas"
                          className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-blue-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg transition-colors"
                        >
                          <PlusCircle size={13} /> Add Panorama
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Camera size={48} className="mx-auto mb-2" />
                      <p className="font-semibold">No panorama available</p>
                      <p className="text-xs mt-1 text-gray-500">No image has been added for this building</p>
                      {(role === "admin" || role === "staff") && (
                        <Link to="/admin/panoramas"
                          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 hover:underline">
                          <PlusCircle size={13} /> Add Panorama in Admin Panel
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panorama selector */}
          {panoramas.length > 1 && (
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">📍 Viewpoints</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {panoramas.map(pano => (
                  <button key={pano.id} onClick={() => setCurrentPano(pano)}
                    className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${
                      currentPano?.id === pano.id ? "border-blue-600 ring-2 ring-blue-300" : "border-gray-200 hover:border-blue-300"
                    }`}
                    style={{ width: 100, height: 68 }}
                  >
                    <img src={resolveImageUrl(pano.imageUrl)} alt={pano.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                      <span className="text-white text-[10px] font-semibold leading-tight">{pano.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4">
          {/* Building Info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-blue-700" />
              </div>
              <div>
                <h1 className="font-black text-gray-800 text-lg leading-tight">{building.name}</h1>
                <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize font-medium mt-1">
                  {building.category}
                </span>
              </div>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">{building.description}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <MapPin size={14} className="text-red-500" />
              <span>{building.lat?.toFixed(4)}°N, {building.lng?.toFixed(4)}°E</span>
            </div>
          </motion.div>

          {/* Navigation Guide */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="bg-blue-50 rounded-2xl border border-blue-100 p-4"
          >
            <p className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2"><Info size={14} /> How to Navigate</p>
            <ul className="text-xs text-blue-600 space-y-1.5">
              <li>🖱️ <strong>Drag</strong> to look around (Ctrl + scroll to zoom)</li>
              <li>🧭 Use the <strong>top navbar</strong> for zoom/move/gallery/fullscreen</li>
              <li>➡️ Follow the <strong>tour arrows</strong> between viewpoints (GPS mode)</li>
              <li>🔵 Click <strong>yellow hotspots</strong> to jump to a linked viewpoint</li>
            </ul>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <p className="font-bold text-gray-700 text-sm mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/map" state={{ buildingId }}
                className="flex items-center gap-2 w-full bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 font-medium text-sm py-2.5 px-3 rounded-xl transition-colors">
                <MapPin size={14} /> View on Map
              </Link>
              <Link to="/directory"
                className="flex items-center gap-2 w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium text-sm py-2.5 px-3 rounded-xl transition-colors">
                <Info size={14} /> Find Resources Here
              </Link>
              <Link to="/tours"
                className="flex items-center gap-2 w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium text-sm py-2.5 px-3 rounded-xl transition-colors">
                <Camera size={14} /> Browse All Tours
              </Link>
            </div>
          </motion.div>

          {/* All Panoramas list */}
          {panoramas.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
            >
              <p className="font-bold text-gray-700 text-sm mb-3">All Viewpoints ({panoramas.length})</p>
              <div className="space-y-1.5">
                {panoramas.map(pano => (
                  <button key={pano.id} onClick={() => setCurrentPano(pano)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                      currentPano?.id === pano.id ? "bg-blue-100 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <Camera size={13} />
                    {pano.name}
                    {currentPano?.id === pano.id && <span className="ml-auto text-xs text-blue-500">● Now</span>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}