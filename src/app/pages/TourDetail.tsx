import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, MapPin, Building2, ChevronRight, Camera, Lock, Info } from "lucide-react";
import { getBuilding, getPanoramas, logActivity } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PanoramaViewer } from "../components/tour/PanoramaViewer";

export default function TourDetail() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [building, setBuilding] = useState<any>(null);
  const [panoramas, setPanoramas] = useState<any[]>([]);
  const [currentPano, setCurrentPano] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    if (!buildingId) return;
    Promise.all([
      getBuilding(buildingId),
      getPanoramas(buildingId),
    ]).then(([b, panos]) => {
      setBuilding(b);
      setPanoramas(panos);
      if (panos.length > 0) setCurrentPano(panos[0]);

      // Check sensitivity
      if (b.sensitivityLevel === "staff" && role !== "staff" && role !== "admin") {
        setRestricted(true);
      }

      if (user) {
        logActivity({ action: "tour_view", userId: user.id, buildingId, details: { buildingName: b.name } }).catch(() => {});
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [buildingId, role]);

  const handleHotspotClick = (targetPanoId: string) => {
    const target = panoramas.find(p => p.id === targetPanoId);
    if (target) {
      setCurrentPano(target);
      if (user) logActivity({ action: "hotspot_click", userId: user.id, buildingId, details: { targetPanoId } }).catch(() => {});
    }
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
            {currentPano ? (
              <PanoramaViewer
                imageUrl={currentPano.imageUrl}
                name={currentPano.name}
                hotspots={currentPano.hotspots || []}
                onHotspotClick={handleHotspotClick}
              />
            ) : (
              <div className="h-full bg-gray-200 flex items-center justify-center rounded-2xl">
                <div className="text-center text-gray-400">
                  <Camera size={48} className="mx-auto mb-2" />
                  <p>No panorama available</p>
                </div>
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
                    <img src={pano.imageUrl} alt={pano.name} className="w-full h-full object-cover" />
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
              <li>🖱️ <strong>Drag</strong> the image to look around</li>
              <li>⬅️ ➡️ Use <strong>arrow buttons</strong> to pan</li>
              <li>🔵 Click <strong>yellow hotspots</strong> to move</li>
              <li>⛶ <strong>Fullscreen</strong> button for best experience</li>
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
