import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass, Camera, MapPin, ArrowRight, AlertCircle, Navigation2, X, ChevronRight,
} from "lucide-react";
import {
  getPanoramas, getBuildings, getCampusTourSettings, getTourRoute, logActivity,
  type TourRouteStep,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { VirtualTourViewer } from "../components/tour/VirtualTourViewer";

type Pano = {
  id: string;
  buildingId: string;
  name: string;
  imageUrl: string;
  hotspots: any[];
};

type Building = { id: string; name: string; lat: number; lng: number };

export default function CampusTour() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const toPanoId = params.get("to");

  const [panos, setPanos] = useState<Pano[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [startPanoId, setStartPanoId] = useState<string | null>(null);
  const [activePanoId, setActivePanoId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [routeSteps, setRouteSteps] = useState<TourRouteStep[] | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // ✅ Abort refs for cleanup
  const routeAbortRef = useRef<AbortController | null>(null);

  // ✅ Fetch panoramas + buildings; refetch when tab wakes (discard / throttled fetch recovery)
  useEffect(() => {
    let cancelled = false;
    let loadSeq = 0;

    const load = (showSpinner: boolean) => {
      const seq = ++loadSeq;
      if (showSpinner) setLoading(true);

      Promise.all([
        getPanoramas(),
        getBuildings(),
        getCampusTourSettings().catch(() => ({ content: { startPanoId: null }, updatedAt: null })),
      ])
        .then(([p, b, s]) => {
          if (cancelled || seq !== loadSeq) return;
          setPanos(p as Pano[]);
          setBuildings(b as Building[]);
          const sid = s?.content?.startPanoId || (p as Pano[])[0]?.id || null;
          setStartPanoId(sid);
          setActivePanoId(sid || undefined);
        })
        .catch((err) => {
          if (cancelled || seq !== loadSeq) return;
          if (err?.name !== "AbortError") console.error(err);
        })
        .finally(() => {
          if (cancelled || seq !== loadSeq) return;
          setLoading(false);
        });
    };

    load(true);

    const onVisible = () => {
      if (document.hidden || cancelled) return;
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
      routeAbortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("resume", onResume);
    };
  }, []); // ✅ Not tied to `user` object identity

  useEffect(() => {
    if (!user?.id) return;
    logActivity({ action: "campus_tour_view", userId: user.id }).catch(() => {});
  }, [user?.id]);

  // ✅ Compute guided route when ?to= changes
  useEffect(() => {
    if (!startPanoId || !toPanoId) {
      setRouteSteps(null);
      setRouteError(null);
      return;
    }
    if (startPanoId === toPanoId) {
      setRouteSteps([]);
      setRouteError(null);
      setActivePanoId(toPanoId);
      return;
    }

    // ✅ Cancel any previous route fetch
    routeAbortRef.current?.abort();
    routeAbortRef.current = new AbortController();

    setRouteLoading(true);
    setRouteError(null);

    getTourRoute(startPanoId, toPanoId)
      .then((r) => {
        if (routeAbortRef.current?.signal.aborted) return;
        if (!r.found) {
          setRouteError("No arrow path found between these panoramas. Ask an admin to add hotspots.");
          setRouteSteps(null);
        } else {
          setRouteSteps(r.steps);
          setActivePanoId(startPanoId);
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setRouteError(e?.message || "Could not compute route");
        setRouteSteps(null);
      })
      .finally(() => {
        if (!routeAbortRef.current?.signal.aborted) setRouteLoading(false);
      });
  }, [startPanoId, toPanoId]);

  const buildingsById = useMemo(() => {
    const m = new Map<string, Building>();
    buildings.forEach((b) => m.set(b.id, b));
    return m;
  }, [buildings]);

  const startBuilding = useMemo(() => {
    const start = panos.find((p) => p.id === startPanoId);
    if (!start) return null;
    return buildingsById.get(start.buildingId) || null;
  }, [panos, startPanoId, buildingsById]);

  const destinationPano = useMemo(
    () => panos.find((p) => p.id === toPanoId) || null,
    [panos, toPanoId]
  );

  const currentStepIdx = useMemo(() => {
    if (!routeSteps || !activePanoId) return -1;
    const idx = routeSteps.findIndex((s) => s.from === activePanoId);
    if (idx >= 0) return idx;
    if (routeSteps.length > 0 && routeSteps[routeSteps.length - 1].to === activePanoId) {
      return routeSteps.length;
    }
    return -1;
  }, [routeSteps, activePanoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading campus tour…</p>
        </div>
      </div>
    );
  }

  if (panos.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Camera size={48} className="text-gray-300 mx-auto mb-3" />
        <h1 className="text-2xl font-black text-gray-800">No panoramas yet</h1>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          The campus tour will be available once panoramas are uploaded by an admin and a starting point is set.
        </p>
        <Link
          to="/map"
          className="inline-block mt-5 bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2.5 rounded-xl"
        >
          Browse the Campus Map
        </Link>
      </div>
    );
  }

  if (!startPanoId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Compass size={48} className="text-gray-300 mx-auto mb-3" />
        <h1 className="text-2xl font-black text-gray-800">Start point not set</h1>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          An admin must select a starting panorama (e.g. Main Gate) under <em>Admin → Panoramas</em>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
            <Compass size={22} className="text-blue-900" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-blue-900">Campus Tour</h1>
            <p className="text-gray-500 text-sm">
              {destinationPano ? (
                <>Guided tour to <strong>{destinationPano.name}</strong></>
              ) : (
                <>Free explore — use the arrows to walk around campus</>
              )}
            </p>
          </div>
        </div>
        <Link
          to="/map"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          <MapPin size={14} /> Open Map
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tour viewer */}
        <div className="lg:col-span-2">
          <div className="h-80 md:h-[520px] rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative h-full w-full">
              <VirtualTourViewer
                buildingName="UB Campus"
                lng={startBuilding?.lng ?? 123.8547}
                lat={startBuilding?.lat ?? 9.6546}
                panoramas={panos}
                startPanoId={startPanoId}
                activePanoId={activePanoId}
                strictHotspotLinks
                onNodeChange={(id) => {
                  setActivePanoId(id);
                  if (user?.id) logActivity({ action: "campus_tour_node", userId: user.id, details: { panoId: id } }).catch(() => {});
                }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active step info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Current viewpoint
            </p>
            <p className="font-black text-gray-800">
              {panos.find((p) => p.id === activePanoId)?.name || "—"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {(() => {
                const cur = panos.find((p) => p.id === activePanoId);
                const b = cur ? buildingsById.get(cur.buildingId) : null;
                return b?.name || "Campus";
              })()}
            </p>
          </motion.div>

          {/* Directions panel */}
          <AnimatePresence>
            {toPanoId && (
              <motion.div
                key="directions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-blue-900 text-sm flex items-center gap-1.5">
                    <Navigation2 size={14} /> Directions
                  </p>
                  <Link to="/campus-tour" className="text-blue-700 hover:text-blue-900" title="Clear directions">
                    <X size={14} />
                  </Link>
                </div>

                {routeLoading && (
                  <div className="flex items-center gap-2 text-blue-700 text-xs">
                    <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
                    Computing route…
                  </div>
                )}

                {routeError && (
                  <div className="bg-white border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    {routeError}
                  </div>
                )}

                {routeSteps && (
                  <ol className="space-y-1.5">
                    {routeSteps.length === 0 && (
                      <li className="text-xs text-blue-700">You are already at the destination.</li>
                    )}
                    {routeSteps.map((step, i) => {
                      const isCurrent = i === currentStepIdx;
                      const isDone = i < currentStepIdx;
                      return (
                        <li
                          key={`${step.from}->${step.to}`}
                          className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border transition ${
                            isCurrent
                              ? "bg-yellow-100 border-yellow-300 text-blue-900 font-bold"
                              : isDone
                              ? "bg-white/60 border-blue-100 text-gray-400 line-through"
                              : "bg-white border-blue-100 text-gray-700"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-blue-700 text-white font-black flex items-center justify-center text-[10px] flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">
                            <span className="opacity-80">{step.fromName}</span>
                            <ChevronRight size={12} className="inline mx-1 text-gray-400" />
                            <strong>{step.toName}</strong>
                            {step.label && (
                              <em className="block text-[10px] text-gray-500 not-italic">
                                Follow: "{step.label}"
                              </em>
                            )}
                          </span>
                        </li>
                      );
                    })}
                    {currentStepIdx >= routeSteps.length && routeSteps.length > 0 && (
                      <li className="text-xs text-green-700 font-semibold flex items-center gap-1.5 mt-2">
                        <ArrowRight size={12} /> You have arrived.
                      </li>
                    )}
                  </ol>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* How-to */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
          >
            <p className="font-bold text-gray-700 text-sm mb-2">How to navigate</p>
            <ul className="text-xs text-gray-600 space-y-1.5">
              <li>🖱️ <strong>Drag</strong> to look around (Ctrl + scroll to zoom)</li>
              <li>↗️ Click the <strong>yellow arrows</strong> to walk to a connected viewpoint</li>
              <li>🧭 No arrows? Ask an admin to add hotspots in Admin → Panoramas</li>

            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}