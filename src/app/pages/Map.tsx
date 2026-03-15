import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Route, Accessibility, X, Navigation, Camera, Clock, Info, ChevronDown } from "lucide-react";
import { getBuildings, getPaths, getRoute, logActivity } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const categoryColors: Record<string, string> = {
  admin: "#1D4ED8",
  academic: "#16A34A",
  facilities: "#9333EA",
  services: "#EA580C",
};

const pathColors: Record<string, string> = {
  open: "#22C55E",
  construction: "#F59E0B",
  closed: "#EF4444",
};

const createBuildingIcon = (category: string, id: string, selected: boolean) => {
  const color = categoryColors[category] || "#1D4ED8";
  const size = selected ? 44 : 36;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px; height:${size}px;
      background:${color};
      border:3px solid ${selected ? "#F59E0B" : "white"};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      transition:all 0.2s;
    "><div style="transform:rotate(45deg);color:white;font-weight:900;font-size:${selected ? 14 : 11}px;font-family:Arial;">B</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const MapCenterController: React.FC<{ center: [number, number] | null }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 18, { animate: true });
  }, [center, map]);
  return null;
};

export default function MapPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [fromBuilding, setFromBuilding] = useState("");
  const [toBuilding, setToBuilding] = useState("");
  const [accessible, setAccessible] = useState(false);
  const [routeResult, setRouteResult] = useState<any>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [panelTab, setPanelTab] = useState<"info" | "route">("info");

  useEffect(() => {
    Promise.all([getBuildings(), getPaths()]).then(([b, p]) => {
      setBuildings(b);
      setPaths(p);
    }).catch(console.error);
  }, []);

  const handleBuildingClick = (building: any) => {
    setSelectedBuilding(building);
    setMapCenter([building.lat, building.lng]);
    if (user) logActivity({ action: "building_view", userId: user.id, buildingId: building.id }).catch(() => {});
  };

  const handleFindRoute = async () => {
    if (!fromBuilding || !toBuilding) return;
    setLoadingRoute(true);
    try {
      const result = await getRoute(fromBuilding, toBuilding, accessible);
      setRouteResult(result);
      if (user) logActivity({ action: "route_search", userId: user.id, details: { from: fromBuilding, to: toBuilding } }).catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRoute(false);
    }
  };

  const routePolylineCoords: [number, number][] = routeResult?.path?.map((id: string) => {
    const b = buildings.find(b => b.id === id);
    return b ? [b.lat, b.lng] : null;
  }).filter(Boolean) || [];

  const filteredPaths = filterStatus === "all" ? paths : paths.filter(p => p.status === filterStatus);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden z-10 shadow-lg">
        {/* Header */}
        <div className="bg-blue-800 text-white px-4 py-4">
          <h2 className="font-black text-lg">Campus Map</h2>
          <p className="text-blue-200 text-xs mt-0.5">University of Bohol</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setPanelTab("info")} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${panelTab === "info" ? "text-blue-700 border-b-2 border-blue-700" : "text-gray-500"}`}>
            <Info size={14} className="inline mr-1" /> Buildings
          </button>
          <button onClick={() => setPanelTab("route")} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${panelTab === "route" ? "text-blue-700 border-b-2 border-blue-700" : "text-gray-500"}`}>
            <Route size={14} className="inline mr-1" /> Find Route
          </button>
        </div>

        {panelTab === "info" && (
          <div className="flex-1 overflow-y-auto">
            {/* Path Status Legend */}
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Path Status</p>
              <div className="flex gap-3 flex-wrap">
                {[{status:"all",label:"All"},{status:"open",label:"Open"},{status:"construction",label:"Construction"},{status:"closed",label:"Closed"}].map(s => (
                  <button key={s.status} onClick={() => setFilterStatus(s.status)}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-all ${filterStatus === s.status ? "bg-blue-700 text-white border-blue-700" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                    {s.status !== "all" && <span className="inline-block w-2 h-2 rounded-full mr-1" style={{background: pathColors[s.status]}} />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Building List */}
            <div className="p-3">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Buildings ({buildings.length})</p>
              <div className="space-y-1.5">
                {buildings.map(b => (
                  <button key={b.id} onClick={() => handleBuildingClick(b)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-start gap-2.5 ${
                      selectedBuilding?.id === b.id ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: categoryColors[b.category] }} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{b.name}</p>
                      <p className="text-gray-500 text-xs capitalize">{b.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Legend */}
            <div className="p-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Categories</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(categoryColors).map(([cat, color]) => (
                  <div key={cat} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="capitalize text-gray-600">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {panelTab === "route" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">From Building</label>
                <select value={fromBuilding} onChange={e => setFromBuilding(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                  <option value="">Select starting point...</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">To Building</label>
                <select value={toBuilding} onChange={e => setToBuilding(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm">
                  <option value="">Select destination...</option>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={accessible} onChange={e => setAccessible(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <Accessibility size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Wheelchair-friendly routes only</span>
              </label>
              <button onClick={handleFindRoute} disabled={!fromBuilding || !toBuilding || loadingRoute}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {loadingRoute ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Navigation size={16} /> Find Route</>}
              </button>

              {routeResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-4 ${routeResult.found ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}
                >
                  {routeResult.found ? (
                    <>
                      <p className="text-green-700 font-bold mb-2">Route Found!</p>
                      <div className="flex gap-4 text-sm">
                        <div><span className="text-gray-500">Distance</span><p className="font-bold text-gray-800">{routeResult.distance}m</p></div>
                        <div><Clock size={14} className="inline text-gray-400 mr-1" /><span className="text-gray-500">Time</span><p className="font-bold text-gray-800">~{routeResult.walkingTime} min</p></div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 font-semibold mb-1">PATH:</p>
                        <div className="flex flex-wrap gap-1">
                          {routeResult.path.map((id: string, i: number) => {
                            const b = buildings.find(b => b.id === id);
                            return (
                              <span key={id} className="flex items-center gap-1">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{b?.name || id}</span>
                                {i < routeResult.path.length - 1 && <span className="text-gray-400 text-xs">→</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-red-700 font-medium">No accessible route found between these buildings.</p>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[9.6546, 123.8547]}
          zoom={17}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <MapCenterController center={mapCenter} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Path overlays */}
          {filteredPaths.map(path => {
            const from = buildings.find(b => b.id === path.fromBuilding);
            const to = buildings.find(b => b.id === path.toBuilding);
            if (!from || !to) return null;
            return (
              <Polyline
                key={path.id}
                positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                color={pathColors[path.status] || "#888"}
                weight={4}
                opacity={0.8}
                dashArray={path.status === "closed" ? "8,6" : path.status === "construction" ? "12,4" : undefined}
              />
            );
          })}

          {/* Route Polyline */}
          {routePolylineCoords.length > 1 && (
            <Polyline positions={routePolylineCoords} color="#1D4ED8" weight={6} opacity={0.9} />
          )}

          {/* Building Markers */}
          {buildings.map(b => (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={createBuildingIcon(b.category, b.id, selectedBuilding?.id === b.id)}
              eventHandlers={{ click: () => handleBuildingClick(b) }}
            >
              <Popup>
                <div className="p-1 min-w-[180px]">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">{b.name}</h3>
                  <p className="text-gray-500 text-xs mb-2 capitalize">{b.category}</p>
                  <p className="text-gray-600 text-xs mb-3 leading-relaxed">{b.description?.slice(0, 100)}...</p>
                  <Link to={`/tours/${b.id}`} className="flex items-center gap-1 bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors">
                    <Camera size={12} /> Start Tour
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Selected Building Panel */}
        <AnimatePresence>
          {selectedBuilding && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-w-xs w-full z-20"
            >
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
              <div className="pr-6">
                <div className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center" style={{ background: categoryColors[selectedBuilding.category] + "22" }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: categoryColors[selectedBuilding.category] }} />
                </div>
                <h3 className="font-black text-gray-800 text-base leading-tight">{selectedBuilding.name}</h3>
                <span className="inline-block text-xs capitalize bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1">{selectedBuilding.category}</span>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">{selectedBuilding.description?.slice(0, 120)}...</p>
                <div className="flex gap-2 mt-3">
                  <Link to={`/tours/${selectedBuilding.id}`}
                    className="flex-1 text-center bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl hover:bg-blue-800 transition-colors flex items-center justify-center gap-1.5">
                    <Camera size={14} /> Tour
                  </Link>
                  <button onClick={() => { setFromBuilding(selectedBuilding.id); setPanelTab("route"); }}
                    className="flex-1 text-center bg-yellow-500 text-blue-900 text-sm font-semibold py-2 rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-1.5">
                    <Route size={14} /> Route
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
